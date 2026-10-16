import * as THREE from 'three';

// Detailed first-person gun models. Guns point down -Z; the origin is roughly where the
// right hand grips. Every model sets userData.muzzle (where the flash and bullets start).

const cache = {};
const phong = (c, shine = 40) => (cache[c + ':' + shine] ||= new THREE.MeshPhongMaterial({ color: c, shininess: shine, specular: 0x444444 }));
const glow = c => (cache['g' + c] ||= new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5) }));
const M = {
  steel: () => phong(0x2a2c30, 70),
  black: () => phong(0x141416, 20),
  poly: () => phong(0x2b2a26, 10),
  tan: () => phong(0x8a7656, 12),
  olive: () => phong(0x4c5233, 14),
  wood: () => phong(0x7a4a26, 25),
  chrome: () => phong(0x9a9ea6, 120),
  glove: () => phong(0x2a2620, 8),
  sleeve: () => phong(0x3d4430, 6),
  red: () => phong(0xa82020, 30),
  brass: () => phong(0xc49a3a, 90),
  yellow: () => phong(0xd8b020, 20),
};

function box(g, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}
// Cylinder lying along Z
function tube(g, mat, r, len, x, y, z, seg = 14, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
// Cylinder from point a to point b
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function limb(g, mat, a, b, r1, r2) {
  _a.set(...a); _b.set(...b);
  const len = _a.distanceTo(_b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 10), mat);
  m.position.copy(_a).add(_b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
  g.add(m);
  return m;
}
function hand(g, at, elbow) {
  // forearm in a sleeve, wrist cuff, then a gloved fist
  limb(g, M.sleeve(), elbow, at, 0.055, 0.045);
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.glove());
  fist.scale.set(1, 1.15, 1.35);
  fist.position.set(...at);
  g.add(fist);
  const knuckles = box(g, M.glove(), 0.05, 0.03, 0.07, at[0] - 0.02, at[1] + 0.01, at[2]);
  knuckles.rotation.y = 0.2;
}

function rail(g, len, y, z0) {
  box(g, M.black(), 0.024, 0.008, len, 0, y, z0 - len / 2);
  for (let z = z0 - 0.01; z > z0 - len; z -= 0.022) box(g, M.black(), 0.028, 0.008, 0.01, 0, y + 0.008, z);
}

function redDot(g, y, z) {
  box(g, M.black(), 0.03, 0.012, 0.06, 0, y, z);
  box(g, M.black(), 0.006, 0.045, 0.05, -0.022, y + 0.026, z);
  box(g, M.black(), 0.006, 0.045, 0.05, 0.022, y + 0.026, z);
  box(g, M.black(), 0.05, 0.006, 0.05, 0, y + 0.05, z);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.038),
    new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.18, depthWrite: false }));
  lens.position.set(0, y + 0.028, z - 0.02);
  g.add(lens);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 6, 4), glow(0xff2020));
  dot.position.set(0, y + 0.028, z - 0.019);
  g.add(dot);
}

