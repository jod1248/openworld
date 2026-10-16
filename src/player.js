import * as THREE from 'three';
import { game, emit } from './game.js';
import { input } from './input.js';
import { clamp, lerp } from './util.js';
import { STEP, WORLD_HALF } from './world/world.js';
import { audio } from './audio.js';

const STAND_H = 1.8, CROUCH_H = 1.0;

export class Player {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.height = STAND_H;
    this.eye = 1.65;
    this.radius = 0.4;
    this.onGround = false;
    this.crouching = false;
    this.maxHealth = 100;
    this.health = 100;
    this.maxArmor = 100;
    this.armor = 0;
    this.inCar = null;
    this.dead = false;
    this.god = false;
    this.sens = 0.0022;
    this.lookAccum = 0;
    this.moveAccum = 0;
    this.speed2D = 0;
    this.bobT = 0;
    this.shake = 0;
  }

  spawn(x, z, yaw = 0) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.dead = false;
    this.crouching = false;
  }

  look() {
    const sens = this.sens * (game.camera.fov / 75);   // finer aim when zoomed in
    const dx = input.mouseDX * sens, dy = input.mouseDY * sens;
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.5, 1.5);
    this.lookAccum += Math.abs(dx) + Math.abs(dy);
  }

  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }

  update(dt) {
    this.look();
    const w = game.world, p = this.pos;

    const wantCrouch = input.down('KeyC');
    if (wantCrouch) this.crouching = true;
    else if (this.crouching && !w.collides(p.x, p.z, this.radius * 0.95, p.y + STEP, p.y + STAND_H)) this.crouching = false;
    this.height = this.crouching ? CROUCH_H : STAND_H;
    this.eye = lerp(this.eye, this.crouching ? 0.85 : 1.65, Math.min(1, dt * 12));

    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const r = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let fx = -sy * f + cy * r, fz = -cy * f - sy * r;
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const aiming = (game.weapons?.ads || 0) > 0.5;
    const sprinting = !this.crouching && !aiming && (input.down('ShiftLeft') || input.down('ShiftRight'));
    const speed = (this.crouching ? 3.2 : sprinting ? 11 : 7) * (aiming ? 0.6 : 1);
    if (this.onGround || len > 0) {
      const accel = this.onGround ? 55 : 14;
      const ax = fx * speed - this.vel.x, az = fz * speed - this.vel.z;
      const al = Math.hypot(ax, az), maxA = accel * dt;
      if (al > maxA) { this.vel.x += (ax / al) * maxA; this.vel.z += (az / al) * maxA; }
      else { this.vel.x = fx * speed; this.vel.z = fz * speed; }
    }
    if (this.onGround && input.down('Space')) {
      this.vel.y = 8.2;
      this.onGround = false;
      emit('jump');
    }
    this.vel.y -= 25 * dt;

    const ox = p.x, oz = p.z;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    w.pushOut(p, this.radius, p.y + STEP, p.y + this.height);
    p.x = clamp(p.x, -WORLD_HALF, WORLD_HALF);
    p.z = clamp(p.z, -WORLD_HALF, WORLD_HALF);
    const moved = Math.hypot(p.x - ox, p.z - oz);
    this.moveAccum += moved;
    this.speed2D = moved / Math.max(dt, 1e-4);

    const prevY = p.y;
    p.y += this.vel.y * dt;
    if (this.vel.y > 0 && w.collides(p.x, p.z, this.radius * 0.9, p.y + this.height - 0.15, p.y + this.height)) {
      p.y = prevY;
      this.vel.y = 0;
    }
    const g = w.groundHeight(p.x, p.z, Math.max(prevY, p.y), this.radius);
    const wasGround = this.onGround;
    if (p.y <= g) {
      if (this.vel.y < -19) this.damage((-this.vel.y - 19) * 3);
      p.y = g;
      this.vel.y = 0;
      this.onGround = true;
    } else if (wasGround && this.vel.y <= 0 && p.y - g < STEP) {
      p.y = g;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  updateCamera(cam, dt) {
    this.bobT += dt * Math.min(this.speed2D, 8) * 1.4;
    const bob = this.onGround ? Math.sin(this.bobT) * 0.035 * Math.min(1, this.speed2D / 6) : 0;
    this.shake = Math.max(0, this.shake - dt * 3);
    const sh = this.shake * 0.05;
    cam.position.set(this.pos.x + (Math.random() - 0.5) * sh, this.pos.y + this.eye + bob + (Math.random() - 0.5) * sh, this.pos.z);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  damage(amount) {
    if (this.dead || this.god || amount <= 0) return;
    if (this.armor > 0) {
      const absorb = Math.min(this.armor, amount * 0.6);
      this.armor -= absorb;
      amount -= absorb;
    }
    this.health -= amount;
    this.shake = Math.min(1, this.shake + amount / 25);
    game.hud.flashDamage(amount);
    audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      emit('playerDied');
    }
  }

  heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }
}
