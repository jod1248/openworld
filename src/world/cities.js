import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { game } from '../game.js';
import { generateCity, buildingGeo, plainBoxGeo, getMats } from './city.js';
import { buildRoads } from './world.js';

function polar(deg, r) {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(r * Math.sin(a)), z: Math.round(-r * Math.cos(a)) };
}

const OUTPOST = { size: 90, block: 28, street: 12, minH: 5, maxH: 20, plaza: 30, palette: 'town', quota: 10 };

// North is -Z. Haven (tutorial) is far south, Ridgeport (quest hub) next, the Metropolis at the center,
// and a ring of alien-held outposts around it.
export const CITY_DEFS = [
  { id: 'haven', name: 'Haven', x: 0, z: 880, size: 60, safe: true, custom: true },
  { id: 'ridgeport', name: 'Ridgeport', x: 0, z: 560, size: 110, block: 30, street: 12, minH: 5, maxH: 16, plaza: 34, safe: true, seed: 11, palette: 'town' },
  {
    id: 'metropolis', name: 'Central Metropolis', x: 0, z: 0, size: 260, block: 36, street: 14, minH: 16, maxH: 110,
    plaza: 45, tallCenter: true, palette: 'city', level: 5, seed: 7, quota: 22,
    aliens: { crawler: 2, spitter: 2, brute: 1, stalker: 1.5, flyer: 1.5, drone: 1 },
  },
  { ...OUTPOST, id: 'ashfall', name: 'Ashfall', ...polar(120, 620), level: 2, seed: 21,
    aliens: { drone: 2, crawler: 3, spitter: 1 }, reward: { weapon: 'smg', cores: 60, parts: 2, ammo: { light: 90 } } },
  { ...OUTPOST, id: 'dunmore', name: 'Dunmore', ...polar(240, 620), level: 2, seed: 33,
    aliens: { crawler: 3, spitter: 2, brute: 0.5 }, reward: { weapon: 'rifle', cores: 60, parts: 2, ammo: { heavy: 90 } } },
  { ...OUTPOST, id: 'kestrel', name: 'Kestrel', ...polar(60, 620), level: 3, seed: 45,
    aliens: { spitter: 2, flyer: 2, stalker: 1.5 }, reward: { weapon: 'plasma', cores: 90, parts: 3, ammo: { cells: 60 } } },
  { ...OUTPOST, id: 'ironvale', name: 'Ironvale', ...polar(300, 620), level: 3, seed: 57,
    aliens: { brute: 1, stalker: 2, crawler: 3 }, reward: { armor: 100, cores: 90, parts: 4, medkits: 3 } },
  { ...OUTPOST, id: 'brightwater', name: 'Brightwater', ...polar(0, 620), level: 4, seed: 69, quota: 12,
    aliens: { flyer: 2, brute: 1, stalker: 2, spitter: 2 }, reward: { weapon: 'rocket', cores: 120, parts: 4, ammo: { rockets: 6 } } },
];

