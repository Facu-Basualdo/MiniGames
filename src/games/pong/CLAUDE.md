# PONG

Single-player classic Pong: the player controls a paddle on the left with the mouse (the paddle follows the cursor's Y), up/down arrows, or W/S; the ball bounces between paddles. Each time the player returns the ball the score increments and the ball speeds up (`BALL_SPEED_INCREMENT` per hit, capped at `BALL_SPEED_MAX`). Missing the ball ends the run (1 life). When the ball passes the AI's right edge it resets to the center and serves back toward the player — score keeps climbing. Plain 2D `<canvas>`, no Three.js.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, `ready -> countdown -> playing -> dead` state machine, collision detection, scoring, and the `requestAnimationFrame` loop. Owns canvas-to-window letterbox scaling.
- `game/Paddle.ts` — paddle state (position, dimensions, clamp to play area).
- `game/Ball.ts` — ball physics (speed, angle, wall bounce, paddle bounce with angle-from-impact-position, speed ramp per hit).
- `game/Ai.ts` — computer opponent: follows the ball's Y with a configurable `AI_MARGIN` dead zone and slightly slower speed than the player.
- `game/Renderer.ts` — all canvas drawing: dark background, glowing white paddles/ball with `shadowBlur`, dashed center line.
- `game/InputController.ts` — keyboard (up/down arrows or W/S for movement, Enter/Space for action) + pointer (tap/click for action). Exposes `moveDir` / `p1Dir` / `p2Dir` for the game loop to read. **Mouse paddle-follow lives in `Game.ts`, not here**: a `pointermove` listener maps the cursor Y into view space (via `cssScale`, the dpr-free letterbox factor) and `movePlayer()` centers the local paddle on it whenever no movement key is held. **Last input wins**: pressing a movement key clears `pointerActive` so mouse-follow stops until the mouse moves again — otherwise releasing a key snapped the paddle back to the cursor Y and keyboard felt dead. Works in solo, vs-AI and both room-mode sides.
- `game/Hud.ts` — DOM overlay (score, start / game-over screens, countdown).
- `game/SoundEffects.ts` — synthesized Web Audio effects (no assets): paddle hit blip, wall bounce tick, score chime, lose swoop, countdown tick.
- `game/constants.ts` — all tunable values (speeds, sizes, margins, acceleration). **Tune here first.**

## Non-obvious decisions

**Landscape view box.** Unlike most games in the repo (480x720 portrait), Pong uses 720x480 landscape since the gameplay demands horizontal space. The same letterbox scaling still works — portrait screens get bars at top/bottom.

**One life, score by returns.** The player has exactly one life. Each successful return increments the score. When the ball passes the AI it resets to center and serves again toward the player; the score continues accumulating. This creates an endless survival mode where the only fail state is missing the ball.

**Speed ramp per hit.** Every paddle hit (by either side) adds `BALL_SPEED_INCREMENT` up to `BALL_SPEED_MAX`. The ball launches at `BALL_SPEED_INITIAL` after each reset-through-AI.

**Bounce angle from paddle position.** Where the ball hits the paddle determines the outgoing angle: center hits go straight, edge hits go steep. Formula: `(relY - 0.5) * PI * 0.7` where `relY = (ball.y - paddle.y) / paddle.h`.

**AI with dead zone.** The AI has a `AI_MARGIN` dead band so it doesn't jitter when the ball is near center, giving the player an opening to exploit.

**`dt` is clamped** (`MAX_DT`) so a tab-switch or hitch can't integrate one giant step and teleport the ball through a paddle.

**Enter-to-start countdown.** Standard repo pattern: 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` in `Game.ts`), 0.6 s restart guard after dying.

## Room mode (multiplayer) — server-authoritative PvP

Wired to the shared party mode: the constructor calls `initRoomMode("pong", { getScore: () => this.score, onStart: () => this.beginCountdown() })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)").

With `?room=` in the URL, Supabase connected **and** `VITE_GAME_SERVER_URL` set, Pong becomes **online 1v1 arbitrated by the game server** (namespace `/pong`, see root `CLAUDE.md`, "Game server"). This is the second game after word-bomb to use the authoritative server. Supabase still owns lobby / cumulative scoreboard / rejoin / round deadline; the game server owns the **in-round physics**.

