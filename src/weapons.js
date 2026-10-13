import * as THREE from 'three';
import { game, emit } from './game.js';
import { input } from './input.js';
import { raySphere } from './util.js';
import { audio } from './audio.js';
import { buildGunModel } from './models/guns.js';

export const WEAPONS = {
  pistol: { name: 'M9 Pistol', dmg: 22, interval: 0.2, mag: 12, ammo: 'light', spread: 0.012, range: 160, auto: false, reload: 1.2, recoil: 0.012, tier: 1, hint: 'Found in Haven' },
  shotgun: { name: 'Breacher Shotgun', dmg: 13, pellets: 9, interval: 0.85, mag: 6, ammo: 'shells', spread: 0.075, range: 60, auto: false, reload: 2.0, recoil: 0.05, tier: 2, hint: 'Ridgeport quest: Clear the Square' },
  smg: { name: 'Vector SMG', dmg: 13, interval: 0.075, mag: 32, ammo: 'light', spread: 0.035, range: 110, auto: true, reload: 1.6, recoil: 0.006, tier: 2, hint: 'Liberate Ashfall' },
  rifle: { name: 'AR-7 Rifle', dmg: 30, interval: 0.11, mag: 30, ammo: 'heavy', spread: 0.014, range: 240, auto: true, reload: 1.9, recoil: 0.01, tier: 3, hint: 'Liberate Dunmore' },
  plasma: { name: 'Plasma Caster', dmg: 48, interval: 0.16, mag: 24, ammo: 'cells', spread: 0.008, auto: true, reload: 2.0, recoil: 0.008, tier: 4, hint: 'Liberate Kestrel',
    projectile: { speed: 90, color: 0x55ffcc, size: 0.22 } },
  rocket: { name: 'Hellfire Launcher', dmg: 260, interval: 1.1, mag: 1, ammo: 'rockets', spread: 0, auto: false, reload: 1.6, recoil: 0.06, tier: 5, hint: 'Liberate Brightwater',
    projectile: { speed: 55, color: 0xff7733, size: 0.3, splash: 7 } },
};
export const WEAPON_ORDER = ['pistol', 'shotgun', 'smg', 'rifle', 'plasma', 'rocket'];
export const AMMO_INFO = {
  light: { name: 'Light rounds', max: 360, drop: 24 },
  shells: { name: 'Shells', max: 64, drop: 8 },
  heavy: { name: 'Heavy rounds', max: 300, drop: 20 },
  cells: { name: 'Plasma cells', max: 200, drop: 16 },
  rockets: { name: 'Rockets', max: 20, drop: 2 },
};
export const UPGRADE_TRACKS = { dmg: 'Damage', rate: 'Fire rate', mag: 'Magazine' };

export function weaponStats(id, up) {
  const w = WEAPONS[id];
  return {
    dmg: w.dmg * (1 + 0.25 * up.dmg),
    interval: w.interval / (1 + 0.18 * up.rate),
    mag: Math.round(w.mag * (1 + 0.3 * up.mag)),
  };
}
export function upgradeCost(id, level) {
  const t = WEAPONS[id].tier;
  return { cores: Math.round(15 * t * (level + 1)), parts: level + 1 };
}

// Models live in models/guns.js; arms are only drawn on the gun you're holding
export function buildWeaponModel(id, arms = false) { return buildGunModel(id, arms); }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3(), _p = new THREE.Vector3();
const _r = new THREE.Vector3(), _u = new THREE.Vector3();

export function hitscan(o, d, range, dmg) {
  let best = game.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, range);
  let target = null;
  for (const h of game.hittables) {
    if (!h.alive) continue;
    const s = h.sphere();
    const t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, s.x, s.y, s.z, s.r);
    if (t < best) { best = t; target = h; }
  }
  const p = _p.copy(d).multiplyScalar(best).add(o);
  if (target) {
    const killed = target.damage(dmg, p.clone(), true);
    game.hud.hitMarker(killed);
  } else if (best < range) {
    game.effects.burst(p, 0x999088, 3, 2, 0.3);
  }
  return p;
}

export class WeaponSystem {
  constructor(camera) {
    this.camera = camera;
    this.holder = new THREE.Group();
    this.base = new THREE.Vector3(0.24, -0.24, -0.5);
    this.holder.position.copy(this.base);
    camera.add(this.holder);
    this.models = {};
    this.current = null;
    this.cooldown = 0;
    this.reloadT = 0;
    this.reloadMax = 1;
    this.switchT = 0;
    this.kick = 0;
    this.flashT = 0;
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.flash.visible = false;
    this.light = new THREE.PointLight(0xffc870, 0, 12);
    this.light.position.set(0.2, -0.1, -1);
    camera.add(this.light);
  }

