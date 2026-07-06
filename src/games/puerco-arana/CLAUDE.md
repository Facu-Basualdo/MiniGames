# Puerco Araña

Runner infinito de balanceo: un cerdo con máscara de araña se columpia de telaraña en telaraña entre edificios, avanzando a la derecha para siempre. Canvas 2D apaisado a resolución lógica 900x600 escalada al viewport; el mundo son píxeles con cámara que sigue al cerdo en x (la vertical es fija).

## Mecánica

- Mantener pulsado (pointer en el canvas o Espacio) lanza la telaraña al mejor anclaje: por encima del cerdo, a lo sumo `WEB_RANGE` px de distancia y no más de `WEB_AHEAD_MIN` px por detrás; entre los candidatos gana el que está más adelante. El largo de la cuerda queda fijado a la distancia en el momento del enganche (mínimo `ROPE_MIN`).
- Si se mantiene pulsado sin anclaje al alcance, el enganche se reintenta cada frame (`webHeld`): la telaraña sale sola apenas un anclaje entra en rango.
- Soltar el input suelta la cuerda conservando la velocidad íntegra (esa es la inercia del juego). Si al soltarse va hacia adelante a más de `BONUS_SPEED` px/s, gana un bonus de `floor(velocidad / BONUS_DIVISOR)` puntos con texto flotante.
- Física de péndulo por restricción, no por ángulo: gravedad + integración semi-implícita y después, si la distancia al anclaje supera el largo de cuerda, se proyecta la posición sobre el círculo y se elimina la componente radial saliente de la velocidad. Con cuerda floja (dentro del círculo) el cerdo cae libre aunque esté enganchado.
- Mientras está colgado, un empuje tangencial constante en la dirección del movimiento (`SWING_PUMP`) sostiene la energía del balanceo; en vuelo libre hay un arrastre horizontal suave (`AIR_DRAG`). Velocidad total capada a `MAX_SPEED`.
- Derrota: tocar la calle (`STREET_Y`). Los edificios son decorativos, no tienen colisión: el desafío es puramente el timing del balanceo.
- Puntaje: `floor(distancia máxima alcanzada / PX_PER_POINT)` + bonus acumulados de lanzamientos veloces. Columpiarse hacia atrás nunca resta (se usa `farthestX`).
- La partida arranca ya colgado del primer anclaje con velocidad inicial hacia adelante, así el countdown desemboca en un balanceo y no en una caída.

## Decisiones no obvias

- La física corre en subpasos de 1/120 s (`PHYSICS_STEP`) para que la restricción de cuerda no explote a velocidad alta.
- El skyline de fondo (dos capas con parallax) se dibuja sin estado: cada edificio sale de un hash determinista `fract(sin(i * 127.1) * 43758.5453)` sobre su índice de slot, así el fondo es infinito y estable sin listas que generar ni podar. Solo los anclajes (y sus torres de primer plano) viven en una lista generada/podada alrededor de la cámara; el anclaje enganchado nunca se poda.
- `pointerdown` va en el canvas pero `pointerup` en `window`, para no perder el soltado si el dedo/cursor sale del canvas en pleno balanceo.
- Espacio con `e.repeat` ignorado: mantener la tecla no re-dispara el enganche.
- Sonidos sintetizados con Web Audio en `SoundEffects.ts` (sin assets): thwip de enganche, whoosh al soltar, arpegio de bonus, splat descendente y el blip de countdown obligatorio (guardado por `lastCountdownIndex`).
- Countdown 3/2/1/YA obligatorio, ranking global (`hud.showRanking("puerco-arana", score)`, scoring por defecto `higher`, sin `scoring` en `meta.ts`) y modo sala (`initRoomMode("puerco-arana", ...)` con `onStart`) cableados según el patrón del repo.

## Tuning

Todo en `game/constants.ts`: gravedad, rango y reglas del enganche, empuje del péndulo, generación de anclajes (`ANCHOR_GAP_*`, `ANCHOR_Y_*`), puntaje (`PX_PER_POINT`, `BONUS_*`) y cámara.
