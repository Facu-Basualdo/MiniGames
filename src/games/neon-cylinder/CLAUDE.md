# Neon Cylinder Runner

Player is a glowing sphere orbiting the inner wall of a neon-lit cylindrical tunnel, steering left/right to dodge "pizza-with-a-missing-slice" ring obstacles (a solid disc with one wedge cut out) approaching along the tunnel axis. Visual style is neon/TRON (dark background, glowing cyan/magenta grid, `UnrealBloomPass`).

Controls: left/right (arrows or A/D, plus pointer) steer the orbit; **Space instantly flips the sphere to the opposite side of the tunnel** (half a turn, `Player.flip()`), driven by `InputController.consumeFlip()` (one-shot per keypress, `e.repeat`-guarded) consumed in `Game.tick()`.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates scene/camera/renderer/composer and the game loop (`tick`).
- `game/Player.ts` — orbit-angle sphere controlled by input.
- `game/Tunnel.ts` — canvas-generated grid texture on a `BackSide` cylinder.
- `game/Obstacle.ts` + `game/ObstacleSpawner.ts` — pie-slice-gap discs: spawn, recycle, collision.
- `game/InputController.ts` — keyboard + pointer input.
- `game/Hud.ts` — DOM overlay (score, start/game-over screens).
- `game/constants.ts` — all tunable values (speeds, radii, gap sizes, spawn spacing, fog distances). **Tune here first** before touching logic.
- `game/mathUtils.ts` — shared math helpers.

## Non-obvious gotchas

**Obstacle color/fog whiteout:** the fill (`Obstacle.ts`) is always the same shared low-opacity color (`OBSTACLE_FILL_COLOR`) so stacked discs don't blend into a confusing mixed hue; the edge uses per-obstacle `NEON_COLORS` at full opacity via `LineSegments2`/`LineMaterial`/`LineSegmentsGeometry` (three/examples/jsm/lines) since plain `linewidth` is ignored on most GPUs. `LineSegments2.onBeforeRender` auto-syncs the `resolution` uniform, so no manual resize wiring is needed. With several translucent discs stacked down the tunnel's depth, low per-layer opacity still compounds into a blown-out white wall — `scene.fog` (`FOG_NEAR`/`FOG_FAR`) fixes this, but every material that should fade needs `fog: true` explicitly, since `ShaderMaterial`-based ones (`LineMaterial`) default `fog: false`.

**Despawn point:** obstacles despawn shortly after passing the *player* (`OBSTACLE_DESPAWN_MARGIN` measured from `playerZ`), not the camera — despawning at the camera let an obstacle balloon to fill the screen while drifting through the camera position, blowing out bloom.

**Pacing knobs interact:** `OBSTACLE_ACTIVE_COUNT` × average spacing sets the visible lookahead depth. It only reads as "obstacles incoming" rather than an empty void if that depth stays comfortably under `FOG_FAR`. When tuning any one of {active count, spacing, fog far}, sanity-check the other two rather than adjusting in isolation.

**Enter-to-start countdown:** from the start or game-over screen, Enter / space (wired in `Hud`) or a pointer tap enters a `countdown` state that shows 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` seconds each, in `Game.ts`) before play begins; the tunnel keeps its idle scroll during the countdown and steering/flip input is ignored until it finishes. `Hud.showCountdown(text | null)` renders the big centered label (styled by `.countdown` in `style.css`).

**Headless/Playwright testing:** the game's internal `elapsed` clock (in `Game.ts`'s `tick()`) can diverge significantly from real wall-clock time under CDP automation, since `tick()` clamps `dt` to 0.05s/frame and headless rendering can run far below 60fps. Don't assume `loop_iteration * nominal_step_ms ≈ game elapsed time`. Read the game's actual internal state instead (e.g. temporarily expose `window.__game = this` in the `Game` constructor, pull fields via `page.evaluate()`, remove the hook before finishing).
