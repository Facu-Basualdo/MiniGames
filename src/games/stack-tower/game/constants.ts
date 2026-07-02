/** All tunable values for Torre Infinita. Tune here first before touching logic. */

/** Logical play resolution. The canvas is scaled to fit the window while
 *  keeping this aspect ratio, so everything below lives in these units. */
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 720;

// --- Blocks ---
/** Height of every stacked block (view units). */
export const BLOCK_HEIGHT = 46;
/** Width of the base block; the first moving block inherits it. */
export const BASE_WIDTH = 240;
/** Corner rounding for the rounded-rect blocks. */
export const BLOCK_RADIUS = 6;

// --- Movement ---
/** Horizontal speed of the moving block at the base, units/s. */
export const BASE_SPEED = 160;
/** Extra speed added per placed block. */
export const SPEED_STEP = 9;
/** Speed never exceeds this, units/s. */
export const MAX_SPEED = 440;
/** Misalignment (units) within which a drop counts as a perfect placement. */
export const PERFECT_EPS = 5;

// --- Falling slivers (sliced-off overhang) ---
export const SLIVER_GRAVITY = 1500;
/** Horizontal drift given to a sliver so it visibly peels off the side. */
export const SLIVER_DRIFT = 70;

// --- Camera ---
/** Screen Y the top of the moving block eases toward as the tower grows. */
export const CAMERA_TARGET_Y = VIEW_HEIGHT * 0.42;
/** Camera easing factor per second (higher = snappier follow). */
export const CAMERA_LERP = 7;

// --- Color ---
/** Base hue for the tower; each block advances by HUE_STEP for a gradient. */
export const BASE_HUE = 190;
export const HUE_STEP = 8;

// --- Feel ---
/** Max simulated dt per frame (s) so a hitch/tab-switch can't skip a drop. */
export const MAX_DT = 0.032;
