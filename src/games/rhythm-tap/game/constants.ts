/** All tunable values for Beat Fever. Tune here first before touching logic. */

/** Logical play resolution. The canvas is scaled to fit the window while
 *  keeping this aspect ratio, so everything below lives in these units. */
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 720;

/** Number of vertical lanes notes fall down. */
export const LANE_COUNT = 3;
/** Width of a single lane (view units). Lanes are centered horizontally. */
export const LANE_WIDTH = VIEW_WIDTH / LANE_COUNT;

/** Y of the hit line, measured from the top (view units). Notes are judged here. */
export const HIT_LINE_Y = VIEW_HEIGHT - 130;
/** Visual half-height of a note tile (view units). */
export const NOTE_HALF_HEIGHT = 26;

/** Downward note speed at the start of a run, units/s. */
export const BASE_NOTE_SPEED = 240;
/** Extra speed added per point scored, units/s (difficulty ramp). */
export const SPEED_PER_POINT = 0.07;
/** Speed never exceeds this, units/s. */
export const MAX_NOTE_SPEED = 600;

/** Seconds between note spawns at the start of a run. */
export const BASE_SPAWN_INTERVAL = 1.2;
/** Spawn interval shrinks by this per point, seconds. */
export const SPAWN_DECAY_PER_POINT = 0.00017;
/** Spawns never come faster than this, seconds. */
export const MIN_SPAWN_INTERVAL = 0.35;

// --- Judgment windows (distance in view units from the hit line at tap time) ---
// Widened so timing is forgiving.
export const PERFECT_WINDOW = 40;
export const GOOD_WINDOW = 100;
/** A note is auto-missed once it falls this far past the hit line. */
export const MISS_WINDOW = 112;

// --- Scoring ---
export const PERFECT_SCORE = 100;
export const GOOD_SCORE = 50;
/** Combo adds a bonus of (combo * this) capped by COMBO_BONUS_CAP per hit. */
export const COMBO_BONUS = 2;
export const COMBO_BONUS_CAP = 40;

// --- Health (survival) ---
/** Full health at the start of a run; the run ends when it hits 0. */
export const MAX_HEALTH = 100;
/** Health lost on a miss (tapped too far, or note fell past the line). */
export const MISS_DAMAGE = 16;
/** Health regained on a perfect / good hit. */
export const PERFECT_HEAL = 2;
export const GOOD_HEAL = 1;

/** Max simulated dt per frame (s) so a hitch/tab-switch can't teleport notes. */
export const MAX_DT = 0.032;

/** The four piece figures are directional arrows: the shape of the note *is*
 *  the arrow key you must press to clear it. Each has its own key, independent
 *  of the lane it falls in. Figure and lane are chosen independently at spawn,
 *  so an arrow can fall in any column and the lane never reveals the key. */
export const FIGURES = ["left", "up", "down", "right"] as const;
export type Figure = (typeof FIGURES)[number];

/** Key (`KeyboardEvent.code`) for each figure index, and its display label. */
export const FIGURE_KEYS = ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"];
export const FIGURE_KEY_LABELS = ["←", "↑", "↓", "→"];
/** Base accent color per figure, used by the figure -> key legend. The falling
 *  notes no longer rely on color for identity (the arrow shape carries it), so
 *  each one is given a fixed random hue at spawn that stays put as it falls. */
export const FIGURE_COLORS = ["#ff3f81", "#7cff5c", "#3fd0ff", "#ffd23f"];
