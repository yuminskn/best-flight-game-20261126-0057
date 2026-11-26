# GULLWING MAIL — Lighthouse Isles Courier

A golden-hour mail plane over a lighthouse island chain. Fly a little
courier aircraft between five islands, thread glowing rings, deliver the
mail, and bring her home to the runway before the fuel runs out.

## How to play

- **Arrow keys** — fly (up/down pitch, left/right bank and turn). **A / D** also roll.
- **W / S** — throttle up / down. **Mouse** — a gentle virtual stick.
- **C** — chase / cockpit camera. **P** — pause. **R** — restart. **M** — mute.

Take off from Gull Strip, follow the rings, and land back home. A hard
landing or a cliff strike damages the hull; running dry over the sea ends
the sortie. Landings only count once you have actually left the ground.

## Missions

- **Ring Run** — 10 rings around the whole island chain. Pure flying.
- **Mail Run** — 6 rings and 2 delivery gates over the island strips, then
  land back at Gull Strip. A gate is worth 300, a home landing 400.
- **Storm Run** — 8 rings in gusty crosswind, on a 2:30 clock, with a time bonus.

Rings are worth 100 points. Fuel and hull left at the end convert to bonus
points. The score is the sum of rings, gates, landing, time, fuel, and hull.

## The world

Five islands — Gull Isle, Puffin Rock, Beacon Holm, Seal Skerry, Tern
Skerry — with cliffs, beaches, pine forest, a lighthouse with a rotating
beam, and three landing strips. Golden-hour sun, sea fog, drifting clouds,
and a lit instrument panel: altitude, speed, heading, throttle, fuel, hull,
an artificial horizon, and a compass tape.

## Tech

- Three.js (vendored IIFE build) over a procedural heightfield terrain.
- No network requests, no external assets — everything is generated in code.
- Sound is procedural Web Audio: engine drone, wind, ring chimes, thud,
  crash, and fanfare. No audio files.
- Keyboard + mouse, desktop browser, static files only.

## Files

- `game/index.html` + `game/style.css` — page and HUD.
- `game/src/` — noise, terrain, sky, aircraft, flight physics, course and
  missions, HUD, audio, input, staged screenshot shots, main loop.
- `game/vendor/three.min.js` — vendored Three.js 0.186.1 (unchanged).
- `screenshots/` — 01-cover, 02-runway, 03-cockpit, 04-storm.
- `main.ts` — build script: copies game/ and screenshots/ to the output
  directory and writes dossier.json with the kit's buildDossier.
