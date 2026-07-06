import {
  BASE_X,
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  GROUND_HEIGHT,
  GROUND_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import type { Tower } from "./Tower";
import { PENDULUM_LENGTH } from "./Crane";

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

export interface BlockView {
  x: number;
  topY: number;
}

/** A short-lived burst drawn where a floor snapped perfectly into place. */
interface PerfectBurst {
  x: number;
  y: number;
  t: number;
}

/** Draws the whole Skyline scene into the 2D canvas context (view units). */
export class Renderer {
  private readonly clouds: Cloud[] = [];
  private readonly bursts: PerfectBurst[] = [];
  private static readonly BURST_DUR = 0.5;

  constructor() {
    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        x: Math.random() * VIEW_WIDTH,
        y: 30 + Math.random() * (VIEW_HEIGHT * 0.35),
        scale: 0.6 + Math.random() * 0.7,
        speed: 5 + Math.random() * 8,
      });
    }
  }

  update(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x < -80 * cloud.scale) {
        cloud.x = VIEW_WIDTH + 80 * cloud.scale;
        cloud.y = 30 + Math.random() * (VIEW_HEIGHT * 0.35);
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].t += dt;
      if (this.bursts[i].t > Renderer.BURST_DUR) this.bursts.splice(i, 1);
    }
  }

  /** Spawns a perfect-placement burst at a floor's top-center seam (world). */
  spawnPerfect(x: number, topY: number): void {
    this.bursts.push({ x, y: topY, t: 0 });
  }

  /**
   * @param craneX  world X of the trolley/hook.
   * @param craneY  world Y of the trolley/hook.
   * @param block   the block currently in play (hooked or falling), or null.
   * @param hooked  true while the block still hangs from the cable.
   * @param hangTopY resting top-Y of the block on the hook (jib height ref).
   * @param camY    vertical world→screen translation (camera pan).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    tower: Tower,
    craneX: number,
    craneY: number,
    block: BlockView | null,
    hangTopY: number,
    camY: number,
  ): void {
    this.drawSky(ctx);
    for (const cloud of this.clouds) this.drawCloud(ctx, cloud);

    ctx.save();
    ctx.translate(0, camY);

    this.drawGround(ctx);
    this.drawFoundation(ctx, tower.floors.length > 0 ? tower.floors[0].x : null);

    // The tower tilts as a rigid body about the base's bottom-center.
    const basePivotX = tower.floors.length > 0 ? tower.floors[0].x : BASE_X;
    ctx.save();
    ctx.translate(basePivotX, GROUND_TOP);
    ctx.rotate(tower.renderAngle());
    ctx.translate(-basePivotX, -GROUND_TOP);
    tower.floors.forEach((f, i) => this.drawFloor(ctx, f.x, f.topY, i));
    ctx.restore();

    this.drawCrane(ctx, craneX, craneY, hangTopY);
    if (block) this.drawFloor(ctx, block.x, block.topY, tower.count);

    for (const burst of this.bursts) this.drawPerfect(ctx, burst);

    ctx.restore();
  }

  private drawPerfect(ctx: CanvasRenderingContext2D, burst: PerfectBurst): void {
    const k = burst.t / Renderer.BURST_DUR; // 0 -> 1 over the burst's life
    const alpha = 1 - k;
    const { x: cx, y: cy } = burst;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Expanding ring at the seam.
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 14 + k * 44, 0, Math.PI * 2);
    ctx.stroke();
    // Sparkles flying outward.
    ctx.fillStyle = "#ffe9a8";
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 - Math.PI / 2;
      const dist = 10 + k * 42;
      const sx = cx + Math.cos(ang) * dist;
      const sy = cy + Math.sin(ang) * dist;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.5, 3 * (1 - k)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    g.addColorStop(0, "#3aa0d8");
    g.addColorStop(0.6, "#7fc9ea");
    g.addColorStop(1, "#bfe8f5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud): void {
    ctx.save();
    ctx.translate(cloud.x, cloud.y);
    ctx.scale(cloud.scale, cloud.scale);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.arc(26, 6, 18, 0, Math.PI * 2);
    ctx.arc(-24, 6, 16, 0, Math.PI * 2);
    ctx.arc(4, 14, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#7a9c53";
    ctx.fillRect(0, GROUND_TOP, VIEW_WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = "#8fb463";
    ctx.fillRect(0, GROUND_TOP, VIEW_WIDTH, 12);
    // Pavement seam.
    ctx.fillStyle = "#63813f";
    ctx.fillRect(0, GROUND_TOP + 12, VIEW_WIDTH, 3);
  }

  private drawFoundation(ctx: CanvasRenderingContext2D, firstFloorX: number | null): void {
    if (firstFloorX === null) return;
    const w = FLOOR_WIDTH + 18;
    const x = firstFloorX - w / 2;
    const h = 18;
    ctx.fillStyle = "#5a5f66";
    ctx.fillRect(x, GROUND_TOP - 2, w, h);
    ctx.fillStyle = "#6f757d";
    ctx.fillRect(x, GROUND_TOP - 2, w, 5);
  }

  private drawFloor(ctx: CanvasRenderingContext2D, cx: number, topY: number, index: number): void {
    const x = cx - FLOOR_WIDTH / 2;
    // Alternate two brick tones so stacked floors stay readable.
    const warm = index % 2 === 0;
    ctx.fillStyle = warm ? "#d9843f" : "#c9743a";
    ctx.fillRect(x, topY, FLOOR_WIDTH, FLOOR_HEIGHT);

    // Top edge highlight and base shadow give the block some depth.
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x, topY, FLOOR_WIDTH, 4);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, topY + FLOOR_HEIGHT - 4, FLOOR_WIDTH, 4);

    // A 4x4 grid of windows for the square block.
    const cols = 4;
    const rows = 4;
    const winW = 16;
    const winH = 16;
    const gap = 8;
    for (let r = 0; r < rows; r++) {
      const wy = topY + gap + r * (winH + gap);
      for (let c = 0; c < cols; c++) {
        const wx = x + gap + c * (winW + gap);
        // Deterministic "lit" pattern so it doesn't flicker each frame.
        const lit = (index * 13 + r * 7 + c * 3) % 5 !== 0;
        ctx.fillStyle = lit ? "#ffe9a8" : "#3c5566";
        ctx.fillRect(wx, wy, winW, winH);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(wx, wy, winW, winH);
      }
    }

    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, topY, FLOOR_WIDTH, FLOOR_HEIGHT);
  }

  private drawCrane(
    ctx: CanvasRenderingContext2D,
    craneX: number,
    craneY: number,
    hangTopY: number,
  ): void {
    const jibY = hangTopY - PENDULUM_LENGTH;
    // Jib (horizontal beam the trolley rolls along).
    ctx.fillStyle = "#e0b000";
    ctx.fillRect(0, jibY, VIEW_WIDTH, 8);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, jibY + 8, VIEW_WIDTH, 2);

    // Trolley riding the jib (fixed in the center).
    ctx.fillStyle = "#c99400";
    ctx.fillRect(VIEW_WIDTH / 2 - 12, jibY - 4, 24, 12);

    // Cable + hook swinging down.
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIEW_WIDTH / 2, jibY + 8);
    ctx.lineTo(craneX, craneY - 6);
    ctx.stroke();

    // Hook
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(craneX - 5, craneY - 8, 10, 6);
  }
}
