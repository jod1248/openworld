const keys = new Set();
const pressed = new Set();
const keyHandlers = [];

export const input = {
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  clicked: false,
  wheel: 0,
  locked: false,
  down(code) { return keys.has(code); },
  pressed(code) { return pressed.has(code); },
  onKey(fn) { keyHandlers.push(fn); },
  endFrame() {
    pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.clicked = false;
  },
  clear() { keys.clear(); this.mouseDown = false; },
};

window.addEventListener('keydown', e => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    pressed.add(e.code);
    for (const h of keyHandlers) h(e.code);
  }
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => input.clear());
document.addEventListener('mousemove', e => {
  if (!input.locked) return;
  input.mouseDX += e.movementX;
  input.mouseDY += e.movementY;
});
document.addEventListener('mousedown', e => {
  if (input.locked && e.button === 0) { input.mouseDown = true; input.clicked = true; }
});
document.addEventListener('mouseup', e => { if (e.button === 0) input.mouseDown = false; });
document.addEventListener('wheel', e => { if (input.locked) input.wheel += Math.sign(e.deltaY); }, { passive: true });
document.addEventListener('pointerlockchange', () => {
  input.locked = !!document.pointerLockElement;
  if (!input.locked) input.mouseDown = false;
});
