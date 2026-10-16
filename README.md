# Overrun — open-world alien FPS

A browser-based 3D first-person open-world game built with Three.js (loaded from a CDN). No build step, no assets: everything is procedural.

## Run

```bash
python3 serve.py
```

Then open http://localhost:8000 and click **New Game**. Click the game to capture the mouse.

## Controls

| Key | Action |
|---|---|
| WASD | Move / strafe (drive when in a car) |
| Mouse / Left click | Look / shoot |
| Right click (hold) | Aim down sights / zoom |
| Space | Jump (handbrake in a car) |
| Shift | Sprint |
| C | Crouch |
| E | Backpack (inventory, medkits, weapon upgrades) |
| F | Interact: pick up, talk, enter/exit car |
| R | Reload |
| 1–6 / wheel | Switch weapon |
| H | Use medkit |
| M | World map |

## The world

- **Haven** (south): tutorial. Learn to move, jump, crouch, grab the pistol, shoot, heal.
- **Ridgeport**: quest hub with three quests (Clear the Square, Lost Supplies, Wheels). Finishing Wheels lets you drive any car.
- **Outposts** (Ashfall, Dunmore, Kestrel, Ironvale, Brightwater): alien-held towns. Destroy the beacon to liberate a town and earn a new weapon or gear. Liberated towns get a resupply crate.
- **Central Metropolis**: the Overseer boss sits under the mothership's beam. Its shield drops after you liberate two outposts.

Alien types: Drone, Crawler, Spitter, Brute, Stalker, Flyer, and the Overseer boss.
Weapons: Pistol, Shotgun, SMG, Rifle, Plasma Caster, Rocket Launcher. Each has 3 upgrade tracks, paid for with alien cores and parts.

Progress auto-saves to localStorage after the tutorial.

## Debug (browser console)

`game.debug.give()`, `game.debug.god()`, `game.debug.tp(x, z)`, `game.debug.skipTutorial()`, `game.debug.liberate('ashfall')`
