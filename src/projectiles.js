import * as THREE from 'three';
import { game } from './game.js';
import { raySphere } from './util.js';
import { audio } from './audio.js';

const _pt = new THREE.Vector3();

export function damagePlayerOrCar(dmg) {
  const car = game.player.inCar;
  if (car) { car.damage(dmg); game.player.damage(dmg * 0.15); }
  else game.player.damage(dmg);
}

// opts: { fromPlayer, hurtPlayer }
export function explode(pt, radius, dmg, opts = {}) {
  game.effects.explosion(pt, radius);
  const P = game.player;
  const d = Math.hypot(pt.x - P.pos.x, pt.y - P.pos.y - 1, pt.z - P.pos.z);
  audio.explosion(Math.max(0.15, 1 - d / 150));
  P.shake = Math.min(1.5, P.shake + Math.max(0, 1 - d / 40));
  for (const h of [...game.hittables]) {
    if (!h.alive) continue;
    const s = h.sphere();
    const dd = Math.hypot(pt.x - s.x, pt.y - s.y, pt.z - s.z) - s.r;
    if (dd < radius) {
      const killed = h.damage(dmg * (1 - (Math.max(0, dd) / radius) * 0.7), pt.clone(), !!opts.fromPlayer);
      if (opts.fromPlayer) game.hud.hitMarker(killed);
    }
  }
  if (opts.hurtPlayer && d < radius) damagePlayerOrCar(dmg * 0.5 * (1 - d / radius));
  if (opts.fromPlayer || opts.hurtCars) {
    for (const c of game.vehicles.cars) {
      if (c.destroyed || c === P.inCar) continue;
      const dc = Math.hypot(pt.x - c.pos.x, pt.z - c.pos.z);
      if (dc < radius) c.damage(dmg * 0.5 * (1 - dc / radius));
    }
  }
}

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.geo = new THREE.SphereGeometry(1, 8, 6);
    this.mats = {};
  }

  mat(c) { return (this.mats[c] ||= new THREE.MeshBasicMaterial({ color: c })); }

  // o: {x,y,z,vx,vy,vz,owner,dmg,splash,color,size,gravity,life}
  spawn(o) {
    const mesh = new THREE.Mesh(this.geo, this.mat(o.color));
    mesh.scale.setScalar(o.size || 0.2);
    mesh.position.set(o.x, o.y, o.z);
    this.scene.add(mesh);
    this.list.push({ ...o, mesh, life: o.life ?? 5, trail: 0 });
  }

  clear() { for (const p of this.list) this.scene.remove(p.mesh); this.list.length = 0; }

  update(dt) {
    const P = game.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      const pos = p.mesh.position;
      p.vy -= (p.gravity || 0) * dt;
      const dx = p.vx * dt, dy = p.vy * dt, dz = p.vz * dt;
      const seg = Math.hypot(dx, dy, dz) || 1e-6;
      const ux = dx / seg, uy = dy / seg, uz = dz / seg;
      let tHit = game.world.raycast(pos.x, pos.y, pos.z, ux, uy, uz, seg + 0.01);
      let target = null;
      if (p.owner === 'player') {
        for (const h of game.hittables) {
          if (!h.alive) continue;
          const s = h.sphere();
          const t = raySphere(pos.x, pos.y, pos.z, ux, uy, uz, s.x, s.y, s.z, s.r + (p.size || 0));
          if (t < tHit) { tHit = t; target = h; }
        }
      } else if (!P.dead) {
        const car = P.inCar;
        const t = car
          ? raySphere(pos.x, pos.y, pos.z, ux, uy, uz, car.pos.x, 1, car.pos.z, 2)
          : raySphere(pos.x, pos.y, pos.z, ux, uy, uz, P.pos.x, P.pos.y + (P.crouching ? 0.5 : 0.9), P.pos.z, P.crouching ? 0.55 : 0.75);
        if (t < tHit) { tHit = t; target = 'player'; }
      }
      if (tHit <= seg || p.life <= 0) {
        _pt.set(pos.x + ux * Math.min(tHit, seg), pos.y + uy * Math.min(tHit, seg), pos.z + uz * Math.min(tHit, seg));
        this.impact(p, _pt, target);
        this.scene.remove(p.mesh);
        this.list.splice(i, 1);
        continue;
      }
      pos.x += dx; pos.y += dy; pos.z += dz;
      p.trail -= dt;
      if (p.trail <= 0 && p.splash) { p.trail = 0.03; game.effects.burst(pos, 0x777777, 1, 0.5, 0.6, -1, 1.5); }
    }
  }

  impact(p, pt, target) {
    if (p.splash >= 4) {
      explode(pt.clone(), p.splash, p.dmg, { fromPlayer: p.owner === 'player', hurtPlayer: p.owner !== 'player' });
      return;
    }
    if (target === 'player') damagePlayerOrCar(p.dmg);
    else if (target) {
      const killed = target.damage(p.dmg, pt.clone(), p.owner === 'player');
      if (p.owner === 'player') game.hud.hitMarker(killed);
    }
    game.effects.burst(pt, p.color, 6, 3, 0.35);
  }
}
