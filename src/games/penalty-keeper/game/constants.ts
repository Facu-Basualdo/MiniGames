/** All tunable values for Penalty Keeper. Tune here first before touching
 *  logic. Retro HD-2D: pixel-art sprite planes living in a real Three.js
 *  scene (meters, real goal proportions) with dynamic lights, shadow maps
 *  and a pixelation + bloom post chain. Forward is +Z (toward the kicker);
 *  the goal line is at z = 0 and the camera sits inside the goal. */

// --- Camera ---
export const CAM_FOV = 55;
export const CAM_POS_Y = 2.5;
export const CAM_POS_Z = -4.8;
export const CAM_LOOK_Y = 1.4;
export const CAM_LOOK_Z = 12;
/** How much the camera slides sideways with the keeper (parallax, not 1:1). */
export const CAM_FOLLOW_X = 0.3;
export const CAM_LERP = 6;

// --- Retro post-processing ---
/** Screen pixel size of the pixelation pass (scaled by devicePixelRatio). */
export const PIXEL_SIZE = 4;
export const BLOOM_STRENGTH = 0.4;
export const BLOOM_RADIUS = 0.5;
export const BLOOM_THRESHOLD = 0.75;

// --- Goal geometry (meters). The bar sits higher than a real goal (2.44)
// so the gap between standing reach and the bar is obvious: shots up there
// clearly need a jump. ---
export const GOAL_HALF_WIDTH = 3.66;
export const GOAL_HEIGHT = 2.75;
export const POST_RADIUS = 0.07;

// --- Field landmarks ---
/** Keeper's plane, slightly off the goal line; shots are judged here. */
export const KEEPER_Z = 0.55;
export const PENALTY_SPOT_Z = 11;

// --- Keeper ---
/** Horizontal speed with the arrow keys, m/s. */
export const KEEPER_SPEED = 8;
/** How far the keeper can wander past the center, m. */
export const KEEPER_X_LIMIT = 3.85;
/** Initial upward velocity of a jump, m/s (peak ~0.82 m, ~0.7 s airborne). */
export const JUMP_VELOCITY = 4.6;
/** Downward acceleration while airborne, m/s^2. */
export const GRAVITY = 13;
/** Half-width of the catch box around the keeper's center, m. */
export const CATCH_HALF_WIDTH = 0.85;
/** Vertical reach above the keeper's feet (arms up), m. */
export const STANDING_REACH = 2.0;
/** While airborne the covered zone's floor rises with the feet: ground balls
 *  roll under a jumping keeper. Fraction of jumpOffset that becomes floor. */
export const AIRBORNE_FLOOR_FACTOR = 0.6;

// --- Difficulty: four hand-designed phases (tuned by playtesting, not by
// simulation). ShotField.paramsAt picks the values for each kick:
//
//   A. Warmup      — the first WARMUP_KICKS shots: slow, low, straight.
//   B. Cadence     — until CADENCE_END_S: kicks come faster and faster,
//                    the shots themselves stay tame.
//   C. Progressive — until INFERNO_START_S: a mix of curved balls and
//                    straight-but-fast ones, high shots ramp in.
//   D. Inferno     — everything maxed (blended in over INFERNO_BLEND_S). ---

/** Phase boundaries. */
export const WARMUP_KICKS = 4;
export const CADENCE_END_S = 45;
export const INFERNO_START_S = 120;
/** Seconds to blend from phase C's end into the inferno values. */
export const INFERNO_BLEND_S = 10;

/** A. Warmup. */
export const WARMUP_FLIGHT = 1.4;
export const WARMUP_INTERVAL = 2.0;

/** B. Cadence climb (values at the start and at CADENCE_END_S). */
export const CADENCE_FLIGHT_START = 1.35;
export const CADENCE_FLIGHT_END = 1.15;
export const CADENCE_INTERVAL_START = 1.9;
export const CADENCE_INTERVAL_END = 1.15;
export const CADENCE_HIGH_CHANCE = 0.1;

/** C. Progressive mix (values at CADENCE_END_S -> at INFERNO_START_S).
 *  Straight shots get fast ("faciles rapidos"); curved ones stay slower but
 *  bend. Both threats ramp together. */
export const MIX_STRAIGHT_FLIGHT_START = 1.1;
export const MIX_STRAIGHT_FLIGHT_END = 0.8;
export const MIX_CURVED_FLIGHT_START = 1.15;
export const MIX_CURVED_FLIGHT_END = 1.0;
export const MIX_INTERVAL_START = 1.15;
export const MIX_INTERVAL_END = 1.0;
export const MIX_CURVE_CHANCE_START = 0.15;
export const MIX_CURVE_CHANCE_END = 0.4;
export const MIX_HIGH_START = 0.1;
export const MIX_HIGH_END = 0.3;
/** Doubles appear only in the back half of phase C. */
export const MIX_DOUBLE_CHANCE = 0.1;

/** D. Inferno. */
export const INFERNO_STRAIGHT_FLIGHT = 0.72;
export const INFERNO_CURVED_FLIGHT = 0.9;
export const INFERNO_INTERVAL = 0.9;
export const INFERNO_HIGH_CHANCE = 0.4;
export const INFERNO_CURVE_CHANCE = 0.4;
export const INFERNO_DOUBLE_CHANCE = 0.25;

/** Peak sideways bend of a curved shot, m. */
export const CURVE_MIN_AMOUNT = 0.9;
export const CURVE_MAX_AMOUNT = 1.9;
/** Delay of the second ball of a double kick, s. */
export const DOUBLE_DELAY = 0.35;
/** If the first ball of a double is high (forces a jump), the second waits
 *  longer so an airborne keeper can land and still have a chance. */
export const DOUBLE_DELAY_AFTER_HIGH = 0.55;
/** Max lateral distance between both balls of a double, m. The keeper
 *  covers KEEPER_SPEED * DOUBLE_DELAY = 2.8 m between arrivals (plus the
 *  catch reach), so this keeps doubles brutal but physically saveable. */
export const DOUBLE_MAX_SPREAD = 2.4;
/** Shots aim at least this far inside the posts / under the bar, m. */
export const TARGET_MARGIN = 0.35;

// --- Kicker animation ---
/** Seconds of run-up before each kick (the telegraph). */
export const RUNUP_TIME = 0.6;
/** Seconds of the kick follow-through pose. */
export const FOLLOW_THROUGH = 0.35;

// --- Ball ---
export const BALL_RADIUS = 0.13;
/** Seconds a resolved (saved / conceded) ball keeps flying before fading. */
export const BALL_LINGER = 0.7;

// --- Rules ---
/** Goals conceded before the run ends. */
export const MAX_MISSES = 3;
/** First kick happens this long after YA, s. */
export const FIRST_KICK_DELAY = 2;

/** Max simulated dt per frame (s) so a hitch can't teleport balls. */
export const MAX_DT = 0.05;

/** Master volume of the synthesized sound effects (0-1). */
export const SOUND_VOLUME = 0.18;

// --- Palette (sober night-match look) ---
export const COLOR_BACKGROUND = 0x090d18;
export const COLOR_FOG = 0x090d18;
