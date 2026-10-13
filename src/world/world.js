import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CELL = 16;
export const STEP = 0.45;
export const WORLD_HALF = 1000;

function circleBox(x, z, r, b) {
  const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
  const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; }
  else {
    let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) return Infinity; }
  else {
    let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; }
  else {
    let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

// Static collision world: axis-aligned boxes in a uniform grid.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.grid = new Map();
    this.stamp = 1;
    this._q = [];
    this.lastNormal = { x: 0, z: 0 };
  }

  key(cx, cz) { return (cx + 512) * 1024 + (cz + 512); }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, tag = null) {
    const b = { minX, minY, minZ, maxX, maxY, maxZ, tag, s: 0, cells: [] };
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = this.key(x, z);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(b);
      b.cells.push(k);
    }
    return b;
  }

  removeBox(b) {
    for (const k of b.cells) {
      const arr = this.grid.get(k);
      if (!arr) continue;
      const i = arr.indexOf(b);
      if (i >= 0) arr.splice(i, 1);
    }
    b.cells = [];
  }

  // Returns a shared array — do not nest calls.
  query(minX, minZ, maxX, maxZ) {
    const out = this._q; out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const arr = this.grid.get(this.key(x, z));
      if (!arr) continue;
      for (const b of arr) if (b.s !== s) { b.s = s; out.push(b); }
    }
    return out;
  }

  groundHeight(x, z, feetY, r) {
    let h = 0;
    for (const b of this.query(x - r, z - r, x + r, z + r)) {
      if (b.maxY > feetY + STEP) continue;
      if (b.maxY > h && circleBox(x, z, r * 0.9, b)) h = b.maxY;
    }
    return h;
  }

  collides(x, z, r, y0, y1) {
    for (const b of this.query(x - r, z - r, x + r, z + r)) {
      if (b.minY >= y1 || b.maxY <= y0) continue;
      if (circleBox(x, z, r, b)) return true;
    }
    return false;
  }

  // Push a circle (p.x, p.z, r) out of all boxes overlapping [y0, y1]. Returns true if it hit anything.
  pushOut(p, r, y0, y1) {
    let hit = false, nx = 0, nz = 0;
    for (const b of this.query(p.x - r, p.z - r, p.x + r, p.z + r)) {
      if (b.minY >= y1 || b.maxY <= y0) continue;
      const cx = p.x < b.minX ? b.minX : p.x > b.maxX ? b.maxX : p.x;
      const cz = p.z < b.minZ ? b.minZ : p.z > b.maxZ ? b.maxZ : p.z;
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        dx /= d; dz /= d;
        p.x += dx * (r - d); p.z += dz * (r - d);
        nx += dx; nz += dz;
      } else {
        const l = p.x - b.minX, rr = b.maxX - p.x, f = p.z - b.minZ, bk = b.maxZ - p.z;
        const m = Math.min(l, rr, f, bk);
        if (m === l) { p.x = b.minX - r; nx -= 1; }
        else if (m === rr) { p.x = b.maxX + r; nx += 1; }
        else if (m === f) { p.z = b.minZ - r; nz -= 1; }
        else { p.z = b.maxZ + r; nz += 1; }
      }
    }
    if (hit) {
      const l = Math.hypot(nx, nz) || 1;
      this.lastNormal.x = nx / l; this.lastNormal.z = nz / l;
    }
    return hit;
  }

  // Ray vs boxes and ground plane. Direction must be normalized. Returns hit distance (or maxDist).
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    if (dy < 0) { const tg = -oy / dy; if (tg < best) best = tg; }
    const s = ++this.stamp;
    const step = CELL * 0.25;
    let lastKey = null;
    for (let t = 0; t <= best + step; t += step) {
      const k = this.key(Math.floor((ox + dx * t) / CELL), Math.floor((oz + dz * t) / CELL));
      if (k === lastKey) continue;
      lastKey = k;
      const arr = this.grid.get(k);
      if (!arr) continue;
      for (const b of arr) {
        if (b.s === s) continue;
        b.s = s;
        const tb = rayBox(ox, oy, oz, dx, dy, dz, b);
        if (tb < best) best = tb;
      }
    }
    return best;
  }
}

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b6942';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7000; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? `rgba(78,92,40,${Math.random() * 0.5})`
      : v < 0.8 ? `rgba(125,108,72,${Math.random() * 0.5})` : `rgba(58,52,38,${Math.random() * 0.5})`;
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(180, 180);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a393b';
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,20,20' : '90,90,90'},0.35)`;
    g.fillRect(Math.random() * 64, Math.random() * 128, 1.5, 1.5);
  }
  g.fillStyle = '#d8b84a';
  g.fillRect(30, 0, 4, 64);
  g.fillStyle = '#8a8a8a';
  g.fillRect(2, 0, 2, 128);
  g.fillRect(60, 0, 2, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function buildMothership() {
  const g = new THREE.Group();
  g.position.set(0, 210, 0);
  const hull = new THREE.MeshLambertMaterial({ color: 0x3a3548, fog: false });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1e1a28, fog: false });
  const glow = new THREE.MeshBasicMaterial({ color: 0x7dff9a, fog: false });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(140, 165, 16, 48), hull));
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(160, 70, 26, 48), dark);
  lower.position.y = -21;
  g.add(lower);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hull);
  dome.position.y = 8; dome.scale.y = 0.6;
  g.add(dome);
  const lightGeo = new THREE.SphereGeometry(4, 8, 6);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const l = new THREE.Mesh(lightGeo, glow);
    l.position.set(Math.cos(a) * 158, -4, Math.sin(a) * 158);
    g.add(l);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 4, 24), glow);
  core.position.y = -35;
  g.add(core);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x7dff9a, transparent: true, opacity: 0.16, depthWrite: false,
    side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(14, 34, 175, 32, 1, true), beamMat);
  beam.position.y = -35 - 87.5;
  g.add(beam);
  g.userData.beam = beam;
  return g;
}

export function buildEnvironment(scene) {
  const fogColor = new THREE.Color(0x8c7488);
  scene.fog = new THREE.Fog(fogColor, 90, 700);
  scene.background = fogColor.clone();

  scene.add(new THREE.HemisphereLight(0xdcccff, 0x5a4a3a, 1.5));
  const sun = new THREE.DirectionalLight(0xffe0c0, 2.2);
  sun.position.set(300, 500, 200);
  scene.add(sun);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x24143c) },
      mid: { value: fogColor.clone() },
      bottom: { value: new THREE.Color(0x6a5a50) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.7)) : mix(mid, bottom, min(1.0, -h * 4.0));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  scene.add(ground);

  const ship = buildMothership();
  scene.add(ship);

  return {
    sky, ship, leaving: false,
    update(dt, camPos) {
      sky.position.copy(camPos);
      ship.rotation.y += dt * 0.04;
      ship.userData.beam.material.opacity = 0.13 + Math.sin(performance.now() * 0.002) * 0.05;
      if (this.leaving && ship.visible) {
        ship.position.y += dt * 40;
        ship.userData.beam.visible = false;
        if (ship.position.y > 1200) ship.visible = false;
      }
    },
  };
}

export function buildRoads(scene, segments) {
  const tex = roadTexture();
  const geos = [];
  for (const s of segments) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const L = Math.hypot(dx, dz);
    const g = new THREE.PlaneGeometry(s.w || 11, L, 1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * L) / 12);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(dx, dz));
    g.translate((s.ax + s.bx) / 2, s.y || 0.04, (s.az + s.bz) / 2);
    geos.push(g);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: tex }));
  scene.add(mesh);
  return mesh;
}
