export const DISC_OPTIONS = [3, 4, 5, 6, 7];
export const DEFAULT_DISCS = 3;
/** Cantidad de varillas (clasico: 3). */
export const PEG_COUNT = 3;
/** Indice de la varilla objetivo (la ultima): ahi debe quedar la torre. */
export const TARGET_PEG = PEG_COUNT - 1;

export const BEST_KEY_PREFIX = "tower_of_hanoi_best_";
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA!"];
export const COUNTDOWN_STEP = 0.8; // seconds per label
export const MAX_DT = 0.1; // clamp delta time to avoid large jumps

/** Poll de respaldo de la votacion de discos en modo sala (ademas del "sync"). */
export const VOTE_POLL_MS = 5000;
/** Tope de la votacion de discos: pasado esto el host resuelve con lo que haya. */
export const VOTE_TIMEOUT_MS = 15000;

/** Cantidad optima de movimientos para resolver n discos (2^n - 1). */
export function optimalMoves(discs: number): number {
  return Math.pow(2, discs) - 1;
}
