import { 
  TOTAL_ROUNDS, 
  MIN_DELAY, 
  MAX_DELAY, 
  BEST_KEY, 
  COUNTDOWN_LABELS, 
  COUNTDOWN_STEP, 
  MAX_DT 
} from "./constants";
import { Hud, type RoundStatus } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "waitingForTrigger" | "triggerActive" | "earlyClick" | "roundFinished" | "gameOver";

export class Game {
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private state: State = "ready";
  private currentRound = 0;
  private roundTimes: number[] = [];
  private roundStatuses: RoundStatus[] = [];
  
  private bestAverage: number | null = null;
  private lastTime = 0;
  
  // Timers
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  private triggerDelay = 0;
  private triggerTimestamp = 0;
  
  // Clickable elements and event listeners
  private reactionCardEl!: HTMLDivElement;

  constructor(container: HTMLElement) {
    // Load best score

    const savedBest = localStorage.getItem(BEST_KEY);
    if (savedBest) {
      this.bestAverage = parseFloat(savedBest);
    }
    
    // Init HUD
    this.hud = new Hud(container);
    this.hud.showStart(this.bestAverage);

    // Parcial por timeout: promedio de las rondas completadas hasta ahora.
    this.room = initRoomMode("reaction-time", {
      getScore: () => this.calculateCurrentAverage() ?? 0,
      onStart: () => this.beginCountdown(),
    });
    
    // Retrieve reference to the reaction card for input binding
    this.reactionCardEl = container.querySelector(".reaction-card")!;
    
    this.bindInputs();
    
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }
  
  private bindInputs(): void {
    // Click / touch input on the main reaction card
    this.reactionCardEl.addEventListener("mousedown", this.handleInteraction);
    this.reactionCardEl.addEventListener("touchstart", this.handleTouchInteraction, { passive: false });
    
    // Keyboard input
    window.addEventListener("keydown", this.handleKeyDown);
  }
  
  private handleTouchInteraction = (e: TouchEvent): void => {
    e.preventDefault(); // Prevent double triggers on mobile
    this.onAction();
  };

  private handleInteraction = (e: MouseEvent): void => {
    if (e.button === 0) { // Left click
      this.onAction();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      // Space is only mapped to play actions, not start/restart so users don't accidentally skip menus
      if (this.state === "ready" || this.state === "gameOver" || this.state === "roundFinished" || this.state === "earlyClick") {
        if (e.key === "Enter") {
          this.onAction();
        }
      } else {
        this.onAction();
      }
    }
  };
  
  private onAction(): void {
    switch (this.state) {
      case "ready":
        this.beginCountdown();
        break;
        
      case "countdown":
        // Do nothing during pre-run countdown
        break;
        
      case "waitingForTrigger":
        // Foul! Clicked too early
        this.handleEarlyClick();
        break;
        
      case "triggerActive":
        // Success! Reaction recorded
        this.handleReactionClick();
        break;
        
      case "earlyClick":
        // Acknowledge and retry the current round
        this.startRound();
        break;
        
      case "roundFinished":
        // Proceed to next round or finish game
        if (this.currentRound < TOTAL_ROUNDS) {
          this.currentRound++;
          this.startRound();
        } else {
          this.endGame();
        }
        break;
        
      case "gameOver":
        // En modo sala se juega una sola partida por ronda: sin reintento.
        if (this.room) return;
        this.beginCountdown();
        break;
    }
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.currentRound = 1;
    this.roundTimes = [];
    this.roundStatuses = Array(TOTAL_ROUNDS).fill("empty");
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    
    this.hud.hideOverlay();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
    this.hud.updateRoundProgress(this.currentRound, this.roundStatuses);
  }
  
  private startRound(): void {
    this.state = "waitingForTrigger";
    
    // Calculate random trigger delay
    this.triggerDelay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    
    // Set status of current round to empty (so it flashes/animates)
    this.roundStatuses[this.currentRound - 1] = "empty";
    
    const currentAverage = this.calculateCurrentAverage();
    this.hud.showWaitingState(this.currentRound, currentAverage);
    this.hud.updateRoundProgress(this.currentRound, this.roundStatuses);
  }
  
  private handleEarlyClick(): void {
    this.state = "earlyClick";
    this.roundStatuses[this.currentRound - 1] = "foul";
    SoundEffects.playFoul();

    this.hud.showEarlyClickState();
    this.hud.updateRoundProgress(this.currentRound, this.roundStatuses);
  }
  
  private handleReactionClick(): void {
    const clickTime = performance.now();
    const reactionTime = Math.round(clickTime - this.triggerTimestamp);
    
    this.roundTimes.push(reactionTime);
    this.roundStatuses[this.currentRound - 1] = "success";
    
    this.state = "roundFinished";
    SoundEffects.playReaction();
    this.hud.showResultState(reactionTime);
    this.hud.updateRoundProgress(this.currentRound, this.roundStatuses);
  }
  
  private endGame(): void {
    const sum = this.roundTimes.reduce((a, b) => a + b, 0);
    const average = sum / this.roundTimes.length;
    
    let isNewBest = false;
    if (this.bestAverage === null || average < this.bestAverage) {
      this.bestAverage = average;
      localStorage.setItem(BEST_KEY, average.toString());
      isNewBest = true;
    }
    
    this.state = "gameOver";
    SoundEffects.playFinish();
    this.hud.showGameOver(this.roundTimes, average, isNewBest, this.bestAverage);
    if (this.room) this.room.reportScore(average);
    else this.hud.showRanking("reaction-time", average);
  }
  
  private calculateCurrentAverage(): number | null {
    if (this.roundTimes.length === 0) return null;
    const sum = this.roundTimes.reduce((a, b) => a + b, 0);
    return sum / this.roundTimes.length;
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
        this.startRound();
      } else if (index !== this.lastCountdownIndex) {
        this.lastCountdownIndex = index;
        SoundEffects.playCountdownTick();
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    } else if (this.state === "waitingForTrigger") {
      this.triggerDelay -= dt;
      if (this.triggerDelay <= 0) {
        this.state = "triggerActive";
        this.triggerTimestamp = performance.now();
        this.hud.showTriggerState();
        SoundEffects.playGo();
      }
    }
  }
  
  dispose(): void {
    this.reactionCardEl.removeEventListener("mousedown", this.handleInteraction);
    this.reactionCardEl.removeEventListener("touchstart", this.handleTouchInteraction);
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
