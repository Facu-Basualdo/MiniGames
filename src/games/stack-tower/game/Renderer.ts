import { BLOCK_HEIGHT, BLOCK_RADIUS, VIEW_HEIGHT, VIEW_WIDTH } from "./constants";
import type { Block, Tower } from "./Tower";

/** All canvas drawing for Torre Infinita, working in the fixed view-unit space. */
export class Renderer {
  draw(ctx: CanvasRenderingContext2D, tower: Tower): void {
    this.drawBackground(ctx);

    const offset = tower.cameraOffset;

    for (const block of tower.blocks) this.drawBlock(ctx, block, offset);
    if (tower.moving) this.drawBlock(ctx, tower.moving, offset);

    for (const s of tower.slivers) {
      ctx.save();
      const cx = s.x + s.width / 2;
      const cy = s.y + offset + BLOCK_HEIGHT / 2;
      ctx.translate(cx, cy);
      ctx.rotate(s.rot);
      this.fillBlock(ctx, -s.width / 2, -BLOCK_HEIGHT / 2, s.width, s.hue);
      ctx.restore();
    }

    for (const f of tower.flashes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life / 0.35) * 0.8;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      const y = f.y + offset;
      ctx.strokeRect(f.x, y, f.width, BLOCK_HEIGHT);
      ctx.restore();
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    g.addColorStop(0, "#0d1120");
    g.addColorStop(1, "#1c2647");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, block: Block, offset: number): void {
    this.fillBlock(ctx, block.x, block.y + offset, block.width, block.hue);
  }

  /** A rounded block with a lighter top face and darker base for a little depth. */
  private fillBlock(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, hue: number): void {
    const h = BLOCK_HEIGHT;
    const r = Math.min(BLOCK_RADIUS, width / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + h, r);
    ctx.arcTo(x + width, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `hsl(${hue}, 70%, 62%)`);
    g.addColorStop(1, `hsl(${hue}, 68%, 46%)`);
    ctx.fillStyle = g;
    ctx.fill();

    // Top highlight edge.
    ctx.fillStyle = `hsla(${hue}, 80%, 78%, 0.55)`;
    ctx.fillRect(x + r, y, width - r * 2, 3);
  }
}
