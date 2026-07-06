import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { chooseMove } from "./ai";
import {
  AI_THINK_MS,
  BEST_KEY,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  MAX_DT,
  SOLO_RESULT_MS,
} from "./constants";
import { Hud } from "./Hud";
import { SharedMatch } from "./sharedMatch";
import {
  applyMove,
  createState,
  ROWS,
  type C4State,
  type Player,
} from "./logic";
import { SoundEffects } from "./SoundEffects";

type State = "ready" | "countdown" | "playing" | "over";

/** El humano es el jugador 0; la IA es el 1 y abre cada partida (juega primero). */
const HUMAN: Player = 0;
const AI: Player = 1;

export class Game {
  private readonly hud: Hud;
  /** Modo sala (multijugador PvP): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;
  /** Tablero compartido; existe solo en modo sala y tras el countdown. */
  private shared: SharedMatch | null = null;

  private state: State = "ready";

  // Modo solo (vs IA, racha de victorias)
  private soloState: C4State | null = null;
  private streak = 0;
  private best: number | null = null;
  /** Bloquea el input mientras la IA piensa o entre partidas de la racha. */
  private busy = false;

  private countdownTime = 0;
  private lastCountdownIndex = -1;
  private lastTime = 0;

  /** Tokens de setTimeout en curso (turno IA / transicion de partida). */
  private pending: number[] = [];
  /** Se incrementa en cada partida nueva: los timeouts viejos se descartan. */
  private runId = 0;

  constructor(container: HTMLElement) {
    const savedBest = localStorage.getItem(BEST_KEY);
    if (savedBest) this.best = parseInt(savedBest, 10);

    this.hud = new Hud(container);
    this.hud.bindColumns(this.handleColumn);

    this.room = initRoomMode("connect-four", {
      getScore: () => this.shared?.myScore() ?? 0,
      onStart: () => this.beginCountdown(),
    });

    this.hud.showStart(this.best, this.room !== null);

    window.addEventListener("keydown", this.handleKeyDown);
    this.hud.overlay.addEventListener("pointerdown", this.handleOverlayTap);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") this.tryStart();
  };

  private handleOverlayTap = (e: Event): void => {
    // El panel de ranking dentro del overlay es interactivo: no arrancar por su clic.
    const target = e.target as HTMLElement;
    if (target !== this.hud.overlay && target.closest("input, button, form")) return;
    this.tryStart();
  };

  private tryStart(): void {
    if (this.state === "ready") {
      this.beginCountdown();
    } else if (this.state === "over") {
      if (this.room) return; // en sala se juega una sola partida por ronda
      this.beginCountdown();
    }
  }

