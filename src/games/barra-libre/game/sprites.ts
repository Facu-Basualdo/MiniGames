import * as THREE from "three";

/** Procedural pixel-art sprite sheets and world textures. Everything is
 *  drawn once onto small canvases (1 canvas px = 1 art pixel) and sampled
 *  with NearestFilter so the pixelation pass gets clean flat colors. */

/** A rect of the figure: [x, y, w, h, palette key]. */
type Rect = readonly [number, number, number, number, string];

function drawFrame(width: number, height: number, palette: Record<string, string>, rects: readonly Rect[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  for (const [x, y, w, h, key] of rects) {
    ctx.fillStyle = palette[key];
    ctx.fillRect(x, y, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  return texture;
}

function finishTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ------------------------------------------------------------- bartender --

/** Bartender art box: 28 x 30, drawn in profile facing LEFT (toward the
 *  customers). A proud round-bellied barman: bald with a thin mustache,
 *  cream shirt that barely holds, dark vest open over the belly, red
 *  bowtie and a wine apron. Nothing like the original's design. */
export const BARTENDER_W = 28;
export const BARTENDER_H = 30;

const BARTENDER_PALETTE: Record<string, string> = {
  skin: "#d8a06a",
  skin2: "#b98352",
  shirt: "#e8e0d0",
  shirt2: "#cfc6b4",
  vest: "#3a2430",
  bow: "#a32639",
  apron: "#6e2f38",
  pants: "#2a2733",
  shoe: "#14121a",
  hair: "#4a3226",
  eye: "#20161c",
};

/** Head + belly torso shared by every pose. `dy` bobs the breathing. */
function bartenderCore(dy: number): Rect[] {
  return [
    // Bald head in profile: skull, ear, nose, eye, thin mustache.
    [7, 1 + dy, 7, 6, "skin"],
    [6, 3 + dy, 1, 3, "skin"], // brow/nose ridge
    [5, 4 + dy, 2, 2, "skin"], // nose
    [12, 3 + dy, 2, 2, "skin2"], // ear
    [8, 3 + dy, 1, 1, "eye"],
    [5, 6 + dy, 4, 1, "hair"], // mustache
    [12, 1 + dy, 2, 2, "hair"], // last tuft of hair at the back
    // Neck and bowtie.
    [9, 7 + dy, 4, 1, "skin"],
    [7, 7 + dy, 3, 2, "bow"],
    // The belly: shirt bulging forward (left).
    [6, 8 + dy, 11, 3, "shirt"],
    [4, 11 + dy, 14, 3, "shirt"],
    [3, 14 + dy, 15, 4, "shirt"],
    [5, 18 + dy, 12, 2, "shirt"],
    // Open vest along the back.
    [14, 8 + dy, 4, 11, "vest"],
    [6, 8 + dy, 2, 2, "vest"], // front lapel
    // Apron over the lower belly.
    [3, 16 + dy, 13, 4, "apron"],
  ];
}

const BARTENDER_LEGS: Rect[] = [
  [7, 20, 4, 6, "pants"],
  [13, 20, 4, 6, "pants"],
  [5, 26, 6, 2, "shoe"],
  [12, 26, 6, 2, "shoe"],
];

const BARTENDER_IDLE_A: Rect[] = [
  ...bartenderCore(0),
  // Arms hanging, a rag in the back hand.
  [4, 10, 3, 6, "shirt2"],
  [4, 16, 2, 2, "skin"],
  [16, 11, 2, 5, "shirt2"],
  [16, 16, 2, 2, "skin"],
  [17, 17, 3, 3, "shirt"],
  ...BARTENDER_LEGS,
];

const BARTENDER_IDLE_B: Rect[] = [
  ...bartenderCore(1),
  [4, 11, 3, 6, "shirt2"],
  [4, 17, 2, 2, "skin"],
  [16, 12, 2, 5, "shirt2"],
  [16, 17, 2, 2, "skin"],
  [17, 18, 3, 3, "shirt"],
  ...BARTENDER_LEGS,
];

/** Pouring (also the "mug is full, still standing here" pose): front hand
 *  holds the mug under the tap, back hand up on the tap handle. */
const BARTENDER_POUR: Rect[] = [
  ...bartenderCore(0),
  // Front arm straight out at counter height.
  [1, 12, 6, 2, "shirt2"],
  [0, 12, 2, 2, "skin"],
  // Back arm reaching up to the handle.
  [15, 6, 2, 3, "shirt2"],
  [15, 4, 2, 2, "skin"],
  ...BARTENDER_LEGS,
];

/** Serve: full lunge, arm flung toward the far end of the bar. */
const BARTENDER_SERVE: Rect[] = [
  ...bartenderCore(0),
  [0, 13, 7, 2, "shirt2"],
  [0, 15, 2, 1, "skin"],
  [16, 10, 2, 5, "shirt2"],
  [16, 15, 2, 2, "skin"],
  // Front leg steps into the throw.
  [5, 20, 4, 6, "pants"],
  [13, 20, 4, 6, "pants"],
  [3, 26, 6, 2, "shoe"],
  [12, 26, 6, 2, "shoe"],
];

/** Catch: crouched a hair, front arm scooping low. */
const BARTENDER_CATCH: Rect[] = [
  ...bartenderCore(1),
  [2, 16, 5, 2, "shirt2"],
  [1, 16, 2, 2, "skin"],
  [16, 12, 2, 5, "shirt2"],
  [16, 17, 2, 2, "skin"],
  ...BARTENDER_LEGS,
];

export interface BartenderFrames {
  idle: THREE.CanvasTexture[];
  pour: THREE.CanvasTexture;
  serve: THREE.CanvasTexture;
  catch: THREE.CanvasTexture;
}

export function buildBartenderFrames(): BartenderFrames {
  return {
    idle: [
      drawFrame(BARTENDER_W, BARTENDER_H, BARTENDER_PALETTE, BARTENDER_IDLE_A),
      drawFrame(BARTENDER_W, BARTENDER_H, BARTENDER_PALETTE, BARTENDER_IDLE_B),
    ],
    pour: drawFrame(BARTENDER_W, BARTENDER_H, BARTENDER_PALETTE, BARTENDER_POUR),
    serve: drawFrame(BARTENDER_W, BARTENDER_H, BARTENDER_PALETTE, BARTENDER_SERVE),
    catch: drawFrame(BARTENDER_W, BARTENDER_H, BARTENDER_PALETTE, BARTENDER_CATCH),
  };
}

// --------------------------------------------------------------- patrons --

/** Patron art box: 22 x 28, profile facing RIGHT (walking toward the
 *  bartender). Two kinds: the regular (flat cap, brown jacket) and the
 *  punk (pink mohawk, leather jacket) who walks much faster. */
export const PATRON_W = 22;
export const PATRON_H = 28;

const REGULAR_PALETTE: Record<string, string> = {
  hat: "#5a4632",
  skin: "#c99b71",
  hair: "#3a2a1c",
  coat: "#6e4a2e",
  coat2: "#7d5636",
  pants: "#3a3540",
  shoe: "#1a171f",
  eye: "#20161c",
  beer: "#f2b13e",
  foam: "#f4efe2",
};

/** Jacket/cap variants for the regulars: bright enough to read in a dark
 *  bar, and the crowd stops looking like clones. */
const REGULAR_VARIANTS: ReadonlyArray<Record<string, string>> = [
  {}, // the base brown coat
  { coat: "#8a4038", coat2: "#a3524a", hat: "#4a2e2a" },
  { coat: "#3f5a8a", coat2: "#4e6ea5", hat: "#2e3a54" },
  { coat: "#4a7a50", coat2: "#5a8f60", hat: "#33513a" },
  { coat: "#8a7a4a", coat2: "#a08f5a", hat: "#54492e" },
];

const PUNK_PALETTE: Record<string, string> = {
  hat: "#ff4f9e", // the mohawk
  skin: "#c9a084",
  hair: "#241c20",
  coat: "#22202a",
  coat2: "#33303e",
  pants: "#3a4a6e",
  shoe: "#14121a",
  eye: "#1a1016",
  beer: "#f2b13e",
  foam: "#f4efe2",
};

/** Head + torso shared by the walk frames. The punk swaps the flat cap
 *  for a crest via the same "hat" palette slot plus taller rects. */
function patronCore(dy: number, punk: boolean): Rect[] {
  const head: Rect[] = punk
    ? [
        // Mohawk spikes.
        [8, 0 + dy, 2, 3, "hat"],
        [11, 0 + dy, 2, 4, "hat"],
        [14, 1 + dy, 1, 3, "hat"],
        [8, 3 + dy, 7, 5, "skin"],
      ]
    : [
        // Flat cap with a front brim.
        [8, 1 + dy, 7, 2, "hat"],
        [14, 3 + dy, 3, 1, "hat"],
        [8, 3 + dy, 7, 5, "skin"],
      ];
  return [
    ...head,
    [13, 4 + dy, 1, 1, "eye"],
    [15, 5 + dy, 1, 2, "skin"], // nose
    [7, 4 + dy, 1, 3, "hair"], // back of the head
    // Jacket torso.
    [7, 8 + dy, 9, 8, "coat"],
    [8, 9 + dy, 7, 2, "coat2"],
  ];
}

function patronWalkA(punk: boolean): Rect[] {
  return [
    ...patronCore(0, punk),
    // Arms swinging opposite the legs.
    [14, 9, 2, 6, "coat2"],
    [14, 15, 2, 2, "skin"],
    [6, 10, 2, 5, "coat2"],
    // Scissored legs.
    [7, 16, 3, 8, "pants"],
    [13, 16, 3, 8, "pants"],
    [5, 24, 4, 2, "shoe"],
    [13, 24, 4, 2, "shoe"],
  ];
}

function patronWalkB(punk: boolean): Rect[] {
  return [
    ...patronCore(0, punk),
    [13, 10, 2, 5, "coat2"],
    [13, 15, 2, 2, "skin"],
    [7, 9, 2, 6, "coat2"],
    [9, 16, 3, 8, "pants"],
    [11, 16, 3, 8, "pants"],
    [8, 24, 4, 2, "shoe"],
    [12, 24, 4, 2, "shoe"],
  ];
}

/** Drinking: leaned back, mug raised to the face (the mug is part of the
 *  sprite here — the 3D mug is consumed on the catch). */
function patronDrink(punk: boolean): Rect[] {
  return [
    ...patronCore(1, punk),
    // Raised front arm holding the mug at the face.
    [14, 6, 2, 4, "coat2"],
    [16, 4, 3, 4, "beer"],
    [16, 3, 3, 1, "foam"],
    [6, 10, 2, 5, "coat2"],
    // Feet planted.
    [8, 17, 3, 7, "pants"],
    [12, 17, 3, 7, "pants"],
    [7, 24, 4, 2, "shoe"],
    [12, 24, 4, 2, "shoe"],
  ];
}

export type PatronKind = "regular" | "punk";

export interface PatronFrames {
  walk: THREE.CanvasTexture[];
  drink: THREE.CanvasTexture;
}

/** Number of visual variants per kind (Lanes picks one per customer). */
export function patronVariantCount(kind: PatronKind): number {
  return kind === "punk" ? 1 : REGULAR_VARIANTS.length;
}

export function buildPatronFrames(kind: PatronKind, variant = 0): PatronFrames {
  const punk = kind === "punk";
  const palette = punk
    ? PUNK_PALETTE
    : { ...REGULAR_PALETTE, ...REGULAR_VARIANTS[variant % REGULAR_VARIANTS.length] };
  return {
    walk: [
      drawFrame(PATRON_W, PATRON_H, palette, patronWalkA(punk)),
      drawFrame(PATRON_W, PATRON_H, palette, patronWalkB(punk)),
    ],
    drink: drawFrame(PATRON_W, PATRON_H, palette, patronDrink(punk)),
  };
}

// ---------------------------------------------------------- world textures --

/** Dark walnut floor planks with seams and wear noise; tiled. */
export function buildFloorTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const planks = ["#2b1c14", "#241710", "#2f2016"];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = planks[i % 3];
    ctx.fillRect(0, i * 8, size, 8);
    ctx.fillStyle = "#150d08";
    ctx.fillRect(0, i * 8, size, 1);
    // Plank end seams, offset per row.
    ctx.fillRect(((i * 23) % size), i * 8, 1, 8);
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,220,160,0.05)";
    ctx.fillRect(Math.floor(Math.random() * size), Math.floor(Math.random() * size), 1, 1);
  }
  return finishTexture(canvas, true);
}

