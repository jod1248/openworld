import * as THREE from 'three';
import { game, emit, removeFrom } from './game.js';
import { rand, pick } from './util.js';
import { audio } from './audio.js';
import { damagePlayerOrCar } from './projectiles.js';

export const ALIEN_TYPES = {
  drone: { name: 'Drone', hp: 30, speed: 3.5, dmg: 6, range: 1.8, cd: 1.0, radius: 0.5, height: 2, hitR: 0.6, hitY: 0, cores: 2, aggro: 45, float: 1.5, color: 0x6a4c93 },
  crawler: { name: 'Crawler', hp: 45, speed: 8.5, dmg: 8, range: 1.8, cd: 0.7, radius: 0.6, height: 1, hitR: 0.75, hitY: 0.5, cores: 3, aggro: 55, color: 0x5b7f2a },
  spitter: { name: 'Spitter', hp: 70, speed: 4, dmg: 12, range: 30, cd: 2.2, radius: 0.6, height: 2.2, hitR: 0.85, hitY: 1.2, cores: 4, aggro: 60, color: 0x3f9c6d },
  brute: { name: 'Brute', hp: 320, speed: 3.6, dmg: 22, range: 2.8, cd: 1.4, radius: 1.2, height: 3.2, hitR: 1.5, hitY: 1.7, cores: 10, aggro: 55, chargeDmg: 35, color: 0x7a3b3b },
  stalker: { name: 'Stalker', hp: 90, speed: 6.5, dmg: 16, range: 2.0, cd: 0.9, radius: 0.5, height: 2.3, hitR: 0.75, hitY: 1.2, cores: 6, aggro: 45, color: 0x4a7cff },
  flyer: { name: 'Flyer', hp: 70, speed: 10, dmg: 9, range: 40, cd: 1.6, radius: 0.8, height: 1, hitR: 1.0, hitY: 0, cores: 5, aggro: 70, fly: 9, color: 0x8a5a2b },
  overseer: { name: 'The Overseer', hp: 6000, speed: 2.5, dmg: 14, range: 70, cd: 2.4, radius: 4, height: 6, hitR: 4.5, hitY: 0, cores: 300, aggro: 140, fly: 8, boss: true, color: 0x40204f },
};

const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
};
const EYE_G = new THREE.MeshBasicMaterial({ color: 0x9dff4a });
const EYE_R = new THREE.MeshBasicMaterial({ color: 0xff3030 });
const EYE_C = new THREE.MeshBasicMaterial({ color: 0x6cf4ff });
const ACID = new THREE.MeshBasicMaterial({ color: 0x9dff2a });
const darkMat = c => new THREE.MeshLambertMaterial({ color: new THREE.Color(c).multiplyScalar(0.6) });

