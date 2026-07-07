export interface HSV {
  h: number; // 0..360
  s: number; // 0..100
  v: number; // 0..100 (brightness)
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const MAX_DIST = Math.sqrt(3 * 255 * 255);

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const S = s / 100;
  const V = v / 100;
  const c = V * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = V - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hsvCss(hsv: HSV): string {
  const { r, g, b } = hsvToRgb(hsv);
  return `rgb(${r}, ${g}, ${b})`;
}

export function rgbCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance 0..1. */
export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// Relative luminance of the two ink colors used in the UI (#14110d, #faf8f5).
const DARK_INK_L = 0.006;
const LIGHT_INK_L = 0.94;

/**
 * Pick the ink (dark or light) with the higher WCAG contrast over the color —
 * robust for mid-luminance colors where a fixed threshold reads poorly.
 */
export function textToneFor(hsv: HSV): "light" | "dark" {
  const l = relativeLuminance(hsvToRgb(hsv));
  const contrastDark = (l + 0.05) / (DARK_INK_L + 0.05);
  const contrastLight = (LIGHT_INK_L + 0.05) / (l + 0.05);
  return contrastDark >= contrastLight ? "dark" : "light";
}

/** Match percentage in [0,100]; 100 = exact recreation. */
export function accuracy(guess: HSV, target: HSV, power: number): number {
  const a = hsvToRgb(guess);
  const b = hsvToRgb(target);
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const raw = Math.max(0, 1 - dist / MAX_DIST);
  return Math.pow(raw, power) * 100;
}

/** A vivid, memorable, recreatable target. */
export function randomTargetHsv(): HSV {
  return {
    h: Math.round(Math.random() * 360),
    s: Math.round(45 + Math.random() * 50),
    v: Math.round(45 + Math.random() * 47),
  };
}

/** Neutral-ish random start so nothing anchors the guess. */
export function randomStartHsv(): HSV {
  return {
    h: Math.round(Math.random() * 360),
    s: Math.round(20 + Math.random() * 60),
    v: Math.round(35 + Math.random() * 45),
  };
}
