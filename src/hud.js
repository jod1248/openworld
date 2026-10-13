import { game } from './game.js';
import { WEAPONS, weaponStats } from './weapons.js';
import { cityAt } from './world/cities.js';

const $ = id => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), hpFill: $('hp-fill'), hpText: $('hp-text'), armorFill: $('armor-fill'),
      cores: $('cores'), parts: $('parts'), medkits: $('medkits'), wname: $('weapon-name'), ammo: $('ammo'),
      prompt: $('prompt'), toasts: $('toasts'), loot: $('loot-feed'), tracker: $('quest-tracker'),
      tut: $('tutorial'), tutText: $('tut-text'), tutStep: $('tut-step'), hit: $('hitmarker'), vignette: $('vignette'),
      car: $('car-info'), carSpeed: $('car-speed'), carFill: $('car-fill'), boss: $('boss-bar'), bossFill: $('boss-fill'),
      bossShield: $('boss-shield'), location: $('location'), weaponInfo: $('weapon-info'), crosshair: $('crosshair'),
    };
    this.mm = $('minimap').getContext('2d');
    this.big = $('bigmap').getContext('2d');
    this.hitT = 0;
    this.dmgFlash = 0;
    this.toastKeys = {};
    this.lastPrompt = null;
    this.lastTracker = '';
    this.trackerT = 0;
    this.waypoint = null;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  toast(msg, kind = '', key = null) {
    if (key) {
      const now = performance.now();
      if (this.toastKeys[key] && now - this.toastKeys[key] < 4000) return;
      this.toastKeys[key] = now;
    }
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.innerHTML = msg;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => { d.style.opacity = '0'; }, kind === 'big' ? 4500 : 3200);
    setTimeout(() => d.remove(), kind === 'big' ? 5000 : 3700);
  }

  loot(text) {
    const d = document.createElement('div');
    d.className = 'loot';
    d.textContent = text;
    this.el.loot.appendChild(d);
    while (this.el.loot.children.length > 6) this.el.loot.firstChild.remove();
    setTimeout(() => { d.style.opacity = '0'; }, 1800);
    setTimeout(() => d.remove(), 2400);
  }

  setPrompt(html) {
    if (html === this.lastPrompt) return;
    this.lastPrompt = html;
    this.el.prompt.classList.toggle('hidden', !html);
    if (html) this.el.prompt.innerHTML = html;
  }

  setTutorial(html, step, total) {
    this.el.tut.classList.toggle('hidden', !html);
    if (html) {
      this.el.tutText.innerHTML = html;
      this.el.tutStep.textContent = `Training ${step} / ${total}`;
    }
  }

  hitMarker(kill) {
    this.hitT = kill ? 0.25 : 0.1;
    this.el.hit.className = kill ? 'show kill' : 'show';
  }

  flashDamage(amount) { this.dmgFlash = Math.min(0.8, this.dmgFlash + 0.2 + amount / 40); }

  update(dt) {
    const P = game.player, inv = game.inventory, el = this.el;
    el.hpFill.style.width = (P.health / P.maxHealth) * 100 + '%';
    el.hpText.textContent = Math.ceil(P.health);
    el.armorFill.style.width = (P.armor / P.maxArmor) * 100 + '%';
    el.cores.textContent = inv.cores;
    el.parts.textContent = inv.parts;
    el.medkits.textContent = inv.medkits;

    const id = game.weapons.current;
    el.weaponInfo.classList.toggle('hidden', !!P.inCar);
    el.crosshair.classList.toggle('hidden', !!P.inCar);
    if (id) {
      const ws = inv.weapons[id];
      el.wname.textContent = WEAPONS[id].name + (game.weapons.reloadT > 0 ? ' — reloading' : '');
      el.ammo.innerHTML = `${ws.mag} <small>/ ${inv.ammo[WEAPONS[id].ammo]}</small>`;
    } else {
      el.wname.textContent = 'Unarmed';
      el.ammo.innerHTML = '';
    }

    el.car.classList.toggle('hidden', !P.inCar);
    if (P.inCar) {
      el.carSpeed.textContent = Math.round(Math.abs(P.inCar.speed()) * 3.6) + ' km/h';
      el.carFill.style.width = (P.inCar.health / P.inCar.maxHealth) * 100 + '%';
    }

    const boss = game.regions.boss;
    const showBoss = boss && boss.alive && Math.hypot(boss.pos.x - P.pos.x, boss.pos.z - P.pos.z) < 160;
    el.boss.classList.toggle('hidden', !showBoss);
    if (showBoss) {
      el.bossFill.style.width = (boss.hp / boss.maxHp) * 100 + '%';
      el.bossShield.textContent = game.flags.shieldDown ? '' : '· SHIELDED';
    }

    this.hitT -= dt;
    if (this.hitT <= 0) el.hit.className = '';
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.5);
    const low = P.health < 30 ? 0.25 + Math.sin(performance.now() * 0.006) * 0.1 : 0;
    el.vignette.style.opacity = Math.max(this.dmgFlash, low);

    this.trackerT -= dt;
    if (this.trackerT <= 0) {
      this.trackerT = 0.25;
      this.waypoint = game.quests.waypoint();
      this.renderTracker();
      const c = cityAt(P.pos.x, P.pos.z, 10);
      el.location.textContent = c
        ? c.name + (c.hostile ? (c.liberated ? ' · liberated' : ' · alien-held') : '')
        : 'Wilderness';
    }
    this.drawMinimap();
  }

  renderTracker() {
    let html = '';
    const wp = this.waypoint, P = game.player;
    const dist = wp ? ` <span style="color:#999">${Math.round(Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z))}m</span>` : '';
    for (const q of game.quests.trackerData()) {
      html += `<div class="qt"><div class="qt-title">${q.title}</div>`;
      if (q.ready) html += `<div class="qt-ready">Return to ${q.giver}</div>`;
      else for (const o of q.objs) html += `<div class="qt-obj ${o.p >= o.n ? 'done' : ''}">${o.text}${o.n > 1 ? ` (${o.p}/${o.n})` : ''}</div>`;
      html += '</div>';
    }
    if (!html && game.flags.tutorialDone && wp) html = '<div class="qt"><div class="qt-title">New work available</div><div class="qt-obj">Find the quest giver (yellow marker)</div></div>';
    if (html && wp) html = html.replace('</div>', dist + '</div>');
    if (html !== this.lastTracker) { this.el.tracker.innerHTML = html; this.lastTracker = html; }
  }

  cityColor(c, alpha) {
    if (!c.hostile) return `rgba(120,200,120,${alpha})`;
    if (c.liberated) return `rgba(90,150,255,${alpha})`;
    return `rgba(230,70,90,${alpha})`;
  }

  drawMinimap() {
    const ctx = this.mm, P = game.player, R = 100, scale = 0.9;
    ctx.clearRect(0, 0, 200, 200);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(25,20,30,0.78)';
    ctx.fillRect(0, 0, 200, 200);
    ctx.translate(R, R);
    ctx.rotate(P.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-P.pos.x, -P.pos.z);
    ctx.strokeStyle = 'rgba(150,150,150,0.8)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (const r of game.roads) { ctx.moveTo(r.ax, r.az); ctx.lineTo(r.bx, r.bz); }
    ctx.stroke();
    for (const c of game.cities) {
      ctx.fillStyle = this.cityColor(c, 0.3);
      ctx.fillRect(c.x - c.size, c.z - c.size, c.size * 2, c.size * 2);
    }
    const dot = (x, z, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, z, r / scale, 0, Math.PI * 2); ctx.fill(); };
    for (const s of game.regions.structures) if (s.alive) dot(s.pos.x, s.pos.z, 5, '#ff3cd8');
    for (const c of game.vehicles.cars) if (!c.destroyed) dot(c.pos.x, c.pos.z, 2.2, c.tag ? '#ff9a3a' : '#bbb');
    for (const n of game.npcs.list) dot(n.pos.x, n.pos.z, 3, game.quests.npcMarker(n) ? '#ffd34a' : '#fff');
    for (const a of game.aliens.list) if (a.alive) dot(a.pos.x, a.pos.z, a.def.boss ? 6 : 2.6, '#ff3b3b');
    ctx.restore();

    const wp = this.waypoint;
    if (wp) {
      const dx = (wp.x - P.pos.x) * scale, dz = (wp.z - P.pos.z) * scale;
      const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
      let rx = dx * c - dz * s, ry = dx * s + dz * c;
      const d = Math.hypot(rx, ry);
      if (d > 90) { rx = (rx / d) * 90; ry = (ry / d) * 90; }
      ctx.save();
      ctx.translate(R + rx, R + ry);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd34a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(R, R - 8); ctx.lineTo(R + 6, R + 6); ctx.lineTo(R, R + 3); ctx.lineTo(R - 6, R + 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawBigMap() {
    const ctx = this.big, W = 700, s = W / 2100, P = game.player;
    const X = x => W / 2 + x * s, Z = z => W / 2 + z * s;
    ctx.fillStyle = '#2a2632';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const r of game.roads) { ctx.moveTo(X(r.ax), Z(r.az)); ctx.lineTo(X(r.bx), Z(r.bz)); }
    ctx.stroke();
    ctx.textAlign = 'center';
    for (const c of game.cities) {
      ctx.fillStyle = this.cityColor(c, 0.45);
      ctx.fillRect(X(c.x - c.size), Z(c.z - c.size), c.size * 2 * s, c.size * 2 * s);
      ctx.strokeStyle = this.cityColor(c, 0.9);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X(c.x - c.size), Z(c.z - c.size), c.size * 2 * s, c.size * 2 * s);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(c.name, X(c.x), Z(c.z - c.size) - 6);
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#ccc';
      const status = !c.hostile ? 'safe' : c.liberated ? 'liberated' : `alien-held · threat ${c.level}`;
      ctx.fillText(status, X(c.x), Z(c.z + c.size) + 14);
    }
    const wp = game.quests.waypoint();
    if (wp) {
      ctx.save();
      ctx.translate(X(wp.x), Z(wp.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd34a';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(X(P.pos.x), Z(P.pos.z));
    ctx.rotate(-P.yaw);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui';
    [['rgba(120,200,120,0.9)', 'Safe town'], ['rgba(230,70,90,0.9)', 'Alien-held'], ['rgba(90,150,255,0.9)', 'Liberated'], ['#ffd34a', 'Objective']]
      .forEach(([c, t], i) => { ctx.fillStyle = c; ctx.fillRect(12, 12 + i * 18, 12, 12); ctx.fillStyle = '#ddd'; ctx.fillText(t, 30, 22 + i * 18); });
  }
}
