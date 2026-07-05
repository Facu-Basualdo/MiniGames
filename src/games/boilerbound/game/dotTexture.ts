import * as THREE from "three";

let cached: THREE.Texture | null = null;
let puffCached: THREE.Texture | null = null;

/** Soft radial-gradient sprite shared by the spark pool (round additive glows
 *  instead of hard squares). Built once, reused everywhere. */
export function getDotTexture(): THREE.Texture {
  if (cached) return cached;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cached = tex;
  return tex;
}

/** A cartoon steam puff: a flat white blob with a dark ink outline and a light
 *  cel-shadow band inside the rim — so overlapping puffs read as hand-drawn
 *  billowing smoke (matching the outlined toon props) instead of an airbrushed
 *  gradient. Used for the steam jets. */
export function getPuffTexture(): THREE.Texture {
  if (puffCached) return puffCached;
  const size = 128;
  const c = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const disc = (r: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  disc(c * 0.96, "rgba(38,42,52,1)"); // ink outline
  disc(c * 0.86, "rgba(206,214,224,1)"); // cel shadow band
  disc(c * 0.72, "rgba(255,255,255,1)"); // flat white core
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  puffCached = tex;
  return tex;
}
