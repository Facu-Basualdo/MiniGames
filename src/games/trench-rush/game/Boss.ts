import * as THREE from "three";
import { Laser } from "./Laser";
import { SoundEffects } from "./SoundEffects";

const MAX_HEALTH = 24;
const HOLD_Z = -46; // hovers this far ahead of the ship
const APPROACH_SPEED = 26; // units/s while flying in to its holding position
const STRAFE_AMP_X = 5.5;
const STRAFE_AMP_Y = 2.0;
const BASE_Y = 1.5;
const FIRE_INTERVAL = 1.7;

const HIT_FLASH_TIME = 0.1;
const EMISSIVE_BASE = 0.35;
const EMISSIVE_FLASH = 2.6;

/**
 * A boss capital ship: flies in, holds station ahead of the player, strafes, and fires aimed
 * volleys. Takes many hits (`MAX_HEALTH`) before it goes down. Its lasers are ordinary enemy
 * lasers pushed into the game's laser pool, so they reuse the existing laser-vs-player collision.
 */
export class Boss {
  readonly object: THREE.Group;
  readonly radius = 3.2;
  health: number;
  readonly maxHealth: number;
  alive = true;

  private t = 0;
  private fireTimer = 0;
  private hitFlash = 0;
  private readonly hitMats: THREE.MeshStandardMaterial[] = [];
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(z: number, difficulty = 0) {
    // Later bosses are tankier.
    this.maxHealth = MAX_HEALTH + Math.floor(Math.max(0, difficulty) * 9);
    this.health = this.maxHealth;
    this.object = new THREE.Group();
    this.object.position.set(0, BASE_Y, z);
    this.build();
  }

  get healthFrac(): number {
    return Math.max(0, this.health) / this.maxHealth;
  }

  update(dt: number, playerPos: THREE.Vector3): Laser[] {
    this.t += dt;

    // Decay the damage flash.
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const e = Math.max(0, this.hitFlash) / HIT_FLASH_TIME;
      const inten = EMISSIVE_BASE + e * (EMISSIVE_FLASH - EMISSIVE_BASE);
      for (const m of this.hitMats) m.emissiveIntensity = inten;
    }

    // Fly in to the holding Z, then strafe in place.
    const dz = HOLD_Z - this.object.position.z;
    const step = Math.sign(dz) * Math.min(Math.abs(dz), APPROACH_SPEED * dt);
    this.object.position.z += step;

    this.object.position.x = Math.sin(this.t * 1.3) * STRAFE_AMP_X;
    this.object.position.y = BASE_Y + Math.sin(this.t * 2.1 + 1) * STRAFE_AMP_Y;
    this.object.rotation.z = -Math.cos(this.t * 1.3) * 0.2; // bank into the strafe

    // Fire aimed volleys once it has (roughly) reached its station.
    const lasers: Laser[] = [];
    if (Math.abs(dz) < 8) {
      this.fireTimer += dt;
      if (this.fireTimer >= FIRE_INTERVAL) {
        this.fireTimer = 0;
        SoundEffects.playEnemyLaser();
        for (const off of [-2.4, 0, 2.4]) {
          const ox = this.object.position.x + off;
          const oy = this.object.position.y - 0.3;
          const oz = this.object.position.z + 2.6;
          const dir = new THREE.Vector3(
            playerPos.x - ox,
            playerPos.y - oy,
            playerPos.z - oz,
          ).normalize();
          lasers.push(new Laser(this.object.parent as THREE.Scene, ox, oy, oz, true, dir));
        }
      }
    }

    return lasers;
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    this.hitFlash = HIT_FLASH_TIME;
    if (this.health <= 0) {
      this.alive = false;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.object);
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private build(): void {
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x7b2ff0, // electric purple, distinct from the red drones
      emissive: 0x3a0f8a, // base glow so the silhouette reads against the white trench
      emissiveIntensity: 0.55,
      metalness: 0.5,
      roughness: 0.45,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff2fd0, // magenta accents that flash on damage
      emissive: 0xff2fd0,
      emissiveIntensity: EMISSIVE_BASE,
      metalness: 0.5,
      roughness: 0.4,
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x9dffff }); // glowing cyan-white weak-point core
    this.disposables.push(hullMat, accentMat, coreMat);
    this.hitMats.push(accentMat);

    // Central hull (wide, angular command ship)
    const bodyGeom = new THREE.BoxGeometry(4.2, 1.6, 3.0);
    this.disposables.push(bodyGeom);
    const body = new THREE.Mesh(bodyGeom, hullMat);
    this.object.add(body);

    // Forward prow
    const prowGeom = new THREE.ConeGeometry(1.1, 2.4, 4);
    prowGeom.rotateX(-Math.PI / 2);
    prowGeom.rotateZ(Math.PI / 4);
    this.disposables.push(prowGeom);
    const prow = new THREE.Mesh(prowGeom, hullMat);
    prow.position.set(0, 0, -2.2);
    this.object.add(prow);

    // Glowing core (the eye-catching weak point) on the front face
    const coreGeom = new THREE.SphereGeometry(0.7, 16, 16);
    this.disposables.push(coreGeom);
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.set(0, 0, -1.4);
    this.object.add(core);

    // Red accent strips along the hull
    for (const side of [-1, 1]) {
      const stripGeom = new THREE.BoxGeometry(0.3, 0.5, 3.0);
      this.disposables.push(stripGeom);
      const strip = new THREE.Mesh(stripGeom, accentMat);
      strip.position.set(side * 1.7, 0.4, 0);
      this.object.add(strip);

      // Side weapon pods
      const podGeom = new THREE.CylinderGeometry(0.5, 0.6, 2.0, 8);
      podGeom.rotateX(Math.PI / 2);
      this.disposables.push(podGeom);
      const pod = new THREE.Mesh(podGeom, hullMat);
      pod.position.set(side * 2.5, -0.3, -0.5);
      this.object.add(pod);

      // Pod muzzle glow
      const muzzleGeom = new THREE.SphereGeometry(0.22, 8, 8);
      this.disposables.push(muzzleGeom);
      const muzzle = new THREE.Mesh(muzzleGeom, accentMat);
      muzzle.position.set(side * 2.5, -0.3, -1.5);
      this.object.add(muzzle);
    }

    // Top fin
    const finGeom = new THREE.BoxGeometry(0.3, 1.4, 1.8);
    this.disposables.push(finGeom);
    const fin = new THREE.Mesh(finGeom, hullMat);
    fin.position.set(0, 1.2, 0.4);
    this.object.add(fin);
  }
}
