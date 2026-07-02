import * as THREE from "three";

/** Procedural pixel-art sprite sheets and world textures. Everything is
 *  drawn once onto small canvases (1 canvas px = 1 art pixel) and sampled
 *  with NearestFilter so the pixelation pass gets clean flat colors. */

/** A rect of the figure: [x, y, w, h, palette key]. */
type Rect = readonly [number, number, number, number, string];

export interface SpriteFrame {
  texture: THREE.CanvasTexture;
}

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

// ---------------------------------------------------------------- keeper --

/** Keeper art box: 22 x 34 art px, drawn from behind (hair, back of the
 *  shirt, gloves as the only accent). Frames: idle A/B, run A/B, jump. */
export const KEEPER_W = 22;
export const KEEPER_H = 34;

const KEEPER_PALETTE: Record<string, string> = {
  kit: "#262b33", // dark shirt
  kit2: "#31373f", // shirt shading
  pants: "#15181d",
  skin: "#c99b71",
  hair: "#241c14",
  glove: "#38e07b",
  sock: "#1c2026",
  boot: "#0e1013",
};

/** Shared torso/head block so frames only differ in limbs. `dy` bobs it. */
function keeperCore(dy: number): Rect[] {
  return [
    // Head: hair from behind over a strip of neck.
    [8, 1 + dy, 6, 5, "hair"],
    [9, 6 + dy, 4, 1, "skin"],
    // Shirt with a lighter back panel.
    [6, 7 + dy, 10, 10, "kit"],
    [7, 8 + dy, 8, 3, "kit2"],
    // Shorts.
    [6, 17 + dy, 10, 4, "pants"],
  ];
}

const KEEPER_IDLE_A: Rect[] = [
  ...keeperCore(0),
  // Arms ready at the sides, gloves forward.
  [4, 8, 2, 8, "kit"],
  [16, 8, 2, 8, "kit"],
  [3, 15, 3, 3, "glove"],
  [16, 15, 3, 3, "glove"],
  // Legs + socks + boots.
  [7, 21, 3, 7, "kit2"],
  [12, 21, 3, 7, "kit2"],
  [7, 28, 3, 4, "sock"],
  [12, 28, 3, 4, "sock"],
  [6, 32, 4, 2, "boot"],
  [12, 32, 4, 2, "boot"],
];

const KEEPER_IDLE_B: Rect[] = [
  ...keeperCore(1),
  [4, 9, 2, 8, "kit"],
  [16, 9, 2, 8, "kit"],
  [3, 16, 3, 3, "glove"],
  [16, 16, 3, 3, "glove"],
  [7, 22, 3, 6, "kit2"],
  [12, 22, 3, 6, "kit2"],
  [7, 28, 3, 4, "sock"],
  [12, 28, 3, 4, "sock"],
  [6, 32, 4, 2, "boot"],
  [12, 32, 4, 2, "boot"],
];

/** Run frames lean the legs into a scissor; mirrored via mesh scale.x. */
const KEEPER_RUN_A: Rect[] = [
  ...keeperCore(0),
  // Trailing arm back, leading arm across.
  [3, 10, 2, 7, "kit"],
  [16, 7, 2, 7, "kit"],
  [2, 16, 3, 3, "glove"],
  [16, 13, 3, 3, "glove"],
  // Scissored legs.
  [6, 21, 3, 6, "kit2"],
  [13, 21, 3, 6, "kit2"],
  [5, 27, 3, 4, "sock"],
  [14, 27, 3, 4, "sock"],
  [4, 31, 4, 2, "boot"],
  [14, 31, 4, 2, "boot"],
];

const KEEPER_RUN_B: Rect[] = [
  ...keeperCore(0),
  [4, 7, 2, 7, "kit"],
  [15, 10, 2, 7, "kit"],
  [3, 13, 3, 3, "glove"],
  [16, 16, 3, 3, "glove"],
  [8, 21, 3, 6, "kit2"],
  [11, 21, 3, 6, "kit2"],
  [8, 27, 3, 4, "sock"],
  [11, 27, 3, 4, "sock"],
  [7, 31, 4, 2, "boot"],
  [11, 31, 4, 2, "boot"],
];

