# Mundialopoly 2026 (monopoly-mundial)

Monopoly clasico retematizado como Mundial 2026 (Mexico / EE.UU. / Canada). Tablero CSS grid 11x11 + panel lateral (jugadores, acciones, historial). Estetica **album Panini vintage** 100% CSS (papel crema con semitono, foil dorado, bandas de bandera, tipografia Anton + Archivo Narrow) — **sin imagenes**. Las unicas piezas 3D (Three.js) son los **dados** y las **fichas** de los jugadores. Maximo **6 jugadores**.

## Tematica (mapeo 1:1 con el tablero clasico)

- Calles = selecciones agrupadas por color (marron Nueva Zelanda/Panama ... azul Brasil/Argentina, que es Boardwalk). Precios y rentas identicos al Monopoly original.
- Ferrocarriles = estadios sede: Azteca, SoFi, AT&T, MetLife (renta 25/50/100/200).
- Servicios = Cabina VAR y Transmision TV (4x/10x dados).
- Suerte = Tarjeta VAR, Arca Comunal = Tarjeta FIFA (mazos en `constants.ts`, con guinos al album Panini: cromos dorados, completar el album).
- Carcel = Vestuario (suspension), Ir a la carcel = Tarjeta Roja, Parking = Fan Fest, GO = Saque Inicial ($200).
- Casas = tribunas (T en la casilla), hotel = estadio completo (EST). Salir de la carcel gratis = "Apelacion ganada" (`pardons`).

## Arquitectura

- `game/engine.ts` - motor de reglas puro y host-autoritativo: `createGame` + `applyAction(state, actor, action)` muta el `GameState` y emite `log` + `fx` (cola de efectos con seq; los clientes reproducen los que no vieron). Sin DOM ni red.
- `game/Bot.ts` - IA por dificultad (`debutante`/`profesional`/`campeon`, equivalente a First Time Buyer/Entrepreneur/Tycoon): reserva de efectivo y agresividad compradora; liquida activos ante deudas; evalua canjes por valor percibido (propiedad que completa grupo vale x2).
- `game/Game.ts` - orquestador. Modo solitario: humano + 1-7 bots (una accion de bot cada ~950 ms). Modo sala (`?room=`): el host corre el motor y difunde el `GameState` entero por broadcast (`MonopolyChannel`, patron ArenaChannel); los clientes solo mandan acciones. El host auto-juega con logica de bot al jugador que supere `TURN_TIMEOUT_MS` (30 s) sin actuar, asi una desconexion no cuelga la partida.
- `game/Hud.ts` - todo el DOM: tablero, panel de jugadores, botonera contextual por fase, historial con reloj, modales (ficha de propiedad, compra, canje, reglas paginadas, y **Mi equipo**: patrimonio + cartas guardadas + propiedades detalladas con acceso a la ficha de cada una) y overlays. Monta `Dice3D` y `Tokens3D` como overlays sobre el tablero. `showRanking` monta `LeaderboardPanel`.
- `game/Tokens3D.ts` - fichas 3D de los jugadores (Three.js), overlay de canvas transparente que cubre todo el tablero. Camara ortografica top-down en "espacio de pixeles del tablero" (mundo = px del tablero) para alinear exacto con cada casilla aunque la grilla no sea uniforme (las esquinas son 1.6fr). El HUD pasa el centro en px de la casilla de cada jugador (`getBoundingClientRect`) en `syncTokens3D`. Cada ficha es un peon (base + cuerpo + cabeza + aro dorado) del color del jugador, inclinado (`LEAN`) para leerse como 3D desde arriba. Como la altura no se ve en top-down, el salto al moverse y el bob del jugador de turno se simulan desplazando la ficha hacia arriba en pantalla (eje -Z). Fallback a discos DOM `.token-disc` si WebGL no arranca.
- `game/audio.ts` - SFX 100% procedurales con Web Audio (patron de audio de la skill threejs-gameplay-systems: el motor emite eventos fx, este modulo los sintetiza). Mute en localStorage `mg:monopoly-mundial:mute`.
- `game/Dice3D.ts` - dados 3D con Three.js (unica pieza 3D del juego, DOM en lo demas). Overlay de canvas transparente sobre el centro; fisica de caja simulada a mano (gravedad + rebotes + slerp de asentado), NO Rapier. Caras generadas con canvas 2D (sin assets). Se apaga al asentarse (ultimo frame queda pintado, `preserveDrawingBuffer`). El Hud detecta una tirada nueva por el `seq` del fx "dice" (valores iguales en tiradas distintas no confunden) y llama `roll(d1,d2)`; `showStatic` es idempotente (guarda `shownKey`) para no saltar en re-renders; si WebGL no arranca cae al render DOM `.die`. Mapeo valor→cara: BoxGeometry grupos +X/-X/+Y/-Y/+Z/-Z = 3/4/1/6/2/5, y `baseQuat(v)` rota la cara `v` a +Y. Suena `sfx.diceTap` en cada rebote.

## Reglas: fidelidad y simplificaciones deliberadas

Sigue el reglamento oficial en espanol (dobles, 3 dobles = roja, vestuario con 3 intentos y multa forzada al tercero, construccion pareja, hipotecas al 50% + 10% para levantar, renta doble con grupo completo sin tribunas, bancarrota con transferencia al acreedor). Simplificaciones documentadas:

- Sin subastas: la propiedad rechazada queda en la banca.
- Sin tope de 32 casas / 12 hoteles de la banca.
- Canjes solo de propiedades sin tribunas + efectivo (no se canjean apelaciones); sin interes del 10% al recibir hipotecadas.
- En quiebras las tribunas se liquidan a mitad de costo y el efectivo va al acreedor.

## Puntaje

Score = patrimonio (`netWorth`: efectivo + precio de propiedades, hipotecadas al 50%, + costo de tribunas). Ranking global `higher`; best local en `mg:monopoly-mundial:best`. En salas el parcial por timeout reporta el patrimonio del momento, asi la ronda corta de las salas (60-180 s) tiene ganador igual.

## Arte / estilo

**El juego no usa imagenes** (se quitaron a pedido): el look es 100% CSS estilo
album Panini en `style.css`. Paleta y fuentes por variables (`--paper`, `--gold`,
`--flag-*`; `--font-display` Anton, `--font-cond` Archivo Narrow, `--font-body`
Archivo — cargadas en `games/monopoly-mundial/index.html`). Casillas de calle con
banda de color de grupo; casillas especiales tinte por tipo + etiqueta (`KIND_TAG`
en `Hud.ts`). Centro del tablero = "cromo" con rayos de estadio. Modales tipo
ficha/sticker. Las fichas de jugador son 3D (`Tokens3D`), no imagenes.

La portada de la landing sigue en `public/covers/monopoly-mundial.jpg`. Los PNG/JPG
viejos en `public/monopoly/` quedaron **sin usar** (se pueden borrar); `PROMPTS.md`
es historico. No reintroducir `TILE_ART` ni fondos de imagen salvo pedido expreso.

## Gotchas

- El estado viaja entero por broadcast en cada cambio (~pocos KB): no agregar campos gigantes al `GameState`.
- Si el host online se va, no hay migracion del motor: el resto queda esperando y la ronda muere por el deadline de la sala (roomMode reporta parciales). Aceptado por ahora.
- Los jugadores de la sala por encima de 6 no entran a la partida (se toman los primeros 6 por orden de ingreso).
- El countdown 3/2/1/YA es obligatorio en ambos modos; en online lo dispara el evento `go` del host y los clientes bufferizan el primer estado hasta terminarlo.
