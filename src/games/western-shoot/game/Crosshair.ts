import { VIEW_WIDTH, VIEW_HEIGHT, SHOOT_FLASH_DURATION } from "./constants";

export class Crosshair {
  /** Mouse position in canvas coordinates. */
  x = VIEW_WIDTH / 2;
  y = VIEW_HEIGHT / 2;

  /** Flash effect timer when shooting. */
  private flashTimer = 0;

  private canvas: HTMLCanvasElement;
  private scaleX = 1;
  private scaleY = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.updateScale();

    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    window.addEventListener("resize", this.updateScale);
  }

  private updateScale = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.scaleX = VIEW_WIDTH / rect.width;
    this.scaleY = VIEW_HEIGHT / rect.height;
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.x = (e.clientX - rect.left) * this.scaleX;
    this.y = (e.clientY - rect.top) * this.scaleY;
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const rect = this.canvas.getBoundingClientRect();
    this.x = (touch.clientX - rect.left) * this.scaleX;
    this.y = (touch.clientY - rect.top) * this.scaleY;
  };

  /** Trigger the shoot flash animation. */
  shoot(): void {
    this.flashTimer = SHOOT_FLASH_DURATION;
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer < 0) this.flashTimer = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;

    ctx.save();

    // ── Shoot flash ─────────────────────────────────────────────────
    if (this.flashTimer > 0) {
      const alpha = (this.flashTimer / SHOOT_FLASH_DURATION) * 0.5;
      const flashGrad = ctx.createRadialGradient(x, y, 0, x, y, 40);
      flashGrad.addColorStop(0, `rgba(255,200,50,${alpha})`);
      flashGrad.addColorStop(0.5, `rgba(255,140,20,${alpha * 0.5})`);
      flashGrad.addColorStop(1, "rgba(255,100,0,0)");
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Outer ring ──────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Crosshair lines ─────────────────────────────────────────────
    const lineLen = 8;
    const gap = 18;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;

    // Top
    ctx.beginPath();
    ctx.moveTo(x, y - gap);
    ctx.lineTo(x, y - gap - lineLen);
    ctx.stroke();
    // Bottom
    ctx.beginPath();
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + lineLen);
    ctx.stroke();
    // Left
    ctx.beginPath();
    ctx.moveTo(x - gap, y);
    ctx.lineTo(x - gap - lineLen, y);
    ctx.stroke();
    // Right
    ctx.beginPath();
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + lineLen, y);
    ctx.stroke();

    // ── Center dot ──────────────────────────────────────────────────
    ctx.fillStyle = "#e74c3c";
    ctx.shadowColor = "rgba(231,76,60,0.8)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  destroy(): void {
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("resize", this.updateScale);
  }
}
