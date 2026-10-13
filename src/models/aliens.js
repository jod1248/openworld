import * as THREE from 'three';

// Alien creature models. Each returns { group, body, anim } where `body` is the main
// material (flashes white when hit; the stalker fades it) and `anim` holds the parts
// that aliens.js animates: ring, legs, arms, wings, sac, eye, tentacles, shield.

const glowMat = (c, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
const EYE_G = glowMat(0x9dff4a), EYE_R = glowMat(0xff3020), EYE_C = glowMat(0x6cf4ff), ACID = glowMat(0x9dff2a, 1.1);
const phong = (c, o = {}) => new THREE.MeshPhongMaterial({ color: c, shininess: 40, specular: 0x333333, ...o });
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

const S = new THREE.SphereGeometry(1, 20, 14);
const S_LO = new THREE.SphereGeometry(1, 10, 8);
const CONE = new THREE.ConeGeometry(1, 1, 10);
const CAPS = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);

function part(parent, geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = !mat.isMeshBasicMaterial;
  parent.add(m);
  return m;
}
function pivot(parent, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}
function eyes(g, mat, pts, r) { for (const [x, y, z] of pts) part(g, S_LO, mat, r, r, r, x, y, z); }
function spikes(g, mat, n, y0, z0, z1, len, r) {
  for (let i = 0; i < n; i++) part(g, CONE, mat, r, len, r, 0, y0, z0 + (z1 - z0) * (i / Math.max(1, n - 1)), -0.4);
}