function buildHaven(c, world, scene) {
  const mats = getMats();
  const group = new THREE.Group();
  scene.add(group);
  const X = c.x, Z = c.z, S = c.size;
  const pGeos = [], bGeos = [];
  const wall = (x0, z0, x1, z1, h, color, y0 = 0) => {
    pGeos.push(plainBoxGeo(x1 - x0, h, z1 - z0, X + (x0 + x1) / 2, y0 + h / 2, Z + (z0 + z1) / 2, color));
    return world.addBox(X + x0, y0, Z + z0, X + x1, y0 + h, Z + z1, 'wall');
  };
  const fence = 0x6b5038;
  wall(-S, S - 0.5, S, S + 0.5, 3, fence);
  wall(-S - 0.5, -S, -S + 0.5, S, 3, fence);
  wall(S - 0.5, -S, S + 0.5, S, 3, fence);
  wall(-S, -S - 0.5, -5, -S + 0.5, 3, fence);
  wall(5, -S - 0.5, S, -S + 0.5, 3, fence);
  // Training corridor: start → jump crates → crouch barrier → open yard
  wall(-8.75, 10, -8.25, S, 3, 0x7a6a55);
  wall(8.25, 10, 8.75, S, 3, 0x7a6a55);
  wall(-8.25, 34.4, 8.25, 35.6, 1.0, 0x9a7a40);
  wall(-8.25, 24.5, 8.25, 25.5, 1.4, 0xd9b020, 1.15);
  for (let i = -7; i <= 7; i += 2) pGeos.push(plainBoxGeo(0.9, 1.42, 1.02, X + i, 1.85, Z + 25, 0x222222));

  const houses = [
    [-40, -38, 12, 10, 6], [-42, -12, 10, 12, 5], [-40, 18, 12, 10, 7], [-36, 44, 10, 8, 5],
    [40, -38, 12, 10, 6], [42, -10, 10, 12, 8], [40, 18, 12, 10, 5], [36, 44, 10, 8, 6],
    [-24, -48, 8, 8, 4], [24, -48, 8, 8, 4],
  ];
  const cols = [0xc9b9a0, 0xa08870, 0x9c6b5a, 0xb59a7a];
  houses.forEach(([hx, hz, w, d, h], i) => {
    bGeos.push(buildingGeo(w, h, d, X + hx, Z + hz, cols[i % cols.length]));
    pGeos.push(plainBoxGeo(w + 1, 0.6, d + 1, X + hx, h + 0.3, Z + hz, 0x5a3a2a));
    world.addBox(X + hx - w / 2, 0, Z + hz - d / 2, X + hx + w / 2, h + 0.6, Z + hz + d / 2, 'building');
  });
  group.add(new THREE.Mesh(mergeGeometries(pGeos), mats.plain));
  group.add(new THREE.Mesh(mergeGeometries(bGeos), mats.building));
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(S * 2, S * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7a6e50 }));
  yard.position.set(X, 0.02, Z);
  group.add(yard);

  const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x555a60 }));
  gateMesh.position.set(X, 1.6, Z - S);
  group.add(gateMesh);
  const gateBox = world.addBox(X - 5, 0, Z - S - 0.5, X + 5, 3.2, Z - S + 0.5, 'gate');

  return {
    group, crystals: null,
    gate: { mesh: gateMesh, box: gateBox, open: false },
    start: { x: X, z: Z + 53 },
    pistolPos: { x: X, z: Z + 5 },
    targetPos: [{ x: X - 10, z: Z - 25 }, { x: X, z: Z - 28 }, { x: X + 10, z: Z - 25 }],
  };
}

// Square-boundary distance from a city center along a unit direction
function edge(c, dx, dz) { return c.size / Math.max(Math.abs(dx), Math.abs(dz)) + 2; }

function roadBetween(a, b, y = 0.04) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const ta = edge(a, ux, uz), tb = edge(b, ux, uz);
  return { ax: a.x + ux * ta, az: a.z + uz * ta, bx: b.x - ux * tb, bz: b.z - uz * tb, y };
}

export function buildCities(world, scene) {
  const cities = [];
  for (const def of CITY_DEFS) {
    const c = { ...def, def, liberated: false, hostile: !def.safe, active: false, filled: false, spawnTimer: 0, beacon: null };
    Object.assign(c, def.custom ? buildHaven(c, world, scene) : generateCity(def, world, scene));
    cities.push(c);
  }
  const by = id => cities.find(c => c.id === id);
  const ring = ['brightwater', 'kestrel', 'ashfall', 'ridgeport', 'dunmore', 'ironvale'].map(by);
  const roads = [roadBetween(by('haven'), by('ridgeport'))];
  for (let i = 0; i < ring.length; i++) {
    roads.push(roadBetween(ring[i], ring[(i + 1) % ring.length], 0.045));
    roads.push(roadBetween(ring[i], by('metropolis'), 0.05));
  }
  game.roads = roads;
  buildRoads(scene, roads);
  return cities;
}

export function cityAt(x, z, margin = 0) {
  for (const c of game.cities) {
    if (Math.abs(x - c.x) < c.size + margin && Math.abs(z - c.z) < c.size + margin) return c;
  }
  return null;
}

export function getCity(id) { return game.cities.find(c => c.id === id); }

export function randomFreePoint(c, avoid = null, minDist = 0, tries = 16) {
  for (let i = 0; i < tries; i++) {
    const x = c.x + (Math.random() * 2 - 1) * (c.size - 6);
    const z = c.z + (Math.random() * 2 - 1) * (c.size - 6);
    if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < minDist) continue;
    if (!game.world.collides(x, z, 1.4, 0.3, 3)) return { x, z };
  }
  return null;
}
