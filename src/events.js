import * as THREE from 'three';
import { game, on, emit, removeFrom } from './game.js';
import { rand, pick, mulberry32 } from './util.js';
import { audio } from './audio.js';
import { explode } from './projectiles.js';
import { cityAt, getCity } from './world/cities.js';
import { isOpen } from './world/nature.js';
import { WORLD_HALF } from './world/world.js';
import { WEAPONS, AMMO_INFO } from './weapons.js';

// World events: alien drop pods that crash near you, and 25 hidden alien relics.

const RELIC_COUNT = 25;
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
const POD_HULL = new THREE.MeshPhongMaterial({ color: 0x2a2632, shininess: 80, specular: 0x666666 });
const POD_GLOW = glow(0x7dff6a, 2.5);
const CRATE_MAT = new THREE.MeshPhongMaterial({ color: 0x3a2a4a, shininess: 60 });
const SCORCH = new THREE.MeshBasicMaterial({ color: 0x120c10, transparent: true, opacity: 0.75, depthWrite: false });

function podMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 3.6, 12), POD_HULL);
  body.position.y = 1.8;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.8, 12), POD_HULL);
  nose.position.y = -0.9;
  nose.rotation.x = Math.PI;
  g.add(nose);
  for (const y of [0.6, 1.8, 3.0]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.06, 6, 24), POD_GLOW);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.9), POD_HULL);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 1.75, 3.2, Math.sin(a) * 1.75);
    fin.rotation.y = -a;
    g.add(fin);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function crateMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.1), CRATE_MAT);
  box.position.y = 0.45;
  g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.2), POD_HULL);
  lid.position.y = 0.95;
  g.add(lid);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 1.12), glow(0xff3cd8, 2));
  strip.position.y = 0.7;
  g.add(strip);
  g.userData.strip = strip;
  return g;
}

