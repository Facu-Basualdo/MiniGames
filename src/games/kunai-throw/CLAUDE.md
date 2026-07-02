# Kunai Throw

Throw kunais (space / tap) into a rotating wooden log without letting a thrown kunai hit one already stuck in it. A "Knife Hit"-style game. 2D canvas, no framework, self-contained (no shared engine code).

## Mechanics

- The log spins in the upper half of the screen. Pressing Space (or tapping) launches the ready kunai straight up; when its tip reaches the bottom of the log it either sticks or fails.
- Only one kunai is in flight at a time. Landing is resolved by angle, not by pixel collision:
  - Impact always happens at the log's **bottom point**, `IMPACT_ANGLE = PI/2` (canvas y-down, so straight down).
  - The stuck kunai stores a **relative angle** = `IMPACT_ANGLE - log.rotation`; its world angle is `relAngle + rotation`, so it rotates with the wood.
  - A landing fails if any existing kunai is within `COLLISION_ANGLE` radians of the impact angle -> game over.
- Clear a level by sticking all `levelTarget` kunais (`KUNAIS_BASE + level - 1`). Higher levels increase rotation speed, add direction reversals (level >= 3), sine-wave speed pulses (level >= 5) and pre-placed obstacle kunais (golden, up to 6).

## Drawing

- `Kunai.ts` exports `drawKunai(ctx, tipX, tipY, pointAngle, enemy?)`: draws blade + wrapped handle + pommel ring with the **tip at the origin** and the body extending backwards (local -x). `pointAngle` is the direction the tip points to.
  - In-flight / ready kunai: tip up -> `pointAngle = -PI/2`.
  - Stuck kunai: tip points inward (toward the log center) -> `pointAngle = worldAngle + PI`, tip placed at `radius - KUNAI_EMBED`.
- `Log.ts` owns rotation state, the stuck list, the rotation pattern per level, and renders the wood (bark ring, radial gradient face, rotating growth rings) plus the remaining-ammo number in its non-rotating center.

## Countdown (mandatory shared pattern)

Implements the repo-wide Enter-to-start 3 / 2 / 1 / YA countdown: `Game.ts` has a `countdown` state with `beginCountdown()` and uses `COUNTDOWN_LABELS` / `COUNTDOWN_STEP`; `Hud.showCountdown(text | null)`; `.countdown` + `countdown-pop` keyframes live in `style.css`.

## Tuning knobs (constants.ts)

- `COLLISION_ANGLE` — fairness of the fail threshold (bigger = harder).
- `KUNAI_SPEED` — flight speed (kept high so throws feel instant).
- `KUNAIS_BASE` — kunais to clear level 1.
- `LOG_RADIUS`, `KUNAI_LENGTH`, `KUNAI_EMBED` — geometry.
- Rotation pattern (speed ramp, reversals, sine pulses, obstacle count) is set in `Log.setLevel()`.
