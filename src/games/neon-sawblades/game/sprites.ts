/**
 * Pre-rendered glow sprites. Canvas `shadowBlur` is by far the most expensive
 * 2D operation — the browser rasterizes the shape into a temp surface and
 * gaussian-blurs it on *every* fill/stroke — which made integrated GPUs
 * stutter during particle bursts. Everything glowing is baked once here (blur
 * included) and the per-frame drawing is plain `drawImage`.
 */

/** Sprites are baked at this multiple of view units so they stay crisp when
 *  the letterbox upscales the view (~2-2.5 physical px per view unit). */
export const SPRITE_SCALE = 2;

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Blit size in view units (the backing canvas is SPRITE_SCALE times bigger). */
  w: number;
  h: number;
}

/** Bakes a w×h (view units) sprite; `draw` renders with (0,0) at the centre. */
export function bakeSprite(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * SPRITE_SCALE);
  canvas.height = Math.ceil(h * SPRITE_SCALE);
  const c = canvas.getContext("2d")!;
  c.scale(SPRITE_SCALE, SPRITE_SCALE);
  c.translate(w / 2, h / 2);
  draw(c);
  return { canvas, w, h };
}

/** Radius the glow dot is baked at; blits scale relative to this. */
export const GLOW_DOT_RADIUS = 5;
const GLOW_DOT_BLUR = 12;
const glowDots = new Map<string, Sprite>();

/** A soft glowing dot of the given colour (sparks and the motion trail). */
export function glowDot(color: string): Sprite {
  let sprite = glowDots.get(color);
  if (!sprite) {
    const size = (GLOW_DOT_RADIUS + GLOW_DOT_BLUR) * 2;
    sprite = bakeSprite(size, size, (c) => {
      c.fillStyle = color;
      c.shadowColor = color;
      c.shadowBlur = GLOW_DOT_BLUR;
      c.beginPath();
      c.arc(0, 0, GLOW_DOT_RADIUS, 0, Math.PI * 2);
      c.fill();
    });
    glowDots.set(color, sprite);
  }
  return sprite;
}
