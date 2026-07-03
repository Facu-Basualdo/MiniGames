# Barra Libre

Discreet homage to the arcade classic Tapper, reshaped to this repo's
formula: no levels — a single endless run where the difficulty ramps with
elapsed time, six strikes end the night (`MAX_MISSES`), score is points.
Four bar
counters (coplanar — see `LANE_STEP_Y`) in a night bar seen from a fixed
elevated corner; customers walk in from off-camera toward the taps, the
bartender serves beers that slide down the counter, catches the empties
(and tips) that slide back, and loses when misses pile up.

Retro **HD-2D** like Keepers! (`penalty-keeper`): procedural pixel-art
sprites (canvas rect-lists, `NearestFilter`) as lit planes
(`MeshStandardMaterial` + matching `customDepthMaterial`) inside a real
Three.js scene, with the `RenderPixelatedPass -> UnrealBloomPass ->
OutputPass` chain. The difference here is that **the lighting is the
centerpiece**: bloom threshold is dropped to 0.55 so the neon signs, lamp
bulbs, backlit bottles and the moon actually glow.

## Rules

- Hold Space (or press on a lane) to fill the mug (`POUR_TIME`); release
  to send it sliding. Releasing early discards the half mug (lost time,
  no strike). Once full there is **no overfill punishment**: the mug just
  waits and the bartender stands there — the wasted time is the penalty
  (explicit design request).
