import * as THREE from "three";
import { Laser } from "./Laser";
import { SoundEffects } from "./SoundEffects";

const HIT_FLASH_TIME = 0.12;
const AIM_SPREAD = 0.12; // aim spread so drone shots are dodgeable

// Drones use a hostile red/orange emissive so they pop (via the bloom pass) against the bright
// white trench walls instead of camouflaging into them. The damage flash rides on
// emissiveIntensity so it does not clobber that base glow.
const EMISSIVE_BASE = 0.35;
const EMISSIVE_FLASH = 2.6;

// Drones are scaled up so they read as clear threats from a distance. The collision radius is
// scaled by the same factor so the hitbox matches the visible mesh.
const DRONE_SCALE = 2.1;

/**
 * A flying enemy drone (TIE-fighter style): scrolls with the world while also flying toward
 * the ship, weaving side to side, and firing aimed shots. Destroyed with one hit.
 */
export class Enemy {
  readonly object: THREE.Group;
  health = 1;
  readonly radius = 0.8 * DRONE_SCALE;
  alive = true;

  // Weaving movement
  private readonly centerX: number;
  private waveTime: number;
  private readonly waveFreq = 2.4;
  private readonly waveAmp = 3.2;
  private relativeSpeedZ = 16; // speed toward the player on top of the world scroll

  // Shooting
  private fireTimer: number;
  private readonly fireInterval: number;

  // Damage feedback (emissive flash when hit)
  private hitFlash = 0;
  private readonly hitMats: THREE.MeshStandardMaterial[] = [];

  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(x: number, y: number, z: number, difficulty = 0) {
    this.object = new THREE.Group();
    this.object.position.set(x, y, z);
    this.object.scale.setScalar(DRONE_SCALE);

    this.centerX = x;
    this.waveTime = Math.random() * Math.PI * 2; // randomized starting phase

    // Drones get more aggressive as difficulty climbs: they fire faster and close in quicker.
    const d = Math.max(0, difficulty);
    this.fireInterval = (1.4 + Math.random() * 0.4) / (1 + d * 0.45);
    this.fireTimer = Math.random() * this.fireInterval;
    this.relativeSpeedZ = 16 + d * 7;

    this.build();
  }

  update(dt: number, scrollSpeed: number, playerPos: THREE.Vector3): Laser | null {
    this.fireTimer += dt;

    // Decay the damage flash (rides emissiveIntensity over the base hostile glow).
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const e = Math.max(0, this.hitFlash) / HIT_FLASH_TIME;
      const inten = EMISSIVE_BASE + e * (EMISSIVE_FLASH - EMISSIVE_BASE);
      for (const m of this.hitMats) m.emissiveIntensity = inten;
    }

    // Scroll with the world AND fly forward toward the player, weaving side-to-side.
    this.object.position.z += (scrollSpeed + this.relativeSpeedZ) * dt;
    this.waveTime += dt;
    this.object.position.x = this.centerX + Math.sin(this.waveTime * this.waveFreq) * this.waveAmp;

    // Shooting: only when in front of the player (z < 0) and not too far.
    if (this.fireTimer >= this.fireInterval) {
      this.fireTimer = 0;
      const relativeZ = this.object.position.z;
      if (relativeZ < 0 && relativeZ > -140) {
        SoundEffects.playEnemyLaser();

        const originX = this.object.position.x;
        const originY = this.object.position.y;
        const originZ = this.object.position.z + 1.0;

        // Aim at the player's current position with a small spread so it stays dodgeable.
        const dir = new THREE.Vector3(
          playerPos.x - originX,
          playerPos.y - originY,
          playerPos.z - originZ,
        ).normalize();
        dir.x += (Math.random() - 0.5) * AIM_SPREAD;
        dir.y += (Math.random() - 0.5) * AIM_SPREAD;

        return new Laser(this.object.parent as THREE.Scene, originX, originY, originZ, true, dir);
      }
    }

    return null;
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
      color: 0xffffff, // clean white hull
      emissive: 0xffffff, // subtle self-lit glow so it stays brighter than the walls (pops via bloom)
      emissiveIntensity: EMISSIVE_BASE,
      metalness: 0.35,
      roughness: 0.45,
    });
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff1133 }); // menacing neon red cockpit window
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.9, roughness: 0.2 }); // dark panels contrast the white body
    this.disposables.push(hullMat, redEyeMat, solarMat);
    this.hitMats.push(hullMat);

    // Ball cockpit
    const sphereGeom = new THREE.SphereGeometry(0.38, 12, 12);
    this.disposables.push(sphereGeom);
    const sphere = new THREE.Mesh(sphereGeom, hullMat);
    this.object.add(sphere);

    // Glowing amber cockpit window (eye) facing forward (-Z)
    const eyeGeom = new THREE.CircleGeometry(0.16, 10);
    this.disposables.push(eyeGeom);
    const eye = new THREE.Mesh(eyeGeom, redEyeMat);
    eye.position.set(0, 0, -0.39);
    eye.rotation.y = Math.PI;
    this.object.add(eye);

    // Wing struts + TIE-fighter style panels (left and right)
    for (const side of [-1, 1]) {
      const strutGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6);
      strutGeom.rotateZ(Math.PI / 2);
      this.disposables.push(strutGeom);

      const strut = new THREE.Mesh(strutGeom, hullMat);
      strut.position.set(side * 0.45, 0, 0);
      this.object.add(strut);

      const wingGeom = new THREE.BoxGeometry(0.05, 1.3, 0.95);
      this.disposables.push(wingGeom);
      const wing = new THREE.Mesh(wingGeom, solarMat);
      wing.position.set(side * 0.78, 0, 0);
      this.object.add(wing);

      // Panel rims (thick edges)
      const rimGeom = new THREE.BoxGeometry(0.08, 1.36, 0.1);
      this.disposables.push(rimGeom);
      const rimFront = new THREE.Mesh(rimGeom, hullMat);
      rimFront.position.set(side * 0.78, 0, 0.45);
      const rimBack = new THREE.Mesh(rimGeom, hullMat);
      rimBack.position.set(side * 0.78, 0, -0.45);
      this.object.add(rimFront, rimBack);
    }
  }
}
