import {
  DOUBLE_JUMP_VELOCITY,
  FLOOR_Y,
  GRAVITY,
  JUMP_CUT,
  JUMP_VELOCITY,
  MAX_JUMPS,
  MOVE_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  VIEW_WIDTH,
} from "./constants";

/** The neon runner: horizontal movement, gravity, and a variable-height
 *  double jump. `x` is the horizontal centre, `y` is the feet (bottom). */
export class Player {
  x = VIEW_WIDTH / 2;
  y = FLOOR_Y;
  vy = 0;
  /** Facing direction for the drawing: -1 left, 1 right. */
  facing = 1;
  onGround = true;

  private jumpsUsed = 0;
  private jumpHeld = false;

  reset(): void {
    this.x = VIEW_WIDTH / 2;
    this.y = FLOOR_Y;
    this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.jumpsUsed = 0;
    this.jumpHeld = false;
  }

  /** Top of the player's bounding box (feet minus height). */
  get top(): number {
    return this.y - PLAYER_HEIGHT;
  }

  /** Vertical centre of the player's bounding box. */
  get centerY(): number {
    return this.y - PLAYER_HEIGHT / 2;
  }

  /** Starts a jump. Returns true if one actually fired (for the sound). */
  jump(): boolean {
    if (this.jumpsUsed >= MAX_JUMPS) return false;
    this.vy = -(this.jumpsUsed === 0 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY);
    this.jumpsUsed += 1;
    this.onGround = false;
    this.jumpHeld = true;
    return true;
  }

  /** Releasing the jump early cuts the rising velocity → shorter hops. */
  releaseJump(): void {
    if (this.jumpHeld && this.vy < 0) this.vy *= JUMP_CUT;
    this.jumpHeld = false;
  }

  /** @param dir horizontal input, -1 (left) .. 1 (right). */
  update(dt: number, dir: number): void {
    this.x += dir * MOVE_SPEED * dt;
    if (dir < 0) this.facing = -1;
    else if (dir > 0) this.facing = 1;

    const half = PLAYER_WIDTH / 2;
    if (this.x < half) this.x = half;
    else if (this.x > VIEW_WIDTH - half) this.x = VIEW_WIDTH - half;

    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.y >= FLOOR_Y) {
      this.y = FLOOR_Y;
      this.vy = 0;
      this.onGround = true;
      this.jumpsUsed = 0;
      this.jumpHeld = false;
    } else {
      this.onGround = false;
    }
  }
}
