/** Turns input into bartender actions. Keyboard: arrows / W-S hop between
 *  bars, holding Space pours (keyup releases the mug), Enter starts.
 *  Pointer: press picks the bar under the finger and starts pouring, the
 *  release sends the mug (the Game maps clientY to a lane). */
export class InputController {
  private readonly onLaneMove: (dir: number) => void;
  private readonly onPourStart: () => void;
  private readonly onPourEnd: () => void;
  private readonly onStart: () => void;
  private readonly onPointerPress: (clientY: number) => void;

  constructor(
    onLaneMove: (dir: number) => void,
    onPourStart: () => void,
    onPourEnd: () => void,
    onStart: () => void,
    onPointerPress: (clientY: number) => void,
  ) {
    this.onLaneMove = onLaneMove;
    this.onPourStart = onPourStart;
    this.onPourEnd = onPourEnd;
    this.onStart = onStart;
    this.onPointerPress = onPointerPress;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    // On window (not the canvas): the start/game-over overlay sits over the
    // canvas and would swallow the press, and taps must start the game.
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Enter") {
      e.preventDefault();
      this.onStart();
      return;
    }
    if ((e.code === "ArrowUp" || e.code === "KeyW") && !e.repeat) {
      e.preventDefault();
      this.onLaneMove(1);
    } else if ((e.code === "ArrowDown" || e.code === "KeyS") && !e.repeat) {
      e.preventDefault();
      this.onLaneMove(-1);
    } else if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      this.onPourStart();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "Space") {
      e.preventDefault();
      this.onPourEnd();
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    // Never steal presses from real UI: the back link, the leaderboard's
    // nickname input and buttons must keep working on the overlays.
    if (e.target instanceof Element && e.target.closest("a, button, input, select, textarea, label")) {
      return;
    }
    e.preventDefault();
    this.onPointerPress(e.clientY);
  };

  private onPointerUp = (): void => {
    this.onPourEnd();
  };
}
