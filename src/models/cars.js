import * as THREE from 'three';

// Cars and pickup trucks with a real side profile. Front is -Z, wheels touch y = 0.
// Returns { group, body, wheels } — body is the paint material (turns black when wrecked).

const tyreMat = new THREE.MeshPhongMaterial({ color: 0x141414, shininess: 5 });
const rimMat = new THREE.MeshPhongMaterial({ color: 0xb8bcc4, shininess: 120, specular: 0x888888 });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2430, shininess: 140, specular: 0x9aaabb, transparent: true, opacity: 0.85 });
const trimMat = new THREE.MeshPhongMaterial({ color: 0x18181a, shininess: 30 });
const chromeMat = new THREE.MeshPhongMaterial({ color: 0xd0d4dc, shininess: 150, specular: 0xaaaaaa });
const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c0).multiplyScalar(3) });
const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(2.5) });

// Side outline (z along the car, y up), extruded across the car's width
function profile(pts, width, bevel = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [z, y] of pts.slice(1)) s.lineTo(z, y);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);  // shape x -> world z
  return g;
}

function add(g, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function wheel() {
  const w = new THREE.Group();
  add(w, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 20).rotateZ(Math.PI / 2), tyreMat);
  add(w, new THREE.TorusGeometry(0.4, 0.05, 6, 20).rotateY(Math.PI / 2), tyreMat);
  for (const s of [-1, 1]) {
    add(w, new THREE.CylinderGeometry(0.27, 0.27, 0.02, 16).rotateZ(Math.PI / 2), rimMat, s * 0.15, 0, 0);
    for (let i = 0; i < 5; i++) {
      const spoke = add(w, new THREE.BoxGeometry(0.03, 0.05, 0.26), trimMat, s * 0.165, 0, 0);
      spoke.rotation.x = (i / 5) * Math.PI * 2;
    }
    add(w, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8).rotateZ(Math.PI / 2), chromeMat, s * 0.17, 0, 0);
  }
  return w;
}

export function buildCar(color, truck) {
  const g = new THREE.Group();
  const body = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x666666 });
  const W = 1.95;

  if (truck) {
    // cab + open bed
    add(g, profile([[-2.25, 0.45], [-2.25, 1.0], [-1.6, 1.15], [-0.55, 1.2], [2.25, 1.2], [2.25, 0.45]], W), body);
    add(g, profile([[-0.95, 1.15], [-0.5, 1.95], [0.55, 1.95], [0.6, 1.15]], W - 0.12), body);
    add(g, profile([[-0.85, 1.2], [-0.48, 1.85], [0.5, 1.85], [0.52, 1.2]], W - 0.08), glassMat);
    add(g, new THREE.BoxGeometry(W - 0.2, 0.1, 1.5), trimMat, 0, 1.15, 1.45);           // bed floor
    add(g, new THREE.BoxGeometry(0.06, 0.12, 1.6), chromeMat, -W / 2 + 0.03, 1.27, 1.45);
    add(g, new THREE.BoxGeometry(0.06, 0.12, 1.6), chromeMat, W / 2 - 0.03, 1.27, 1.45);
  } else {
    // sedan: bonnet, windscreen, roof, rear window, boot
    add(g, profile([[-2.2, 0.42], [-2.2, 0.85], [-1.2, 1.05], [1.4, 1.05], [2.2, 0.95], [2.2, 0.42]], W), body);
    add(g, profile([[-1.0, 1.0], [-0.35, 1.58], [0.85, 1.58], [1.45, 1.0]], W - 0.18), body);
    add(g, profile([[-0.92, 1.03], [-0.32, 1.53], [0.82, 1.53], [1.35, 1.03]], W - 0.14), glassMat);
    add(g, new THREE.BoxGeometry(0.06, 0.5, 0.06), body, -W / 2 + 0.12, 1.3, 0.25);     // B-pillars
    add(g, new THREE.BoxGeometry(0.06, 0.5, 0.06), body, W / 2 - 0.12, 1.3, 0.25);
  }
  // bumpers, grille, lights, mirrors, door lines
  add(g, new THREE.BoxGeometry(W + 0.04, 0.18, 0.14), trimMat, 0, 0.5, -2.25);
  add(g, new THREE.BoxGeometry(W + 0.04, 0.18, 0.14), trimMat, 0, 0.5, 2.25);
  add(g, new THREE.BoxGeometry(0.8, 0.18, 0.04), trimMat, 0, 0.75, -2.27);
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.76, 0.02, 0.045), chromeMat, 0, 0.69 + i * 0.06, -2.27);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.38, 0.14, 0.05), headMat, s * 0.68, 0.8, -2.24);
    add(g, new THREE.BoxGeometry(0.36, 0.14, 0.05), tailMat, s * 0.7, 0.82, 2.24);
    add(g, new THREE.BoxGeometry(0.16, 0.1, 0.06), trimMat, s * (W / 2 + 0.07), 1.12, -0.85);  // mirror
    add(g, new THREE.BoxGeometry(0.01, 0.55, 0.01), trimMat, s * (W / 2 + 0.005), 0.75, 0.2); // door seam
    add(g, new THREE.BoxGeometry(0.03, 0.04, 0.16), chromeMat, s * (W / 2 + 0.01), 0.92, -0.15); // handle
    // wheel arches
    for (const z of [-1.4, 1.4]) add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16, 1, true, Math.PI, Math.PI).rotateZ(Math.PI / 2), trimMat, s * (W / 2 - 0.02), 0.45, z);
  }
  add(g, new THREE.BoxGeometry(0.4, 0.1, 0.02), chromeMat, 0, 0.62, 2.32);           // number plate
  add(g, new THREE.BoxGeometry(W - 0.2, 0.08, 4.2), trimMat, 0, 0.38, 0);              // sill / underside

  const wheels = [];
  for (const [x, z] of [[-0.88, -1.4], [0.88, -1.4], [-0.88, 1.4], [0.88, 1.4]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42, z);
    const w = wheel();
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, w, front: z < 0 });
  }
  return { group: g, body, wheels };
}
