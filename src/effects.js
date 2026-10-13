import * as THREE from 'three';

const partGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const matCache = {};
const mat = color => (matCache[color] ||= new THREE.MeshBasicMaterial({ color }));

// Particles, tracers and explosions.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.pool = [];
    this.tracers = [];
    this.blasts = [];
    this.tracerIdx = 0;
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0 }));
      l.frustumCulled = false;
      l.visible = false;
      scene.add(l);
      this.tracers.push({ line: l, t: 0 });
    }
    this.blastGeo = new THREE.SphereGeometry(1, 16, 12);
  }

  burst(pos, color, count = 8, speed = 4, life = 0.5, gravity = 12, size = 1) {
    for (let i = 0; i < count; i++) {
      let m = this.pool.pop();
      if (!m) { m = new THREE.Mesh(partGeo, mat(color)); this.scene.add(m); }
      else m.material = mat(color);
      m.visible = true;
      m.position.copy(pos);
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      this.parts.push({
        m, life, max: life, g: gravity,
        vx: (Math.random() - 0.5) * 2 * speed, vy: Math.random() * speed * 1.2, vz: (Math.random() - 0.5) * 2 * speed,
      });
    }
    while (this.parts.length > 500) { const p = this.parts.shift(); p.m.visible = false; this.pool.push(p.m); }
  }

  smoke(pos) { this.burst(pos, 0x4a4a4a, 1, 0.8, 1.2, -2.5, 2.5); }

  tracer(a, b, color = 0xffeeaa) {
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    const arr = t.line.geometry.attributes.position.array;
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z; arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.color.set(color);
    t.line.material.opacity = 0.85;
    t.line.visible = true;
    t.t = 0.07;
  }

  explosion(pos, radius) {
    const m = new THREE.Mesh(this.blastGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos);
    m.scale.setScalar(0.5);
    this.scene.add(m);
    this.blasts.push({ m, t: 0, r: radius });
    this.burst(pos, 0xff8a2a, 22, radius * 1.4, 0.7, 10, 2);
    this.burst(pos, 0x333333, 14, radius, 1.2, -1, 3);
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; this.pool.push(p.m); this.parts.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.m.position.y < 0.05) { p.m.position.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      if (p.g < 0) p.m.scale.multiplyScalar(1 + dt * 0.8);
    }
    for (const t of this.tracers) {
      if (t.t <= 0) continue;
      t.t -= dt;
      t.line.material.opacity = Math.max(0, t.t / 0.07) * 0.85;
      if (t.t <= 0) t.line.visible = false;
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      const k = b.t / 0.4;
      b.m.scale.setScalar(0.5 + b.r * Math.min(1, k * 1.5));
      b.m.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) { this.scene.remove(b.m); b.m.material.dispose(); this.blasts.splice(i, 1); }
    }
  }
}
