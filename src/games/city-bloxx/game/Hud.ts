import { LeaderboardPanel } from "../../../shared/LeaderboardPanel";

/** DOM overlay: live floor count, a balance meter, and start / game-over screens. */
export class Hud {
  private readonly scoreEl: HTMLDivElement;
  private readonly bestEl: HTMLDivElement;
  private readonly balanceEl: HTMLDivElement;
  private readonly balanceMarkerEl: HTMLDivElement;
  private readonly overlayEl: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly subtitleEl: HTMLDivElement;
  private readonly scoreLineEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private readonly countdownEl: HTMLDivElement;
  private readonly leaderboard = new LeaderboardPanel();

  constructor(container: HTMLElement) {
    const hud = document.createElement("div");
    hud.className = "hud";

    this.scoreEl = document.createElement("div");
    this.scoreEl.className = "hud__score";
    this.scoreEl.textContent = "0";

    this.bestEl = document.createElement("div");
    this.bestEl.className = "hud__best";

    this.balanceEl = document.createElement("div");
    this.balanceEl.className = "hud__balance";
    this.balanceMarkerEl = document.createElement("div");
    this.balanceMarkerEl.className = "hud__balance-marker";
    this.balanceEl.append(this.balanceMarkerEl);

    hud.append(this.scoreEl, this.bestEl, this.balanceEl);

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
    this.hintEl.textContent = "espacio / clic / toca para soltar el piso";

    this.overlayEl.append(this.titleEl, this.subtitleEl, this.scoreLineEl, this.hintEl);
    this.leaderboard.mount(this.overlayEl);
    this.leaderboard.clear();

    this.countdownEl = document.createElement("div");
    this.countdownEl.className = "countdown";

    container.append(hud, this.overlayEl, this.countdownEl);
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
    // Force reflow so re-adding the class restarts the pop animation.
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add("is-shown");
  }

  setScore(score: number): void {
    this.scoreEl.textContent = String(score);
  }

  setBest(best: number): void {
    this.bestEl.textContent = best > 0 ? `MEJOR: ${best}` : "";
  }

  /** Positions the balance marker; ratio in [-1, 1], 0 = centered/stable. */
  setBalance(ratio: number): void {
    const pct = 50 + Math.max(-1, Math.min(1, ratio)) * 50;
    this.balanceMarkerEl.style.left = `${pct}%`;
    const danger = Math.abs(ratio) > 0.7;
    this.balanceEl.classList.toggle("is-danger", danger);
  }

  showScore(visible: boolean): void {
    this.scoreEl.style.visibility = visible ? "visible" : "hidden";
    this.balanceEl.style.visibility = visible ? "visible" : "hidden";
  }

  showStart(): void {
    this.titleEl.textContent = "SKYLINE";
    this.subtitleEl.textContent = "presiona ENTER o toca para empezar";
    this.scoreLineEl.textContent = "";
    this.hintEl.style.display = "block";
    this.leaderboard.clear();
    this.overlayEl.classList.remove("hidden");
  }

  showGameOver(score: number, best: number): void {
    this.titleEl.textContent = "SE DERRUMBO";
    this.subtitleEl.textContent = "presiona ENTER o toca para reintentar";
    this.scoreLineEl.textContent =
      score >= best && score > 0
        ? `PISOS: ${score} — ¡NUEVO MEJOR!`
        : `PISOS: ${score}  ·  MEJOR: ${best}`;
    this.hintEl.style.display = "none";
    this.overlayEl.classList.remove("hidden");
  }

  /** Muestra el ranking global del juego en la pantalla de game-over. */
  showRanking(gameId: string, score: number): void {
    void this.leaderboard.render(gameId, { score });
  }

  hide(): void {
    this.overlayEl.classList.add("hidden");
  }
}
