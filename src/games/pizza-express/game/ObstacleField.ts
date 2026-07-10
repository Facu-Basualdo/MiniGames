import * as THREE from "three";
import { Obstacle, type ObstacleKind, HALF_WIDTH } from "./Obstacle";
import {
  ROAD_HALF_WIDTH,
  SCOOTER_HALF_WIDTH,
  SCOOTER_MOVE_SPEED,
  OBSTACLE_ACTIVE_ROWS,
  OBSTACLE_SPAWN_Z,
  OBSTACLE_DESPAWN_MARGIN,
  OBSTACLE_SPACING_START,
  OBSTACLE_SPACING_MIN,
  GAP_REACH_FACTOR,
  GAP_HALF_WIDTH_START,
  GAP_HALF_WIDTH_MIN,
  DOUBLE_OBSTACLE_CHANCE_MAX,
  OBSTACLE_COLLIDE_TOLERANCE,
  SCOOTER_Z,
} from "./constants";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Narrow → wide, with a spawn weight each. Cars are extra-gated (wide walls).
const KIND_WEIGHTS: { kind: ObstacleKind; weight: number }[] = [
  { kind: "cone", weight: 3 },
  { kind: "trashcan", weight: 2 },
  { kind: "dog", weight: 1.4 },
  { kind: "crate", weight: 2 },
  { kind: "pothole", weight: 2.4 },
];

/**
 * Spawns rows of road hazards toward the camera. Every row leaves a guaranteed
 * clear gap the scooter can steer into; the gap centre drifts at most as far as
 * the scooter can travel before the next row arrives (skill, not luck), and it
 * shrinks with difficulty. Obstacles are placed *outside* that gap, so the gap
 * is never blocked — discrete dodging, always fair.
 */
export class ObstacleField {
  private readonly scene: THREE.Scene;
  private readonly obstacles: Obstacle[] = [];
  private nextSpawnZ = OBSTACLE_SPAWN_Z;
  private prevGapX = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  reset(): void {
    for (const o of this.obstacles) {
      this.scene.remove(o.group);
      o.dispose();
    }
    this.obstacles.length = 0;
    this.nextSpawnZ = OBSTACLE_SPAWN_Z;
    this.prevGapX = 0;
  }

  /** Advances hazards; returns true if the scooter crashed into one this frame. */
  update(dt: number, dz: number, scooterX: number, speed: number, d: number): boolean {
    let hit = false;

    for (const o of this.obstacles) {
      o.update(dz, dt);
      if (!o.resolved && o.z >= SCOOTER_Z) {
        o.resolved = true;
        if (o.overlaps(scooterX, SCOOTER_HALF_WIDTH, OBSTACLE_COLLIDE_TOLERANCE)) hit = true;
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.z > SCOOTER_Z + OBSTACLE_DESPAWN_MARGIN) {
        this.scene.remove(o.group);
        o.dispose();
        this.obstacles.splice(i, 1);
      }
    }

    while (this.obstacles.length < OBSTACLE_ACTIVE_ROWS) {
      this.spawnRow(speed, d);
    }

    return hit;
  }

  private spawnRow(speed: number, d: number): void {
    const spacing = lerp(OBSTACLE_SPACING_START, OBSTACLE_SPACING_MIN, d);
    const gapHalf = lerp(GAP_HALF_WIDTH_START, GAP_HALF_WIDTH_MIN, d);

    // Drift the safe gap, but never farther than the scooter can travel in time.
    const reach = SCOOTER_MOVE_SPEED * (spacing / Math.max(speed, 1)) * GAP_REACH_FACTOR;
    const range = ROAD_HALF_WIDTH - gapHalf - 0.2;
    const gapX = clamp(this.prevGapX + (Math.random() * 2 - 1) * reach, -range, range);
    this.prevGapX = gapX;

    // One obstacle on the wider blocked side, plus (with growing odds) a second
    // on the other side to tighten the lane.
    const leftWidth = (gapX - gapHalf) - -ROAD_HALF_WIDTH;
    const rightWidth = ROAD_HALF_WIDTH - (gapX + gapHalf);
    const first = leftWidth >= rightWidth ? -1 : 1;
    this.place(first, gapX, gapHalf);

    const doubleChance = d * DOUBLE_OBSTACLE_CHANCE_MAX;
    if (Math.random() < doubleChance) this.place(-first as -1 | 1, gapX, gapHalf);

    this.nextSpawnZ -= spacing;
  }

  /** Places one obstacle fully within the blocked region on the given side. */
  private place(side: -1 | 1, gapX: number, gapHalf: number): void {
    const lo = side < 0 ? -ROAD_HALF_WIDTH : gapX + gapHalf;
    const hi = side < 0 ? gapX - gapHalf : ROAD_HALF_WIDTH;
    const width = hi - lo;
    if (width < 0.7) return; // no room for even a cone

    const kind = this.pickKind(width);
    const hw = HALF_WIDTH[kind];
    const cLo = lo + hw;
    const cHi = hi - hw;
    const x = cHi > cLo ? cLo + Math.random() * (cHi - cLo) : (lo + hi) / 2;

    const o = new Obstacle(kind, x, this.nextSpawnZ);
    this.obstacles.push(o);
    this.scene.add(o.group);
  }

  private pickKind(regionWidth: number): ObstacleKind {
    // Cars only where a full car fits with margin.
    if (regionWidth >= 3.1 && Math.random() < 0.22) return "car";
    const candidates = KIND_WEIGHTS.filter((k) => HALF_WIDTH[k.kind] * 2 + 0.2 <= regionWidth);
    const pool = candidates.length ? candidates : [{ kind: "cone" as ObstacleKind, weight: 1 }];
    const total = pool.reduce((s, k) => s + k.weight, 0);
    let r = Math.random() * total;
    for (const k of pool) {
      r -= k.weight;
      if (r <= 0) return k.kind;
    }
    return pool[0].kind;
  }
}
