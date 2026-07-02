# City Bloxx

Nokia-style tower builder. A hook sweeps horizontally across the top carrying the next floor; tap / click / space drops it. The floor falls straight down and lands on the stack at the hook's X. Floors are full width, so the game is about **balance**: the whole tower tilts around its base by an angle driven by the center of mass, and if that center of mass drifts past the base footprint the building topples and the run ends. A drop with no overlap at all (the floor misses its support) also ends the run. Score is the number of floors placed. Plain 2D `<canvas>`, no Three.js.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, the `ready → countdown → playing → dead` state machine, the `requestAnimationFrame` loop, the block drop/placement flow, and the vertical camera pan. Also owns the canvas→window scaling (letterbox fit).
- `game/Tower.ts` — the stacked floors, placement/overlap resolution, center-of-mass balance, the whole-tower tilt angle (lean + damped wobble), and the topple/collapse animation. **Balance model lives here.**
- `game/Crane.ts` — the hook that ping-pongs horizontally; speeds up as floors stack.
- `game/Renderer.ts` — all canvas drawing (sky, clouds, ground, foundation, tilted tower with lit windows, crane jib/trolley/cable, the in-play block), in view units.
- `game/InputController.ts` — keyboard + pointer → a single `onDrop` callback.
- `game/Hud.ts` — DOM overlay (floor count, balance meter, start / game-over / countdown screens).
- `game/constants.ts` — all tunable values (floor size, hook speed, drop gravity, lean/wobble, camera). **Tune here first.**

## Non-obvious decisions

**Fixed view box, scaled to fit.** Like the other games, everything is authored against a fixed `VIEW_WIDTH`×`VIEW_HEIGHT` (480×720 portrait) space; `Game.render()` applies `ctx.scale()` + `ctx.translate()` (with `devicePixelRatio` folded in) to letterbox it into the window. All logic works in view units.

**Balance, not stacking precision, is the fail state.** Unlike `stack-tower` (which trims the overhang each drop), City Bloxx keeps every floor full width. `Tower.comOffset()` is the mean of the floor X's minus `BASE_X`; once `|comOffset| > FLOOR_WIDTH / 2` the center of mass is off the base and `isToppled()` is true. `renderAngle()` maps the balance ratio to a small lean (`MAX_LEAN`) so the tower visibly leans toward the danger side before it goes.

**Wobble is a damped angular spring.** Each off-center placement kicks `wobbleVel` (in `Tower.place()`) proportionally to the offset; `Tower.update()` integrates a spring back to rest (`WOBBLE_FREQ`, `WOBBLE_DAMP`). This is purely visual feedback added on top of the static lean.

**Camera pins the hook once the tower is tall.** `Game.cameraTarget()` returns `max(0, HOOK_SCREEN_Y - hangTopY)`, so while the tower is short `camY` stays 0 (ground sits at the bottom) and only once the hook would rise above `HOOK_SCREEN_Y` does the world pan down to keep the build area on screen. `updateCamera()` lerps toward it (`CAM_LERP`).

**Death animations.** A missed drop (no overlap) keeps the block falling off the bottom during the `dead` state. A topple calls `Tower.collapse()`, which accelerates an extra `collapseAngle` so the whole building tips over on the game-over screen.

**`dt` is clamped** (`MAX_DT`) so a tab-switch or hitch can't integrate one giant step and teleport a falling block through the stack.

**Enter-to-start countdown.** From the start or game-over screen, Enter / tap / space enters a `countdown` state showing 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` seconds each) before play begins; the hook idle-sweeps and drop input is ignored until it finishes. After dying there's a short `deadFor` guard so the killing tap doesn't instantly restart.
