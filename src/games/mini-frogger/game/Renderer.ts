import { GRID_SIZE, VIEW_WIDTH, VIEW_HEIGHT, type LaneData } from "./constants";
import { Frog } from "./Frog";
import { Obstacle } from "./Obstacle";

export class Renderer {
  private waveOffset = 0;

  public draw(
    ctx: CanvasRenderingContext2D,
    frog: Frog,
    lanes: Map<number, LaneData>,
    cameraY: number,
    dt: number
  ): void {
    // Clear canvas
    ctx.fillStyle = "#0c0e12";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Update wave animations
    this.waveOffset += dt * 30;

    // Save context and apply camera scroll translation
    ctx.save();
    ctx.translate(0, -cameraY);

    // Determine range of visible rows
    // Grid coordinate bounds in visible screen
    const topRow = Math.floor(cameraY / GRID_SIZE) - 1;
    const bottomRow = Math.ceil((cameraY + VIEW_HEIGHT) / GRID_SIZE) + 1;

    // 1. Draw Visible Lane Backgrounds
    for (let r = topRow; r <= bottomRow; r++) {
      const lane = lanes.get(r);
      if (lane) {
        this.drawLaneBackground(ctx, r, lane.type);
      }
    }

    // 2. Draw Visible Lane Obstacles
    for (let r = topRow; r <= bottomRow; r++) {
      const lane = lanes.get(r);
      if (lane) {
        this.drawObstacles(ctx, lane.obstacles);
      }
    }

    // 3. Draw Frog
    this.drawFrog(ctx, frog);

    // Restore context
    ctx.restore();
  }