/** Polished counter top: long grain strips with a bright lacquer streak
 *  so the lamp light reads on the wood. Tiled along the counter. */
export function buildCounterTopTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 16;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const strips = ["#7a4a26", "#6e401e", "#835230"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = strips[i % 3];
    ctx.fillRect(0, i * 4, w, 4);
  }
  // Lacquer highlight streak.
  ctx.fillStyle = "#96613a";
  ctx.fillRect(0, 5, w, 1);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,235,200,0.08)";
    ctx.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 2, 1);
  }
  return finishTexture(canvas, true);
}

/** Paneled mahogany counter front. Tiled along the counter. */
export function buildCounterFrontTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3d2417";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2; i++) {
    const x = 4 + i * 32;
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(x, 4, 24, 24);
    ctx.fillStyle = "#452a1b";
    ctx.fillRect(x + 2, 6, 20, 20);
  }
  // Brass rail shadow along the top edge.
  ctx.fillStyle = "#241309";
  ctx.fillRect(0, 0, w, 2);
  return finishTexture(canvas, true);
}

/** Back wall: wood wainscot below, deep-red wallpaper with a diamond dot
 *  pattern above. Tiled across the room. */
export function buildBackWallTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Wallpaper.
  ctx.fillStyle = "#33121e";
  ctx.fillRect(0, 0, w, 40);
  ctx.fillStyle = "#3d1826";
  for (let y = 0; y < 40; y += 8) {
    for (let x = 0; x < w; x += 8) {
      ctx.fillRect(x + ((y / 8) % 2 === 0 ? 3 : 7) % 8, y + 3, 2, 2);
    }
  }
  // Molding + wainscot.
  ctx.fillStyle = "#1c0f0a";
  ctx.fillRect(0, 40, w, 2);
  ctx.fillStyle = "#2b1a10";
  ctx.fillRect(0, 42, w, 22);
  ctx.fillStyle = "#1f120b";
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 42, 1, 22);
  return finishTexture(canvas, true);
}

