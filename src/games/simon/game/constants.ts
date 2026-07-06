export const BEST_KEY = "simon:best";

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75; // seconds
export const MAX_DT = 0.1; // capping delta time to avoid jumps on tab blur

// Cuatro pads clasicos (verde / rojo / azul / amarillo).
export const PAD_COUNT = 4;

// Reproduccion de la secuencia: cada paso dura STEP segundos (encendido +
// silencio). Se acelera STEP_DECAY por paso hasta el piso MIN_STEP, para que
// la tension crezca con la secuencia. FLASH_RATIO es la fraccion encendida.
export const START_DELAY_MS = 500; // pausa antes de arrancar la secuencia
export const BASE_STEP_MS = 620;
export const STEP_DECAY_MS = 22;
export const MIN_STEP_MS = 300;
export const FLASH_RATIO = 0.62;

// Feedback breve al tocar un pad correcto durante la entrada.
export const INPUT_FLASH_MS = 200;
// Pausa entre completar una ronda y mostrar la siguiente.
export const ROUND_GAP_MS = 650;
// Al perder se ilumina el pad correcto este tiempo antes de tapar el tablero.
export const GAME_OVER_REVEAL_MS = 1100;
