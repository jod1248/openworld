import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util.js';

let M = null;
// One texture tile = 32 x 32 m of wall: 8 windows across, 8 floors up.
// Returns the colour map and a matching glow map (lit windows only).
function windowTextures() {
  const N = 1024, cell = N / 8;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d')]; };
  const [c, g] = mk(), [ce, ge] = mk();
  g.fillStyle = '#e4ded4';
  g.fillRect(0, 0, N, N);
  // plaster / concrete noise and streaks of grime running down from ledges
  for (let i = 0; i < 9000; i++) {
    const v = 180 + Math.random() * 70;
    g.fillStyle = `rgba(${v},${v * 0.97},${v * 0.92},0.35)`;
    g.fillRect(Math.random() * N, Math.random() * N, 2, 2);
  }
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, N, N);
  for (let fy = 0; fy < 8; fy++) {
    const y0 = fy * cell;
    // floor ledge
    g.fillStyle = 'rgba(90,85,80,0.55)';
    g.fillRect(0, y0, N, 9);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, y0 + 9, N, 3);
    for (let fx = 0; fx < 8; fx++) {
      const x = fx * cell + 26, y = y0 + 30, w = cell - 52, h = cell - 50;
      const grime = g.createLinearGradient(0, y + h, 0, y + h + 40);
      grime.addColorStop(0, 'rgba(60,55,50,0.35)'); grime.addColorStop(1, 'rgba(60,55,50,0)');
      g.fillStyle = grime;
      g.fillRect(x + 4, y + h, w - 8, 40);
      // frame
      g.fillStyle = '#4a4744';
      g.fillRect(x - 5, y - 5, w + 10, h + 10);
      const r = Math.random();
      const lit = r < 0.22;
      if (lit) {
        const warm = Math.random() < 0.7;
        const gr = g.createLinearGradient(0, y, 0, y + h);
        gr.addColorStop(0, warm ? '#ffe2a8' : '#cfe6ff'); gr.addColorStop(1, warm ? '#f0a860' : '#8fb4e0');
        g.fillStyle = gr;
        g.fillRect(x, y, w, h);
        ge.fillStyle = warm ? `rgb(255,${190 + Math.random() * 40},120)` : 'rgb(170,205,255)';
        ge.fillRect(x, y, w, h);
        // curtains / silhouettes
        if (Math.random() < 0.5) {
          g.fillStyle = 'rgba(80,40,30,0.55)';
          g.fillRect(x, y, w * 0.28, h);
          ge.fillStyle = '#000'; ge.fillRect(x, y, w * 0.28, h);
        }
      } else {
        // dark glass with a sky reflection
        const gr = g.createLinearGradient(x, y, x + w, y + h);
        gr.addColorStop(0, r < 0.6 ? '#9aa8c4' : '#6a7896');
        gr.addColorStop(0.55, '#3e4a62');
        gr.addColorStop(1, '#56627c');
        g.fillStyle = gr;
        g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath(); g.moveTo(x, y + h * 0.7); g.lineTo(x + w * 0.5, y); g.lineTo(x + w * 0.75, y); g.lineTo(x, y + h); g.fill();
      }
      // mullions
      g.fillStyle = '#4a4744';
      g.fillRect(x + w / 2 - 2, y, 4, h);
      g.fillRect(x, y + h * 0.38, w, 3);
      ge.fillStyle = '#000';
      ge.fillRect(x + w / 2 - 2, y, 4, h);
      ge.fillRect(x, y + h * 0.38, w, 3);
      // sill
      g.fillStyle = '#f4f0e8';
      g.fillRect(x - 9, y + h + 5, w + 18, 6);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x - 9, y + h + 11, w + 18, 3);
    }
  }
  const tex = cv => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(c), glow: tex(ce) };
}

