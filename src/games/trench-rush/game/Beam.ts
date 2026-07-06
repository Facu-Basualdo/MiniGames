import * as THREE from "three";

export type BeamOrientation = "vertical" | "horizontal";

// Trench extents (walls inner at x = ±9, floor top y = -6, wall top y = 12).
const FIELD_X = 9;
const FIELD_FLOOR = -6;
const FIELD_TOP = 12;
const SPAN = FIELD_TOP - FIELD_FLOOR; // 18, also equals full width 2*FIELD_X
const MID_Y = (FIELD_FLOOR + FIELD_TOP) / 2; // 3

const CORE_COLOR = 0xff2a2a;
const HALO_COLOR = 0xff7a4a;
const EMITTER_COLOR = 0xffd23a;

const HIT_PAD = 0.5; // beam thickness in Z for the swept collision
const HIT_HALF_AXIS = 0.85; // how close (in the beam's perpendicular axis) counts as a hit
const SWEEP_SPEED = 1.8; // rad/s for moving beams

/**
 * An energy beam that spans the whole trench along one axis and scrolls toward the ship.
 * A "vertical" beam is a floor-to-ceiling bar at a fixed X (dodge left/right); a "horizontal"
 * beam is a wall-to-wall bar at a fixed Y (dodge up/down). It cannot be shot — only dodged.
 *
 * The axis position lives on the group so a "sweeping" beam can slide along its perpendicular
 * axis (a horizontal beam moving up and down). `sweepAmp = 0` gives a static beam.
 */
export class Beam {
  readonly object: THREE.Group;
  readonly orientation: BeamOrientation;
  private readonly baseAxis: number;
  private readonly sweepAmp: number;
  private sweepPhase = Math.random() * Math.PI * 2;

  private prevZ: number;
  private pulse = Math.random() * Math.PI * 2;
  private readonly coreMat: THREE.MeshBasicMaterial;
  private readonly haloMat: THREE.MeshBasicMaterial;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(orientation: BeamOrientation, axisPos: number, z: number, sweepAmp = 0) {
    this.orientation = orientation;
    this.baseAxis = axisPos;
    this.sweepAmp = sweepAmp;
    this.object = new THREE.Group();
    this.object.position.z = z;
    // The axis position lives on the group (X for vertical, Y for horizontal) so it can move.
    if (orientation === "vertical") this.object.position.x = axisPos;
    else this.object.position.y = axisPos;
    this.prevZ = z;

    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE_COLOR });
    this.haloMat = new THREE.MeshBasicMaterial({
      color: HALO_COLOR,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.disposables.push(this.coreMat, this.haloMat);

    this.build();
  }

  get z(): number {
    return this.object.position.z;
  }

  private currentAxis(): number {
    return this.orientation === "vertical" ? this.object.position.x : this.object.position.y;
  }

  update(dt: number, scrollSpeed: number): void {
    this.prevZ = this.object.position.z;
    this.object.position.z += scrollSpeed * dt;

    // Sweeping beams slide along their perpendicular axis (moving up/down or side to side).
    if (this.sweepAmp > 0) {
      this.sweepPhase += dt * SWEEP_SPEED;
      const off = Math.sin(this.sweepPhase) * this.sweepAmp;
      if (this.orientation === "vertical") this.object.position.x = this.baseAxis + off;
      else this.object.position.y = this.baseAxis + off;
    }

    // Pulse the glow so it reads as live, dangerous energy.
    this.pulse += dt * 14;
    const s = 0.8 + Math.sin(this.pulse) * 0.2;
    this.coreMat.opacity = s;
    this.coreMat.transparent = true;
    this.haloMat.opacity = 0.18 + s * 0.2;
  }

  /**
   * Swept hit test: true if the ship at (px, py, pz) crossed the beam this frame.
   * Uses the beam's previous and current Z so a fast scroll can't tunnel the ship through it.
   */
  hits(px: number, py: number, pz: number): boolean {
    const zLo = Math.min(this.prevZ, this.object.position.z) - HIT_PAD;
    const zHi = Math.max(this.prevZ, this.object.position.z) + HIT_PAD;
    if (pz < zLo || pz > zHi) return false;

    const axis = this.currentAxis();
    if (this.orientation === "vertical") {
      return Math.abs(px - axis) < HIT_HALF_AXIS;
    }
    return Math.abs(py - axis) < HIT_HALF_AXIS;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.object);
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private build(): void {
    const coreGeom = new THREE.CylinderGeometry(0.16, 0.16, SPAN, 10);
    const haloGeom = new THREE.CylinderGeometry(0.42, 0.42, SPAN, 12);
    this.disposables.push(coreGeom, haloGeom);

    const core = new THREE.Mesh(coreGeom, this.coreMat);
    const halo = new THREE.Mesh(haloGeom, this.haloMat);

    // Endpoints (local space) where the beam anchors to the trench surfaces.
    let endA: THREE.Vector3;
    let endB: THREE.Vector3;

    if (this.orientation === "vertical") {
      // Cylinder is along Y by default: floor-to-ceiling bar (group carries the X position).
      core.position.set(0, MID_Y, 0);
      halo.position.set(0, MID_Y, 0);
      endA = new THREE.Vector3(0, FIELD_FLOOR, 0);
      endB = new THREE.Vector3(0, FIELD_TOP, 0);
    } else {
      // Rotate to lie along X: wall-to-wall bar (group carries the Y position).
      core.rotation.z = Math.PI / 2;
      halo.rotation.z = Math.PI / 2;
      endA = new THREE.Vector3(-FIELD_X, 0, 0);
      endB = new THREE.Vector3(FIELD_X, 0, 0);
    }

    this.object.add(core, halo);

    // Bright emitter nodes at each end, embedded in the trench surface.
    const emitterGeom = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const emitterMat = new THREE.MeshBasicMaterial({ color: EMITTER_COLOR });
    this.disposables.push(emitterGeom, emitterMat);
    for (const p of [endA, endB]) {
      const em = new THREE.Mesh(emitterGeom, emitterMat);
      em.position.copy(p);
      this.object.add(em);
    }
  }
}
