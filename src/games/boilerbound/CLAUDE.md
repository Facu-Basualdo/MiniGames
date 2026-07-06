# Boilerbound

A boss-fight dodge survival set in a closed steampunk boiler room seen head-on
(fixed camera, Three.js). Steam jets erupt from a row of floor vents in
telegraphed **boss patterns**; touching a live jet is instant death. You survive
as long as you can — **score is time survived** (higher is better, shown as a
`m:ss.cc` clock). Inspired by *A Slight Chance of Sawblades* (the vent room),
*Iron Snout* (frantic reads) and Hollow Knight boss precision (fair tells + a
dash with i-frames). Difficulty ramps every 15 s and periodically enters an
**Overload** phase (red emergency light + everything twice as fast for 10 s).

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Models.ts` — preloads the Blender GLB props + the painted `backdrop.jpg` (`loadModels()`), see "3D models" below.
- `game/toon.ts` — the **cel-shading** toolkit: `makeToonGradient` (a hard N-step ramp texture) and `toonify(root, grad)` which swaps every `MeshStandardMaterial` under an object for an equivalent `MeshToonMaterial` (flat banded light/shadow). This is how the props match the hand-painted cartoon background — the look is a *shading* change, not a modelling one. `EmissiveMaterial` is the union type for the pulsed materials (porthole, vent glow).
- `game/Game.ts` — orchestrates scene/camera/renderer and the `loading → ready → countdown → playing → gameover` loop (`tick`). Renders through an **`OutlineEffect`** (`this.outline.render(...)`) which draws inverted-hull **ink outlines** around every mesh — the other half of the cartoon look. `toneMapping = NoToneMapping` for flat, vivid colours; no bloom / env map (the cartoon wants crisp, not glowy). Creates the shared `gradientMap` (`makeToonGradient`) and hands it to Room/Player/VentField so everything is cel-shaded. `init()` awaits `loadModels()` behind a "loading" state, then builds Room/Player/VentField. Owns **all dynamic lighting** (warm gas-lamp key + hemisphere ambient + two lamp `PointLight`s, cross-faded down during overload; a red `emergencyLight` `PointLight` pulsed by overload / the death flash — toon materials still respond to lights via the ramp), the **fixed camera** framed to fit the whole room box (`frameCamera`, recomputed on resize — critical for portrait phones), the collision check (`field.isPlayerHit` unless the player is dashing), and the death juice (steam + ember burst, red flash, camera shake, hidden diver, game-over overlay deferred 550 ms).
- `game/Player.ts` — the dodger (the `diver.glb` model, scaled to PLAYER_HEIGHT; primitive fallback), **cel-shaded** via `toonify` (a `gradientMap` ctor arg). Carries a soft cyan locator `PointLight` so it stays findable in the dark, and pulses its emissive porthole during the dash i-frames (the glow materials are collected *after* toonify so the refs point at the on-screen toon materials). 2D platformer physics in XY (`x` = centre, `y` = feet): run with ground/air accel + friction, **variable-height jump** (release cuts the ascent), **wall cling / wall jump** on the side walls (hang above the steam line), and a short **i-frame dash** (Shift). `update()` returns a `PlayerEvents` (`jumped`/`wallJumped`/`dashed`) the `Game` turns into sounds + sparks. `invulnerable` (dash i-frames) is what lets a dash slip through a jet.
- `game/SteamVent.ts` — one floor vent, a 3-state machine (`warning → active → dissipate`): red grille glow + pulsing `PointLight` + hissing chispas, then a `THREE.Points` jet of **cartoon smoke puffs** (`getPuffTexture`; `alphaTest` + `depthWrite` so front puffs occlude the ones behind and it reads as solid drawn smoke, not see-through rings) that is lethal via `hits()`, then a fading remnant that blocks vision but deals no damage. Owns its **cel-shaded** grille mesh (toonified per-vent so the red warning glow is independent), warn light and jet. Calls `onErupt` (steam hiss sound) at eruption.
- `game/VentField.ts` — the **boss-fight director**: owns every `SteamVent` and, on a shrinking timer, launches attack patterns whose mix/speed escalate with the difficulty level. Patterns: `single`, `cluster` (3 adjacent), `wave` (a staggered wall sweeping the room, run the other way) and `cage` (every column but one safe cell). Runs the **Overload** phase (period `OVERLOAD_PERIOD`, first at `OVERLOAD_FIRST_AT`), scaling all vent time by `OVERLOAD_TIME_SCALE`. Staggered wave triggers live in a `queue` advanced on the same scaled dt.
- `game/Particles.ts` — fire-and-forget additive spark pool (warning chispas, dash trail, death embers). Purely cosmetic. Additive material has no per-point alpha, so a spark fades by scaling its displayed colour toward black.
- `game/Room.ts` — the environment. In the cartoon look (default, when `backdrop.jpg` loaded) the **painted background carries the scenery** — arches, gears, pipes, lanterns and crystals are all in the image on a big back plane — so the only live geometry is the cel-shaded **floor** in front of it. The old procedural room (riveted panel + slowly turning bronze gears + gas-lamps) is kept as `buildFallbackRoom` and only appears if the backdrop image is missing. Everything is cel-shaded via `toonify`. Geometry only; Game drives the lighting. (The climbable side walls are gameplay, computed from the player's `x` in `Player`, not from a Room mesh.)
- `game/InputController.ts` — keyboard (A/D + arrows run, Space/W/Up jump, Shift/K dash) with edge-triggered jump/dash, plus the on-screen touch pad (left / right / jump / dash).
- `game/Hud.ts` — DOM overlay: live survival clock, start / game-over screens, countdown label, transient overload banner, leaderboard panel.
- `game/SoundEffects.ts` — synthesized Web Audio (countdown tick, jump, wall jump, dash whoosh, steam hiss, overload alarm, death). No assets.
- `game/dotTexture.ts` — two cached canvas sprites: `getDotTexture` (soft additive glow for the sparks) and `getPuffTexture` (a flat white **cartoon smoke puff** with a dark ink outline + cel-shadow band, used by the steam jets so they match the outlined toon look).
- `game/constants.ts` — **all tunable values** (room bounds, player physics, vent timing, difficulty ramp, overload, palette). Tune here first.

## Art direction: cel-shaded cartoon

Boilerbound uses a **hand-painted cartoon** look (Hollow Knight / Ori), which is
achieved by *shading + rendering*, not by the models themselves:

1. **Painted background** — `backdrop.jpg` is a hand-painted steampunk cavern
   (arches, mossy brass gears, pipes, warm lanterns, teal crystals) made with
   **Krea (img2img)** over a Blender **base-plate** (`tools/blender/baseplate.py`
   renders a clean 16:9 composition guide; source refs in `docs/`). `Room` maps
   it on a big back plane and it **carries the whole scenery** — no live gears.
2. **Cel-shading** — `toon.ts` swaps the props' PBR materials for
   `MeshToonMaterial` with a stepped `gradientMap`, so light falls in flat bands.
3. **Ink outlines** — `Game` renders through `OutlineEffect` (inverted-hull),
   drawing dark contours around every mesh. No bloom, `NoToneMapping`.

The Blender GLB geometry (below) is **reused as-is** under the toon materials —
the pivot from the earlier dark-PBR look was materials + render, not remodelling.

## 3D models (Blender)

The props are still **Blender-authored GLB models** (the procedural primitive
look was too bland), now cel-shaded at runtime.

- **Assets:** `public/models/boilerbound/` — `gear.glb` (fallback back cog),
  `diver.glb` (the player, diving suit w/ glowing cyan porthole), `pipes.glb`
  (fallback pipe/valve/gauge cluster), `vent.glb` (cast-iron steam grille), and
  **`backdrop.jpg`** — the Krea-painted cavern (see above). GLBs load with
  `GLTFLoader`, the backdrop with `TextureLoader`. (`tools/blender/backdrop.py`,
  the old rendered-diorama backdrop, is superseded by the Krea painting but kept
  for reference; `baseplate.py` is what feeds Krea's img2img.)
- **Source scripts:** `tools/blender/` — `_common.py` (helpers: PBR material,
  bmesh primitives, bevel/subsurf, `export_glb` with `export_yup=True`,
  `orient`), one script per model, and `preview.py` (renders a lit PNG/JPG to
  eyeball a model). Regenerate with:
  `blender --background --factory-startup --python tools/blender/<name>.py -- public/models/boilerbound/<name>.glb`
- **Graceful fallback:** every consumer (`Room` gears/pipes, `Player` diver,
  `SteamVent` grille) degrades to a primitive if its GLB is missing (`ModelSet`
  fields are optional) — gameplay never depends on the assets.
- **Orientation:** models face **-Y in Blender** so the y-up export lands them
  **facing the camera** (+Z). The gear is stood up (`orient` rx=90°) so it spins
  with a single `rotation.z`.
- **glTF caveat:** procedural node textures don't survive export — materials use
  solid PBR values; metal richness comes from geometry + the env map.
- Blender at `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`.

## Non-obvious decisions

**Fair kill box, faithful visuals.** A jet's lethal zone (`VENT_KILL_HALF`, checked in `SteamVent.hits`) is a **straight, constant-width band** capped at `STEAM_KILL_HEIGHT`. The steam column is tuned to **track that band closely** — puff centres stay inside it (`sBaseX` spread `* VENT_KILL_HALF * 0.85`), the column runs nearly straight (only a slight sway, not the old fan-out cone), `STEAM_SIZE` (~the kill width) keeps a single puff from being wider than the danger, and `STEAM_VISUAL_HEIGHT` sits just above `STEAM_KILL_HEIGHT`. The sprite radius adds a *small* generous overhang so clipping the very edge of the cloud, or clinging high on a wall above the steam line, still reads and plays as safe (the Hollow-Knight "looks fair, is fair" contract). During **dissipate** the jet lifts off the floor (no wrap) — that floating remnant is intentional and non-lethal. `VENT_KILL_HALF` is tuned so two adjacent active vents seal the gap between them (waves/cages are real walls) while a single vent leaves its neighbour cells clearly safe.

**Why the walls are climbable.** During a full `cage` or a `wave` the floor becomes an inferno; wall-jumping up and clinging above `STEAM_KILL_HEIGHT` is a legitimate escape for a couple of seconds (jets only live ~1 s). The wall cling caps fall speed (`WALL_SLIDE_SPEED`) so you can hold position.

**Dash = the panic button.** The dash grants `DASH_IFRAME_TIME` of invulnerability (slightly longer than the dash itself) and floats horizontally with no gravity, so a well-timed dash passes *through* a last-moment jet. It has a cooldown so it can't be spammed.

**Overload speeds everything via scaled dt.** `VentField.update` computes `sdt = dt * (overload ? OVERLOAD_TIME_SCALE : 1)` and advances every vent, the wave queue and the pattern timer on `sdt` — so warnings, jets and wave sweeps all double in tempo at once, and the pattern launches naturally get twice as frequent. The overload scheduler itself runs on real (unscaled) time.

**Camera must fit the room.** The room is a fixed box; `frameCamera()` picks the camera distance as the max of the height-fit and width-fit distances (with `CAMERA_MARGIN` slack) so the whole arena is visible on any aspect ratio — essential for narrow phone screens where the width is the binding constraint. Recomputed on every resize.

**Enter-to-start countdown.** From the start / game-over screen, Enter or a tap enters a `countdown` state showing 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` s each) with the shared 750 Hz tick before play begins. Mandatory shared pattern (see root `CLAUDE.md`).

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("boilerbound", { getScore: () => this.score, onStart: () => this.beginCountdown() })`. `getScore` is the live centiseconds survived (the timeout partial). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, the restart input is blocked (one run per round), and `onStart` auto-runs the countdown so everyone starts together. Without the param nothing changes.

## Scoring

Score is **time survived in centiseconds** — `direction: "higher"`, formatted as a `m:ss.cc` clock (`formatClock`). Declared in `meta.ts` (`export const scoring`).
