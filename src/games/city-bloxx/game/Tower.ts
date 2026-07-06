import {
  BASE_X,
  COLLAPSE_MAX_ANGLE,
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  GROUND_TOP,
  MAX_LEAN,
  PERFECT_OFFSET,
  WOBBLE_DAMP,
  WOBBLE_FREQ,
  WOBBLE_IMPULSE,
} from "./constants";

export interface Floor {
  /** Horizontal center of the floor (world units). */
  x: number;
  /** World Y of the floor's top edge. */
  topY: number;
}

export interface PlaceResult {
  ok: boolean;
  /** Signed horizontal offset from the floor below (+ = to the right). */
  offset: number;
  /** How much the floor overlaps its support; <= 0 means it fell off. */
  overlap: number;
  /** True when the drop landed inside PERFECT_OFFSET and snapped clean. */
  perfect: boolean;
}

/**
 * The stacked building. Floors are full width and stack straight up; the
 * challenge is balance: the whole tower tilts around its base by an angle
 * driven by the center of mass, and topples when that drifts past the base
 * footprint. Placing a floor off-center also kicks a damped wobble.
 */
export class Tower {
  readonly floors: Floor[] = [];

  /** Transient tilt from the post-drop spring (rad). */
  private wobble = 0;
  private wobbleVel = 0;

  /** Set once the tower has toppled; drives the collapse animation. */
  private collapsing = false;
  private collapseAngle = 0;
  private collapseVel = 0;

  reset(): void {
    this.floors.length = 0;
    this.wobble = 0;
    this.wobbleVel = 0;
    this.collapsing = false;
    this.collapseAngle = 0;
    this.collapseVel = 0;
  }

  get count(): number {
    return this.floors.length;
  }

  /** The floor (or foundation) a new block lands on top of. */
  private refX(): number {
    const top = this.floors[this.floors.length - 1];
    return top ? top.x : BASE_X;
  }

  private refTopY(): number {
    const top = this.floors[this.floors.length - 1];
    return top ? top.topY : GROUND_TOP;
  }

  /** World Y of the top edge a newly placed floor will occupy. */
  landingTopY(): number {
    return this.refTopY() - FLOOR_HEIGHT;
  }

  /** Top surface currently exposed (where the next block lands). */
  topSurfaceY(): number {
    return this.refTopY();
  }

  /** The most recently placed floor, or undefined on an empty site. */
  topFloor(): Floor | undefined {
    return this.floors[this.floors.length - 1];
  }

  /** Tries to place a floor centered at world x. */
  place(x: number): PlaceResult {
    if (this.floors.length === 0) {
      // Foundation floor: no alignment challenge yet, so never "perfect".
      this.floors.push({ x, topY: this.landingTopY() });
      return { ok: true, offset: 0, overlap: FLOOR_WIDTH, perfect: false };
    }

    const offset = x - this.refX();
    const overlap = FLOOR_WIDTH - Math.abs(offset);
    if (overlap <= 0) return { ok: false, offset, overlap, perfect: false };

    // A near-flush drop snaps dead-center onto the floor below: it adds no
    // balance drift and no wobble, rewarding precision with a stable stack.
    const perfect = Math.abs(offset) <= PERFECT_OFFSET;
    const placeX = perfect ? this.refX() : x;
    this.floors.push({ x: placeX, topY: this.landingTopY() });
    if (!perfect) {
      // Kick the wobble in the direction of the misalignment.
      this.wobbleVel += (offset / FLOOR_WIDTH) * WOBBLE_IMPULSE;
    }
    return { ok: true, offset, overlap, perfect };
  }

  /** Horizontal distance of the center of mass from the base (world units). */
  comOffset(): number {
    if (this.floors.length === 0) return 0;
    const base = this.floors[0].x;
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < this.floors.length; i++) {
      const weight = i + 1; // Higher floors create more torque/instability
      weightedSum += (this.floors[i].x - base) * weight;
      totalWeight += weight;
    }
    return weightedSum / totalWeight;
  }

  /** Balance as a ratio in [-1, 1]; +/-1 is the collapse threshold. */
  balanceRatio(): number {
    const r = this.comOffset() / (FLOOR_WIDTH * 0.35);
    return Math.max(-1, Math.min(1, r));
  }

  /** True once the center of mass has left the base footprint. */
  isToppled(): boolean {
    return Math.abs(this.comOffset()) > FLOOR_WIDTH * 0.35;
  }

  /** Begins the topple animation after a fatal imbalance. */
  collapse(): void {
    this.collapsing = true;
    this.collapseVel = Math.sign(this.comOffset() || 1) * 0.4;
  }

  /** Whole-tower tilt applied about the base pivot when rendering (rad). */
  renderAngle(): number {
    return this.balanceRatio() * MAX_LEAN + this.wobble + this.collapseAngle;
  }

  update(dt: number): void {
    if (this.collapsing) {
      // Accelerate the fall once the building goes over, then rest flat on the
      // ground instead of spinning forever like a fan.
      const dir = Math.sign(this.collapseVel || 1);
      this.collapseVel += dir * 5 * dt;
      this.collapseAngle += this.collapseVel * dt;
      if (Math.abs(this.collapseAngle) >= COLLAPSE_MAX_ANGLE) {
        this.collapseAngle = dir * COLLAPSE_MAX_ANGLE;
        this.collapseVel = 0;
      }
      return;
    }
    // Damped angular spring pulling the wobble back to rest.
    this.wobbleVel +=
      (-(WOBBLE_FREQ * WOBBLE_FREQ) * this.wobble - 2 * WOBBLE_DAMP * this.wobbleVel) * dt;
    this.wobble += this.wobbleVel * dt;
  }
}
