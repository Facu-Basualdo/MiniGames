import {
  FIGURE_COLORS,
  FIGURE_KEY_LABELS,
  FIGURES,
  HIT_LINE_Y,
  LANE_COUNT,
  LANE_WIDTH,
  NOTE_HALF_HEIGHT,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import type { Note } from "./NoteField";

const NOTE_INSET = 8;
const NOTE_WIDTH = LANE_WIDTH - NOTE_INSET * 2;
/** Radius of a falling piece's figure (view units). */
const FIGURE_RADIUS = 30;
/** Y of the figure -> key legend row, below the hit line. */
const LEGEND_Y = VIEW_HEIGHT - 56;

/** All canvas drawing for Beat Fever, in view units. */
export class Renderer {
  draw(ctx: CanvasRenderingContext2D, notes: Note[], laneFlash: number[]): void {
    this.drawLanes(ctx, laneFlash);
    this.drawHitLine(ctx);
    for (const note of notes) this.drawNote(ctx, note);
    this.drawLegend(ctx);
  }

  private drawLanes(ctx: CanvasRenderingContext2D, laneFlash: number[]): void {
    // Deep vertical gradient backdrop.
    const bg = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    bg.addColorStop(0, "#131228");
    bg.addColorStop(1, "#1e1740");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const x = lane * LANE_WIDTH;
      // Alternate faint lane shading for readability.
      ctx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.10)";
      ctx.fillRect(x, 0, LANE_WIDTH, VIEW_HEIGHT);

      const flash = laneFlash[lane];
      if (flash > 0) {
        const grad = ctx.createLinearGradient(0, HIT_LINE_Y - 260, 0, HIT_LINE_Y);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, `rgba(255,255,255,${0.2 * flash})`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, HIT_LINE_Y - 260, LANE_WIDTH, 260);
      }
    }

    // Lane separators.
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const x = lane * LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_HEIGHT);
      ctx.stroke();
    }
  }

  private drawHitLine(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, HIT_LINE_Y);
    ctx.lineTo(VIEW_WIDTH, HIT_LINE_Y);
    ctx.stroke();
    ctx.restore();

    // Neutral per-lane landing rings on the hit line (lanes carry no figure).
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const cx = lane * LANE_WIDTH + LANE_WIDTH / 2;
      this.roundRect(ctx, cx - NOTE_WIDTH / 2, HIT_LINE_Y - NOTE_HALF_HEIGHT, NOTE_WIDTH, NOTE_HALF_HEIGHT * 2, 12);
      ctx.stroke();
    }
  }

  private drawNote(ctx: CanvasRenderingContext2D, note: Note): void {
    const cx = note.lane * LANE_WIDTH + LANE_WIDTH / 2;
    const color = FIGURE_COLORS[note.figure];

    ctx.save();
    if (note.done) {
      // Pop and fade out on hit/miss.
      const t = Math.min(note.fade / 0.25, 1);
      ctx.globalAlpha = 1 - t;
      const scale = 1 + t * 0.6;
      ctx.translate(cx, note.y);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -note.y);
    }

    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    this.drawFigure(ctx, note.figure, cx, note.y, FIGURE_RADIUS);
    ctx.fill();

    // Key label centered on the piece.
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.font = "700 24px Consolas, 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(FIGURE_KEY_LABELS[note.figure], cx, note.y + 1);
    ctx.restore();
  }

  /** Draws the four figures with their key labels below the hit line so the
   *  player can learn which key clears which shape. */
  private drawLegend(ctx: CanvasRenderingContext2D): void {
    const n = FIGURES.length;
    const step = VIEW_WIDTH / n;
    ctx.save();
    ctx.font = "700 13px Consolas, 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const cx = step * (i + 0.5);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = FIGURE_COLORS[i];
      this.drawFigure(ctx, i, cx - 12, LEGEND_Y, 11);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(FIGURE_KEY_LABELS[i], cx + 12, LEGEND_Y + 1);
    }
    ctx.restore();
  }

  /** Traces the path for figure index `i` centered at (cx, cy) with radius `r`.
   *  Leaves the path ready for `fill()`/`stroke()`. */
  private drawFigure(ctx: CanvasRenderingContext2D, i: number, cx: number, cy: number, r: number): void {
    const shape = FIGURES[i];
    ctx.beginPath();
    switch (shape) {
      case "circle":
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case "triangle": {
        const h = r * 1.05;
        ctx.moveTo(cx, cy - h);
        ctx.lineTo(cx + r, cy + h * 0.7);
        ctx.lineTo(cx - r, cy + h * 0.7);
        ctx.closePath();
        break;
      }
      case "diamond":
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        break;
      case "square": {
        const s = r * 0.9;
        this.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, 6);
        break;
      }
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
