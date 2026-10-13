import * as THREE from 'three';

// Humans for the townsfolk / soldiers. Feet at y = 0, facing -Z.
const cache = {};
const mat = (c, shine = 8) => (cache[c + ':' + shine] ||= new THREE.MeshPhongMaterial({ color: c, shininess: shine }));
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

function add(parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.castShadow = true;
  parent.add(o);
  return o;
}

// Arm or leg hanging from a joint so it can swing
function joint(parent, x, y, z) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

const HAIR = [0x1e140c, 0x3a2414, 0x6a4a2a, 0xa07040, 0x8a8a88, 0x2a1a10];

export function buildPerson(o) {
  const seed = [...(o.id || 'x')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const r = n => ((seed >> n) & 7) / 7;
  const skin = mat(o.skin ?? 0xc89a74, 4);
  const shirt = mat(o.color ?? 0x556b2f);
  const pants = mat(o.pants ?? 0x2d2d35);
  const boots = mat(0x231a12, 30);
  const dark = mat(0x1a1a1c, 20);
  const hair = mat(HAIR[seed % HAIR.length], 12);
  const soldier = !!o.soldier;

  const g = new THREE.Group();
  const body = new THREE.Group();   // everything above the hips; bobs while breathing
  g.add(body);

  // legs
  const legs = [-0.11, 0.11].map(x => {
    const hip = joint(g, x, 0.95, 0);
    add(hip, capsule(0.085, 0.38), pants, 0, -0.24, 0);          // thigh
    add(hip, capsule(0.075, 0.36), pants, 0, -0.62, 0.01);       // shin
    add(hip, new THREE.BoxGeometry(0.13, 0.1, 0.28), boots, 0, -0.9, -0.04); // boot
    add(hip, new THREE.BoxGeometry(0.14, 0.03, 0.29), dark, 0, -0.945, -0.04); // sole
    return hip;
  });

  // hips and torso
  add(body, capsule(0.17, 0.08), pants, 0, 0.98, 0, 1.05, 1, 0.8);
  add(body, new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16), dark, 0, 1.05, 0, 1, 1, 0.78);   // belt
  add(body, new THREE.BoxGeometry(0.06, 0.05, 0.02), mat(0xb09040, 80), 0, 1.05, -0.155);       // buckle
  const torso = add(body, capsule(0.2, 0.3), shirt, 0, 1.3, 0, 1.08, 1, 0.72);
  add(body, new THREE.CylinderGeometry(0.075, 0.09, 0.08, 10), shirt, 0, 1.56, 0);              // collar
  if (soldier) {
    const vest = mat(0x3a3f2c, 6);
    add(body, new THREE.BoxGeometry(0.42, 0.42, 0.33), vest, 0, 1.3, 0);
    for (const x of [-0.12, 0, 0.12]) add(body, new THREE.BoxGeometry(0.1, 0.12, 0.05), vest, x, 1.2, -0.185); // pouches
    add(body, new THREE.BoxGeometry(0.08, 0.05, 0.02), mat(0x806030), -0.12, 1.42, -0.17);       // name tape
  } else {
    // open jacket edge and pocket
    add(body, new THREE.BoxGeometry(0.02, 0.4, 0.02), mat(new THREE.Color(o.color ?? 0x556b2f).multiplyScalar(0.6).getHex()), 0, 1.3, -0.15);
    add(body, new THREE.BoxGeometry(0.09, 0.08, 0.015), mat(new THREE.Color(o.color ?? 0x556b2f).multiplyScalar(0.75).getHex()), 0.1, 1.38, -0.148);
  }

  // arms
  const arms = [-1, 1].map(s => {
    const sh = joint(body, s * 0.27, 1.48, 0);
    add(sh, new THREE.SphereGeometry(0.095, 10, 8), shirt, 0, 0, 0);                         // shoulder
    add(sh, capsule(0.07, 0.24), shirt, 0, -0.18, 0);                                        // upper arm
    add(sh, capsule(0.06, 0.22), soldier ? shirt : skin, 0, -0.46, -0.02);                   // forearm
    add(sh, new THREE.SphereGeometry(0.06, 10, 8), soldier ? mat(0x2a2620) : skin, 0, -0.64, -0.03, 0.9, 1.2, 0.8); // hand
    sh.rotation.z = s * 0.08;
    return sh;
  });

  // head
  const head = joint(body, 0, 1.62, 0);
  add(head, new THREE.CylinderGeometry(0.06, 0.065, 0.1, 10), skin, 0, 0.0, 0);              // neck
  const skull = add(head, new THREE.SphereGeometry(0.13, 18, 14), skin, 0, 0.14, 0, 0.95, 1.1, 1);
  add(head, new THREE.SphereGeometry(0.03, 8, 6), skin, -0.125, 0.14, 0, 0.6, 1, 1);          // ears
  add(head, new THREE.SphereGeometry(0.03, 8, 6), skin, 0.125, 0.14, 0, 0.6, 1, 1);
  add(head, new THREE.BoxGeometry(0.03, 0.05, 0.04), skin, 0, 0.12, -0.13);                   // nose
  for (const x of [-0.045, 0.045]) {
    add(head, new THREE.SphereGeometry(0.018, 8, 6), mat(0xf4f0ea, 40), x, 0.16, -0.112);     // eye whites
    add(head, new THREE.SphereGeometry(0.01, 6, 4), mat(0x2a1a10, 60), x, 0.16, -0.126);       // pupils
    add(head, new THREE.BoxGeometry(0.045, 0.01, 0.01), hair, x, 0.19, -0.12, 1, 1, 1).rotation.z = x > 0 ? -0.15 : 0.15; // brows
  }
  add(head, new THREE.BoxGeometry(0.06, 0.008, 0.01), mat(0x8a4a3a), 0, 0.075, -0.12);        // mouth
  if (r(3) > 0.6 && !soldier) add(head, new THREE.SphereGeometry(0.1, 10, 8), hair, 0, 0.07, -0.05, 1, 0.6, 0.9); // beard

  // hair or headgear
  if (soldier) {
    const helm = mat(o.hat ?? 0x3a4a2a, 10);
    add(head, new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 0.17, 0.0, 1, 0.9, 1.05);
    add(head, new THREE.CylinderGeometry(0.165, 0.17, 0.02, 16), helm, 0, 0.17, 0.0);
    add(head, new THREE.BoxGeometry(0.1, 0.035, 0.03), dark, 0, 0.27, -0.13);                // NVG mount
  } else {
    const style = seed % 3;
    add(head, new THREE.SphereGeometry(0.138, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), hair, 0, 0.16, 0.01, 1, style === 2 ? 1.2 : 1, 1.05);
    if (style === 1) add(head, capsule(0.06, 0.14), hair, 0, 0.08, 0.13);                    // ponytail
    if (o.hat) {
      const hm = mat(o.hat, 6);
      add(head, new THREE.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 0.19, 0.0, 1, 0.75, 1.05); // cap
      add(head, new THREE.BoxGeometry(0.2, 0.015, 0.12), hm, 0, 0.2, -0.15);                 // brim
    }
  }

  return { group: g, anim: { body, torso, arms, legs, head, skull } };
}

// Idle: breathing, weight shift, small arm sway, head glances
export function animatePerson(a, t) {
  a.body.position.y = Math.sin(t * 1.8) * 0.006;
  a.torso.scale.x = 1.08 + Math.sin(t * 1.8) * 0.012;
  a.body.rotation.z = Math.sin(t * 0.4) * 0.02;
  a.arms[0].rotation.x = Math.sin(t * 0.9) * 0.05;
  a.arms[1].rotation.x = Math.sin(t * 0.9 + 1.5) * 0.05;
  a.head.rotation.y = Math.sin(t * 0.3) * 0.25 * Math.max(0, Math.sin(t * 0.13));
}