const BUILD = {
  drone(g, body, def, anim) {
    const dark = phong(shade(def.color, 0.45), { shininess: 90 });
    part(g, S, body, 0.42, 0.42, 0.42, 0, 0, 0);
    // armour shells top and bottom
    part(g, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), dark, 0.47, 0.47, 0.47, 0, 0.02, 0);
    part(g, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), dark, 0.47, 0.47, 0.47, 0, -0.02, 0, Math.PI);
    // lens
    part(g, new THREE.TorusGeometry(1, 0.25, 8, 20), dark, 0.16, 0.16, 0.16, 0, 0, -0.42);
    part(g, S, EYE_G, 0.12, 0.12, 0.06, 0, 0, -0.42);
    // antennae
    for (const s of [-1, 1]) {
      part(g, CONE, dark, 0.03, 0.4, 0.03, s * 0.15, 0.5, 0.1, 0, 0, s * -0.3);
      part(g, S_LO, EYE_G, 0.035, 0.035, 0.035, s * 0.21, 0.69, 0.1);
    }
    // ring with glowing nodes
    const ring = new THREE.Group();
    ring.rotation.x = Math.PI / 2;
    part(ring, new THREE.TorusGeometry(1, 0.06, 6, 32), dark, 0.68, 0.68, 0.68, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(ring, S_LO, EYE_G, 0.05, 0.05, 0.05, Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0);
    }
    g.add(ring);
    anim.ring = ring;
  },

  crawler(g, body, def, anim) {
    const dark = phong(shade(def.color, 0.5), { shininess: 70 });
    // abdomen, thorax, head
    part(g, S, body, 0.5, 0.36, 0.62, 0, 0.6, 0.45);
    part(g, S, dark, 0.38, 0.28, 0.4, 0, 0.62, -0.25);
    part(g, S, body, 0.3, 0.24, 0.3, 0, 0.58, -0.72);
    // chitin bands on the abdomen
    for (let i = 0; i < 3; i++) part(g, new THREE.TorusGeometry(1, 0.08, 6, 20), dark, 0.47 - i * 0.07, 0.34 - i * 0.04, 0.47 - i * 0.07, 0, 0.6, 0.2 + i * 0.25, Math.PI / 2);
    spikes(g, dark, 4, 0.92, -0.2, 0.75, 0.3, 0.06);
    // mandibles
    for (const s of [-1, 1]) part(g, CONE, dark, 0.05, 0.3, 0.05, s * 0.12, 0.5, -0.98, -1.4, 0, s * 0.4);
    eyes(g, EYE_R, [[-0.12, 0.68, -0.96], [0.12, 0.68, -0.96], [-0.06, 0.74, -0.98], [0.06, 0.74, -0.98]], 0.045);
    // six two-part legs on hip pivots
    anim.legs = [];
    for (const z of [-0.45, -0.1, 0.25]) for (const s of [-1, 1]) {
      const hip = pivot(g, s * 0.3, 0.62, z);
      part(hip, CAPS(0.05, 0.4), dark, 1, 1, 1, s * 0.25, 0.12, 0, 0, 0, s * 1.0);
      part(hip, CAPS(0.04, 0.55), dark, 1, 1, 1, s * 0.55, -0.25, 0, 0, 0, s * -0.35);
      part(hip, CONE, body, 0.04, 0.12, 0.04, s * 0.62, -0.58, 0, Math.PI);
      anim.legs.push(hip);
    }
  },

  spitter(g, body, def, anim) {
    const dark = phong(shade(def.color, 0.5));
    // digitigrade legs
    anim.legs = [];
    for (const s of [-1, 1]) {
      const hip = pivot(g, s * 0.25, 1.0, 0);
      part(hip, CAPS(0.11, 0.35), body, 1, 1, 1, 0, -0.2, -0.1, -0.5);
      part(hip, CAPS(0.08, 0.4), dark, 1, 1, 1, 0, -0.65, 0.08, 0.35);
      part(hip, S_LO, dark, 0.12, 0.06, 0.2, 0, -0.95, -0.02);
      anim.legs.push(hip);
    }
    // hunched torso, long neck, frilled head
    part(g, S, body, 0.45, 0.6, 0.42, 0, 1.35, 0.05, 0.35);
    part(g, CAPS(0.13, 0.35), body, 1, 1, 1, 0, 1.85, -0.2, -0.6);
    part(g, S, body, 0.3, 0.26, 0.38, 0, 2.0, -0.45);
    part(g, S, dark, 0.2, 0.08, 0.22, 0, 1.9, -0.65);                    // jaw
    for (let i = -2; i <= 2; i++) part(g, CONE, dark, 0.05, 0.4, 0.02, i * 0.1, 2.25, -0.35, 0.5, 0, -i * 0.35); // frill
    eyes(g, EYE_G, [[-0.14, 2.05, -0.7], [0, 2.08, -0.74], [0.14, 2.05, -0.7]], 0.05);
    // ribs
    for (let i = 0; i < 3; i++) part(g, new THREE.TorusGeometry(1, 0.05, 6, 16, Math.PI), dark, 0.42, 0.42, 0.4, 0, 1.15 + i * 0.18, 0.05, 0, Math.PI / 2, 0);
    // glowing acid sac on the back (aliens.js swells it before a shot)
    anim.sac = part(g, S, ACID, 0.35, 0.4, 0.35, 0, 1.6, 0.42);
    anim.arms = [-1, 1].map(s => {
      const sh = pivot(g, s * 0.4, 1.6, -0.15);
      part(sh, CAPS(0.06, 0.45), dark, 1, 1, 1, 0, -0.3, -0.05, 0.2);
      part(sh, CONE, dark, 0.05, 0.15, 0.05, 0, -0.62, -0.1, Math.PI);
      return sh;
    });
  },

  brute(g, body, def, anim) {
    const bone = phong(0xd8ccb0, { shininess: 60 }), dark = phong(shade(def.color, 0.5));
    anim.legs = [-1, 1].map(s => {
      const hip = pivot(g, s * 0.5, 1.2, 0);
      part(hip, CAPS(0.26, 0.4), dark, 1, 1, 1, 0, -0.35, 0);
      part(hip, CAPS(0.22, 0.3), dark, 1, 1, 1, 0, -0.85, 0.05);
      part(hip, S_LO, bone, 0.3, 0.15, 0.4, 0, -1.15, -0.1);
      return hip;
    });
    // massive hunched chest and gut
    part(g, S, body, 1.0, 0.85, 0.75, 0, 2.05, 0.05, 0.25);
    part(g, S, dark, 0.7, 0.55, 0.55, 0, 1.45, 0.0);
    // bone armour on shoulders and back
    for (const s of [-1, 1]) {
      part(g, S, bone, 0.48, 0.32, 0.5, s * 0.82, 2.55, 0.05, 0, 0, s * 0.4);
      for (let i = 0; i < 3; i++) part(g, CONE, bone, 0.1, 0.45, 0.1, s * (0.6 + i * 0.22), 2.8, 0.2, -0.3, 0, -s * 0.6);
    }
    spikes(g, bone, 4, 2.7, 0.0, 0.7, 0.4, 0.1);
    // low head, glowing eyes, tusks
    part(g, S, body, 0.38, 0.32, 0.38, 0, 2.35, -0.72);
    part(g, S, dark, 0.32, 0.12, 0.3, 0, 2.22, -0.86);
    eyes(g, EYE_R, [[-0.15, 2.45, -1.04], [0.15, 2.45, -1.04]], 0.06);
    for (const s of [-1, 1]) part(g, CONE, bone, 0.05, 0.3, 0.05, s * 0.2, 2.25, -1.05, -0.4, 0, s * -0.4);
    // long arms with big fists
    anim.arms = [-1, 1].map(s => {
      const sh = pivot(g, s * 1.05, 2.45, -0.05);
      part(sh, CAPS(0.25, 0.55), body, 1, 1, 1, 0, -0.45, 0);
      part(sh, CAPS(0.22, 0.55), dark, 1, 1, 1, 0, -1.15, -0.1);
      part(sh, S, bone, 0.33, 0.3, 0.33, 0, -1.6, -0.12);
      return sh;
    });
  },

  stalker(g, body, def, anim) {
    // body material is see-through; aliens.js fades it in when close
    body.transparent = true;
    body.opacity = 0.25;
    anim.legs = [-1, 1].map(s => {
      const hip = pivot(g, s * 0.13, 1.05, 0);
      part(hip, CAPS(0.06, 0.45), body, 1, 1, 1, 0, -0.27, 0);
      part(hip, CAPS(0.05, 0.45), body, 1, 1, 1, 0, -0.78, 0.04);
      return hip;
    });
    part(g, CAPS(0.16, 0.5), body, 1, 1, 0.7, 0, 1.45, 0);
    part(g, CAPS(0.04, 0.12), body, 1, 1, 1, 0, 1.92, 0);
    // elongated head
    part(g, S, body, 0.17, 0.2, 0.32, 0, 2.15, -0.05, -0.4);
    eyes(g, EYE_C, [[-0.08, 2.17, -0.28], [0.08, 2.17, -0.28]], 0.035);
    // very long arms ending in three claws
    anim.arms = [-1, 1].map(s => {
      const sh = pivot(g, s * 0.24, 1.8, -0.05);
      part(sh, CAPS(0.04, 0.55), body, 1, 1, 1, 0, -0.35, 0);
      part(sh, CAPS(0.035, 0.55), body, 1, 1, 1, 0, -1.0, 0);
      for (let k = -1; k <= 1; k++) part(sh, CONE, body, 0.02, 0.28, 0.02, k * 0.04, -1.42, -0.02, Math.PI + 0.2, 0, k * 0.2);
      return sh;
    });
  },

  flyer(g, body, def, anim) {
    const dark = phong(shade(def.color, 0.5));
    part(g, S, body, 0.42, 0.35, 0.9, 0, 0, 0);
    part(g, S, dark, 0.3, 0.25, 0.32, 0, 0.05, -0.85);
    for (const s of [-1, 1]) part(g, CONE, dark, 0.04, 0.3, 0.04, s * 0.12, 0.25, -0.8, -0.8);   // horns
    eyes(g, EYE_R, [[-0.14, 0.1, -1.1], [0.14, 0.1, -1.1]], 0.07);
    // segmented tail
    for (let i = 0; i < 4; i++) part(g, S_LO, i % 2 ? dark : body, 0.2 - i * 0.04, 0.16 - i * 0.03, 0.3, 0, 0, 0.9 + i * 0.4);
    part(g, CONE, dark, 0.15, 0.35, 0.04, 0, 0, 2.6, Math.PI / 2);
    // membrane wings: bony finger struts with a thin skin stretched between
    const skin = new THREE.MeshPhongMaterial({ color: 0xc9906a, side: THREE.DoubleSide, transparent: true, opacity: 0.85, shininess: 5 });
    anim.wings = [];
    for (const s of [-1, 1]) {
      const p = pivot(g, s * 0.35, 0.1, -0.1);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.4); shape.lineTo(2.4, 0.2); shape.lineTo(2.0, -0.35); shape.lineTo(1.4, -0.15);
      shape.lineTo(1.0, -0.6); shape.lineTo(0.5, -0.3); shape.lineTo(0, -0.5); shape.closePath();
      const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
      if (s < 0) geo.scale(-1, 1, 1);
      part(p, geo, skin, 1, 1, 1, 0, 0, 0);
      for (const [x, z] of [[2.4, -0.2], [2.0, 0.35], [1.0, 0.6]]) {
        const dir = new THREE.Vector3(s * x, 0, z), len = dir.length();
        const strut = part(p, CAPS(0.03, len), dark, 1, 1, 1, s * x / 2, 0, z / 2);
        strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      }
      anim.wings.push({ pivot: p, s });
    }
  },

  overseer(g, body, def, anim) {
    const dark = phong(shade(def.color, 0.55), { shininess: 80 });
    const vein = glowMat(0xb040ff, 1.6);
    // brain-like core with glowing veins
    part(g, S, body, 3, 2.6, 3, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const v = part(g, new THREE.TorusGeometry(1, 0.012, 6, 48), vein, 3.02, 3.02, 2.62, 0, 0, 0);
      v.rotation.set(Math.PI / 2 + (i - 2.5) * 0.25, i * 0.5, 0);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      part(g, S, dark, 0.9, 0.5, 0.9, Math.cos(a) * 2.2, -1.3, Math.sin(a) * 2.2);           // under-plates
    }
    // one huge eye in a fleshy socket
    part(g, new THREE.TorusGeometry(1, 0.35, 10, 28), dark, 1.3, 1.3, 1.3, 0, 0.3, -2.55);
    part(g, S, phong(0xf0ece0, { shininess: 100 }), 1.25, 1.25, 1.0, 0, 0.3, -2.4);
    anim.eye = part(g, S, EYE_R, 0.55, 0.55, 0.55, 0, 0.3, -3.25);
    part(g, S_LO, new THREE.MeshBasicMaterial({ color: 0x000000 }), 0.22, 0.22, 0.1, 0, 0.3, -3.78);
    // segmented tentacles hanging below
    anim.tentacles = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = pivot(g, Math.cos(a) * 1.8, -1.8, Math.sin(a) * 1.8);
      for (let k = 0; k < 6; k++) part(p, S_LO, k % 2 ? dark : body, 0.32 - k * 0.04, 0.42, 0.32 - k * 0.04, 0, -0.35 - k * 0.65, 0);
      part(p, CONE, EYE_G, 0.1, 0.4, 0.1, 0, -4.3, 0, Math.PI);
      anim.tentacles.push({ pivot: p, a });
    }
    // crown of glowing spires
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      part(g, CONE, EYE_G, 0.25, 1.8, 0.25, Math.cos(a) * 1.7, 2.5, Math.sin(a) * 1.7, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    }
    anim.shield = part(g, new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({
      color: 0x66aaff, transparent: true, opacity: 0.18, depthWrite: false, wireframe: false,
    }), 5.5, 5.5, 5.5, 0, 0, 0);
  },
};

export function buildAlienMesh(type, def) {
  const g = new THREE.Group();
  const body = phong(def.color, { emissive: 0x000000 });
  const anim = {};
  BUILD[type](g, body, def, anim);
  return { group: g, body, anim };
}
