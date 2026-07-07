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
import { bakeSprite, glowDot, GLOW_DOT_RADIUS, SPRITE_SCALE, type Sprite } from "./sprites";

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

/** All canvas drawing for Neon Sawblades, in view units. Every glow is baked
 *  once into an offscreen sprite/layer (see `sprites.ts`); the frame loop only
 *  does `drawImage` plus a handful of unblurred strokes, so it stays smooth
 *  on integrated GPUs. */
export class Renderer {
  private time = 0;
  private readonly stars: Star[] = [];
  private readonly trail: TrailNode[] = [];
  /** Static sky gradient, under the stars. */
  private readonly skyCanvas: HTMLCanvasElement;
  /** Static city + columns + scanlines + floor line/grid rows, over the stars. */
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly sawSprite: Sprite;
  private readonly coinSprite: Sprite;
  private readonly playerSprite: Sprite;

  constructor() {
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * VIEW_WIDTH,
        y: Math.random() * FLOOR_Y,
        r: 0.6 + Math.random() * 1.6,
        z: Math.random(),
      });
    }
    this.skyCanvas = this.buildSky();
    this.overlayCanvas = this.buildOverlay(this.buildCity());
    this.sawSprite = this.buildSawSprite();
    this.coinSprite = this.buildCoinSprite();
    this.playerSprite = this.buildPlayerSprite();
  }

  /** The background gradient, baked once (smooth, so 1x resolution is enough). */
  private buildSky(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = VIEW_WIDTH;
    canvas.height = VIEW_HEIGHT;
    const c = canvas.getContext("2d")!;
    // Two stops darker than it wants to be — restraint in the field is what
    // lets the figures burn (DESIGN.md).
    const grad = c.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    grad.addColorStop(0, "#06070f");
    grad.addColorStop(0.55, BG_TOP);
    grad.addColorStop(1, BG_BOTTOM);
    c.fillStyle = grad;
    c.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    return canvas;
  }

  /** Everything static that sits *over* the stars, baked once: the dim city,
   *  the neon columns, the scanlines, and the floor's glow line + grid rows
   *  (only the scrolling skew lines stay dynamic, in `drawFloor`). */
  private buildOverlay(city: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = VIEW_WIDTH * SPRITE_SCALE;
    canvas.height = VIEW_HEIGHT * SPRITE_SCALE;
    const c = canvas.getContext("2d")!;
    c.scale(SPRITE_SCALE, SPRITE_SCALE);

    // City skyline, kept dim so it stays a backdrop.
    c.globalAlpha = 0.7;
    c.drawImage(city, 0, 0);
    c.globalAlpha = 1;

    // Faint vertical neon columns for depth.
    c.globalAlpha = 0.05;
    c.strokeStyle = CYAN;
    c.lineWidth = 2;
    const cols = 8;
    for (let i = 1; i < cols; i++) {
      const x = (VIEW_WIDTH / cols) * i;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, FLOOR_Y);
      c.stroke();
    }
    c.globalAlpha = 1;

    // Subtle scanlines across the whole view.
    c.globalAlpha = 0.03;
    c.fillStyle = "#000";
    for (let y = 0; y < VIEW_HEIGHT; y += 4) c.fillRect(0, y, VIEW_WIDTH, 2);
    c.globalAlpha = 1;

    // Glowing floor line.
    c.shadowColor = CYAN;
    c.shadowBlur = 24;
    c.strokeStyle = CYAN;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, FLOOR_Y);
    c.lineTo(VIEW_WIDTH, FLOOR_Y);
    c.stroke();
    c.shadowBlur = 0;

    // The floor answers the emitter: light spill fading down from the line.
    const spill = c.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 44);
    spill.addColorStop(0, "rgba(34, 224, 255, 0.14)");
    spill.addColorStop(1, "rgba(34, 224, 255, 0)");
    c.fillStyle = spill;
    c.fillRect(0, FLOOR_Y, VIEW_WIDTH, 44);

    // Horizontal rows of the floor grid, fading as they leave the light.
    c.lineWidth = 1;
    const rows = 5;
    for (let i = 1; i <= rows; i++) {
      const y = FLOOR_Y + (FLOOR_HEIGHT / rows) * i;
      c.strokeStyle = `rgba(34, 224, 255, ${0.2 - (i - 1) * 0.035})`;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(VIEW_WIDTH, y);
      c.stroke();
    }

    // Vignette: the corners recede so the centre of play carries the eye.
    const vig = c.createRadialGradient(
      VIEW_WIDTH / 2, VIEW_HEIGHT * 0.44, VIEW_HEIGHT * 0.36,
      VIEW_WIDTH / 2, VIEW_HEIGHT * 0.44, VIEW_HEIGHT * 0.82,
    );
    vig.addColorStop(0, "rgba(4, 5, 12, 0)");
    vig.addColorStop(1, "rgba(4, 5, 12, 0.4)");
    c.fillStyle = vig;
    c.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    return canvas;
  }

  /** Draws the neon city once into an offscreen canvas. Built as atmosphere,
   *  not scenery: a horizon "light pollution" glow that the dark building
   *  silhouettes cut into, plus a few soft signs — the same read as the neon
   *  ambience in Keepers! / Barra Libre, kept dim on purpose. */
  private buildCity(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = VIEW_WIDTH;
    canvas.height = FLOOR_Y;
    const c = canvas.getContext("2d")!;
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

    return canvas;
  }

  /** A machined circular blade (see DESIGN.md): hooked asymmetric teeth, a
   *  gunmetal disc, a bolt circle of lightening holes and a layered arbor —
   *  the silhouette of a cutting tool, not a star shape. */
  private buildSawSprite(): Sprite {
    const pad = 22; // room for shadowBlur + the rim stroke
    const size = (SAW_RADIUS + pad) * 2;
    return bakeSprite(size, size, (c) => {
      const R = SAW_RADIUS;
      const teeth = 11;
      const step = (Math.PI * 2) / teeth;

      // Blade silhouette: flat-topped hooked teeth (root, leading corner,
      // sloped top, gullet) — machined, not a needle starburst.
      const blade = new Path2D();
      for (let i = 0; i < teeth; i++) {
        const a = i * step;
        const pt = (rel: number, r: number) =>
          blade.lineTo(Math.cos(a + step * rel) * R * r, Math.sin(a + step * rel) * R * r);
        pt(0, 0.8);
        pt(0.12, 1);
        pt(0.4, 0.95);
        pt(0.58, 0.78);
      }
      blade.closePath();

      // Disc body: dark gunmetal turning warmer toward the rim.
      c.shadowColor = MAGENTA;
      c.shadowBlur = 16;
      const body = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
      body.addColorStop(0, "#241631");
      body.addColorStop(0.62, "#180e24");
      body.addColorStop(1, "#3c1733");
      c.fillStyle = body;
      c.fill(blade);

      // Rim light: a thin hot edge instead of a thick outline.
      c.lineWidth = 1.8;
      c.strokeStyle = MAGENTA;
      c.stroke(blade);
      c.shadowBlur = 0;

      // Machining groove just inside the gullets.
      c.beginPath();
      c.arc(0, 0, R * 0.66, 0, Math.PI * 2);
      c.lineWidth = 1;
      c.strokeStyle = "rgba(255, 45, 120, 0.28)";
      c.stroke();

      // Bolt circle of lightening holes.
      const holes = 5;
      for (let i = 0; i < holes; i++) {
        const a = (i / holes) * Math.PI * 2 + step * 0.5;
        const hx = Math.cos(a) * R * 0.46;
        const hy = Math.sin(a) * R * 0.46;
        c.beginPath();
        c.arc(hx, hy, R * 0.1, 0, Math.PI * 2);
        c.fillStyle = "#0d0616";
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = "rgba(255, 45, 120, 0.35)";
        c.stroke();
      }

      // Layered arbor: ring, hub face, dark axle hole.
      c.beginPath();
      c.arc(0, 0, R * 0.3, 0, Math.PI * 2);
      c.lineWidth = 2;
      c.strokeStyle = "rgba(255, 45, 120, 0.85)";
      c.stroke();
      c.beginPath();
      c.arc(0, 0, R * 0.22, 0, Math.PI * 2);
      const hub = c.createRadialGradient(-R * 0.06, -R * 0.06, 0, 0, 0, R * 0.22);
      hub.addColorStop(0, "#ff6ba0");
      hub.addColorStop(1, "#b81b56");
      c.fillStyle = hub;
      c.fill();
      c.beginPath();
      c.arc(0, 0, R * 0.08, 0, Math.PI * 2);
      c.fillStyle = "#0d0616";
      c.fill();
    });
  }

  /** A minted token (see DESIGN.md): beveled edge catching the light from
   *  above, a slightly darker face, a struck ring groove and one specular
   *  arc — not two flat concentric circles. */
  private buildCoinSprite(): Sprite {
    const pad = 16; // room for shadowBlur
    const size = (COIN_RADIUS + pad) * 2;
    return bakeSprite(size, size, (c) => {
      const R = COIN_RADIUS;

      // Edge: bright where the light hits (top-left), darker below.
      c.shadowColor = GOLD;
      c.shadowBlur = 13;
      const edge = c.createLinearGradient(-R, -R, R * 0.7, R);
      edge.addColorStop(0, "#ffe9a3");
      edge.addColorStop(0.5, GOLD);
      edge.addColorStop(1, "#b9860e");
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.fillStyle = edge;
      c.fill();
      c.shadowBlur = 0;

      // Face, one step darker than the edge so the bevel reads.
      const face = c.createLinearGradient(-R, -R, R, R);
      face.addColorStop(0, "#f5c93e");
      face.addColorStop(1, "#cf9d18");
      c.beginPath();
      c.arc(0, 0, R * 0.78, 0, Math.PI * 2);
      c.fillStyle = face;
      c.fill();

      // Struck ring groove.
      c.beginPath();
      c.arc(0, 0, R * 0.58, 0, Math.PI * 2);
      c.lineWidth = 1.2;
      c.strokeStyle = "rgba(122, 84, 8, 0.55)";
      c.stroke();

      // One specular arc along the lit edge.
      c.beginPath();
      c.arc(0, 0, R * 0.86, Math.PI * 1.05, Math.PI * 1.55);
      c.lineWidth = 1.6;
      c.lineCap = "round";
      c.strokeStyle = "rgba(255, 250, 224, 0.85)";
      c.stroke();
    });
  }

  private buildPlayerSprite(): Sprite {
    const pad = 26; // room for shadowBlur 20 + the stroke
    return bakeSprite(PLAYER_WIDTH + pad * 2, PLAYER_HEIGHT + pad * 2, (c) => {
      const w = PLAYER_WIDTH;
      const h = PLAYER_HEIGHT;
      const footH = 7;
      const bodyH = h - footH;
      const x = -w / 2;
      const yTop = -h / 2;
      const bodyBottom = yTop + bodyH;

      // Little stubby feet under the body, in shade (they face the floor).
      c.shadowColor = CYAN;
      c.shadowBlur = 8;
      c.fillStyle = "#2aa4c2";
      const footW = 9;
      const footGap = 4;
      roundRect(c, -footGap - footW, bodyBottom, footW, footH, 2);
      c.fill();
      roundRect(c, footGap, bodyBottom, footW, footH, 2);
      c.fill();

      // Body: machined corners, lit from above.
      c.shadowColor = CYAN;
      c.shadowBlur = 18;
      roundRect(c, x, yTop, w, bodyH, 7);
      const grad = c.createLinearGradient(x, yTop, x, bodyBottom);
      grad.addColorStop(0, "#9dfdff");
      grad.addColorStop(0.55, CYAN);
      grad.addColorStop(1, "#14b5d6");
      c.fillStyle = grad;
      c.fill();
      c.shadowBlur = 0;

      // Rim light along the top edge only (no full sticker outline), plus a
      // soft shade seating the body's lower edge.
      c.beginPath();
      c.moveTo(x + 5, yTop + 1.2);
      c.lineTo(x + w - 5, yTop + 1.2);
      c.lineWidth = 1.6;
      c.lineCap = "round";
      c.strokeStyle = "rgba(240, 255, 255, 0.75)";
      c.stroke();
      c.beginPath();
      c.moveTo(x + 5, bodyBottom - 1.6);
      c.lineTo(x + w - 5, bodyBottom - 1.6);
      c.lineWidth = 2.4;
      c.strokeStyle = "rgba(8, 42, 64, 0.28)";
      c.stroke();

      // --- Face: solid black eyes and angry brows, centred in the body ---
      const ink = "#0a111f";
      const eyeY = yTop + bodyH * 0.6;
      const eyeDX = 7;

      // Solid black eyes (no sclera, no glint).
      c.fillStyle = ink;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.ellipse(s * eyeDX, eyeY, 3.1, 4.2, 0, 0, Math.PI * 2);
        c.fill();
      }

      // Angry eyebrows, sloping down toward the centre, set a bit above the
      // eyes — drawn thinner so they read as intent, not cartoon.
      c.strokeStyle = ink;
      c.lineWidth = 2.6;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-11, eyeY - 11);
      c.lineTo(-3, eyeY - 7.5);
      c.moveTo(11, eyeY - 11);
      c.lineTo(3, eyeY - 7.5);
      c.stroke();
    });
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
  ): void {
    this.drawBackground(ctx);
    this.drawFloor(ctx);
    this.updateTrail(player);
    this.drawTrail(ctx);
    for (const coin of field.coins) this.drawCoin(ctx, coin.x, coin.y, coin.life);
    for (const saw of field.saws) this.drawSaw(ctx, saw.x, saw.y, saw.spin);
    this.drawPlayer(ctx, player);
    particles.draw(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.skyCanvas, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Twinkling parallax starfield (the only dynamic background layer).
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

    // City, columns, scanlines and floor line/rows, baked once.
    ctx.drawImage(this.overlayCanvas, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  /** Only the animated part of the floor: the skew lines scrolling toward the
   *  viewer (the glow line and grid rows live in the baked overlay). */
  private drawFloor(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = "rgba(34, 224, 255, 0.12)";
    ctx.lineWidth = 1;
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
    const dot = glowDot(CYAN);
    ctx.save();
    for (let i = 0; i < this.trail.length - 1; i++) {
      const t = i / this.trail.length;
      const node = this.trail[i];
      const d = ((PLAYER_WIDTH * 0.4 * t) / GLOW_DOT_RADIUS) * dot.w;
      if (d < 1) continue;
      ctx.globalAlpha = t * 0.26;
      ctx.drawImage(dot.canvas, node.x - d / 2, node.y - d / 2, d, d);
    }
    ctx.restore();
  }

  private drawSaw(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
    const s = this.sawSprite;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }

  private drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, life: number): void {
    // Blink out over the last stretch of the coin's life.
    if (life < 1.5 && Math.floor(life * 10) % 2 === 0) return;
    const s = this.coinSprite;
    // Minted-token spin: the width oscillates like a coin turning on its
    // axis (phase offset by position so coins don't spin in unison).
    const spin = Math.abs(Math.cos(this.time * 2.6 + x * 0.045));
    const w = s.w * (0.3 + 0.7 * spin);
    ctx.drawImage(s.canvas, x - w / 2, y - s.h / 2, w, s.h);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    const s = this.playerSprite;
    ctx.drawImage(s.canvas, player.x - s.w / 2, player.centerY - s.h / 2, s.w, s.h);
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
