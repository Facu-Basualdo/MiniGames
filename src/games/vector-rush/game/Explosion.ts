import * as THREE from "three";
import { getDotTexture } from "./dotTexture";

const MAX = 160;
const LIFETIME = 0.75;
const HOT = new THREE.Color(0xfff2c0); // fireball core
const COOL = new THREE.Color(0xff5a1e); // ember edge

/**
 * A one-shot particle fireball for the crash. Additive point cloud that bursts
 * outward from a point and fades — the visual "juice" ported in spirit from the
 * event pulses in penalty-keeper / barra-libre.
 */
export class Explosion {
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.velocities = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      map: getDotTexture(),
      size: 0.9,
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

  reset(): void {
    this.life.fill(0);
    this.colors.fill(0);
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Fires the whole fireball outward from (x,y,z). */
  burst(x: number, y: number, z: number): void {
    for (let i = 0; i < MAX; i++) {
      const k = i * 3;
      // Random direction on a sphere, varied speed.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 4 + Math.random() * 12;
      this.positions[k] = x;
      this.positions[k + 1] = y;
      this.positions[k + 2] = z;
      this.velocities[k] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[k + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.velocities[k + 2] = Math.cos(phi) * speed * 0.6;
      this.life[i] = LIFETIME * (0.6 + Math.random() * 0.4);
      this.colors[k] = HOT.r;
      this.colors[k + 1] = HOT.g;
      this.colors[k + 2] = HOT.b;
    }
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      dirty = true;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.colors[k] = this.colors[k + 1] = this.colors[k + 2] = 0;
        continue;
      }
      this.positions[k] += this.velocities[k] * dt;
      this.positions[k + 1] += this.velocities[k + 1] * dt;
      this.positions[k + 2] += this.velocities[k + 2] * dt;
      // Drag so the fireball slows as it expands.
      this.velocities[k] *= 0.96;
      this.velocities[k + 1] *= 0.96;
      this.velocities[k + 2] *= 0.96;
      const f = this.life[i] / LIFETIME;
      const c = COOL.clone().lerp(HOT, f); // cools from white-hot to ember
      this.colors[k] = c.r * f;
      this.colors[k + 1] = c.g * f;
      this.colors[k + 2] = c.b * f;
    }
    if (dirty) {
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
