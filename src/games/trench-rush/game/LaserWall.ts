import * as THREE from "three";

// Trench extents.
const FIELD_X = 9;
const FIELD_FLOOR = -6;
const FIELD_TOP = 12;

// Gap (safe opening) half-size.
const GAP_HALF_W = 2.3;
const GAP_HALF_H = 2.3;

const HIT_PAD = 0.6; // wall thickness in Z for the swept collision
const PLAYER_MARGIN = 0.55; // the ship must be this far inside the gap to pass unharmed

const BAR_COLOR = 0xff2a2a; // red laser grid
const FRAME_COLOR = 0x00f0ff; // cyan frame around the opening → signals "fly here"
const BAR_R = 0.07;

/**
 * A wall of lasers spanning the whole trench cross-section, with a rectangular gap the ship
 * must fly through. Built as a red laser grid (vertical + horizontal bars) that is cut open at
 * the gap, framed by a bright cyan rectangle. Scrolls toward the ship; cannot be shot.
 */
export class LaserWall {
  readonly object: THREE.Group;
  readonly gapX: number;
  readonly gapY: number;

  private prevZ: number;
  private pulse = Math.random() * Math.PI * 2;
  private readonly barMat: THREE.MeshBasicMaterial;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(gapX: number, gapY: number, z: number) {
    this.gapX = gapX;
    this.gapY = gapY;
    this.object = new THREE.Group();
    this.object.position.z = z;
    this.prevZ = z;

    this.barMat = new THREE.MeshBasicMaterial({ color: BAR_COLOR });
    this.disposables.push(this.barMat);

    this.build();
  }

  get z(): number {
    return this.object.position.z;
  }

  update(dt: number, scrollSpeed: number): void {
    this.prevZ = this.object.position.z;
    this.object.position.z += scrollSpeed * dt;

    this.pulse += dt * 12;
    this.barMat.opacity = 0.75 + Math.sin(this.pulse) * 0.25;
    this.barMat.transparent = true;
  }

  /** Swept hit test: hit unless the ship passed through the gap (with a safety margin). */
  hits(px: number, py: number, pz: number): boolean {
    const zLo = Math.min(this.prevZ, this.object.position.z) - HIT_PAD;
    const zHi = Math.max(this.prevZ, this.object.position.z) + HIT_PAD;
    if (pz < zLo || pz > zHi) return false;

    const insideGap =
      Math.abs(px - this.gapX) < GAP_HALF_W - PLAYER_MARGIN &&
      Math.abs(py - this.gapY) < GAP_HALF_H - PLAYER_MARGIN;
    return !insideGap;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.object);
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private build(): void {
    const gapL = this.gapX - GAP_HALF_W;
    const gapR = this.gapX + GAP_HALF_W;
    const gapB = this.gapY - GAP_HALF_H;
    const gapT = this.gapY + GAP_HALF_H;

    // Vertical grid bars, cut where they cross the gap.
    for (let vx = -FIELD_X; vx <= FIELD_X + 0.001; vx += 3) {
      if (vx > gapL && vx < gapR) {
        // Split around the opening.
        this.addVBar(vx, FIELD_FLOOR, gapB);
        this.addVBar(vx, gapT, FIELD_TOP);
      } else {
        this.addVBar(vx, FIELD_FLOOR, FIELD_TOP);
      }
    }

    // Horizontal grid bars, cut where they cross the gap.
    for (let hy = FIELD_FLOOR; hy <= FIELD_TOP + 0.001; hy += 3) {
      if (hy > gapB && hy < gapT) {
        this.addHBar(hy, -FIELD_X, gapL);
        this.addHBar(hy, gapR, FIELD_X);
      } else {
        this.addHBar(hy, -FIELD_X, FIELD_X);
      }
    }

    // Bright cyan frame around the opening.
    this.addFrame(gapL, gapR, gapB, gapT);
  }

  private addVBar(x: number, y0: number, y1: number): void {
    const len = y1 - y0;
    if (len <= 0.05) return;
    const geom = new THREE.CylinderGeometry(BAR_R, BAR_R, len, 6);
    this.disposables.push(geom);
    const bar = new THREE.Mesh(geom, this.barMat);
    bar.position.set(x, (y0 + y1) / 2, 0);
    this.object.add(bar);
  }

  private addHBar(y: number, x0: number, x1: number): void {
    const len = x1 - x0;
    if (len <= 0.05) return;
    const geom = new THREE.CylinderGeometry(BAR_R, BAR_R, len, 6);
    geom.rotateZ(Math.PI / 2);
    this.disposables.push(geom);
    const bar = new THREE.Mesh(geom, this.barMat);
    bar.position.set((x0 + x1) / 2, y, 0);
    this.object.add(bar);
  }

  private addFrame(x0: number, x1: number, y0: number, y1: number): void {
    const frameMat = new THREE.MeshBasicMaterial({ color: FRAME_COLOR });
    this.disposables.push(frameMat);
    const r = 0.12;
    const w = x1 - x0;
    const h = y1 - y0;

    const hGeom = new THREE.CylinderGeometry(r, r, w, 8);
    hGeom.rotateZ(Math.PI / 2);
    const vGeom = new THREE.CylinderGeometry(r, r, h, 8);
    this.disposables.push(hGeom, vGeom);

    const bottom = new THREE.Mesh(hGeom, frameMat);
    bottom.position.set((x0 + x1) / 2, y0, 0);
    const top = new THREE.Mesh(hGeom, frameMat);
    top.position.set((x0 + x1) / 2, y1, 0);
    const left = new THREE.Mesh(vGeom, frameMat);
    left.position.set(x0, (y0 + y1) / 2, 0);
    const right = new THREE.Mesh(vGeom, frameMat);
    right.position.set(x1, (y0 + y1) / 2, 0);
    this.object.add(bottom, top, left, right);
  }
}