/** Bottle shelf strip: a wood board with backlit bottles of many colors.
 *  Used as both map and emissiveMap so the bottles glow like a real
 *  backbar. */
export function buildShelfTexture(): THREE.CanvasTexture {
  const w = 96;
  const h = 24;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Warm backlight wash behind the bottles.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#4a2c14");
  g.addColorStop(1, "#2a180c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const glass = ["#3fae6a", "#d98f2b", "#3f7dae", "#ae3f55", "#8a5fd0", "#d0c05f"];
  let x = 3;
  while (x < w - 6) {
    const color = glass[Math.floor(Math.random() * glass.length)];
    const bh = 12 + Math.floor(Math.random() * 6);
    // Body, neck, shine.
    ctx.fillStyle = color;
    ctx.fillRect(x, h - 3 - bh, 4, bh);
    ctx.fillRect(x + 1, h - 3 - bh - 4, 2, 4);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(x + 1, h - 3 - bh + 2, 1, Math.max(2, bh - 6));
    x += 6 + Math.floor(Math.random() * 4);
  }
  // Shelf board.
  ctx.fillStyle = "#1c0f08";
  ctx.fillRect(0, h - 3, w, 3);
  return finishTexture(canvas);
}

/** Neon "BAR" sign on a transparent canvas: hand-placed blocky tube
 *  letters. Bright core over a dimmer halo pixel border. */
export function buildNeonBarSign(): THREE.CanvasTexture {
  const w = 46;
  const h = 20;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const tube = (x: number, y: number, ww: number, hh: number) => {
    ctx.fillStyle = "#ff2fd6";
    ctx.fillRect(x - 1, y - 1, ww + 2, hh + 2);
    ctx.fillStyle = "#ffb3f0";
    ctx.fillRect(x, y, ww, hh);
  };

  // B (x 3..13)
  tube(3, 3, 2, 14);
  tube(5, 3, 6, 2);
  tube(5, 9, 6, 2);
  tube(5, 15, 6, 2);
  tube(11, 5, 2, 4);
  tube(11, 11, 2, 4);
  // A (x 17..27)
  tube(17, 5, 2, 12);
  tube(25, 5, 2, 12);
  tube(19, 3, 6, 2);
  tube(19, 10, 6, 2);
  // R (x 31..43)
  tube(31, 3, 2, 14);
  tube(33, 3, 6, 2);
  tube(39, 5, 2, 4);
  tube(33, 9, 6, 2);
  tube(37, 11, 2, 2);
  tube(39, 13, 2, 4);

  return finishTexture(canvas);
}

/** Neon cocktail glass, cyan tubes with a green olive: the second sign. */
export function buildNeonCocktail(): THREE.CanvasTexture {
  const w = 26;
  const h = 30;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const tube = (x: number, y: number, ww: number, hh: number, core = "#b3f6ff", halo = "#2fd6ff") => {
    ctx.fillStyle = halo;
    ctx.fillRect(x - 1, y - 1, ww + 2, hh + 2);
    ctx.fillStyle = core;
    ctx.fillRect(x, y, ww, hh);
  };

  // Martini cone: stepped diagonals.
  tube(3, 3, 20, 1);
  tube(5, 5, 2, 2);
  tube(19, 5, 2, 2);
  tube(8, 8, 2, 2);
  tube(16, 8, 2, 2);
  tube(11, 11, 4, 2);
  // Stem and base.
  tube(12, 13, 2, 9);
  tube(7, 23, 12, 2);
  // Olive.
  tube(15, 5, 3, 3, "#b8ff9d", "#3fe06a");

  return finishTexture(canvas);
}

/** A wide city-skyline night view for the side-wall picture window: a
 *  graded sky, a warm horizon haze and two layers of silhouetted towers
 *  freckled with warm/cool lit windows (the bloom picks the lights up).
 *  Drawn wide (the mullion frame is real geometry, not painted here). */
export function buildCityWindowTexture(): THREE.CanvasTexture {
  const w = 160;
  const h = 88;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Night sky gradient, deep navy up top warming toward the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#05060f");
  sky.addColorStop(0.55, "#0a1024");
  sky.addColorStop(0.82, "#1b1836");
  sky.addColorStop(1, "#2c2032");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // A scatter of stars in the upper sky.
  ctx.fillStyle = "#cdd6f2";
  for (const [sx, sy] of [[12, 6], [40, 10], [70, 5], [104, 9], [138, 7], [150, 14], [24, 16], [88, 12]]) {
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Warm haze glow rising behind the skyline.
  const haze = ctx.createLinearGradient(0, h * 0.5, 0, h);
  haze.addColorStop(0, "rgba(150,90,90,0)");
  haze.addColorStop(1, "rgba(210,120,90,0.35)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, Math.floor(h * 0.5), w, h);

  const warm = "#ffd98a";
  const cool = "#cfe8ff";
  const drawTowers = (startX: number, body: string, minW: number, varW: number, baseTop: number, spread: number, lit: number): void => {
    let x = startX;
    while (x < w) {
      const bw = minW + Math.floor(Math.random() * varW);
      const top = Math.floor(h * (baseTop + Math.random() * spread));
      ctx.fillStyle = body;
      ctx.fillRect(x, top, bw, h - top);
      // Grid of lit windows.
      for (let wy = top + 2; wy < h - 2; wy += 3) {
        for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
          if (Math.random() < lit) {
            ctx.fillStyle = Math.random() < 0.76 ? warm : cool;
            ctx.fillRect(wx, wy, 1, 2);
          }
        }
      }
      x += bw + 1 + Math.floor(Math.random() * 3);
    }
  };

  // Far, hazier layer then a nearer, taller silhouette layer in front.
  drawTowers(-2, "#1a2138", 8, 10, 0.44, 0.18, 0.34);
  drawTowers(-4, "#0a0e1e", 12, 16, 0.22, 0.28, 0.52);

  return finishTexture(canvas);
}

/** One background drinker in the far booths, fixed per seat so the two
 *  animation frames only differ in posture. */
interface Drinker {
  x: number;
  shirt: string;
  skin: string;
  bouncy: boolean;
}

const DRINKER_SHIRTS = ["#2e2233", "#33202a", "#1f342d", "#3a2921", "#242138", "#402e3a"];
const DRINKER_SKINS = ["#6e5540", "#5c4230", "#7a6048", "#4c3422"];

export function buildDrinkers(width: number): Drinker[] {
  const drinkers: Drinker[] = [];
  for (let x = 4 + Math.floor(Math.random() * 4); x < width - 8; x += 9 + Math.floor(Math.random() * 6)) {
    if (Math.random() < 0.2) continue;
    drinkers.push({
      x,
      shirt: DRINKER_SHIRTS[Math.floor(Math.random() * DRINKER_SHIRTS.length)],
      skin: DRINKER_SKINS[Math.floor(Math.random() * DRINKER_SKINS.length)],
      bouncy: Math.random() < 0.4,
    });
  }
  return drinkers;
}

/** Far-booth strip: silhouetted drinkers at a rail with tiny warm glasses.
 *  `frame` toggles the bouncy ones one pixel so the room feels alive. */
export function buildBoothTexture(drinkers: Drinker[], frame: number): THREE.CanvasTexture {
  const w = 256;
  const h = 36;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#170b12");
  g.addColorStop(1, "#241018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Booth rail.
  ctx.fillStyle = "#1c0f0a";
  ctx.fillRect(0, h - 10, w, 3);

  for (const d of drinkers) {
    const bob = d.bouncy && frame === 1 ? -1 : 0;
    const y = h - 24 + bob;
    ctx.fillStyle = d.skin;
    ctx.fillRect(d.x, y, 3, 3);
    ctx.fillStyle = d.shirt;
    ctx.fillRect(d.x - 1, y + 3, 5, 8);
    // A tiny glass on the rail in front of some of them.
    if (d.bouncy) {
      ctx.fillStyle = "#f2b13e";
      ctx.fillRect(d.x + 5, h - 13, 2, 3);
    }
  }
  return finishTexture(canvas);
}

// ------------------------------------------------------------- helpers --

/** A lit sprite plane: MeshStandardMaterial so lights/shadows hit it, with
 *  an alpha-tested depth material so its cast shadow matches the silhouette. */
export function makeSpritePlane(texture: THREE.CanvasTexture, widthM: number, heightM: number): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), material);
  mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: texture,
    alphaTest: 0.5,
  });
  return mesh;
}

/** Swaps the sprite's frame on both the color and the shadow-depth material. */
export function setSpriteFrame(mesh: THREE.Mesh, texture: THREE.CanvasTexture): void {
  const material = mesh.material as THREE.MeshStandardMaterial;
  if (material.map === texture) return;
  material.map = texture;
  material.needsUpdate = true;
  const depth = mesh.customDepthMaterial as THREE.MeshDepthMaterial;
  depth.map = texture;
  depth.needsUpdate = true;
}
