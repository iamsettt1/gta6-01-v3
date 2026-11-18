# gta6-01-v3

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/iamsettt1/gta6-01-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/iamsettt1/gta6-01-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Puerto Serena — Neon Tide** is an original 2D top-down open-world crime game that runs entirely in the browser from static files — no build step, no network requests. You are Nico Vidal, a wheelman newly arrived in a sun-soaked coastal city that turns neon after dark, working for fixer Marina Solís and her harbour crew against the Cárdenas logistics syndicate.

The city is a 6000×4200 world of eight named districts — Centro Aurelio's towers, the Mercado Brisa market streets, the working marina, neon-soaked Barrio Neón, the Playa Serena beachfront, leafy Colinas Verdes, the Zona Industrial yards, and Isla Faros, an island joined by two bridges and reachable by boat. Explore it on foot and by car, motorcycle and boat; steal from ten car classes plus three boat classes; run from a 1–5 star wanted system answered by foot officers, patrol cars, interceptors, roadblocks, police boats and a searchlight helicopter.

**The story** is ten chained missions — a first courier job, a tail through the market, a timed neon night run, a dockside shootout, a three-lap street race, a boat smuggling run to the island, a three-car export list, a rainy-night ambush, a two-bridge armoured-van chase, and a five-star harbour heist finale. Around it: four street races with medal times, taxi fares, fifteen hidden sun shells, a six-car export list, a paint shop that repairs, repaints and clears your heat, a phone with contacts and a once-per-heat bribe, and a safehouse that saves the game (localStorage) and tracks your garage stats. Combat runs on three weapons — pistol, scattergun and SMG — with mouse aim and drive-by fire from cars and boats. A day cycle (dawn → noon → golden hour → neon night), rain with wet-street reflections, synthesized WebAudio sound (engines, sirens, gunfire, a three-station radio) and an oversized HUD with a 300px radar minimap keep it readable at any size.

## Controls

- **WASD / arrows** — move and drive · **Shift** — sprint · **Space** — handbrake
- **F** — enter/exit any car or boat · **E** — talk, use shops, safehouse, jobs
- **Mouse** — aim · **click** — fire (drive-by works too) · **R** — reload · **1/2/3** — weapons
- **P** — phone · **J** — missions board · **M / Esc** — pause with the full-city map

## Run it

```sh
python3 -m http.server 8080 --directory game
```

then open `http://localhost:8080` in a desktop browser — or use any static file server pointed at `game/`. To produce the competition hand-in (copies `game/` and `screenshots/` to the output directory and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are deterministic scenes of the real game: open `game/?shot=chase&seed=7` (also `neon`, `boat`, `progress`) and the game stages that scene and sets `window.__shotReady`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9j3w1sg2&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
