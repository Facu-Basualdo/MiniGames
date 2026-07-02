/** All tunable values for Bounce Rush (3D Subway-style runner). Tune here first. */

// --- Layout (world units) ---
export const BALL_RADIUS = 0.55;
/** Center X of the three lanes: -LANE_X, 0, +LANE_X. */
export const LANE_X = 2.0;
export const LANE_COUNT = 3;
/** Forward spacing between consecutive platform rows (along Z). */
export const ROW_DEPTH = 5.5;

// --- Platforms ---
export const PLATFORM_WIDTH = 2.7; // along X
export const PLATFORM_DEPTH = 2.2; // along Z
export const PLATFORM_HEIGHT = 0.7; // top surface sits at y = 0
/** Probability an off-path lane gets a platform (variety). */
export const PLATFORM_FILL = 0.5;

// --- Ball motion ---
/** Peak height of the automatic hop arc above the platform surface. */
export const HOP_HEIGHT = 2.0;
/** How fast the ball eases toward its target lane (higher = snappier). */
export const LANE_LERP = 13;
/** Downward speed once the ball misses a platform and falls, units/s. */
export const FALL_SPEED = 16;

// --- Forward speed (ramps up over time, Subway-style) ---
export const BASE_SPEED = 9;
export const MAX_SPEED = 22;
export const SPEED_RAMP_PER_SEC = 0.35;
/** Slow idle scroll on the start / game-over screens. */
export const IDLE_SPEED = 2.5;

// --- Track streaming ---
/** Rows kept alive ahead of the ball (also sets the visible draw distance). */
export const VISIBLE_ROWS = 18;
/** A row is recycled to the back once it scrolls past this Z (behind camera). */
export const DESPAWN_Z = 16;

// --- Camera (chase cam behind and above the ball) ---
export const CAM_BACK = 8; // +Z, behind the ball
export const CAM_HEIGHT = 5.2;
export const CAM_FOV = 62;
/** How much the camera slides sideways to follow the ball's lane (0..1). */
export const CAM_FOLLOW_X = 0.55;
/** How quickly the camera catches up to its target X. */
export const CAM_LERP = 7;
/** Look target: ahead of the ball and slightly up from the ground. */
export const CAM_LOOK_AHEAD = 10;
export const CAM_LOOK_Y = 1.0;

// --- Colors ---
export const BACKGROUND_COLOR = 0x141d33;
export const FOG_NEAR = 14;
export const FOG_FAR = 62;
export const BALL_COLOR = 0xff6b3d;
export const PLATFORM_COLOR_A = 0x2fbf9b;
export const PLATFORM_COLOR_B = 0x279e83;

export const BEST_SCORE_KEY = "jump-ball:best";

// --- Feel ---
/** Max simulated dt per frame (s) so a hitch/tab-switch can't jump the sim. */
export const MAX_DT = 0.05;
