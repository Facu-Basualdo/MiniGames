# Jump Ball

3D Subway-Surfers-style endless runner. A solid-colored ball hops forward
automatically along a stream of floating platforms; the player only switches
between three lanes (left/right) to stay on a platform. Miss a platform and the
ball falls into the gap — game over. Chase camera behind and above the ball.
Built with **Three.js** (see the repo's `threejs-*` skills).

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — owns scene/camera/renderer/lights, the chase camera, the
  `ready → playing → gameover` state machine and the `setAnimationLoop` tick.
  Also owns world scroll, speed ramp, landing detection and scoring.
- `game/Ball.ts` — the player sphere: lane easing, the automatic sine-arc hop
  height, and the death-fall. Owns its own mesh.
- `game/Track.ts` — the streaming stepping-stone track: a pool of platform rows
  that scroll toward the camera and recycle to the back, plus lane-occupancy
  generation and the `laneOccupied(row, lane)` query.
- `game/InputController.ts` — steering input plus an `onAnyInput` start/restart
  signal. Keyboard: hold Left/A or Right/D (`getSteerDir` returns -1/0/1).
  Mouse/touch: the ball follows the cursor's horizontal position
  (`getPointerTargetX` maps screen X to a target lane X; screen edges map to the
  outer lanes). **Last input wins**: pressing a steer key nulls `pointerTargetX`
  so mouse-follow stops until the mouse moves again — otherwise releasing a key
  snapped the ball back to the cursor and keyboard steering felt dead. `Game.ts`
  uses `getSteerDir` while a key is held, else follows the pointer target if set.
- `game/Hud.ts` — DOM overlay (live score, start / game-over screens).
- `game/SoundEffects.ts` — synthesized Web Audio effects (bounce on each
  landing, descending swoop on the death-fall), no assets.
- `game/constants.ts` — all tunable values (layout, speeds, camera, colors).
  **Tune here first** before touching logic.

## How the motion works

**The ball never actually moves forward or up in world space.** It stays at
`z = 0`; the whole `Track` scrolls toward the camera (`worldScroll` grows) and
rows past the camera recycle to the back. Coordinates: forward is `-Z`, lanes
are along `X` at `-LANE_X, 0, +LANE_X`, platform top surfaces sit at `y = 0`.

**The hop is a synced sine arc, not gravity.** `hopPhase = fract(worldScroll /
ROW_DEPTH)` drives `y = BALL_RADIUS + sin(π·phase)·HOP_HEIGHT`, so the ball is
on a platform exactly when a row is under it (`phase = 0`) and at its apex
between rows. This can't tunnel and stays perfectly in sync with the rows at any
speed. Speed ramps with `elapsed` up to `MAX_SPEED` (Subway-style).

**Landing = a new row crossing `z = 0`.** `currentRow = floor(worldScroll /
ROW_DEPTH)`; when it increments, that row is scored and checked. `Ball.lane` is
the *logical* target lane (updated instantly on steer, independent of the
visual X easing), so a steer registered anytime during the row counts at
landing.

## Non-obvious decisions

**No dead-end levels.** `Track.generateLanes` guarantees that every occupied
lane in a row has a reachable platform (same or ±1 lane) in the next row, so a
surviving player can *always* continue with at most one lane change per row.
Rows are generated in ascending index order using the previous row's occupancy
from the `occupancy` map; recycled rows always take the next sequential index so
the lookback stays valid.

**Occupancy lives in a `Map<rowIndex, boolean[3]>`**, set on (re)generation and
deleted on recycle. `laneOccupied` defaults missing rows to *safe* so a lookup
race can't cause a bogus death.

**Shadows are the landing cue.** A single shadow-casting `DirectionalLight`
(roughly overhead) drops the ball's shadow onto the platforms; its shadow camera
is a tight ortho box around the origin since the ball never leaves `z ≈ 0`. Only
the ball casts; platforms only receive.

**Fog hides the spawn edge.** `FOG_FAR` (62) sits just inside the farthest
row's distance so rows fade in rather than pop. When retuning `VISIBLE_ROWS`,
`ROW_DEPTH` or `FOG_FAR`, sanity-check them together.

**`dt` is clamped** (`MAX_DT`) so a tab-switch/hitch can't advance the scroll a
huge step and skip past a row's landing check.

**Enter-to-start countdown.** From the start or game-over screen, Enter / space
(wired in `Hud`) or a steer input enters a `countdown` state that shows
3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` seconds each, in `Game.ts`)
before play begins. During the countdown the ball idle-bobs and the track is
frozen (no scroll) so `worldScroll` / `lastLandedRow` don't drift; `startGame()`
resets them to 0 at the transition. `Hud.showCountdown(text | null)` renders the
big centered label (styled by `.countdown` in `style.css`).

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("jump-ball", { getScore: () => this.score })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
