## Controls

Keyboard (arrows / A-D rotate, W / Up thrust, Space fire, Enter start) plus
on-screen touch buttons on mobile (`InputController.createMobileControls`, shown
after the first `touchstart`).

**Mouse (desktop) lives in `Game.ts`, not `InputController`**, because aiming
needs the ship's position: `pointermove` / `pointerdown` / `pointerup` handlers
gated on `e.pointerType === "mouse"` (so touch keeps using the buttons) track the
cursor and mouse buttons. Each frame, when no rotation key is held, `aimToward`
turns the ship toward the cursor **capped at `SHIP_ROTATION_SPEED`** (same turn
limit as the keyboard, so mouse aim doesn't trivialize the game). Left click
fires a laser; right click held applies thrust (`contextmenu` is suppressed).
The ship uses full-window coordinates (canvas fills the window, no letterbox), so
`clientX/clientY` map straight to game space.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("asteroids", { getScore: () => this.score })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
