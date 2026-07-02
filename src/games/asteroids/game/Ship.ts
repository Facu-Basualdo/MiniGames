import {
  SHIP_RADIUS,
  SHIP_ROTATION_SPEED,
  SHIP_THRUST,
  SHIP_FRICTION,
  INVULNERABILITY_DURATION,
  INVULNERABILITY_FLASH_RATE,
} from "./constants";

export class Ship {
  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public angle = -Math.PI / 2; // Pointing upwards initially
  public radius = SHIP_RADIUS;
  public lives = 1;
  public invulnerableTime = 0;
  public isThrusting = false;

  private color = "#00f3ff"; // Neon Cyan

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.invulnerableTime = INVULNERABILITY_DURATION;
    this.isThrusting = false;
  }

  rotate(direction: number, dt: number): void {
    // direction is -1 (left) or 1 (right)
    this.angle += direction * SHIP_ROTATION_SPEED * dt;
  }

  applyThrust(dt: number): void {
    this.isThrusting = true;
    this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
    this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
  }

  update(dt: number, width: number, height: number): void {
    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Apply friction/drag to slow down ship when not thrusting
    this.vx *= Math.pow(SHIP_FRICTION, dt * 60);
    this.vy *= Math.pow(SHIP_FRICTION, dt * 60);

    // Update invulnerability time
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      if (this.invulnerableTime < 0) {
        this.invulnerableTime = 0;
      }
    }

    // Screen wraparound
    if (this.x < -this.radius) this.x += width + this.radius * 2;
    if (this.x > width + this.radius) this.x -= width + this.radius * 2;
    if (this.y < -this.radius) this.y += height + this.radius * 2;
    if (this.y > height + this.radius) this.y -= height + this.radius * 2;
  }

  isInvulnerable(): boolean {
    return this.invulnerableTime > 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    const isFlashing = this.isInvulnerable();
    const showShip = !isFlashing || Math.floor(this.invulnerableTime / INVULNERABILITY_FLASH_RATE) % 2 === 0;

    // 1. Draw shield if invulnerable
    if (isFlashing) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 243, 255, ${0.15 + 0.1 * Math.sin(performance.now() / 80)})`;
      ctx.fillStyle = `rgba(0, 243, 255, ${0.03 + 0.02 * Math.sin(performance.now() / 80)})`;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // 2. Draw Ship (triangle shape pointing to the right, rotated by angle)
    if (showShip) {
      ctx.rotate(this.angle);

      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(this.radius * 1.2, 0); // nose
      ctx.lineTo(-this.radius * 0.8, -this.radius * 0.7); // back-left
      ctx.lineTo(-this.radius * 0.45, 0); // rear indent
      ctx.lineTo(-this.radius * 0.8, this.radius * 0.7); // back-right
      ctx.closePath();
      ctx.stroke();

      // 3. Draw engine flame if thrusting
      if (this.isThrusting) {
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.45, -this.radius * 0.3);
        ctx.lineTo(-this.radius * 1.3 - Math.random() * this.radius * 0.5, 0); // flickering tip
        ctx.lineTo(-this.radius * 0.45, this.radius * 0.3);
        ctx.closePath();

        ctx.fillStyle = "#ff8a3d"; // Neon orange
        ctx.shadowColor = "#ff8a3d";
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.strokeStyle = "#ffd23f"; // Yellow edge
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
