import {
  DEFAULT_DISCS,
  BEST_KEY_PREFIX,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  MAX_DT,
  PEG_COUNT,
  TARGET_PEG,
} from "./constants";
import { Hud } from "./Hud";
import { RoomVote } from "./roomVote";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { encodeMovesTime } from "../../../shared/scoring";

type State = "ready" | "roomVote" | "countdown" | "playing" | "victory";

export class Game {
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;
  /** Votacion de discos previa a jugar (solo en modo sala). */
  private readonly roomVote: RoomVote | null = null;
  private state: State = "ready";

  private discs: number = DEFAULT_DISCS;
  /** Cada varilla es una pila de tamanos, del fondo (indice 0) al tope. */
  private pegs: number[][] = [];
  private selected: number | null = null;

  private moves: number = 0;
  private elapsedTime: number = 0;
  private lastTime: number = 0;

  private countdownTime: number = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;

  constructor(container: HTMLElement) {
    this.hud = new Hud(container);
    this.hud.showStart(this.handleSelectDiscs);

    // Parcial por timeout: movimientos + tiempo codificados (points.ts sabe que
    // un parcial "lower" sin resolver no compite con una torre resuelta).
    this.room = initRoomMode("tower-of-hanoi", {
      getScore: () => encodeMovesTime(this.moves, this.elapsedTime),
      onStart: () => this.startRoomVote(),
    });
    if (this.room) {
      this.state = "roomVote";
      this.roomVote = new RoomVote(this.room, this.hud, (discs) => this.startWithDiscs(discs));
    }

    this.bindInputs();

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private handleSelectDiscs = (discs: number): void => {
    this.discs = discs;
  };

  private startRoomVote(): void {
    this.roomVote?.start();
  }

  /** Arranca la ronda de sala con los discos votados. */
  private startWithDiscs(discs: number): void {
    this.discs = discs;
    this.beginCountdown();
  }

  private bindInputs(): void {
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      // En modo sala no hay arranque ni reintento manual: lo maneja la sala.
      if (this.room) return;
      if (this.state === "ready" || this.state === "victory") {
        this.beginCountdown();
      }
    } else if (this.state === "playing") {
      // Teclas 1 / 2 / 3: seleccionar / mover como si se tocara cada varilla.
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx >= 0 && idx < PEG_COUNT) this.handlePegClick(idx);
    }
  };

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.selected = null;
    this.hud.hideOverlay();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);

    this.hud.setupBoard(this.discs, this.handlePegClick);
    this.initBoard();
    this.hud.renderBoard(this.pegs, this.selected);
  }

  private initBoard(): void {
    this.pegs = [];
    for (let p = 0; p < PEG_COUNT; p++) this.pegs.push([]);
    // Toda la torre en la primera varilla: mas grande abajo, mas chico arriba.
    for (let size = this.discs; size >= 1; size--) this.pegs[0].push(size);
    this.selected = null;
  }

  private handlePegClick = (peg: number): void => {
    if (this.state !== "playing") return;
    if (peg < 0 || peg >= PEG_COUNT) return;

    if (this.selected === null) {
      // Levantar el disco de arriba, si la varilla no esta vacia.
      if (this.pegs[peg].length === 0) return;
      this.selected = peg;
      SoundEffects.playPick();
      this.hud.renderBoard(this.pegs, this.selected);
      return;
    }

    if (this.selected === peg) {
      // Volver a tocar la misma varilla: soltar sin mover.
      this.selected = null;
      this.hud.renderBoard(this.pegs, this.selected);
      return;
    }

    const from = this.pegs[this.selected];
    const to = this.pegs[peg];
    const disc = from[from.length - 1];
    const topTarget = to.length > 0 ? to[to.length - 1] : Infinity;

    if (disc < topTarget) {
      from.pop();
      to.push(disc);
      this.selected = null;
      this.moves++;
      SoundEffects.playDrop();
      this.hud.renderBoard(this.pegs, this.selected);
      this.hud.updateStats(this.moves, this.elapsedTime);
      if (this.checkWin()) this.handleVictory();
    } else {
      // Movimiento invalido: no se puede apoyar un disco sobre otro mas chico.
      this.selected = null;
      SoundEffects.playInvalid();
      this.hud.renderBoard(this.pegs, this.selected);
    }
  };

  private checkWin(): boolean {
    return this.pegs[TARGET_PEG].length === this.discs;
  }

  private handleVictory(): void {
    this.state = "victory";
    SoundEffects.playVictory();

    const movesKey = `${BEST_KEY_PREFIX}${this.discs}_moves`;
    const timeKey = `${BEST_KEY_PREFIX}${this.discs}_time`;

    const savedBestMoves = localStorage.getItem(movesKey);
    const savedBestTime = localStorage.getItem(timeKey);

    let isNewBestMoves = false;
    let isNewBestTime = false;
    let bestMoves = this.moves;
    let bestTime = this.elapsedTime;

    if (savedBestMoves === null || this.moves < parseInt(savedBestMoves, 10)) {
      localStorage.setItem(movesKey, this.moves.toString());
      isNewBestMoves = true;
    } else {
      bestMoves = parseInt(savedBestMoves, 10);
    }

    if (savedBestTime === null || this.elapsedTime < parseFloat(savedBestTime)) {
      localStorage.setItem(timeKey, this.elapsedTime.toString());
      isNewBestTime = true;
    } else {
      bestTime = parseFloat(savedBestTime);
    }

    this.hud.showVictory(
      this.moves,
      this.elapsedTime,
      isNewBestMoves,
      isNewBestTime,
      bestMoves,
      bestTime,
      this.discs,
      this.room !== null,
    );

    // El ranking global se ordena por movimientos (menos mejor) y el tiempo
    // desempata; el puntaje codifica ambos (ver encodeMovesTime).
    const rankedScore = encodeMovesTime(this.moves, this.elapsedTime);
    if (this.room) this.room.reportScore(rankedScore);
    else this.hud.showRanking("tower-of-hanoi", rankedScore, this.discs);
  }

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
        this.state = "playing";
        this.moves = 0;
        this.elapsedTime = 0;
        this.hud.hideOverlay();
        this.hud.updateStats(this.moves, this.elapsedTime);
      } else if (index !== this.lastCountdownIndex) {
        this.lastCountdownIndex = index;
        SoundEffects.playCountdownTick();
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    } else if (this.state === "playing") {
      this.elapsedTime += dt;
      this.hud.updateStats(this.moves, this.elapsedTime);
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
