/** All tunable values for Barra Libre. Tune here first before touching
 *  logic. Retro HD-2D like Keepers!: pixel-art sprite planes living in a
 *  real Three.js scene (meters) with dynamic lights, shadow maps and a
 *  pixelation + bloom post chain — but set in a night bar where the lights
 *  are the show. Forward is +Z (into the bar); the camera sits at negative
 *  Z looking over the four stepped counters. Customers walk toward +X
 *  (the bartender's end); served mugs slide toward -X. */

// --- Camera ---
export const CAM_FOV = 50;
export const CAM_POS_Y = 4.6;
export const CAM_POS_Z = -6.0;
export const CAM_LOOK_Y = 2.5;
export const CAM_LOOK_Z = 5.0;
/** Parallax: how much the camera rises with the bartender's lane. */
export const CAM_FOLLOW_Y = 0.22;
export const CAM_LERP = 6;

// --- Retro post-processing ---
/** Screen pixel size of the pixelation pass (scaled by devicePixelRatio). */
export const PIXEL_SIZE = 3;
export const BLOOM_STRENGTH = 0.55;
export const BLOOM_RADIUS = 0.55;
/** Lower than Keepers' 0.75 on purpose: neon and lamps must bloom. */
export const BLOOM_THRESHOLD = 0.55;

// --- Bar layout (meters) ---
export const LANE_COUNT = 4;
/** Nearest counter's depth; each lane steps back and up from here. */
export const LANE_BASE_Z = 2.0;
export const LANE_STEP_Z = 2.4;
/** Terraced floors: each lane's floor rises so all four bars read. */
export const LANE_STEP_Y = 1.05;
/** Counter top height above its lane's floor. Lower than a real bar on
 *  purpose: the customers' torsos must read above the wood. */
export const COUNTER_HEIGHT = 0.88;
/** Counter slab size. */
export const COUNTER_LENGTH = 8.2;
export const COUNTER_DEPTH = 0.9;
/** People (customers, bartender) stand this far behind the counter line. */
export const PEOPLE_Z_OFFSET = 0.62;

/** Customers appear here... */
export const SPAWN_X = -4.0;
/** ...and a full mug that reaches this X with nobody to catch it crashes. */
export const CRASH_X = -4.2;
/** A customer who reaches this X grabs the bartender: strike. */
export const END_X = 2.55;
/** Empty mugs / tips are catchable from here; past it they fall. */
export const CATCH_X = 2.45;
/** The tap (and the bartender) sit here, past the end of the counter. */
export const TAP_X = 3.05;
export const BARTENDER_X = 3.15;

// --- Bartender ---
/** Seconds to hop between adjacent lanes (locked while pouring). */
export const LANE_SWITCH_TIME = 0.16;
/** Seconds of holding the tap to fill a mug. Releasing earlier discards
 *  the half-poured mug (wasted time, no strike). Once full the mug just
 *  waits in his hand — overfilling is not punished, standing there is. */
export const POUR_TIME = 0.55;
/** How long the serve / catch poses linger, s. */
export const SERVE_POSE_TIME = 0.28;
export const CATCH_POSE_TIME = 0.3;

// --- Mugs and tips (slide speeds, m/s) ---
export const MUG_FULL_SPEED = 7.0;
export const MUG_EMPTY_SPEED = 2.4;
export const TIP_SPEED = 1.9;
/** A sliding mug meets a customer within this margin. */
export const MUG_HIT_MARGIN = 0.3;

// --- Customers ---
/** Sprite walk-cycle stride: frame swaps every this many meters. */
export const WALK_STRIDE = 0.35;
/** How far a caught beer pushes the customer back down the bar. */
export const PUSHBACK_DIST = 2.2;
/** Seconds of the pushback slide (drinking starts immediately). */
export const PUSHBACK_TIME = 0.5;
/** Seconds spent drinking before the empty mug comes back. */
export const DRINK_TIME = 1.3;
/** Punks advance this much faster than regulars. */
export const PUNK_SPEED_FACTOR = 1.7;
/** Chance a satisfied customer leaves a tip sliding after the empty mug. */
export const TIP_CHANCE = 0.25;
/** Second member of a group spawns this far behind the first. */
export const GROUP_GAP = 0.9;
/** Minimum room at the spawn point before another customer fits the lane. */
export const SPAWN_CLEARANCE = 0.8;

// --- Tip bonus: everyone slows down to watch the show ---
export const TIP_SLOW_DURATION = 2.5;
export const TIP_SLOW_FACTOR = 0.5;

// --- Scoring ---
export const POINTS_SERVE = 10;
export const POINTS_SERVE_PUNK = 15;
export const POINTS_CATCH = 5;
export const POINTS_TIP = 25;

// --- Difficulty: four hand-designed phases, resolved per spawn by
// Lanes.paramsAt from the elapsed play time (no levels — the night just
// gets worse). Tuned by playing, not by simulation:
//
//   A. Warmup      — two lanes, slow strollers, generous gaps.
//   B. Ritmo       — until RITMO_END_S: spawns speed up, lanes open up.
//   C. Mezcla      — until INFERNO_START_S: punks and groups ramp in.
//   D. Inferno     — everything maxed (blended over INFERNO_BLEND_S). ---

export const WARMUP_END_S = 15;
export const RITMO_END_S = 60;
export const INFERNO_START_S = 120;
export const INFERNO_BLEND_S = 10;
/** First customer walks in this long after YA, s. */
export const FIRST_SPAWN_DELAY = 1.0;

/** A. Warmup. */
export const WARMUP_INTERVAL = 2.5;
export const WARMUP_SPEED = 0.55;
export const WARMUP_LANES = 2;

/** B. Ritmo (values at WARMUP_END_S -> at RITMO_END_S). Extra lanes open
 *  at fixed times inside the phase. */
export const RITMO_INTERVAL_START = 2.2;
export const RITMO_INTERVAL_END = 1.4;
export const RITMO_SPEED_START = 0.55;
export const RITMO_SPEED_END = 0.75;
export const THIRD_LANE_AT_S = 25;
export const FOURTH_LANE_AT_S = 40;
export const RITMO_PUNK_END = 0.15;
export const RITMO_GROUP_END = 0.15;

/** C. Mezcla (values at RITMO_END_S -> at INFERNO_START_S). */
export const MIX_INTERVAL_START = 1.4;
export const MIX_INTERVAL_END = 1.0;
export const MIX_SPEED_START = 0.75;
export const MIX_SPEED_END = 0.95;
export const MIX_PUNK_START = 0.15;
export const MIX_PUNK_END = 0.35;
export const MIX_GROUP_START = 0.15;
export const MIX_GROUP_END = 0.3;

/** D. Inferno. */
export const INFERNO_INTERVAL = 0.85;
export const INFERNO_SPEED = 1.05;
export const INFERNO_PUNK = 0.4;
export const INFERNO_GROUP = 0.35;

// --- Rules ---
/** Strikes before the night ends: customer reaches the tap, an empty mug
 *  falls uncaught, or a beer crashes at the far end with nobody there. */
export const MAX_MISSES = 3;

/** Max simulated dt per frame (s) so a hitch can't teleport mugs. */
export const MAX_DT = 0.05;

/** Master volume of the synthesized sound effects (0-1). */
export const SOUND_VOLUME = 0.18;

// --- Palette (smoky night-bar look) ---
export const COLOR_BACKGROUND = 0x0d0812;
export const COLOR_FOG = 0x0d0812;
export const FOG_NEAR = 16;
export const FOG_FAR = 38;
