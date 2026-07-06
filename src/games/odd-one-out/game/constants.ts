export const BEST_KEY = "odd-one-out:best";

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75; // seconds
export const MAX_DT = 0.1; // capping delta time to avoid jumps on tab blur

// Al perder se resalta la ficha distinta este tiempo antes de tapar el tablero.
export const GAME_OVER_REVEAL_MS = 1100;

// Timer global: arranca con START_TIME, cada acierto recarga HIT_BONUS
// (con tope MAX_TIME) y cada error descuenta MISS_PENALTY.
export const START_TIME = 10; // seconds
export const MAX_TIME = 12; // seconds
export const HIT_BONUS = 1.5; // seconds
export const MISS_PENALTY = 2; // seconds

// La grilla crece un lado cada LEVELS_PER_SIZE aciertos.
export const MIN_GRID = 2;
export const MAX_GRID = 8;
export const LEVELS_PER_SIZE = 3;

// Diferencia de luminosidad (en % HSL) entre la ficha distinta y el resto.
// Baja DELTA_STEP por acierto hasta el piso MIN_DELTA.
export const START_DELTA = 24;
export const DELTA_STEP = 1.1;
export const MIN_DELTA = 5;

export const BASE_SATURATION = 72; // % HSL de todas las fichas
export const BASE_LIGHTNESS = 52; // % HSL de las fichas normales
