# Ring Runner

Single-player timing game. A marker orbits a white ring that has one black
target arc. The player taps (space / click / touch) at the moment the marker is
crossing the black arc. A correct tap scores a point, relocates the target to a
new spot, shrinks it, and speeds up the marker; a mistimed tap (marker outside
the arc) ends the run. Plain 2D `<canvas>`, no Three.js.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, the `ready -> countdown -> playing
  -> dead` state machine, the orbit/target math, hit detection, scoring, and the
  `requestAnimationFrame` loop. Owns canvas-to-window letterbox scaling.
- `game/Hud.ts` — DOM overlay (start / game-over screens, countdown). The live
  score is drawn inside the ring on the canvas, so the top HUD score element
  stays hidden.
- `game/SoundEffects.ts` — synthesized Web Audio effects (no assets): countdown
  tick, a rising hit blip whose pitch climbs with the combo, and a descending
  miss buzz.
- `game/constants.ts` — all tunable values (ring geometry, speeds, target sizing
  and shrink, relocation spread, countdown timing). **Tune here first.**

## How the motion works

Everything is angular. `markerAngle` advances by `direction * angularSpeed * dt`
(wrapped mod 2π); the marker is a thin radial bar ("|") drawn across the ring at
that angle (from `R - halfLen` to `R + halfLen` along `cos/sin`), kept thin so
the exact hit point is unambiguous. The target is an arc defined by `targetCenter` and a
half-width `targetHalf` (the drawn arc spans `center ± half`). A tap is a **hit**
when `angDiff(markerAngle, targetCenter) <= targetHalf`, where `angDiff` is the
shortest wrapped distance (0..π), else it is a miss and the run ends.

## Difficulty ramp (the whole game)

On every hit: `angularSpeed += ANGULAR_SPEED_INCREMENT` (capped at
`MAX_ANGULAR_SPEED`), `targetHalf -= TARGET_HALF_SHRINK` (floored at
`MIN_TARGET_HALF`), and the target is relocated a random distance ahead of the
marker (`RELOCATE_MIN/MAX_AHEAD`, measured in the current travel direction so
there is always chase distance). With chance `REVERSE_CHANCE` the marker flips
direction on a hit, so the player can't just memorize a rhythm.

## Non-obvious decisions

**Waiting is safe; only a wrong tap kills.** The marker can pass over the target
without penalty — the player may wait for a better pass. The single failure
condition is tapping while the marker is outside the arc. Difficulty rises only
on hits, so the pressure comes from the ever-faster, ever-smaller target, not
from a stall timer. In room mode the round time limit bounds any stalling.

**Black arc, haloed so it reads.** A pure-black arc on the dark background would
look like a gap, so the target is stroked in near-black with a neon magenta (`#ff007f`)
`shadowBlur` glow (brighter while the marker overlaps it). Additionally, radial caps
border the target segment to define its edges cleanly. The marker is a bright neon cyan
`#00f3ff` that flashes white with a green shadow on a successful hit (`hitFlash`).

**Visual juice (trail).** The marker leaves a trailing motion blur effect
consisting of faded, thinner markers behind it. The game UI and background use dynamic
radial gradients, cyberpunk background grids, and Orbitron and Outfit Google Fonts.

**`dt` is clamped** (`MAX_DT`) so a tab-switch/hitch can't advance the marker a
huge angular step past the target.

**Enter-to-start countdown.** Standard repo pattern: 3 / 2 / 1 / YA
(`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` in constants.ts), with a 0.6 s restart
guard after dying so the killing tap doesn't instantly restart.

**Scoring is the default** (`direction: "higher"`, score = hits), so `meta.ts`
declares no `scoring` block.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls
`initRoomMode("ring-runner", { getScore: () => this.score, onStart: () =>
this.beginCountdown() })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)").
With `?room=` in the URL the game-over reports the score to the room instead of
the global ranking and the restart tap is blocked (one run per round). The
timeout partial is the live hit count. Without the param nothing changes.
