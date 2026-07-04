// --- Play field: a large open flight corridor in space. ---
export const FIELD_HALF_WIDTH = 9;
export const FIELD_HALF_HEIGHT = 6;
export const CORRIDOR_LENGTH = 500;

// --- The ship. ---
export const PLAYER_HALF_WIDTH = 0.5;
export const PLAYER_HALF_HEIGHT = 0.4;
// Radius used for circular (per-object) collision against space debris.
export const PLAYER_RADIUS = 0.6;
export const PLAYER_MOVE_SPEED = 15; // units/s of steering (per axis)
export const PLAYER_Z = 0;
export const PLAYER_SMOOTHING = 12;

// --- Camera: fixed, looking straight down the corridor axis. ---
export const CAMERA_Z = 14;

// --- Space backdrop. ---
export const BACKGROUND_COLOR = 0x03040c;
export const FOG_NEAR = 30;
export const FOG_FAR = 240;
export const STAR_COUNT = 900;

// --- Travel speed (ramps up over time). ---
export const BASE_SPEED = 20; // units/s obstacles travel toward the ship
export const MAX_SPEED = 78;
export const SPEED_RAMP_PER_SEC = 1.5;

// --- Obstacle pacing. ---
export const OBSTACLE_SPACING_MIN = 18;
export const OBSTACLE_SPACING_MAX = 27;
export const OBSTACLE_SPAWN_START_Z = -80;
export const OBSTACLE_DESPAWN_MARGIN = 6;
export const OBSTACLE_ACTIVE_COUNT = 7;

// Guaranteed clear lane through each debris field: half-extents, shrink with score.
export const LANE_HALF_WIDTH_START = 3.2;
export const LANE_HALF_HEIGHT_START = 2.4;
export const LANE_HALF_WIDTH_MIN = 1.5;
export const LANE_HALF_HEIGHT_MIN = 1.2;
export const LANE_SHRINK_PER_POINT = 0.028;

// Debris density: the objects are only a *sparse telegraph* of the barrier —
// the actual block is the invisible lane test in Obstacle.isSafe. Kept sparse
// (bigger cell = fewer objects) so a field never obscures the next one. The
// amber lane markers, not the debris, tell the player where the safe hole is.
export const DEBRIS_CELL = 4.5;
// Random thinning on top of the grid, for fine control of density (grid steps
// are coarse). 1 = keep every cell; lower = fewer objects.
export const DEBRIS_KEEP_CHANCE = 0.9;
export const DEBRIS_OBJ_MIN_RADIUS = 0.85;
export const DEBRIS_OBJ_MAX_RADIUS = 1.35;

// Fraction of the ship's reachable travel the clear lane may drift from the
// previous one (keeps every field catchable — skill, not luck).
export const GAP_REACH_FACTOR = 0.62;

export const COLLISION_TOLERANCE = 0.08; // units of forgiveness

// Space-object palette.
export const HAZARD_COLOR = 0xffa62b; // orange neon lane markers
export const ROCK_COLOR = 0x6b6f7a; // meteorite grey
export const ICE_COLOR = 0x8fd6ff; // icy blue crystal
export const DEBRIS_COLOR = 0x9aa0ab; // metallic wreckage

export const BEST_SCORE_KEY = "vector-rush-best";
