export const BEST_KEY = "dunk-shot:best";

// Fixed logical resolution the canvas renders at (scaled to fit the viewport).
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 760;

export const MAX_DT = 0.05; // clamp large frame gaps (tab switches) to avoid tunneling

// Physics (world units are canvas pixels; y grows downward).
export const GRAVITY = 2400; // px/s^2
export const BALL_RADIUS = 21;
export const WALL_RESTITUTION = 0.72; // side-wall bounce energy kept
export const RIM_RESTITUTION = 0.5; // rim-end bounce energy kept

// Hoop geometry. The rim is an opening of 2 * RIM_RADIUS centered on (x, y);
// its two endpoints are the only solid parts the ball collides with.
export const RIM_RADIUS = 46;
export const RIM_END_RADIUS = 7; // collision circle at each rim endpoint
export const NET_DEPTH = 46; // drawn net height below the rim

// Slingshot launch: drag back from anywhere, velocity = drag vector * power.
export const LAUNCH_POWER = 9; // (px/s) of launch speed per px of drag
export const MAX_LAUNCH_SPEED = 1650;
export const MIN_DRAG = 26; // shorter drags cancel instead of launching

// Where new target hoops spawn relative to the current one (world px, upward).
export const HOOP_MIN_RISE = 90;
export const HOOP_MAX_RISE = 230;
export const HOOP_MARGIN_X = 80; // min distance of a hoop center to a wall

// Moving hoops: from this many baskets on, new target hoops oscillate
// horizontally, ramping amplitude and speed over the next HOOP_MOVE_RAMP baskets.
export const HOOP_MOVE_START = 4;
export const HOOP_MOVE_RAMP = 8;
export const HOOP_MOVE_AMP_MIN = 36; // px of horizontal oscillation
export const HOOP_MOVE_AMP_MAX = 85;
export const HOOP_MOVE_SPEED_MIN = 1.4; // rad/s
export const HOOP_MOVE_SPEED_MAX = 3.0;

// The camera eases so the current hoop sits at this view-space y.
export const CAMERA_HOOP_VIEW_Y = 560;
export const CAMERA_EASE = 6; // exponential ease factor (per second)

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.7; // seconds per countdown step

export const SOUND_VOLUME = 0.18;