function part(g, geo, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !mat.isMeshBasicMaterial;
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

function buildMesh(type, def) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: def.color, emissive: 0x000000 });
  const anim = {};
  switch (type) {
    case 'drone':
      part(g, G.sphere, body, 0.45, 0.45, 0.45, 0, 0, 0);
      anim.ring = part(g, G.torus, darkMat(def.color), 0.65, 0.65, 0.65, 0, 0, 0);
      anim.ring.rotation.x = Math.PI / 2;
      part(g, G.sphere, EYE_G, 0.15, 0.15, 0.15, 0, 0.05, -0.38);
      break;
    case 'crawler': {
      part(g, G.sphere, body, 0.55, 0.35, 0.85, 0, 0.55, 0);
      part(g, G.sphere, body, 0.32, 0.28, 0.32, 0, 0.6, -0.8);
      part(g, G.sphere, EYE_R, 0.07, 0.07, 0.07, -0.13, 0.68, -1.08);
      part(g, G.sphere, EYE_R, 0.07, 0.07, 0.07, 0.13, 0.68, -1.08);
      const lm = darkMat(def.color);
      anim.legs = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = part(g, G.box, lm, 0.1, 0.7, 0.1, sx * 0.55, 0.3, sz * 0.4);
        leg.rotation.z = sx * 0.6;
        anim.legs.push(leg);
      }
      break;
    }
    case 'spitter':
      part(g, G.cyl, body, 0.45, 1.5, 0.45, 0, 0.75, 0);
      part(g, G.sphere, body, 0.48, 0.48, 0.48, 0, 1.75, 0);
      anim.sac = part(g, G.sphere, ACID, 0.35, 0.4, 0.35, 0, 1.7, 0.35);
      for (let i = -1; i <= 1; i++) part(g, G.sphere, EYE_G, 0.07, 0.07, 0.07, i * 0.15, 1.85, -0.43);
      break;
    case 'brute': {
      const dm = darkMat(def.color);
      part(g, G.box, body, 1.6, 1.4, 1.0, 0, 1.9, 0);
      anim.legs = [part(g, G.box, dm, 0.45, 1.2, 0.5, -0.45, 0.6, 0), part(g, G.box, dm, 0.45, 1.2, 0.5, 0.45, 0.6, 0)];
      anim.arms = [part(g, G.box, body, 0.45, 1.5, 0.45, -1.05, 1.6, 0), part(g, G.box, body, 0.45, 1.5, 0.45, 1.05, 1.6, 0)];
      part(g, G.box, dm, 0.6, 0.5, 0.6, 0, 2.85, -0.2);
      part(g, G.sphere, EYE_R, 0.08, 0.08, 0.08, -0.15, 2.9, -0.52);
      part(g, G.sphere, EYE_R, 0.08, 0.08, 0.08, 0.15, 2.9, -0.52);
      break;
    }
    case 'stalker':
      body.transparent = true;
      body.opacity = 0.25;
      part(g, G.cyl, body, 0.25, 1.2, 0.25, 0, 1.3, 0);
      part(g, G.sphere, body, 0.26, 0.32, 0.26, 0, 2.1, 0);
      part(g, G.cyl, body, 0.08, 1.0, 0.08, -0.15, 0.5, 0);
      part(g, G.cyl, body, 0.08, 1.0, 0.08, 0.15, 0.5, 0);
      anim.arms = [part(g, G.cyl, body, 0.06, 1.3, 0.06, -0.38, 1.3, -0.2), part(g, G.cyl, body, 0.06, 1.3, 0.06, 0.38, 1.3, -0.2)];
      anim.arms[0].rotation.x = anim.arms[1].rotation.x = 0.5;
      part(g, G.sphere, EYE_C, 0.06, 0.04, 0.06, -0.1, 2.15, -0.23);
      part(g, G.sphere, EYE_C, 0.06, 0.04, 0.06, 0.1, 2.15, -0.23);
      break;
    case 'flyer': {
      part(g, G.sphere, body, 0.5, 0.4, 1.0, 0, 0, 0);
      const tail = part(g, G.cone, darkMat(def.color), 0.25, 0.9, 0.25, 0, 0, 1.2);
      tail.rotation.x = Math.PI / 2;
      const wm = new THREE.MeshLambertMaterial({ color: 0xc9a06a, side: THREE.DoubleSide });
      anim.wings = [];
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.4, 0.1, 0);
        part(pivot, G.box, wm, 2.2, 0.05, 0.9, s * 1.1, 0, 0);
        g.add(pivot);
        anim.wings.push({ pivot, s });
      }
      part(g, G.sphere, EYE_R, 0.09, 0.09, 0.09, -0.18, 0.12, -0.9);
      part(g, G.sphere, EYE_R, 0.09, 0.09, 0.09, 0.18, 0.12, -0.9);
      break;
    }
    case 'overseer': {
      part(g, G.sphere, body, 3, 2.6, 3, 0, 0, 0);
      part(g, G.sphere, new THREE.MeshLambertMaterial({ color: 0xeeeeee }), 1.3, 1.3, 1.3, 0, 0.3, -2.3);
      anim.eye = part(g, G.sphere, EYE_R, 0.55, 0.55, 0.55, 0, 0.3, -3.4);
      const tm = darkMat(def.color);
      anim.tentacles = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(a) * 1.8, -1.8, Math.sin(a) * 1.8);
        part(pivot, G.cyl, tm, 0.25, 4, 0.25, 0, -2, 0);
        g.add(pivot);
        anim.tentacles.push({ pivot, a });
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = part(g, G.cone, EYE_G, 0.3, 1.6, 0.3, Math.cos(a) * 1.6, 2.6, Math.sin(a) * 1.6);
        sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      }
      anim.shield = part(g, G.sphere, new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.22, depthWrite: false }), 5.5, 5.5, 5.5, 0, 0, 0);
      break;
    }
  }
  return { group: g, body, anim };
}

