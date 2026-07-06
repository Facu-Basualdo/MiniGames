# Western Shoot

Tiro al blanco del viejo oeste sobre canvas 2D. Se apunta con el mouse y se
dispara con click. El `Spawner` va sacando tres tipos de objetivos:

- **Dianas** (`Target`): dan puntos segun tamano (grande 10, media 25, chica 50).
- **Civiles** (`Civilian`): dispararles resta `CIVILIAN_PENALTY` (100) puntos.
- **Enemigos** (`Enemy`): aparecen, y si no se los derriba a tiempo disparan y
  quitan una vida (`takeDamage`).

Un disparo al vacio resta `MISS_PENALTY` (20). La dificultad sube por oleadas
(`DIFFICULTY_INTERVAL`), acelerando spawns y velocidades.

Modo normal: se empieza con `INITIAL_LIVES` (3) y la partida termina cuando se
acaban las vidas. Countdown 3/2/1/DRAW! obligatorio (ver root `CLAUDE.md`).

## Modo sala (multiplayer)

Cableado al modo fiesta compartido (ver root `CLAUDE.md`, "Salas"):
`initRoomMode("western-shoot", { getScore, onStart: beginCountdown })` en el
constructor. Con `?room=` en la URL la ronda cambia de "por vidas" a **a
tiempo**: dura `ROOM_ROUND_SEC` (60 s) fijos y gana quien mas puntos hizo
(`GAME_SCORING["western-shoot"]` es `direction: "higher"`).

Diferencias respecto al modo normal cuando `this.room` esta activo:
- No hay vidas: el disparo enemigo solo sacude la pantalla, no termina la
  partida (`takeDamage` retorna antes de descontar). El HUD oculta el indicador
  de vidas (`setLives(-1)`) y muestra un contador `TIEMPO Ns` (`setTimer`).
- Un timer de 60 s en el loop llama a `gameOver()` al llegar a 0.
- `gameOver` reporta el puntaje a la sala (`this.room.reportScore`) en vez de al
  ranking global; el input de reinicio queda bloqueado (`onPrimary` retorna si
  hay sala, una sola partida por ronda) y el inicio lo dispara `onStart`.

Nota: la sala tiene su propio tope de ronda configurado por el host; el timer de
60 s del juego es independiente. Si el host fija un tope menor, la sala corta el
puntaje parcial antes; si es mayor, el juego reporta a los 60 s y la sala cierra
apenas todos reportan.
