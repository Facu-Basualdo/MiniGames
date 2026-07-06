import {
  COIN_RADIUS,
  FLOOR_HEIGHT,
  FLOOR_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SAW_RADIUS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import type { Player } from "./Player";
import type { SawbladeField } from "./SawbladeField";
import type { Particles } from "./Particles";

const BG_TOP = "#0a0b1e";
const BG_BOTTOM = "#141033";
const CYAN = "#22e0ff";
const MAGENTA = "#ff2d78";
const GOLD = "#ffd23f";

interface Star {
  x: number;
  y: number;
  r: number;
  /** Parallax depth 0..1 (nearer = faster twinkle / brighter). */
  z: number;
}

interface TrailNode {
  x: number;
  y: number;
}

/** All canvas drawing for Neon Sawblades, in view units. */
export class Renderer {
  private time = 0;
  private readonly stars: Star[] = [];
  private readonly trail: TrailNode[] = [];
  /** The city skyline, rendered once to an offscreen canvas and blitted dim. */
  private readonly cityCanvas: HTMLCanvasElement;

  constructor() {
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * VIEW_WIDTH,
        y: Math.random() * FLOOR_Y,
        r: 0.6 + Math.random() * 1.6,
        z: Math.random(),
      });
    }
    this.cityCanvas = document.createElement("canvas");
    this.cityCanvas.width = VIEW_WIDTH;
    this.cityCanvas.height = FLOOR_Y;
    this.buildCity();
  }

  /** Draws the neon city once into `cityCanvas` (static, cached). Built as
   *  atmosphere, not scenery: a horizon "light pollution" glow that the dark
   *  building silhouettes cut into, plus a few soft signs — the same read as
   *  the neon ambience in Keepers! / Barra Libre, kept dim on purpose. */
  private buildCity(): void {
    const c = this.cityCanvas.getContext("2d");
    if (!c) return;
    const horizonY = FLOOR_Y - 30;

    // 1. Horizon glow — additive coloured blooms rising off the skyline.
    c.globalCompositeOperation = "lighter";
    const glows: [number, string, number][] = [
      [0.16, "#ff2d78", 230],
      [0.42, "#7b3cff", 300],
      [0.62, "#22a0ff", 250],
      [0.82, "#ff2d78", 220],
      [0.5, "#3a6bff", 340],
    ];
    for (const [fx, col, r] of glows) {
      const gx = VIEW_WIDTH * fx;
      const grad = c.createRadialGradient(gx, horizonY, 0, gx, horizonY, r);
      grad.addColorStop(0, hexA(col, 0.4));
      grad.addColorStop(1, hexA(col, 0));
      c.fillStyle = grad;
      c.fillRect(0, 0, VIEW_WIDTH, FLOOR_Y);
    }
    c.globalCompositeOperation = "source-over";

    // 2. Building silhouettes (near-black so they read against the glow),
    //    two depth layers, with sparse dim windows.
    const winColors = ["#22e0ff", "#ff6ba5", "#9b7bff", "#3a86ff"];
    const layers = [
      { count: 15, min: 130, max: 250, tint: "#080714", winAlpha: 0.22 }, // far
      { count: 11, min: 190, max: 350, tint: "#050410", winAlpha: 0.42 }, // near
    ];
    const signs: [number, number, string][] = [];
    for (const layer of layers) {
      const slot = VIEW_WIDTH / layer.count;
      for (let b = 0; b < layer.count; b++) {
        const bw = slot * (0.72 + Math.random() * 0.5);
        const x = b * slot + (slot - bw) / 2 + (Math.random() * slot * 0.3 - slot * 0.15);
        const h = layer.min + Math.random() * (layer.max - layer.min);
        const top = FLOOR_Y - h;

        c.fillStyle = layer.tint;
        c.fillRect(x, top, bw, h);

        const cols = Math.max(2, Math.floor(bw / 12));
        const rows = Math.max(3, Math.floor(h / 16));
        const padX = bw * 0.18;
        const cellW = (bw - padX * 2) / cols;
        const cellH = (h - 12 * 2) / rows;
        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < rows; row++) {
            if (Math.random() < 0.58) continue; // unlit window
            c.globalAlpha = layer.winAlpha * (0.4 + Math.random() * 0.6);
            c.fillStyle = winColors[(Math.random() * winColors.length) | 0];
            c.fillRect(
              x + padX + col * cellW + cellW * 0.2,
              top + 12 + row * cellH + cellH * 0.2,
              cellW * 0.6,
              cellH * 0.5,
            );
          }
        }
        c.globalAlpha = 1;
        // Occasionally earmark a rooftop for a glowing sign.
        if (Math.random() < 0.3) {
          signs.push([x + bw / 2, top + 6, winColors[(Math.random() * 2) | 0]]);
        }
      }
    }

    // 3. Soft neon signs — a bright core with an additive halo.
    c.globalCompositeOperation = "lighter";
    for (const [sx, sy, col] of signs) {
      const halo = c.createRadialGradient(sx, sy, 0, sx, sy, 26);
      halo.addColorStop(0, hexA(col, 0.5));
      halo.addColorStop(1, hexA(col, 0));
      c.fillStyle = halo;
      c.fillRect(sx - 26, sy - 26, 52, 52);
      c.fillStyle = hexA(col, 0.7);
      c.fillRect(sx - 5, sy - 3, 10, 4);
    }
    c.globalCompositeOperation = "source-over";

    // 4. Low haze band seating the city on the floor line.
    const haze = c.createLinearGradient(0, horizonY - 60, 0, FLOOR_Y);
    haze.addColorStop(0, "rgba(123,60,255,0)");
    haze.addColorStop(1, "rgba(123,60,255,0.16)");
    c.fillStyle = haze;
    c.fillRect(0, horizonY - 60, VIEW_WIDTH, FLOOR_Y - (horizonY - 60));
  }

  update(dt: number): void {
    this.time += dt;
  }

  /** Drops the motion trail (call when the player teleports on reset). */
  resetTrail(): void {
    this.trail.length = 0;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    field: SawbladeField,
    particles: Particles,
    timeRatio: number,
  ): void {
    this.drawBackground(ctx);
    this.drawFloor(ctx);
    this.updateTrail(player);
    this.drawTrail(ctx);
    for (const coin of field.coins) this.drawCoin(ctx, coin.x, coin.y, coin.life);
    for (const saw of field.saws) this.drawSaw(ctx, saw.x, saw.y, saw.spin);
    this.drawPlayer(ctx, player);
    particles.draw(ctx);
    this.drawTimeBar(ctx, timeRatio);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Twinkling parallax starfield.
    ctx.save();
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.time * (1 + s.z * 2) + s.x);
      ctx.globalAlpha = 0.15 + s.z * 0.5 * tw;
      ctx.fillStyle = s.z > 0.6 ? CYAN : "#8a7bff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // City skyline, kept dim so it stays a backdrop.
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(this.cityCanvas, 0, 0);
    ctx.restore();

    // Faint vertical neon columns for depth.
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    const cols = 8;
    for (let i = 1; i < cols; i++) {
      const x = (VIEW_WIDTH / cols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FLOOR_Y);
      ctx.stroke();
    }
    ctx.restore();

    // Subtle scanlines across the whole view.
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#000";
    for (let y = 0; y < VIEW_HEIGHT; y += 4) ctx.fillRect(0, y, VIEW_WIDTH, 2);
    ctx.restore();
  }

  private drawFloor(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Glowing floor line.
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(VIEW_WIDTH, FLOOR_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Perspective grid on the floor strip, scrolling toward the viewer.
    ctx.strokeStyle = "rgba(34, 224, 255, 0.18)";
    ctx.lineWidth = 1;
    const rows = 5;
    for (let i = 1; i <= rows; i++) {
      const y = FLOOR_Y + (FLOOR_HEIGHT / rows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_WIDTH, y);
      ctx.stroke();
    }
    const scroll = (this.time * 40) % 64;
    for (let x = -scroll; x < VIEW_WIDTH + 64; x += 64) {
      const skew = (x - VIEW_WIDTH / 2) * 0.28;
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y);
      ctx.lineTo(x + skew, VIEW_HEIGHT);
      ctx.stroke();
    }
    ctx.restore();
  }

  private updateTrail(player: Player): void {
    const x = player.x;
    const y = player.centerY;
    const last = this.trail[this.trail.length - 1];
    // Drop the trail on a teleport (run reset) so it doesn't streak.
    if (last && Math.abs(last.x - x) + Math.abs(last.y - y) > 220) this.trail.length = 0;
    this.trail.push({ x, y });
    if (this.trail.length > 14) this.trail.shift();
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < this.trail.length - 1; i++) {
      const t = i / this.trail.length;
      const node = this.trail[i];
      ctx.globalAlpha = t * 0.35;
      ctx.fillStyle = CYAN;
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(node.x, node.y, PLAYER_WIDTH * 0.4 * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSaw(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
    const teeth = 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.shadowColor = MAGENTA;
    ctx.shadowBlur = 18;

    // Toothed disc.
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      ctx.lineTo(Math.cos(a0) * SAW_RADIUS, Math.sin(a0) * SAW_RADIUS);
      ctx.lineTo(Math.cos(a1) * SAW_RADIUS * 0.72, Math.sin(a1) * SAW_RADIUS * 0.72);
    }
    ctx.closePath();
    ctx.fillStyle = "#2a0a1c";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = MAGENTA;
    ctx.stroke();

    // Hub.
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, SAW_RADIUS * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = MAGENTA;
    ctx.fill();
    ctx.restore();
  }

  private drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, life: number): void {
    // Blink out over the last stretch of the coin's life.
    if (life < 1.5 && Math.floor(life * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "#fff6cf";
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;
    const footH = 7;
    const bodyH = h - footH;
    const x = player.x - w / 2;
    const yTop = player.top;
    const bodyBottom = yTop + bodyH;

    ctx.save();

    // Little stubby feet under the body (they still rest on player.y = floor).
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#3ec4e0";
    const footW = 9;
    const footGap = 4;
    roundRect(ctx, player.x - footGap - footW, bodyBottom, footW, footH, 3);
    ctx.fill();
    roundRect(ctx, player.x + footGap, bodyBottom, footW, footH, 3);
    ctx.fill();

    // Body.
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 20;
    roundRect(ctx, x, yTop, w, bodyH, 10);
    const grad = ctx.createLinearGradient(x, yTop, x, bodyBottom);
    grad.addColorStop(0, "#8dfcff");
    grad.addColorStop(1, CYAN);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#d6ffff";
    ctx.stroke();

    // --- Face: just solid black eyes and angry brows, centred in the body ---
    const cx = player.x;
    const ink = "#0a111f";
    const eyeY = yTop + bodyH * 0.6;
    const eyeDX = 7;

    // Solid black eyes (no sclera, no glint).
    ctx.fillStyle = ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * eyeDX, eyeY, 3.6, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thick angry eyebrows, sloping down toward the centre, set a bit above
    // the eyes (separated from them).
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 11, eyeY - 11.5);
    ctx.lineTo(cx - 3, eyeY - 7.5);
    ctx.moveTo(cx + 11, eyeY - 11.5);
    ctx.lineTo(cx + 3, eyeY - 7.5);
    ctx.stroke();

    ctx.restore();
  }

  private drawTimeBar(ctx: CanvasRenderingContext2D, ratio: number): void {
    const w = VIEW_WIDTH * 0.7;
    const h = 14;
    const x = (VIEW_WIDTH - w) / 2;
    const y = 92;
    const r = Math.max(0, Math.min(1, ratio));

    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();

    const color = r > 0.5 ? CYAN : r > 0.25 ? GOLD : MAGENTA;
    // Pulse the glow when time is running out.
    const pulse = r < 0.28 ? 0.6 + 0.4 * Math.sin(this.time * 12) : 1;
    ctx.globalAlpha = r < 0.28 ? 0.7 + 0.3 * pulse : 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 + (r < 0.28 ? pulse * 18 : 0);
    roundRect(ctx, x, y, Math.max(h, w * r), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}

/** `#rrggbb` + alpha → an `rgba(...)` string. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
