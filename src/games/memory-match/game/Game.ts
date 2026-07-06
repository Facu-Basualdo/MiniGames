import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { encodeTimeMoves } from "../../../shared/scoring";
import {
  applyFlip,
  canFlip,
  createState,
  isComplete,
  pairsOf,
  SOLO_DIMS,
  type MemoryState,
} from "./board";
import {
  BEST_MOVES_KEY,
  BEST_TIME_KEY,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  MAX_DT,
  REVEAL_HOLD_MS,
} from "./constants";
import { Hud } from "./Hud";
import { SharedMatch } from "./sharedMatch";
import { SoundEffects } from "./SoundEffects";

type State = "ready" | "countdown" | "playing" | "over";

/** Nombre del unico jugador del modo solo (turnOrder de un solo lugar). */
const SOLO_PLAYER = "yo";

export class Game {
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;
  /** Tablero compartido; existe solo en modo sala y tras el countdown. */
  private shared: SharedMatch | null = null;
  private state: State = "ready";

  // Modo solo (completar el tablero midiendo tiempo y movimientos)
  private soloState: MemoryState | null = null;
  private moves = 0;
  private elapsed = 0;
  private holdUp: number[] = [];
  private animating = false;

  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  private lastTime = 0;

  constructor(container: HTMLElement) {
    this.hud = new Hud(container);
    // Parcial por timeout en sala: pares propios del tablero compartido (el
    // modo solo no corre nunca en sala, asi que getScore solo mira shared).
    this.room = initRoomMode("memory-match", {
      getScore: () => this.shared?.myPairs() ?? 0,
      onStart: () => this.beginCountdown(),
    });

    this.hud.showStart(this.loadBest(), this.room !== null);
    this.hud.onOverlayTap(() => this.tryStart());
    window.addEventListener("keydown", this.handleKeyDown);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") this.tryStart();
  };

  private tryStart(): void {
    // En sala se juega una sola partida por ronda: sin reintento.
    if (this.state === "over" && this.room) return;
    if (this.state === "ready" || this.state === "over") this.beginCountdown();
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.hideOverlay();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);

    if (this.room) {
      this.hud.setTurnText("");
    } else {
      this.moves = 0;
      this.elapsed = 0;
      this.newSoloBoard();
    }
  }

  private startPlay(): void {
    this.state = "playing";
    if (this.room) {
      this.shared = new SharedMatch(this.room, this.hud, () => {
        this.state = "over";
      });
      this.shared.start();
    }
  }

  // ---------- Modo solo ----------

  private newSoloBoard(): void {
    this.soloState = createState(SOLO_DIMS.pairs, [SOLO_PLAYER]);
    this.holdUp = [];
    this.animating = false;
    this.hud.setupBoard(SOLO_DIMS.cols, this.soloState.cards, (i) => this.handleSoloFlip(i));
    this.renderSolo();
  }

  private handleSoloFlip(index: number): void {
    const state = this.soloState;
    if (this.state !== "playing" || !state || this.animating) return;
    if (!canFlip(state, SOLO_PLAYER, index)) return;

    const next = applyFlip(state, SOLO_PLAYER, index);
    this.soloState = next;
    SoundEffects.playFlip();

    const reveal = next.reveal;
    if (!reveal) {
      // Primera carta del intento.
      this.renderSolo();
      return;
    }

    // Segunda carta: el intento cuenta como un movimiento (acierto o no).
    this.moves++;

    if (reveal.matchedBy !== null) {
      SoundEffects.playMatch();
      this.renderSolo();
      if (isComplete(next)) this.endSolo();
    } else {
      SoundEffects.playFail();
      this.animating = true;
      this.holdUp = [reveal.a, reveal.b];
      this.renderSolo();
      window.setTimeout(() => {
        this.holdUp = [];
        this.animating = false;
        this.renderSolo();
      }, REVEAL_HOLD_MS);
    }
  }

  private renderSolo(): void {
    const state = this.soloState;
    if (!state) return;
    const faceUp = state.cards.map(
      (_, i) =>
        state.matchedBy[i] !== null || state.flipped.includes(i) || this.holdUp.includes(i),
    );
    const owners = state.matchedBy.map((owner) => (owner === null ? null : 0));
    this.hud.renderCards(faceUp, owners);
    this.hud.setSoloStats(this.moves, pairsOf(state, SOLO_PLAYER), SOLO_DIMS.pairs, this.elapsed);
  }

  private endSolo(): void {
    this.state = "over";
    SoundEffects.playVictory();

    const prev = this.loadBest();
    const isNewBestTime = prev.time === null || this.elapsed < prev.time;
    const isNewBestMoves = prev.moves === null || this.moves < prev.moves;
    if (isNewBestTime) localStorage.setItem(BEST_TIME_KEY, String(this.elapsed));
    if (isNewBestMoves) localStorage.setItem(BEST_MOVES_KEY, String(this.moves));

    this.hud.showGameOver(this.elapsed, this.moves, isNewBestTime || isNewBestMoves);
    // Un unico ranking combinado: se ordena por tiempo, los movimientos
    // desempatan y se muestran al lado (encodeTimeMoves).
    this.hud.showSoloRanking(encodeTimeMoves(this.elapsed, this.moves));
  }

  private loadBest(): { time: number | null; moves: number | null } {
    const rawTime = localStorage.getItem(BEST_TIME_KEY);
    const rawMoves = localStorage.getItem(BEST_MOVES_KEY);
    return {
      time: rawTime === null ? null : parseFloat(rawTime),
      moves: rawMoves === null ? null : parseInt(rawMoves, 10),
    };
  }

  // ---------- Loop ----------

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    this.update(dt);
    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
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
    } else if (this.state === "playing" && !this.room && this.soloState) {
      this.elapsed += dt;
      this.hud.setSoloStats(
        this.moves,
        pairsOf(this.soloState, SOLO_PLAYER),
        SOLO_DIMS.pairs,
        this.elapsed,
      );
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
