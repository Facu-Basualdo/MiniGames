# Memoria de Color (`color-memory`)

Juego de memoria de color con estética editorial plana (inspirada en Dialed.gg).
Un color llena toda la tarjeta durante **~5 s** (`MEMORIZE_MS`) y desaparece; el
jugador lo recrea de memoria con tres deslizadores verticales **HSB** (matiz /
saturación / brillo). El deslizador de matiz usa un gradiente que va de 0° (abajo) a
360° (arriba), alineado con el valor para que el color bajo la perilla sea el que el
valor produce.
Tres rondas; el puntaje final es el promedio del porcentaje de acierto por ronda.

No usa Three.js: los colores son campos planos en CSS, lo que da fidelidad de color
perfecta (sRGB exacto) y un surround neutro claro para percibir bien el tono.

## Estructura

- `game/Game.ts` — orquestador y máquina de estados.
- `game/color.ts` — modelo HSV: `hsvToRgb`, contraste de texto (`textToneFor`,
  WCAG), `accuracy`, y generadores de color (`randomTargetHsv`, `randomStartHsv`).
- `game/Hud.ts` — todo el DOM: una sola `.cm-card` con clases de fase
  (`phase-idle/countdown/memorize/guess/reveal/gameover`) que muestran/ocultan sus
  piezas. Deslizadores, número grande, panel de revelado partido, FAB, overlays.
- `game/SoundEffects.ts` — blips WebAudio (incluye `playCountdownTick`).
- `game/constants.ts` — perillas de ajuste.

## Máquina de estados

`ready → countdown → memorize → guess → reveal → (siguiente ronda | gameOver)`

- **countdown**: el obligatorio 3 / 2 / 1 / YA, una sola vez al empezar la partida.
- **memorize**: la tarjeta se pinta del color objetivo al instante (sin transición
  de fondo, que se le sacó a `.cm-card`) y un número grande arriba a la derecha
  cuenta los ms restantes hacia 0.
- **guess**: la tarjeta muestra el color actual de los deslizadores (arrancan en un
  HSV aleatorio). Confirmar con el FAB (icono de diana) o Enter.
- **reveal**: la tarjeta se parte — arriba tu color, abajo el original — con el % de
  la ronda, una frase según el acierto y los valores `H S B`. Avanzar con el FAB
  (flecha) o Enter.

## Puntaje

`accuracy(guess, target)` convierte ambos HSV→RGB, calcula la distancia euclidiana
normalizada a `[0,1]` y la eleva a `ACCURACY_POWER` (1.8, castiga errores chicos)
por 100. El puntaje de la partida es el promedio de las 3 rondas.
`direction: "higher"`, formato `%` (ver `meta.ts`).

## Contraste de texto

Cada tarjeta elige texto claro u oscuro con `textToneFor`, que compara el contraste
WCAG del color contra las dos tintas de la UI y usa la de mayor contraste (robusto
para colores de luminosidad media). Se aplica vía `data-tone` en `.cm-card` (y en
`.cm-reveal-bottom`, que tiene su propia tinta).

## CSS: visibilidad por fase (gotcha)

El `display` de las piezas se controla **solo** en las reglas `.phase-* .cm-x`.
Los componentes (`.cm-sliders`, `.cm-top`, `.cm-fab`, `.cm-countdown`) **no** deben
declarar `display` propio: al tener la misma especificidad que la regla base que las
oculta y venir después, ganarían y quedarían siempre visibles (bug que dejaba los
deslizadores encima del revelado). Sus props de layout (`gap`, `align-items`, etc.)
sí van en el componente porque son inertes hasta que la fase pone `display`.

## Salas (multiplayer)

Wiring estándar: `initRoomMode("color-memory", { getScore, onStart })`. `getScore`
devuelve el promedio de rondas completadas; `onStart` dispara `beginCountdown()`.
En game over, si hay sala se hace `reportScore`; si no, `showRanking`. Los botones
"Comenzar / Jugar de nuevo" y el hint se ocultan en modo sala (`hideStartButton`) y
Enter no reinicia.

## Ajustes (`constants.ts`)

- `TOTAL_ROUNDS` (3), `MEMORIZE_MS` (500), `ACCURACY_POWER` (1.8).
- Rangos de color objetivo/inicial en `color.ts`.
