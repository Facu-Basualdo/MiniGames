import {
  GAME_DURATION,
  BEST_KEY,
  VISIBLE_WORDS,
  WORD_POOL,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  MAX_DT,
} from "./constants";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "playing" | "gameOver";

/** Result of a completed 30-second sprint. */
export interface TypingResult {
  wpm: number;
  accuracy: number; // 0..100
  correctWords: number;
}

export class Game {
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private state: State = "ready";

  // Word stream
  private words: string[] = [];
  private currentIndex = 0;
  private typedInput = "";

  // Live stats
  private timeLeft = GAME_DURATION;
  private wpmCorrectChars = 0; // correctly typed chars (+ spaces) for WPM
  private accuracyCorrect = 0; // correctly typed chars for accuracy
  private accuracyTotal = 0; // all counted keystrokes for accuracy
  private correctWords = 0;

  private bestWpm: number | null = null;

  // Timers
  private countdownTime = 0;
  private lastCountdownIndex = -1;

  private lastTime = 0;

  constructor(container: HTMLElement) {
    const savedBest = localStorage.getItem(BEST_KEY);
    if (savedBest) this.bestWpm = parseInt(savedBest, 10);

    this.hud = new Hud(container);
    this.hud.showStart(this.bestWpm);

    // Parcial por timeout: WPM en vivo de lo tecleado hasta el momento.
    this.room = initRoomMode("typing-race", {
      getScore: () => this.liveWpm(),
      onStart: () => this.beginCountdown(),
    });

    window.addEventListener("keydown", this.handleKeyDown);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.state === "playing") {
      this.handleTypingKey(e);
      return;
    }

    if (e.key !== "Enter") return;
    if (this.state === "ready") {
      this.beginCountdown();
    } else if (this.state === "gameOver") {
      // En modo sala se juega una sola partida por ronda: sin reintento.
      if (this.room) return;
      this.beginCountdown();
    }
  };

  private handleTypingKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      if (this.typedInput.length > 0) {
        this.typedInput = this.typedInput.slice(0, -1);
        this.renderStream();
      }
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      this.submitWord();
      return;
    }

    // Only single printable characters count as typing.
    if (e.key.length !== 1) return;

    const target = this.words[this.currentIndex] ?? "";
    const pos = this.typedInput.length;
    this.typedInput += e.key;

    const correct = e.key === target[pos];
    if (correct) SoundEffects.playKey();
    else SoundEffects.playError();

    this.renderStream();
  }

  private submitWord(): void {
    // Ignore a space pressed with an empty buffer (no skipping words).
    if (this.typedInput.length === 0) return;

    const target = this.words[this.currentIndex] ?? "";

    let matched = 0;
    for (let i = 0; i < target.length; i++) {
      if (this.typedInput[i] === target[i]) matched++;
    }

    const perfect = this.typedInput === target;
    this.wpmCorrectChars += matched + (perfect ? 1 : 0); // +1 for the space
    this.accuracyCorrect += matched;
    this.accuracyTotal += this.typedInput.length;

    if (perfect) {
      this.correctWords++;
      SoundEffects.playWord();
    }

    this.currentIndex++;
    this.typedInput = "";
    this.ensureWordsAhead();

    this.hud.updateStats(this.timeLeft, this.liveWpm(), this.liveAccuracy());
    this.renderStream();
  }

  private ensureWordsAhead(): void {
    while (this.words.length < this.currentIndex + VISIBLE_WORDS) {
      this.words.push(WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)]);
    }
  }

  private beginCountdown(): void {
    this.state = "countdown";

    this.words = [];
    this.currentIndex = 0;
    this.typedInput = "";
    this.timeLeft = GAME_DURATION;
    this.wpmCorrectChars = 0;
    this.accuracyCorrect = 0;
    this.accuracyTotal = 0;
    this.correctWords = 0;
    this.ensureWordsAhead();

    this.countdownTime = 0;
    this.lastCountdownIndex = -1;

    this.hud.hideOverlay();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private startPlaying(): void {
    this.state = "playing";
    this.hud.showPlay();
    this.hud.updateStats(this.timeLeft, 0, 100);
    this.renderStream();
  }

  private renderStream(): void {
    this.hud.renderStream(this.words, this.currentIndex, this.typedInput);
  }

  private liveWpm(): number {
    const elapsed = GAME_DURATION - this.timeLeft;
    if (elapsed < 1) return 0;
    return Math.round(this.wpmCorrectChars / 5 / (elapsed / 60));
  }

  private liveAccuracy(): number {
    if (this.accuracyTotal === 0) return 100;
    return Math.round((this.accuracyCorrect / this.accuracyTotal) * 100);
  }

  private endGame(): void {
    this.state = "gameOver";

    const wpm = Math.round(this.wpmCorrectChars / 5 / (GAME_DURATION / 60));
    const accuracy = this.liveAccuracy();

    let isNewBest = false;
    if (this.bestWpm === null || wpm > this.bestWpm) {
      this.bestWpm = wpm;
      localStorage.setItem(BEST_KEY, wpm.toString());
      isNewBest = true;
    }

    SoundEffects.playFinish();
    this.hud.showGameOver(
      { wpm, accuracy, correctWords: this.correctWords },
      isNewBest,
      this.bestWpm
    );

    if (this.room) this.room.reportScore(wpm);
    else this.hud.showRanking("typing-race", wpm);
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
        this.startPlaying();
      } else if (index !== this.lastCountdownIndex) {
        this.lastCountdownIndex = index;
        SoundEffects.playCountdownTick();
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    } else if (this.state === "playing") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.hud.updateStats(0, this.liveWpm(), this.liveAccuracy());
        this.endGame();
      } else {
        this.hud.updateStats(this.timeLeft, this.liveWpm(), this.liveAccuracy());
      }
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
