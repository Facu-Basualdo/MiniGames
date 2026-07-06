import * as THREE from "three";
import { getDotTexture } from "./dotTexture";

/**
 * Fire-and-forget additive spark pool (warning chispas, dash trail, death
 * embers). Purely cosmetic — never touches gameplay state. Positions live in
 * world space; dead particles are parked far off-screen. Additive material has
 * no per-point alpha, so a particle fades by scaling its displayed colour
 * (`color = baseColor * lifeFraction`) toward black each frame.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly count: number;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array; // displayed (faded) colour
  private readonly base: Float32Array; // undimmed source colour
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private cursor = 0;

  constructor(count = 400) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.gravity = new Float32Array(count);
    for (let i = 0; i < count; i++) this.positions[i * 3 + 2] = -999; // parked

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      map: getDotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /**
   * Emits `n` sparks from (x,y). `up` biases the burst upward (fountain of
   * chispas); otherwise it is radial. `speed` is the max initial speed.
   */
  burst(
    x: number,
    y: number,
    n: number,
    opts: { speed?: number; color?: THREE.Color; gravity?: number; up?: number } = {},
  ): void {
    const speed = opts.speed ?? 6;
    const color = opts.color ?? new THREE.Color(0xffb45a);
    const grav = opts.gravity ?? 18;
    const up = opts.up ?? 0;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.positions[i * 3] = x + (Math.random() - 0.5) * 0.2;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = 0;
      this.vx[i] = Math.cos(ang) * sp;
      this.vy[i] = Math.sin(ang) * sp + up;
      this.gravity[i] = grav;
      const l = 0.35 + Math.random() * 0.45;
      this.life[i] = l;
      this.maxLife[i] = l;
      this.base[i * 3] = color.r;
      this.base[i * 3 + 1] = color.g;
      this.base[i * 3 + 2] = color.b;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 2] = -999;
        this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
        continue;
      }
      this.vy[i] -= this.gravity[i] * dt;
      this.positions[i * 3] += this.vx[i] * dt;
      this.positions[i * 3 + 1] += this.vy[i] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.colors[i * 3] = this.base[i * 3] * f;
      this.colors[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.colors[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  reset(): void {
    for (let i = 0; i < this.count; i++) {
      this.life[i] = 0;
      this.positions[i * 3 + 2] = -999;
      this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