const BUILDERS = {
  pistol(g, arms) {
    box(g, M.steel(), 0.036, 0.042, 0.22, 0, 0.035, -0.07);              // slide
    for (let i = 0; i < 6; i++) box(g, M.black(), 0.038, 0.03, 0.004, 0, 0.037, 0.02 - i * 0.009); // rear serrations
    box(g, M.black(), 0.012, 0.012, 0.02, 0, 0.012, -0.175);              // barrel bushing
    tube(g, M.black(), 0.008, 0.02, 0, 0.032, -0.185, 10);               // muzzle
    box(g, M.poly(), 0.032, 0.03, 0.18, 0, 0.0, -0.06);                  // frame
    box(g, M.black(), 0.026, 0.012, 0.06, 0, -0.012, -0.12);              // accessory rail
    box(g, M.poly(), 0.036, 0.13, 0.055, 0, -0.07, 0.02, -0.22);          // grip
    for (let i = 0; i < 5; i++) box(g, M.black(), 0.038, 0.004, 0.05, 0, -0.03 - i * 0.022, 0.025 - i * 0.005, -0.22);
    box(g, M.black(), 0.04, 0.012, 0.06, 0, -0.135, 0.035, -0.22);       // mag base
    box(g, M.poly(), 0.008, 0.004, 0.05, 0, -0.03, -0.035);              // trigger guard
    box(g, M.poly(), 0.008, 0.03, 0.006, 0, -0.016, -0.06);
    box(g, M.chrome(), 0.006, 0.018, 0.006, 0, -0.012, -0.03, 0.3);      // trigger
    box(g, M.black(), 0.026, 0.01, 0.01, 0, 0.061, 0.03);                // rear sight
    box(g, M.black(), 0.006, 0.01, 0.008, 0, 0.061, -0.17);              // front sight
    for (const x of [-0.008, 0.008]) box(g, glow(0x7dff4a), 0.003, 0.003, 0.002, x, 0.064, 0.025);
    box(g, glow(0x7dff4a), 0.003, 0.003, 0.002, 0, 0.064, -0.175);
    if (arms) {
      hand(g, [0.004, -0.06, 0.03], [0.15, -0.3, 0.4]);
      hand(g, [-0.03, -0.075, 0.0], [-0.2, -0.3, 0.32]);
    }
    return [0, 0.032, -0.2];
  },

  shotgun(g, arms) {
    tube(g, M.steel(), 0.017, 0.62, 0, 0.04, -0.42);                     // barrel
    tube(g, M.black(), 0.016, 0.48, 0, 0.0, -0.37);                      // magazine tube
    tube(g, M.black(), 0.02, 0.03, 0, 0.0, -0.62);                       // mag cap
    box(g, M.black(), 0.012, 0.012, 0.02, 0, 0.065, -0.72);              // bead sight
    const fore = box(g, M.wood(), 0.06, 0.055, 0.2, 0, 0.005, -0.36);    // pump
    for (let i = 0; i < 7; i++) box(g, phong(0x5a3418, 20), 0.064, 0.05, 0.008, 0, 0.005, -0.28 - i * 0.025);
    fore.userData.pump = true;
    box(g, M.steel(), 0.056, 0.09, 0.24, 0, 0.03, -0.04);                // receiver
    box(g, M.chrome(), 0.004, 0.04, 0.08, 0.029, 0.04, -0.04);           // ejection port
    box(g, M.black(), 0.058, 0.01, 0.2, 0, 0.08, -0.04);                 // top rail
    box(g, M.black(), 0.01, 0.03, 0.06, 0, -0.03, 0.03);                 // trigger guard
    box(g, M.wood(), 0.05, 0.12, 0.06, 0, -0.06, 0.12, -0.35);           // grip
    box(g, M.wood(), 0.055, 0.1, 0.3, 0, 0.0, 0.3, 0.12);                // stock
    box(g, M.black(), 0.058, 0.11, 0.02, 0, -0.02, 0.45, 0.12);          // butt pad
    // side shell carrier with red shells
    box(g, M.black(), 0.008, 0.05, 0.12, -0.033, 0.03, -0.04);
    for (let i = 0; i < 4; i++) {
      const s = tube(g, M.red(), 0.009, 0.045, -0.042, 0.03, -0.085 + i * 0.03, 8);
      s.rotation.set(0, 0, 0);
      box(g, M.brass(), 0.018, 0.012, 0.018, -0.042, 0.003, -0.085 + i * 0.03);
    }
    if (arms) {
      hand(g, [0.004, -0.05, 0.1], [0.16, -0.3, 0.45]);
      hand(g, [-0.01, -0.03, -0.36], [-0.2, -0.32, -0.05]);
    }
    return [0, 0.04, -0.74];
  },

  smg(g, arms) {
    box(g, M.poly(), 0.05, 0.075, 0.26, 0, 0.02, -0.08);                 // upper
    box(g, M.poly(), 0.05, 0.09, 0.16, 0, -0.03, -0.14, 0.15);           // angled lower (Vector-style)
    tube(g, M.black(), 0.024, 0.16, 0, 0.03, -0.28);                     // suppressor
    for (let i = 0; i < 4; i++) tube(g, M.steel(), 0.0255, 0.006, 0, 0.03, -0.22 - i * 0.035);
    rail(g, 0.2, 0.062, 0.04);
    redDot(g, 0.07, -0.04);
    box(g, M.black(), 0.036, 0.16, 0.05, 0, -0.1, -0.13, 0.1);           // mag
    box(g, M.poly(), 0.04, 0.11, 0.05, 0, -0.07, 0.04, -0.2);            // grip
    box(g, M.poly(), 0.035, 0.08, 0.035, 0, -0.06, -0.21);               // vertical foregrip
    box(g, M.black(), 0.02, 0.02, 0.2, 0, 0.03, 0.17);                   // folding stock arms
    box(g, M.black(), 0.02, 0.02, 0.2, 0, -0.02, 0.17);
    box(g, M.poly(), 0.04, 0.09, 0.03, 0, 0.005, 0.27);
    box(g, glow(0xff7a20), 0.052, 0.006, 0.03, 0, 0.0, 0.0);             // safety stripe
    if (arms) {
      hand(g, [0.004, -0.06, 0.05], [0.15, -0.3, 0.42]);
      hand(g, [-0.004, -0.09, -0.21], [-0.2, -0.33, 0.1]);
    }
    return [0, 0.03, -0.37];
  },

  rifle(g, arms) {
    box(g, M.tan(), 0.05, 0.06, 0.24, 0, 0.03, -0.02);                   // upper receiver
    box(g, M.tan(), 0.048, 0.06, 0.18, 0, -0.025, 0.0);                  // lower receiver
    box(g, M.black(), 0.054, 0.058, 0.28, 0, 0.032, -0.28);              // handguard
    for (let i = 0; i < 6; i++) box(g, M.poly(), 0.056, 0.016, 0.03, 0, 0.032, -0.18 - i * 0.04); // vents
    rail(g, 0.5, 0.066, 0.1);
    tube(g, M.steel(), 0.01, 0.16, 0, 0.032, -0.49);                     // barrel
    tube(g, M.black(), 0.016, 0.05, 0, 0.032, -0.58, 6);                 // flash hider
    box(g, M.black(), 0.008, 0.04, 0.012, 0, 0.09, -0.4);                // front sight post
    box(g, M.chrome(), 0.004, 0.02, 0.05, 0.026, 0.04, -0.02);           // ejection port
    box(g, M.black(), 0.02, 0.01, 0.02, 0, 0.065, 0.1);                  // charging handle
    // holographic sight
    box(g, M.black(), 0.045, 0.015, 0.09, 0, 0.08, -0.03);
    box(g, M.black(), 0.045, 0.05, 0.008, 0, 0.11, 0.01);
    box(g, M.black(), 0.045, 0.05, 0.008, 0, 0.11, -0.07);
    box(g, M.black(), 0.045, 0.006, 0.085, 0, 0.137, -0.03);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.042),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.15, depthWrite: false }));
    lens.position.set(0, 0.11, -0.068);
    g.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0009, 4, 20), glow(0xff3030));
    ring.position.set(0, 0.11, -0.067);
    g.add(ring);
    // curved magazine
    box(g, M.tan(), 0.034, 0.1, 0.06, 0, -0.08, -0.09, 0.1);
    box(g, M.tan(), 0.034, 0.08, 0.058, 0, -0.16, -0.075, 0.3);
    box(g, M.poly(), 0.042, 0.12, 0.05, 0, -0.08, 0.08, -0.3);           // grip
    box(g, M.poly(), 0.008, 0.025, 0.08, 0, -0.06, -0.0);                // guard
    tube(g, M.black(), 0.012, 0.16, 0, 0.0, 0.2, 8);                     // buffer tube
    box(g, M.tan(), 0.045, 0.095, 0.16, 0, -0.01, 0.28);                 // stock
    box(g, M.black(), 0.048, 0.1, 0.015, 0, -0.01, 0.365);
    box(g, M.poly(), 0.035, 0.07, 0.035, 0, -0.03, -0.28);               // angled foregrip
    if (arms) {
      hand(g, [0.004, -0.06, 0.09], [0.16, -0.3, 0.45]);
      hand(g, [-0.004, -0.06, -0.28], [-0.22, -0.33, 0.0]);
    }
    return [0, 0.032, -0.61];
  },

  plasma(g, arms) {
    const shell = phong(0xd8dce2, 80), dark = phong(0x22262e, 50), teal = 0x55ffcc;
    tube(g, shell, 0.05, 0.36, 0, 0.03, -0.14, 18, 0.042);               // main body
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.03, -0.32);
    nose.scale.set(1, 1, 1.6);
    g.add(nose);
    tube(g, dark, 0.02, 0.08, 0, 0.03, -0.4, 12);                        // emitter
    tube(g, glow(teal), 0.012, 0.01, 0, 0.03, -0.44, 12);
    for (let i = 0; i < 3; i++) {                                        // glowing coils
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.007, 6, 24), glow(teal));
      t.position.set(0, 0.03, -0.22 + i * 0.06);
      g.add(t);
    }
    for (const s of [-1, 1]) box(g, dark, 0.008, 0.07, 0.2, s * 0.055, 0.04, -0.06, 0, 0, s * 0.25); // fins
    // energy cell in a glass case
    tube(g, new THREE.MeshPhongMaterial({ color: 0x88ffee, transparent: true, opacity: 0.3, shininess: 100 }), 0.026, 0.12, 0, -0.04, 0.05, 12);
    tube(g, glow(teal), 0.012, 0.11, 0, -0.04, 0.05, 8);
    tube(g, dark, 0.03, 0.015, 0, -0.04, -0.01, 12);
    tube(g, dark, 0.03, 0.015, 0, -0.04, 0.11, 12);
    box(g, dark, 0.04, 0.12, 0.05, 0, -0.07, 0.1, -0.2);                 // grip
    box(g, shell, 0.04, 0.04, 0.16, 0, 0.0, 0.2);                        // stock
    box(g, dark, 0.03, 0.03, 0.06, 0, 0.09, -0.1);                       // top emitter sight
    box(g, glow(teal), 0.032, 0.004, 0.004, 0, 0.106, -0.07);
    if (arms) {
      hand(g, [0.004, -0.06, 0.1], [0.16, -0.3, 0.45]);
      hand(g, [-0.03, -0.01, -0.2], [-0.24, -0.3, 0.05]);
    }
    return [0, 0.03, -0.46];
  },

  rocket(g, arms) {
    const body = M.olive();
    tube(g, body, 0.075, 0.95, 0, 0.06, -0.12, 20);                      // launch tube
    tube(g, M.black(), 0.085, 0.06, 0, 0.06, -0.6, 20);                  // front ring
    tube(g, M.black(), 0.1, 0.1, 0, 0.06, 0.38, 20, 0.08);               // rear venturi flare
    tube(g, M.yellow(), 0.077, 0.03, 0, 0.06, -0.5, 20);                 // warning band
    tube(g, M.yellow(), 0.077, 0.03, 0, 0.06, 0.28, 20);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 14), M.red()); // warhead peeking out
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, 0.06, -0.68);
    g.add(tip);
    box(g, M.black(), 0.05, 0.06, 0.12, -0.1, 0.11, -0.1);               // side optic
    tube(g, M.black(), 0.02, 0.05, -0.1, 0.12, -0.18, 10);
    tube(g, glow(0xff5020), 0.014, 0.004, -0.1, 0.12, -0.206, 10);
    box(g, M.black(), 0.045, 0.13, 0.05, 0, -0.06, 0.02, -0.15);         // rear grip
    box(g, M.black(), 0.04, 0.11, 0.045, 0, -0.06, -0.3);                // front grip
    box(g, M.black(), 0.06, 0.03, 0.4, 0, -0.01, -0.1);                  // under rail
    if (arms) {
      hand(g, [0.004, -0.06, 0.02], [0.16, -0.3, 0.4]);
      hand(g, [-0.004, -0.07, -0.3], [-0.22, -0.33, 0.0]);
    }
    return [0, 0.06, -0.72];
  },

  sniper(g, arms) {
    const body = phong(0x3a3e34, 20);
    box(g, body, 0.05, 0.07, 0.3, 0, 0.02, -0.02);                       // receiver
    tube(g, M.steel(), 0.011, 0.62, 0, 0.035, -0.45);                    // long barrel
    tube(g, M.black(), 0.02, 0.09, 0, 0.035, -0.78, 8);                  // muzzle brake
    for (const s of [-1, 1]) box(g, M.black(), 0.008, 0.014, 0.05, s * 0.02, 0.035, -0.78);
    box(g, body, 0.056, 0.05, 0.3, 0, 0.0, -0.3);                        // forend
    for (const s of [-1, 1]) {                                           // folded bipod legs
      box(g, M.black(), 0.012, 0.012, 0.2, s * 0.02, -0.03, -0.35);
    }
    // big scope on rings
    tube(g, M.black(), 0.026, 0.26, 0, 0.115, -0.04, 18);
    tube(g, M.black(), 0.036, 0.07, 0, 0.115, -0.2, 18, 0.026);          // objective bell
    tube(g, M.black(), 0.032, 0.05, 0, 0.115, 0.11, 18, 0.026);          // eyepiece
    tube(g, new THREE.MeshPhongMaterial({ color: 0x3a6aff, shininess: 150, specular: 0xffffff }), 0.031, 0.004, 0, 0.115, -0.236, 18);
    box(g, M.black(), 0.02, 0.025, 0.02, 0, 0.145, -0.04);               // turret
    box(g, M.black(), 0.025, 0.02, 0.02, 0.03, 0.115, -0.04);
    for (const z of [-0.1, 0.03]) box(g, M.black(), 0.03, 0.05, 0.02, 0, 0.075, z);
    box(g, M.black(), 0.036, 0.14, 0.05, 0, -0.08, 0.1, -0.25);          // grip
    box(g, body, 0.05, 0.1, 0.32, 0, -0.01, 0.3, 0.06);                  // stock
    box(g, body, 0.05, 0.04, 0.12, 0, 0.06, 0.22);                       // cheek rest
    box(g, M.black(), 0.054, 0.11, 0.02, 0, -0.02, 0.46, 0.06);
    box(g, M.black(), 0.03, 0.08, 0.05, 0, -0.07, -0.05);                // mag
    box(g, M.chrome(), 0.012, 0.012, 0.05, 0.035, 0.04, 0.06);           // bolt handle
    if (arms) {
      hand(g, [0.004, -0.06, 0.1], [0.16, -0.3, 0.46]);
      hand(g, [-0.004, -0.04, -0.3], [-0.22, -0.33, 0.0]);
    }
    return [0, 0.035, -0.84];
  },

  minigun(g, arms) {
    const body = phong(0x4a4a50, 50);
    box(g, body, 0.13, 0.13, 0.26, 0, -0.01, 0.08);                      // motor housing
    box(g, M.yellow(), 0.132, 0.02, 0.1, 0, 0.05, 0.08);                 // hazard stripe
    tube(g, M.black(), 0.075, 0.06, 0, 0.0, -0.08, 16);                  // front plate
    // six spinning barrels
    const barrels = new THREE.Group();
    barrels.position.set(0, 0, -0.1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tube(barrels, M.steel(), 0.011, 0.5, Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.25, 8);
    }
    for (const z of [-0.12, -0.45]) tube(barrels, M.black(), 0.058, 0.02, 0, 0, z, 16);
    tube(barrels, M.black(), 0.012, 0.52, 0, 0, -0.26, 8);
    g.add(barrels);
    g.userData.barrels = barrels;
    box(g, M.black(), 0.1, 0.12, 0.12, -0.11, -0.04, 0.12);              // ammo box
    box(g, M.olive(), 0.104, 0.05, 0.124, -0.11, 0.0, 0.12);
    for (let i = 0; i < 6; i++) box(g, M.brass(), 0.02, 0.012, 0.03, -0.06 + i * 0.012, 0.03 - i * 0.012, 0.12); // belt
    box(g, M.black(), 0.04, 0.13, 0.05, 0, -0.12, 0.12, -0.2);           // rear grip
    box(g, M.black(), 0.025, 0.025, 0.2, 0, 0.11, 0.05);                 // carry handle
    box(g, M.black(), 0.025, 0.06, 0.025, 0, 0.08, -0.04);
    box(g, M.black(), 0.025, 0.06, 0.025, 0, 0.08, 0.14);
    if (arms) {
      hand(g, [0.004, -0.11, 0.13], [0.16, -0.32, 0.46]);
      hand(g, [-0.03, 0.12, 0.05], [-0.22, -0.2, 0.25]);
    }
    return [0, 0.0, -0.62];
  },
};

export function buildGunModel(id, arms = false) {
  const g = new THREE.Group();
  const muzzle = BUILDERS[id](g, arms);
  g.userData.muzzle = new THREE.Vector3(...muzzle);
  // Aim-down-sights: the sight's x/y in the gun model, and the zoomed field of view
  const [sx, sy, fov] = {
    pistol: [0, 0.064, 58], shotgun: [0, 0.068, 60], smg: [0, 0.098, 52],
    rifle: [0, 0.11, 42], plasma: [0, 0.106, 50], rocket: [-0.1, 0.12, 48],
    sniper: [0, 0.115, 14], minigun: [0, 0.14, 58],
  }[id];
  g.userData.sight = { x: sx, y: sy, fov };
  if (arms) {
    // Held in first person: long guns sit further out so the stock doesn't fill the screen
    const reach = { pistol: 0.02, shotgun: 0.26, smg: 0.12, rifle: 0.24, plasma: 0.16, rocket: 0.2, sniper: 0.3, minigun: 0.3 }[id];
    g.position.set(0.02, 0.02, -reach);
    g.scale.setScalar(0.88);
  }
  return g;
}
