import * as THREE from "three";
import {
  PLAYER_MOVE_SPEED,
  PLAYER_SMOOTHING,
  PLAYER_Z,
} from "./constants";
import { clamp } from "./mathUtils";

// Movement bounds inside the trench
const MAX_X = 7.8; // Trench walls are at x = ±9.0 (leaves room for wings)
const MIN_Y = -5.0; // Floor is at y = -6.0
const MAX_Y = 8.5; // Top of walls is at y = 12.0

const HULL_COLOR = 0x222630; // gunmetal carbon hull
const COCKPIT_COLOR = 0x00f0ff; // electric cyan canopy
const ENGINE_COLOR = 0x00f0ff; // engine glow

function makeHullMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: HULL_COLOR,
    metalness: 0.85,
    roughness: 0.3,
  });
}

/**
 * The player's ship: A Star-Wars-style starfighter with long nose, swept wings,
 * wingtip cannons and glowing engines.
 */
export class Player {
  readonly object: THREE.Group;

  private velX = 0;
  private velY = 0;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  
  // local coordinate of left and right wingtip cannons for firing lasers
  readonly weaponPorts = [
    new THREE.Vector3(-1.15, 0.02, -0.9), // Left cannon port
    new THREE.Vector3(1.15, 0.02, -0.9),  // Right cannon port
  ];
  private readonly portScratch = [new THREE.Vector3(), new THREE.Vector3()];

  constructor() {
    this.object = new THREE.Group();
    this.build();
    this.object.position.z = PLAYER_Z;
    this.object.scale.setScalar(0.9);
  }

  get x(): number {
    return this.object.position.x;
  }

  get y(): number {
    return this.object.position.y;
  }

  get z(): number {
    return this.object.position.z;
  }

  /** World-space positions of the wingtip weapon ports (for shooting lasers). */
  getWeaponPorts(): THREE.Vector3[] {
    this.object.updateMatrixWorld();
    for (let i = 0; i < this.weaponPorts.length; i++) {
      this.portScratch[i].copy(this.weaponPorts[i]);
      this.object.localToWorld(this.portScratch[i]);
    }
    return this.portScratch;
  }

  reset(): void {
    this.velX = 0;
    this.velY = 0;
    this.object.position.set(0, 0, PLAYER_Z);
    this.object.rotation.set(0, 0, 0);
  }

  update(dt: number, dirX: number, dirY: number): void {
    const targetVX = dirX * PLAYER_MOVE_SPEED;
    const targetVY = dirY * PLAYER_MOVE_SPEED;
    const k = Math.min(1, PLAYER_SMOOTHING * dt);
    this.velX += (targetVX - this.velX) * k;
    this.velY += (targetVY - this.velY) * k;

    this.object.position.x = clamp(this.object.position.x + this.velX * dt, -MAX_X, MAX_X);
    this.object.position.y = clamp(this.object.position.y + this.velY * dt, MIN_Y, MAX_Y);

    // Roll/bank on turn, pitch on vertical movement
    this.object.rotation.z = clamp(-this.velX / PLAYER_MOVE_SPEED, -1, 1) * 0.45;
    this.object.rotation.x = clamp(this.velY / PLAYER_MOVE_SPEED, -1, 1) * 0.3;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private build(): void {
    const hullMat = makeHullMaterial();
    this.disposables.push(hullMat);

    // Fuselage
    const bodyGeom = new THREE.CylinderGeometry(0.24, 0.28, 1.1, 10);
    bodyGeom.rotateX(Math.PI / 2);
    this.disposables.push(bodyGeom);
    const body = new THREE.Mesh(bodyGeom, hullMat);
    body.position.set(0, 0, 0.15);
    this.object.add(body);

    // Pointed Nose
    const noseGeom = new THREE.ConeGeometry(0.24, 1.0, 10);
    noseGeom.rotateX(-Math.PI / 2);
    this.disposables.push(noseGeom);
    const nose = new THREE.Mesh(noseGeom, hullMat);
    nose.position.set(0, 0, -0.9);
    this.object.add(nose);

    // Tail engine sleeve
    const tailGeom = new THREE.CylinderGeometry(0.28, 0.2, 0.3, 10);
    tailGeom.rotateX(Math.PI / 2);
    this.disposables.push(tailGeom);
    const tail = new THREE.Mesh(tailGeom, hullMat);
    tail.position.set(0, 0, 0.85);
    this.object.add(tail);

    // Cockpit canopy
    const canopyGeom = new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    canopyGeom.scale(1, 0.65, 1.6);
    this.disposables.push(canopyGeom);
    const canopyMat = new THREE.MeshBasicMaterial({ color: COCKPIT_COLOR, transparent: true, opacity: 0.6 });
    this.disposables.push(canopyMat);
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.18, -0.15);
    this.object.add(canopy);

    // Twin engine ports at the back
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x0c0f12 });
    const glowMat = new THREE.MeshBasicMaterial({ color: ENGINE_COLOR, transparent: true, opacity: 0.55 });
    this.disposables.push(nozzleMat, glowMat);

    for (const nx of [-0.12, 0.12]) {
      const ringGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.18, 10, 1, true);
      ringGeom.rotateX(Math.PI / 2);
      this.disposables.push(ringGeom);
      const ring = new THREE.Mesh(ringGeom, nozzleMat);
      ring.position.set(nx, 0, 1.0);
      this.object.add(ring);

      const coreGeom = new THREE.CircleGeometry(0.08, 10);
      this.disposables.push(coreGeom);
      const core = new THREE.Mesh(coreGeom, glowMat);
      core.position.set(nx, 0, 1.06);
      this.object.add(core);
    }

    // Wings
    this.addWing(1);
    this.addWing(-1);

    // Forward headlight
    const headlight = new THREE.PointLight(0xa5f3ff, 35, 75, 2);
    headlight.position.set(0, 0.2, -5.0);
    this.object.add(headlight);
  }

  private addWing(side: number): void {
    const hullMat = makeHullMaterial();
    this.disposables.push(hullMat);

    // Left/Right wing mesh
    const wingGeom = new THREE.BoxGeometry(1.1, 0.04, 0.65);
    const pos = wingGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x > 0.48) {
        pos.setZ(i, pos.getZ(i) * 0.35 + 0.25);
      }
    }
    pos.needsUpdate = true;
    wingGeom.computeVertexNormals();
    this.disposables.push(wingGeom);

    const wing = new THREE.Mesh(wingGeom, hullMat);
    wing.position.set(side * 0.75, -0.01, 0.3);
    wing.rotation.y = side * -0.15; // swept back angle
    wing.rotation.z = side * 0.1;  // wing angle upward (dihedral)
    this.object.add(wing);

    // Wingtip cannon
    const cannonGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8);
    cannonGeom.rotateX(Math.PI / 2);
    this.disposables.push(cannonGeom);
    const cannon = new THREE.Mesh(cannonGeom, hullMat);
    cannon.position.set(side * 1.25, 0.02, -0.3);
    this.object.add(cannon);

    // Cannon tip muzzle glow
    const tipMat = new THREE.MeshBasicMaterial({ color: ENGINE_COLOR, transparent: true, opacity: 0.7 });
    this.disposables.push(tipMat);
    const tipGeom = new THREE.SphereGeometry(0.06, 6, 6);
    this.disposables.push(tipGeom);
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.position.set(side * 1.25, 0.02, -0.95);
    this.object.add(tip);
  }
}
