import * as THREE from "three";
import type { Kicker } from "./Kicker";
import { buildKickerFrames, makeSpritePlane, setSpriteFrame, type KickerFrames } from "./sprites";

/** World size of the kicker sprite plane, m (art box is 22 x 34 px). */
const KICKER_PLANE_H = 1.85;
const KICKER_PLANE_W = KICKER_PLANE_H * (22 / 34);
const RUN_FRAME_TIME = 0.1;
const IDLE_FRAME_TIME = 0.55;

/** Draws the Kicker state as an animated pixel sprite: idle breathing, a
 *  run cycle during the approach and the kick pose on the swing. */
export class KickerView {
  readonly object: THREE.Mesh;

  private readonly frames: KickerFrames = buildKickerFrames();
  private animTime = 0;

  constructor() {
    this.object = makeSpritePlane(this.frames.idle[0], KICKER_PLANE_W, KICKER_PLANE_H);
    // Faces the camera (the plane's front already looks toward -Z).
    this.object.rotation.y = Math.PI;
  }

  update(dt: number, kicker: Kicker): void {
    this.animTime += dt;

    this.object.position.set(kicker.x, KICKER_PLANE_H / 2, kicker.z);

    if (kicker.swing > 0.05) {
      setSpriteFrame(this.object, this.frames.kick);
    } else if (kicker.moving) {
      const frame = Math.floor(this.animTime / RUN_FRAME_TIME) % this.frames.run.length;
      setSpriteFrame(this.object, this.frames.run[frame]);
    } else {
      const frame = Math.floor(this.animTime / IDLE_FRAME_TIME) % this.frames.idle.length;
      setSpriteFrame(this.object, this.frames.idle[frame]);
    }
  }
}
