import {
  TARGET_CONFIGS,
  type TargetSize,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "./constants";

export class Target {
  x: number;
  y: number;
  readonly size: TargetSize;
  readonly radius: number;
  readonly points: number;
  private speed: number;
  private direction: number; // 1 or -1
  alive = true;

  // ── Destroy animation ─────────────────────────────────────────────
  destroying = false;
  private destroyTimer = 0;
  private static readonly DESTROY_DURATION = 0.35;
  private fragments: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = [];

  constructor(size: TargetSize, speedMult: number) {
    this.size = size;
    const cfg = TARGET_CONFIGS[size];
    this.radius = cfg.radius;
    this.points = cfg.points;
    this.speed = cfg.baseSpeed * (1 + speedMult);

    // Spawn on a random side
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.x = this.direction === 1 ? -this.radius : VIEW_WIDTH + this.radius;

    // Random Y in the "target zone" (upper play area above the fence)
    const minY = VIEW_HEIGHT * 0.15 + this.radius;
    const maxY = VIEW_HEIGHT * 0.72 - this.radius;
    this.y = minY + Math.random() * (maxY - minY);
  }

  /** Returns true when the target has left the screen and should be removed. */
  get offScreen(): boolean {
    return (this.direction === 1 && this.x > VIEW_WIDTH + this.radius + 10)
      || (this.direction === -1 && this.x < -this.radius - 10);
  }

  update(dt: number): void {
    if (this.destroying) {
      this.destroyTimer += dt;
      for (const f of this.fragments) {
        f.vy += 400 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      if (this.destroyTimer >= Target.DESTROY_DURATION) {
        this.alive = false;
      }
      return;
    }

    this.x += this.speed * this.direction * dt;
  }

  hitTest(mx: number, my: number): boolean {
    if (this.destroying) return false;
    const dx = mx - this.x;
    const dy = my - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  destroy(): void {
    this.destroying = true;
    this.destroyTimer = 0;
    // Generate fragments
    const colors = ["#c0392b", "#e74c3c", "#ecf0f1", "#bdc3c7", "#6b4226"];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const speed = 80 + Math.random() * 120;
      this.fragments.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        r: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.destroying) {
      // Draw fragments
      const alpha = 1 - this.destroyTimer / Target.DESTROY_DURATION;
      ctx.globalAlpha = alpha;
      for (const f of this.fragments) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    const { x, y, radius } = this;

    // ── Wooden backing plate ────────────────────────────────────────
    ctx.fillStyle = "#6b4226";
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.fill();

    // ── Target rings ────────────────────────────────────────────────
    const rings: [number, string][] = [
      [1.0, "#ecf0f1"],
      [0.8, "#e74c3c"],
      [0.6, "#ecf0f1"],
      [0.4, "#e74c3c"],
      [0.2, "#f1c40f"],
    ];
    for (const [pct, color] of rings) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius * pct, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Center dot ──────────────────────────────────────────────────
    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // ── Subtle shadow below ─────────────────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(x, y + radius + 8, radius * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
