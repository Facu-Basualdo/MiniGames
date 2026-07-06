export const BEST_KEY = "puerco-arana:best";

// Fixed logical resolution the canvas renders at (scaled to fit the viewport).
// Landscape: the run advances to the right forever.
export const VIEW_WIDTH = 900;
export const VIEW_HEIGHT = 600;

export const MAX_DT = 0.05; // clamp large frame gaps (tab switches) to avoid tunneling

// Physics (world units are canvas pixels; y grows downward).
export const GRAVITY = 1500; // px/s^2
export const PIG_RADIUS = 17;
export const AIR_DRAG = 0.05; // fraction of horizontal speed shed per second in free flight
export const MAX_SPEED = 1500; // hard cap on the pig's speed

// Web / swing.
export const WEB_RANGE = 460; // max distance at which an anchor can be grabbed
export const WEB_AHEAD_MIN = -70; // anchors slightly behind the pig are still grabbable
export const SWING_PUMP = 260; // tangential px/s^2 fed into the swing while attached
export const ROPE_MIN = 70; // never attach shorter than this (avoids dead pivots)

// The street: touching it ends the run.
export const STREET_Y = 548;

// Anchor generation (world px). Anchors sit on antenna tips of tall towers.
export const ANCHOR_GAP_MIN = 230;
export const ANCHOR_GAP_MAX = 400;
export const ANCHOR_Y_MIN = 55;
export const ANCHOR_Y_MAX = 215;

// Scoring.
export const PX_PER_POINT = 40; // world px advanced per distance point
export const BONUS_SPEED = 650; // releasing faster than this grants a bonus
export const BONUS_DIVISOR = 250; // bonus points = floor(speed / this)

// Camera: the pig is kept at this fraction of the view width.
export const CAMERA_PIG_VIEW_X = 0.36;
export const CAMERA_EASE = 5; // exponential ease factor (per second)

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.7; // seconds per countdown step

export const SOUND_VOLUME = 0.18;