/** Jump: arms fully stretched above the head, legs tucked. Arms use the
 *  lighter kit shade so they stay readable against the night sky. */
const KEEPER_JUMP: Rect[] = [
  // Gloves and arms first so the head overlaps them.
  [4, 0, 3, 3, "glove"],
  [15, 0, 3, 3, "glove"],
  [4, 3, 3, 6, "kit2"],
  [15, 3, 3, 6, "kit2"],
  [8, 4, 6, 5, "hair"],
  [9, 9, 4, 1, "skin"],
  [6, 10, 10, 9, "kit"],
  [7, 11, 8, 3, "kit2"],
  [6, 19, 10, 4, "pants"],
  // Tucked legs.
  [6, 23, 3, 5, "kit2"],
  [13, 23, 3, 5, "kit2"],
  [6, 28, 3, 3, "sock"],
  [13, 28, 3, 3, "sock"],
  [5, 31, 4, 2, "boot"],
  [13, 31, 4, 2, "boot"],
];

export interface KeeperFrames {
  idle: THREE.CanvasTexture[];
  run: THREE.CanvasTexture[];
  jump: THREE.CanvasTexture;
}

export function buildKeeperFrames(): KeeperFrames {
  return {
    idle: [
      drawFrame(KEEPER_W, KEEPER_H, KEEPER_PALETTE, KEEPER_IDLE_A),
      drawFrame(KEEPER_W, KEEPER_H, KEEPER_PALETTE, KEEPER_IDLE_B),
    ],
    run: [
      drawFrame(KEEPER_W, KEEPER_H, KEEPER_PALETTE, KEEPER_RUN_A),
      drawFrame(KEEPER_W, KEEPER_H, KEEPER_PALETTE, KEEPER_RUN_B),
    ],
    jump: drawFrame(KEEPER_W, KEEPER_H, KEEPER_PALETTE, KEEPER_JUMP),
  };
}

// ---------------------------------------------------------------- kicker --

/** Kicker art box: 22 x 34, front view (red kit, white shorts). Frames:
 *  idle A/B, run A/B, kick (leg swung through). */
export const KICKER_W = 22;
export const KICKER_H = 34;

const KICKER_PALETTE: Record<string, string> = {
  kit: "#8c1d2f",
  kit2: "#a32639",
  shorts: "#e8e8e8",
  skin: "#c99b71",
  hair: "#241c14",
  sock: "#8c1d2f",
  boot: "#0e1013",
};

function kickerCore(dy: number): Rect[] {
  return [
    // Head with front hairline.
    [8, 1 + dy, 6, 2, "hair"],
    [8, 3 + dy, 6, 4, "skin"],
    // Shirt with a shading stripe.
    [6, 7 + dy, 10, 10, "kit"],
    [7, 8 + dy, 8, 2, "kit2"],
    // Shorts.
    [6, 17 + dy, 10, 4, "shorts"],
  ];
}

const KICKER_IDLE_A: Rect[] = [
  ...kickerCore(0),
  [4, 8, 2, 8, "kit"],
  [16, 8, 2, 8, "kit"],
  [4, 16, 2, 2, "skin"],
  [16, 16, 2, 2, "skin"],
  [7, 21, 3, 7, "skin"],
  [12, 21, 3, 7, "skin"],
  [7, 28, 3, 4, "sock"],
  [12, 28, 3, 4, "sock"],
  [6, 32, 4, 2, "boot"],
  [12, 32, 4, 2, "boot"],
];

