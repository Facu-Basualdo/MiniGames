/** Turns input into keeper actions. Keyboard: arrows / A-D steer, Space
 *  jumps, Enter starts. Pointer: moving it steers (the Game projects the
 *  client X onto the keeper's plane in world space), a press jumps. */
export class InputController {
  private readonly target: HTMLElement;
  private readonly onMove: (clientX: number) => void;
  private readonly onJump: () => void;
  private readonly onStart: () => void;

  private left = false;
  private right = false;

  constructor(
    target: HTMLElement,
    onMove: (clientX: number) => void,
    onJump: () => void,
    onStart: () => void,
  ) {
    this.target = target;
    this.onMove = onMove;
    this.onJump = onJump;
    this.onStart = onStart;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointermove", this.onPointerMove);
    target.addEventListener("pointerdown", this.onPointerDown);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
  }

  /** Current keyboard steering direction: -1, 0 or 1. */
  getSteerDir(): number {
    return (this.left ? 1 : 0) - (this.right ? 1 : 0);
  }


  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Enter") {
      e.preventDefault();
      this.onStart();
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      this.left = true;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      this.right = true;
    } else if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      this.onJump();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.left = false;
    else if (e.code === "ArrowRight" || e.code === "KeyD") this.right = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.onMove(e.clientX);
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.onMove(e.clientX);
    this.onJump();
  };
}
