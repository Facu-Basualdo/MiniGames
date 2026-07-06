
## Collisions

The frog is always logically inside its own lane row (`frog.gridY` picks the lane), so hit-testing is a **1D horizontal** test, not an AABB — done in `Game.update`:

- The frog's centre is `frog.x + GRID_SIZE/2` (uses the interpolated render `x`, so deaths stay in sync with what's on screen).
- `Obstacle.overlapsX(cx, half)` / `Obstacle.containsX(cx)` test against the obstacle's **visible** body (inset `VISUAL_INSET = 3px` from the raw AABB, since cars/logs are drawn inset). This is what fixed the old "muere cuando no debería": the previous padded AABB counted a ~4px visible gap as a hit.
- Roads: die when the frog's hitbox (`FROG_HITBOX_HALF = 9`, slightly smaller than the 10px body so near-misses survive) overlaps a car's visible body.
- Rivers: the frog floats when **at least `MIN_SUPPORT_OVERLAP` (5px) of its body** (`Obstacle.overlapX(cx, FROG_SUPPORT_HALF)`) overlaps a log/turtle, so landing on the edge/side still counts (the safe window for the frog centre runs ~5px past each visible platform edge). This replaced an exact-centre-point test that felt like a coin flip at the edges. Otherwise it drowns. `Frog.update` still handles being carried off-screen by a log.

If tuning fairness: raise `FROG_HITBOX_HALF` (constants.ts) to make cars deadlier, lower it to be more forgiving; raise `MIN_SUPPORT_OVERLAP` for stricter river landings, lower it to be more forgiving; `VISUAL_INSET` (Obstacle.ts) must track how far obstacle bodies are drawn inside their cell.

## Spawn de obstaculos (lanes)

`createLane` fija `spacing = ancho + hueco` para cada lane (autos: hueco 110-200px; troncos/tortugas: hueco 40-70px ~ 1 celda), asi los obstaculos **nunca se solapan** y los huecos de agua son visibles y consistentes (antes el `spacing` era aleatorio e independiente del ancho, los nenufares/troncos se apilaban y el jugador saltaba a lo que parecia plataforma y caia al agua). `populateLane` los reparte parejos sobre un anillo de largo `wrapWidth = count * spacing`; cada `Obstacle` guarda ese `wrapWidth` y hace wrap modulo sobre el anillo, por lo que conservan el espaciado para siempre (sin acumularse) y ambos bordes del wrap quedan fuera de pantalla (sin pop-in). Para cambiar la dificultad del rio, ajustar el hueco en la rama `river` de `createLane`: menos hueco = plataformas mas faciles de pisar.

## Rendering

`game/Renderer.ts` is 2D canvas, neon-on-dark. Lanes: grass (two-tone turf + stable scattered tufts / pebbles / glowing flowers), road (asphalt gradient + dashed yellow centre line, dash offset per row), river (deep-water gradient + two layered animated ripples). Obstacles: cars (body + darkened cabin/windshield, gloss strip, wheels, leading headlights), logs (bark gradient + end-grain rings + grain line), turtles (segmented shell + head poking in the travel direction). The frog has a hop arc, a ground shadow that shrinks mid-hop, and a belly highlight. Per-row decorations are seeded by `rowRandom(row, salt)` so they stay put instead of flickering each frame.

## Sound

`game/SoundEffects.ts` synthesizes all audio with the Web Audio API (no assets): a blip on each hop, a wet plop on a river drowning, and a harsh squash on a car hit or falling off screen. `killFrog(cause)` picks the death sound from its `"water" | "crash"` cause.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("mini-frogger", { getScore: () => this.score })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game-over reports the score to the room instead of the global ranking, and the restart input is blocked (one run per round). Without the param nothing changes.
