// Synthesized sound effects via WebAudio — no asset files.
let ctx = null, master = null, noiseBuf = null, engine = null;

function ensure() {
  if (ctx) return true;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function noise(dur, freq, q, vol, type = 'lowpass', when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur);
}

function tone(freq, dur, vol, type = 'square', slide = 1, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur);
}

export const audio = {
  init() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
  shot(id) {
    switch (id) {
      case 'pistol': noise(0.12, 2600, 1, 0.6); tone(180, 0.06, 0.2, 'square', 0.4); break;
      case 'shotgun': noise(0.35, 1100, 0.7, 0.95); tone(90, 0.2, 0.3, 'square', 0.5); break;
      case 'smg': noise(0.07, 3200, 1, 0.4); break;
      case 'rifle': noise(0.11, 1800, 1, 0.6); tone(120, 0.06, 0.2, 'square', 0.5); break;
      case 'plasma': tone(900, 0.15, 0.22, 'sawtooth', 0.3); tone(1400, 0.08, 0.1, 'sine', 0.5); break;
      case 'rocket': noise(0.6, 500, 1, 0.7); tone(120, 0.4, 0.2, 'sawtooth', 0.5); break;
    }
  },
  hit() { tone(1500, 0.04, 0.12, 'square'); },
  hurt() { noise(0.15, 800, 1, 0.5); tone(140, 0.15, 0.25, 'sawtooth', 0.6); },
  pickup() { tone(880, 0.08, 0.18, 'triangle', 1.5); },
  click() { tone(400, 0.03, 0.12, 'square'); },
  reload() { noise(0.05, 4000, 2, 0.3, 'bandpass'); noise(0.06, 2500, 2, 0.3, 'bandpass', 0.35); },
  explosion(vol = 1) { noise(1.1, 400, 0.5, 1.2 * vol); tone(60, 0.8, 0.5 * vol, 'sine', 0.3); },
  alienShoot(vol = 1) { tone(520, 0.2, 0.12 * vol, 'sawtooth', 0.5); },
  alienDie(vol = 1) { tone(320, 0.3, 0.2 * vol, 'sawtooth', 0.3); noise(0.2, 1500, 1, 0.2 * vol); },
  alienAttack(vol = 1) { tone(220, 0.12, 0.15 * vol, 'square', 0.6); },
  quest() { tone(523, 0.14, 0.2, 'triangle'); tone(659, 0.14, 0.2, 'triangle', 1, 0.12); tone(784, 0.3, 0.2, 'triangle', 1, 0.24); },
  thud() { noise(0.2, 300, 1, 0.6); },
  engine(on, speed = 0) {
    if (!ctx) return;
    if (!engine) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(f).connect(g).connect(master);
      o.start();
      engine = { o, g };
    }
    engine.g.gain.setTargetAtTime(on ? 0.1 : 0, ctx.currentTime, 0.1);
    engine.o.frequency.setTargetAtTime(38 + Math.abs(speed) * 2.6, ctx.currentTime, 0.1);
  },
};
