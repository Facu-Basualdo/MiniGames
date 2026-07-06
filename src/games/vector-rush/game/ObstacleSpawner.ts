import * as THREE from "three";
import { Obstacle, type ObstacleKind } from "./Obstacle";
import {
  FIELD_HALF_HEIGHT,
  FIELD_HALF_WIDTH,
  GAP_REACH_FACTOR,
  LANE_HALF_HEIGHT_MIN,
  LANE_HALF_HEIGHT_START,
  LANE_HALF_WIDTH_MIN,
  LANE_HALF_WIDTH_START,
  LANE_SHRINK_PER_POINT,
  OBSTACLE_ACTIVE_COUNT,
  OBSTACLE_DESPAWN_MARGIN,
  OBSTACLE_SPACING_MAX,
  OBSTACLE_SPACING_MIN,
  OBSTACLE_SPAWN_START_Z,
  PLAYER_MOVE_SPEED,
} from "./constants";
import { clamp } from "./mathUtils";

export type ObstacleEvent = "hit" | "passed";

const KINDS: ObstacleKind[] = ["meteor", "ice", "debris"];

/** Owns the lifecycle of obstacles: spawning ahead, scrolling, resolving passes/hits. */
export class ObstacleSpawner {
  private readonly scene: THREE.Scene;
  private readonly obstacles: Obstacle[] = [];
  private nextSpawnZ = OBSTACLE_SPAWN_START_Z;
  // Previous clear-lane center, so consecutive lanes never jump further than
  // the ship can travel before the next field arrives (skill, not luck).
  private prevCenterX = 0;
  private prevCenterY = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  reset(): void {
    for (const obstacle of this.obstacles) {
      this.scene.remove(obstacle.group);
      obstacle.dispose();
    }
    this.obstacles.length = 0;
    this.nextSpawnZ = OBSTACLE_SPAWN_START_Z;
    this.prevCenterX = 0;
    this.prevCenterY = 0;
  }

  update(dt: number, dz: number, playerX: number, playerY: number, playerZ: number, score: number, speed: number): ObstacleEvent[] {
    const events: ObstacleEvent[] = [];

    for (const obstacle of this.obstacles) {
      obstacle.update(dt, dz);
      if (!obstacle.resolved && obstacle.z >= playerZ) {
        obstacle.resolved = true;
        events.push(obstacle.isSafe(playerX, playerY) ? "passed" : "hit");
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      if (obstacle.z > playerZ + OBSTACLE_DESPAWN_MARGIN) {
        this.scene.remove(obstacle.group);
        obstacle.dispose();
        this.obstacles.splice(i, 1);
      }
    }

    while (this.obstacles.length < OBSTACLE_ACTIVE_COUNT) {
      this.spawnNext(score, speed);
    }

    return events;
  }

  private spawnNext(score: number, speed: number): void {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];

    const laneHalfWidth = Math.max(LANE_HALF_WIDTH_MIN, LANE_HALF_WIDTH_START - score * LANE_SHRINK_PER_POINT);
    const laneHalfHeight = Math.max(LANE_HALF_HEIGHT_MIN, LANE_HALF_HEIGHT_START - score * LANE_SHRINK_PER_POINT);

    const spacing = OBSTACLE_SPACING_MIN + Math.random() * (OBSTACLE_SPACING_MAX - OBSTACLE_SPACING_MIN);
    const reach = PLAYER_MOVE_SPEED * (spacing / speed) * GAP_REACH_FACTOR;

    const marginX = 0.3; // Padding to prevent frame overlap with corridor walls / boundary debris
    const marginY = 0.3;
    const rangeX = Math.max(0, FIELD_HALF_WIDTH - laneHalfWidth - marginX);
    const rangeY = Math.max(0, FIELD_HALF_HEIGHT - laneHalfHeight - marginY);
    const centerX = clamp(this.prevCenterX + (Math.random() * 2 - 1) * reach, -rangeX, rangeX);
    const centerY = clamp(this.prevCenterY + (Math.random() * 2 - 1) * reach, -rangeY, rangeY);
    this.prevCenterX = centerX;
    this.prevCenterY = centerY;

    const obstacle = new Obstacle({
      kind,
      z: this.nextSpawnZ,
      centerX,
      centerY,
      laneHalfWidth,
      laneHalfHeight,
    });
    this.obstacles.push(obstacle);
    this.scene.add(obstacle.group);

    this.nextSpawnZ -= spacing;
  }
}