  /**
   * Small deterministic PRNG so per-row decorations (flowers, pebbles, foam)
   * stay fixed for a given row instead of flickering every frame.
   */
  private rowRandom(row: number, salt: number): () => number {
    let s = (Math.imul(row, 2654435761) ^ Math.imul(salt, 40503)) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private drawLaneBackground(
    ctx: CanvasRenderingContext2D,
    row: number,
    type: "grass" | "road" | "river"
  ): void {
    const y = row * GRID_SIZE;

    if (type === "grass") {
      this.drawGrass(ctx, row, y);
    } else if (type === "road") {
      this.drawRoad(ctx, row, y);
    } else if (type === "river") {
      this.drawRiver(ctx, row, y);
    }
  }

  private drawGrass(ctx: CanvasRenderingContext2D, row: number, y: number): void {
    // Two-tone turf: darker base with a slightly lighter horizontal band so
    // rows read as distinct strips of grass.
    const grad = ctx.createLinearGradient(0, y, 0, y + GRID_SIZE);
    grad.addColorStop(0, "#132018");
    grad.addColorStop(0.5, "#0f1a13");
    grad.addColorStop(1, "#0d160f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, VIEW_WIDTH, GRID_SIZE);

    // Neon edge line
    ctx.strokeStyle = "rgba(57, 255, 20, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW_WIDTH, y + 0.5);
    ctx.stroke();

    // Scattered decorations (stable per row): tufts, pebbles, glowing flowers.
    const rand = this.rowRandom(row, 1);
    const count = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const cx = rand() * VIEW_WIDTH;
      const cy = y + 8 + rand() * (GRID_SIZE - 16);
      const kind = rand();

      if (kind < 0.45) {
        // Grass tuft
        ctx.strokeStyle = "rgba(57, 255, 20, 0.22)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 4);
        ctx.lineTo(cx - 3, cy - 4);
        ctx.moveTo(cx, cy + 4);
        ctx.lineTo(cx, cy - 5);
        ctx.moveTo(cx, cy + 4);
        ctx.lineTo(cx + 3, cy - 4);
        ctx.stroke();
      } else if (kind < 0.75) {
        // Pebble
        ctx.fillStyle = "rgba(120, 140, 130, 0.25)";
        ctx.beginPath();
        ctx.arc(cx, cy, 2 + rand() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Glowing flower
        const petal = rand() < 0.5 ? "#00f0ff" : "#ff00ff";
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = petal;
        ctx.fillStyle = petal;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawRoad(ctx: CanvasRenderingContext2D, row: number, y: number): void {
    // Asphalt with a subtle top-lit gradient.
    const grad = ctx.createLinearGradient(0, y, 0, y + GRID_SIZE);
    grad.addColorStop(0, "#181b22");
    grad.addColorStop(0.5, "#12151b");
    grad.addColorStop(1, "#0f1218");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, VIEW_WIDTH, GRID_SIZE);

    // Dashed centre line
    ctx.strokeStyle = "rgba(255, 214, 0, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 14]);
    // Offset dashes per row so adjacent lanes don't line up.
    ctx.lineDashOffset = (row * 12) % 30;
    ctx.beginPath();
    ctx.moveTo(0, y + GRID_SIZE / 2);
    ctx.lineTo(VIEW_WIDTH, y + GRID_SIZE / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Faint lane separators
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW_WIDTH, y + 0.5);
    ctx.moveTo(0, y + GRID_SIZE - 0.5);
    ctx.lineTo(VIEW_WIDTH, y + GRID_SIZE - 0.5);
    ctx.stroke();
  }

  private drawRiver(ctx: CanvasRenderingContext2D, row: number, y: number): void {
    // Deep water gradient
    const grad = ctx.createLinearGradient(0, y, 0, y + GRID_SIZE);
    grad.addColorStop(0, "#071022");
    grad.addColorStop(0.5, "#0a1730");
    grad.addColorStop(1, "#071022");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, VIEW_WIDTH, GRID_SIZE);

    // Two layered animated ripples for a sense of flow.
    const centerY = y + GRID_SIZE / 2;
    ctx.lineWidth = 1.5;

    ctx.strokeStyle = "rgba(0, 240, 255, 0.09)";
    ctx.beginPath();
    for (let x = 0; x <= VIEW_WIDTH; x += 8) {
      const waveY = centerY - 6 + Math.sin((x + this.waveOffset + row * 100) * 0.045) * 3;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 180, 255, 0.06)";
    ctx.beginPath();
    for (let x = 0; x <= VIEW_WIDTH; x += 8) {
      const waveY = centerY + 7 + Math.cos((x - this.waveOffset * 0.7 + row * 60) * 0.05) * 3;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  private drawObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[]): void {
    obstacles.forEach((obs) => {
      ctx.save();

      if (obs.type === "car") {
        this.drawCar(ctx, obs);
      } else if (obs.type === "log") {
        this.drawLog(ctx, obs);
      } else if (obs.type === "turtle") {
        this.drawTurtle(ctx, obs);
      }

      ctx.restore();
    });
  }

  private drawCar(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    const bx = obs.x + 2;
    const by = obs.y + 4;
    const bw = obs.width - 4;
    const bh = obs.height - 8;

    // Body
    ctx.shadowBlur = 10;
    ctx.shadowColor = obs.color;
    ctx.fillStyle = obs.color;
    this.fillRoundedRect(ctx, bx, by, bw, bh, 7);

    ctx.shadowBlur = 0;

    // Cabin / windshield tint on top of the body
    ctx.fillStyle = "rgba(10, 14, 20, 0.55)";
    const cabinInset = Math.min(14, bw * 0.28);
    this.fillRoundedRect(ctx, bx + cabinInset, by + 4, bw - cabinInset * 2, bh - 8, 4);

    // Glossy highlight strip
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    this.fillRoundedRect(ctx, bx + 4, by + 3, bw - 8, 3, 2);

    // Wheels peeking below the body
    ctx.fillStyle = "#05070a";
    const wheelR = 3;
    const wheelY = by + bh - 1;
    ctx.beginPath();
    ctx.arc(bx + 9, wheelY, wheelR, 0, Math.PI * 2);
    ctx.arc(bx + bw - 9, wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();

    // Headlights on the leading edge
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 6;
    const lx = obs.dir === 1 ? bx + bw - 3 : bx + 3;
    ctx.beginPath();
    ctx.arc(lx, by + 5, 2.2, 0, Math.PI * 2);
    ctx.arc(lx, by + bh - 5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLog(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    const bx = obs.x + 1;
    const by = obs.y + 4;
    const bw = obs.width - 2;
    const bh = obs.height - 8;

    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0,0,0,0.5)";

    // Bark gradient body
    const grad = ctx.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, "#9a642f");
    grad.addColorStop(0.5, "#7b4f23");
    grad.addColorStop(1, "#5c3a19");
    ctx.fillStyle = grad;
    this.fillRoundedRect(ctx, bx, by, bw, bh, 5);

    ctx.shadowBlur = 0;

    // End-grain rings at both ends
    ctx.strokeStyle = "rgba(255, 154, 0, 0.5)";
    ctx.lineWidth = 1.5;
    for (const ex of [bx + 6, bx + bw - 6]) {
      ctx.beginPath();
      ctx.arc(ex, by + bh / 2, bh / 2 - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, by + bh / 2, Math.max(1.5, bh / 2 - 7), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Grain line down the middle
    ctx.strokeStyle = "rgba(60, 35, 15, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 12, by + bh / 2);
    ctx.lineTo(bx + bw - 12, by + bh / 2);
    ctx.stroke();

    // Top highlight
    ctx.strokeStyle = "rgba(255, 200, 120, 0.25)";
    ctx.beginPath();
    ctx.moveTo(bx + 12, by + 4);
    ctx.lineTo(bx + bw - 12, by + 4);
    ctx.stroke();
  }

  private drawTurtle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    const turtleCount = Math.max(1, Math.floor(obs.width / 30));
    const radius = 12;
    const spacing = obs.width / turtleCount;

    for (let i = 0; i < turtleCount; i++) {
      const cx = obs.x + i * spacing + spacing / 2;
      const cy = obs.y + obs.height / 2 + 2;

      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#32cd32";

      // Little head poking out in the direction of travel
      ctx.fillStyle = "#1b6336";
      ctx.beginPath();
      ctx.arc(cx + obs.dir * (radius - 1), cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Shell
      const grad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, radius);
      grad.addColorStop(0, "#2f8f4c");
      grad.addColorStop(1, "#155229");
      ctx.fillStyle = grad;
      ctx.strokeStyle = "#32cd32";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Shell segments
      ctx.strokeStyle = "rgba(50, 205, 50, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
      ctx.stroke();
      for (let a = 0; a < 6; a++) {
        const ang = (a * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * (radius - 4), cy + Math.sin(ang) * (radius - 4));
        ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawFrog(ctx: CanvasRenderingContext2D, frog: Frog): void {
    if (frog.isDead) {
      const deathProgress = frog.deathTime / frog.maxDeathTime;
      ctx.save();
      ctx.strokeStyle = "rgba(57, 255, 20, " + (1 - deathProgress) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(frog.x + GRID_SIZE / 2, frog.y + GRID_SIZE / 2, GRID_SIZE * deathProgress * 0.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      const numLines = 8;
      const center = { x: frog.x + GRID_SIZE / 2, y: frog.y + GRID_SIZE / 2 };
      const startDist = GRID_SIZE * deathProgress * 0.3;
      const endDist = GRID_SIZE * deathProgress * 0.8;
      for (let i = 0; i < numLines; i++) {
        const angle = (i * Math.PI * 2) / numLines;
        ctx.moveTo(center.x + Math.cos(angle) * startDist, center.y + Math.sin(angle) * startDist);
        ctx.lineTo(center.x + Math.cos(angle) * endDist, center.y + Math.sin(angle) * endDist);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    const hopScale = frog.isJumping ? 1.25 - Math.abs(frog.jumpProgress - 0.5) * 0.5 : 1.0;
    const verticalOffset = frog.isJumping ? Math.sin(frog.jumpProgress * Math.PI) * 10 : 0;

    const cx = frog.x + GRID_SIZE / 2;
    const cy = frog.y + GRID_SIZE / 2;

    // Ground shadow: stays on the tile and shrinks as the frog hops up.
    const shadowScale = frog.isJumping ? 1 - Math.sin(frog.jumpProgress * Math.PI) * 0.4 : 1;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 9 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy - verticalOffset);
    let rotation = 0;
    switch (frog.facing) {
      case "right": rotation = Math.PI / 2; break;
      case "down": rotation = Math.PI; break;
      case "left": rotation = -Math.PI / 2; break;
      case "up": rotation = 0; break;
    }
    ctx.rotate(rotation);
    ctx.scale(hopScale, hopScale);

    ctx.shadowBlur = 12;
    ctx.shadowColor = "#39ff14";

    // Back legs (drawn under the body)
    ctx.fillStyle = "#2ad010";
    ctx.beginPath();
    ctx.ellipse(-9, 6, 4, 5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(9, 6, 4, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Main body
    ctx.fillStyle = "#39ff14";
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(180, 255, 140, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front feet
    ctx.fillStyle = "#2ad010";
    ctx.beginPath();
    ctx.arc(-7, -6, 3, 0, Math.PI * 2);
    ctx.arc(7, -6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-5, -7, 3, 0, Math.PI * 2);
    ctx.arc(5, -7, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(-5, -8, 1.3, 0, Math.PI * 2);
    ctx.arc(5, -8, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }
}
