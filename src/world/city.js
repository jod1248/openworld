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
  const win = windowTextures();
  const pave = pavementTexture(), asph = asphaltTexture();
  pave.repeat.set(8, 8);
  M = {
    building: new THREE.MeshLambertMaterial({ map: win.map, emissiveMap: win.glow, emissive: 0xffffff, emissiveIntensity: 1.6, vertexColors: true }),
    plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
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

export function plainBoxGeo(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colorize(g, color);
}

const PALETTES = {
  town: [0xb8a48a, 0xa08870, 0xc9b9a0, 0x9c6b5a, 0x8f8f8f, 0xa7a29a, 0xb59a7a],
  city: [0x8d99a6, 0x9fa8b0, 0x6f7f8f, 0xa59a8c, 0x7b8794, 0xb0b5ba, 0x5f6b78, 0x8a7f74],
};

export function generateCity(def, world, scene) {
  const mats = getMats();
  const rng = mulberry32(def.seed || 1);
  const group = new THREE.Group();
  scene.add(group);
  const bGeos = [], sGeos = [], lamps = [];
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
      bGeos.push(buildingGeo(w, h, d, lx, lz, pal[Math.floor(rng() * pal.length)]));
      world.addBox(lx - w / 2, 0, lz - d / 2, lx + w / 2, h, lz + d / 2, 'building');
      if (rng() < 0.4) {
        bGeos.push(buildingGeo(w * 0.3, 2, d * 0.3, lx + (rng() - 0.5) * w * 0.4, lz + (rng() - 0.5) * d * 0.4, 0x777777, h));
      }
    }
  }

  if (bGeos.length) group.add(new THREE.Mesh(mergeGeometries(bGeos), mats.building));
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
