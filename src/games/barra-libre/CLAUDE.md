# Barra Libre

Discreet homage to the arcade classic Tapper, reshaped to this repo's
formula: no levels — a single endless run where the difficulty ramps with
elapsed time, three strikes end the night, score is points. Four terraced
bar counters in a night bar; customers walk in from the left toward the
taps, the bartender serves beers that slide down the counter, catches the
empties (and tips) that slide back, and loses when misses pile up.

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
- Three strike causes: a customer reaches `END_X`, an empty mug falls
  past `CATCH_X + FALL_MARGIN` with the bartender elsewhere, a beer
  reaches `CRASH_X` with nobody to take it (the anti-spam rule).
- Punks (pink mohawk) walk `PUNK_SPEED_FACTOR` faster and pay more.
- Left out on purpose: the original's shell-game bonus round (it already
  exists in this repo as El Trile) and its points-based extra lives.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — scene/camera/renderer + composer, the `ready ->
  countdown -> playing -> dead` state machine, event handling (score,
  strikes, pulses, shake), pointer->lane mapping (projects each lane's
  spot to screen Y), the tap glint / beer-tracking light, room wiring.
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
  emissive tip coin; slightly emissive so they pop and bloom.
- `game/Barroom.ts` — the world and the light rig: terraced floors,
  counters with brass taps, back wall with backlit bottle shelves, neon
  "BAR" (magenta, flickers) and cocktail (cyan) signs each backed by a
  matching PointLight, moon window + cool rim, jukebox with hue-cycling
  glow, hanging lamps (4 warm spots, only lanes 0 and 2 cast shadows —
  budget), booth crowd (two swapped textures), and the `pulseGood` /
  `pulseBad` event lights the Game spikes.
- `game/sprites.ts` — all procedural art: bartender/patron frame sets,
  wood/wall/shelf/neon/window/booth/jukebox textures, `makeSpritePlane` /
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

- **A. Warmup** (0-15 s) — two lanes, slow strollers, long gaps.
- **B. Ritmo** (15-60 s) — interval 2.2 -> 1.4 s, speed climbs; lane 3
  opens at 25 s, lane 4 at 40 s; punks/groups fade in to 15%.
- **C. Mezcla** (60-120 s) — interval to 1.0 s, speed to 0.95 m/s, punks
  to 35%, groups (two at once) to 30%.
- **D. Inferno** (120 s+) — capped values blended in over 10 s, no cliff.

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
  mesh at its position (lamps/bulbs, neon tubes, bottle backlight, moon,
  jukebox arch) so shadows and glows match what the eye sees.
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
