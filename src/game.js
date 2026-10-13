// Shared game state and a tiny event bus. Systems attach themselves to `game` in main.js.
export const game = {
  state: 'title', // title | playing | paused | backpack | dialog | map | dead | victory
  time: 0,
  flags: {},
  hittables: [],
  interactables: [],
  cities: [],
  roads: [],
};

const listeners = {};
export function on(ev, fn) { (listeners[ev] ||= []).push(fn); }
export function emit(ev, ...args) {
  const l = listeners[ev];
  if (l) for (const f of l) f(...args);
}
export function removeFrom(arr, item) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}