const KICKER_IDLE_B: Rect[] = [
  ...kickerCore(1),
  [4, 9, 2, 8, "kit"],
  [16, 9, 2, 8, "kit"],
  [4, 17, 2, 2, "skin"],
  [16, 17, 2, 2, "skin"],
  [7, 22, 3, 6, "skin"],
  [12, 22, 3, 6, "skin"],
  [7, 28, 3, 4, "sock"],
  [12, 28, 3, 4, "sock"],
  [6, 32, 4, 2, "boot"],
  [12, 32, 4, 2, "boot"],
];

const KICKER_RUN_A: Rect[] = [
  ...kickerCore(0),
  [3, 10, 2, 6, "kit"],
  [16, 6, 2, 7, "kit"],
  [3, 16, 2, 2, "skin"],
  [16, 13, 2, 2, "skin"],
  [6, 21, 3, 6, "skin"],
  [13, 21, 3, 6, "skin"],
  [5, 27, 3, 4, "sock"],
  [14, 27, 3, 4, "sock"],
  [4, 31, 4, 2, "boot"],
  [14, 31, 4, 2, "boot"],
];

const KICKER_RUN_B: Rect[] = [
  ...kickerCore(0),
  [4, 6, 2, 7, "kit"],
  [15, 10, 2, 6, "kit"],
  [4, 13, 2, 2, "skin"],
  [15, 16, 2, 2, "skin"],
  [8, 21, 3, 6, "skin"],
  [11, 21, 3, 6, "skin"],
  [8, 27, 3, 4, "sock"],
  [11, 27, 3, 4, "sock"],
  [7, 31, 4, 2, "boot"],
  [11, 31, 4, 2, "boot"],
];

/** Kick: right leg swung high through the ball, arms opened for balance. */
const KICKER_KICK: Rect[] = [
  ...kickerCore(0),
  // Arms flung opposite ways.
  [2, 7, 3, 2, "kit"],
  [1, 9, 2, 5, "kit"],
  [17, 9, 3, 2, "kit"],
  [19, 11, 2, 5, "skin"],
  // Planted left leg.
  [7, 21, 3, 7, "skin"],
  [7, 28, 3, 4, "sock"],
  [6, 32, 4, 2, "boot"],
  // Kicking leg swung up-forward.
  [12, 20, 4, 3, "skin"],
  [15, 17, 4, 3, "skin"],
  [18, 15, 3, 3, "sock"],
  [19, 12, 3, 3, "boot"],
];

export interface KickerFrames {
  idle: THREE.CanvasTexture[];
  run: THREE.CanvasTexture[];
  kick: THREE.CanvasTexture;
}

export function buildKickerFrames(): KickerFrames {
  return {
    idle: [
      drawFrame(KICKER_W, KICKER_H, KICKER_PALETTE, KICKER_IDLE_A),
      drawFrame(KICKER_W, KICKER_H, KICKER_PALETTE, KICKER_IDLE_B),
    ],
    run: [
      drawFrame(KICKER_W, KICKER_H, KICKER_PALETTE, KICKER_RUN_A),
      drawFrame(KICKER_W, KICKER_H, KICKER_PALETTE, KICKER_RUN_B),
    ],
    kick: drawFrame(KICKER_W, KICKER_H, KICKER_PALETTE, KICKER_KICK),
  };
}

// ---------------------------------------------------------- world textures --

