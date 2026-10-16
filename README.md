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
| Shift | Sprint (nitro boost in a car) |
| C | Crouch · press while sprinting to slide |
| G | Throw a grenade |
| E | Backpack (inventory, level, relics, weapon upgrades) |
| F | Interact: pick up, talk, enter/exit car, open caches |
| R | Reload |
| 1–8 / wheel | Switch weapon |
| H | Use medkit |
| M | World map |

## The world

The map is 3.2 km across.

- **Haven** (south): tutorial. Learn to move, jump, crouch, grab the pistol, shoot, heal.
- **Ridgeport**: quest hub. Clear the Square, Lost Supplies and Wheels, then side quests: Relic Hunter (Tess), Pod Busters (Lin), Big Game (Harlan).
- **Outposts** (Ashfall, Dunmore, Kestrel, Ironvale, Brightwater): alien-held towns. Destroy the beacon to liberate a town and earn a new weapon or gear. Liberated towns get a resupply crate.
- **The Far Frontier** (Cinderfall east, Saltmarsh west, Hollowpeak north): outposts out in the purple alien blight. Cinderfall has the sniper rifle, Saltmarsh the minigun, Hollowpeak a big stash. Captain Reyes gives The Far Frontier quest.
- **Central Metropolis**: the Overseer boss sits under the mothership's beam. Its shield drops after you liberate two outposts.

## Systems

- **XP and levels** (up to 30): kills, quests, liberating towns, relics and drop pods give XP. Each level: +10 max health, +4% damage, +1 upgrade part.
- **Kill combos**: kills within 3.5 s of each other build a combo that multiplies XP and cores (up to 3×).
- **Drop pods**: out in the wilds, alien pods crash down near you with a strike team. Kill them all to open the loot cache.
- **25 alien relics**: golden beams of light hidden across the map. Find them all for a big reward.
- **Grenades**: up to 6. From loot, resupply crates, drop pods and quests.

Alien types: Drone, Crawler, Spitter, Brute, Stalker, Flyer, Bomber (runs at you and explodes; shoot it near friends for a chain reaction), Sentinel (rooted tower with laser bursts), and the Overseer boss.
Weapons: Pistol, Shotgun, SMG, Rifle, Longshot sniper (scope), Shredder minigun (spins up), Plasma Caster, Rocket Launcher. Each has 3 upgrade tracks, paid for with alien cores and parts.

Progress auto-saves to localStorage every 10 s, after big events, and when you pause or leave the page.

## Debug (browser console)

`game.debug.give()`, `game.debug.god()`, `game.debug.tp(x, z)`, `game.debug.skipTutorial()`, `game.debug.liberate('ashfall')`