export class Alien {
  constructor(type, x, z, level, opts = {}) {
    const def = ALIEN_TYPES[type];
    this.type = type;
    this.def = def;
    this.level = level;
    this.maxHp = def.hp * (1 + 0.35 * (level - 1));
    this.hp = this.maxHp;
    this.dmgMult = 1 + 0.25 * (level - 1);
    this.pos = new THREE.Vector3(x, def.fly || def.float || 0, z);
    this.vel = new THREE.Vector3();
    const m = buildMesh(type, def);
    this.mesh = m.group;
    this.body = m.body;
    this.anim = m.anim;
    if (level >= 4 && !def.boss) this.mesh.scale.setScalar(1.12);
    this.mesh.position.copy(this.pos);
    this.tags = opts.tags || [];
    this.city = opts.city || null;
    this.alive = true;
    this.dying = 0;
    this.state = 'chase';
    this.aggro = !!opts.aggro;
    this.cd = Math.random() * def.cd;
    this.special = rand(3, 7);
    this.summonT = 8;
    this.home = { x, z };
    this.wander = null;
    this.wanderT = 0;
    this.stuckT = 0;
    this.detour = null;
    this.detourT = 0;
    this.flashT = 0;
    this.t = Math.random() * 10;
    this.orbit = Math.random() * Math.PI * 2;
    this.strafe = 1;
    this._s = { x: 0, y: 0, z: 0, r: def.hitR };
  }

  sphere() {
    const s = this._s;
    s.x = this.pos.x; s.y = this.pos.y + this.def.hitY; s.z = this.pos.z;
    return s;
  }

  volume() {
    const P = game.player;
    return Math.max(0, 1 - Math.hypot(this.pos.x - P.pos.x, this.pos.z - P.pos.z) / 80);
  }

  damage(amount, point, fromPlayer) {
    if (!this.alive) return false;
    if (this.def.boss && !game.flags.shieldDown) {
      if (fromPlayer) game.hud.toast('The Overseer is shielded! Liberate 2 outposts to collapse the shield.', 'warn', 'shield');
      game.effects.burst(point || this.pos, 0x66aaff, 3, 3, 0.3);
      return false;
    }
    this.hp -= amount;
    this.flashT = 0.08;
    this.aggro = true;
    if (fromPlayer) audio.hit();
    game.effects.burst(point || this.pos, 0x7dff3a, 4, 3, 0.4);
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.dying = 0.5;
    removeFrom(game.hittables, this);
    audio.alienDie(this.volume());
    const c = this.sphere();
    game.effects.burst(new THREE.Vector3(c.x, c.y, c.z), 0x7dff3a, this.def.boss ? 60 : 16, this.def.boss ? 14 : 6, 0.8);
    if (this.def.boss) game.effects.explosion(new THREE.Vector3(c.x, c.y, c.z), 12);
    game.pickups.dropLoot(this);
    emit('kill', this);
  }

  attack(dmg) {
    damagePlayerOrCar(dmg * this.dmgMult);
    audio.alienAttack(this.volume());
  }

