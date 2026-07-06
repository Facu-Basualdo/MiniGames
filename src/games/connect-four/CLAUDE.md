# Conecta 4 (connect-four)

Conecta 4 neon sobre un tablero de 7 columnas x 6 filas. Una jugada es elegir una
columna: la ficha "cae" hasta la casilla libre mas baja. Gana quien alinea 4
fichas propias en horizontal, vertical o diagonal. Si el tablero se llena sin
linea, es empate. Dos modos sobre el mismo tablero:

- **Solo (sin `?room=`)**: contra una **IA dificil**. El humano es el jugador 0
  (cian); la IA es el 1 (rosa) y abre cada partida (juega primero). Es un modo de
  **racha de supervivencia**: cada victoria suma 1 y arranca otra partida; la
  primera derrota termina la corrida y la racha lograda es el puntaje. Un
  **empate no rompe la racha** (se juega otra partida sin sumar). El ranking
  global es esa mejor racha.
- **Sala (`?room=`)**: **PvP** por turnos sobre tablero compartido (como Memoria
  y Ta-Te-Ti). Los dos asientos son los dos primeros jugadores de la sala (cian
  y rosa); si hay mas, miran. Gana 1, pierde 0; el empate reparte 0 a ambos (esos
  puntajes quedan en la sala, no van al ranking global).

## Module layout

- `main.ts` — entry point, monta `Game` en `#app`.
- `game/logic.ts` — **logica pura y serializable** (sin DOM ni red): `C4State`,
  `COLS`/`ROWS`/`SIZE`/`CONNECT`, `applyMove` (suelta en una columna + deteccion
  de linea de 4 desde la ultima ficha + empate por tablero lleno), `legalMoves`
  (columnas no llenas), `landingRow`. Es el mismo estado que viaja a Postgres en
  modo sala; solo y sala comparten estas transiciones.
- `game/ai.ts` — IA del modo solo: negamax con poda alfa-beta (`DEPTH = 6`) con
  la heuristica clasica de Conecta 4 en las hojas (puntua cada "ventana" de 4
  casillas segun fichas propias/libres, penaliza amenazas rivales, premia el
  control de la columna central). Explora del centro hacia afuera (`COL_ORDER`)
  para mejorar la poda. Fuerte pero vencible con amenazas dobles (lo que mantiene
  viable la racha). `WINDOWS` (todas las ventanas de 4) se precomputa una vez.
- `game/sharedMatch.ts` — controlador del modo sala (ver abajo).
- `game/Game.ts` — estados `ready | countdown | playing | over`, countdown
  3/2/1/YA compartido, modo solo (turnos humano/IA con `busy` que bloquea el
  input mientras la IA piensa o entre partidas), y delega el modo sala en
  `SharedMatch` al terminar el countdown. Un unico handler de columna
  (`handleColumn`) enruta a la logica solo o a `SharedMatch.handleColumn`.
- `game/Hud.ts` — DOM: tablero 7x6 (columnas clicables con 6 huecos cada una),
  fichas cian/rosa que caen animadas, **disco fantasma** translucido en la
  casilla donde caeria la ficha al pasar el mouse por una columna
  (`setPreviewColor` + `updateGhost`), overlay, countdown, franja superior y
  marcador de jugadores de la sala. La linea ganadora brilla (`is-win`).
- `game/constants.ts`, `game/SoundEffects.ts` (Web Audio sintetizado: ficha que
  cae con tono por jugador, ganar, perder, empate, countdown tick).

## Modo sala: como sincroniza

Estado durable en `public.room_match_state` (una fila jsonb por sala+ronda, ver
`supabase/rooms.sql` y `src/shared/room/matchState.ts`), con el patron estandar
de salas: **escribir -> ping broadcast "sync" -> los demas refetchean**, mas
poll de respaldo. Por turnos, la latencia por jugada no se nota.

- El estado guardado es `C4State` + `players` (los dos nicknames de cian y rosa)
  + `seq` (correlativo de jugadas, para sonar cada movimiento remoto una vez).
- **Un unico UPDATE atomico por jugada** con version optimista; **local-first**
  para el jugador de turno (su ficha se ve al instante) y `forceRefresh` readopta
  la DB ante conflicto de version.
- **El host crea el tablero** al cargar la pagina de la ronda si no existe, con
  `players` = los dos primeros de `room.players()` (orden por `joined_at`,
  deterministico). Con menos de 2 jugadores muestra "Esperando un rival...".
- **Anti-AFK**: si el jugador de turno no mueve en `AFK_MOVE_MS`, el host suelta
  una ficha en una columna al azar por el para que la partida avance. El deadline
  de ronda sigue siendo el corte duro.
- **Fin**: con `winner` definido, cada cliente reporta 1 (si gano) o 0 via
  `room.reportScore(...)`; el empate reporta 0; los espectadores reportan 0.
  Recargar a mitad de partida reengancha (el estado vive en Postgres y
  `SharedMatch.boot()` lo readopta).

Usa el contexto extendido de `RoomMode` (`code`, `me`, `round()`, `players()`,
`isHost()`, `ping()`, `onSync()`) igual que Memoria y Ta-Te-Ti.

## Integraciones estandar

- Countdown 3/2/1/YA compartido (`COUNTDOWN_LABELS`/`COUNTDOWN_STEP`,
  `beginCountdown`, `Hud.showCountdown`, blip `playCountdownTick`).
- Ranking global: scoring por defecto (`direction: "higher"`, mayor racha =
  mejor), asi que `meta.ts` no exporta `scoring`. Solo el modo solo envia al
  ranking (`hud.showRanking("connect-four", streak)`); el modo sala nunca (sus
  1/0 quedan en la sala).
- Modo sala: `initRoomMode("connect-four", { getScore, onStart: beginCountdown })`;
  el reintento en game over se bloquea con `if (this.room) return`.

## Gotchas

- **A diferencia de Ta-Te-Ti, aca si hay empate** (tablero lleno sin linea). En
  solo no rompe la racha (se rejuega); en sala reparte 0 a los dos.
- Solo el jugador de turno puede ganar en su jugada; `applyMove` chequea la linea
  desde la ultima ficha colocada, la unica que puede completar 4.
- El disco fantasma se calcula en el Hud a partir del ultimo tablero dibujado
  (`landingRow`), no del estado de logica: se limpia en cada `renderBoard` y al
  bloquear el tablero.
- La IA usa `DEPTH = 6`: subirlo la hace mas fuerte pero mas lenta (el arbol es
  mas grande a tablero vacio). Ajustar dificultad se hace con `DEPTH` y la
  heuristica en `ai.ts`.
