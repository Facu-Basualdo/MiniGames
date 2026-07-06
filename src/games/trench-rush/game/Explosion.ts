import * as THREE from "three";
import { getDotTexture } from "./dotTexture";

const PARTICLE_COUNT = 45;
const LIFETIME = 0.65;
const HOT = new THREE.Color(0xfff5d0); // white-hot core
const COOL = new THREE.Color(0xff4510); // amber edge

class ExplosionInstance {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  alive = true;

  constructor(scene: THREE.Scene, x: number, y: number, z: number) {
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.colors = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);
    this.life = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const k = i * 3;
      // Spherical expansion with random angles
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 3 + Math.random() * 10;

      this.positions[k] = x;
      this.positions[k + 1] = y;
      this.positions[k + 2] = z;

      this.velocities[k] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[k + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.velocities[k + 2] = Math.cos(phi) * speed * 0.75; // slightly flattened along Z for visuals

      this.life[i] = LIFETIME * (0.4 + Math.random() * 0.6);

      this.colors[k] = HOT.r;
      this.colors[k + 1] = HOT.g;
      this.colors[k + 2] = HOT.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      map: getDotTexture(),
      size: 0.8,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt: number, scene: THREE.Scene): void {
    let anyAlive = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (this.life[i] <= 0) continue;
      anyAlive = true;

      this.life[i] -= dt;
      const k = i * 3;

      if (this.life[i] <= 0) {
        this.colors[k] = this.colors[k + 1] = this.colors[k + 2] = 0;
        continue;
      }

      this.positions[k] += this.velocities[k] * dt;
      this.positions[k + 1] += this.velocities[k + 1] * dt;
      this.positions[k + 2] += this.velocities[k + 2] * dt;

      // Drag
      this.velocities[k] *= 0.94;
      this.velocities[k + 1] *= 0.94;
      this.velocities[k + 2] *= 0.94;

      const f = this.life[i] / LIFETIME;
      const c = COOL.clone().lerp(HOT, f);
      this.colors[k] = c.r * f;
      this.colors[k + 1] = c.g * f;
      this.colors[k + 2] = c.b * f;
    }

    if (anyAlive) {
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    } else {
      this.alive = false;
      this.destroy(scene);
    }
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

export class Explosion {
  private readonly scene: THREE.Scene;
  private readonly instances: ExplosionInstance[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(x: number, y: number, z: number): void {
    this.instances.push(new ExplosionInstance(this.scene, x, y, z));
  }

  update(dt: number): void {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      inst.update(dt, this.scene);
      if (!inst.alive) {
        this.instances.splice(i, 1);
      }
    }
  }

  reset(): void {
    for (const inst of this.instances) {
      inst.destroy(this.scene);
    }
    this.instances.length = 0;
  }

  dispose(): void {
    this.reset();
  }
}
