# Ta-Te-Ti (tic-tac-toe)

Ta-Te-Ti (Tres en raya) neon **sin empates**. Regla que elimina el empate: cada
jugador mantiene como maximo 3 fichas; al colocar la 4ta se elimina primero la
1ra que puso, asi el tablero nunca se llena (siempre queda al menos una casilla
libre) y la partida sigue hasta que alguien arma una linea de 3. El tope de
fichas es la constante `MAX_PIECES` en `logic.ts`. Dos modos sobre el mismo
tablero 3x3:

- **Solo (sin `?room=`)**: contra una **IA dificil**. El humano es X; la IA es O
  y abre cada partida (juega primero). Es un modo de **racha de supervivencia**: cada
  victoria suma 1 y arranca otra partida; la primera derrota termina la corrida
  y la racha lograda es el puntaje. El ranking global es esa mejor racha.
- **Sala (`?room=`)**: **PvP** por turnos sobre tablero compartido (como
  Memoria). Los dos asientos son los dos primeros jugadores de la sala (X y O);
  si hay mas, miran. Como no hay empate, siempre sale un ganador: gana 1, pierde
  0 (esos puntajes quedan en la sala, no van al ranking global).

## Module layout

- `main.ts` — entry point, monta `Game` en `#app`.
- `game/logic.ts` — **logica pura y serializable** de la variante ciclica (sin
  DOM ni red): `TttState`, `MAX_PIECES` (tope de fichas = 3), `applyMove`
  (implementa el borrado de la ficha mas vieja al llegar al maximo + deteccion
  de linea), `legalMoves`, `pieceToRemove`
  (casilla por desaparecer, para atenuarla). Es el mismo estado que viaja a
  Postgres en modo sala; solo y sala comparten estas transiciones.
- `game/ai.ts` — IA del modo solo: negamax con poda alfa-beta (`DEPTH = 8`) sobre
  la variante ciclica, evaluada siempre desde la perspectiva de la IA. Como no
  hay empate el arbol se acota en profundidad y usa una heuristica de control de
  lineas en las hojas; el ajuste por profundidad hace que prefiera ganar cuanto
  antes y demorar las derrotas. Fuerte pero vencible con dobles amenazas (lo que
  mantiene viable la racha).
- `game/sharedMatch.ts` — controlador del modo sala (ver abajo).
- `game/Game.ts` — estados `ready | countdown | playing | over`, countdown
  3/2/1/YA compartido, modo solo (turnos humano/IA con `busy` que bloquea el
  input mientras la IA piensa o entre partidas de la racha), y delega el modo
  sala en `SharedMatch` al terminar el countdown. Un unico handler de casilla
  (`handleCell`) enruta a la logica solo o a `SharedMatch.handleCell`.
- `game/Hud.ts` — DOM: tablero 3x3 con marcas SVG neon (X cian, O magenta),
  overlay, countdown, franja superior y marcador de jugadores de la sala. La
  ficha por desaparecer se atenua (`is-removable`) y la linea ganadora brilla
  (`is-win`).
- `game/constants.ts`, `game/SoundEffects.ts` (Web Audio sintetizado: colocar,
  eliminar ficha vieja, ganar, perder, countdown tick).

## Modo sala: como sincroniza

Estado durable en `public.room_match_state` (una fila jsonb por sala+ronda, ver
`supabase/rooms.sql` y `src/shared/room/matchState.ts`), con el patron estandar
de salas: **escribir -> ping broadcast "sync" -> los demas refetchean**, mas
poll de respaldo. Por turnos, la latencia por jugada no se nota.

- El estado guardado es `TttState` + `players` (los dos nicknames de X y O) +
  `seq` (correlativo de jugadas, para sonar cada movimiento remoto una vez).
- **Un unico UPDATE atomico por jugada** con version optimista; **local-first**
  para el jugador de turno (su ficha se ve al instante) y `forceRefresh` readopta
  la DB ante conflicto de version.
- **El host crea el tablero** al cargar la pagina de la ronda si no existe, con
  `players` = los dos primeros de `room.players()` (orden por `joined_at`,
  deterministico). Con menos de 2 jugadores muestra "Esperando un rival...".
- **Anti-AFK**: si el jugador de turno no mueve en `AFK_MOVE_MS`, el host juega
  una casilla al azar por el para que la partida (que no puede empatar) avance
  hasta un ganador. El deadline de ronda sigue siendo el corte duro.
- **Fin**: con `winner` definido, cada cliente reporta 1 (si gano) o 0 via
  `room.reportScore(...)`; los espectadores reportan 0. Recargar a mitad de
  partida reengancha (el estado vive en Postgres y `SharedMatch.boot()` lo
  readopta).

Usa el contexto extendido de `RoomMode` (`code`, `me`, `round()`, `players()`,
`isHost()`, `ping()`, `onSync()`) igual que Memoria.

## Integraciones estandar

- Countdown 3/2/1/YA compartido (`COUNTDOWN_LABELS`/`COUNTDOWN_STEP`,
  `beginCountdown`, `Hud.showCountdown`, blip `playCountdownTick`).
- Ranking global: scoring por defecto (`direction: "higher"`, mayor racha =
  mejor), asi que `meta.ts` no exporta `scoring`. Solo el modo solo envia al
  ranking (`hud.showRanking("tic-tac-toe", streak)`); el modo sala nunca (sus
  1/0 quedan en la sala).
- Modo sala: `initRoomMode("tic-tac-toe", { getScore, onStart: beginCountdown })`;
  el reintento en game over se bloquea con `if (this.room) return`.

## Gotchas

- **La misma regla ciclica corre en solo y en sala**: es la identidad del juego
  (sin empates). En solo hace que la racha vs IA sea posible (un Ta-Te-Ti clasico
  vs IA perfecta siempre empataria); en sala garantiza un ganador.
- Solo el jugador de turno puede ganar en su jugada; `applyMove` primero borra la
  ficha vieja y despues coloca, luego chequea linea (el borrado nunca hace ganar
  al rival).
- La IA usa `DEPTH = 8`: si se sube mucho, el arbol sin terminales de empate se
  vuelve caro. Ajustar dificultad se hace con `DEPTH` y la heuristica en `ai.ts`.