// Glass curtain wall: 8 x 8 panels per 32 m tile, reflecting the dusk sky
function towerTextures() {
  const N = 1024, cell = N / 8;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d')]; };
  const [c, g] = mk(), [ce, ge] = mk();
  const sky = g.createLinearGradient(0, 0, 0, N);
  sky.addColorStop(0, '#3a4a78'); sky.addColorStop(0.5, '#7a7ea8'); sky.addColorStop(1, '#c89a8a');
  g.fillStyle = sky;
  g.fillRect(0, 0, N, N);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, N, N);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = Math.random();
    g.fillStyle = `rgba(${v < 0.5 ? '20,30,60' : '255,230,210'},${0.05 + Math.random() * 0.15})`;
    g.fillRect(x * cell, y * cell, cell, cell);
    if (Math.random() < 0.16) {
      g.fillStyle = 'rgba(255,225,170,0.85)';
      g.fillRect(x * cell + 6, y * cell + 6, cell - 12, cell - 12);
      ge.fillStyle = 'rgb(255,215,150)';
      ge.fillRect(x * cell + 6, y * cell + 6, cell - 12, cell - 12);
    }
  }
  // mullions and spandrels
  g.fillStyle = '#1a1e26';
  for (let i = 0; i <= N; i += cell) { g.fillRect(i - 3, 0, 6, N); g.fillRect(0, i - 7, N, 14); }
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < N; i += cell) g.fillRect(0, i + 7, N, 2);
  const tex = cv => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(c), glow: tex(ce) };
}

function pavementTexture() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#b8b2a8';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 4000; i++) {
    const v = 140 + Math.random() * 90;
    g.fillStyle = `rgba(${v},${v},${v * 0.95},0.4)`;
    g.fillRect(Math.random() * N, Math.random() * N, 2, 2);
  }
  g.strokeStyle = 'rgba(70,65,60,0.6)';
  g.lineWidth = 2;
  for (let i = 0; i <= N; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, N); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(N, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function asphaltTexture() {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#6a686a';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 30000; i++) {
    const v = 60 + Math.random() * 90;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(Math.random() * N, Math.random() * N, 1.5, 1.5);
  }
  // patches and cracks
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(30,30,32,${0.15 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * N, Math.random() * N, 30 + Math.random() * 80, 20 + Math.random() * 60);
  }
  g.strokeStyle = 'rgba(25,25,25,0.6)';
  for (let i = 0; i < 30; i++) {
    let x = Math.random() * N, y = Math.random() * N;
    g.lineWidth = 0.5 + Math.random();
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function getMats() {
  if (M) return M;
  const win = windowTextures(), glass = towerTextures();
  const pave = pavementTexture(), asph = asphaltTexture();
  pave.repeat.set(8, 8);
  M = {
    building: new THREE.MeshLambertMaterial({ map: win.map, emissiveMap: win.glow, emissive: 0xffffff, emissiveIntensity: 1.6, vertexColors: true }),
    plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
    tower: new THREE.MeshPhongMaterial({ map: glass.map, emissiveMap: glass.glow, emissive: 0xffffff, emissiveIntensity: 1.4, shininess: 120, specular: 0x8899aa, vertexColors: true }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true }),
    sidewalk: new THREE.MeshLambertMaterial({ map: pave }),
    asphalt: new THREE.MeshLambertMaterial({ map: asph }),
    asphaltTex: asph,
    lampPole: new THREE.MeshLambertMaterial({ color: 0x2e2e33 }),
    lampHead: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(5) }),
    crystal: new THREE.MeshLambertMaterial({ color: 0xb03cff, emissive: 0x9a30ff, emissiveIntensity: 2.2 }),
  };
  return M;
}

const _c = new THREE.Color();
function colorize(g, color) {
  _c.set(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Box with window UVs scaled to its size (one tile = 32 units). Roof/floor map to plain wall.
export function buildingGeo(w, h, d, x, z, color, y0 = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.01);
    else uv.setXY(i, (uv.getX(i) * (f < 2 ? d : w)) / 32, (uv.getY(i) * h) / 32);
  }
  g.translate(x, y0 + h / 2, z);
  return colorize(g, color);
}

