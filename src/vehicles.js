import * as THREE from 'three';
import { game, emit, removeFrom } from './game.js';
import { input } from './input.js';
import { clamp, pick } from './util.js';
import { WORLD_HALF } from './world/world.js';
import { audio } from './audio.js';
import { explode } from './projectiles.js';
import { buildCar } from './models/cars.js';

const CAR_COLORS = [0x9a1a1a, 0x1a3a7a, 0xe8e8e8, 0x1a1a1c, 0x2a5a3a, 0xd8a020, 0x5a6a7a, 0x8a8f96, 0x6a2a1a];
export class Car {
  constructor(x, z, heading, opts = {}) {
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.maxHealth = opts.health || 220;
    this.health = this.maxHealth;
    this.tag = opts.tag || null;
    this.destroyed = false;
    const m = buildCar(opts.color ?? pick(CAR_COLORS), !!opts.truck);
    this.mesh = m.group;
    this.bodyMat = m.body;
    this.wheels = m.wheels;
    this.wheelRot = 0;
    this.steerVis = 0;
    this.smokeT = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    game.scene.add(this.mesh);
    this.inter = {
      pos: this.pos, range: 3.6,
      label: () => (this.locked() ? 'Locked — Ozzie in Ridgeport can teach you to hotwire cars' : 'Enter vehicle'),
      enabled: () => !this.destroyed,
      interact: () => game.vehicles.enter(this),
    };
    game.interactables.push(this.inter);
  }

  locked() { return !this.tag && !game.flags.carsUnlocked; }
  speed() { return this.vx * -Math.sin(this.heading) + this.vz * -Math.cos(this.heading); }

  update(dt, driving) {
    if (this.destroyed) return;
    let h = this.heading;
    let fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    let along = this.vx * fx + this.vz * fz, lat = this.vx * rx + this.vz * rz;
    if (!driving && Math.abs(along) < 0.05 && Math.abs(lat) < 0.05) { this.vx = this.vz = 0; return; }
    let throttle = 0, steer = 0, hb = false;
    if (driving) {
      throttle = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      steer = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
      hb = input.down('Space');
    }
    if (throttle > 0) along += (along < 0 ? 40 : 20) * dt;
    else if (throttle < 0) along -= (along > 0 ? 40 : 12) * dt;
    else along *= Math.exp(-0.5 * dt);
    along = clamp(along, -14, 46);
    if (hb) along *= Math.exp(-1.6 * dt);
    if (!driving) along *= Math.exp(-3 * dt);
    lat *= Math.exp(-(hb ? 1.2 : 9) * dt);
    const sf = clamp(along / 8, -1, 1);
    const steerRate = 1.9 * (1 - Math.min(Math.abs(along) / 80, 0.4)) * (hb ? 1.4 : 1);
    this.heading += steer * steerRate * sf * dt;
    h = this.heading;
    fx = -Math.sin(h); fz = -Math.cos(h); rx = Math.cos(h); rz = -Math.sin(h);
    this.vx = fx * along + rx * lat;
    this.vz = fz * along + rz * lat;
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.pos.x = clamp(this.pos.x, -WORLD_HALF, WORLD_HALF);
    this.pos.z = clamp(this.pos.z, -WORLD_HALF, WORLD_HALF);

    if (game.world.pushOut(this.pos, 1.7, 0.5, 2.0)) {
      const n = game.world.lastNormal;
      const vn = this.vx * n.x + this.vz * n.z;
      if (vn < 0) {
        this.vx -= 1.4 * vn * n.x;
        this.vz -= 1.4 * vn * n.z;
        const impact = -vn;
        if (impact > 9) this.damage((impact - 9) * 3);
        if (impact > 5) {
          audio.thud();
          game.effects.burst(this.pos.clone().setY(1), 0xffd27a, 6, 4, 0.3);
          if (driving) game.player.shake = Math.min(1.2, impact / 25);
        }
      }
    }

    // Run over aliens
    const spd = Math.abs(along);
    if (spd > 6) {
      for (const a of game.aliens.list) {
        if (!a.alive || a.def.fly) continue;
        const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z;
        const r = 1.8 + a.def.radius;
        if (dx * dx + dz * dz < r * r) {
          a.damage(spd * 6, a.pos.clone().setY(1), true);
          a.vel.x += this.vx * 0.8;
          a.vel.z += this.vz * 0.8;
          this.vx *= 0.85;
          this.vz *= 0.85;
          this.damage(a.type === 'brute' || a.def.boss ? spd : 2);
          game.hud.hitMarker(!a.alive);
        }
      }
    }

    // Visuals
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = h;
    this.mesh.rotation.z = clamp(-lat * 0.01, -0.08, 0.08);
    this.wheelRot -= along * dt / 0.42;
    this.steerVis += (steer * 0.45 - this.steerVis) * Math.min(1, dt * 10);
    for (const w of this.wheels) {
      w.w.rotation.x = this.wheelRot;
      if (w.front) w.pivot.rotation.y = this.steerVis;
    }
    if (this.health < this.maxHealth * 0.35) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.12;
        game.effects.smoke(new THREE.Vector3(this.pos.x + fx * 1.7, 1.3, this.pos.z + fz * 1.7));
      }
    }
  }

  damage(n) {
    if (this.destroyed || n <= 0) return;
    this.health -= n;
    if (this.health <= 0) this.explode();
  }

  explode() {
    this.destroyed = true;
    this.health = 0;
    this.bodyMat.color.setHex(0x1a1a1a);
    removeFrom(game.interactables, this.inter);
    const P = game.player;
    if (P.inCar === this) { game.vehicles.exit(true); P.damage(35); }
    explode(this.pos.clone().setY(1), 8, 150, { fromPlayer: true, hurtPlayer: true });
    this.vx = this.vz = 0;
  }
}

