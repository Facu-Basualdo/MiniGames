// ── Canvas ──────────────────────────────────────────────────────────
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 500;
export const MAX_DT = 0.1;

// ── Lives ───────────────────────────────────────────────────────────
export const INITIAL_LIVES = 3;

// ── Countdown ───────────────────────────────────────────────────────
export const COUNTDOWN_LABELS = ["3", "2", "1", "DRAW!"];
export const COUNTDOWN_STEP = 0.75;

// ── Targets ─────────────────────────────────────────────────────────
export type TargetSize = "large" | "medium" | "small";

export interface TargetConfig {
  radius: number;
  points: number;
  baseSpeed: number;
}

export const TARGET_CONFIGS: Record<TargetSize, TargetConfig> = {
  large:  { radius: 40, points: 10,  baseSpeed: 60  },
  medium: { radius: 28, points: 25,  baseSpeed: 90  },
  small:  { radius: 18, points: 50,  baseSpeed: 130 },
};

// ── Civilians ───────────────────────────────────────────────────────
export const CIVILIAN_PENALTY = 100;
export const CIVILIAN_WIDTH = 36;
export const CIVILIAN_HEIGHT = 60;
export const CIVILIAN_BASE_SPEED = 55;

// ── Enemies ─────────────────────────────────────────────────────────
export const ENEMY_WIDTH = 44;
export const ENEMY_HEIGHT = 64;
/** Seconds the enemy stays visible before shooting. */
export const ENEMY_SHOOT_TIME_BASE = 2.8;
/** Minimum shoot time at max difficulty. */
export const ENEMY_SHOOT_TIME_MIN = 1.2;
/** How long the pop-up animation takes. */
export const ENEMY_POP_DURATION = 0.25;

// ── Difficulty / Spawner ────────────────────────────────────────────
/** Seconds between difficulty increases. */
export const DIFFICULTY_INTERVAL = 5;
/** Speed multiplier added per difficulty level. */
export const SPEED_MULT_PER_LEVEL = 0.15;

/** Max targets on screen at each difficulty level (clamped). */
export const MAX_TARGETS_BY_LEVEL = [3, 4, 5, 6, 7, 8, 9, 10];
/** Spawn interval for targets (seconds). */
export const TARGET_SPAWN_INTERVAL_BASE = 1.8;
export const TARGET_SPAWN_INTERVAL_MIN = 0.6;

/** Spawn interval for civilians. */
export const CIVILIAN_SPAWN_INTERVAL_BASE = 8;
export const CIVILIAN_SPAWN_INTERVAL_MIN = 3;

/** Spawn interval for enemies. */
export const ENEMY_SPAWN_INTERVAL_BASE = 10;
export const ENEMY_SPAWN_INTERVAL_MIN = 3.5;
/** Difficulty level at which enemies start appearing. */
export const ENEMY_START_LEVEL = 2;
/** Difficulty level at which civilians start appearing. */
export const CIVILIAN_START_LEVEL = 1;

// ── Scoring ─────────────────────────────────────────────────────────
export const BEST_KEY = "western-shoot-best";
/** Points subtracted when a shot hits nothing (a wasted bullet). */
export const MISS_PENALTY = 20;

// ── Sound ───────────────────────────────────────────────────────────
export const SOUND_VOLUME = 0.35;

// ── Shoot effect ────────────────────────────────────────────────────
export const SHOOT_FLASH_DURATION = 0.12;
