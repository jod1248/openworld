import * as THREE from 'three';
import { game, on, removeFrom } from './game.js';
import { audio } from './audio.js';
import { getCity } from './world/cities.js';

const postMat = new THREE.MeshLambertMaterial({ color: 0x6b4426 });
const ringMats = [new THREE.MeshLambertMaterial({ color: 0xdd2222 }), new THREE.MeshLambertMaterial({ color: 0xffffff })];

class Target {
  constructor(x, z, onHit) {
    this.alive = true;
    this.onHit = onHit;
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), postMat);
    post.position.y = 0.55;
    g.add(post);
    this.board = new THREE.Group();
    this.board.position.y = 1.1;
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.7 - i * 0.22, 0.7 - i * 0.22, 0.06 + i * 0.01, 20), ringMats[i % 2]);
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.6;
      this.board.add(r);
    }
    g.add(this.board);
    g.position.set(x, 0, z);
    game.scene.add(g);
    this.mesh = g;
    this.sph = { x, y: 1.7, z, r: 0.75 };
    this.fall = 0;
    game.hittables.push(this);
  }
  sphere() { return this.sph; }
  damage() {
    if (!this.alive) return false;
    this.alive = false;
    removeFrom(game.hittables, this);
    audio.hit();
    this.onHit();
    return true;
  }
  update(dt) {
    if (!this.alive && this.fall < 1) {
      this.fall = Math.min(1, this.fall + dt * 4);
      this.board.rotation.x = -this.fall * Math.PI / 2;
    }
  }
}

const STEPS = [
  { text: 'Move the <b>mouse</b> to look around.', check: P => P.lookAccum > 2.2 },
  { text: 'Use <b>W A S D</b> to walk forward, back, and strafe.', check: P => P.moveAccum > 6 },
  { text: 'Press <b>SPACE</b> to jump over the crates.', check(P) { return P.pos.z < this.H.z + 34; } },
  { text: 'Hold <b>C</b> to crouch and sneak under the barrier.', check(P) { return P.pos.z < this.H.z + 24; } },
  {
    text: 'There\'s a pistol on the ground ahead. Walk up to it and press <b>F</b> to pick it up.',
    check: () => game.inventory.has('pistol'),
    wp() { return this.H.pistolPos; },
  },
  {
    text: '<b>Left click</b> to shoot all <b>3 targets</b> to the north. Press <b>R</b> to reload.',
    start() { this.targets = this.H.targetPos.map(p => new Target(p.x, p.z, () => this.targetsHit++)); },
    check() { return this.targetsHit >= 3; },
    wp() { return { x: this.H.x, z: this.H.z - 26 }; },
  },
  {
    text: 'Incoming! Alien <b>Drones</b> breached the fence. Destroy them!',
    start() {
      for (const [dx, dz] of [[-14, -48], [0, -52], [14, -48]]) {
        game.aliens.spawn('drone', this.H.x + dx, this.H.z + dz, 1, { tags: ['tutorial'], aggro: true });
      }
    },
    check() { return this.dronesKilled >= 3; },
  },
  {
    text: 'You\'re hurt. Press <b>E</b> to open your <b>backpack</b> and use a <b>Medkit</b>. (Shortcut: <b>H</b>.)',
    start() {
      const P = game.player;
      game.inventory.medkits = Math.max(1, game.inventory.medkits);
      if (P.health > 70) P.health = 60;
    },
    check(P) {
      if (!this.medUsed && P.health >= P.maxHealth) { P.health = 60; game.inventory.medkits = Math.max(1, game.inventory.medkits); }
      return this.medUsed;
    },
  },
  {
    text: 'Aliens drop <b>cores</b> and <b>parts</b>. Spend them on weapon upgrades in your backpack. The north gate is open: follow the road to <b>Ridgeport</b>. (<b>M</b> opens the map.)',
    start() { this.openGate(); },
    check(P) { const R = getCity('ridgeport'); return Math.hypot(P.pos.x - R.x, P.pos.z - R.z) < 100; },
    wp() { const R = getCity('ridgeport'); return { x: R.x, z: R.z }; },
  },
];

export class Tutorial {
  constructor() {
    this.active = false;
    this.step = -1;
    this.targets = [];
    on('kill', a => { if (a.tags.includes('tutorial')) this.dronesKilled++; });
    on('medkit', () => { this.medUsed = true; });
  }

  start() {
    this.H = getCity('haven');
    this.active = true;
    this.step = -1;
    this.targetsHit = 0;
    this.dronesKilled = 0;
    this.medUsed = false;
    game.pickups.spawn('weapon', this.H.pistolPos.x, this.H.pistolPos.z, { id: 'pistol' }, 0.25);
    this.next();
  }

  next() {
    this.step++;
    const s = STEPS[this.step];
    if (!s) return this.finish();
    s.start?.call(this);
    game.hud.setTutorial(s.text, this.step + 1, STEPS.length);
    if (this.step > 0) audio.pickup();
  }

  update(dt) {
    for (const t of this.targets) t.update(dt);
    const g = this.H?.gate;
    if (g && g.open && g.mesh.position.y < 5) g.mesh.position.y += dt * 2;
    if (!this.active) return;
    const s = STEPS[this.step];
    if (s && s.check.call(this, game.player)) this.next();
  }

  waypoint() {
    const s = STEPS[this.step];
    return s?.wp ? s.wp.call(this) : null;
  }

  openGate() {
    const g = this.H.gate;
    if (g.open) return;
    g.open = true;
    game.world.removeBox(g.box);
  }

  finish() {
    this.active = false;
    game.flags.tutorialDone = true;
    game.inventory.addGrenades(3);
    game.hud.setTutorial(null);
    game.hud.toast('Training complete! Talk to the people of Ridgeport with a <b style="color:#ffd34a">!</b> above them.', 'big');
    game.hud.toast('You got 3 grenades. Press <b>G</b> to throw one.', 'quest');
    audio.quest();
    game.save();
  }

  skip() {
    this.H = getCity('haven');
    this.active = false;
    this.openGate();
    this.H.gate.mesh.position.y = 5;
    game.flags.tutorialDone = true;
    game.hud.setTutorial(null);
  }
}
