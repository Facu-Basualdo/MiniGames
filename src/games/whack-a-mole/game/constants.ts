// ── Canvas ──────────────────────────────────────────────────────────
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 560;
export const MAX_DT = 0.1;

// ── Grid de agujeros ────────────────────────────────────────────────
export const COLS = 3;
export const ROWS = 3;
export const HOLE_RX = 95;
export const HOLE_RY = 34;

// ── Vidas (modo solo) ───────────────────────────────────────────────
/**
 * En solo la partida es por vidas: empiezas con estas y solo pierdes una al
 * golpear una bomba. La partida termina al llegar a 0.
 */
export const INITIAL_LIVES = 3;

// ── Countdown (obligatorio, ver root CLAUDE.md) ─────────────────────
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75;

// ── Topos ───────────────────────────────────────────────────────────
/**
 * `disguised` es una **bomba vestida de topo**: primero asoma un topo normal
 * apenas un instante (la finta) y se esconde rapido; luego sube la bomba con
 * orejas de topo. Cuesta una vida igual que la `bomb`, pero enganha porque
 * parece un topo comun.
 */
export type MoleType = "normal" | "golden" | "bomb" | "disguised";

export const MOLE_RADIUS = 56;
/** Cuanto asoma el topo por encima del nivel del agujero. */
export const EMERGE_HEIGHT = 84;
/** Tiempo que tarda en subir / bajar. */
export const RISE_TIME = 0.14;
export const FALL_TIME = 0.12;

/** Finta de la bomba disfrazada: un topo asoma y se esconde antes de la bomba. */
export const FEINT_TIME = 0.42;
/** Cuanto llega a asomar el topo en la finta (0..1); se queda por debajo del
 *  umbral de `whackable` para que no se pueda golpear durante el amague. */
export const FEINT_PEEK = 0.32;

export const NORMAL_POINTS = 10;
export const GOLDEN_POINTS = 25;
/** Golpear una bomba resta este tanto (el puntaje nunca baja de 0). */
export const BOMB_PENALTY = 15;
/** Martillazo al vacio (sin topo): resta este tanto (el puntaje nunca baja de 0). */
export const MISS_PENALTY = 3;

/** Probabilidad de cada tipo al aparecer (el resto es normal). */
export const GOLDEN_CHANCE = 0.12;
export const BOMB_CHANCE = 0.16;
/** Bomba disfrazada de topo (finta + orejas). */
export const DISGUISED_CHANCE = 0.12;

// ── Dificultad ──────────────────────────────────────────────────────
/** Segundos en los que la dificultad sube de base a maxima. */
export const RAMP_SEC = 45;
/** Intervalo entre apariciones (segundos): base -> minimo. */
export const SPAWN_INTERVAL_BASE = 0.9;
export const SPAWN_INTERVAL_MIN = 0.35;
/** Cuanto se queda arriba un topo (segundos): base -> minimo. */
export const HOLD_DURATION_BASE = 1.1;
export const HOLD_DURATION_MIN = 0.55;

// ── Scoring ─────────────────────────────────────────────────────────
export const BEST_KEY = "whack-a-mole-best";

// ── Sonido ──────────────────────────────────────────────────────────
export const SOUND_VOLUME = 0.35;
