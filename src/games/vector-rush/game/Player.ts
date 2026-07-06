import * as THREE from "three";
import {
  FIELD_HALF_HEIGHT,
  FIELD_HALF_WIDTH,
  PLAYER_HALF_HEIGHT,
  PLAYER_HALF_WIDTH,
  PLAYER_MOVE_SPEED,
  PLAYER_SMOOTHING,
  PLAYER_Z,
} from "./constants";
import { clamp } from "./mathUtils";

const MAX_X = FIELD_HALF_WIDTH - PLAYER_HALF_WIDTH;
const MAX_Y = FIELD_HALF_HEIGHT - PLAYER_HALF_HEIGHT;

// Ship look: gunmetal hull (lit) with subtle steel panel lines, a tinted-glass
// canopy and amber charged cannons — a grounded star-fighter palette, no neon.
const HULL_COLOR = 0x1d212a; // sleek carbon-black / dark titanium
// const EDGE_COLOR = 0x6f7f8c; 
const COCKPIT_COLOR = 0x1db3d8; // electric cyan-blue canopy
const ENGINE_COLOR = 0x00f3ff; // electric cyan muzzle glow (unifies ship energy theme)

function makeHullMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: HULL_COLOR,
    metalness: 0.90, // higher metalness for premium look
    roughness: 0.28, // lower roughness for sharp glossy reflections
  });
}

/**
 * The player's ship: a Star-Wars-style star fighter (long pointed fuselage,
 * swept wings, wingtip cannons and glowing engines) rendered in the neon
 * vector style. The nose points into the screen (-Z).
 */
export class Player {
  readonly object: THREE.Group;

  private velX = 0;
  private velY = 0;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private readonly enginePortsLocal = [
    new THREE.Vector3(-0.13, 0, 1.06),
    new THREE.Vector3(0.13, 0, 1.06),
  ];
  private readonly portScratch = [new THREE.Vector3(), new THREE.Vector3()];

  constructor() {
    this.object = new THREE.Group();
    this.build();
    this.object.position.z = PLAYER_Z;
    // The whole ship models slightly larger than its collision box; scale it to
    // sit comfortably inside the field.
    this.object.scale.setScalar(0.9);
  }

  get x(): number {
    return this.object.position.x;
  }

  get y(): number {
    return this.object.position.y;
  }

