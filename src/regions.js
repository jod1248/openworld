import * as THREE from 'three';
import { game, on, emit, removeFrom } from './game.js';
import { weightedPick, rand, clamp } from './util.js';
import { audio } from './audio.js';
import { randomFreePoint, getCity, cityAt } from './world/cities.js';
import { NEST_POS } from './quests.js';
import { AMMO_INFO, WEAPONS } from './weapons.js';

const crystalMat = new THREE.MeshLambertMaterial({ color: 0xff3cd8, emissive: 0x9a1080 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.6 });
const baseMat = new THREE.MeshLambertMaterial({ color: 0x2a2233 });
const nestMat = new THREE.MeshLambertMaterial({ color: 0x5a3a5a, emissive: 0x200a20 });

// Destructible alien structure: city beacons and the crawler nest.
class Structure {
  constructor(x, z, hp, kind, onDestroy) {
    this.kind = kind;
    this.maxHp = hp;
    this.hp = hp;
    this.alive = true;
    this.onDestroy = onDestroy;
    this.pos = new THREE.Vector3(x, 0, z);
    this.t = 0;
    this.flashT = 0;
    const g = new THREE.Group();
    g.position.copy(this.pos);
    this.mat = kind === 'nest' ? nestMat.clone() : crystalMat.clone();
    if (kind === 'beacon') {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 1.2, 8).translate(0, 0.6, 0), baseMat));
      this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), this.mat);
      this.crystal.scale.set(1.3, 4.5, 1.3);
      this.crystal.position.y = 6;
      g.add(this.crystal);
      this.rings = [0, 1].map(i => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 0.8, 0.08, 6, 32), ringMat);
        r.position.y = 4 + i * 4;
        r.rotation.x = Math.PI / 2;
        g.add(r);
        return r;
      });
      this.sph = { x, y: 5.5, z, r: 2.6 };
      this.box = game.world.addBox(x - 2.2, 0, z - 2.2, x + 2.2, 1.2, z + 2.2, 'beacon');
    } else {
      this.crystal = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.mat);
      this.crystal.scale.set(3, 1.6, 3);
      g.add(this.crystal);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 6), crystalMat);
        s.position.set(Math.cos(a) * 2.2, 1.2, Math.sin(a) * 2.2);
        s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(s);
      }
      this.sph = { x, y: 1.2, z, r: 2.8 };
      this.box = game.world.addBox(x - 2.4, 0, z - 2.4, x + 2.4, 1.4, z + 2.4, 'nest');
    }
    game.scene.add(g);
    this.mesh = g;
    game.hittables.push(this);
  }

  sphere() { return this.sph; }

  damage(amount, point, fromPlayer) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flashT = 0.08;
    if (fromPlayer) audio.hit();
    game.effects.burst(point || this.pos, this.kind === 'nest' ? 0x9a5a9a : 0xff3cd8, 4, 3, 0.4);
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }
    return false;
  }

  destroy() {
    this.alive = false;
    const c = new THREE.Vector3(this.sph.x, this.sph.y, this.sph.z);
    game.effects.explosion(c, 8);
    audio.explosion();
    this.remove();
    this.onDestroy?.();
  }

  remove() {
    this.alive = false;
    removeFrom(game.hittables, this);
    game.scene.remove(this.mesh);
    if (this.box) game.world.removeBox(this.box);
  }

  update(dt) {
    this.t += dt;
    this.flashT -= dt;
    this.mat.emissive.setHex(this.flashT > 0 ? 0xffffff : this.kind === 'nest' ? 0x200a20 : 0x9a1080);
    if (this.kind === 'beacon') {
      this.crystal.rotation.y += dt;
      this.crystal.position.y = 6 + Math.sin(this.t * 2) * 0.4;
      this.rings.forEach((r, i) => { r.position.y = 3 + ((this.t * 2 + i * 4) % 8); });
    } else {
      const s = 1 + Math.sin(this.t * 3) * 0.06;
      this.crystal.scale.set(3 * s, 1.6 / s, 3 * s);
    }
  }
}

const WILD = [
  { drone: 3, crawler: 2 },
  { crawler: 3, spitter: 1.5, drone: 1 },
  { crawler: 2, spitter: 2, stalker: 1, flyer: 1 },
  { spitter: 2, stalker: 2, flyer: 2, brute: 1 },
];

