import * as THREE from "three";
import { BARTENDER_X, CATCH_POSE_TIME, LANE_BASE_Z, LANE_STEP_Y, LANE_STEP_Z, PEOPLE_Z_OFFSET, SERVE_POSE_TIME, TAP_X } from "./constants";
import { laneCounterTopY, laneZ } from "./layout";
import type { Bartender } from "./Bartender";
import {
  BARTENDER_H,
  BARTENDER_W,
  buildBartenderFrames,
  makeSpritePlane,
  setSpriteFrame,
  type BartenderFrames,
} from "./sprites";
import { makeMug, setMugFill, type MugMesh } from "./props";

const HEIGHT_M = 1.7;
const WIDTH_M = (BARTENDER_W / BARTENDER_H) * HEIGHT_M;
/** Height of the little arc of the hop between lanes. */
const HOP_ARC = 0.22;
const IDLE_FRAME_TIME = 0.6;

/** Maps the Bartender's state onto an animated sprite plane, plus the mug
 *  filling under the tap while he pours. */
export class BartenderView {
  readonly object = new THREE.Group();

  private readonly frames: BartenderFrames = buildBartenderFrames();
  private readonly mesh: THREE.Mesh;
  private readonly pourMug: MugMesh;

  private idleTime = 0;
  private serveTimer = 0;
  private catchTimer = 0;

  constructor() {
    this.mesh = makeSpritePlane(this.frames.idle[0], WIDTH_M, HEIGHT_M);
    this.object.add(this.mesh);
    this.pourMug = makeMug();
    this.pourMug.group.visible = false;
    this.object.add(this.pourMug.group);
  }

  /** Fired when a full mug leaves the tap. */
  triggerServe(): void {
    this.serveTimer = SERVE_POSE_TIME;
  }

  /** Fired when an empty mug or a tip lands in his hands. */
  triggerCatch(): void {
    this.catchTimer = CATCH_POSE_TIME;
  }

  update(dt: number, bartender: Bartender): void {
    this.idleTime += dt;
    this.serveTimer = Math.max(0, this.serveTimer - dt);
    this.catchTimer = Math.max(0, this.catchTimer - dt);

    // Position from the eased visual lane, with a hop arc between lanes.
    const v = bartender.visualLane;
    const frac = v - Math.floor(v);
    const hop = bartender.moving ? Math.sin(frac * Math.PI) * HOP_ARC : 0;
    this.mesh.position.set(
      BARTENDER_X,
      v * LANE_STEP_Y + HEIGHT_M / 2 + hop,
      LANE_BASE_Z + v * LANE_STEP_Z + PEOPLE_Z_OFFSET,
    );

    // Pose priority: serve flourish > catch > pouring/full > idle.
    if (this.serveTimer > 0) {
      setSpriteFrame(this.mesh, this.frames.serve);
    } else if (this.catchTimer > 0) {
      setSpriteFrame(this.mesh, this.frames.catch);
    } else if (bartender.locked) {
      setSpriteFrame(this.mesh, this.frames.pour);
    } else {
      const frame = Math.floor(this.idleTime / IDLE_FRAME_TIME) % 2;
      setSpriteFrame(this.mesh, this.frames.idle[frame]);
    }

    // The mug under the tap: visible and filling while he holds the lever
    // (and while he stands there like a fool with it already full).
    if (bartender.locked) {
      this.pourMug.group.visible = true;
      this.pourMug.group.position.set(TAP_X - 0.22, laneCounterTopY(bartender.lane) + 0.06, laneZ(bartender.lane) + 0.18);
      setMugFill(this.pourMug, bartender.pourLevel);
    } else {
      this.pourMug.group.visible = false;
    }
  }
}
