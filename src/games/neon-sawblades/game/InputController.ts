/**
 * Input for Neon Sawblades. Movement is a held state (`dir`); jump / start /
 * restart is a press+release action so the jump height can depend on hold time.
 *
 * Keyboard: arrows or A/D move, Space / W / Up / Enter jump. On touch it builds
 * three on-screen buttons (left, right, jump) since phones have no keyboard.
 */
export class InputController {
  private readonly target: HTMLElement;
  private readonly onAction: () => void;
  private readonly onActionRelease: () => void;

  private leftKey = false;
  private rightKey = false;
  private leftTouch = false;
  private rightTouch = false;

  private readonly controls: HTMLDivElement;

  constructor(target: HTMLElement, handlers: { onAction: () => void; onActionRelease: () => void }) {
    this.target = target;
    this.onAction = handlers.onAction;
    this.onActionRelease = handlers.onActionRelease;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);

    this.controls = this.buildTouchControls();
    target.append(this.controls);
  }

  /** Horizontal input: -1 (left) .. 1 (right). */
  get dir(): number {
    const left = this.leftKey || this.leftTouch;
    const right = this.rightKey || this.rightTouch;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.controls.remove();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.leftKey = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.rightKey = true;
        break;
      case "Space":
      case "ArrowUp":
      case "KeyW":
      case "Enter":
        e.preventDefault();
        if (!e.repeat) this.onAction();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.leftKey = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.rightKey = false;
        break;
      case "Space":
      case "ArrowUp":
      case "KeyW":
      case "Enter":
        this.onActionRelease();
        break;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.onAction();
  };

  private onPointerUp = (): void => {
    this.onActionRelease();
  };

  private buildTouchControls(): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.className = "touch-controls";

    const left = this.makeButton("‹", () => (this.leftTouch = true), () => (this.leftTouch = false));
    const right = this.makeButton("›", () => (this.rightTouch = true), () => (this.rightTouch = false));
    left.classList.add("touch-btn--move");
    right.classList.add("touch-btn--move");
    const move = document.createElement("div");
    move.className = "touch-controls__move";
    move.append(left, right);

    const jump = this.makeButton("▲", () => this.onAction(), () => this.onActionRelease());
    jump.classList.add("touch-btn--jump");

    wrap.append(move, jump);
    return wrap;
  }

  private makeButton(label: string, onDown: () => void, onUp: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "touch-btn";
    btn.textContent = label;
    // Stop propagation so these don't also trigger the container's jump/start.
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onDown();
    });
    const release = (e: Event): void => {
      e.stopPropagation();
      onUp();
    };
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
    return btn;
  }
}