  equip(id) {
    if (!game.inventory.has(id) || this.current === id) return;
    if (this.current) this.models[this.current].visible = false;
    if (!this.models[id]) {
      this.models[id] = buildWeaponModel(id, true);
      this.holder.add(this.models[id]);
    }
    const m = this.models[id];
    m.visible = true;
    m.add(this.flash);
    this.flash.position.copy(m.userData.muzzle);
    this.current = id;
    this.switchT = 0.3;
    this.reloadT = 0;
  }

  clear() {
    for (const k in this.models) this.models[k].visible = false;
    this.current = null;
  }

  startReload() {
    const inv = game.inventory, id = this.current;
    if (!id || this.reloadT > 0) return;
    const def = WEAPONS[id], ws = inv.weapons[id], st = weaponStats(id, ws.up);
    if (ws.mag >= st.mag || inv.ammo[def.ammo] <= 0) return;
    this.reloadT = this.reloadMax = def.reload;
    audio.reload();
  }

  finishReload() {
    const inv = game.inventory, id = this.current;
    const def = WEAPONS[id], ws = inv.weapons[id], st = weaponStats(id, ws.up);
    const take = Math.min(st.mag - ws.mag, inv.ammo[def.ammo]);
    ws.mag += take;
    inv.ammo[def.ammo] -= take;
    emit('reloaded');
  }

  update(dt) {
    const inv = game.inventory, P = game.player;
    this.holder.visible = !!this.current && !P.inCar;
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.light.intensity = this.flashT > 0 ? 6 : 0;
    if (!this.current || P.inCar) return;

    const owned = inv.owned();
    for (let i = 0; i < owned.length; i++) if (input.pressed('Digit' + (i + 1))) this.equip(owned[i]);
    if (input.wheel && owned.length > 1) {
      const idx = (owned.indexOf(this.current) + input.wheel + owned.length) % owned.length;
      this.equip(owned[idx]);
    }

    const id = this.current, def = WEAPONS[id], ws = inv.weapons[id], st = weaponStats(id, ws.up);
    this.cooldown -= dt;
    this.switchT = Math.max(0, this.switchT - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
    if (input.pressed('KeyR')) this.startReload();

    const trigger = def.auto ? input.mouseDown : input.clicked;
    if (trigger && this.cooldown <= 0 && this.reloadT <= 0 && this.switchT <= 0) {
      if (ws.mag > 0) {
        this.fire(id, def, ws, st);
        this.cooldown = st.interval;
      } else if (inv.ammo[def.ammo] > 0) this.startReload();
      else if (input.clicked) { audio.click(); game.hud.toast(`Out of ${def.ammo} ammo`, 'warn', 'ammo'); }
    }

    // View-model animation
    this.kick = Math.max(0, this.kick - dt * 8);
    const bob = P.onGround ? Math.min(P.speed2D, 7) / 7 : 0;
    const t = performance.now() * 0.001;
    let dip = 0, tilt = 0;
    if (this.reloadT > 0) { const k = 1 - this.reloadT / this.reloadMax; dip = Math.sin(k * Math.PI) * 0.18; tilt = Math.sin(k * Math.PI) * 0.6; }
    if (this.switchT > 0) dip += this.switchT * 0.8;
    this.holder.position.set(
      this.base.x + Math.sin(t * 8) * 0.012 * bob,
      this.base.y - Math.abs(Math.cos(t * 8)) * 0.012 * bob - dip - (P.crouching ? 0.02 : 0),
      this.base.z + this.kick * 0.08,
    );
    this.holder.rotation.set(this.kick * 0.15 + tilt * 0.3, 0, tilt * 0.4);
  }

  fire(id, def, ws, st) {
    ws.mag--;
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.getWorldPosition(_o);
    cam.getWorldDirection(_d);
    this.flash.getWorldPosition(_m);
    _r.setFromMatrixColumn(cam.matrixWorld, 0);
    _u.setFromMatrixColumn(cam.matrixWorld, 1);
    if (def.projectile) {
      const pr = def.projectile;
      const start = _o.clone().addScaledVector(_d, 0.6);
      game.projectiles.spawn({
        x: start.x, y: start.y - 0.1, z: start.z,
        vx: _d.x * pr.speed, vy: _d.y * pr.speed, vz: _d.z * pr.speed,
        owner: 'player', dmg: st.dmg, splash: pr.splash || 0, color: pr.color, size: pr.size, life: 4,
      });
    } else {
      for (let i = 0; i < (def.pellets || 1); i++) {
        const dir = _d.clone()
          .addScaledVector(_r, (Math.random() - 0.5) * 2 * def.spread)
          .addScaledVector(_u, (Math.random() - 0.5) * 2 * def.spread)
          .normalize();
        const end = hitscan(_o, dir, def.range, st.dmg);
        if (i < 3) game.effects.tracer(_m, end);
      }
    }
    this.kick = 1;
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    game.player.pitch += def.recoil;
    game.player.yaw += (Math.random() - 0.5) * def.recoil * 0.5;
    audio.shot(id);
    emit('shot', id);
  }
}
