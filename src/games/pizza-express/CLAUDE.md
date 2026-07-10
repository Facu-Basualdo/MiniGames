# Pizza Express

A Paperboy-style endless delivery runner in **Three.js**, set in a golden-hour
suburb ("Cheesetown"). You ride a red delivery scooter down an endless street:
**steer left/right to dodge road hazards** (instant death on contact) and **throw
pizzas at roadside mailboxes** that have a pending order (marked by a bright
downward **arrow**). Deliveries score points with a **combo multiplier**. A
customer passed undelivered breaks the combo **and costs a token**: you have a
one-time **shield** plus **3 pizza tokens** (shown top-left) — run out and the run
ends. It is a single infinite level whose speed, hazard density and customer pace
**ramp fast** after a 10-second tutorial. It is **PC-oriented** (keyboard; no
touch button). Solo score is total points (higher is better, default board). Art
direction: `DESIGN.md` ("Golden Hour Delivery"), based on the game's cover.

## Coordinate system

The road runs along **Z**. The scooter stays near `z = 0` while the world scrolls
toward the camera (**+Z**); obstacles and mailboxes spawn far ahead (negative Z)
and travel toward `+Z` (same convention as Space Rush / `vector-rush`). Y is up,
the road surface is `y = 0`. The scooter only moves in **X** (steering).

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates scene/camera/renderer/composer and the
  `ready → countdown → playing → gameover` loop (`tick`). Owns the warm
  golden-hour lights, the **chase camera** (behind + above, easing its X toward
  the scooter — `applyCamera`), the difficulty ramp (`difficulty()`, stepped),
  scoring + combo, throwing (`handleThrow`) and delivery (`deliver`), and the
  crash juice (dust/tomato particle burst, warm `crashFlash` PointLight, camera
  shake, hidden scooter, game-over overlay **deferred 600 ms**).
- `game/Street.ts` — the environment: a scrolling road + grass + dirt ground
  (endless via **UV-offset scroll** of canvas textures), a **wrapping pool** of
  roadside props (cottages, trees, hedges, fences, warm lamp posts) on both sides,
  and a static dusk sky (gradient dome, low sun + halo, drifting clouds, a hill
  silhouette baked into the sky texture). Purely decorative.
- `game/Scooter.ts` — the player: a primitive red scooter + rider (red cap,
  delivery box on the rear rack) cel-shaded; X steering with velocity smoothing,
  lean + yaw into turns, engine idle bob, spinning wheels, a headlight. Exposes
  `throwOrigin()` (world point a pizza launches from).
- `game/Obstacle.ts` + `game/ObstacleField.ts` — road hazards (cone, pothole,
  trashcan, crate, **car** = wide wall, angry **dog**), all **instant-death**.
  `ObstacleField` spawns rows that always leave a **guaranteed clear gap** the
  scooter can reach (see "Fairness" below); obstacles go *outside* the gap.
- `game/Mailbox.ts` + `game/MailboxField.ts` — customers. A `Mailbox` floats a
  bright bouncing **down-arrow** over it while `pending` (clearer than the old
  pizza icon); delivery flips its flag up. The field spawns them along the verges,
  tracks pending ones, reports **misses** (passed undelivered), and exposes
  `nearestPendingTarget()` for auto-aim.
- `game/Pizza.ts` — `PizzaThrower`: a pool of pizzas that **lob on a parabola**
  from the scooter toward the assigned pending mailbox (**homing** on the moving
  box), delivering on arrival via an `onDeliver` callback. A throw with no valid
  customer arcs to the verge and fizzles.
- `game/Particles.ts` — one additive point-cloud pool for cosmetic bursts (crash
  dust + delivery cheese-gold sparkle). Gravity + drag + colour fade.
- `game/InputController.ts` — steering (`dirX`, -1..1) from A/D + arrows or a
  pointer drag, plus **throw** edge-events from Space/W/Up/J/K and a quick tap on
  the canvas (a tap = throw, a drag = steer).
- `game/Hud.ts` — DOM overlay: score + **combo** + best, the **miss-token strip**
  (a cool inline-SVG shield + 3 warm pizza tokens, spent ones greyed), the tutorial
  **thought bubble** (above the character, with a down-tail), start/game-over
  screens (two titles: crash vs "perdiste muchos pedidos"), countdown label, and
  the leaderboard panel. No throw button (PC-oriented).
- `game/SoundEffects.ts` — synthesized Web Audio (countdown tick, throw whoosh,
  delivery ding whose pitch rises with the combo, miss blip, crash), no assets.
- `game/toon.ts` — cel-shading helpers: a cached stepped `gradientMap`, `toonMat`
  (a `MeshToonMaterial` factory) and `glowMat` (unlit / additive glow for
  markers, sun, sparks).