  /** World-space positions of the engine exhaust ports (for the particle trail). */
  enginePorts(): THREE.Vector3[] {
    this.object.updateMatrixWorld();
    for (let i = 0; i < this.enginePortsLocal.length; i++) {
      this.portScratch[i].copy(this.enginePortsLocal[i]);
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
    this.object.position.y = clamp(this.object.position.y + this.velY * dt, -MAX_Y, MAX_Y);

    // Bank into the turn and pitch with vertical motion for a lively feel.
    this.object.rotation.z = clamp(-this.velX / PLAYER_MOVE_SPEED, -1, 1) * 0.5;
    this.object.rotation.x = clamp(this.velY / PLAYER_MOVE_SPEED, -1, 1) * 0.35;
  }

  /** Builds the composite ship model out of primitives. */
  private build(): void {
    const hullMat = makeHullMaterial();
    this.disposables.push(hullMat);

    // --- Fuselage: a cylindrical body plus a long pointed nose. ---
    const bodyGeom = new THREE.CylinderGeometry(0.26, 0.3, 1.1, 12);
    bodyGeom.rotateX(Math.PI / 2);
    this.addPart(bodyGeom, hullMat, 0, 0, 0.15);

    const noseGeom = new THREE.ConeGeometry(0.26, 1.0, 12);
    noseGeom.rotateX(-Math.PI / 2);
    this.addPart(noseGeom, hullMat, 0, 0, -0.9);

    const tailGeom = new THREE.CylinderGeometry(0.3, 0.22, 0.3, 12);
    tailGeom.rotateX(Math.PI / 2);
    this.addPart(tailGeom, hullMat, 0, 0, 0.85);

    // --- Cockpit canopy on top, near the front. ---
    const canopyGeom = new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    canopyGeom.scale(1, 0.7, 1.7);
    const canopyMat = new THREE.MeshBasicMaterial({ color: COCKPIT_COLOR, transparent: true, opacity: 0.5 });
    this.disposables.push(canopyMat);
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.2, -0.15);
    this.object.add(canopy);
    this.addEdges(canopyGeom, 0.15);

    // --- Swept wings (mirrored). ---
    this.addWing(1);
    this.addWing(-1);

    // --- Twin engine nozzles glowing at the rear (visible from the chase cam). ---
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x081014 });
    this.disposables.push(nozzleMat);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff, // electric cyan nozzle interior glow
      transparent: true,
      opacity: 0.4, // low opacity to keep it subtle and prevent washing out details
      side: THREE.DoubleSide,
    });
    this.disposables.push(glowMat);
    for (const nx of [-0.13, 0.13]) {
      const ringGeom = new THREE.CylinderGeometry(0.13, 0.15, 0.18, 14, 1, true);
      ringGeom.rotateX(Math.PI / 2);
      this.disposables.push(ringGeom);
      const ring = new THREE.Mesh(ringGeom, nozzleMat);
      ring.position.set(nx, 0, 1.0);
      this.object.add(ring);
      this.addEdges(ringGeom, undefined, ring.position);

      const coreGeom = new THREE.CircleGeometry(0.085, 16);
      this.disposables.push(coreGeom);
      const core = new THREE.Mesh(coreGeom, glowMat);
      core.position.set(nx, 0, 1.06);
      this.object.add(core);
    }

    // Forward-facing headlight so approaching obstacles emerge lit from the dark.
    // Moved further forward (-6.0) so it lights the tunnel ahead without over-exposing the ship's fuselage.
    const headlight = new THREE.PointLight(0x9fe0ff, 45, 60, 2);
    headlight.position.set(0, 0.4, -6.0);
    this.object.add(headlight);
    // Small engine glow lighting the ship's own tail (dimmed from 2 to 0.25 to prevent washing out the metal panel edges).
    const engineLight = new THREE.PointLight(0xdff0ff, 0.25, 3, 2);
    engineLight.position.set(0, 0, 1.2);
    this.object.add(engineLight);
  }

  /** A swept wing on the given side (+1 right, -1 left) with a wingtip cannon. */
  private addWing(side: number): void {
    const hullMat = makeHullMaterial();
    this.disposables.push(hullMat);

    // Flat tapered wing: a thin box swept back and out.
    const wingGeom = new THREE.BoxGeometry(1.15, 0.05, 0.7);
    // Taper the leading tip by nudging its far vertices inward (chord shrink).
    const pos = wingGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x > 0.5) {
        // outer edge: shrink chord and sweep back
        pos.setZ(i, pos.getZ(i) * 0.35 + 0.28);
      }
    }
    pos.needsUpdate = true;
    wingGeom.computeVertexNormals();

    const wing = new THREE.Mesh(wingGeom, hullMat);
    wing.position.set(side * 0.78, -0.02, 0.35);
    wing.rotation.y = side * -0.18; // slight backward sweep
    wing.rotation.z = side * 0.12; // slight dihedral
    this.object.add(wing);
    this.addEdgesTransformed(wingGeom, wing);

    // Wingtip cannon: a long thin barrel pointing forward.
    const cannonGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8);
    cannonGeom.rotateX(Math.PI / 2);
    const cannon = new THREE.Mesh(cannonGeom, hullMat);
    cannon.position.set(side * 1.28, 0.02, -0.35);
    this.object.add(cannon);
    this.addEdges(cannonGeom, undefined, cannon.position);

    // Cannon muzzle tip glow.
    const tipMat = new THREE.MeshBasicMaterial({ color: ENGINE_COLOR, transparent: true, opacity: 0.7, depthWrite: false });
    this.disposables.push(tipMat);
    const tipGeom = new THREE.SphereGeometry(0.07, 8, 8);
    this.disposables.push(tipGeom);
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.position.set(side * 1.28, 0.02, -1.0);
    this.object.add(tip);
  }

  /** Adds a mesh part plus its neon wireframe edges. */
  private addPart(geom: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    this.object.add(mesh);
    this.disposables.push(geom);
    this.addEdges(geom, undefined, mesh.position);
  }

  /** Neon edge overlay for a geometry, positioned to match its mesh. */
  private addEdges(_geom: THREE.BufferGeometry, _thresholdAngle = 20, _position?: THREE.Vector3): void {
    // Disabled to remove messy segment lines and keep the ship model clean & facherita.
  }

  /** Neon edges that copy a mesh's full transform (for rotated wings). */
  private addEdgesTransformed(_geom: THREE.BufferGeometry, _mesh: THREE.Mesh): void {
    // Disabled to remove messy segment lines and keep the ship model clean & facherita.
  }
}
