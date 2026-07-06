import { clamp } from "./mathUtils";

/** Reads keyboard, mouse and touch input and exposes steering and firing controls. */
export class InputController {
  private readonly target: HTMLElement;
  private leftHeld = false;
  private rightHeld = false;
  private upHeld = false;
  private downHeld = false;
  private spaceHeld = false;
  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;
  private pointerClickHeld = false;

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerDrag);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    
    // Prevent context menu to allow smooth clicking
    target.addEventListener("contextmenu", this.onContextMenu);
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

  /** Check if the player is actively requesting to shoot. */
  get isFiring(): boolean {
    return this.spaceHeld || this.pointerActive || this.pointerClickHeld;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerDrag);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("contextmenu", this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.leftHeld = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.rightHeld = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.upHeld = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.downHeld = true;
    if (e.code === "Space") this.spaceHeld = true;
    
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.leftHeld = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.rightHeld = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.upHeld = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.downHeld = false;
    if (e.code === "Space") this.spaceHeld = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerActive = true;
    this.pointerClickHeld = true;
    this.applyPointer(e);
  };

  private onPointerDrag = (e: PointerEvent): void => {
    if (this.pointerActive) this.applyPointer(e);
  };

  private applyPointer(e: PointerEvent): void {
    const scale = Math.min(window.innerWidth, window.innerHeight) * 0.35;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.pointerX = clamp((e.clientX - cx) / scale, -1, 1);
    this.pointerY = clamp(-(e.clientY - cy) / scale, -1, 1);
  }

  private onPointerUp = (): void => {
    this.pointerActive = false;
    this.pointerClickHeld = false;
    this.pointerX = 0;
    this.pointerY = 0;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
