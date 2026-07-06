// --- Play field: a 3D trench in space. ---
export const FIELD_HALF_WIDTH = 9; // trench is 18 units wide
export const FIELD_HALF_HEIGHT = 6; // floor is at y = -6

// Trench details
export const TRENCH_WIDTH = 18;
export const TRENCH_WALL_HEIGHT = 18; // walls rise from -6 to 12
export const TRENCH_SEGMENT_LENGTH = 40; // length of one modular section
export const TRENCH_SEGMENT_COUNT = 8; // how many segments we keep active

// --- The player's ship. ---
export const PLAYER_HALF_WIDTH = 0.5;
export const PLAYER_HALF_HEIGHT = 0.4;
export const PLAYER_RADIUS = 0.6;
export const PLAYER_MOVE_SPEED = 16; // units/s of steering (per axis)
export const PLAYER_Z = 0;
export const PLAYER_SMOOTHING = 12;
export const SHIELD_MAX = 3;

// --- Camera: third-person chase, sits behind the ship (which is at z = 0). ---
export const CAMERA_Z = 4.5;

// --- Space backdrop. ---
export const BACKGROUND_COLOR = 0x010206;
export const FOG_NEAR = 30;
export const FOG_FAR = 220;
export const STAR_COUNT = 600;

// --- Travel speed (ramps up over time). ---
export const BASE_SPEED = 28; // units/s trench travels toward the ship
export const MAX_SPEED = 82;
export const SPEED_RAMP_PER_SEC = 1.1;

// --- Difficulty curve. ---
// `difficulty` grows as elapsed / DIFFICULTY_RAMP_TIME (1.0 at that many seconds, and keeps
// climbing past it). It drives spawn density, extra drones, drone aggression and boss stats.
export const DIFFICULTY_RAMP_TIME = 85;
export const SPAWN_INTERVAL_DROP = 2.0; // how much the spawn interval shrinks per 1.0 difficulty

// --- Weapons and combat. ---
export const PLAYER_FIRE_COOLDOWN = 0.16; // fire rate limit
export const LASER_SPEED = 140; // player laser speed
export const ENEMY_LASER_SPEED = 50; // enemy laser speed

// Enemy Spawning and AI
export const ENEMY_SPAWN_START_Z = -180;
export const ENEMY_SPAWN_INTERVAL_START = 2.4; // seconds between spawns at difficulty 0
export const ENEMY_SPAWN_INTERVAL_MIN = 0.55; // floor at high difficulty

// High score storage key
export const BEST_SCORE_KEY = "trench-rush-best";
export const COLLISION_TOLERANCE = 0.08;
