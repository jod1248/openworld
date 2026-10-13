import { game } from './game.js';

const KEY = 'overrun-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadSave() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function saveGame() {
  if (!game.flags.tutorialDone || game.player.dead) return;
  const P = game.player;
  const data = {
    player: { x: P.pos.x, z: P.pos.z, yaw: P.yaw, health: P.health, armor: P.armor },
    inv: game.inventory.serialize(),
    quests: game.quests.state,
    flags: game.flags,
    liberated: game.cities.filter(c => c.liberated).map(c => c.id),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}