- `game/dotTexture.ts` — cached soft round sprite for the particles.
- `game/constants.ts` — **all tunable values** (road/field, speeds, difficulty
  ramp, `TUTORIAL_SECONDS`, `MISS_PIZZAS`, obstacle pacing + gap, mailbox pacing,
  throwing, scoring, palette). Tune here first.

## Core loop

- **Dodge:** the scooter (X only) must avoid every hazard. A single touch ends the
  run (instant death, like Space Rush / Cannon Dodge).
- **Deliver:** press throw (Space / W / ↑, or a canvas tap) and a pizza auto-lobs
  to the closest pending mailbox within `THROW_RANGE_Z` ahead. Delivery =
  `DELIVERY_BASE_POINTS × combo`; the combo climbs (capped at `COMBO_MAX`) with
  each delivery. Throw has a `THROW_COOLDOWN`.
- **Miss allowance:** a pending customer that passes you undelivered **resets the
  combo to 0 and spends a token**. The one-time **shield** (`shieldActive`) absorbs
  the first miss; after that each miss costs a pizza (`pizzasLeft`, from
  `MISS_PIZZAS`), and running out ends the run (game over, "misses" reason). This
  is the second failure mode besides crashing.
- **Tutorial (first `TUTORIAL_SECONDS`):** a gentle intro — **no lethal
  obstacles**, two thought-bubble hints (throw controls, then "position yourself on
  the side you want to throw to"), and misses are **free** (they only spend the
  shield, never a pizza, and can't end the run). The speed and difficulty ramp
  start **after** the tutorial (`playT = elapsed − TUTORIAL_SECONDS`).
- **Score** = total points (deliveries × combo). Higher is better, default board.

## Non-obvious decisions

**Fairness — the gap is always reachable.** `ObstacleField.spawnRow` picks a safe
gap `[gapX ± gapHalf]` whose centre drifts from the previous row by at most the
scooter's reachable travel (`SCOOTER_MOVE_SPEED × spacing/speed ×
GAP_REACH_FACTOR`), and shrinks with difficulty. Obstacles are placed **only
outside** that gap (`place()` confines each prop's full width to a blocked side
region), so the clear path is never blocked and never jumps farther than you can
steer — hard but never luck. A row adds a second obstacle on the other side with
growing odds (`DOUBLE_OBSTACLE_CHANCE_MAX`), and cars (wide) only spawn where they
fully fit.

**Difficulty is a stepped function of play time.** `Game.difficulty(playT)`
quantizes **post-tutorial** play time into levels (`DIFFICULTY_STEP_SECONDS`) so
the game visibly steps up, reaching its hardest values at `DIFFICULTY_RAMP_SECONDS`
(~60 s) then holding. It drives obstacle spacing, gap width, double-obstacle odds
and mailbox spacing. The travel **speed** ramps continuously (`BASE_SPEED →
MAX_SPEED`) off the same `playT`, and is held at `BASE_SPEED` during the tutorial.

**Throwing is a short lob, not a snipe.** `THROW_RANGE_Z` is deliberately short so
you deliver as a customer comes alongside (Paperboy timing), and the pizza homes
on the mailbox's *current* position each frame so it lands even though the box is
moving toward you.

**Auto-start / idle drift.** On the menus and during the countdown the street
keeps scrolling (idle `street.scroll`) so the town is never frozen; obstacles run
with an off-road scooter X (`999`) so nothing "collides" while idle.

**Enter-to-start countdown.** From the start / game-over screen, Enter / Space or
a tap enters a `countdown` state showing 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`,
`COUNTDOWN_STEP` s each) with the shared 750 Hz tick before play begins. Space
serves double duty: on the menus it starts (via `Hud`'s activate); while playing
`Game.handleActivate` ignores it (already playing) and it throws instead (via
`InputController`). Mandatory shared pattern (see root `CLAUDE.md`).

**Warm-only rendering.** `MeshToonMaterial` (cel bands) for props, `ACESFilmic`
tone mapping, and **gentle high-threshold bloom** so only the sun, order markers
and pizzas glow — not the whole warm scene. Fog is a peachy haze. No cold colours
anywhere (see DESIGN.md).

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("pizza-express",
{ getScore: () => this.score, onStart: () => this.beginCountdown() })`. `getScore`
is the live points for the timeout partial. With `?room=` in the URL the game-over
reports the score to the room instead of the global ranking, the restart input is
blocked (one run per round), and `onStart` auto-runs the countdown so everyone
starts together. Whoever scores the most points wins the round. Without the param
nothing changes.