  private beginCountdown(): void {
    this.cancelPending();
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.busy = false;

    this.hud.hideOverlay();

    if (this.room) {
      this.hud.setScore("");
      this.hud.setStatus("");
      this.hud.setBest("");
    } else {
      this.streak = 0;
      this.newSoloMatch();
    }
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private startPlay(): void {
    this.state = "playing";
    if (this.room) {
      this.shared = new SharedMatch(this.room, this.hud, () => {
        this.state = "over";
      });
      this.shared.start();
    } else {
      this.renderSolo();
    }
  }

  // ---------- Modo solo (vs IA) ----------

  private newSoloMatch(): void {
    this.soloState = createState(AI); // la IA abre cada partida
    // Bloquea el input y deja que la IA juegue primero tras una breve pausa.
    this.busy = true;
    this.renderSolo();
    this.schedule(() => this.aiMove(), AI_THINK_MS);
  }

  private handleColumn = (col: number): void => {
    // En modo sala el clic se delega al tablero compartido.
    if (this.room) {
      this.shared?.handleColumn(col);
      return;
    }
    const state = this.soloState;
    if (this.state !== "playing" || !state || this.busy) return;
    if (state.turn !== HUMAN || state.winner !== null || state.draw) return;
    if (state.heights[col] >= ROWS) return;

    this.playSolo(col, HUMAN);
    const after = this.soloState!;
    if (after.winner !== null) {
      this.onMatchWin();
      return;
    }
    if (after.draw) {
      this.onMatchDraw();
      return;
    }
    // Turno de la IA tras una breve pausa para que se lea la jugada.
    this.busy = true;
    this.renderSolo();
    this.schedule(() => this.aiMove(), AI_THINK_MS);
  };

  private aiMove(): void {
    const state = this.soloState;
    if (!state || state.winner !== null || state.draw) return;
    const col = chooseMove(state, AI);
    this.playSolo(col, AI);

    const after = this.soloState!;
    if (after.winner !== null) {
      this.onMatchLose();
      return;
    }
    if (after.draw) {
      this.onMatchDraw();
      return;
    }
    this.busy = false;
    this.renderSolo();
  }

  /** Aplica una jugada al tablero solo con su sonido (sin decidir el flujo). */
  private playSolo(col: number, player: Player): void {
    this.soloState = applyMove(this.soloState!, col);
    SoundEffects.playDrop(player);
    this.renderSolo();
  }

  private onMatchWin(): void {
    this.streak++;
    SoundEffects.playWin();
    this.busy = true;
    this.renderSolo();
    // Se muestra la linea ganadora un momento y arranca la siguiente partida.
    this.schedule(() => this.newSoloMatch(), SOLO_RESULT_MS);
  }

  /** Empate (tablero lleno): no rompe la racha, se juega otra partida. */
  private onMatchDraw(): void {
    SoundEffects.playDraw();
    this.busy = true;
    this.renderSolo();
    this.schedule(() => this.newSoloMatch(), SOLO_RESULT_MS);
  }

  private onMatchLose(): void {
    this.state = "over";
    this.busy = true;
    SoundEffects.playLose();
    this.renderSolo();

    let isNewBest = false;
    if (this.best === null || this.streak > this.best) {
      this.best = this.streak;
      localStorage.setItem(BEST_KEY, String(this.best));
      isNewBest = true;
    }

    this.schedule(() => {
      this.hud.showGameOver(this.streak, isNewBest, this.best!);
      this.hud.showRanking("connect-four", this.streak);
    }, SOLO_RESULT_MS);
  }

  private renderSolo(): void {
    const state = this.soloState;
    if (!state) return;
    this.hud.renderBoard(state.cells, { winningLine: state.winningLine });

    const myTurn =
      this.state === "playing" &&
      state.turn === HUMAN &&
      state.winner === null &&
      !state.draw &&
      !this.busy;
    this.hud.setInteractive(myTurn);
    this.hud.setPreviewColor(myTurn ? HUMAN : null);

    this.hud.setScore(`RACHA: ${this.streak}`);
    this.hud.setBest(this.best !== null ? `MEJOR: ${this.best}` : "MEJOR: --");

    if (state.winner === HUMAN) this.hud.setStatus("GANASTE", true);
    else if (state.winner === AI) this.hud.setStatus("PERDISTE");
    else if (state.draw) this.hud.setStatus("EMPATE");
    else if (state.turn === HUMAN) this.hud.setStatus("TU TURNO", true);
    else this.hud.setStatus("PIENSA LA IA");
  }

  // ---------- Timers ----------

  private schedule(fn: () => void, delayMs: number): void {
    const id = this.runId;
    const handle = window.setTimeout(() => {
      if (id !== this.runId) return;
      fn();
    }, delayMs);
    this.pending.push(handle);
  }

  private cancelPending(): void {
    this.runId++;
    this.pending.forEach((h) => window.clearTimeout(h));
    this.pending = [];
  }

  // ---------- Loop ----------

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    if (this.state === "countdown") {
      this.countdownTime += dt;
      const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
      if (index >= COUNTDOWN_LABELS.length) {
        this.hud.showCountdown(null);
        this.startPlay();
      } else if (index !== this.lastCountdownIndex) {
        this.lastCountdownIndex = index;
        SoundEffects.playCountdownTick();
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    }

    requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.cancelPending();
    window.removeEventListener("keydown", this.handleKeyDown);
    this.hud.overlay.removeEventListener("pointerdown", this.handleOverlayTap);
  }
}
