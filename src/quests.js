import { game, on, emit } from './game.js';
import { audio } from './audio.js';
import { getCity } from './world/cities.js';

export const NEST_POS = { x: 170, z: 560 };
export const WHEELS_POS = { x: 150, z: 420 };
export const GARAGE_POS = { x: -24, z: 584 };
export const SUPPLY_POS = [[-140, 470], [120, 680], [-160, 640], [90, 440], [-60, 700]];

const nearest = (list, P) => {
  let best = null, bd = Infinity;
  for (const p of list) { const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d < bd) { bd = d; best = p; } }
  return best;
};

export const QUESTS = {
  clear_square: {
    title: 'Clear the Square', giver: 'reyes',
    offer: "So Haven's training paid off. Good. A Crawler nest has taken root in the fields <b>east of town</b>. Those things breed fast. Kill the crawlers and destroy the nest before they overrun us. Do it and my old shotgun is yours.",
    progress: 'The nest is east of town. Crawlers swarm, so keep moving and keep shooting.',
    turnIn: "Nest's gone? Outstanding. Here, take the shotgun. Up close, nothing beats it.",
    objectives: [
      { type: 'kill', tag: 'nest', count: 6, text: 'Kill nest crawlers', wp: () => NEST_POS },
      { type: 'destroy', tag: 'nest', count: 1, text: 'Destroy the Crawler Nest', wp: () => NEST_POS },
    ],
    reward: { weapon: 'shotgun', cores: 30, ammo: { shells: 16 } },
    start: () => game.regions.spawnNest(),
  },
  lost_supplies: {
    title: 'Lost Supplies', giver: 'lin',
    offer: 'Our supply convoy got ambushed on the way in. <b>Five crates</b> are scattered around the outskirts of town. Bring them back and I\'ll share some <b>upgrade parts</b>. You can use those in your backpack.',
    progress: 'The crates are scattered around the outskirts. Check your minimap for the marker.',
    turnIn: "That's all of them! As promised: upgrade parts. Open your backpack (E) to spend them.",
    objectives: [
      { type: 'collect', item: 'supply', count: 5, text: 'Recover supply crates',
        wp: () => nearest(game.pickups.list.filter(p => p.kind === 'supply' && p.alive).map(p => p.pos), game.player) },
    ],
    reward: { parts: 4, cores: 25, medkits: 2, ammo: { light: 48 } },
    start: resume => {
      const st = game.quests.state.lost_supplies;
      const remaining = resume ? 5 - st.progress[0] : 5;
      SUPPLY_POS.slice(0, remaining).forEach(([x, z]) => game.pickups.spawn('supply', x, z, {}, 0.5));
      for (let i = 0; i < 2; i++) {
        const [x, z] = SUPPLY_POS[i];
        game.aliens.spawn('drone', x + 8, z + 6, 1, { tags: ['quest'] });
      }
    },
  },
  wheels: {
    title: 'Wheels', giver: 'ozzie',
    offer: "Name's Ozzie. My truck is stranded <b>northeast of town</b>, out past the fields. Some crawlers chased me off. Bring her back to my <b>garage</b> here and I'll teach you to hotwire anything with wheels.",
    progress: 'My truck is northeast of town. Bring it back here in one piece. Well, mostly one piece.',
    turnIn: 'There she is! Alright, here\'s the trick to hotwiring... You can now drive <b>any car</b> you find. Press <b>F</b> near one.',
    objectives: [
      { type: 'enterCar', tag: 'ozzie', count: 1, text: "Find Ozzie's truck", wp: () => game.vehicles.findTag('ozzie')?.pos || WHEELS_POS },
      { type: 'deliver', tag: 'ozzie', count: 1, text: 'Drive it back to the garage', pos: GARAGE_POS, radius: 12, wp: () => GARAGE_POS },
    ],
    reward: { cores: 20, flags: { carsUnlocked: true } },
    start: () => {
      if (!game.vehicles.findTag('ozzie')) game.vehicles.add(WHEELS_POS.x, WHEELS_POS.z, 2.4, { tag: 'ozzie', truck: true, color: 0xd9822b, health: 300 });
      for (let i = 0; i < 3; i++) game.aliens.spawn('crawler', WHEELS_POS.x + 10 + i * 3, WHEELS_POS.z - 6, 1, { tags: ['quest'] });
    },
  },
  outposts: {
    title: 'Break the Shield', giver: 'reyes', requires: ['clear_square', 'lost_supplies', 'wheels'],
    offer: "You've proven yourself. That mothership over the Metropolis is shielded, powered by alien <b>beacons</b> in the outlying towns. Destroy the beacons in <b>two outposts</b> and the shield will fall. Ashfall and Dunmore are closest. Liberated towns will have supplies for you. From here on, the world is yours to take back.",
    progress: 'Find an alien outpost, look for the glowing beacon in its center, and destroy it.',
    turnIn: "The shield is down! I've never seen the aliens this rattled. Rest up. The Metropolis is next.",
    objectives: [
      { type: 'liberate', count: 2, text: 'Liberate outposts (destroy beacons)',
        wp: () => nearest(game.cities.filter(c => c.hostile && !c.liberated && c.id !== 'metropolis'), game.player) },
    ],
    reward: { cores: 100, parts: 5 },
    start: () => {
      game.flags.openWorld = true;
      game.hud.toast('The world is open. Explore, liberate towns, find new weapons.', 'big');
    },
  },
  overseer: {
    title: 'Fall of the Overseer', giver: 'reyes', requires: ['outposts'],
    offer: 'The Overseer commands this invasion from the <b>heart of the Metropolis</b>, right under that beam. Upgrade your weapons, stock up, and end this.',
    progress: 'The Overseer is in the central plaza of the Metropolis. Bring your best guns.',
    turnIn: 'You did it. The mothership is retreating. The world owes you everything.',
    objectives: [
      { type: 'kill', tag: 'boss', count: 1, text: 'Defeat the Overseer', wp: () => ({ x: 0, z: 0 }) },
    ],
    reward: { cores: 500, parts: 10 },
  },
};

