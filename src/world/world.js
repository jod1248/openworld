import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CELL = 16;
export const STEP = 0.45;
export const WORLD_HALF = 1600;

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

// Fine detail: grass blades, pebbles and soil specks. Kept fairly neutral so the
// large-scale vertex colours below decide whether an area reads as grass or dirt.
function groundTexture() {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#ece6d4';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2500; i++) {
    const r = 4 + Math.random() * 18;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '150,170,110' : '200,170,130'},0.25)`;
    g.beginPath(); g.arc(Math.random() * N, Math.random() * N, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * N, y = Math.random() * N, v = Math.random();
    if (v < 0.6) {
      g.strokeStyle = `rgba(${120 + Math.random() * 60},${150 + Math.random() * 60},${80 + Math.random() * 40},0.6)`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y - 2 - Math.random() * 5); g.stroke();
    } else {
      const sh = 130 + Math.random() * 110;
      g.fillStyle = `rgba(${sh},${sh * 0.9},${sh * 0.75},0.6)`;
      g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(720, 720);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Smooth value noise for big patches of colour across the map
function valueNoise(seed) {
  const h = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

const _blight = new THREE.Color();
function groundGeometry() {
  const geo = new THREE.PlaneGeometry(3600, 3600, 340, 340).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3);
  const n1 = valueNoise(1), n2 = valueNoise(2), n3 = valueNoise(3);
  const grass = new THREE.Color(0x8aa850), dry = new THREE.Color(0xc8b078), dirt = new THREE.Color(0xa07a58), moss = new THREE.Color(0x6a8a48);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const big = n1(x / 160, z / 160) * 0.65 + n1(x / 55, z / 55) * 0.35;
    const wet = n2(x / 90, z / 90), speck = n3(x / 18, z / 18);
    c.copy(dry).lerp(grass, THREE.MathUtils.smoothstep(big, 0.35, 0.65));
    c.lerp(moss, THREE.MathUtils.smoothstep(wet, 0.6, 0.85) * 0.7);
    c.lerp(dirt, THREE.MathUtils.smoothstep(speck, 0.62, 0.8) * 0.6);
    c.multiplyScalar(1.1 + speck * 0.35);
    // Alien blight on the far frontier: ashy purple ground
    const blight = THREE.MathUtils.smoothstep(Math.hypot(x, z) + (big - 0.5) * 160, 980, 1150);
    if (blight > 0) c.lerp(_blight.setRGB(0.32, 0.22, 0.36).multiplyScalar(0.9 + speck * 0.4), blight * 0.85);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function groundMaterial() {
  return new THREE.MeshLambertMaterial({ map: groundTexture(), vertexColors: true });
}

function roadTexture() {
  const W = 128, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#4a494c';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5000; i++) {
    const v = 40 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v},0.4)`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  // darker tyre tracks
  g.fillStyle = 'rgba(20,20,22,0.18)';
  for (const x of [22, 40, 86, 104]) g.fillRect(x - 5, 0, 10, H);
  // gravel shoulders, white edge lines, dashed yellow centre line
  g.fillStyle = '#6a6250';
  g.fillRect(0, 0, 6, H); g.fillRect(W - 6, 0, 6, H);
  g.fillStyle = '#e8e4d8';
  g.fillRect(8, 0, 3, H); g.fillRect(W - 11, 0, 3, H);
  g.fillStyle = '#e8c048';
  g.fillRect(W / 2 - 2, 0, 4, H * 0.45);
  for (let i = 0; i < 12; i++) {
    g.strokeStyle = 'rgba(20,20,20,0.5)';
    let x = Math.random() * W, y = Math.random() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 16; y += Math.random() * 14; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

function buildMothership() {
  const g = new THREE.Group();
  g.position.set(0, 210, 0);
  const hull = new THREE.MeshLambertMaterial({ color: 0x3a3548, emissive: 0x4a3e66, fog: false });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1e1a28, emissive: 0x2e2640, fog: false });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7dff9a).multiplyScalar(3), fog: false });
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
  for (const [r, y] of [[150, -12], [110, -24], [72, -33]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1.2, 6, 96).rotateX(Math.PI / 2), glow);
    ring.position.y = y;
    g.add(ring);
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
  // Alien dusk: low warm sun, violet sky, rose haze on the horizon
  const SUN_DIR = new THREE.Vector3(0.55, 0.3, 0.78).normalize();
  const fogColor = new THREE.Color(0xb88a86);
  scene.fog = new THREE.FogExp2(fogColor, 0.0022);
  scene.background = fogColor.clone();

  scene.add(new THREE.HemisphereLight(0xb4a8f0, 0x6a5440, 2.0));
  const sun = new THREE.DirectionalLight(0xffb27a, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(300);
  // Shadows only cover the area around the camera; the sun follows it in update()
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 700 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      top: { value: new THREE.Color(0x140c34) },
      upper: { value: new THREE.Color(0x4a2d6e) },
      horizon: { value: fogColor.clone() },
      glow: { value: new THREE.Color(0xff9a52) },
      bottom: { value: new THREE.Color(0x5a4440) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 sunDir; uniform vec3 top; uniform vec3 upper; uniform vec3 horizon; uniform vec3 glow; uniform vec3 bottom; varying vec3 vP;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        float sd = max(dot(d, sunDir), 0.0);
        vec3 c = h > 0.0
          ? mix(mix(horizon, upper, smoothstep(0.0, 0.35, h)), top, smoothstep(0.3, 0.9, h))
          : mix(horizon, bottom, min(1.0, -h * 5.0));
        // warm glow around the sun that spreads along the horizon
        c += glow * (pow(sd, 6.0) * 0.6 + pow(sd, 1.5) * 0.25 * (1.0 - smoothstep(0.0, 0.5, abs(h))));
        // sun disc with a soft halo
        c += vec3(1.0, 0.85, 0.6) * (smoothstep(0.9993, 0.9997, sd) * 6.0 + pow(sd, 400.0) * 1.5);
        // stars, fading out toward the horizon and the sun
        vec3 g = floor(d * 400.0);
        float st = step(0.9975, hash(g)) * smoothstep(0.25, 0.7, h) * (1.0 - pow(sd, 3.0));
        c += vec3(st) * (0.5 + 0.5 * hash(g + 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  const ground = new THREE.Mesh(
    groundGeometry(),
    groundMaterial(),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const ship = buildMothership();
  scene.add(ship);

  return {
    sky, ship, leaving: false,
    update(dt, camPos) {
      sky.position.copy(camPos);
      // Snap to whole metres so shadow edges don't shimmer as you walk
      sun.target.position.set(Math.round(camPos.x), 0, Math.round(camPos.z));
      sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 300);
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