- **The server is the ball authority.** `server/src/games/pong.ts` (`PongSim`) pairs the room's `roster` `(0,1),(2,3),...` into one **match per pair** (odd one out plays vs a server AI), runs the ball physics / collisions / speed ramp / scoring for every match on a ~60 fps interval (`TICK_MS = 16`), and broadcasts `pg:state` to each seated player (their own `side` = `"p1"` left / `"p2"` right, both scores, both paddle Ys, the ball, and `vsAi`). First to 7 (`SCORE_LIMIT`, mirrored on both sides) ends that match. This replaced the old P1-authority Supabase-broadcast model (`PongChannel`, deleted), which was jittery for the non-host.

  **Anti-tunneling (sub-stepping).** The ball physics + collisions are integrated in sub-steps of at most `SUBSTEP_MAX_PX` (5 px) per collision check, so a fast ball (up to `BALL_SPEED_MAX = 750` px/s, which at 60 fps would move ~12 px/tick and at the old 30 fps ~25 px/tick — wider than the ~17 px paddle contact window) can never jump past a paddle without registering the bounce. `resolveCollisions` checks the paddle bounce **before** the goal and returns `true` on a goal/relaunch to cut the sub-step loop. Before this fix the ball passed straight through the paddle at speed (it read as "the ball goes through the paddle the player moves").

- **The client owns only its paddle.** Each frame the local paddle follows local input immediately (mouse / arrows / W-S, combined — every player is on their own device controlling one paddle) and its Y is sent to the server at ~50 Hz (`BROADCAST_INTERVAL = 0.02`, `pg:paddle`) — deliberately frequent so the server's view of your paddle lags your local one as little as possible (the collision is resolved on the server with the Y it has, so a stale Y is what lets the ball pass where you see your paddle). The opponent paddle is interpolated toward the server's echoed Y (`smoothOpponentPaddle` / `PADDLE_LERP_RATE`). The ball is **predicted locally** with the real `Ball.update(dt)` using the latest `vx/vy/speed`, and reconciled *gently* toward the last snapshot extrapolated forward by `SNAPSHOT_LEAD` (`BALL_RECONCILE_RATE`); a snapshot that jumps more than `BALL_SNAP_DIST` (goal reset / relaunch / hard bounce) **snaps** instead of lerping. Same prediction/reconcile approach the old P2 used, now applied symmetrically on both sides.

- **Side comes from the server, not computed.** `initRoomMode` loads `room.players()` async (`boot()`), so the constructor can't know the pairing. The client just connects on `beginCountdown()` (`connectServer`) announcing `{code, nickname, roster}` and learns its `side` from the first `pg:state`; it never derives pairing itself, so there's no client/server drift. `hintFixed` sets the "sos J1/J2" hint once from that first snapshot.

- **Preroll keeps the countdown honest.** The server holds each match's ball frozen at center for `PREROLL_MS` (3s, matching the client's 3/2/1/YA) after building the match, then launches — so nobody loses a point before their countdown finishes. The match starts once all roster players connect, or after `START_GRACE_MS` (8s).

- **Disconnect = AI, not elimination.** A seated player who disconnects has their paddle driven by the server AI (`humanControls` checks `room.isConnected`); on rejoin (page reload) they resume control and get the current state via `emitStateTo`. Absent players still get a seat at start (the full roster is seated), so a partner always has a real match slot to come back to.

- **Scoring.** Each player reports their OWN goals via `this.room.reportScore(this.score)` on `pg:state.phase === "over"` (higher = better, the default board). Room scores never go to the global leaderboard.

- **Degradation.** In room mode **without** `VITE_GAME_SERVER_URL`, Pong falls back to a **local vs-AI** match per player (`updateUnpaired` + `checkCollisionsRoom`, first to 7) that still reports a score — so the room never gets stuck. Without `?room=` at all it's the normal solo endless mode.

- **Architecture files:**
  - `game/PongProtocol.ts` — transport interface + `PongMatchState` / `PongBall` types that **mirror** `server/src/protocol.ts` (duplicated per the decoupling rule; change both sides together).
  - `game/PongSocket.ts` — socket.io-client transport (dynamic import) against `/pong`; announces `{code, nickname, roster}`, forwards `pg:state`, sends `pg:paddle`.
  - `game/Game.ts` — routing in `update()`: `updateServer` (room + server), `updateUnpaired` (room, no server = local AI), `updateSolo` (no room). `onServerState` maps the snapshot into local score / opponent paddle / ball; `applyBallSnapshot` does the snap-or-reconcile.

Tuning that must stay in sync with the server (`server/src/games/pong.ts`) because the server duplicates the physics constants: `constants.ts` (view size, paddle/ball geometry, speeds, ramp) and `SCORE_LIMIT` (7). If you change ball/paddle tuning, change both files.