export class Regions {
  constructor() {
    this.wildTimer = 12;
    this.structures = [];
    this.nest = null;
    this.boss = null;
    this.stations = [];
    on('kill', a => {
      if (a.def.boss) this.onBossKilled();
    });
  }

  init() {
    for (const c of game.cities) {
      if (!c.hostile || c.id === 'metropolis') continue;
      c.beacon = new Structure(c.x, c.z, 500 * c.level, 'beacon', () => this.liberate(c));
      this.structures.push(c.beacon);
    }
    this.addStation(getCity('ridgeport').x + 6, getCity('ridgeport').z + 4);
  }

  addStation(x, z) {
    const g = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1), new THREE.MeshLambertMaterial({ color: 0x3d6b24 }));
    crate.position.y = 0.5;
    g.add(crate);
    const cross = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.04), cross);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.04), cross);
    a.position.set(0, 0.6, -0.52); b.position.set(0, 0.6, -0.52);
    g.add(a, b);
    g.position.set(x, 0, z);
    game.scene.add(g);
    game.world.addBox(x - 0.7, 0, z - 0.5, x + 0.7, 1, z + 0.5, 'station');
    const st = { pos: new THREE.Vector3(x, 0, z), ready: 0 };
    st.inter = {
      pos: st.pos, range: 2.6,
      label: () => (game.time < st.ready ? `Resupply recharging (${Math.ceil(st.ready - game.time)}s)` : 'Resupply: refill ammo & health'),
      interact: () => {
        if (game.time < st.ready) return;
        const inv = game.inventory, P = game.player;
        const types = new Set(inv.owned().map(id => WEAPONS[id].ammo));
        for (const t of types) inv.addAmmo(t, Math.ceil(AMMO_INFO[t].max * 0.5));
        P.health = P.maxHealth;
        st.ready = game.time + 60;
        audio.quest();
        game.hud.toast('Resupplied: health restored, ammo topped up', 'quest');
      },
    };
    game.interactables.push(st.inter);
    this.stations.push(st);
  }

  spawnInCity(c) {
    const P = game.player;
    const pt = randomFreePoint(c, P.pos, 35);
    if (!pt) return;
    game.aliens.spawn(weightedPick(c.aliens), pt.x, pt.z, c.level, { city: c.id });
  }

  spawnNest() {
    const qs = game.quests.state.clear_square;
    const nestDone = qs.progress[1] >= 1;
    const killsLeft = 6 - qs.progress[0];
    if (!nestDone && !this.nest) {
      this.nest = new Structure(NEST_POS.x, NEST_POS.z, 450, 'nest', () => {
        this.nest = null;
        emit('destroyed', 'nest');
        const st = game.quests.state.clear_square;
        const alive = game.aliens.count(a => a.tags.includes('nest'));
        const need = 6 - st.progress[0] - alive;
        for (let i = 0; i < need; i++) this.spawnNestCrawler();
      });
      this.structures.push(this.nest);
    }
    const alive = game.aliens.count(a => a.tags.includes('nest'));
    for (let i = alive; i < killsLeft; i++) this.spawnNestCrawler();
    this.nestTimer = 5;
  }

  spawnNestCrawler() {
    const a = Math.random() * Math.PI * 2, r = rand(5, 12);
    game.aliens.spawn('crawler', NEST_POS.x + Math.cos(a) * r, NEST_POS.z + Math.sin(a) * r, 1, { tags: ['nest'] });
  }

  liberate(c, silent = false) {
    if (c.liberated) return;
    c.liberated = true;
    if (c.beacon) { c.beacon.remove(); removeFrom(this.structures, c.beacon); c.beacon = null; }
    if (silent) game.aliens.despawnWhere(a => a.city === c.id);
    else game.aliens.killWhere(a => a.city === c.id);
    if (c.crystals) c.crystals.visible = false;
    if (c.id !== 'metropolis') {
      this.addStation(c.x + 6, c.z + 4);
      game.npcs.add({
        id: 'survivor_' + c.id, name: `${c.name} Survivor`, x: c.x - 5, z: c.z + 6, color: 0x7a6a5a,
        lines: ['You came for us... thank you.', 'Use the resupply crate, it\'s the least we can do.', `They held ${c.name} for months. Now it's ours again.`],
      });
    }
    const libCount = game.cities.filter(x => x.liberated && x.id !== 'metropolis').length;
    if (libCount >= 2 && !game.flags.shieldDown) {
      game.flags.shieldDown = true;
      if (!silent) setTimeout(() => game.hud.toast("The mothership's shield has collapsed! The Overseer is vulnerable.", 'big'), 2500);
    }
    if (silent) return;
    game.hud.toast(`${c.name} liberated!`, 'big');
    audio.quest();
    if (c.reward) game.inventory.grant(c.reward);
    emit('liberated', c);
    game.save();
  }

  onBossKilled() {
    game.flags.bossDead = true;
    this.boss = null;
    game.env.leaving = true;
    this.liberate(getCity('metropolis'));
    setTimeout(() => game.ui.victory(), 4000);
  }

  update(dt) {
    const P = game.player;
    for (const s of this.structures) if (s.alive) s.update(dt);

    for (const c of game.cities) {
      if (!c.hostile || c.liberated) continue;
      const d = Math.max(Math.abs(P.pos.x - c.x), Math.abs(P.pos.z - c.z));
      if (d < c.size + 140) {
        c.active = true;
        const count = game.aliens.count(a => a.city === c.id && !a.tags.includes('minion'));
        if (!c.filled) {
          for (let i = count; i < c.quota; i++) this.spawnInCity(c);
          c.filled = true;
          c.spawnTimer = 8;
        } else {
          c.spawnTimer -= dt;
          if (c.spawnTimer <= 0 && count < c.quota) { this.spawnInCity(c); c.spawnTimer = 8; }
        }
        if (c.id === 'metropolis' && !this.boss && !game.flags.bossDead) {
          this.boss = game.aliens.spawn('overseer', c.x, c.z, 1, { city: c.id, tags: ['boss'] });
        }
      } else if (c.active && d > c.size + 300) {
        c.active = false;
        c.filled = false;
        game.aliens.despawnWhere(a => a.city === c.id);
        if (c.id === 'metropolis') this.boss = null;
      }
    }

    // Nest keeps breeding while alive
    if (this.nest && this.nest.alive && game.quests.state.clear_square.status === 'active') {
      this.nestTimer -= dt;
      if (this.nestTimer <= 0) {
        this.nestTimer = 5;
        if (game.aliens.count(a => a.tags.includes('nest')) < 6 && Math.hypot(P.pos.x - NEST_POS.x, P.pos.z - NEST_POS.z) < 150) this.spawnNestCrawler();
      }
    }

    // Wilderness roamers
    game.aliens.despawnWhere(a => a.tags.includes('wild') && Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) > 240);
    if (!game.flags.tutorialDone || P.dead) return;
    if (cityAt(P.pos.x, P.pos.z, 20)) return;
    const H = getCity('haven'), R = getCity('ridgeport');
    if (Math.hypot(P.pos.x - H.x, P.pos.z - H.z) < 200 || Math.hypot(P.pos.x - R.x, P.pos.z - R.z) < 210) return;
    this.wildTimer -= dt;
    if (this.wildTimer > 0) return;
    this.wildTimer = rand(9, 16);
    if (game.aliens.count(a => a.tags.includes('wild')) >= 6) return;
    const dc = Math.hypot(P.pos.x, P.pos.z);
    const level = game.flags.openWorld ? clamp(dc > 700 ? 1 : dc > 520 ? 2 : dc > 380 ? 3 : 4, 1, 4) : 1;
    const table = WILD[level - 1];
    const n = 1 + Math.floor(Math.random() * 3);
    const ang = Math.random() * Math.PI * 2, r = rand(70, 100);
    for (let i = 0; i < n; i++) {
      const x = P.pos.x + Math.cos(ang) * r + rand(-6, 6), z = P.pos.z + Math.sin(ang) * r + rand(-6, 6);
      if (game.world.collides(x, z, 1.2, 0.3, 2.5) || Math.abs(x) > 990 || Math.abs(z) > 990) continue;
      game.aliens.spawn(weightedPick(table), x, z, level, { tags: ['wild'] });
    }
  }
}
