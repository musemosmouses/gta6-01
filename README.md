[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/musemosmouses/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/musemosmouses/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Surya Bay

An original open-world crime game for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 USDC escrowed, top 100 paid). A sun-soaked coastal city, built from scratch in three.js — no Rockstar assets, no real places, no real people.

You are Raka, new in Surya Bay. Steal cars, run jobs, dodge the Bay Police, and pull the Bay Heist.

## Play it

Serve the repo root, then open http://localhost:8080:

```sh
node serve.ts
```

No build step, no network at runtime — plain static files plus one vendored three.js build under `game/vendor/`.

## Controls

- **WASD** move / drive · **mouse** look · **E** enter or exit a car · **F** punch · **Q** switch weapon · **left click** shoot · **Space** handbrake · **P** pause · **M** mute

## What's in the city

- **On foot and by car** — a 12×12-block procedural city with a beach, pier and lighthouse; every parked or traffic car can be stolen (stealing adds heat).
- **Traffic and pedestrians** — cars follow the road loops, people stroll the sidewalks, flee gunfire, and go down when hit.
- **Wanted level and police** — 0–5 stars, police cars that chase and ram, cops on foot who grab you; hide to cool off, or pay $100 at the spray garage for a fresh paint job and a clean record.
- **Five chained story missions** — Borrowed Wheels, Package Run, Taxi Rush, The Getaway, and the Bay Heist — plus repeatable taxi and delivery side jobs once the story is done.
- **Combat and progression** — pistol and fists, health and armour pickups, cash, and a localStorage save (`Surya Bay` start screen offers Continue).
- **Deterministic** — `?seed=N` rebuilds the same city, traffic and mission markers; `?shot=` stages the four screenshot scenes.

## Files

- `game/index.html` — the page, HUD and overlays; `game/src/` — one module per system (`main`, `city`, `player`, `vehicles`, `traffic`, `pedestrians`, `police`, `missions`, `hud`, `audio`, `save`, `input`, `random`).
- `game/vendor/three.min.js` — vendored three.js r160.
- `screenshots/` — the four staged captures (`?shot=chase|street|drive|menu`); `shots.json` lists them.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
