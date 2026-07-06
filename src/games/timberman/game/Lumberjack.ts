import * as THREE from "three";
import { toon, outlined } from "./materials";
import { CHOP_ANIM_TIME, PLAYER_SIDE_X } from "./constants";
import type { Side } from "./Tree";

function makeCheckeredTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  // Base vibrant red
  ctx.fillStyle = "#cf3b34";
  ctx.fillRect(0, 0, 64, 64);

  // Plaid cross pattern (dark red stripes)
  ctx.fillStyle = "#8a1e1a";
  ctx.fillRect(0, 16, 64, 16);
  ctx.fillRect(0, 48, 64, 16);
  ctx.fillRect(16, 0, 16, 64);
  ctx.fillRect(48, 0, 16, 64);

  // Intersection squares (black)
  ctx.fillStyle = "#1e0807";
  ctx.fillRect(16, 16, 16, 16);
  ctx.fillRect(48, 16, 16, 16);
  ctx.fillRect(16, 48, 16, 16);
  ctx.fillRect(48, 48, 16, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const skin = toon(0xf1c396);

// Dynamic checkered flannel texture & material for the shirt
const toonGradient = new THREE.DataTexture(new Uint8Array([90, 160, 215, 255]), 4, 1, THREE.RedFormat);
toonGradient.minFilter = THREE.NearestFilter;
toonGradient.magFilter = THREE.NearestFilter;
toonGradient.needsUpdate = true;

const shirtTex = makeCheckeredTexture();
const shirtMat = new THREE.MeshToonMaterial({
  map: shirtTex,
  gradientMap: toonGradient
});

const belt = toon(0x3a2414);
const pants = toon(0x38507f);
const boots = toon(0x2a1c12);
const beanie = toon(0x2f7d4f);
const pom = toon(0xf4f1e6);
const beard = toon(0x6b4a2a);
const wood = toon(0x8a5a2b);
const steel = toon(0xd6dde3);

/** Cartoon lumberjack built from toon+outlined primitives, with a chop swing. */
export class Lumberjack {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly axeArm = new THREE.Group();
  private side: Side = "left";
  private chopTime = 0;

  constructor() {
    // Legs + boots.
    for (const z of [-0.17, 0.17]) {
      const leg = outlined(new THREE.BoxGeometry(0.26, 0.5, 0.28), pants);
      leg.position.set(0, 0.32, z);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.36), boots);
      boot.position.set(0.04, 0.08, z);
      boot.castShadow = true;
      this.body.add(leg, boot);
    }

    const torso = outlined(new THREE.BoxGeometry(0.66, 0.62, 0.52), shirtMat);
    torso.position.y = 0.86;
    const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.56), belt);
    beltMesh.position.y = 0.57;
    beltMesh.castShadow = true;
    this.body.add(torso, beltMesh);

    // Arms (front arm swings with the axe).
    const backArm = outlined(new THREE.BoxGeometry(0.2, 0.5, 0.2), shirtMat);
    backArm.position.set(-0.02, 0.86, -0.42);
    backArm.rotation.x = -0.2;
    this.body.add(backArm);

    // Head, beard, beanie.
    const head = outlined(new THREE.SphereGeometry(0.31, 20, 16), skin);
    head.position.y = 1.4;

    // Bushy lumberjack beard & mustache
    const beardGroup = new THREE.Group();
    const chinBeard = outlined(new THREE.BoxGeometry(0.38, 0.44, 0.38), beard, 1.12);
    chinBeard.position.set(0.06, 1.12, 0);
    const mustache = outlined(new THREE.BoxGeometry(0.15, 0.12, 0.40), beard, 1.14);
    mustache.position.set(0.2, 1.28, 0);
    beardGroup.add(chinBeard, mustache);

    const cap = outlined(new THREE.SphereGeometry(0.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), beanie);
    cap.position.y = 1.52;
    const pomMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), pom);
    pomMesh.position.y = 1.88;
    pomMesh.castShadow = true;
    this.body.add(head, beardGroup, cap, pomMesh);

    // Axe on a pivot near the shoulder so it can swing toward the trunk.
    const handle = outlined(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 8), wood, 1.12);
    handle.position.y = 0.55;
    const blade = outlined(new THREE.BoxGeometry(0.12, 0.44, 0.34), steel, 1.1);
    blade.position.set(0.02, 1.08, 0.19);
    const foreArm = outlined(new THREE.BoxGeometry(0.2, 0.46, 0.2), shirtMat);
    foreArm.position.set(0, 0.2, 0);
    this.axeArm.add(handle, blade, foreArm);
    this.axeArm.position.set(0.12, 0.78, 0.4);
    this.body.add(this.axeArm);

    this.group.add(this.body);
    this.setSide("left", true);
  }

  reset(): void {
    this.chopTime = 0;
    this.setSide("left", true);
  }

  get currentSide(): Side {
    return this.side;
  }

  /** Move to a side (mirrored to face the trunk) and start the chop swing. */
  chop(side: Side): void {
    this.setSide(side, false);
    this.chopTime = CHOP_ANIM_TIME;
  }

  private setSide(side: Side, instant: boolean): void {
    this.side = side;
    const dir = side === "left" ? -1 : 1;
    this.group.position.x = dir * PLAYER_SIDE_X;
    // Mirror the model so the axe always faces the trunk (toward center).
    this.group.scale.x = -dir;
    if (instant) this.chopTime = 0;
  }

  update(dt: number): void {
    if (this.chopTime > 0) this.chopTime = Math.max(0, this.chopTime - dt);
    // Swing the axe from raised (t=1) to struck (t=0).
    const t = CHOP_ANIM_TIME > 0 ? this.chopTime / CHOP_ANIM_TIME : 0;
    this.axeArm.rotation.z = -0.15 - t * 1.5;
    this.body.rotation.z = t * 0.1;
  }
}
