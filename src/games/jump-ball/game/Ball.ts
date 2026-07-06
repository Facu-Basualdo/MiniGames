import * as THREE from "three";
import {
  BALL_COLOR,
  BALL_RADIUS,
  FALL_SPEED,
  HOP_HEIGHT,
  LANE_X,
  PLATFORM_WIDTH,
} from "./constants";

/** The player ball: a solid-colored sphere that hops forward automatically and
 *  is steered continuously across the tracks. Owns its own mesh. */
export class Ball {
  readonly object: THREE.Mesh;

  constructor() {
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 24);
    const material = new THREE.MeshStandardMaterial({
      color: BALL_COLOR,
      roughness: 0.35,
      metalness: 0.0,
    });
    this.object = new THREE.Mesh(geometry, material);
    this.object.castShadow = true;
    this.reset();
  }

  reset(): void {
    this.object.position.set(0, BALL_RADIUS, 0);
  }

  /** Steers the ball continuously in the given direction. */
  steerContinuous(dir: number, dt: number): void {
    const steerSpeed = 9.5; // units per second
    this.object.position.x += dir * steerSpeed * dt;

    // Clamp the position so the ball doesn't run off the sides of the track
    const maxBound = LANE_X + PLATFORM_WIDTH / 2 - BALL_RADIUS;
    this.object.position.x = THREE.MathUtils.clamp(
      this.object.position.x,
      -maxBound,
      maxBound
    );
  }

  /** Eases the ball toward an absolute target X (mouse cursor follow), capped at
   *  the same speed as keyboard steering and without overshooting the target. */
  steerToward(targetX: number, dt: number): void {
    const steerSpeed = 9.5; // units per second, matches steerContinuous
    const maxBound = LANE_X + PLATFORM_WIDTH / 2 - BALL_RADIUS;
    const target = THREE.MathUtils.clamp(targetX, -maxBound, maxBound);
    const diff = target - this.object.position.x;
    const step = steerSpeed * dt;
    this.object.position.x +=
      Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
  }

  update(_dt: number, hopPhase: number): void {
    this.object.position.y = BALL_RADIUS + Math.sin(Math.PI * hopPhase) * HOP_HEIGHT;
  }

  /** After a missed platform: let the ball drop through the gap. */
  fall(dt: number): void {
    this.object.position.y -= FALL_SPEED * dt;
  }

  /** Idle bob for the start / game-over screens. */
  idle(time: number): void {
    const phase = (time % 1) + 0;
    this.object.position.x += (0 - this.object.position.x) * 0.1;
    this.object.position.y = BALL_RADIUS + Math.abs(Math.sin(Math.PI * phase)) * HOP_HEIGHT * 0.55;
  }
}
