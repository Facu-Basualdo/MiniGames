import {
  AIRBORNE_FLOOR_FACTOR,
  CATCH_HALF_WIDTH,
  GRAVITY,
  JUMP_VELOCITY,
  KEEPER_SPEED,
  KEEPER_X_LIMIT,
  STANDING_REACH,
} from "./constants";

/** The goalkeeper: continuous left/right movement along the goal line plus a
 *  gravity jump. Pure state in meters — KeeperView draws it. Exposes the
 *  catch box shots are judged against. */
export class Keeper {
  /** Center X on the goal line, m. */
  x = 0;
  /** How high the feet are above the ground (0 = standing). */
  jumpOffset = 0;
  /** Smoothed horizontal velocity in [-1, 1], for the run animation. */
  lean = 0;

  private vy = 0;
  private lastX = 0;

  reset(): void {
    this.x = 0;
    this.jumpOffset = 0;
    this.vy = 0;
    this.lean = 0;
    this.lastX = 0;
  }

  get grounded(): boolean {
    return this.jumpOffset === 0;
  }

  /** Keyboard steering: move continuously in `dir` (-1 / 0 / 1). */
  steer(dir: number, dt: number): void {
    if (dir === 0) return;
    this.x = Math.min(KEEPER_X_LIMIT, Math.max(-KEEPER_X_LIMIT, this.x + dir * KEEPER_SPEED * dt));
  }

  /** Mouse/touch steering: place the keeper directly under the pointer. */
  moveTo(worldX: number): void {
    this.x = Math.min(KEEPER_X_LIMIT, Math.max(-KEEPER_X_LIMIT, worldX));
  }

  /** Starts a jump if standing. Airborne keepers can't double-jump. */
  jump(): void {
    if (!this.grounded) return;
    this.vy = JUMP_VELOCITY;
  }

  update(dt: number): void {
    if (!this.grounded || this.vy !== 0) {
      this.jumpOffset += this.vy * dt;
      this.vy -= GRAVITY * dt;
      if (this.jumpOffset <= 0) {
        this.jumpOffset = 0;
        this.vy = 0;
      }
    }

    const vx = dt > 0 ? (this.x - this.lastX) / dt : 0;
    this.lastX = this.x;
    this.lean += (Math.max(-1, Math.min(1, vx / KEEPER_SPEED)) - this.lean) * Math.min(1, dt * 10);
  }

  /** True when a shot arriving at (tx, ty) on the keeper plane is caught.
   *  The covered zone is anchored to the feet: a jump raises the reach above
   *  the crossbar but also lifts the floor, so ground balls roll under an
   *  airborne keeper — jumping is a commitment. */
  catches(tx: number, ty: number): boolean {
    if (Math.abs(tx - this.x) > CATCH_HALF_WIDTH) return false;
    const floor = this.jumpOffset * AIRBORNE_FLOOR_FACTOR;
    const ceiling = this.jumpOffset + STANDING_REACH;
    return ty >= floor && ty <= ceiling;
  }
}