export class QuestSystem {
  constructor() {
    this.reset();
    on('kill', a => this.event('kill', o => a.tags.includes(o.tag) || a.type === o.tag || (o.tag === 'boss' && a.def.boss)));
    on('destroyed', tag => this.event('destroy', o => o.tag === tag));
    on('collect', item => this.event('collect', o => o.item === item));
    on('enterCar', car => this.event('enterCar', o => car.tag === o.tag));
    on('liberated', () => this.refreshLiberate());
  }

  reset() {
    this.state = {};
    for (const id in QUESTS) this.state[id] = { status: 'locked', progress: QUESTS[id].objectives.map(() => 0) };
  }

  event(type, match) {
    for (const id in QUESTS) {
      const st = this.state[id];
      if (st.status !== 'active') continue;
      QUESTS[id].objectives.forEach((o, i) => {
        if (o.type === type && match(o) && st.progress[i] < o.count) {
          st.progress[i]++;
          if (st.progress[i] >= o.count) game.hud.toast(`✔ ${o.text}`, 'quest');
        }
      });
      this.checkDone(id);
    }
  }

  refreshLiberate() {
    const n = game.cities.filter(c => c.liberated && c.id !== 'metropolis').length;
    for (const id in QUESTS) {
      const st = this.state[id];
      if (st.status !== 'active') continue;
      QUESTS[id].objectives.forEach((o, i) => { if (o.type === 'liberate') st.progress[i] = Math.min(o.count, n); });
      this.checkDone(id);
    }
  }

  checkDone(id) {
    const st = this.state[id], def = QUESTS[id];
    if (st.status !== 'active') return;
    if (def.objectives.every((o, i) => st.progress[i] >= o.count)) {
      st.status = 'ready';
      const giver = game.npcs.get(def.giver);
      game.hud.toast(`${def.title}: complete! Return to ${giver.name}.`, 'quest');
      audio.quest();
      game.save();
    }
  }

  canStart(id) {
    const st = this.state[id], def = QUESTS[id];
    return st.status === 'locked' && game.flags.tutorialDone && (def.requires || []).every(r => this.state[r].status === 'done');
  }

