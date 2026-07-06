# Flappy Bird

Classic side-scroller: a bird holds a fixed X while gravity pulls it down; each flap (space / click / tap) gives an instant upward impulse. Fly through the gaps in scrolling pipe pairs — one point per pair cleared. Hitting a pipe, the ground, or the ceiling ends the run. Plain 2D `<canvas>`, no Three.js.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, the `ready → playing → dead` state machine and the `requestAnimationFrame` loop. Also owns the canvas→window scaling (letterbox fit).
- `game/Bird.ts` — player physics (gravity, flap impulse) and derived tilt/wing animation.
- `game/PipeField.ts` — spawns/scrolls/recycles pipe pairs, scoring, and circle-vs-rect collision.
- `game/Renderer.ts` — all canvas drawing (sky gradient, parallax clouds, pipes, scrolling ground, bird), in view units.
- `game/InputController.ts` — keyboard + pointer → a single `onFlap` callback. Pointer input is attached to the `#app` container (not the canvas) so taps on the start / game-over overlay also count — required for mobile, where there is no Enter key. The leaderboard panel stops event propagation, so its input/buttons don't trigger a flap.
- `game/Hud.ts` — DOM overlay (live score, start / game-over screens).
- `game/SoundEffects.ts` — synthesized Web Audio effects (flap whoosh, score blip, crash thud), no assets. Called from `Game.ts` on flap, on each pipe cleared, and on death.
- `game/constants.ts` — all tunable values (gravity, flap velocity, gap size, speeds, spacing). **Tune here first.**

## Non-obvious decisions

**Fixed view box, scaled to fit.** The whole game is authored against a fixed `VIEW_WIDTH`×`VIEW_HEIGHT` (480×720 portrait) coordinate space so physics constants have a stable feel regardless of window size. `Game.render()` applies `ctx.scale()` + `ctx.translate()` (with `devicePixelRatio` folded into the scale) to letterbox that box into the actual window; on wide screens you get side bars painted with the body's sky-blue background. Everything in `Renderer`/`PipeField`/`Bird` works in view units and never touches window pixels.

**`dt` is clamped** (`MAX_DT`) so a tab-switch or hitch can't integrate one giant step and teleport the bird through a pipe.

**Ground is the death floor, not `VIEW_HEIGHT`.** Collision/floor use `VIEW_HEIGHT - GROUND_HEIGHT` so the bird dies on the grass strip, not below it. Pipe bottom segments also stop at that line.

**Restart guard.** After dying there's a short `deadFor` delay before a flap can restart, so the tap that killed you doesn't instantly begin a new run. The bird keeps falling to the ground during the game-over screen for polish.

**Enter-to-start countdown.** From the start or game-over screen, Enter (or a tap / space) enters a `countdown` state that shows 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` seconds each, in `Game.ts`) before play begins; the bird just idle-bobs and gameplay input is ignored until it finishes. The first input only starts the countdown — it no longer also flaps. `Hud.showCountdown(text | null)` renders the big centered label (styled by `.countdown` in `style.css`).

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("flappy-bird", { getScore: () => this.score })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
