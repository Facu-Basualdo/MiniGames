/** All tunable values for Skyline. Tune here first before touching logic. */

/** Logical play resolution. The canvas is scaled to fit the window while
 *  keeping this aspect ratio, so everything below lives in these units. */
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 720;

/** Height of the ground strip along the bottom (view units). */
export const GROUND_HEIGHT = 90;
/** World Y of the ground surface (top of the ground strip). */
export const GROUND_TOP = VIEW_HEIGHT - GROUND_HEIGHT;

// --- Floors ---
export const FLOOR_WIDTH = 104;
export const FLOOR_HEIGHT = 104;
/** Horizontal center the foundation sits at; the tower's balance pivot. */
export const BASE_X = VIEW_WIDTH / 2;

// --- Crane / hook ---
/** Keeps the swinging block fully on screen at the sweep extremes. */
export const HOOK_MARGIN = FLOOR_WIDTH / 2 + 8;
/** Base horizontal sweep speed of the hook, units/s. */
export const HOOK_SPEED_BASE = 165;
/** Sweep speed added per placed floor. */
export const HOOK_SPEED_PER_FLOOR = 7;
export const HOOK_SPEED_MAX = 330;
/** Height the block hangs above its landing spot before being dropped. */
export const HOOK_FLOAT = 220;
/** Screen Y the hook is pinned to once the tower is tall enough to pan. */
export const HOOK_SCREEN_Y = 135;

// --- Drop physics ---
/** Downward acceleration of a dropped block, units/s². */
export const DROP_GRAVITY = 2400;

// --- Balance / wobble ---
/** Tower tilt (rad) when the center of mass reaches the collapse threshold. */
export const MAX_LEAN = 0.22;
/** Angular spring frequency of the post-drop wobble, rad/s. */
export const WOBBLE_FREQ = 6.6;
/** Damping of the wobble spring. */
export const WOBBLE_DAMP = 3.2;
/** How strongly a misaligned drop kicks the wobble, rad/s per floor-width. */
export const WOBBLE_IMPULSE = 1.4;
/** |offset| under this counts as a clean, "perfect" placement. */
export const PERFECT_OFFSET = 7;

// --- Camera ---
/** Lerp factor for the vertical camera pan toward its target. */
export const CAM_LERP = 6;

// --- Feel ---
/** Max simulated dt per frame (s) so a hitch can't teleport a falling block. */
export const MAX_DT = 0.032;