  start(id) {
    this.state[id].status = 'active';
    QUESTS[id].start?.(false);
    game.hud.toast(`New quest: ${QUESTS[id].title}`, 'quest');
    audio.quest();
    this.refreshLiberate();
    game.save();
  }

  complete(id) {
    this.state[id].status = 'done';
    game.inventory.grant(QUESTS[id].reward);
    if (id === 'wheels') game.hud.toast('You can now drive any vehicle!', 'big');
    emit('questDone', id);
    game.save();
  }

  update() {
    const P = game.player;
    for (const id in QUESTS) {
      const st = this.state[id];
      if (st.status !== 'active') continue;
      QUESTS[id].objectives.forEach((o, i) => {
        if (o.type === 'deliver' && st.progress[i] < o.count && P.inCar?.tag === o.tag
          && Math.hypot(P.pos.x - o.pos.x, P.pos.z - o.pos.z) < o.radius) {
          st.progress[i] = o.count;
          game.hud.toast(`✔ ${o.text}`, 'quest');
          this.checkDone(id);
        }
      });
    }
  }

  // Where the player should go next
  waypoint() {
    if (game.tutorial.active) return game.tutorial.waypoint();
    for (const id in QUESTS) {
      const st = this.state[id], def = QUESTS[id];
      if (st.status === 'ready') { const n = game.npcs.get(def.giver); return { x: n.pos.x, z: n.pos.z }; }
      if (st.status === 'active') {
        for (let i = 0; i < def.objectives.length; i++) {
          const o = def.objectives[i];
          if (st.progress[i] < o.count && o.wp) { const p = o.wp(); if (p) return { x: p.x, z: p.z }; }
        }
      }
    }
    // Nothing active: point to a quest giver with something to offer
    for (const id in QUESTS) {
      if (this.canStart(id)) { const n = game.npcs.get(QUESTS[id].giver); return { x: n.pos.x, z: n.pos.z }; }
    }
    return null;
  }

  npcMarker(npc) {
    let mark = null;
    for (const id of npc.quests) {
      if (this.state[id].status === 'ready') return '?';
      if (this.canStart(id)) mark = '!';
    }
    return mark;
  }

  talk(npc) {
    const close = () => game.ui.closeDialog();
    for (const id of npc.quests) {
      const st = this.state[id], def = QUESTS[id];
      if (st.status === 'ready') {
        return game.ui.openDialog(npc.name, def.turnIn, [{ label: 'Claim reward', primary: true, fn: () => { this.complete(id); close(); } }]);
      }
      if (st.status === 'active') return game.ui.openDialog(npc.name, def.progress, [{ label: 'On it', fn: close }]);
      if (this.canStart(id)) {
        return game.ui.openDialog(npc.name, `<b style="color:#ffd34a">${def.title}</b><br>${def.offer}`, [
          { label: 'Accept', primary: true, fn: () => { this.start(id); close(); } },
          { label: 'Not now', fn: close },
        ]);
      }
    }
    let line = npc.nextLine();
    if (!game.flags.tutorialDone && npc.id !== 'okafor') line = 'Finish your training in Haven first, recruit.';
    game.ui.openDialog(npc.name, line, [{ label: 'Bye', fn: close }]);
  }

  trackerData() {
    const out = [];
    for (const id in QUESTS) {
      const st = this.state[id], def = QUESTS[id];
      if (st.status !== 'active' && st.status !== 'ready') continue;
      out.push({
        title: def.title,
        ready: st.status === 'ready',
        giver: game.npcs.get(def.giver).name,
        objs: def.objectives.map((o, i) => ({ text: o.text, p: st.progress[i], n: o.count })),
      });
    }
    return out;
  }

  load(state) {
    for (const id in state) if (this.state[id]) this.state[id] = state[id];
    for (const id in QUESTS) if (this.state[id].status === 'active') QUESTS[id].start?.(true);
    if (this.state.wheels.status === 'done' && !game.vehicles.findTag('ozzie')) {
      game.vehicles.add(GARAGE_POS.x, GARAGE_POS.z, 0, { tag: 'ozzie', truck: true, color: 0xd9822b, health: 300 });
    }
    this.refreshLiberate();
  }
}

export { getCity };