export class Vehicles {
  constructor() {
    this.cars = [];
    this.camYaw = 0;
    this.camPos = new THREE.Vector3();
    this.shownHelp = false;
  }

  add(x, z, heading, opts) {
    const c = new Car(x, z, heading, opts);
    this.cars.push(c);
    return c;
  }

  init() {
    for (const c of game.cities) {
      if (!c.pitch || c.id === 'haven') continue;
      const want = c.id === 'metropolis' ? 14 : 5;
      let placed = 0;
      for (let tries = 0; tries < want * 10 && placed < want; tries++) {
        const m = Math.floor(Math.random() * (c.n * 2 + 1)) - c.n;
        const off = (Math.random() * 2 - 1) * (c.size - 10);
        const vertical = Math.random() < 0.5;
        const x = vertical ? c.x + m * c.pitch + 3 : c.x + off;
        const z = vertical ? c.z + off : c.z + m * c.pitch + 3;
        if (game.world.collides(x, z, 2.4, 0.3, 2)) continue;
        if (this.cars.some(o => Math.hypot(o.pos.x - x, o.pos.z - z) < 6)) continue;
        this.add(x, z, vertical ? (Math.random() < 0.5 ? 0 : Math.PI) : Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1));
        placed++;
      }
    }
    for (let i = 0; i < 16; i++) {
      const r = game.roads[Math.floor(Math.random() * game.roads.length)];
      const t = 0.15 + Math.random() * 0.7;
      const dx = r.bx - r.ax, dz = r.bz - r.az, L = Math.hypot(dx, dz);
      const side = Math.random() < 0.5 ? 3.5 : -3.5;
      const x = r.ax + dx * t + (-dz / L) * side, z = r.az + dz * t + (dx / L) * side;
      this.add(x, z, Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.3);
    }
    this.add(-6, 805, 0);
  }

  findTag(tag) { return this.cars.find(c => c.tag === tag && !c.destroyed); }

  enter(car) {
    if (car.locked()) { game.hud.toast('This car is locked. Ozzie in Ridgeport can teach you to hotwire.', 'warn', 'locked'); return; }
    const P = game.player;
    P.inCar = car;
    P.crouching = false;
    this.camYaw = 0;
    this.camPos.set(car.pos.x - Math.sin(car.heading) * -9, 4, car.pos.z - Math.cos(car.heading) * -9);
    audio.engine(true, 0);
    if (!this.shownHelp) {
      this.shownHelp = true;
      game.hud.toast('W/S accelerate &amp; brake · A/D steer · SPACE handbrake · F exit', 'quest');
    }
    emit('enterCar', car);
  }

  exit(force = false) {
    const P = game.player, car = P.inCar;
    if (!car) return;
    if (!force && Math.abs(car.speed()) > 14) { game.hud.toast('Slow down to exit', 'warn', 'exit'); return; }
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    let placed = false;
    for (const s of [-1, 1]) {
      const x = car.pos.x + rx * 2.6 * s, z = car.pos.z + rz * 2.6 * s;
      if (!game.world.collides(x, z, 0.5, 0.3, 1.8)) { P.pos.set(x, 0, z); placed = true; break; }
    }
    if (!placed) P.pos.set(car.pos.x, 2.2, car.pos.z);
    P.vel.set(0, 0, 0);
    P.yaw = car.heading;
    P.pitch = 0;
    P.inCar = null;
    audio.engine(false);
    emit('exitCar', car);
  }

  update(dt) {
    const P = game.player;
    for (const c of this.cars) c.update(dt, c === P.inCar);
    // Car vs car
    const near = this.cars.filter(c => !c.destroyed && Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) < 80);
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const a = near[i], b = near[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        const nx = dx / d, nz = dz / d, push = (3.4 - d) / 2;
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          a.vx += rv * nx * 0.6; a.vz += rv * nz * 0.6;
          b.vx -= rv * nx * 0.6; b.vz -= rv * nz * 0.6;
          if (-rv > 8) { a.damage(-rv); b.damage(-rv); audio.thud(); }
        }
      }
    }
    const car = P.inCar;
    if (car) {
      P.pos.set(car.pos.x, 0, car.pos.z);
      audio.engine(true, car.speed());
      if (input.pressed('KeyF')) { input.consume('KeyF'); this.exit(); }
    }
  }

  updateCamera(cam, dt) {
    const car = game.player.inCar;
    this.camYaw -= input.mouseDX * 0.004;
    if (Math.abs(input.mouseDX) < 0.5) this.camYaw *= Math.exp(-1.2 * dt);
    const ang = car.heading + this.camYaw;
    const bx = Math.sin(ang), bz = Math.cos(ang);
    let dist = 9;
    const ox = car.pos.x, oy = 2, oz = car.pos.z;
    const dirLen = Math.hypot(bx * 9, 2, bz * 9);
    const t = game.world.raycast(ox, oy, oz, (bx * 9) / dirLen, 2 / dirLen, (bz * 9) / dirLen, dirLen);
    if (t < dirLen) dist = Math.max(2, (t - 0.6) * (9 / dirLen));
    const desired = new THREE.Vector3(ox + bx * dist, 2 + 2 * (dist / 9), oz + bz * dist);
    this.camPos.lerp(desired, 1 - Math.exp(-10 * dt));
    cam.position.copy(this.camPos);
    cam.lookAt(ox - bx * 3, 1.4, oz - bz * 3);
  }
}
