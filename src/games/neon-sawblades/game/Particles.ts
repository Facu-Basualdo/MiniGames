import { glowDot, GLOW_DOT_RADIUS } from "./sprites";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/** Light downward pull on sparks so bursts arc and fall. */
const PARTICLE_GRAVITY = 900;

/** A tiny fire-and-forget particle pool for burst effects (destroy / collect). */
export class Particles {
  private readonly items: Particle[] = [];

  clear(): void {
    this.items.length = 0;
  }

  /** Emits a radial spray of `count` sparks from (x, y). */
  burst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      const life = 0.35 + Math.random() * 0.35;
      this.items.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.3,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.items) {
      const a = Math.max(0, p.life / p.maxLife);
      // Pre-baked glow sprite scaled to the spark's current size: one cheap
      // drawImage per spark instead of a shadowBlur'd arc (the burst of those
      // is what made integrated GPUs hitch).
      const dot = glowDot(p.color);
      const d = ((p.size * a) / GLOW_DOT_RADIUS) * dot.w;
      if (d < 1) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(dot.canvas, p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.restore();
  }
}
