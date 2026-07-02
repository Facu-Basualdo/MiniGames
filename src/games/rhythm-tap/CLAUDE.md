# Rhythm Tap

Three-lane note-tapping game. Pieces of four **figures** (circle, triangle, diamond, square) fall down three columns; each figure has its own arrow key (left / up / down / right), independent of the lane. You press the piece's figure key as it crosses the hit line near the bottom (or, on touch, tap the column the piece is in). A hit is judged Perfecto / Bien by how close the piece was to the line; pressing with no matching figure in range, or letting a piece fall past the line, is a Fallo. Perfect/Good hits score points (with a combo bonus) and heal a little; misses drain a health bar. The run is endless and ends when health hits 0 — score survives as the local best. Plain 2D `<canvas>`, no Three.js.

**Figure and lane are decoupled.** `LANE_COUNT` (currently 3) is only position; `FIGURES` (4 shapes) is only identity. At spawn a piece picks a random lane and a random figure, independently — so any shape can fall in any column and the lane never tells you which key to press. The key comes from the figure, drawn on the piece plus a figure→key legend below the hit line.

**Figure presses flash the right column.** A key press is judged by figure across all lanes, so `NoteField` records `lastHitLane` (the column of the piece it cleared) and `Game` flashes that column for feedback — the lane is "taken into account" for the effect even though it isn't a correctness condition.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, the `ready → playing → dead` state machine and the `requestAnimationFrame` loop. Owns score/combo/health, the canvas→window letterbox scaling, and the inverse pointer→lane mapping.
- `game/NoteField.ts` — spawns/moves/recycles pieces (random lane + random figure), ramps difficulty (speed, spawn rate) with score, and resolves a press into the nearest piece's `Judgment` via `tapFigure(figure)` (match by shape, any lane) or `tapLane(lane)` (match by column). Also reports pieces that auto-missed by falling past the line.
- `game/Renderer.ts` — all canvas drawing (lane backdrop, hit line, neutral landing rings, pieces drawn as their figure with the key label, the figure→key legend, per-column flash), in view units. `drawFigure` traces each shape by its `FIGURES` name.
- `game/InputController.ts` — figure keys → `onFigure(figure)`; pointer → `onLane(lane)` (column under the tap).
- `game/Hud.ts` — DOM overlay (score, combo, best, health bar, judgment popup, start / game-over screens).
- `game/constants.ts` — all tunable values (lanes, speeds, spawn rate, judgment windows, scoring, health). **Tune here first.**

## Non-obvious decisions

**Fixed view box, scaled to fit.** Like the other games, everything is authored in a fixed `VIEW_WIDTH`×`VIEW_HEIGHT` (480×720 portrait) space and letterboxed into the window via `ctx.scale()` + `ctx.translate()` (with `devicePixelRatio` folded into the scale). All note/lane logic works in view units and never touches window pixels.

**Pointer→lane needs the inverse transform.** Because the view box is scaled/offset into the window, `Game.toViewX()` undoes that (`(clientX - rect.left) / fit - offsetX`) so a click maps to the correct lane. `InputController` is handed that function rather than reimplementing the math.

**No audio / no fixed chart.** There's no music track to sync against, so notes spawn on a timer (not on musical beats) and difficulty is driven purely by the score: `NoteField` raises fall speed and shrinks the spawn interval as points climb. "Rhythm" is the visual cadence of notes reaching the line, not an audio beat map.

**Two judgment modes, one piece pool.** Keyboard judges by figure (`tapFigure`) so a piece in any column is cleared with its figure key; touch judges by column (`tapLane`) since you physically tap where the piece is. Both share `NoteField.judge()`.

**Empty presses count as misses.** A press with no matching note inside `GOOD_WINDOW` returns `null` and `Game` treats it as a miss (breaks combo, drains health), so mashing is punished.

**`dt` is clamped** (`MAX_DT`) so a tab-switch or hitch can't integrate one giant step and teleport notes through the hit line.

**Enter-to-start countdown.** From the start or game-over screen, Enter (via the new `onStart` callback in `InputController`) or a figure-key / column tap enters a `countdown` state that shows 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` seconds each, in `Game.ts`) before play begins. `beginInput()` now returns `true` only while playing, so taps on a non-playing screen just kick off the countdown instead of being judged. `Hud.showCountdown(text | null)` renders the big centered label (styled by `.countdown` in `style.css`).
