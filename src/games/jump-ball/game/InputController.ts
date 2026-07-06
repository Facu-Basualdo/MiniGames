import { LANE_X } from "./constants";

/** Turns keyboard steering plus mouse/touch cursor-follow into steering input,
 *  and an "any input" signal used to start / restart the run.
 *
 *  Keyboard: hold Left/A or Right/D to steer. Mouse/touch: the ball follows the
 *  horizontal position of the cursor (move the mouse or drag to pick a lane). */
export class InputController {
  private readonly target: HTMLElement;
  private readonly onAnyInput: () => void;

  private activeKeys = new Set<string>();
  /** World-space X the ball should ease toward from the mouse, or null when the
   *  pointer hasn't been used yet (keyboard-only players stay unaffected). */
  private pointerTargetX: number | null = null;

  constructor(target: HTMLElement, onAnyInput: () => void) {
    this.target = target;
    this.onAnyInput = onAnyInput;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointermove", this.onPointerMove);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointermove", this.onPointerMove);
  }

  reset(): void {
    this.activeKeys.clear();
  }

  /** Returns 0, kept for backward compatibility in Game.ts calls. */
  consumeSteer(): number {
    return 0;
  }

  /** Returns -1 for left steering, 1 for right steering, or 0 for none
   *  (keyboard only; mouse steering goes through getPointerTargetX). */
  getSteerDir(): number {
    if (this.activeKeys.has("left")) return -1;
    if (this.activeKeys.has("right")) return 1;
    return 0;
  }

  /** World X the ball should ease toward from the cursor, or null if the mouse
   *  hasn't been used. Keyboard steering takes priority over this in Game.ts. */
  getPointerTargetX(): number | null {
    return this.pointerTargetX;
  }

  /** Maps a screen X to a target lane X: screen edges map to the outer lanes. */
  private updatePointerTarget(clientX: number): void {
    const normalized = (clientX / window.innerWidth) * 2 - 1; // -1..1
    this.pointerTargetX = normalized * LANE_X;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      this.activeKeys.delete("right");
      this.activeKeys.add("left");
      // Last input wins: using the keyboard disables mouse-follow until the
      // mouse moves again, so releasing a key doesn't snap the ball back to the
      // cursor (which made keyboard steering feel like it did nothing).
      this.pointerTargetX = null;
      this.onAnyInput();
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      this.activeKeys.delete("left");
      this.activeKeys.add("right");
      this.pointerTargetX = null;
      this.onAnyInput();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      this.activeKeys.delete("left");
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      this.activeKeys.delete("right");
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.updatePointerTarget(e.clientX);
    this.onAnyInput();
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointerTarget(e.clientX);
  };
}
