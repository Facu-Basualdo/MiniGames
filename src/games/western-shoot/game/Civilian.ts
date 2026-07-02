import {
  CIVILIAN_WIDTH,
  CIVILIAN_HEIGHT,
  CIVILIAN_BASE_SPEED,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "./constants";

export class Civilian {
  x: number;
  y: number;
  readonly width = CIVILIAN_WIDTH;
  readonly height = CIVILIAN_HEIGHT;
  private speed: number;
  private direction: number;
  alive = true;

  // ── Hit animation ────────────────────────────────────────────────
  hit = false;
  private hitTimer = 0;
  private static readonly HIT_DURATION = 0.5;
  private fallAngle = 0;

  constructor(speedMult: number) {
    this.speed = CIVILIAN_BASE_SPEED * (1 + speedMult);
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.x = this.direction === 1 ? -this.width : VIEW_WIDTH + this.width;

    // Walk along the ground area (above the fence)
    const minY = VIEW_HEIGHT * 0.45;
    const maxY = VIEW_HEIGHT * 0.72 - this.height;
    this.y = minY + Math.random() * (maxY - minY);
  }

  get offScreen(): boolean {
    return (this.direction === 1 && this.x > VIEW_WIDTH + this.width + 10)
      || (this.direction === -1 && this.x < -this.width - 10);
  }

  update(dt: number): void {
    if (this.hit) {
      this.hitTimer += dt;
      this.fallAngle = Math.min(Math.PI / 2, this.fallAngle + dt * 5);
      if (this.hitTimer >= Civilian.HIT_DURATION) {
        this.alive = false;
      }
      return;
    }
    this.x += this.speed * this.direction * dt;
  }

  hitTest(mx: number, my: number): boolean {
    if (this.hit) return false;
    const hw = this.width / 2;
    const hh = this.height / 2;
    const cx = this.x;
    const cy = this.y - this.height / 2;
    return mx >= cx - hw && mx <= cx + hw && my >= cy - hh && my <= cy + hh;
  }

  onHit(): void {
    this.hit = true;
    this.hitTimer = 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.hit) {
      const alpha = 1 - this.hitTimer / Civilian.HIT_DURATION;
      ctx.globalAlpha = alpha;
      ctx.rotate(this.fallAngle * this.direction);
    }

    // ── Body ────────────────────────────────────────────────────────
    // Torso (blue/green to distinguish from enemies)
    ctx.fillStyle = "#2e86c1";
    ctx.beginPath();
    ctx.roundRect(-12, -this.height + 22, 24, 30, 4);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#5b3a1a";
    ctx.fillRect(-10, -this.height + 52, 8, 14);
    ctx.fillRect(2, -this.height + 52, 8, 14);

    // Head
    ctx.fillStyle = "#f0c27a";
    ctx.beginPath();
    ctx.arc(0, -this.height + 14, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hat (civilian style — small rounded hat)
    ctx.fillStyle = "#5dade2";
    ctx.beginPath();
    ctx.ellipse(0, -this.height + 5, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8, -this.height + 1, 16, 6);

    // Face details
    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.arc(-4, -this.height + 13, 1.5, 0, Math.PI * 2);
    ctx.arc(4, -this.height + 13, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -this.height + 16, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // "INNOCENT" signal - small exclamation above
    if (!this.hit) {
      ctx.fillStyle = "rgba(46,134,193,0.7)";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("👤", 0, -this.height - 6);
    }

    ctx.restore();
  }
}
