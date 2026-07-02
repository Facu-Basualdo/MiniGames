import { VIEW_WIDTH, VIEW_HEIGHT } from "./constants";

/** Draws the static western desert background scene onto the canvas. */
export class Background {
  /** Cached background image to avoid redrawing every frame. */
  private cache: HTMLCanvasElement | null = null;

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.cache) this.cache = this.render();
    ctx.drawImage(this.cache, 0, 0);
  }

  private render(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = VIEW_WIDTH;
    c.height = VIEW_HEIGHT;
    const ctx = c.getContext("2d")!;

    // ── Sky gradient (sunset) ───────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT * 0.55);
    sky.addColorStop(0, "#1a0a2e");
    sky.addColorStop(0.3, "#3d1c56");
    sky.addColorStop(0.55, "#c94e28");
    sky.addColorStop(0.78, "#e8943a");
    sky.addColorStop(1, "#f5c96a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // ── Sun ─────────────────────────────────────────────────────────
    const sunX = VIEW_WIDTH * 0.72;
    const sunY = VIEW_HEIGHT * 0.28;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70);
    sunGrad.addColorStop(0, "rgba(255,230,160,0.95)");
    sunGrad.addColorStop(0.3, "rgba(255,200,100,0.6)");
    sunGrad.addColorStop(0.7, "rgba(255,160,60,0.15)");
    sunGrad.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - 70, sunY - 70, 140, 140);

    // ── Distant mountains ───────────────────────────────────────────
    ctx.fillStyle = "#5a2d0c";
    ctx.beginPath();
    ctx.moveTo(0, VIEW_HEIGHT * 0.48);
    ctx.lineTo(80, VIEW_HEIGHT * 0.35);
    ctx.lineTo(170, VIEW_HEIGHT * 0.42);
    ctx.lineTo(260, VIEW_HEIGHT * 0.30);
    ctx.lineTo(350, VIEW_HEIGHT * 0.40);
    ctx.lineTo(430, VIEW_HEIGHT * 0.32);
    ctx.lineTo(540, VIEW_HEIGHT * 0.38);
    ctx.lineTo(620, VIEW_HEIGHT * 0.28);
    ctx.lineTo(720, VIEW_HEIGHT * 0.36);
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT * 0.42);
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT * 0.55);
    ctx.lineTo(0, VIEW_HEIGHT * 0.55);
    ctx.closePath();
    ctx.fill();

    // ── Nearer hills ────────────────────────────────────────────────
    ctx.fillStyle = "#7a3b10";
    ctx.beginPath();
    ctx.moveTo(0, VIEW_HEIGHT * 0.52);
    ctx.lineTo(120, VIEW_HEIGHT * 0.44);
    ctx.lineTo(250, VIEW_HEIGHT * 0.50);
    ctx.lineTo(380, VIEW_HEIGHT * 0.43);
    ctx.lineTo(500, VIEW_HEIGHT * 0.49);
    ctx.lineTo(650, VIEW_HEIGHT * 0.45);
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT * 0.50);
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT * 0.58);
    ctx.lineTo(0, VIEW_HEIGHT * 0.58);
    ctx.closePath();
    ctx.fill();

    // ── Desert ground ───────────────────────────────────────────────
    const ground = ctx.createLinearGradient(0, VIEW_HEIGHT * 0.55, 0, VIEW_HEIGHT);
    ground.addColorStop(0, "#c4884a");
    ground.addColorStop(0.4, "#a8703a");
    ground.addColorStop(1, "#8b5e30");
    ctx.fillStyle = ground;
    ctx.fillRect(0, VIEW_HEIGHT * 0.55, VIEW_WIDTH, VIEW_HEIGHT * 0.45);

    // ── Cactus helpers ──────────────────────────────────────────────
    this.drawCactus(ctx, 90, VIEW_HEIGHT * 0.55, 0.7);
    this.drawCactus(ctx, 680, VIEW_HEIGHT * 0.54, 0.85);
    this.drawCactus(ctx, 400, VIEW_HEIGHT * 0.56, 0.55);

    // ── Wooden fence / shooting gallery counter ─────────────────────
    const fenceY = VIEW_HEIGHT * 0.78;
    // Main plank
    ctx.fillStyle = "#6b4226";
    ctx.fillRect(0, fenceY, VIEW_WIDTH, 12);
    // Plank texture lines
    ctx.strokeStyle = "#4a2e18";
    ctx.lineWidth = 1;
    for (let x = 0; x < VIEW_WIDTH; x += 55) {
      ctx.beginPath();
      ctx.moveTo(x, fenceY);
      ctx.lineTo(x, fenceY + 12);
      ctx.stroke();
    }
    // Support posts
    ctx.fillStyle = "#5a3720";
    const posts = [30, 200, 400, 600, 770];
    for (const px of posts) {
      ctx.fillRect(px - 5, fenceY, 10, VIEW_HEIGHT - fenceY);
      // Post cap
      ctx.fillStyle = "#7a4a2e";
      ctx.fillRect(px - 7, fenceY - 4, 14, 6);
      ctx.fillStyle = "#5a3720";
    }

    // ── Ground detail (small stones) ────────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    const rng = this.seededRandom(42);
    for (let i = 0; i < 30; i++) {
      const sx = rng() * VIEW_WIDTH;
      const sy = VIEW_HEIGHT * 0.82 + rng() * (VIEW_HEIGHT * 0.18);
      const sr = 1.5 + rng() * 3;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    return c;
  }

  private drawCactus(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number): void {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(scale, scale);

    // Main stem
    ctx.fillStyle = "#3a6e2e";
    ctx.beginPath();
    ctx.roundRect(-8, -70, 16, 70, 4);
    ctx.fill();

    // Left arm
    ctx.beginPath();
    ctx.roundRect(-24, -55, 16, 8, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-24, -55, 8, 28, 3);
    ctx.fill();

    // Right arm
    ctx.beginPath();
    ctx.roundRect(8, -42, 18, 8, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(18, -42, 8, 22, 3);
    ctx.fill();

    // Highlights
    ctx.fillStyle = "rgba(255,255,200,0.15)";
    ctx.fillRect(-4, -65, 4, 60);

    ctx.restore();
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }
}