function tint(g, color, k = 1) {
  colorize(g, color);
  if (k !== 1) g.attributes.color.array.forEach((v, i, a) => { a[i] = v * k; });
  return g;
}

export function plainBoxGeo(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colorize(g, color);
}

const AWNINGS = [0xa82a2a, 0x2a6a3a, 0x2a4a8a, 0xd8a020, 0x6a2a6a, 0xe8e0d0];
const NEON = [0xff3aa0, 0x3af0ff, 0xffd040, 0x6aff4a, 0xff6a2a, 0xb06aff];

// Glass towers with setbacks, shopfronts with awnings and neon signs, and rooftop clutter
function decorate(b, rnd, bGeos, gGeos, pGeos, nGeos) {
  const { w, h, d, lx, lz, color } = b;
  const dk = new THREE.Color(color).multiplyScalar(0.55).getHex();
  let roofW = w, roofD = d;
  if (b.tower) {
    const base = 9;
    bGeos.push(buildingGeo(w, base, d, lx, lz, 0x8a8a8a));
    const h1 = Math.round(base + (h - base) * (0.55 + rnd() * 0.25));
    gGeos.push(buildingGeo(w * 0.92, h1 - base, d * 0.92, lx, lz, 0xffffff, base));
    roofW = w * 0.7; roofD = d * 0.7;
    gGeos.push(buildingGeo(roofW, h - h1, roofD, lx, lz, 0xe8f0ff, h1));
    pGeos.push(plainBoxGeo(w * 0.94, 0.6, d * 0.94, lx, h1 + 0.3, lz, 0x2a2e36));       // ledge at the setback
    // antenna with a red warning light
    pGeos.push(tint(new THREE.CylinderGeometry(0.15, 0.3, 10, 6).translate(lx, h + 5, lz), 0x3a3a3e));
    nGeos.push(tint(new THREE.SphereGeometry(0.45, 8, 6).translate(lx, h + 10.2, lz), 0xff2020, 4));
  } else {
    bGeos.push(buildingGeo(w, h, d, lx, lz, color));
    // shopfront on one or two sides: dark glass band, awning, neon sign
    for (const side of rnd() < 0.5 ? [1] : [1, -1]) {
      const along = rnd() < 0.5;                 // face along z or along x
      const fw = (along ? w : d) * 0.84, off = (along ? d : w) / 2;
      const put = (gw, gh, gd, y, out) => along
        ? [gw, gh, gd, lx, y, lz + side * (off + out)]
        : [gd, gh, gw, lx + side * (off + out), y, lz];
      const [aw, ah, ad, ax, ay, az] = put(fw, 2.6, 0.12, 1.5, 0.05);
      pGeos.push(plainBoxGeo(aw, ah, ad, ax, ay, az, 0x1c2230));                        // shop window
      const [bw, bh, bd, bx2, by, bz2] = put(fw, 0.2, 1.8, 3.25, 0.9);
      pGeos.push(plainBoxGeo(bw, bh, bd, bx2, by, bz2, AWNINGS[Math.floor(rnd() * AWNINGS.length)])); // awning
      const [sw, sh, sd, sx, sy, sz] = put(Math.min(fw * 0.5, 6), 0.7, 0.15, 4.1, 0.1);
      pGeos.push(plainBoxGeo(sw + 0.2, sh + 0.2, sd, sx, sy, sz, 0x15151a));              // sign board
      const [nw, nh, nd, nx, ny, nz] = put(Math.min(fw * 0.5, 6) - 0.4, 0.22, 0.05, 4.1, 0.2);
      nGeos.push(tint(new THREE.BoxGeometry(nw, nh, nd).translate(nx, ny, nz), NEON[Math.floor(rnd() * NEON.length)], 3.5));
    }
  }
  // parapet around the roof
  const pt = 0.35, ph = 0.9, ry = h + ph / 2;
  pGeos.push(plainBoxGeo(roofW, ph, pt, lx, ry, lz - roofD / 2 + pt / 2, dk));
  pGeos.push(plainBoxGeo(roofW, ph, pt, lx, ry, lz + roofD / 2 - pt / 2, dk));
  pGeos.push(plainBoxGeo(pt, ph, roofD, lx - roofW / 2 + pt / 2, ry, lz, dk));
  pGeos.push(plainBoxGeo(pt, ph, roofD, lx + roofW / 2 - pt / 2, ry, lz, dk));
  pGeos.push(plainBoxGeo(roofW - 0.1, 0.05, roofD - 0.1, lx, h + 0.03, lz, 0x4a4844));    // tar roof
  // AC units
  const nAc = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < nAc; i++) {
    const x = lx + (rnd() - 0.5) * roofW * 0.6, z = lz + (rnd() - 0.5) * roofD * 0.6;
    pGeos.push(plainBoxGeo(1.6, 1.1, 1.3, x, h + 0.55, z, 0xa8aaa8));
    pGeos.push(tint(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12).translate(x, h + 1.13, z), 0x3a3a3a));
  }
  // wooden water tower on some low buildings
  if (!b.tower && h < 22 && rnd() < 0.3) {
    const x = lx + (rnd() - 0.5) * roofW * 0.4, z = lz + (rnd() - 0.5) * roofD * 0.4;
    for (const [ox, oz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) pGeos.push(plainBoxGeo(0.18, 2.2, 0.18, x + ox, h + 1.1, z + oz, 0x3a2a1a));
    pGeos.push(tint(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 14).translate(x, h + 3.5, z), 0x7a5232));
    for (const y of [2.6, 3.5, 4.4]) pGeos.push(tint(new THREE.CylinderGeometry(1.43, 1.43, 0.08, 14).translate(x, h + y, z), 0x2a2a2a));
    pGeos.push(tint(new THREE.ConeGeometry(1.55, 1.1, 14).translate(x, h + 5.35, z), 0x4a3a2a));
  }
}

