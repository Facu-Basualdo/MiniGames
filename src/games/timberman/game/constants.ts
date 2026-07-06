// Tunable values for Timber! — chop-the-tree reflex game.
// Tune here first before touching gameplay logic.

export const BEST_SCORE_KEY = "mg:timberman:best";

/** Colors (cartoon palette). */
export const SKY_TOP_COLOR = "#0c051a";
export const SKY_BOTTOM_COLOR = "#fa709a";
export const GROUND_COLOR = "#4a1c40";
export const GROUND_EDGE_COLOR = "#2a0e24";
export const TRUNK_COLOR_A = "#5c3d2e";
export const TRUNK_COLOR_B = "#432b20";
export const TRUNK_RING_COLOR = "#d9ad7c";
export const BRANCH_COLOR = "#3e2723";
export const LEAF_COLORS = ["#ff5e7e", "#ff2e63", "#ff7a8a"];

/** Geometry. */
export const TRUNK_RADIUS = 0.72;
export const SEG_HEIGHT = 1.725;
/** How many trunk segments are stacked/visible above the base at once. */
export const VISIBLE_SEGMENTS = 9;
/** X offset where the lumberjack stands on each side (world units). */
export const PLAYER_SIDE_X = 1.55;
/** Branch reaches out this far from the trunk center toward the player. */
export const BRANCH_LENGTH = 1.55;

/** How many bottom segments are guaranteed branch-free at run start. */
export const SAFE_START_SEGMENTS = 3;
/** Probability a freshly spawned top segment carries a branch. */
export const BRANCH_CHANCE = 0.58;
/** Never allow more than this many branches in a row on the same side. */
export const MAX_SAME_SIDE_RUN = 2;

/** Timer bar (0..1). Reaching 0 ends the run. */
export const TIMER_START = 1;
export const TIMER_MAX = 1;
/** Base drain per second when idle. */
export const TIMER_DRAIN_BASE = 0.3;
/** Extra drain per point of score (difficulty ramp). */
export const TIMER_DRAIN_RAMP = 0.002;
export const TIMER_DRAIN_MAX = 0.85;
/** Amount the bar refills on each successful chop. */
export const TIMER_GAIN = 0.11;

/** Chop juice. */
export const CHOP_ANIM_TIME = 0.12;
export const DROP_ANIM_TIME = 0.09;
export const CAMERA_SHAKE = 0.06;
