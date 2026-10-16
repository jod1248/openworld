import * as THREE from 'three';
import { game } from './game.js';
import { buildPerson, animatePerson } from './models/people.js';

function markerTexture(ch, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 56px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#000';
  g.strokeText(ch, 32, 34);
  g.fillStyle = color;
  g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let TEX = null;

export class NPC {
  constructor(o) {
    TEX ||= { '!': markerTexture('!', '#ffd34a'), '?': markerTexture('?', '#b6ff7a') };
    this.id = o.id;
    this.name = o.name;
    this.lines = o.lines || ['...'];
    this.quests = o.quests || [];
    this.pos = new THREE.Vector3(o.x, 0, o.z);
    this.lineIdx = 0;
    const person = buildPerson(o);
    const g = person.group;
    this.anim = person.anim;
    this.t = Math.random() * 10;
    g.position.copy(this.pos);
    g.rotation.y = (o.facing ?? 0) + Math.PI;
    game.scene.add(g);
    this.mesh = g;
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX['!'], depthWrite: false }));
    this.marker.scale.set(0.8, 0.8, 0.8);
    this.marker.position.y = 2.5;
    this.marker.visible = false;
    g.add(this.marker);
    game.world.addBox(o.x - 0.35, 0, o.z - 0.35, o.x + 0.35, 1.9, o.z + 0.35, 'npc');
    this.inter = {
      pos: this.pos, range: 3,
      label: () => `Talk to ${this.name}`,
      interact: () => game.quests.talk(this),
    };
    game.interactables.push(this.inter);
  }

  nextLine() { return this.lines[this.lineIdx++ % this.lines.length]; }

  update(dt) {
    this.t += dt;
    animatePerson(this.anim, this.t);
    const P = game.player;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    if (dx * dx + dz * dz < 144) {
      const target = Math.atan2(-dx, -dz);
      let d = target - this.mesh.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.mesh.rotation.y += d * Math.min(1, dt * 5);
    }
    const m = game.quests.npcMarker(this);
    this.marker.visible = !!m;
    if (m) {
      this.marker.material.map = TEX[m];
      this.marker.position.y = 2.5 + Math.sin(performance.now() * 0.004) * 0.1;
    }
  }
}

export class NPCManager {
  constructor() { this.list = []; }
  add(o) { const n = new NPC(o); this.list.push(n); return n; }
  get(id) { return this.list.find(n => n.id === id); }
  update(dt) {
    const P = game.player;
    for (const n of this.list) if (Math.abs(n.pos.x - P.pos.x) < 200 && Math.abs(n.pos.z - P.pos.z) < 200) n.update(dt);
  }

  init() {
    const R = game.cities.find(c => c.id === 'ridgeport');
    const H = game.cities.find(c => c.id === 'haven');
    this.add({
      id: 'okafor', name: 'Sgt. Okafor', soldier: true, x: H.x + 4, z: H.z + 7, color: 0x4b5b3a, hat: 0x3a4a2a, facing: Math.PI,
      lines: [
        'Pick up that pistol and show me what you learned.',
        'When the drones come, keep moving. Standing still is how people get zapped.',
        'Ridgeport is north up the road. They need every gun they can get.',
      ],
    });
    this.add({
      id: 'reyes', name: 'Captain Reyes', soldier: true, x: R.x - 6, z: R.z - 10, color: 0x5a6b3a, hat: 0x2d3320,
      quests: ['clear_square', 'outposts', 'frontier', 'overseer'],
      lines: ['Stay sharp out there.', 'Every town we free makes that mothership weaker.', 'Check your backpack. Upgraded guns win fights.'],
    });
    this.add({
      id: 'lin', name: 'Quartermaster Lin', x: R.x + 10, z: R.z - 8, color: 0x2d4f7a,
      quests: ['lost_supplies', 'pod_hunter'],
      lines: ['Alien cores make a decent currency these days.', 'Need ammo? Use the resupply crate in the plaza.'],
    });
    this.add({
      id: 'ozzie', name: 'Ozzie', x: R.x - 18, z: R.z + 20, color: 0xd9822b, hat: 0x2b4a7a,
      quests: ['wheels'],
      lines: ['Anything with four wheels and an engine, I can get running.', 'Run the aliens over. Saves ammo.'],
    });
    this.add({
      id: 'tess', name: 'Tess', x: R.x + 14, z: R.z + 16, color: 0x8a3a5a, skin: 0x8d5a3c, quests: ['relic_hunt'],
      lines: ['The beam over the Metropolis never stops humming.', 'I heard Brightwater has the nastiest ones. Flyers and Brutes.', 'Stalkers can teleport. If one goes invisible, check behind you.'],
    });
    this.add({
      id: 'harlan', name: 'Old Harlan', x: R.x + 2, z: R.z + 30, color: 0x6b5a4a, hat: 0x4a3a2a, quests: ['big_game'],
      lines: ['Back in my day the sky was blue.', 'Those spitters lob acid. Keep moving sideways.', 'Brutes charge in a straight line. Step aside and they hit the wall.'],
    });
  }
}
