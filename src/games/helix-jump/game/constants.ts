export const BEST_SCORE_KEY = "mg:helix-jump:best";

// Physical constants
export const GRAVITY = -18.0;
export const BOUNCE_VELOCITY = 7.5;
export const MAX_FALL_VELOCITY = -22.0;

// Geometry constants
export const BALL_RADIUS = 0.2;
export const TOWER_RADIUS = 0.95;
export const PLATFORM_INNER_RADIUS = 0.95;
export const PLATFORM_OUTER_RADIUS = 2.2;
export const PLATFORM_THICKNESS = 0.15;
export const LEVEL_SPACING = 3.8;

// Level Gen
export const SEGMENTS_PER_LEVEL = 12;
export const GAP_SIZE_SEGMENTS = 2; // size of hole
export const VISIBLE_LEVELS_AHEAD = 5;
export const VISIBLE_LEVELS_BEHIND = 2;

// Input constants
export const ROTATION_SPEED_KEYBOARD = 5.5; // rads per second
export const ROTATION_SPEED_POINTER = 0.007; // rads per pixel
export const ROTATION_LERP = 0.15; // smoothing

// Camera settings
export const CAM_FOV = 60;
export const CAM_HEIGHT_OFFSET = 2.2;
export const CAM_BACK = 6.0;
export const CAM_LOOK_Y_OFFSET = -1.5;
export const CAM_LERP = 0.1;

// Combo mechanics
export const COMBO_THRESHOLD = 3; // levels passed to activate fireball

// Visual styles
export const BACKGROUND_COLOR = "#0d0614";
export const TOWER_COLOR = 0x1d1a24;
export const PLATFORM_COLORS = [
  0x8e44ad, // Amethyst
  0x2980b9, // Blue
  0x27ae60, // Green
  0x16a085, // Teal
  0xf39c12, // Orange
  0xd35400, // Rust
];
export const OBSTACLE_COLOR = 0xe74c3c; // Bright red
export const BALL_COLOR = 0x00ffcc; // Bright cyan
export const BALL_FIRE_COLOR = 0xff5500; // Bright glowing orange
