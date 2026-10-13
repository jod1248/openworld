import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util.js';
import { WORLD_HALF } from './world.js';

// Is (x, z) open countryside: outside every city and away from roads?
function isOpen(x, z, cities, roads) {
  for (const c of cities) {
    if (Math.abs(x - c.x) < c.size + 10 && Math.abs(z - c.z) < c.size + 10) return false;
  }
  for (const r of roads) {
    const dx = r.bx - r.ax, dz = r.bz - r.az;
    const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - (r.ax + dx * t), z - (r.az + dz * t)) < 11) return false;
  }
  return true;
}

function scatter(n, rnd, cities, roads) {
  const pts = [];
  const lim = WORLD_HALF - 20;
  for (let tries = 0; pts.length < n && tries < n * 6; tries++) {
    const x = (rnd() * 2 - 1) * lim, z = (rnd() * 2 - 1) * lim;
    if (isOpen(x, z, cities, roads)) pts.push({ x, z });
  }
  return pts;
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function place(mesh, i, x, y, z, sx, sy, sz, rotY) {
  q.setFromAxisAngle(UP, rotY);
  m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz));
  mesh.setMatrixAt(i, m4);
}

function instanced(geo, mat, count, shadows = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

function buildTrees(group, world, pts, rnd) {
  const pineGeo = mergeGeometries([
    new THREE.ConeGeometry(2.6, 4, 8).translate(0, 4, 0),
    new THREE.ConeGeometry(2.1, 3.4, 8).translate(0, 6, 0),
    new THREE.ConeGeometry(1.4, 2.8, 8).translate(0, 7.9, 0),
  ]);
  const leafGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(2.4, 1).translate(0, 5.6, 0),
    new THREE.IcosahedronGeometry(1.8, 1).translate(1.3, 4.9, 0.4),
    new THREE.IcosahedronGeometry(1.7, 1).translate(-1.1, 5.0, -0.6),
  ]);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 7).translate(0, 0.5, 0);
  const foliage = new THREE.MeshLambertMaterial({ flatShading: true });
  const bark = new THREE.MeshLambertMaterial({ color: 0x5a3f2a });

  const pines = pts.filter((_, i) => i % 3 !== 0), leafy = pts.filter((_, i) => i % 3 === 0);
  const pineMesh = instanced(pineGeo, foliage, pines.length);
  const leafMesh = instanced(leafGeo, foliage.clone(), leafy.length);
  const trunks = instanced(trunkGeo, bark, pts.length);
  const col = new THREE.Color();
  let t = 0;
  const add = (mesh, list, trunkH, hue) => list.forEach((p, i) => {
    const sc = 0.75 + rnd() * 0.7, rot = rnd() * Math.PI * 2;
    place(mesh, i, p.x, 0, p.z, sc, sc * (0.9 + rnd() * 0.3), sc, rot);
    mesh.setColorAt(i, col.setHSL(hue + rnd() * 0.06, 0.35 + rnd() * 0.2, 0.18 + rnd() * 0.1));
    place(trunks, t++, p.x, 0, p.z, sc, trunkH * sc, sc, rot);
    world.addBox(p.x - 0.35 * sc, 0, p.z - 0.35 * sc, p.x + 0.35 * sc, 7 * sc, p.z + 0.35 * sc, 'tree');
  });
  add(pineMesh, pines, 3, 0.3);
  add(leafMesh, leafy, 4.5, 0.2);
  group.add(pineMesh, leafMesh, trunks);
}

function buildRocks(group, world, pts, rnd) {
  const mesh = instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), pts.length);
  const col = new THREE.Color();
  pts.forEach((p, i) => {
    const r = 0.4 + rnd() * rnd() * 2.6, sy = r * (0.45 + rnd() * 0.35);
    place(mesh, i, p.x, sy * 0.35, p.z, r * (0.9 + rnd() * 0.4), sy, r * (0.9 + rnd() * 0.4), rnd() * 6.28);
    mesh.setColorAt(i, col.setHSL(0.09, 0.12 + rnd() * 0.08, 0.22 + rnd() * 0.12));
    if (r > 0.7) world.addBox(p.x - r * 0.7, 0, p.z - r * 0.7, p.x + r * 0.7, sy * 1.2, p.z + r * 0.7, 'rock');
  });
  group.add(mesh);
}

function buildGrass(group, pts, rnd) {
  // Seven thin pointed blades leaning out in different directions
  const blades = [];
  for (let k = 0; k < 7; k++) {
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute([-0.035, 0, 0, 0.035, 0, 0, 0.09, 0.55, 0], 3));
    b.computeVertexNormals();
    const a = (k / 7) * Math.PI * 2;
    blades.push(b.rotateX(-0.25 - (k % 3) * 0.12).rotateY(a).translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08));
  }
  const geo = mergeGeometries(blades);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const mesh = instanced(geo, mat, pts.length, false);
  const col = new THREE.Color();
  pts.forEach((p, i) => {
    const sc = 0.7 + rnd() * 0.8;
    place(mesh, i, p.x, 0, p.z, sc, sc * (0.6 + rnd() * 0.7), sc, rnd() * 6.28);
    mesh.setColorAt(i, col.setHSL(0.17 + rnd() * 0.08, 0.35 + rnd() * 0.2, 0.22 + rnd() * 0.12));
  });
  group.add(mesh);
}

function buildClouds(scene, rnd) {
  const geos = [];
  const puff = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 45; i++) {
    const a = rnd() * Math.PI * 2, d = 260 + rnd() * 1100;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 150 + rnd() * 50;
    const n = 5 + Math.floor(rnd() * 6), w = 25 + rnd() * 30;
    for (let j = 0; j < n; j++) {
      const r = 9 + rnd() * 12;
      geos.push(puff.clone().scale(r * 1.4, r * 0.7, r)
        .translate(cx + (rnd() - 0.5) * w * 2, cy + rnd() * 6, cz + (rnd() - 0.5) * w));
    }
  }
  const clouds = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({
    color: 0xf2e6f0, emissive: 0x4a3a50, flatShading: true, transparent: true, opacity: 0.88, fog: false,
  }));
  scene.add(clouds);
  return clouds;
}

export function buildNature(world, scene, cities, roads) {
  const rnd = mulberry32(1234);
  const group = new THREE.Group();
  scene.add(group);
  buildTrees(group, world, scatter(1400, rnd, cities, roads), rnd);
  buildRocks(group, world, scatter(700, rnd, cities, roads), rnd);
  buildGrass(group, scatter(60000, rnd, cities, roads), rnd);
  const clouds = buildClouds(scene, rnd);
  return {
    update(dt) { clouds.rotation.y += dt * 0.003; },
  };
}
