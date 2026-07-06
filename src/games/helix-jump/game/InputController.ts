import { ROTATION_SPEED_KEYBOARD, ROTATION_SPEED_POINTER } from "./constants";

export class InputController {
  private readonly element: HTMLElement;
  private readonly onActivate: () => void;

  private isDragging = false;
  private lastPointerX = 0;
  private pointerDelta = 0;

  private keys: Record<string, boolean> = {};

  constructor(element: HTMLElement, onActivate: () => void) {
    this.element = element;
    this.onActivate = onActivate;

    // Mouse and touch drag
    element.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);

    // Keyboard keys
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  destroy(): void {
    this.element.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  reset(): void {
    this.isDragging = false;
    this.pointerDelta = 0;
    this.keys = {};
  }

  /**
   * Returns rotation delta (in radians) for this frame.
   * Consumes pointer movement so it doesn't accumulate indefinitely.
   */
  getRotationDelta(dt: number): number {
    let delta = 0;

    // Keyboard controls
    if (this.keys["ArrowLeft"] || this.keys["KeyA"]) {
      // Rotates the platforms counter-clockwise from top-view -> tower rotates clockwise
      delta -= ROTATION_SPEED_KEYBOARD * dt;
    }
    if (this.keys["ArrowRight"] || this.keys["KeyD"]) {
      delta += ROTATION_SPEED_KEYBOARD * dt;
    }

    // Pointer controls
    delta += this.pointerDelta;
    this.pointerDelta = 0; // consume

    return delta;
  }

  private readonly handlePointerDown = (e: PointerEvent): void => {
    // Only left click or touches
    if (e.button !== 0 && e.pointerType === "mouse") return;
    
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.pointerDelta = 0;
    
    // Trigger activation (start / restart)
    this.onActivate();
  };

  private readonly handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    
    const dx = e.clientX - this.lastPointerX;
    this.pointerDelta += dx * ROTATION_SPEED_POINTER;
    this.lastPointerX = e.clientX;
  };

  private readonly handlePointerUp = (): void => {
    this.isDragging = false;
  };

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (e.code === "Space" || e.code === "Enter") {
      this.onActivate();
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };
}
