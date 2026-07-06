import { NET_DEPTH, RIM_END_RADIUS, RIM_RADIUS } from "./constants";

/**
 * A hoop is a rim opening at (x, y); the ball collides with its endpoints.
 * Moving hoops oscillate horizontally around baseX (amp = 0 means static).
 */
export interface Hoop {
  x: number;
  y: number;
  baseX: number;
  amp: number; // px of horizontal oscillation (0 = static)
  speed: number; // rad/s of the oscillation
  phase: number; // rad offset so hoops don't move in sync
}

export function leftRimX(hoop: Hoop): number {
  return hoop.x - RIM_RADIUS;
}

export function rightRimX(hoop: Hoop): number {
  return hoop.x + RIM_RADIUS;
}

const NET_COLOR = "rgba(235, 240, 255, 0.5)";
const NET_COLOR_DIM = "rgba(235, 240, 255, 0.28)";

/**
 * Net and back half of the rim ellipse, drawn *under* the ball so a captured
 * ball appears to sit inside the hoop.
 */
export function drawHoopBack(ctx: CanvasRenderingContext2D, hoop: Hoop): void {
  ctx.save();

  // Net: two families of slanted strands forming diamonds, plus bottom ring.
  const topHalf = RIM_RADIUS - 5;
  const botHalf = RIM_RADIUS * 0.5;
  const segments = 6;
  ctx.lineWidth = 1.4;
  for (const dir of [1, -1] as const) {
    ctx.strokeStyle = dir === 1 ? NET_COLOR : NET_COLOR_DIM;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const t2 = Math.max(0, Math.min(1, t + dir * (1.6 / segments)));
      ctx.beginPath();
      ctx.moveTo(hoop.x - topHalf + t * topHalf * 2, hoop.y + 3);
      ctx.quadraticCurveTo(
        hoop.x - topHalf * 0.8 + ((t + t2) / 2) * topHalf * 1.6,
        hoop.y + NET_DEPTH * 0.55,
        hoop.x - botHalf + t2 * botHalf * 2,
        hoop.y + NET_DEPTH,
      );
      ctx.stroke();
    }
  }
  ctx.strokeStyle = NET_COLOR;
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y + NET_DEPTH, botHalf, 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Back (upper) half of the rim ellipse, darker so it reads as "behind".
  ctx.strokeStyle = "#a83418";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y, RIM_RADIUS, 10, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/** Front (lower) half of the rim, drawn *over* the ball. */
export function drawHoopFront(ctx: CanvasRenderingContext2D, hoop: Hoop): void {
  ctx.save();

  // Moving hoops get a soft glow so the hazard reads at a glance.
  if (hoop.amp > 0) {
    ctx.shadowColor = "rgba(255, 122, 69, 0.85)";
    ctx.shadowBlur = 14;
  }

  // Front half of the rim with a metallic vertical gradient.
  const rim = ctx.createLinearGradient(0, hoop.y - 8, 0, hoop.y + 12);
  rim.addColorStop(0, "#ff8a5c");
  rim.addColorStop(0.5, "#ff5a36");
  rim.addColorStop(1, "#d13c1c");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 6.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y, RIM_RADIUS, 10, 0, 0, Math.PI);
  ctx.stroke();

  // Thin specular highlight along the top edge of the front rim.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 220, 190, 0.5)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y - 1.5, RIM_RADIUS - 2, 8, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // Rim endpoints (the actual collision circles) as shaded knobs.
  for (const rx of [leftRimX(hoop), rightRimX(hoop)]) {
    const knob = ctx.createRadialGradient(rx - 2, hoop.y - 2, 1, rx, hoop.y, RIM_END_RADIUS);
    knob.addColorStop(0, "#ffb08a");
    knob.addColorStop(1, "#c23a1e");
    ctx.fillStyle = knob;
    ctx.beginPath();
    ctx.arc(rx, hoop.y, RIM_END_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
