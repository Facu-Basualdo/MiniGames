import * as THREE from "three";
import { toonMat, glowMat } from "./toon";
import {
  COLOR_CHEESE,
  COLOR_CARDBOARD,
  COLOR_CRUST,
  COLOR_CREAM,
  COLOR_FOLIAGE,
  COLOR_TOMATO,
} from "./constants";

export type ObstacleKind = "cone" | "pothole" | "trashcan" | "crate" | "car" | "dog";

/** Half the collision width of each kind (world units). Cars are wide walls. */
const HALF_WIDTH: Record<ObstacleKind, number> = {
  cone: 0.34,
  pothole: 0.62,
  trashcan: 0.42,
  crate: 0.52,
  car: 1.35,
  dog: 0.5,
};

/**
 * One road hazard. All kinds are instant-death on contact. Each is a small prop
 * built from primitives (cel-shaded), positioned on the road and scrolling toward
 * the camera. `halfWidth` is its collision half-extent in X.
 */
export class Obstacle {
  readonly group = new THREE.Group();
  readonly kind: ObstacleKind;
  readonly halfWidth: number;
  resolved = false;
  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  private wobble = 0;

  constructor(kind: ObstacleKind, x: number, z: number) {
    this.kind = kind;
    this.halfWidth = HALF_WIDTH[kind];
    this.group.position.set(x, 0, z);
    this.build();
  }

  get z(): number {
    return this.group.position.z;
  }

  update(dz: number, dt: number): void {
    this.group.position.z += dz;
    if (this.kind === "dog") {
      // The dog bounces angrily in place.
      this.wobble += dt * 12;
      this.group.position.y = Math.abs(Math.sin(this.wobble)) * 0.12;
    }
  }

  /** True if the scooter at scooterX overlaps this hazard in X. */
  overlaps(scooterX: number, scooterHalf: number, tolerance: number): boolean {
    return Math.abs(scooterX - this.group.position.x) < this.halfWidth + scooterHalf - tolerance;
  }

  private mesh(geom: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    this.disposables.push(geom, mat);
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  private build(): void {
    switch (this.kind) {
      case "cone": {
        this.mesh(new THREE.ConeGeometry(0.3, 0.6, 14), toonMat(0xe8622a, {}), 0, 0.3, 0);
        this.mesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), toonMat(0x2a2320, {}), 0, 0.03, 0);
        this.mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), glowMat(COLOR_CREAM, 1), 0, 0.36, 0).rotation.x = Math.PI / 2;
        break;
      }
      case "pothole": {
        // A flat dark patch on the asphalt with a broken-edge ring.
        const hole = this.mesh(new THREE.CircleGeometry(0.6, 22), toonMat(0x15110d, {}), 0, 0.02, 0);
        hole.rotation.x = -Math.PI / 2;
        const ring = this.mesh(new THREE.RingGeometry(0.55, 0.7, 22), toonMat(0x2f2822, {}), 0, 0.015, 0);
        ring.rotation.x = -Math.PI / 2;
        break;
      }
      case "trashcan": {
        this.mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.8, 14), toonMat(0x5a6b52, {}), 0, 0.4, 0);
        this.mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 14), toonMat(COLOR_FOLIAGE, {}), 0, 0.84, 0);
        break;
      }
      case "crate": {
        // A toppled stack of pizza boxes.
        this.mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), toonMat(COLOR_CARDBOARD, {}), 0, 0.12, 0);
        this.mesh(new THREE.BoxGeometry(0.82, 0.2, 0.82), toonMat(COLOR_CREAM, {}), 0.1, 0.34, -0.05).rotation.y = 0.4;
        this.mesh(new THREE.CircleGeometry(0.16, 16), glowMat(COLOR_CHEESE, 1), 0.1, 0.45, -0.05).rotation.x = -Math.PI / 2;
        break;
      }
      case "car": {
        const color = [0x3f7fae, 0x8a5ea8, 0x6b8f3a][Math.floor(Math.random() * 3)];
        this.mesh(new THREE.BoxGeometry(2.4, 0.7, 1.5), toonMat(color, {}), 0, 0.55, 0);
        this.mesh(new THREE.BoxGeometry(1.5, 0.6, 1.35), toonMat(color, {}), -0.1, 1.05, 0);
        // Windshields.
        this.mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2), glowMat(0x2a3a44, 0.9), -0.1, 1.06, 0);
        for (const wx of [-0.8, 0.8]) {
          for (const wz of [-0.72, 0.72]) {
            const wheel = this.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), toonMat(0x1c1712, {}), wx, 0.3, wz);
            wheel.rotation.x = Math.PI / 2;
          }
        }
        // Warm brake lights facing the player.
        for (const lx of [-1.0, 1.0]) this.mesh(new THREE.BoxGeometry(0.2, 0.16, 0.06), glowMat(COLOR_TOMATO, 1), lx, 0.6, 0.78);
        break;
      }
      case "dog": {
        const body = toonMat(COLOR_CRUST, {});
        this.mesh(new THREE.CapsuleGeometry(0.22, 0.5, 5, 8), body, 0, 0.45, 0).rotation.z = Math.PI / 2;
        this.mesh(new THREE.SphereGeometry(0.22, 12, 10), body, -0.42, 0.55, 0);
        // Snout + angry glowing eyes.
        this.mesh(new THREE.BoxGeometry(0.2, 0.14, 0.16), toonMat(0x5a3a1e, {}), -0.6, 0.5, 0);
        for (const ez of [-0.09, 0.09]) this.mesh(new THREE.SphereGeometry(0.04, 8, 8), glowMat(COLOR_TOMATO, 1), -0.5, 0.62, ez);
        for (const lx of [-0.3, 0.3]) for (const lz of [-0.14, 0.14]) this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 6), body, lx, 0.16, lz);
        this.mesh(new THREE.CapsuleGeometry(0.05, 0.24, 4, 6), body, 0.42, 0.6, 0).rotation.z = -0.7;
        break;
      }
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

export { HALF_WIDTH };
