import { game, emit } from './game.js';
import { WEAPONS, WEAPON_ORDER, AMMO_INFO, UPGRADE_TRACKS, GRENADE, weaponStats, upgradeCost } from './weapons.js';
import { audio } from './audio.js';

export class Inventory {
  constructor() {
    this.reset();
    document.getElementById('backpack').addEventListener('click', e => {
      const b = e.target.closest('button[data-action]');
      if (!b || b.disabled) return;
      const { action, id, track } = b.dataset;
      if (action === 'upgrade') this.upgrade(id, track);
      else if (action === 'equip') game.weapons.equip(id);
      else if (action === 'medkit') this.useMedkit();
      this.renderBackpack();
    });
  }

  reset() {
    this.weapons = {};
    this.ammo = { light: 0, shells: 0, heavy: 0, cells: 0, rockets: 0, sniper: 0 };
    this.grenades = 0;
    this.cores = 0;
    this.parts = 0;
    this.medkits = 0;
  }

  has(id) { return !!this.weapons[id]; }
  owned() { return WEAPON_ORDER.filter(id => this.weapons[id]); }

  addWeapon(id, silent = false) {
    const def = WEAPONS[id];
    if (this.weapons[id]) { this.addAmmo(def.ammo, def.mag * 2); return; }
    this.weapons[id] = { mag: def.mag, up: { dmg: 0, rate: 0, mag: 0 } };
    this.addAmmo(def.ammo, def.mag * 3);
    if (!silent) {
      game.hud.toast(`New weapon: ${def.name}`, 'big');
      game.weapons.equip(id);
    }
    emit('weapon', id);
  }

  addGrenades(n) { this.grenades = Math.min(GRENADE.max, this.grenades + n); }

  addAmmo(type, n) { this.ammo[type] = Math.min(AMMO_INFO[type].max, this.ammo[type] + n); }

  useMedkit() {
    const p = game.player;
    if (this.medkits <= 0) { game.hud.toast('No medkits', 'warn', 'med'); return false; }
    if (p.health >= p.maxHealth) { game.hud.toast('Already at full health', 'warn', 'med'); return false; }
    this.medkits--;
    p.heal(50);
    audio.pickup();
    game.hud.loot('+50 Health');
    emit('medkit');
    return true;
  }

  upgrade(id, track) {
    const w = this.weapons[id];
    if (!w) return;
    const lvl = w.up[track];
    if (lvl >= 3) return;
    const cost = upgradeCost(id, lvl);
    if (this.cores < cost.cores || this.parts < cost.parts) { audio.click(); return; }
    this.cores -= cost.cores;
    this.parts -= cost.parts;
    w.up[track]++;
    audio.quest();
    emit('upgrade', id, track);
  }

  grant(r = {}) {
    const bits = [];
    if (r.cores) { this.cores += r.cores; bits.push(`${r.cores} cores`); }
    if (r.parts) { this.parts += r.parts; bits.push(`${r.parts} parts`); }
    if (r.medkits) { this.medkits += r.medkits; bits.push(`${r.medkits} medkits`); }
    if (r.grenades) { this.addGrenades(r.grenades); bits.push(`${r.grenades} grenades`); }
    if (r.armor) { const P = game.player; P.armor = Math.min(P.maxArmor, P.armor + r.armor); bits.push('armor vest'); }
    if (r.ammo) for (const k in r.ammo) this.addAmmo(k, r.ammo[k]);
    if (r.flags) Object.assign(game.flags, r.flags);
    if (r.weapon) this.addWeapon(r.weapon);
    if (bits.length) game.hud.toast('Reward: ' + bits.join(', '), 'quest');
  }

  serialize() {
    return { weapons: this.weapons, ammo: this.ammo, cores: this.cores, parts: this.parts, medkits: this.medkits, grenades: this.grenades };
  }

  load(d) {
    this.reset();
    Object.assign(this.weapons, d.weapons || {});
    Object.assign(this.ammo, d.ammo || {});
    this.cores = d.cores || 0;
    this.parts = d.parts || 0;
    this.medkits = d.medkits || 0;
    this.grenades = d.grenades || 0;
  }

