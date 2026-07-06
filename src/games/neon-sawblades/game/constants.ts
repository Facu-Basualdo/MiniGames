/** All tunable values for Neon Sawblades. Tune here first before touching logic. */

/** Logical play resolution. The canvas is scaled to fit the window while
 *  keeping this aspect ratio, so everything below lives in these units. */
export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 800;

/** Height of the neon floor strip along the bottom (view units). */
export const FLOOR_HEIGHT = 90;
/** Y of the walkable floor line (where the player's feet rest). */
export const FLOOR_Y = VIEW_HEIGHT - FLOOR_HEIGHT;

// --- Player ---
export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 48;
/** Horizontal run speed, units/s. */
export const MOVE_SPEED = 360;
/** Downward acceleration, units/s². */
export const GRAVITY = 2200;
/** Initial upward velocity of the first (ground) jump, units/s. */
export const JUMP_VELOCITY = 960;
/** Upward velocity of the mid-air second jump, units/s. */
export const DOUBLE_JUMP_VELOCITY = 780;
/** Jumps allowed before landing (1 ground + 1 air = double jump). */
export const MAX_JUMPS = 2;
/** On releasing jump while still rising, velocity is cut to this fraction —
 *  this is what makes the first jump's height depend on how long you hold. */
export const JUMP_CUT = 0.4;

// --- Sawblades ---
export const SAW_RADIUS = 25;
/** Sawblade fall/bounce acceleration, units/s². */
export const SAW_GRAVITY = 1500;
/** Vertical speed range at spawn (units/s, downward). */
export const SAW_SPAWN_VY_MIN = 40;
export const SAW_SPAWN_VY_MAX = 140;
/** Horizontal speed range at spawn (units/s, sign randomised). */
export const SAW_SPAWN_VX_MIN = 90;
export const SAW_SPAWN_VX_MAX = 210;
/** Energy retained when a blade bounces off the floor (0-1). */
export const SAW_BOUNCE = 0.62;
/** Hard cap on the upward speed after a floor bounce (units/s). Without this a
 *  blade dropping from the top hits the floor fast enough to rocket back up
 *  almost off-screen; capping it keeps bounces lively but still jumpable. */
export const SAW_MAX_BOUNCE_VY = 680;
/** Below this post-bounce speed a blade stops bouncing and just rolls. */
export const SAW_SETTLE_VY = 120;
/** Spin rate for the drawing, radians/s. */
export const SAW_SPIN = 9;
/** Most blades allowed on screen at once (spawning pauses at the cap). */
export const MAX_SAWS = 7;
/** Fewest blades kept on screen — when below this the field refills quickly,
 *  so even the opening seconds have some pressure (never a near-empty room). */
export const MIN_SAWS = 2;
/** Short spawn gap used while below MIN_SAWS to top the field back up. */
export const REFILL_INTERVAL = 0.5;

// --- Spawning / difficulty ramp ---
/** Seconds between spawns at the start of a run. */
export const SPAWN_INTERVAL_START = 1.4;
/** Seconds between spawns once the run is fully ramped up. */
export const SPAWN_INTERVAL_MIN = 0.55;
/** Play time (s) over which the spawn interval eases from START to MIN. */
export const RAMP_DURATION = 80;

// --- Coins ---
export const COIN_RADIUS = 13;
/** Coin fall acceleration, units/s². */
export const COIN_GRAVITY = 1700;
/** Upward pop given to a coin when it spawns from a destroyed blade. */
export const COIN_POP_VY = 280;
/** Seconds a coin lives on the floor before vanishing (blinks near the end). */
export const COIN_LIFETIME = 6;
/** Points added to the score when a coin is collected. */
export const COIN_POINTS = 1;
/** Seconds added to the clock when a coin is collected. */
export const COIN_TIME_BONUS = 2;

// --- Timer ---
/** Seconds on the clock at the start of a run. */
export const START_TIME = 12;
/** Clock is capped here so time can't be hoarded indefinitely. */
export const MAX_TIME = 22;
/** Seconds added to the clock for each blade destroyed (before collecting). */
export const SAW_TIME_BONUS = 1;

// --- Feel ---
/** Max simulated dt per frame (s) so a hitch/tab-switch can't teleport things. */
export const MAX_DT = 0.032;
