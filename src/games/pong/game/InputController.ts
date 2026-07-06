export class InputController {
  private readonly target: HTMLElement;
  private readonly onAction: () => void;
  private keysDown = new Set<string>();

  constructor(target: HTMLElement, onAction: () => void) {
    this.target = target;
    this.onAction = onAction;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerDown);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
  }

  /** Combined movement (both W/S and arrows) for solo mode. */
  get moveDir(): number {
    if (this.keysDown.has("ArrowUp") || this.keysDown.has("KeyW")) return -1;
    if (this.keysDown.has("ArrowDown") || this.keysDown.has("KeyS")) return 1;
    return 0;
  }

  /** Player 1: W/S only (left paddle). */
  get p1Dir(): number {
    if (this.keysDown.has("KeyW")) return -1;
    if (this.keysDown.has("KeyS")) return 1;
    return 0;
  }

  /** Player 2: Arrow Up/Down only (right paddle). */
  get p2Dir(): number {
    if (this.keysDown.has("ArrowUp")) return -1;
    if (this.keysDown.has("ArrowDown")) return 1;
    return 0;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.code);
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "Enter") {
      e.preventDefault();
    }
    if (e.code === "Enter" || e.code === "Space") {
      this.onAction();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.onAction();
  };
}
