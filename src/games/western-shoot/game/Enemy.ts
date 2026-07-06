import {
  ENEMY_WIDTH,
  ENEMY_HEIGHT,
  ENEMY_SHOOT_TIME_BASE,
  ENEMY_SHOOT_TIME_MIN,
  ENEMY_POP_DURATION,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "./constants";

export type EnemyState = "popping" | "aiming" | "shooting" | "downed" | "done";

export class Enemy {
  x: number;
  y: number;
  readonly width = ENEMY_WIDTH;
  readonly height = ENEMY_HEIGHT;
  state: EnemyState = "popping";
  alive = true;

  /** How long the enemy stays visible before shooting the player. */
  private shootTime: number;
  /** Timer tracking current state progress. */
  private timer = 0;
  /** Progress of the pop-up animation (0 = hidden, 1 = fully up). */
  private popProgress = 0;
  /** Fall angle when downed. */
  private fallAngle = 0;

  private static readonly DOWNED_DURATION = 0.45;
  private static readonly SHOOT_FLASH_DURATION = 0.3;

  constructor(difficultyLevel: number) {
    // Position: random X, bottom area (pop-up from behind fence)
    const margin = 60;
    this.x = margin + Math.random() * (VIEW_WIDTH - margin * 2);
    this.y = VIEW_HEIGHT * 0.78; // fence line

    // Shoot time decreases with difficulty
    this.shootTime = Math.max(
      ENEMY_SHOOT_TIME_MIN,
      ENEMY_SHOOT_TIME_BASE - difficultyLevel * 0.2,
    );
  }

  /** Returns the danger progress (0 to 1) — used for the timer bar. */
  get dangerProgress(): number {
    if (this.state !== "aiming") return 0;
    return Math.min(1, this.timer / this.shootTime);
  }

  /** Returns true when the enemy fired and should damage the player. */
  get hasFired(): boolean {
    return this.state === "shooting";
  }

  update(dt: number): void {
    this.timer += dt;

    switch (this.state) {
      case "popping":
        this.popProgress = Math.min(1, this.timer / ENEMY_POP_DURATION);
        if (this.popProgress >= 1) {
          this.state = "aiming";
          this.timer = 0;
        }
        break;

      case "aiming":
        if (this.timer >= this.shootTime) {
          this.state = "shooting";
          this.timer = 0;
        }
        break;

      case "shooting":
        if (this.timer >= Enemy.SHOOT_FLASH_DURATION) {
          this.state = "done";
          this.alive = false;
        }
        break;

      case "downed":
        this.fallAngle = Math.min(Math.PI / 2, this.fallAngle + dt * 6);
        if (this.timer >= Enemy.DOWNED_DURATION) {
          this.state = "done";
          this.alive = false;
        }
        break;

      case "done":
        this.alive = false;
        break;
    }
  }

  hitTest(mx: number, my: number): boolean {
    if (this.state !== "aiming" && this.state !== "popping") return false;
    const hw = this.width / 2;
    const visibleH = this.height * this.popProgress;
    const top = this.y - visibleH;
    return mx >= this.x - hw && mx <= this.x + hw && my >= top && my <= this.y;
  }

  onDowned(): void {
    this.state = "downed";
    this.timer = 0;
    this.fallAngle = 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.state === "done") return;

    ctx.save();

    const visibleH = this.height * this.popProgress;
    const drawY = this.y;

    // Clip to only show the visible portion (pop-up effect)
    if (this.state === "popping" || this.state === "aiming" || this.state === "shooting") {
      ctx.beginPath();
      ctx.rect(this.x - this.width, drawY - visibleH - 10, this.width * 2, visibleH + 10);
      ctx.clip();
    }

    ctx.translate(this.x, drawY);

    if (this.state === "downed") {
      const alpha = 1 - this.timer / Enemy.DOWNED_DURATION;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.rotate(-this.fallAngle);
    }

    // ── Draw enemy figure ───────────────────────────────────────────
    // Body (dark red / brown — menacing)
    ctx.fillStyle = "#8b1a1a";
    ctx.beginPath();
    ctx.roundRect(-14, -this.height + 20, 28, 34, 4);
    ctx.fill();

    // Vest detail
    ctx.fillStyle = "#5a1010";
    ctx.fillRect(-10, -this.height + 24, 20, 8);

    // Legs
    ctx.fillStyle = "#3a2010";
    ctx.fillRect(-11, -this.height + 54, 9, 14);
    ctx.fillRect(2, -this.height + 54, 9, 14);

    // Boots
    ctx.fillStyle = "#2a1508";
    ctx.fillRect(-12, -this.height + 62, 10, 6);
    ctx.fillRect(2, -this.height + 62, 10, 6);

    // Head
    ctx.fillStyle = "#d4a574";
    ctx.beginPath();
    ctx.arc(0, -this.height + 12, 11, 0, Math.PI * 2);
    ctx.fill();

    // Cowboy hat (dark)
    ctx.fillStyle = "#2c1810";
    // Brim
    ctx.beginPath();
    ctx.ellipse(0, -this.height + 3, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crown
    ctx.beginPath();
    ctx.roundRect(-10, -this.height - 6, 20, 10, [4, 4, 0, 0]);
    ctx.fill();

    // Angry eyes
    ctx.fillStyle = "#1a0a00";
    ctx.beginPath();
    ctx.arc(-4, -this.height + 11, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -this.height + 11, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Angry eyebrows
    ctx.strokeStyle = "#1a0a00";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -this.height + 7);
    ctx.lineTo(-2, -this.height + 9);
    ctx.moveTo(7, -this.height + 7);
    ctx.lineTo(2, -this.height + 9);
    ctx.stroke();

    // Bandana / scarf
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.moveTo(-8, -this.height + 18);
    ctx.lineTo(8, -this.height + 18);
    ctx.lineTo(0, -this.height + 26);
    ctx.closePath();
    ctx.fill();

    // Gun arm (pointing at player)
    if (this.state === "aiming" || this.state === "shooting") {
      ctx.fillStyle = "#8b1a1a";
      // Arm
      ctx.fillRect(14, -this.height + 28, 14, 6);
      // Gun
      ctx.fillStyle = "#333";
      ctx.fillRect(24, -this.height + 26, 10, 4);
      ctx.fillRect(26, -this.height + 26, 3, 8);

      // Muzzle flash when shooting
      if (this.state === "shooting" && this.timer < 0.1) {
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(36, -this.height + 28, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff6600";
        ctx.beginPath();
        ctx.arc(36, -this.height + 28, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // ── Danger timer bar (above the enemy, outside clip) ────────────
    if (this.state === "aiming") {
      const barW = 36;
      const barH = 4;
      const barX = this.x - barW / 2;
      const barY = this.y - visibleH - 14;
      const progress = this.dangerProgress;

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      // Color transitions from yellow to red
      const r = Math.floor(255);
      const g = Math.floor(255 * (1 - progress));
      ctx.fillStyle = `rgb(${r},${g},0)`;
      ctx.fillRect(barX, barY, barW * progress, barH);
    }

    // ── Skull icon above for warning ────────────────────────────────
    if (this.state === "aiming" || this.state === "popping") {
      ctx.fillStyle = "rgba(200,40,40,0.85)";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠", this.x, this.y - visibleH - 18);
    }
  }
}
