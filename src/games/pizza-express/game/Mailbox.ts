import * as THREE from "three";
import { toonMat, glowMat } from "./toon";
import {
  MAILBOX_X,
  COLOR_TOMATO,
  COLOR_CHEESE,
  COLOR_PEPPERONI,
  COLOR_CREAM,
  COLOR_CRUST,
} from "./constants";

/**
 * A roadside mailbox — a delivery customer. While `pending` it floats a glowing
 * pizza order marker; a thrown pizza that reaches it delivers (flag flips up,
 * marker pops). If it passes the scooter undelivered it is `missed` (breaks the
 * combo). Built from primitives, cel-shaded.
 */
export class Mailbox {
  readonly group = new THREE.Group();
  readonly side: -1 | 1;
  pending = true;
  missed = false;

  private readonly marker: THREE.Group;
  private readonly flag: THREE.Mesh;
  private bob = 0;
  private flagAngle = -1.2; // down while pending, flips up on delivery
  private readonly targetScratch = new THREE.Vector3();

  constructor(side: -1 | 1, z: number) {
    this.side = side;
    this.group.position.set(side * MAILBOX_X, 0, z);
    // The box opening faces the road, so it visually "catches" the pizza.
    this.group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;

    // Post.
    this.group.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.0, 8), toonMat(COLOR_CRUST, {}), 0, 0.5, 0));
    // Box body (rounded top via a half-cylinder).
    this.group.add(mesh(new THREE.BoxGeometry(0.34, 0.34, 0.6), toonMat(COLOR_CREAM, {}), 0, 1.05, 0));
    const dome = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 12, 1, false, 0, Math.PI), toonMat(COLOR_CREAM, {}), 0, 1.22, 0);
    dome.rotation.z = Math.PI / 2;
    this.group.add(dome);
    // Front number plate.
    this.group.add(mesh(new THREE.PlaneGeometry(0.24, 0.18), glowMat(COLOR_TOMATO, 1), 0, 1.05, 0.31));

    // Signal flag (red), starts down.
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), toonMat(COLOR_TOMATO, { side: THREE.DoubleSide }));
    this.flag.position.set(0.19, 1.1, 0);
    this.flag.geometry.translate(0.12, 0, 0); // pivot at the post edge
    this.group.add(this.flag);

    this.marker = this.buildMarker();
    this.marker.position.set(0, 2.0, 0);
    this.group.add(this.marker);
    this.applyFlag();
  }

  get z(): number {
    return this.group.position.z;
  }

  /** World-space point a pizza should land on (the box), for homing + delivery. */
  target(): THREE.Vector3 {
    this.group.updateMatrixWorld();
    this.targetScratch.set(0, 1.05, 0);
    this.group.localToWorld(this.targetScratch);
    return this.targetScratch;
  }

  update(dz: number, dt: number): void {
    this.group.position.z += dz;
    if (this.pending) {
      this.bob += dt * 3;
      this.marker.position.y = 2.0 + Math.sin(this.bob) * 0.12;
      this.marker.rotation.y += dt * 1.4;
    } else if (this.flagAngle < 0.55) {
      // Snap the flag up on delivery.
      this.flagAngle = Math.min(0.55, this.flagAngle + dt * 6);
      this.applyFlag();
    }
  }

  deliver(): void {
    this.pending = false;
    this.marker.visible = false;
  }

  markMissed(): void {
    this.pending = false;
    this.missed = true;
    this.marker.visible = false;
  }

  private applyFlag(): void {
    this.flag.rotation.z = this.flagAngle;
  }

  private buildMarker(): THREE.Group {
    const g = new THREE.Group();
    // A little floating pizza: a cheese disc with pepperoni.
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 20), glowMat(COLOR_CHEESE, 1));
    g.add(disc);
    const crust = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 20), toonMat(COLOR_CRUST, {}));
    crust.rotation.x = Math.PI / 2;
    g.add(crust);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), glowMat(COLOR_PEPPERONI, 1));
      p.position.set(Math.cos(a) * 0.15, 0.03, Math.sin(a) * 0.15);
      g.add(p);
    }
    // Bouncing "!" beacon post so it reads from far as a target.
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), glowMat(COLOR_TOMATO, 0.6, true));
    beam.position.y = -0.42;
    g.add(beam);
    return g;
  }
}

function mesh(geom: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z);
  return m;
}
