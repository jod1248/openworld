import * as THREE from 'three';
import { game, on } from './game.js';
import { input } from './input.js';
import { World, buildEnvironment } from './world/world.js';
import { buildCities, getCity } from './world/cities.js';
import { buildNature } from './world/nature.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { WeaponSystem, WEAPON_ORDER, AMMO_INFO } from './weapons.js';
import { Projectiles } from './projectiles.js';
import { AlienManager } from './aliens.js';
import { Pickups } from './pickups.js';
import { Vehicles } from './vehicles.js';
import { NPCManager } from './npc.js';
import { QuestSystem } from './quests.js';
import { Regions } from './regions.js';
import { Tutorial } from './tutorial.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';
import { createComposer } from './post.js';
import { Progress } from './progress.js';
import { WorldEvents } from './events.js';
import { hasSave, loadSave, saveGame, clearSave } from './save.js';

const $ = id => document.getElementById(id);

// --- Renderer & scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 3400);
camera.rotation.order = 'YXZ';
scene.add(camera);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});
const post = createComposer(renderer, scene, camera);

Object.assign(game, { scene, camera, renderer });
game.save = saveGame;
game.hud = new HUD();
game.world = new World(scene);
game.env = buildEnvironment(scene);
game.effects = new Effects(scene);
game.cities = buildCities(game.world, scene);
game.nature = buildNature(game.world, scene, game.cities, game.roads);
game.player = new Player();
game.inventory = new Inventory();
game.weapons = new WeaponSystem(camera);
game.projectiles = new Projectiles(scene);
game.aliens = new AlienManager(scene);
game.pickups = new Pickups(scene);
game.vehicles = new Vehicles();
game.npcs = new NPCManager();
game.quests = new QuestSystem();
game.regions = new Regions();
game.tutorial = new Tutorial();
game.progress = new Progress();
game.events = new WorldEvents();
game.npcs.init();
game.vehicles.init();
game.regions.init();
game.events.init();
// Buildings, walls, cars and people cast and catch shadows (glowing / see-through things don't)
scene.traverse(o => {
  if (!o.isMesh || o.isInstancedMesh) return;
  const m = o.material;
  if (m.transparent || m.fog === false || m.isShaderMaterial || m.isMeshBasicMaterial) return;
  o.castShadow = o.receiveShadow = true;
});
camera.traverse(o => { o.castShadow = o.receiveShadow = false; }); // not the gun in your hands

// --- Menus & state ---
const overlays = ['title', 'pause', 'death', 'victory', 'backpack', 'map-overlay', 'dialog'];
function hideOverlays() { for (const id of overlays) $(id).classList.add('hidden'); }

function lock() {
  try {
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => { if (game.state === 'playing') showPause(); });
  } catch { showPause(); }
}

function resume() {
  hideOverlays();
  game.hud.show(true);
  game.state = 'playing';
  input.clear();
  lock();
}

function showPause() {
  saveGame();
  game.state = 'paused';
  hideOverlays();
  $('pause').classList.remove('hidden');
}

function openMenu(state, id) {
  game.state = state;
  hideOverlays();
  game.hud.setPrompt(null);
  $(id).classList.remove('hidden');
  document.exitPointerLock();
}

game.ui = {
  resume,
  openDialog(name, html, options) {
    openMenu('dialog', 'dialog');
    $('dlg-name').textContent = name;
    $('dlg-text').innerHTML = html;
    const opts = $('dlg-opts');
    opts.innerHTML = '';
    for (const o of options) {
      const b = document.createElement('button');
      b.innerHTML = o.label;
      if (o.primary) b.className = 'primary';
      b.onclick = o.fn;
      opts.appendChild(b);
    }
  },
  closeDialog() { resume(); },
  victory() {
    openMenu('victory', 'victory');
  },
};

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.state === 'playing') showPause();
});
document.addEventListener('pointerlockerror', () => { if (game.state === 'playing') showPause(); });

input.onKey(code => {
  const s = game.state;
  if (code === 'KeyE') {
    if (s === 'playing' && !game.player.inCar) { game.inventory.renderBackpack(); openMenu('backpack', 'backpack'); }
    else if (s === 'backpack') resume();
  } else if (code === 'KeyM') {
    if (s === 'playing') { game.hud.drawBigMap(); openMenu('map', 'map-overlay'); }
    else if (s === 'map') resume();
  } else if (code === 'Escape') {
    if (s === 'backpack' || s === 'map' || s === 'dialog') resume();
  } else if (code === 'KeyH' && s === 'playing') {
    game.inventory.useMedkit();
  }
});

$('btn-resume').onclick = resume;
$('pause').addEventListener('click', e => { if (e.target.id === 'pause') resume(); });
$('btn-explore').onclick = resume;
$('btn-respawn').onclick = () => { respawn(); resume(); };
$('btn-new').onclick = () => { audio.init(); newGame(); resume(); };
$('btn-continue').onclick = () => { audio.init(); continueGame(); resume(); };
if (hasSave()) $('btn-continue').classList.remove('hidden');
$('loading').classList.add('hidden');

