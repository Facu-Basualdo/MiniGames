import { LeaderboardPanel } from "../../../shared/LeaderboardPanel";

/** DOM overlay: live score + combo, best, start / game-over screens, countdown,
 *  leaderboard and the touch "throw" button. */
export class Hud {
  private readonly scoreEl: HTMLDivElement;
  private readonly comboEl: HTMLDivElement;
  private readonly bestEl: HTMLDivElement;
  private readonly overlayEl: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly subtitleEl: HTMLDivElement;
  private readonly scoreLineEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private readonly countdownEl: HTMLDivElement;
  private readonly throwBtn: HTMLButtonElement;
  private readonly leaderboard = new LeaderboardPanel();

  constructor(container: HTMLElement, onActivate: () => void, onThrow: () => void) {
    const hud = document.createElement("div");
    hud.className = "hud";

    this.scoreEl = document.createElement("div");
    this.scoreEl.className = "hud__score";
    this.scoreEl.textContent = "0";

    this.comboEl = document.createElement("div");
    this.comboEl.className = "hud__combo";

    this.bestEl = document.createElement("div");
    this.bestEl.className = "hud__best";

    hud.append(this.scoreEl, this.comboEl, this.bestEl);

    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "overlay";

    this.titleEl = document.createElement("div");
    this.titleEl.className = "overlay__title";

    this.subtitleEl = document.createElement("div");
    this.subtitleEl.className = "overlay__subtitle";

    this.scoreLineEl = document.createElement("div");
    this.scoreLineEl.className = "overlay__score";

    this.hintEl = document.createElement("div");
    this.hintEl.className = "overlay__hint";
    this.hintEl.innerHTML = "<b>&larr; &rarr;</b> / A D / arrastrá para esquivar &nbsp;·&nbsp; <b>ESPACIO</b> / tocá para lanzar la pizza";

    this.overlayEl.append(this.titleEl, this.subtitleEl, this.scoreLineEl, this.hintEl);
    this.leaderboard.mount(this.overlayEl);
    this.leaderboard.clear();

    this.countdownEl = document.createElement("div");
    this.countdownEl.className = "countdown";

    this.throwBtn = document.createElement("button");
    this.throwBtn.className = "throw-btn hidden";
    this.throwBtn.textContent = "TIRAR";
    this.throwBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onThrow();
    });

    container.append(hud, this.overlayEl, this.countdownEl, this.throwBtn);

    const activate = (e: Event): void => {
      e.preventDefault();
      onActivate();
    };
    this.overlayEl.addEventListener("pointerdown", activate);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") onActivate();
    });
  }

  setScore(score: number): void {
    this.scoreEl.textContent = String(score);
  }

  setCombo(combo: number): void {
    if (combo > 1) {
      this.comboEl.textContent = `COMBO x${combo}`;
      this.comboEl.classList.add("is-shown");
    } else {
      this.comboEl.classList.remove("is-shown");
    }
  }

  setBest(best: number): void {
    this.bestEl.textContent = best > 0 ? `MEJOR: ${best}` : "";
  }

  showThrowButton(show: boolean): void {
    this.throwBtn.classList.toggle("hidden", !show);
  }

  /** Shows a countdown label ("3" / "2" / "1" / "YA"), or hides it when null. */
  showCountdown(text: string | null): void {
    if (text === null) {
      this.countdownEl.classList.remove("is-shown");
      this.countdownEl.textContent = "";
      return;
    }
    if (this.countdownEl.textContent === text) return;
    this.countdownEl.textContent = text;
    this.countdownEl.classList.remove("is-shown");
    void this.countdownEl.offsetWidth; // reflow so the pop animation restarts
    this.countdownEl.classList.add("is-shown");
  }

  showStart(): void {
    this.titleEl.textContent = "PIZZA EXPRESS";
    this.subtitleEl.textContent = "presioná ENTER o tocá para arrancar";
    this.scoreLineEl.textContent = "";
    this.hintEl.style.display = "block";
    this.comboEl.classList.remove("is-shown");
    this.leaderboard.clear();
    this.overlayEl.classList.remove("hidden");
  }

  /** Global ranking on the game-over screen. */
  showRanking(gameId: string, score: number): void {
    void this.leaderboard.render(gameId, { score });
  }

  showGameOver(score: number, best: number): void {
    this.titleEl.textContent = "¡TE ESTRELLASTE!";
    this.subtitleEl.textContent = "presioná ENTER o tocá para repartir de nuevo";
    this.scoreLineEl.textContent = score >= best && score > 0 ? `PUNTAJE: ${score} — ¡NUEVO RÉCORD!` : `PUNTAJE: ${score}  ·  MEJOR: ${best}`;
    this.hintEl.style.display = "none";
    this.comboEl.classList.remove("is-shown");
    this.overlayEl.classList.remove("hidden");
  }

  hide(): void {
    this.overlayEl.classList.add("hidden");
  }
}