  shootAt(tx, ty, tz, speed, color, lob = false) {
    const sx = this.pos.x, sy = this.pos.y + (this.def.fly ? 0 : this.def.height * 0.8), sz = this.pos.z;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    if (lob) {
      const hd = Math.hypot(dx, dz), T = Math.max(0.5, hd / speed), g = 15;
      game.projectiles.spawn({ x: sx, y: sy, z: sz, vx: dx / T, vy: (dy + 0.5 * g * T * T) / T, vz: dz / T, gravity: g, owner: 'alien', dmg: this.def.dmg * this.dmgMult, color, size: 0.3, life: 5 });
    } else {
      const d = Math.hypot(dx, dy, dz) || 1;
      game.projectiles.spawn({ x: sx, y: sy, z: sz, vx: (dx / d) * speed, vy: (dy / d) * speed, vz: (dz / d) * speed, owner: 'alien', dmg: this.def.dmg * this.dmgMult, color, size: this.def.boss ? 0.5 : 0.25, life: 4 });
    }
    audio.alienShoot(this.volume());
  }

  update(dt) {
    if (!this.alive) {
      this.dying -= dt;
      this.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 4));
      this.mesh.position.y -= dt;
      return this.dying > 0;
    }
    const def = this.def, P = game.player;
    this.t += dt;
    this.cd -= dt;
    this.special -= dt;
    const tx = P.pos.x, tz = P.pos.z;
    const ty = P.inCar ? 1 : P.pos.y + (P.crouching ? 0.6 : 1.1);
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    const reach = def.range + (P.inCar ? 1.6 : 0);

    if (!this.aggro && dist < def.aggro) this.aggro = true;
    if (this.aggro && dist > def.aggro * 2.5) this.aggro = false;

    let mvx = 0, mvz = 0, speed = def.speed;
    let faceTarget = this.aggro && !P.dead;

    if (!this.aggro || P.dead) {
      this.wanderT -= dt;
      if (!this.wander || this.wanderT <= 0) {
        this.wander = { x: this.home.x + rand(-15, 15), z: this.home.z + rand(-15, 15) };
        this.wanderT = rand(3, 7);
      }
      const wx = this.wander.x - this.pos.x, wz = this.wander.z - this.pos.z;
      if (Math.hypot(wx, wz) > 1.5) { mvx = wx; mvz = wz; }
      speed *= 0.35;
    } else {
      switch (this.type) {
        case 'drone':
        case 'crawler':
          if (dist > reach * 0.7) { mvx = nx; mvz = nz; }
          if (dist < reach && this.cd <= 0) { this.attack(def.dmg); this.cd = def.cd; }
          break;
        case 'stalker': {
          if (dist > reach * 0.7) { mvx = nx; mvz = nz; }
          if (dist < reach && this.cd <= 0) { this.attack(def.dmg); this.cd = def.cd; }
          if (this.special <= 0 && dist > 10 && dist < 50 && !P.inCar) {
            const f = P.forward();
            const bx = P.pos.x - f.x * 4, bz = P.pos.z - f.z * 4;
            if (!game.world.collides(bx, bz, def.radius, 0.3, 2)) {
              game.effects.burst(this.pos.clone().setY(1.2), 0x4a7cff, 10, 3, 0.5);
              this.pos.x = bx; this.pos.z = bz;
              game.effects.burst(this.pos.clone().setY(1.2), 0x4a7cff, 10, 3, 0.5);
            }
            this.special = rand(6, 9);
          }
          this.body.opacity = dist < 9 ? 0.85 : 0.18 + Math.sin(this.t * 6) * 0.05;
          break;
        }
        case 'spitter':
          this.wanderT -= dt;
          if (this.wanderT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.wanderT = rand(1.5, 3); }
          if (dist > 24) { mvx = nx; mvz = nz; }
          else if (dist < 12) { mvx = -nx; mvz = -nz; }
          else { mvx = -nz * this.strafe; mvz = nx * this.strafe; speed *= 0.6; }
          if (dist < 32 && this.cd <= 0) { this.shootAt(tx, ty, tz, 20, 0x9dff2a, true); this.cd = def.cd * rand(0.8, 1.2); }
          break;
        case 'brute':
          if (this.state === 'charge') {
            mvx = this.chargeDir.x; mvz = this.chargeDir.z;
            speed = 16;
            faceTarget = false;
            this.chargeT -= dt;
            if (!this.chargeHit && dist < def.radius + 1.3) {
              this.chargeHit = true;
              this.attack(def.chargeDmg);
              if (!P.inCar) { P.vel.x += this.chargeDir.x * 14; P.vel.z += this.chargeDir.z * 14; P.vel.y = 5; P.onGround = false; }
            }
            if (this.chargeT <= 0) { this.state = 'chase'; this.cd = 1; }
          } else {
            if (dist > reach * 0.7) { mvx = nx; mvz = nz; }
            if (dist < reach && this.cd <= 0) { this.attack(def.dmg); this.cd = def.cd; }
            if (this.special <= 0 && dist < 28 && dist > 7) {
              this.state = 'charge';
              this.chargeDir = { x: nx, z: nz };
              this.chargeT = 1.3;
              this.chargeHit = false;
              this.special = rand(5, 8);
              audio.alienAttack(this.volume() * 2);
            }
          }
          break;
        case 'flyer': {
          this.orbit += dt * 0.7;
          const ox = tx + Math.cos(this.orbit) * 18 - this.pos.x, oz = tz + Math.sin(this.orbit) * 18 - this.pos.z;
          mvx = ox; mvz = oz;
          if (dist < 40 && this.cd <= 0) { this.shootAt(tx, ty, tz, 36, 0xff44dd); this.cd = def.cd * rand(0.8, 1.3); }
          break;
        }
        case 'overseer': {
          this.orbit += dt * 0.15;
          const ox = this.home.x + Math.cos(this.orbit) * 14 - this.pos.x, oz = this.home.z + Math.sin(this.orbit) * 14 - this.pos.z;
          mvx = ox; mvz = oz;
          const phase2 = this.hp < this.maxHp * 0.5;
          if (dist < def.range && this.cd <= 0 && game.flags.shieldDown) {
            const n = phase2 ? 7 : 5;
            for (let i = 0; i < n; i++) {
              const a = (i - (n - 1) / 2) * 0.12;
              const c = Math.cos(a), s = Math.sin(a);
              this.shootAt(this.pos.x + (dx * c - dz * s), ty, this.pos.z + (dx * s + dz * c), 34, 0xff44dd);
            }
            this.cd = def.cd * (phase2 ? 0.6 : 1);
          }
          this.summonT -= dt;
          if (this.summonT <= 0 && dist < def.range) {
            this.summonT = phase2 ? 9 : 14;
            const minions = game.aliens.count(a => a.tags.includes('minion'));
            if (minions < 10) {
              for (let i = 0; i < 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const type = phase2 ? pick(['stalker', 'brute', 'crawler']) : pick(['crawler', 'drone', 'crawler']);
                game.aliens.spawn(type, this.pos.x + Math.cos(a) * 9, this.pos.z + Math.sin(a) * 9, 4, { city: this.city, tags: ['minion'], aggro: true });
              }
              game.hud.toast('The Overseer summons minions!', 'warn', 'summon');
            }
          }
          break;
        }
      }
    }

    // Movement
    let ml = Math.hypot(mvx, mvz);
    if (ml > 0) { mvx /= ml; mvz /= ml; }
    if (this.detourT > 0) { this.detourT -= dt; mvx = this.detour.x; mvz = this.detour.z; ml = 1; }
    const k = Math.min(1, dt * 8);
    this.vel.x += (mvx * speed - this.vel.x) * k;
    this.vel.z += (mvz * speed - this.vel.z) * k;
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (!def.fly) {
      const hit = game.world.pushOut(this.pos, def.radius, 0.4, def.height);
      if (hit && this.state === 'charge') { this.state = 'chase'; this.cd = 1.5; game.effects.burst(this.pos.clone().setY(1.5), 0x999088, 8, 4, 0.5); }
    }
    const moved = Math.hypot(this.pos.x - px, this.pos.z - pz), want = speed * dt * (ml > 0 ? 1 : 0);
    if (want > 0 && moved < want * 0.3 && !def.fly) {
      this.stuckT += dt;
      if (this.stuckT > 0.5) {
        const s = Math.random() < 0.5 ? 1 : -1;
        this.detour = { x: -mvz * s, z: mvx * s };
        this.detourT = rand(0.8, 1.6);
        this.stuckT = 0;
      }
    } else this.stuckT = Math.max(0, this.stuckT - dt);

    // Height
    if (def.fly) this.pos.y = def.fly + Math.sin(this.t * 1.5) * 1.2;
    else if (def.float) this.pos.y = def.float + Math.sin(this.t * 2.5) * 0.25;
    else this.pos.y = 0;

    // Visuals
    this.mesh.position.copy(this.pos);
    let fx = faceTarget ? nx : this.vel.x, fz = faceTarget ? nz : this.vel.z;
    if (Math.hypot(fx, fz) > 0.05) {
      const target = Math.atan2(-fx, -fz);
      let d = target - this.mesh.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.mesh.rotation.y += d * Math.min(1, dt * 10);
    }
    const a = this.anim, sp = Math.hypot(this.vel.x, this.vel.z);
    if (a.ring) a.ring.rotation.z += dt * 4;
    if (a.legs) a.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * sp * 2.2 + i * Math.PI) * 0.5; });
    if (a.arms) a.arms.forEach((l, i) => { l.rotation.x = (this.type === 'stalker' ? 0.5 : 0) + Math.sin(this.t * 5 + i * Math.PI) * 0.3 * Math.min(1, sp / 2); });
    if (a.wings) a.wings.forEach(w => { w.pivot.rotation.z = w.s * Math.sin(this.t * 12) * 0.5; });
    if (a.sac) a.sac.scale.setScalar(0.35 + Math.max(0, 1 - this.cd / def.cd) * 0.12);
    if (a.tentacles) a.tentacles.forEach(t => { t.pivot.rotation.x = Math.sin(this.t * 1.5 + t.a) * 0.4; t.pivot.rotation.z = Math.cos(this.t * 1.2 + t.a) * 0.4; });
    if (a.shield) a.shield.visible = !game.flags.shieldDown;
    if (a.eye) a.eye.scale.setScalar(0.5 + Math.sin(this.t * 3) * 0.08);
    this.flashT -= dt;
    this.body.emissive.setHex(this.flashT > 0 ? 0xffffff : 0x000000);
    return true;
  }
}

export class AlienManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(type, x, z, level, opts = {}) {
    const a = new Alien(type, x, z, level, opts);
    this.scene.add(a.mesh);
    this.list.push(a);
    game.hittables.push(a);
    return a;
  }

  remove(a) {
    a.alive = false;
    removeFrom(game.hittables, a);
    this.scene.remove(a.mesh);
    a.body.dispose();
    removeFrom(this.list, a);
  }

  despawnWhere(fn) { for (const a of [...this.list]) if (fn(a)) this.remove(a); }
  killWhere(fn) { for (const a of [...this.list]) if (a.alive && fn(a)) a.die(); }
  count(fn) { let n = 0; for (const a of this.list) if (a.alive && fn(a)) n++; return n; }

  update(dt) {
    const P = game.player, L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive || a.def.fly) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive || b.def.fly) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = a.def.radius + b.def.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = ((min - d) * 0.5) / d;
          a.pos.x -= dx * push; a.pos.z -= dz * push;
          b.pos.x += dx * push; b.pos.z += dz * push;
        }
      }
    }
    for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i];
      if (a.alive && Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) > 320) continue;
      if (!a.update(dt)) { this.scene.remove(a.mesh); a.body.dispose(); L.splice(i, 1); }
    }
  }
}
