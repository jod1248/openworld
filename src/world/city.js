import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util.js';

let M = null;
function windowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d6d2cc';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const r = Math.random();
    g.fillStyle = r < 0.18 ? '#ffd890' : r < 0.3 ? '#2a1a1a' : '#26303f';
    g.fillRect(i * 32 + 7, j * 32 + 5, 18, 20);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(i * 32 + 7, j * 32 + 5, 18, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function getMats() {
  if (M) return M;
  M = {
    building: new THREE.MeshLambertMaterial({ map: windowTexture(), vertexColors: true }),
    plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
    sidewalk: new THREE.MeshLambertMaterial({ color: 0x8a8580 }),
    asphalt: new THREE.MeshLambertMaterial({ color: 0x3b3a3c }),
    lampPole: new THREE.MeshLambertMaterial({ color: 0x444448 }),
    lampHead: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
    crystal: new THREE.MeshLambertMaterial({ color: 0xb03cff, emissive: 0x6a10a0 }),
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

// Box with window UVs scaled to its size (one tile = 8 units). Roof/floor map to plain wall.
export function buildingGeo(w, h, d, x, z, color, y0 = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.01);
    else uv.setXY(i, (uv.getX(i) * (f < 2 ? d : w)) / 8, (uv.getY(i) * h) / 8);
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
  const base = new THREE.Mesh(new THREE.PlaneGeometry(def.size * 2 + 16, def.size * 2 + 16).rotateX(-Math.PI / 2), mats.asphalt);
  base.position.set(def.x, 0.025, def.z);
  group.add(base);

  // Street lamps
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 6, 6).translate(0, 3, 0), mats.lampPole, lamps.length);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.2, 0.7).translate(0, 6, 0), mats.lampHead, lamps.length);
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
