import { game, on, emit } from './game.js';
import { audio } from './audio.js';

// Player progression: XP and levels (more health and damage each level) and kill combos
// (quick kills in a row multiply the XP and cores you get).
const MAX_LEVEL = 30;
const COMBO_WINDOW = 3.5;   // seconds you have to get the next kill

export class Progress {
  constructor() {
    this.reset();
    on('kill', a => {
      this.combo = game.time - this.lastKill < COMBO_WINDOW ? this.combo + 1 : 1;
      this.lastKill = game.time;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const base = a.def.boss ? 2500 : a.def.cores * 6 * (1 + 0.25 * (a.level - 1));
      this.addXp(Math.round(base * this.comboMult()));
      if (this.combo >= 3) emit('combo', this.combo);
    });
    on('questDone', () => this.addXp(200, 'Quest complete'));
    on('liberated', () => this.addXp(350, 'Town liberated'));
    on('podCleared', () => this.addXp(150, 'Drop pod cleared'));
  }

  reset() {
    this.xp = 0;
    this.level = 1;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastKill = -99;
    this.relics = [];
    this.podsCleared = 0;
  }

  need() { return 120 + (this.level - 1) * 80; }
  dmgMult() { return 1 + 0.04 * (this.level - 1); }
  comboActive() { return this.combo >= 2 && game.time - this.lastKill < COMBO_WINDOW; }
  comboMult() { return this.comboActive() ? 1 + 0.25 * Math.min(this.combo - 1, 8) : 1; }
  maxHealth() { return 100 + 10 * (this.level - 1); }

  addXp(n, why) {
    if (this.level >= MAX_LEVEL) return;
    this.xp += n;
    if (why) game.hud.loot(`+${n} XP · ${why}`);
    while (this.level < MAX_LEVEL && this.xp >= this.need()) {
      this.xp -= this.need();
      this.level++;
      const P = game.player;
      P.maxHealth = this.maxHealth();
      P.health = P.maxHealth;
      game.inventory.parts += 1;
      game.hud.toast(`LEVEL ${this.level}! +10 max health · +4% damage · +1 part`, 'big');
      audio.quest();
      emit('levelUp', this.level);
    }
  }

  serialize() {
    return { xp: this.xp, level: this.level, relics: this.relics, podsCleared: this.podsCleared, bestCombo: this.bestCombo };
  }

  load(d = {}) {
    this.reset();
    Object.assign(this, { xp: d.xp || 0, level: d.level || 1, relics: d.relics || [], podsCleared: d.podsCleared || 0, bestCombo: d.bestCombo || 0 });
    game.player.maxHealth = this.maxHealth();
  }
}
