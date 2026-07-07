# Neon Sawblades

Arcade high-score chaser inspired by *A Slight Chance of Sawblades*. Neon sawblades rain from the top of a single fixed room and bounce around; you run left/right along the floor and **jump *over* a blade to destroy it**. Destroying a blade drops a coin — collect it before it vanishes to score points and buy time. A clock is always draining: destroying blades and grabbing coins add seconds; when it hits zero the run ends. Touching a blade in any way other than clearing it from above also ends the run. Plain 2D `<canvas>`, no Three.js. This is the "Classic" mode only (the original's Phantom / Barrage modes are out of scope for now).

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, the `ready → countdown → playing → dead` state machine, the clock, and the `requestAnimationFrame` loop. Also owns the canvas→window letterbox scaling.
- `game/Player.ts` — the runner: horizontal movement, gravity, and the variable-height double jump. `x` is the horizontal centre, `y` is the feet (bottom).
- `game/SawbladeField.ts` — owns every sawblade and coin: spawning (with a `MIN_SAWS` fast-refill so the room is never near-empty), bounce physics, the clear/death collision rules, and coin collection. `update()` returns a `FieldResult` the `Game` applies (score / time / sounds / particle `bursts`).
- `game/Renderer.ts` — all neon canvas drawing (starfield + dim city skyline + scanline background, animated perspective floor grid, blades, coins, player + motion trail), in view units. Owns the `stars` and `trail` buffers plus the baked static layers (`skyCanvas`, `overlayCanvas`) and the baked entity sprites (saw / coin / player). The player is a cyan block with little stubby feet and a deliberately minimal angry face — just solid black eyes and angled brows, centred in the body (an earlier version with an open mouth / tongue / sweat drop was cut for the cleaner look).
- `game/sprites.ts` — the glow-baking helpers: `bakeSprite` (offscreen canvas at `SPRITE_SCALE` = 2x view units, centre-anchored) and the per-colour `glowDot` cache used by the trail and the particles. See the performance note below.
- `game/Particles.ts` — a tiny fire-and-forget spark pool for burst effects (blade destroyed, coin collected, death). Owned by `Game`, drawn by `Renderer.draw`. Each spark blits a `glowDot` sprite, never a live `shadowBlur`.
- `game/InputController.ts` — keyboard (arrows/A-D move, Space/W/Up/Enter jump) plus the on-screen touch buttons (left / right / jump). Movement is a held state (`dir`); jump is a press+release action so hold time controls jump height. Touch buttons stop propagation so they don't also fire the container's jump/start tap.
- `game/Hud.ts` — DOM overlay (live score, best, start / game-over screens, countdown label, leaderboard panel).
- `game/SoundEffects.ts` — synthesized Web Audio effects (countdown tick, jump, blade-destroy slice, coin blip, death thud), no assets.
- `game/constants.ts` — all tunable values (physics, spawn ramp, coin/timer economy). **Tune here first.**
- `DESIGN.md` — the art direction ("Machined Light"): neon treated as a physical material, glow proportional to its bright core, machined geometry over balloon shapes, fixed cyan/magenta/gold vocabulary. Read it before touching any visuals; every sprite bake in `Renderer.ts` answers to it.

## Non-obvious decisions

**Fixed view box, scaled to fit.** Authored against a fixed `VIEW_WIDTH`×`VIEW_HEIGHT` (640×800 portrait) space so physics constants feel identical at any window size; `Game.render()` letterboxes it with `ctx.scale()`/`translate()` (dpr folded in).

**"Jump over" = destroy, everything else = death.** The core rule lives in `SawbladeField.update()`. Any actual contact (box-vs-circle) with a blade is lethal — full stop. You destroy a blade only by clearing it with a real over-arc, tracked per blade in two phases via `saw.arc`:
1. **Arm** — the moment the player *crosses the blade's centre-x* while airborne with their feet above the blade's top edge, `saw.arc` records the side they're heading to. (Just being above it, or clipping past the side, does nothing.)
2. **Confirm** — once armed, the clear fires when the player *descends to the blade's current base* (`player.y >= saw.y + SAW_RADIUS`) on that same far side. If the player turns back to the entry side first, the arc cancels.

Because touching the blade kills, the only way to reach the far-side base without dying is to have moved fully past the blade — so the two-phase check enforces the complete jump-*over* the player expects (it confirms on the way **down** on the other side, not at the apex). This replaced an earlier "destroy on centre-cross" rule that fired too early (mid-air, or on a high/side pass).

**Coins must be collected to count.** Destroying a blade only spawns a coin and grants a small time bonus; the *points* come from collecting the coin, which also grants a larger time bonus. Coins have a lifetime (`COIN_LIFETIME`) and blink out near the end, so scoring means committing to grab them — the risk/reward of the original.

**The clock is the fail state — but invisible.** `timeLeft` drains in real time, capped at `MAX_TIME` so seconds can't be hoarded. The on-screen time bar was removed on purpose: in practice you always die to a blade long before the clock runs out, so the bar was noise — the timer still runs silently as a fail-safe. Score is coins collected (`direction: "higher"`, the default — so `meta.ts` declares no `scoring`).

**Variable jump height.** `Player.jump()` fires the first jump at `JUMP_VELOCITY`; releasing the button while still rising cuts the velocity to `JUMP_CUT`, so a tap is a short hop and a hold is a full jump. A second (fixed `DOUBLE_JUMP_VELOCITY`) jump is allowed in the air. Keyboard auto-repeat is ignored (`e.repeat`) so holding the key can't burn the double jump instantly.

**All glow is baked, never per-frame `shadowBlur`.** Canvas `shadowBlur` rasterizes + gaussian-blurs a temp surface on every fill/stroke; with a blur per spark/trail node/blade/coin it made integrated GPUs stutter during coin bursts. So every glowing element is pre-rendered once (blur included) via `sprites.ts` at 2x view resolution, and the frame loop only does `drawImage`: `skyCanvas` (gradient) + twinkling stars + `overlayCanvas` (dim city, neon columns, scanlines, floor glow line + grid rows) + sprite blits for saws (rotated at blit time), coins, player and glow dots (trail/sparks, scaled per node — so their glow now scales with the dot instead of being a fixed 12px, visually equivalent). Only unblurred strokes/arcs (stars, floor skew lines) are drawn live. Don't reintroduce `shadowBlur` in the frame path.

**Entities are drawn as manufactured objects (DESIGN.md).** The saw is a machined blade: 11 flat-topped hooked teeth (not a needle starburst), gunmetal radial-gradient disc, a bolt circle of lightening holes, a machining groove and a layered arbor, with a thin hot rim instead of a thick outline. The coin is a minted token — beveled edge lit from the top-left, darker face, struck ring groove, one specular arc — and spins at draw time (the blit width oscillates on `|cos|`, phase-offset by `x` so coins don't spin in unison). The player keeps its angry-block identity but machined: corner radius 7, top-edge rim light plus lower shade instead of a full sticker outline, thinner brows. The background: deeper 3-stop sky, light spill below the floor line, grid rows fading with distance, and a baked vignette in the overlay.

**The city is cached atmosphere, not scenery.** `Renderer.buildCity()` renders the skyline once into an offscreen canvas that `buildOverlay` composites dim (`globalAlpha ≈ 0.7`) into the static `overlayCanvas`. It's built as *lighting* (following the neon-ambience read of Keepers! / Barra Libre): an additive horizon "light-pollution" glow, dark building silhouettes that cut into it, a few soft additive signs, and a low haze band — rather than flat silhouettes with lots of little windows. Kept deliberately dim so it never competes with the blades. The look derives from the game's key art (`public/covers/neon-sawblades.jpg`).

**Visual polish is cosmetic and decoupled.** Sparks (`Particles`), the player's motion trail, the starfield/scanlines, and the death screen-shake (`shakeTime` in `Game`, applied as a world-space jitter inside the letterbox clip) never touch gameplay state — the field reports event positions as `FieldResult.bursts` and `Game` turns them into effects. `beginCountdown()` clears the particles and resets the trail so a new run starts clean.

**Enter-to-start countdown.** From the start / game-over screen, Enter (or a tap) enters a `countdown` state showing 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` s each) with the shared 750 Hz tick before play begins. Mandatory shared pattern (see root `CLAUDE.md`).

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("neon-sawblades", { getScore: () => this.score, onStart: () => this.beginCountdown() })`. With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, the restart input is blocked (one run per round), and the round auto-starts via `onStart`. Without the param nothing changes.
