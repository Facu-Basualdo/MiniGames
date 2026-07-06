# Helix Jump

Juego 3D donde guías una bola rebotadora a través de una torre vertical giratoria de plataformas con huecos y obstáculos. El jugador rota la torre para alinear los huecos con la bola. Si la bola cae a través de múltiples niveles de una vez, entra en un modo "fireball" que destruye la siguiente plataforma.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — owns scene/camera/renderer/lights, vertical camera tracking, the `ready → playing → gameover` state machine and the `setAnimationLoop` tick. Also owns collision detection (ball-to-platform check) and scoring.
- `game/Ball.ts` — the player sphere: bounce physics, squash & stretch animation, the fireball visual state, and the trailing visual effects.
- `game/Tower.ts` — the procedural cylinder and platform levels generator, using an extruded shareable geometry for circular sectors, and owns platform-breaking physics.
- `game/InputController.ts` — pointer drag (touch/mouse) and keyboard input (Arrow keys, A/D, Enter/Space).
- `game/Hud.ts` — DOM overlay (live score, best score, start / game-over screens).
- `game/SoundEffects.ts` — synthesized Web Audio effects (bounce, fireball shatter, level pass, death swoop, and countdown blips).
- `game/constants.ts` — all tunable values (layout, speeds, colors, dimensions). **Tune here first.**

## How the physics and collisions work

**The ball only moves vertically.** Its X and Z are locked at `(0, 1.45)` relative to the tower. The player rotates the tower around its Y axis, which rotates the platforms relative to the ball.

**Collision detection.** When the ball falls and passes a platform level's Y boundary, we map the tower's rotation to local space to find which segment index is currently beneath the ball. Formula: `(1.5 * Math.PI - towerRotation) % 2*PI` mapped to `SEGMENTS_PER_LEVEL` (12 segments).
- If the segment is "empty": the ball continues falling, triggering the combo counter.
- If the segment is "normal": the ball bounces, unless in fireball mode, where it breaks the platform level instead and continues falling.
- If the segment is "obstacle": game over, unless in fireball mode, which breaks it.

**Fireball Combo.** Passing 3 or more levels in a single fall triggers fireball mode. The ball turns orange/red with a thick trail, and breaks the next platform it hits.

## Non-obvious decisions

**Camera & Light Follow.** To prevent shadows from clipping and keep ambient lighting consistent, the directional light target, shadow camera bounds, and light position slide vertically in sync with the ball's Y height.

**Extruded Beveled Geometry.** Platform segments are drawn as a 2D shape (a circular sector with a hole) and then extruded with a bevel using `THREE.ExtrudeGeometry`, which is rotated flat onto the XZ plane. This is shared between all segments and levels to minimize memory allocation.

**Shatter Simulation.** When a level breaks, its individual segment meshes are detached from the level group and animated with independent radial outward velocities, gravity, and randomized rotation. They fade out and are destroyed after 1.2 seconds.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("helix-jump", { getScore: () => this.score })`. With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