/** Pixel grass: mowing bands plus per-tile noise, tiled over the pitch. */
export function buildGrassTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const bands = ["#1a5e37", "#175433"];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = bands[i % 2];
    ctx.fillRect(0, i * 8, size, 8);
  }
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(Math.floor(Math.random() * size), Math.floor(Math.random() * size), 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** One person in the tribune crowd, fixed per seat so the two animation
 *  frames only differ in posture (some fans bob up 1 px). */
interface Fan {
  x: number;
  row: number;
  shirt: string;
  skin: string;
  bouncy: boolean;
}

// Muted, night-dimmed clothing/skin so the crowd stays background texture.
const FAN_SHIRTS = ["#232d40", "#33202a", "#1f342d", "#2e2921", "#242138", "#3a3d44", "#4a1622"];
const FAN_SKINS = ["#6e5540", "#5c4230", "#4c3422", "#7a6048"];

/** Seat the crowd once; both frames are drawn from the same fans. */
export function buildCrowd(width: number): Fan[] {
  const fans: Fan[] = [];
  for (let row = 0; row < 5; row++) {
    for (let x = 2 + Math.floor(Math.random() * 3); x < width - 3; x += 3 + Math.floor(Math.random() * 2)) {
      if (Math.random() < 0.22) continue; // empty seats
      fans.push({
        x,
        row,
        shirt: FAN_SHIRTS[Math.floor(Math.random() * FAN_SHIRTS.length)],
        skin: FAN_SKINS[Math.floor(Math.random() * FAN_SKINS.length)],
        bouncy: Math.random() < 0.35,
      });
    }
  }
  return fans;
}

/** Tribune band with rows of pixel fans (head + shirt). `frame` toggles the
 *  bouncy fans one pixel up so the crowd feels alive. */
export function buildTribuneTexture(fans: Fan[], frame: number): THREE.CanvasTexture {
  const w = 384;
  const h = 56;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0a0f1c");
  g.addColorStop(1, "#131f36");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Tier ledges behind each row of fans.
  for (let row = 0; row < 5; row++) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(0, 12 + row * 9 + 7, w, 1);
  }

  for (const fan of fans) {
    const bob = fan.bouncy && frame === 1 ? -1 : 0;
    const y = 12 + fan.row * 9 + bob;
    ctx.fillStyle = fan.skin;
    ctx.fillRect(fan.x, y, 2, 2);
    ctx.fillStyle = fan.shirt;
    ctx.fillRect(fan.x - 1, y + 2, 4, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** White field lines painted onto a transparent overlay laid on the grass:
 *  goal line, goal area, penalty box, spot and arc. Sized in meters via the
 *  caller; art is 1 px per 10 cm. */
export function buildLinesTexture(widthM: number, depthM: number): THREE.CanvasTexture {
  const scale = 10;
  const w = Math.round(widthM * scale);
  const h = Math.round(depthM * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const line = 1.2 * scale * 0.1; // ~12 cm wide lines
  ctx.fillStyle = "rgba(232, 240, 232, 0.9)";

  const rect = (x0: number, z0: number, x1: number, z1: number) => {
    // Hollow rectangle from goal-line coords (meters): x lateral, z depth.
    const px0 = cx + x0 * scale;
    const px1 = cx + x1 * scale;
    const pz0 = z0 * scale;
    const pz1 = z1 * scale;
    ctx.fillRect(px0, pz0, px1 - px0, line);
    ctx.fillRect(px0, pz1 - line, px1 - px0, line);
    ctx.fillRect(px0, pz0, line, pz1 - pz0);
    ctx.fillRect(px1 - line, pz0, line, pz1 - pz0);
  };

  // Goal line across the whole overlay.
  ctx.fillRect(0, 0, w, line);
  // Goal area (5.5 m) and penalty box (16.5 m, clipped by the overlay).
  rect(-9.16, 0, 9.16, 5.5);
  rect(-20.16, 0, 20.16, 16.5);
  // Penalty spot.
  ctx.fillRect(cx - 2, 11 * scale - 2, 4, 4);
  // Penalty arc.
  ctx.beginPath();
  ctx.arc(cx, 11 * scale, 9.15 * scale, Math.PI * 0.25, Math.PI * 0.75);
  ctx.lineWidth = line;
  ctx.strokeStyle = "rgba(232, 240, 232, 0.9)";
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Chunky retro ball texture wrapped around the sphere. */
export function buildBallTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#20232a";
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * 8 + (i >= 4 ? 4 : 0);
    const y = i >= 4 ? 20 : 6;
    ctx.fillRect(x, y, 4, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
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
