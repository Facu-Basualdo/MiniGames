import * as THREE from "three";
import { KEEPER_Z } from "./constants";
import type { Keeper } from "./Keeper";
import { buildKeeperFrames, makeSpritePlane, setSpriteFrame, type KeeperFrames } from "./sprites";

/** World size of the keeper sprite plane, m (art box is 22 x 34 px). */
const KEEPER_PLANE_H = 2.1;
const KEEPER_PLANE_W = KEEPER_PLANE_H * (22 / 34);
/** Seconds per animation frame while running / idling. */
const RUN_FRAME_TIME = 0.11;
const IDLE_FRAME_TIME = 0.55;

/** Draws the Keeper state as an animated pixel sprite: idle breathing, a
 *  two-frame run cycle mirrored by direction, and a stretched jump pose. */
export class KeeperView {
  readonly object: THREE.Mesh;

  private readonly frames: KeeperFrames = buildKeeperFrames();
  private animTime = 0;

  constructor() {
    this.object = makeSpritePlane(this.frames.idle[0], KEEPER_PLANE_W, KEEPER_PLANE_H);
    this.object.position.set(0, KEEPER_PLANE_H / 2, KEEPER_Z);
  }

  update(dt: number, keeper: Keeper): void {
    this.animTime += dt;

    this.object.position.x = keeper.x;
    this.object.position.y = KEEPER_PLANE_H / 2 + keeper.jumpOffset;

    const moving = Math.abs(keeper.lean) > 0.15;
    if (!keeper.grounded) {
      setSpriteFrame(this.object, this.frames.jump);
    } else if (moving) {
      const frame = Math.floor(this.animTime / RUN_FRAME_TIME) % this.frames.run.length;
      setSpriteFrame(this.object, this.frames.run[frame]);
    } else {
      const frame = Math.floor(this.animTime / IDLE_FRAME_TIME) % this.frames.idle.length;
      setSpriteFrame(this.object, this.frames.idle[frame]);
    }

    // Mirror the run cycle into the movement direction; a slight tilt sells
    // the weight shift without breaking the pixel look.
    this.object.scale.x = keeper.lean < -0.15 ? -1 : 1;
    this.object.rotation.z = -keeper.lean * 0.12;
  }
}
