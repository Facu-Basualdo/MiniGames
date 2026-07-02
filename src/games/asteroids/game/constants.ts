export const BEST_KEY = "asteroids:best";

// Physical Settings
export const SHIP_RADIUS = 18; // in pixels
export const SHIP_ROTATION_SPEED = 5.0; // radians per second
export const SHIP_THRUST = 400; // pixels per second squared
export const SHIP_FRICTION = 0.985; // velocity multiplier per frame (~60fps)

export const INVULNERABILITY_DURATION = 3.0; // seconds
export const INVULNERABILITY_FLASH_RATE = 0.15; // flash interval in seconds

export const LASER_SPEED = 750; // pixels per second
export const LASER_LIFETIME = 1.3; // seconds
export const LASER_COOLDOWN = 0.18; // seconds between shots
export const MAX_LASERS = 10;

// Asteroid Settings
export const ASTEROID_MAX_VERTICES = 12;
export const ASTEROID_MIN_VERTICES = 8;
export const ASTEROID_JAGGEDNESS = 0.25; // 0 to 0.5 (noise level)
export const ASTEROID_SPAWN_INTERVAL = 5.0; // seconds between spawns

export const ASTEROID_SPEEDS = {
  3: { min: 70, max: 130 },   // Large
  2: { min: 110, max: 210 },  // Medium
  1: { min: 180, max: 300 },  // Small
};

export const ASTEROID_RADII = {
  3: 45, // Large
  2: 24, // Medium
  1: 12, // Small
};

export const ASTEROID_SCORES = {
  3: 20,
  2: 50,
  1: 100,
};

// UI & Starfield
export const STAR_COUNT = 100;
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75; // seconds per step

// Audio Synth config
export const SOUND_VOLUME = 0.15;