const PALETTES = {
  town: [0xa8543a, 0xc9b28a, 0x8a4a34, 0xd8cfb8, 0x9a9690, 0x6f7a6a, 0xb8865a],
  city: [0x9aa4ae, 0xc8c0b0, 0x6a6460, 0xa8503c, 0x7e8a96, 0xd8d2c4, 0x4e5662, 0x8a6a50],
};

export function generateCity(def, world, scene) {
  const mats = getMats();
  const rng = mulberry32(def.seed || 1);
  const group = new THREE.Group();
  scene.add(group);
  const bGeos = [], sGeos = [], gGeos = [], pGeos = [], nGeos = [], lamps = [];
  // Decorations draw from their own sequence so the seeded street layout (and the
  // quest spots that depend on it) stays exactly the same
  const deco = mulberry32((def.seed || 1) * 977 + 13);
  const pitch = def.block + def.street;
  const n = Math.floor(def.size / pitch);
  const pal = PALETTES[def.palette || 'town'];

  for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) {
    const bx = def.x + (i + 0.5) * pitch, bz = def.z + (j + 0.5) * pitch;
    const dc = Math.hypot(bx - def.x, bz - def.z);
    if (dc < def.plaza) continue;
    const sw = new THREE.BoxGeometry(def.block, 0.16, def.block);
    sw.translate(bx, 0.08, bz);
    sGeos.push(sw);
    lamps.push([bx - def.block / 2 - 1.2, bz - def.block / 2 - 1.2]);
    const split = rng() < (def.split ?? 0.6) ? 2 : 1;
    const lot = def.block / split;
    for (let a = 0; a < split; a++) for (let b = 0; b < split; b++) {
      if (rng() < (def.empty ?? 0.08)) continue;
      const lx = bx - def.block / 2 + (a + 0.5) * lot;
      const lz = bz - def.block / 2 + (b + 0.5) * lot;
      const w = lot - 2 - rng() * 2.5, d = lot - 2 - rng() * 2.5;
      const t = Math.max(0, 1 - dc / (def.size * 1.1));
      const k = def.tallCenter ? (0.12 + 0.88 * t * t) * (0.55 + 0.45 * rng()) : rng();
      const h = Math.round(def.minH + (def.maxH - def.minH) * k);
      const color = pal[Math.floor(rng() * pal.length)];
      world.addBox(lx - w / 2, 0, lz - d / 2, lx + w / 2, h, lz + d / 2, 'building');
      decorate({ w, h, d, lx, lz, color, tower: def.tallCenter && h > 40 }, deco, bGeos, gGeos, pGeos, nGeos);
      if (rng() < 0.4) {
        bGeos.push(buildingGeo(w * 0.3, 2, d * 0.3, lx + (rng() - 0.5) * w * 0.4, lz + (rng() - 0.5) * d * 0.4, 0x777777, h));
      }
    }
  }

  if (bGeos.length) group.add(new THREE.Mesh(mergeGeometries(bGeos), mats.building));
  if (gGeos.length) group.add(new THREE.Mesh(mergeGeometries(gGeos), mats.tower));
  if (pGeos.length) group.add(new THREE.Mesh(mergeGeometries(pGeos), mats.plain));
  if (nGeos.length) group.add(new THREE.Mesh(mergeGeometries(nGeos), mats.neon));
  if (sGeos.length) group.add(new THREE.Mesh(mergeGeometries(sGeos), mats.sidewalk));
  const baseSize = def.size * 2 + 16;
  const baseGeo = new THREE.PlaneGeometry(baseSize, baseSize).rotateX(-Math.PI / 2);
  baseGeo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * baseSize / 24; });
  const base = new THREE.Mesh(baseGeo, mats.asphalt);
  base.position.set(def.x, 0.025, def.z);
  group.add(base);

  // Street lamps
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.16, 7, 8).translate(0, 3.5, 0),
    new THREE.CylinderGeometry(0.22, 0.26, 0.6, 8).translate(0, 0.3, 0),
    new THREE.BoxGeometry(1.8, 0.1, 0.12).translate(0.85, 6.9, 0),
    new THREE.BoxGeometry(0.8, 0.18, 0.45).translate(1.55, 6.82, 0),
  ]);
  const pole = new THREE.InstancedMesh(poleGeo, mats.lampPole, lamps.length);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.06, 0.34).translate(1.55, 6.7, 0), mats.lampHead, lamps.length);
  pole.castShadow = true;
  const m4 = new THREE.Matrix4();
  lamps.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); });
  group.add(pole, head);

  // Alien crystal growths for hostile cities
  let crystals = null;
  if (def.aliens) {
    const count = Math.round(def.size / 2.5);
    crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), mats.crystal, count);
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let placed = 0;
    for (let tries = 0; tries < count * 6 && placed < count; tries++) {
      const x = def.x + (rng() * 2 - 1) * def.size, z = def.z + (rng() * 2 - 1) * def.size;
      if (world.collides(x, z, 1.5, 0, 3)) continue;
      e.set((rng() - 0.5) * 0.6, rng() * 6, (rng() - 0.5) * 0.6);
      q.setFromEuler(e);
      const sc = 0.6 + rng() * 0.8;
      s.set(sc, sc * (2 + rng() * 3), sc);
      p.set(x, s.y * 0.5, z);
      m4.compose(p, q, s);
      crystals.setMatrixAt(placed++, m4);
    }
    crystals.count = placed;
    group.add(crystals);
  }

  return { group, crystals, pitch, n };
}
