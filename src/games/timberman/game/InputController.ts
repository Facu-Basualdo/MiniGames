import type { Side } from "./Tree";

/**
 * Keyboard (arrows / A-D) and pointer (tap left/right half) input, queued as
 * discrete chop sides and drained once per frame by the game loop.
 */
export class InputController {
  private queue: Side[] = [];

  constructor(target: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("pointerdown", this.onPointerDown);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.queue.push("left");
    else if (e.code === "ArrowRight" || e.code === "KeyD") this.queue.push("right");
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.queue.push(e.clientX < window.innerWidth / 2 ? "left" : "right");
  };

  /** Returns the next queued chop side, or null when the queue is empty. */
  consumeChop(): Side | null {
    return this.queue.shift() ?? null;
  }

  clear(): void {
    this.queue.length = 0;
  }
}