function newGame() {
  clearSave();
  const H = getCity('haven');
  game.player.spawn(H.start.x, H.start.z, 0);
  game.tutorial.start();
}

function continueGame() {
  const d = loadSave();
  if (!d) return newGame();
  Object.assign(game.flags, d.flags);
  game.tutorial.skip();
  game.inventory.load(d.inv);
  for (const id of d.liberated || []) game.regions.liberate(getCity(id), true);
  if (game.flags.bossDead) { game.env.ship.visible = false; }
  game.quests.load(d.quests);
  game.progress.load(d.progress);
  game.events.syncRelics();
  const P = game.player;
  P.spawn(d.player.x, d.player.z, d.player.yaw);
  P.health = Math.min(P.maxHealth, Math.max(30, d.player.health));
  P.armor = d.player.armor || 0;
  const owned = game.inventory.owned();
  if (owned.length) game.weapons.equip(owned[owned.length - 1]);
}

function respawn() {
  const P = game.player;
  if (P.inCar) game.vehicles.exit(true);
  const safe = game.cities.filter(c => (c.safe && (c.id !== 'haven' || !game.flags.tutorialDone)) || c.liberated);
  let best = safe[0], bd = Infinity;
  for (const c of safe) {
    const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  P.spawn(best.x + 2, best.z + 12, 0);
  P.health = P.maxHealth;
  game.projectiles.clear();
  game.aliens.despawnWhere(a => a.tags.includes('wild') || Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) < 40);
}

// Save straight away after anything important, and whenever you pause or leave the page
for (const ev of ['questDone', 'liberated', 'weapon', 'upgrade', 'collect', 'exitCar']) on(ev, () => saveGame());
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state !== 'title') saveGame(); });
window.addEventListener('pagehide', () => { if (game.state !== 'title') saveGame(); });

on('playerDied', () => {
  const lost = Math.floor(game.inventory.cores * 0.2);
  game.inventory.cores -= lost;
  $('death-text').textContent = lost ? `You dropped ${lost} cores.` : 'Get back out there.';
  setTimeout(() => openMenu('dead', 'death'), 600);
});

// --- Interaction ---
function updateInteract() {
  const P = game.player;
  if (P.inCar) {
    game.hud.setPrompt('<b>F</b> exit vehicle · <b>Space</b> handbrake');
    return;
  }
  let best = null, bd = Infinity;
  for (const it of game.interactables) {
    if (it.enabled && !it.enabled()) continue;
    const d = Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z);
    if (d < it.range && d < bd) { best = it; bd = d; }
  }
  game.hud.setPrompt(best ? `<b>F</b>${best.label()}` : null);
  if (best && input.pressed('KeyF')) { input.consume('KeyF'); best.interact(); }
}

// --- Debug helpers (console) ---
window.game = game;
game.debug = {
  tp(x, z) { const P = game.player; if (P.inCar) game.vehicles.exit(true); P.pos.set(x, 0, z); },
  give() {
    for (const id of WEAPON_ORDER) game.inventory.addWeapon(id, true);
    for (const k in AMMO_INFO) game.inventory.ammo[k] = AMMO_INFO[k].max;
    game.inventory.cores += 5000; game.inventory.parts += 100; game.inventory.medkits += 10; game.inventory.addGrenades(6);
    game.weapons.equip('rifle');
  },
  god() { game.player.god = !game.player.god; return game.player.god; },
  skipTutorial() { game.tutorial.skip(); if (!game.inventory.has('pistol')) game.inventory.addWeapon('pistol'); },
  unlockCars() { game.flags.carsUnlocked = true; },
  liberate(id) { game.regions.liberate(getCity(id)); },
};

// --- Main loop ---
const clock = new THREE.Clock();
let saveT = 10;
camera.position.set(0, 40, 960);
camera.lookAt(0, 30, 0);

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (game.state === 'playing') {
    game.time += dt;
    const P = game.player;
    if (!P.inCar && !P.dead) P.update(dt);
    game.vehicles.update(dt);
    if (P.inCar) game.vehicles.updateCamera(camera, dt);
    else P.updateCamera(camera, dt);
    if (!P.dead) game.weapons.update(dt);
    game.aliens.update(dt);
    game.projectiles.update(dt);
    game.pickups.update(dt);
    game.npcs.update(dt);
    game.regions.update(dt);
    game.quests.update(dt);
    game.tutorial.update(dt);
    game.effects.update(dt);
    game.events.update(dt);
    if (!P.dead) updateInteract();
    saveT -= dt;
    if (saveT <= 0) { saveT = 10; saveGame(); }
  } else if (game.state === 'title') {
    camera.position.x = Math.sin(performance.now() * 0.00005) * 200;
    camera.lookAt(0, 60, 0);
  }
  game.env.update(dt, camera.position);
  game.nature.update(dt);
  if (game.state !== 'title') game.hud.update(dt);
  post.render(dt);
  input.endFrame();
}
frame();
