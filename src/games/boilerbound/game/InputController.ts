/**
 * Platformer input: A/D or arrows to run, Space / W / Up to jump (variable
 * height, so held state matters), Shift / K to dash. Jump and dash are
 * edge-triggered (consumed once per press). Also builds the on-screen touch
 * pad (left / right / jump / dash) for mobile.
 */
export class InputController {
  private leftKey = false;
  private rightKey = false;
  private leftTouch = false;
  private rightTouch = false;
  private jumpDown = false;
  private jumpEdge = false;
  private dashEdge = false;

  constructor(container: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.buildTouchControls(container);
  }

  /** -1 / 0 / 1 horizontal intent. */
  get moveDir(): number {
    const left = this.leftKey || this.leftTouch;
    const right = this.rightKey || this.rightTouch;
    if (left === right) return 0;
    return left ? -1 : 1;
  }

  get jumpHeld(): boolean {
    return this.jumpDown;
  }

  consumeJumpPressed(): boolean {
    const v = this.jumpEdge;
    this.jumpEdge = false;
    return v;
  }

  consumeDashPressed(): boolean {
    const v = this.dashEdge;
    this.dashEdge = false;
    return v;
  }

  private isJumpCode(code: string): boolean {
    return code === "Space" || code === "KeyW" || code === "ArrowUp";
  }

  private isDashCode(code: string): boolean {
    return code === "ShiftLeft" || code === "ShiftRight" || code === "KeyK";
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.leftKey = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.rightKey = true;
    if (this.isJumpCode(e.code)) {
      if (!this.jumpDown && !e.repeat) this.jumpEdge = true;
      this.jumpDown = true;
    }
    if (this.isDashCode(e.code) && !e.repeat) this.dashEdge = true;
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.leftKey = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.rightKey = false;
    if (this.isJumpCode(e.code)) this.jumpDown = false;
  };

  private buildTouchControls(container: HTMLElement): void {
    const pad = document.createElement("div");
    pad.className = "touch-controls";

    const move = document.createElement("div");
    move.className = "touch-cluster touch-cluster--left";
    const left = this.makeButton("‹", () => (this.leftTouch = true), () => (this.leftTouch = false));
    const right = this.makeButton("›", () => (this.rightTouch = true), () => (this.rightTouch = false));
    move.append(left, right);

    const actions = document.createElement("div");
    actions.className = "touch-cluster touch-cluster--right";
    const dash = this.makeButton("DASH", () => (this.dashEdge = true), null);
    const jump = this.makeButton(
      "▲",
      () => {
        this.jumpDown = true;
        this.jumpEdge = true;
      },
      () => (this.jumpDown = false),
    );
    actions.append(dash, jump);

    pad.append(move, actions);
    container.append(pad);
  }

  private makeButton(label: string, onDown: () => void, onUp: (() => void) | null): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "touch-btn";
    b.textContent = label;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onDown();
    });
    const up = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      onUp?.();
    };
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    return b;
  }
}
