// =============================================================================
// Boilerbound — all tunable values live here. Tune gameplay from this file.
// Front-view closed steampunk boiler room seen down the -Z axis: the player
// dodges steam jets that erupt from floor vents in boss-style patterns.
// =============================================================================

// --- Room bounds (world units, XY plane; camera looks down -Z). ---
export const ROOM_HALF_WIDTH = 8; // X in [-8, 8]
export const FLOOR_Y = 0;
export const CEILING_Y = 9;
/** Inner surface of the climbable side walls (where the player clings). */
export const WALL_X = ROOM_HALF_WIDTH;

// --- The player (a plated 2D-in-3D dodger; y is the feet / bottom). ---
export const PLAYER_HALF_WIDTH = 0.42;
export const PLAYER_HEIGHT = 1.3;
export const PLAYER_SPEED = 9.5; // horizontal run speed (units/s)
export const PLAYER_ACCEL = 90; // how fast we reach run speed on the ground
export const PLAYER_AIR_ACCEL = 42; // weaker air control
export const PLAYER_FRICTION = 70; // ground deceleration when no input
export const GRAVITY = 34;
export const JUMP_VELOCITY = 13.5; // v^2/2g ~= 2.7 units — a hop, never clears steam
export const JUMP_CUT = 0.42; // releasing jump mid-rise cuts velocity to this fraction
export const MAX_FALL_SPEED = 26;

// --- Wall cling / wall jump (survive a floor inferno by hanging on the walls). ---
export const WALL_SLIDE_SPEED = 3.2; // capped fall speed while clinging
export const WALL_JUMP_VY = 12.5;
export const WALL_JUMP_VX = 10.5;
export const WALL_JUMP_LOCK = 0.16; // s of input lock after a wall jump (so it arcs off)
export const WALL_STICK_MARGIN = 0.12; // how close to the wall counts as touching

// --- Dash (short i-frame burst to slip through a last-moment jet). ---
export const DASH_SPEED = 22;
export const DASH_TIME = 0.16;
export const DASH_IFRAME_TIME = 0.22; // invulnerability window (a touch longer than the dash)
export const DASH_COOLDOWN = 0.55;

// --- Steam vents: a row of floor grilles across X. ---
export const VENT_COUNT = 9;
export const CELL_WIDTH = (2 * ROOM_HALF_WIDTH) / VENT_COUNT; // ~1.78
/** Kill-zone half-width per vent. <0.5*cell so adjacent inactive cells are safe,
 *  but wide enough that two adjacent active vents seal the gap between them. */
export const VENT_KILL_HALF = CELL_WIDTH * 0.46;
/** Steam is lethal from the floor up to this height; above it (a high wall
 *  cling) is safe — the reason the walls are climbable. Particles rise higher. */
export const STEAM_KILL_HEIGHT = 6.2;
// Just above the kill line so the cloud tops out where the danger does (a small
// non-lethal wisp above lets you cling high on a wall and read it as safe).
export const STEAM_VISUAL_HEIGHT = 6.8;

// --- Vent state timing (base values; difficulty shortens the warning). ---
export const WARN_TIME_START = 1.1; // s of red-glow warning before eruption
export const WARN_TIME_MIN = 0.42;
export const WARN_TIME_STEP = 0.11; // shaved per difficulty level
export const ACTIVE_TIME = 1.05; // s the jet is live and lethal
export const DISSIPATE_TIME = 0.9; // s the jet fades (blocks vision, no damage)

// --- Difficulty ramp (every DIFF_STEP seconds a level is gained). ---
export const DIFF_STEP = 15;
/** Gap between boss-pattern launches, shrinking with level. */
export const PATTERN_GAP_START = 1.7;
export const PATTERN_GAP_MIN = 0.55;
export const PATTERN_GAP_STEP = 0.14;

// --- Overload phase (emergency: red flicker + everything twice as fast). ---
export const OVERLOAD_PERIOD = 32; // s between overloads
export const OVERLOAD_DURATION = 10;
export const OVERLOAD_TIME_SCALE = 2;
export const OVERLOAD_FIRST_AT = 22; // first overload can't hit before this

// --- Environment palette. ---
export const BACKGROUND_COLOR = 0x1a1210;
export const FOG_NEAR = 16;
export const FOG_FAR = 46;
export const METAL_COLOR = 0x4a3b30; // rusted iron
export const METAL_DARK = 0x2a201a;
export const BRONZE_COLOR = 0x8a6a2f; // gears / trim
export const LAMP_COLOR = 0xffb45a; // warm gas-lamp amber
export const WARNING_COLOR = 0xff3018; // red danger indicator
export const STEAM_COLOR = 0xf2f4f7; // white-grey vapour

// --- Camera framing target (the whole room must fit; see Game.frameCamera). ---
export const CAMERA_VFOV = 52; // degrees
export const CAMERA_MARGIN = 1.12; // fit slack around the room box

export const BEST_SCORE_KEY = "boilerbound-best";
