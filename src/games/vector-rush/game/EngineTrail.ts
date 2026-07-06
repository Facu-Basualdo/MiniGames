import * as THREE from "three";
import { getDotTexture } from "./dotTexture";

const MAX_PARTICLES = 640;
const EMIT_PER_PORT = 2; // particles spawned per engine port each frame (thicker trail)
const LIFETIME = 1.2; // seconds (increased to 1.2s to leave a beautiful trail mapping the ship's path)
const BASE_COLOR = new THREE.Color(0x3ea7e0); // soft electric blue exhaust

/**
 * A GPU-light additive particle exhaust streaming behind the ship's engines.
 * Particles live in world space (the ship stays at z=0 while the world scrolls),
 * so they read as a trail the ship leaves behind. Fades via per-vertex color on
 * an additive point cloud (no per-particle alpha needed).
 */
export class EngineTrail {
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      map: getDotTexture(),
      size: 0.14, // increased from 0.06 for a thicker, more visible trail
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

  /** Advances live particles and emits fresh ones from each engine port. */
  update(dt: number, ports: THREE.Vector3[], travelSpeed: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.colors[k] = this.colors[k + 1] = this.colors[k + 2] = 0;
        continue;
      }
      this.positions[k] += this.velocities[k] * dt;
      this.positions[k + 1] += this.velocities[k + 1] * dt;
      this.positions[k + 2] += this.velocities[k + 2] * dt;
      const f = this.life[i] / LIFETIME;
      this.colors[k] = BASE_COLOR.r * f;
      this.colors[k + 1] = BASE_COLOR.g * f;
      this.colors[k + 2] = BASE_COLOR.b * f;
    }

    // Exhaust streams backward (+Z) matching the world flow (travelSpeed), leaving the trail stationary in the tunnel.
    for (const port of ports) {
      for (let e = 0; e < EMIT_PER_PORT; e++) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % MAX_PARTICLES;
        const k = i * 3;
        this.positions[k] = port.x + (Math.random() * 2 - 1) * 0.03;
        this.positions[k + 1] = port.y + (Math.random() * 2 - 1) * 0.03;
        this.positions[k + 2] = port.z + 0.18 + Math.random() * 0.06; // added offset (+0.18) to push trail origin behind nozzle rims
        this.velocities[k] = (Math.random() * 2 - 1) * 0.18; // slightly tighter horizontal dispersion
        this.velocities[k + 1] = (Math.random() * 2 - 1) * 0.18; // slightly tighter vertical dispersion
        this.velocities[k + 2] = travelSpeed + (Math.random() * 2 - 1) * 0.5; // match game speed to keep trail fixed in world space
        this.life[i] = LIFETIME;
        this.colors[k] = BASE_COLOR.r;
        this.colors[k + 1] = BASE_COLOR.g;
        this.colors[k + 2] = BASE_COLOR.b;
      }
    }

    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
