# Surya Bay — Make GTA 6

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/musemosmouses/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/musemosmouses/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).

Raka just washed up in Surya Bay with $50 and a borrowed jacket. Explore a sun-soaked procedural coastal city on foot or by stealing any car, dodge traffic and pedestrians, outrun the police as your wanted level climbs, and work five story missions for Mira the fixer — couriers, fares, a getaway, a turf war, and one last big job at the Surya Bank.

## Play

Serve `game/` with any static server (or `node serve.ts`) and open `game/index.html` in desktop Chrome. No network requests, no build step — everything is vendored or synthesized, including the WebAudio sound.

- **WASD** move / drive, **Mouse** camera, **Shift** run, **Space** jump / handbrake
- **E** enter / exit car, **Q** pistol, **G** / click fire, **R** reload, **F** punch
- **T** taxi job, **U** delivery job, **P** / **Esc** pause

## Systems

- Seeded procedural city: 12×12 blocks, beach + sea, palms, lamps, a spray garage that clears wanted stars, a hospital respawn
- Traffic AI and pedestrians who wander and flee
- Wanted 0–5 stars: police cars chase and ram, foot cops chase and grab
- 5 chained story missions + repeatable taxi/delivery side jobs, cash progression
- Combat: pistol hitscan, punches, health/armor pickups
- HUD with health, armor, cash, stars, a canvas minimap, objective line and speed
- Start screen, pause, localStorage save; synthesized WebAudio SFX + music