- Pouring roots him to the lane. W/S / arrows hop lanes with wraparound
  (the original's "hyperspace"); a wrap hop snaps instead of sweeping.
- A beer pushes the frontmost **walking** customer back `PUSHBACK_DIST`;
  drinkers can't catch, the mug passes them. After drinking, the empty
  mug always slides back. Pushed past the far end = satisfied (gone), and
  sometimes a tip coin follows (`TIP_CHANCE`).
- Catching a tip gives points and slows every customer for
  `TIP_SLOW_DURATION` (the "floor show" of the original, abstracted).
- Three ways to earn a strike: a customer reaches `END_X`, an empty mug
  falls past `CATCH_X + FALL_MARGIN` with the bartender elsewhere, a beer
  reaches `CRASH_X` with nobody to take it (the anti-spam rule). Missed
  empties (`mugFell`) are by far the most common — see the difficulty note.
- Punks (pink mohawk) walk `PUNK_SPEED_FACTOR` faster and pay more.
- Left out on purpose: the original's shell-game bonus round (it already
  exists in this repo as El Trile) and its points-based extra lives.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — scene/camera/renderer + composer, the `ready ->
  countdown -> playing -> dead` state machine, event handling (score,
  strikes, pulses, shake), pointer->lane mapping (projects each lane's
  spot to screen Y), the tap light (dim pour -> full-mug flash -> off once
  the beer is sliding, so the trip isn't lit), room wiring.
- `game/constants.ts` — every tunable (layout, pour, speeds, points,
  difficulty phases, bloom). **Tune here first.**
- `game/layout.ts` — the terraced-lane formulas (floor/counter-top/Z per
  lane) shared by world, views and Game.
- `game/Bartender.ts` — pure logic: lane, eased hop, pour state machine
  (`idle/pouring/full`). `game/BartenderView.ts` maps it to the sprite
  plane plus the mug filling under the tap.
- `game/Lanes.ts` — the whole bar simulation: phase-driven spawning
  (`paramsAt`), customer advance/pushback/drink loop, beers-empties-tips
  sliding, every win/fail as a `LaneEvent[]` the Game consumes. Owns the
  patron sprite planes and mug/coin props (disposed on removal).
- `game/props.ts` — 3D mugs (glass + scalable liquid + foam) and the
  emissive tip coin; slightly emissive so they pop and bloom. `setMugFill`
  takes an `isSliding` flag: the mug under the tap stays dim while filling
  and flashes bright at 100% (the destello), but a served/sliding mug is
  kept dim so it doesn't light its trip down the counter. `makeMug(true)`
  adds two hairline red emissive rings so the empties sliding back read
  apart from the amber full beers.
- `game/Barroom.ts` — the world and the light rig: one flat floor,
  counters with brass taps, back wall with backlit bottle shelves, neon
  "BAR" (magenta, flickers) and cocktail (cyan) signs each backed by a
  matching PointLight, a floor-to-ceiling city picture window on the +X
  side wall (`buildCityWindow`, emissive skyline behind a real mullion
  frame) + cool rim, a warm front key and a spawn-side fill, two rows of
  hanging lamps per lane (`LAMP_SPAWN_X` over the walk-in, `LAMP_TAP_X`
  by the serve end; only the spawn-side lamps of lanes 0 and 2 cast
  shadows — budget), a front lounge of bistro tables with backed chairs
  dressing the empty foreground (`buildLounge` / `makeDinerSet` /
  `makeChair`) under a soft warm lounge fill, booth crowd (two swapped
  textures), and the `pulseGood` / `pulseBad` event lights the Game spikes.
- `game/sprites.ts` — all procedural art: bartender/patron frame sets,
  wood/wall/shelf/neon/city-window/booth textures, `makeSpritePlane` /
  `setSpriteFrame` helpers (same contract as Keepers!: swap the frame on
  both materials or the shadow lags).
- `game/SoundEffects.ts` — synthesized PSG effects: pour foam swell,
  full-mug ding, serve swish, coin, glass crash, strike buzzer, service
  bell on YA, countdown tick (750 Hz), game-over arpeggio.
- `game/InputController.ts` — keyboard (W/S hop, Space hold/release,
  Enter) + pointer (press = pick lane + pour, release = serve).
- `game/Hud.ts` — DOM overlay: PUNTOS + FALLOS island, feedback popups
  (good/gold/bad tones), start / game-over screens, leaderboard panel.

## Difficulty: four time-driven phases (`Lanes.paramsAt`)

All four bars are open from the first customer; difficulty ramps via
cadence, speed, punks and groups — not by opening lanes.

- **A. Warmup** (0-15 s) — interval 4.5 s, slow strollers (0.55 m/s), long gaps.
- **B. Ritmo** (15-65 s) — interval 3.6 -> 2.6 s, speed climbs to the
  critical pace (0.62 m/s); punks fade in to 8%, groups to 6%. Real
  pressure has arrived by ~1 min.
- **C. Mezcla** (65-250 s) — a long grind: interval eases to 2.3 s, speed
  creeps to 0.70 m/s, punks to 16%, groups (two at once) to 13%.
- **D. Inferno** (250 s+) — interval 1.95 s, speed 0.92 m/s, punks 33%,
  groups 21%, blended in over 20 s (no cliff).

**Retuned by Monte Carlo (2026-07).** The previous curve (ritmo end 60 s,
inferno start 120 s, mezcla speed to 0.95 and groups to 30%) slammed into
an unbeatable wall around the 1-minute / ~400-point mark; the reshape above
pushes that pressure out to ~2.5-3 min while keeping the opening honest.
The simulation (a headless 1-D port of `Lanes` driven by a
reaction-limited greedy player, thousands of runs per config) surfaced the
key fact: **walker speed is the dominant lever, with a sharp critical
threshold near ~0.6 m/s.** A pour roots the bartender for `POUR_TIME`, so
past that pace he can no longer serve and catch the returning empties fast
enough and the backlog collapses (`mugFell` is still the dominant strike).
Spawn interval and `MAX_MISSES` barely move survival (deaths are burst
collapses, not linear attrition — so more lives would just inflate scores);
a high group chance is what read as "too many at once", so it was cut hard.
`POUR_TIME` was also trimmed 0.55 -> 0.47 s to lift the throughput ceiling,
which let the opening keep its bite without bringing the wall back in.
Under the model this lands the median run at ~145 s (weak player) to ~210 s
(strong player), versus ~90 s for every skill on the old curve.

**Spawns spread across the bars.** `Lanes.pickLane` sends each customer to
the emptiest open bar that still has entrance room (`laneHasRoom`), random
among ties — so they fan out over the four counters instead of piling onto
one or two. A group spawn puts its second customer on the same bar.

## Non-obvious decisions

- **Judgment is 1D per lane.** Everything lives on the counter axis (X);
  a "collision" is an X comparison with `MUG_HIT_MARGIN`. The 3D scene is
  presentation only.
- **`slowFactor` (tip show) only slows customers**, never the sliding
  mugs — physics staying constant keeps the serve timing learnable.
- **The catch is positional, not timed**: an incoming empty/tip is caught
  the moment it is past `CATCH_X` while the bartender is on that lane
  (a `FALL_MARGIN` window), so arriving slightly late still saves it.
- **Visible fixtures are the real lights**: every light has an emissive
  mesh at its position (lamps/bulbs, neon tubes, bottle backlight, city
  window) so shadows and glows match what the eye sees.
- **`dt` is clamped** (`MAX_DT`) so a tab-switch can't teleport mugs past
  their judgment windows.
- **Enter-to-start countdown**: standard repo pattern, 3/2/1/YA with the
  750 Hz tick, 0.6 s restart guard, no retry in room mode (single run per
  round); room mode auto-starts via `onStart`.
- **Pointer input listens on `window`, not the canvas**: the start /
  game-over overlay covers the canvas and would swallow the tap-to-start
  press. A `closest("a, button, input, ...")` guard keeps the back link
  and the leaderboard's nickname form working.
- **QA hook**: `Game.tick` publishes `window.__THREE_GAME_DIAGNOSTICS__`
  (state, score, misses, lane, pour, elapsed) for
  `scripts/inspect-threejs-canvas.mjs` and headless probes. Headless
  Chromium renders WebGL in software and runs the game at a fraction of
  real speed — QA scripts must wait on these states, never on wall-clock
  times.
