import * as THREE from 'three';
import { game, emit, removeFrom } from './game.js';
import { WEAPONS, AMMO_INFO, buildWeaponModel } from './weapons.js';
import { audio } from './audio.js';

const KINDS = {
  cores: { color: 0x7dff3a, geo: 'oct', size: 0.28, auto: true },
  ammo: { color: 0xffc94a, geo: 'box', size: 0.35, auto: true },
  medkit: { color: 0xff4a4a, geo: 'box', size: 0.4, auto: true },
  parts: { color: 0x4ad8ff, geo: 'box', size: 0.32, auto: true },
  armor: { color: 0x4a7dff, geo: 'box', size: 0.45, auto: true },
  grenade: { color: 0x9dff4a, geo: 'sphere', size: 0.22, auto: true },
  weapon: { color: 0xffffff, auto: false },
  supply: { color: 0xc8a050, geo: 'box', size: 0.8, auto: false },
};

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.geos = { box: new THREE.BoxGeometry(1, 1, 1), oct: new THREE.OctahedronGeometry(1, 0), sphere: new THREE.SphereGeometry(1, 10, 8) };
    this.mats = {};
    this.beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 8, 6, 1, true).translate(0, 4, 0);
  }

  mat(c, emissive = true) {
    return (this.mats[c] ||= emissive ? new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }) : new THREE.MeshLambertMaterial({ color: c }));
  }

  spawn(kind, x, z, data = {}, y = 0.6) {
    const K = KINDS[kind];
    const mesh = new THREE.Group();
    if (kind === 'weapon') {
      const m = buildWeaponModel(data.id);
      m.scale.setScalar(2.2);
      m.rotation.y = Math.PI / 2;
      mesh.add(m);
    } else {
      const m = new THREE.Mesh(this.geos[K.geo], this.mat(K.color, kind !== 'supply'));
      m.scale.setScalar(K.size);
      mesh.add(m);
    }
    if (!K.auto) {
      const beam = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({
        color: kind === 'weapon' ? 0xb6ff7a : 0xffd34a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      beam.position.y = -y;
      mesh.add(beam);
    }
    const p = { kind, data, mesh, pos: new THREE.Vector3(x, y, z), baseY: y, alive: true, t: Math.random() * 6, age: 0 };
    mesh.position.copy(p.pos);
    this.scene.add(mesh);
    if (!K.auto) {
      p.inter = {
        pos: p.pos, range: 2.6,
        label: () => (kind === 'weapon' ? `Pick up ${WEAPONS[data.id].name}` : 'Pick up supply crate'),
        enabled: () => p.alive && (!data.enabled || data.enabled()),
        interact: () => this.collect(p),
      };
      game.interactables.push(p.inter);
    }
    this.list.push(p);
    return p;
  }

  dropLoot(alien) {
    const { pos, def, level } = alien;
    const x = pos.x, z = pos.z;
    const r = () => (Math.random() - 0.5) * 1.6;
    const cores = Math.max(1, Math.round(def.cores * (1 + 0.25 * (level - 1)) * (0.8 + Math.random() * 0.4) * (game.progress?.comboMult() ?? 1)));
    this.spawn('cores', x + r(), z + r(), { n: cores }, 0.5);
    if (Math.random() < (def.boss ? 1 : 0.35)) {
      const owned = game.inventory.owned();
      const id = game.weapons.current && Math.random() < 0.7 ? game.weapons.current : owned[Math.floor(Math.random() * owned.length)];
      if (id) this.spawn('ammo', x + r(), z + r(), { type: WEAPONS[id].ammo, n: AMMO_INFO[WEAPONS[id].ammo].drop });
    }
    if (Math.random() < 0.06) this.spawn('medkit', x + r(), z + r());
    if (Math.random() < 0.07 || def.boss) this.spawn('grenade', x + r(), z + r(), { n: def.boss ? 3 : 1 });
    if (Math.random() < 0.05 + 0.04 * level || def.boss) this.spawn('parts', x + r(), z + r(), { n: def.boss ? 10 : 1 });
  }

  update(dt) {
    const P = game.player;
    const range = P.inCar ? 3.5 : 1.8;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p.alive) { this.list.splice(i, 1); continue; }
      p.t += dt;
      p.age += dt;
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = p.baseY + Math.sin(p.t * 3) * 0.12;
      if (!KINDS[p.kind].auto) continue;
      if (p.age > 120) { this.remove(p); continue; }
      const dx = P.pos.x - p.mesh.position.x, dz = P.pos.z - p.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 5 && Math.abs(P.pos.y - p.pos.y) < 3) {
        p.mesh.position.x += (dx / d) * dt * 8;
        p.mesh.position.z += (dz / d) * dt * 8;
      }
      if (d < range) this.collect(p);
    }
  }

  remove(p) {
    p.alive = false;
    this.scene.remove(p.mesh);
    if (p.inter) removeFrom(game.interactables, p.inter);
  }

  clearKind(kind) { for (const p of this.list) if (p.kind === kind) this.remove(p); }

  collect(p) {
    if (!p.alive) return;
    const inv = game.inventory, d = p.data;
    switch (p.kind) {
      case 'cores': inv.cores += d.n; game.hud.loot(`+${d.n} Cores`); break;
      case 'ammo': inv.addAmmo(d.type, d.n); game.hud.loot(`+${d.n} ${AMMO_INFO[d.type].name}`); break;
      case 'medkit': inv.medkits++; game.hud.loot('+1 Medkit'); break;
      case 'grenade': inv.addGrenades(d.n || 1); game.hud.loot(`+${d.n || 1} Grenade`); break;
      case 'parts': inv.parts += d.n; game.hud.loot(`+${d.n} Upgrade part${d.n > 1 ? 's' : ''}`); break;
      case 'armor': { const P = game.player; P.armor = Math.min(P.maxArmor, P.armor + (d.n || 50)); game.hud.loot('+Armor'); break; }
      case 'weapon': inv.addWeapon(d.id); break;
      case 'supply': emit('collect', 'supply'); game.hud.loot('Supply crate recovered'); break;
    }
    audio.pickup();
    this.remove(p);
    emit('pickup', p);
  }
}
