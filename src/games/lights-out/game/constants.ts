export const DEFAULT_GRID_SIZE = 4;
export const BEST_KEY_PREFIX = "lights_out_best_";
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA!"];
export const COUNTDOWN_STEP = 0.8; // seconds per label
export const MAX_DT = 0.1; // clamp delta time to avoid large jumps

// Scramble: cuantas pulsaciones aleatorias se aplican desde el tablero
// apagado (asi el puzzle siempre es resoluble deshaciendo pulsaciones).
export const SCRAMBLE_PRESSES: Record<number, number> = {
  3: 4,
  4: 6,
  5: 9,
};

// Minimo de luces encendidas tras el scramble para evitar tableros triviales.
export const MIN_LIT_RATIO = 0.2;
