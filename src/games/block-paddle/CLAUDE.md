# Block Paddle

Single-player paddle-and-ball survival game. The player controls a paddle at the bottom of the screen, moving left and right to keep a ball bouncing. Each paddle hit increments the score and speeds up the ball (BALL_SPEED_INCREMENT per hit, capped at BALL_SPEED_MAX). Missing the ball ends the run. Plain 2D `<canvas>`, no Three.js.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, `ready -> countdown -> playing -> dead` state machine, collision detection, scoring, and the `requestAnimationFrame` loop. Owns canvas-to-window letterbox scaling. Includes mouse and touch input for paddle movement.
- `game/Hud.ts` — DOM overlay (score, start / game-over screens, countdown).
- `game/SoundEffects.ts` — synthesized Web Audio effects (no assets): paddle hit blip, wall bounce tick, countdown tick, lose swoop.
- `game/constants.ts` — all tunable values (speeds, sizes, acceleration, countdown timing).

## Non-obvious decisions

**Single paddle at bottom.** Unlike classic Pong, there is no AI opponent. The paddle stays at the bottom, the ball bounces off all walls, and the fail condition is the ball passing the paddle.

**Portrait view box.** 480x720 (portrait) since the paddle is at the bottom and the ball travels vertically more than horizontally. Letterbox scaling handles any screen.

**One life, score by returns.** The player has exactly one life. Each successful paddle hit increments the score. Speed ramps up with every hit until BALL_SPEED_MAX.

**Bounce angle from paddle position.** Where the ball hits the paddle determines the outgoing angle: center hits go nearly straight up, edge hits go steep. Formula: `relX * 0.7` radians offset from straight up (-PI/2).

**`dt` is clamped** (MAX_DT) so a tab-switch or hitch can't integrate one giant step and teleport the ball through the paddle.

**Mouse and touch input.** The paddle follows the cursor/finger position directly on the x-axis. Arrow keys (or A/D) also work for keyboard control. Enter or tap to start.

**Enter-to-start countdown.** Standard repo pattern: 3 / 2 / 1 / YA (COUNTDOWN_LABELS, COUNTDOWN_STEP in constants.ts), 0.6 s restart guard after dying.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("block-paddle", { getScore: () => this.score, onStart: () => this.beginCountdown() })` (see root CLAUDE.md, "Salas (multiplayer rooms)").
