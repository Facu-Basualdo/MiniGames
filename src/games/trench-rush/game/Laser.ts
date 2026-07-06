import * as THREE from "three";
import { LASER_SPEED, ENEMY_LASER_SPEED } from "./constants";

const MODEL_AXIS = new THREE.Vector3(0, 0, 1); // cylinder points along +Z after rotateX
const FORWARD = new THREE.Vector3(0, 0, -1); // player default: straight down the corridor

export class Laser {
  readonly object: THREE.Mesh;
  readonly isEnemy: boolean;
  private readonly velocity = new THREE.Vector3();
  private readonly length: number;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  /**
   * @param dir Optional travel direction (does not need to be normalized). Defaults to
   *   straight forward (-Z) so player shots keep their old behaviour; enemies pass an
   *   aim vector toward the ship so their fire actually threatens the player.
   */
  constructor(scene: THREE.Scene, x: number, y: number, z: number, isEnemy = false, dir?: THREE.Vector3) {
    this.isEnemy = isEnemy;
    const speed = isEnemy ? ENEMY_LASER_SPEED : LASER_SPEED;

    const direction = (dir ? dir.clone() : FORWARD.clone()).normalize();
    this.velocity.copy(direction).multiplyScalar(speed);

    // Enemy shots are thicker, longer and brighter (with an outer halo) so they read clearly
    // as incoming danger against the busy trench; player shots stay slim.
    this.length = isEnemy ? 2.6 : 2.0;
    const coreR = isEnemy ? 0.14 : 0.045;

    const geom = new THREE.CylinderGeometry(coreR, coreR, this.length, 8);
    geom.rotateX(Math.PI / 2); // point along +Z axis
    this.disposables.push(geom);

    const mat = new THREE.MeshBasicMaterial({
      color: isEnemy ? 0xff5a1e : 0x00f0ff,
    });
    this.disposables.push(mat);

    this.object = new THREE.Mesh(geom, mat);
    this.object.position.set(x, y, z);
    // Orient the beam along its travel direction (bloom pass supplies the glow, no PointLight needed).
    this.object.quaternion.setFromUnitVectors(MODEL_AXIS, direction);

    // Outer glow halo for enemy shots.
    if (isEnemy) {
      const haloGeom = new THREE.CylinderGeometry(0.32, 0.32, this.length * 1.1, 8);
      haloGeom.rotateX(Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xff8a3a,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(haloGeom, haloMat);
      this.object.add(new THREE.Mesh(haloGeom, haloMat));
    }

    scene.add(this.object);
  }

  update(dt: number): void {
    this.object.position.addScaledVector(this.velocity, dt);
  }

  get x(): number { return this.object.position.x; }
  get y(): number { return this.object.position.y; }
  get z(): number { return this.object.position.z; }

  /**
   * Collision check against a spherical target at (tx, ty, tz) with a given radius.
   */
  collidesWith(tx: number, ty: number, tz: number, radius: number): boolean {
    // Check if laser is close in X and Y
    const dx = this.object.position.x - tx;
    const dy = this.object.position.y - ty;
    const distSq = dx * dx + dy * dy;

    // Laser radius + target radius
    const maxDist = radius + 0.15;
    if (distSq > maxDist * maxDist) return false;

    // Check Z overlap along the laser length (Z ± length/2)
    const zMin = this.object.position.z - this.length / 2;
    const zMax = this.object.position.z + this.length / 2;

    return tz >= zMin - radius && tz <= zMax + radius;
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.object);
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
