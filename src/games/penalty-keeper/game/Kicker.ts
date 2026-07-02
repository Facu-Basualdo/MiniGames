import { FOLLOW_THROUGH, PENALTY_SPOT_Z, RUNUP_TIME } from "./constants";

type Phase = "idle" | "runup" | "kick" | "recover";

/** How far behind and beside the ball the run-up starts, m. The side offset
 *  also keeps the idle kicker from hiding behind a centered keeper. */
const RUNUP_BACK = 1.7;
const RUNUP_SIDE = 1.05;

/** The penalty taker: pure animation state driven by ShotField's schedule.
 *  The run-up is the telegraph the player reads; KickerView draws it. */
export class Kicker {
  /** Figure position (feet) in world meters: x lateral, z depth. */
  x = -RUNUP_SIDE;
  z = PENALTY_SPOT_Z + RUNUP_BACK;
  /** Leg swing: -1 loaded back, 0 neutral, 1 fully through the ball. */
  swing = 0;
  /** Stride cycle 0..1 while moving, drives the leg scissor. */
  stride = 0;
  /** True while moving (run-up or walking back), for the view. */
  moving = false;

  private phase: Phase = "idle";
  private phaseTime = 0;
  private runupDuration = RUNUP_TIME;

  reset(): void {
    this.phase = "idle";
    this.phaseTime = 0;
    this.x = -RUNUP_SIDE;
    this.z = PENALTY_SPOT_Z + RUNUP_BACK;
    this.swing = 0;
    this.stride = 0;
    this.moving = false;
  }

  /** Cues the approach so the swing lands exactly on the kick moment. */
  beginRunup(duration: number = RUNUP_TIME): void {
    this.phase = "runup";
    this.phaseTime = 0;
    this.runupDuration = Math.max(0.15, duration);
  }

  /** Called by ShotField at the exact kick moment (ball launches now). */
  strike(): void {
    this.phase = "kick";
    this.phaseTime = 0;
  }

  update(dt: number): void {
    this.phaseTime += dt;

    switch (this.phase) {
      case "idle": {
        this.moving = false;
        this.swing = 0;
        this.stride = 0;
        break;
      }
      case "runup": {
        const p = Math.min(this.phaseTime / this.runupDuration, 1);
        const ease = p * p * (3 - 2 * p);
        this.x = -RUNUP_SIDE * (1 - ease);
        this.z = PENALTY_SPOT_Z + RUNUP_BACK * (1 - ease) + 0.2;
        this.stride = (p * 3) % 1;
        this.swing = p >= 1 ? -1 : -0.3 * p; // loads the leg at the end
        this.moving = true;
        break;
      }
      case "kick": {
        const p = Math.min(this.phaseTime / FOLLOW_THROUGH, 1);
        this.swing = -1 + 2 * p; // whips from loaded to full follow-through
        this.moving = false;
        if (p >= 1) {
          this.phase = "recover";
          this.phaseTime = 0;
        }
        break;
      }
      case "recover": {
        const p = Math.min(this.phaseTime / 0.8, 1);
        const ease = p * p * (3 - 2 * p);
        this.x = -RUNUP_SIDE * ease;
        this.z = PENALTY_SPOT_Z + 0.2 + (RUNUP_BACK - 0.2) * ease;
        this.swing = 1 - ease;
        this.stride = (p * 2) % 1;
        this.moving = p < 1;
        if (p >= 1) {
          this.phase = "idle";
          this.phaseTime = 0;
        }
        break;
      }
    }
  }
}
