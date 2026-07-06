import { GRID_SIZE } from "./constants";

export class Obstacle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public speed: number;
  public dir: number; // 1 = right, -1 = left
  public type: "car" | "log" | "turtle";
  public color: string;
  public laneIndex: number;
  /**
   * Length of the lane's repeating pattern (`count * spacing`). Obstacles wrap
   * modulo this on a ring so their even spacing is preserved forever instead of
   * drifting into clusters (the old fixed-edge reset let them bunch up).
   */
  public wrapWidth: number;

  constructor(
    x: number,
    laneIndex: number,
    width: number,
    speed: number,
    dir: number,
    type: "car" | "log" | "turtle",
    color: string = "#ffffff",
    wrapWidth: number = 0
  ) {
    this.x = x;
    this.laneIndex = laneIndex;
    this.y = laneIndex * GRID_SIZE;
    this.width = width;
    this.height = GRID_SIZE - 4; // slight vertical padding
    this.speed = speed;
    this.dir = dir;
    this.type = type;
    this.color = color;
    this.wrapWidth = wrapWidth;
  }

  public update(dt: number): void {
    this.x += this.speed * this.dir * dt;

    // Ring wrap: both boundaries sit fully off-screen (x in [-width, wrapWidth-width))
    // so obstacles never pop in mid-screen and stay evenly spaced.
    if (this.wrapWidth > 0) {
      while (this.x < -this.width) this.x += this.wrapWidth;
      while (this.x >= this.wrapWidth - this.width) this.x -= this.wrapWidth;
    }
  }

  /**
   * The visible body is inset from the raw AABB by this much on each horizontal
   * end (cars are drawn at `x + 2`, logs at `x + 1`). Collisions test against the
   * visible body so a death only fires when the frog truly overlaps what's drawn.
   */
  private static readonly VISUAL_INSET = 3;

  private get bodyLeft(): number {
    return this.x + Obstacle.VISUAL_INSET;
  }

  private get bodyRight(): number {
    return this.x + this.width - Obstacle.VISUAL_INSET;
  }

  /**
   * True when a frog hitbox centred at `cx` with the given half-width overlaps
   * the obstacle's visible body horizontally. The frog is always inside the
   * obstacle's lane row, so a 1D test is exact.
   */
  public overlapsX(cx: number, half: number): boolean {
    return cx + half > this.bodyLeft && cx - half < this.bodyRight;
  }

  /**
   * Horizontal overlap in pixels between a frog body `[cx - half, cx + half]`
   * and this obstacle's visible body (negative/0 = no overlap). Used for river
   * support: a large-enough overlap means the frog is standing on the platform,
   * so edge/side landings count instead of only a dead-centre hit.
   */
  public overlapX(cx: number, half: number): number {
    return Math.min(cx + half, this.bodyRight) - Math.max(cx - half, this.bodyLeft);
  }
}