  renderBackpack() {
    const P = game.player;
    const row = (label, value, extra = '') => `<div class="bp-row"><span>${label}</span><span>${value} ${extra}</span></div>`;
    let left = '<h3>Status</h3>';
    left += row('Health', `${Math.ceil(P.health)} / ${P.maxHealth}`);
    left += row('Armor', `${Math.ceil(P.armor)} / ${P.maxArmor}`);
    left += row('<span class="core-ico"></span> Alien cores', this.cores);
    left += row('<span class="part-ico"></span> Upgrade parts', this.parts);
    left += row('<span class="med-ico">+</span> Medkits', this.medkits,
      `<button data-action="medkit" ${this.medkits > 0 && P.health < P.maxHealth ? '' : 'disabled'}>Use</button>`);
    left += row('<span class="nade-ico"></span> Grenades (G)', `${this.grenades} / ${GRENADE.max}`);
    if (game.progress) {
      const pr = game.progress;
      left += row('Level', `${pr.level} <span class="hint">(${pr.xp} / ${pr.need()} XP)</span>`);
      left += row('Alien relics', `${pr.relics.length} / 25`);
      left += row('Drop pods cleared', pr.podsCleared);
    }
    left += '<h3>Ammo</h3>';
    for (const k in AMMO_INFO) left += row(AMMO_INFO[k].name, `${this.ammo[k]} / ${AMMO_INFO[k].max}`);
    left += '<h3>Quests</h3>';
    const qs = game.quests.trackerData();
    if (game.tutorial.active) left += '<div class="bp-row"><span>Training in Haven</span></div>';
    if (!qs.length && !game.tutorial.active) left += '<div class="bp-row"><span class="hint">No active quests. Look for <b style="color:#ffd34a">!</b> above NPCs.</span></div>';
    for (const q of qs) left += `<div class="bp-row"><span>${q.title}</span><span class="hint">${q.ready ? 'Turn in' : 'Active'}</span></div>`;
    document.getElementById('bp-left').innerHTML = left;

    let right = '<h3>Weapons — spend cores &amp; parts on upgrades</h3><div class="wcards">';
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id], w = this.weapons[id];
      if (!w) {
        right += `<div class="wcard locked"><div class="wname">??? <span class="hint">locked</span></div><div class="wstats">${def.hint}</div></div>`;
        continue;
      }
      const st = weaponStats(id, w.up);
      const eq = game.weapons.current === id;
      right += `<div class="wcard ${eq ? 'equipped' : ''}"><div class="wname">${def.name}
        ${eq ? '<span class="tag">EQUIPPED</span>' : `<button data-action="equip" data-id="${id}">Equip</button>`}</div>
        <div class="wstats">Damage ${Math.round(st.dmg)}${def.pellets ? ' ×' + def.pellets : ''}${def.projectile?.splash ? ' (splash)' : ''}
        · ${Math.round(60 / st.interval)} rpm · Mag ${st.mag} · ${AMMO_INFO[def.ammo].name}</div>`;
      for (const t in UPGRADE_TRACKS) {
        const lvl = w.up[t];
        const pips = '●'.repeat(lvl) + '○'.repeat(3 - lvl);
        let btn;
        if (lvl >= 3) btn = '<span class="hint">MAX</span>';
        else {
          const c = upgradeCost(id, lvl);
          const ok = this.cores >= c.cores && this.parts >= c.parts;
          btn = `<button data-action="upgrade" data-id="${id}" data-track="${t}" ${ok ? '' : 'disabled'}>Upgrade · ${c.cores}◆ ${c.parts}▣</button>`;
        }
        right += `<div class="uprow"><span>${UPGRADE_TRACKS[t]}</span><span class="pips">${pips}</span>${btn}</div>`;
      }
      right += '</div>';
    }
    right += '</div>';
    document.getElementById('bp-right').innerHTML = right;
  }
}