function relicMesh() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glow(0xffc14a, 2.2));
  gem.scale.y = 1.5;
  gem.position.y = 1.4;
  g.add(gem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 32), glow(0xb06aff, 2.5));
  ring.position.y = 1.4;
  g.add(ring);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 8), POD_HULL);
  base.position.y = 0.2;
  g.add(base);
  // tall faint beam so you can spot relics from far away
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 70, 8, 1, true).translate(0, 35, 0),
    new THREE.MeshBasicMaterial({ color: 0xffc14a, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(beam);
  g.userData = { gem, ring };
  return g;
}

export class WorldEvents {
  constructor() {
    this.pods = [];
    this.podTimer = 70;
    this.nextPodId = 1;
    this.relics = [];
  }

  init() {
    // Relics sit in fixed spots (same every game), spread out across the open land
    const rnd = mulberry32(4242);
    const pts = [];
    for (let tries = 0; pts.length < RELIC_COUNT && tries < 6000; tries++) {
      const x = (rnd() * 2 - 1) * (WORLD_HALF - 60), z = (rnd() * 2 - 1) * (WORLD_HALF - 60);
      if (!isOpen(x, z, game.cities, game.roads) || game.world.collides(x, z, 2, 0, 3)) continue;
      if (Math.hypot(x - 0, z - 880) < 120) continue;                    // not in the Haven training area
      if (pts.some(p => Math.hypot(p.x - x, p.z - z) < 200)) continue;
      pts.push({ x, z });
    }
    pts.forEach((p, id) => {
      const mesh = relicMesh();
      mesh.position.set(p.x, 0, p.z);
      game.scene.add(mesh);
      this.relics.push({ id, pos: new THREE.Vector3(p.x, 0, p.z), mesh, taken: false, t: rnd() * 6 });
    });
  }

  // Hide relics already found in a loaded save
  syncRelics() {
    for (const r of this.relics) {
      r.taken = game.progress.relics.includes(r.id);
      r.mesh.visible = !r.taken;
    }
  }

  // --- drop pods ---
  launchPod() {
    const P = game.player;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, r = rand(70, 120);
      const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      if (Math.abs(x) > WORLD_HALF - 40 || Math.abs(z) > WORLD_HALF - 40) continue;
      if (!isOpen(x, z, game.cities, game.roads) || game.world.collides(x, z, 4, 0, 4)) continue;
      const mesh = podMesh();
      const from = new THREE.Vector3(x + rand(-120, 120), 320, z + rand(-120, 120));
      mesh.position.copy(from);
      game.scene.add(mesh);
      const dc = Math.hypot(x, z);
      const level = dc > 1050 ? 4 : dc > 700 ? 2 : dc > 380 ? 3 : 4;
      this.pods.push({ id: this.nextPodId++, pos: new THREE.Vector3(x, 0, z), from, mesh, state: 'falling', t: 0, level });
      game.hud.toast('⚠ Alien drop pod incoming! Clear it out to open its loot cache.', 'warn');
      audio.alienShoot(1);
      return;
    }
  }

  landPod(pod) {
    pod.state = 'landed';
    const { x, z } = pod.pos;
    pod.mesh.position.set(x, -0.6, z);
    pod.mesh.rotation.set(rand(-0.25, 0.25), rand(0, 6), rand(-0.25, 0.25));
    explode(new THREE.Vector3(x, 1, z), 9, 60, { hurtPlayer: true, hurtCars: true });
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(7, 24).rotateX(-Math.PI / 2), SCORCH);
    scorch.position.set(x, 0.05, z);
    game.scene.add(scorch);
    pod.scorch = scorch;
    pod.box = game.world.addBox(x - 1.6, 0, z - 1.6, x + 1.6, 3.6, z + 1.6, 'pod');
    // the crew
    const table = pod.level >= 4 ? ['brute', 'stalker', 'bomber', 'spitter', 'flyer', 'sentinel']
      : pod.level >= 3 ? ['stalker', 'spitter', 'bomber', 'crawler', 'flyer'] : ['crawler', 'spitter', 'bomber', 'drone'];
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      game.aliens.spawn(pick(table), x + Math.cos(a) * 5, z + Math.sin(a) * 5, pod.level, { tags: ['pod', 'pod' + pod.id], aggro: true });
    }
    // locked loot cache next to it
    const crate = crateMesh();
    crate.position.set(x + 3.5, 0, z);
    game.scene.add(crate);
    pod.crate = crate;
    pod.inter = {
      pos: crate.position, range: 2.8,
      label: () => {
        const left = game.aliens.count(a => a.tags.includes('pod' + pod.id));
        return left ? `Alien cache: sealed (${left} alien${left > 1 ? 's' : ''} left)` : 'Open alien cache';
      },
      interact: () => this.openCache(pod),
    };
    game.interactables.push(pod.inter);
  }

  openCache(pod) {
    if (game.aliens.count(a => a.tags.includes('pod' + pod.id))) { audio.click(); return; }
    pod.state = 'looted';
    removeFrom(game.interactables, pod.inter);
    game.scene.remove(pod.crate);
    const inv = game.inventory, lv = pod.level;
    const reward = { cores: 40 + lv * 25, parts: 1 + Math.ceil(lv / 2), grenades: 2 };
    if (Math.random() < 0.5) reward.medkits = 1;
    if (Math.random() < 0.35) reward.armor = 40;
    inv.grant(reward);
    for (const id of inv.owned()) inv.addAmmo(WEAPONS[id].ammo, AMMO_INFO[WEAPONS[id].ammo].drop * 2);
    game.effects.burst(pod.crate.position.clone().setY(1), 0xff3cd8, 30, 6, 0.8);
    game.progress.podsCleared++;
    audio.quest();
    emit('podCleared', pod);
    emit('destroyed', 'pod');
    game.save();
  }

  removePod(pod) {
    game.scene.remove(pod.mesh);
    if (pod.scorch) game.scene.remove(pod.scorch);
    if (pod.crate) game.scene.remove(pod.crate);
    if (pod.box) game.world.removeBox(pod.box);
    if (pod.inter) removeFrom(game.interactables, pod.inter);
    game.aliens.despawnWhere(a => a.tags.includes('pod' + pod.id));
    removeFrom(this.pods, pod);
  }

  // Nearest pod that still has loot, for quest waypoints
  nearestPod() {
    const P = game.player;
    let best = null, bd = Infinity;
    for (const p of this.pods) {
      if (p.state === 'looted') continue;
      const d = Math.hypot(p.pos.x - P.pos.x, p.pos.z - P.pos.z);
      if (d < bd) { bd = d; best = p.pos; }
    }
    return best;
  }

  nearestRelic() {
    const P = game.player;
    let best = null, bd = Infinity;
    for (const r of this.relics) {
      if (r.taken) continue;
      const d = Math.hypot(r.pos.x - P.pos.x, r.pos.z - P.pos.z);
      if (d < bd) { bd = d; best = r.pos; }
    }
    return best;
  }

  // Markers for the minimap / world map
  markers() {
    const out = [];
    for (const p of this.pods) if (p.state !== 'looted') out.push({ x: p.pos.x, z: p.pos.z, kind: 'pod' });
    for (const r of this.relics) if (!r.taken) out.push({ x: r.pos.x, z: r.pos.z, kind: 'relic' });
    return out;
  }

  takeRelic(r) {
    r.taken = true;
    r.mesh.visible = false;
    const pr = game.progress;
    pr.relics.push(r.id);
    game.inventory.cores += 25;
    game.effects.burst(r.pos.clone().setY(1.4), 0xffc14a, 30, 5, 0.9);
    audio.quest();
    game.hud.toast(`Alien relic found! (${pr.relics.length} / ${RELIC_COUNT}) · +25 cores`, 'quest');
    pr.addXp(60);
    emit('collect', 'relic');
    if (pr.relics.length === RELIC_COUNT) {
      game.hud.toast('ALL 25 RELICS FOUND! The relics resonate... you feel stronger.', 'big');
      game.inventory.grant({ cores: 600, parts: 15, armor: 100, grenades: 6 });
      pr.addXp(1500);
    }
    game.save();
  }

  update(dt) {
    const P = game.player;
    // relics: spin, bob and get picked up when you walk (or drive) into them
    for (const r of this.relics) {
      if (r.taken) continue;
      const dx = r.pos.x - P.pos.x, dz = r.pos.z - P.pos.z;
      if (Math.abs(dx) > 250 || Math.abs(dz) > 250) continue;
      r.t += dt;
      r.mesh.userData.gem.rotation.y += dt * 1.5;
      r.mesh.userData.gem.position.y = 1.4 + Math.sin(r.t * 2) * 0.15;
      r.mesh.userData.ring.rotation.x = r.t * 0.9;
      r.mesh.userData.ring.rotation.y = r.t * 0.6;
      if (Math.hypot(dx, dz) < (P.inCar ? 4 : 2.4) && !P.dead && game.flags.tutorialDone) this.takeRelic(r);
    }

    // drop pods
    for (const pod of [...this.pods]) {
      pod.t += dt;
      if (pod.state === 'falling') {
        const k = Math.min(1, pod.t / 3.2), e = k * k;
        pod.mesh.position.lerpVectors(pod.from, pod.pos, e);
        pod.mesh.rotation.set(Math.sin(pod.t * 3) * 0.08, pod.t * 2, Math.cos(pod.t * 3) * 0.08);
        game.effects.burst(pod.mesh.position, k < 0.6 ? 0xff8a3a : 0xffd06a, 2, 2, 0.6, -2, 2.2);
        if (k >= 1) this.landPod(pod);
      } else if (pod.state === 'landed' && pod.crate) {
        const open = !game.aliens.count(a => a.tags.includes('pod' + pod.id));
        pod.crate.userData.strip.material = open ? POD_GLOW : pod.crate.userData.strip.material;
      }
      if (Math.hypot(pod.pos.x - P.pos.x, pod.pos.z - P.pos.z) > 450) this.removePod(pod);
    }

    if (!game.flags.tutorialDone || P.dead) return;
    this.podTimer -= dt;
    if (this.podTimer > 0) return;
    // Only out in the wilds, away from the safe towns
    const H = getCity('haven'), R = getCity('ridgeport');
    const safe = Math.hypot(P.pos.x - H.x, P.pos.z - H.z) < 220 || Math.hypot(P.pos.x - R.x, P.pos.z - R.z) < 200;
    if (safe || cityAt(P.pos.x, P.pos.z, 30) || this.pods.some(p => p.state !== 'looted')) { this.podTimer = 10; return; }
    this.launchPod();
    // more frequent while Lin's pod-hunting quest is active
    const hunting = game.quests.state.pod_hunter?.status === 'active';
    this.podTimer = hunting ? rand(35, 60) : rand(110, 180);
  }
}

