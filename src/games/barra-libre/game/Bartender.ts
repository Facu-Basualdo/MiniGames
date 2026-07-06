import { LANE_COUNT, LANE_SWITCH_TIME, POUR_TIME } from "./constants";

export type PourState = "idle" | "pouring" | "full";
export type PourResult = "serve" | "discard" | null;

/** Pure bartender logic: which lane he is on, the hop between lanes and
 *  the pour state machine. No rendering. Pouring roots him to the lane;
 *  a full mug that is not released just waits in his hand (the wasted
 *  time is the whole punishment). */
export class Bartender {
  /** Target lane (integer). */
  lane = 0;
  /** Visual lane position, eased toward `lane` for the hop animation. */
  visualLane = 0;
  pour: PourState = "idle";
  /** 0..1 while pouring; clamped at 1 when full. */
  pourLevel = 0;

  reset(): void {
    this.lane = 0;
    this.visualLane = 0;
    this.pour = "idle";
    this.pourLevel = 0;
  }

  /** Locked while a mug is under the tap (pouring or waiting full). */
  get locked(): boolean {
    return this.pour !== "idle";
  }

  get moving(): boolean {
    return Math.abs(this.visualLane - this.lane) > 0.01;
  }

  /** Hop up/down one lane, wrapping around the ends (the "hyperspace"
   *  move of the original). Ignored while pouring. */
  moveLane(dir: number): boolean {
    if (this.locked || dir === 0) return false;
    const from = this.lane;
    this.lane = (this.lane + dir + LANE_COUNT) % LANE_COUNT;
    // A wrap hop teleports the ease too: snapping reads better than a
    // sweep across every bar in between.
    if (Math.abs(this.lane - from) > 1) this.visualLane = this.lane;
    return true;
  }

  /** Jump straight to a lane (pointer input). Ignored while pouring. */
  moveTo(lane: number): boolean {
    if (this.locked) return false;
    const target = Math.max(0, Math.min(LANE_COUNT - 1, lane));
    if (target === this.lane) return false;
    this.lane = target;
    return true;
  }

  startPour(): boolean {
    if (this.pour !== "idle") return false;
    this.pour = "pouring";
    this.pourLevel = 0;
    return true;
  }

  /** Release the tap: a full mug is served, a partial one is discarded. */
  releasePour(): PourResult {
    if (this.pour === "idle") return null;
    const result: PourResult = this.pour === "full" ? "serve" : "discard";
    this.pour = "idle";
    this.pourLevel = 0;
    return result;
  }

  /** Returns true on the exact tick the mug fills up (for the cue blip). */
  update(dt: number): boolean {
    // Ease the hop between lanes.
    const delta = this.lane - this.visualLane;
    const step = dt / LANE_SWITCH_TIME;
    if (Math.abs(delta) <= step) this.visualLane = this.lane;
    else this.visualLane += Math.sign(delta) * step;

    if (this.pour === "pouring") {
      this.pourLevel = Math.min(1, this.pourLevel + dt / POUR_TIME);
      if (this.pourLevel >= 1) {
        this.pour = "full";
        return true;
      }
    }
    return false;
  }
}
