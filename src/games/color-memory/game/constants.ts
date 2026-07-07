export const TOTAL_ROUNDS = 3;

/** How long the target color is shown before it vanishes (ms). */
export const MEMORIZE_MS = 5000;

/** localStorage key for the best average accuracy. */
export const BEST_KEY = "color-memory:best";

/**
 * Curve applied to the raw 0..1 closeness so that only genuinely close
 * recreations score high. 1 = linear, >1 = punishes small errors more.
 */
export const ACCURACY_POWER = 1.8;

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75; // seconds
export const MAX_DT = 0.1; // cap delta time to avoid jumps on tab blur
