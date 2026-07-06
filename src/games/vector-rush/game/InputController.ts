/** Reads keyboard, mouse and touch input and exposes an x/y steering vector (-1..1). */
export class InputController {
  private readonly target: HTMLElement;
  private leftHeld = false;
  private rightHeld = false;
  private upHeld = false;
  private downHeld = false;
  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerMove);
    window.addEventListener("pointermove", this.onPointerDrag);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  /** Horizontal steering, -1 (left) .. 1 (right). */
  get dirX(): number {
    if (this.pointerActive) return this.pointerX;
    if (this.leftHeld === this.rightHeld) return 0;
    return this.leftHeld ? -1 : 1;
  }

  /** Vertical steering, -1 (down) .. 1 (up). */
  get dirY(): number {
    if (this.pointerActive) return this.pointerY;
    if (this.upHeld === this.downHeld) return 0;
    return this.upHeld ? 1 : -1;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerMove);
    window.removeEventListener("pointermove", this.onPointerDrag);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.leftHeld = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.rightHeld = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.upHeld = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.downHeld = true;
    if (e.code.startsWith("Arrow")) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.leftHeld = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.rightHeld = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.upHeld = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.downHeld = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.pointerActive = true;
    this.applyPointer(e);
  };

  private onPointerDrag = (e: PointerEvent): void => {
    if (this.pointerActive) this.applyPointer(e);
  };

  private applyPointer(e: PointerEvent): void {
    // Steer toward the pointer relative to screen center; full tilt at ~35% of
    // the shorter screen dimension away from center.
    const scale = Math.min(window.innerWidth, window.innerHeight) * 0.35;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.pointerX = clamp01((e.clientX - cx) / scale);
    this.pointerY = clamp01(-(e.clientY - cy) / scale); // screen Y is inverted
  }

  private onPointerUp = (): void => {
    this.pointerActive = false;
    this.pointerX = 0;
    this.pointerY = 0;
  };
}

function clamp01(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
