import { GROUND_HEIGHT, MAX_DT, PIPE_SPEED, VIEW_HEIGHT, VIEW_WIDTH } from "./constants";
import { Bird } from "./Bird";
import { PipeField } from "./PipeField";
import { Renderer } from "./Renderer";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "flappy-bird:best";

/** Countdown before a run starts: one label shown per COUNTDOWN_STEP seconds. */
const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;

/** Orchestrates canvas, state machine and the fixed-view game loop. */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bird = new Bird();
  private readonly pipes = new PipeField();
  private readonly renderer = new Renderer();
  private readonly hud: Hud;
  private readonly input: InputController;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private state: State = "ready";
  private score = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  private groundScroll = 0;
  private lastTime = 0;
  /** Delay before flap can restart after dying, avoids an instant retry. */
  private deadFor = 0;
  /** Elapsed time in the pre-run countdown. */
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container);
    this.hud.setBest(this.best);
    this.hud.showScore(false);
    this.hud.showStart();

    this.room = initRoomMode("flappy-bird", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    // Listen on the container, not the canvas: the start / game-over overlay
    // sits above the canvas, so taps there must still start the game (mobile
    // has no Enter key). The leaderboard stops propagation for its own UI.
    this.input = new InputController(container, () => this.onFlap());

    this.resize();
    window.addEventListener("resize", this.resize);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private onFlap(): void {
    switch (this.state) {
      case "ready":
        this.beginCountdown();
        break;
      case "playing":
        this.bird.flap();
        SoundEffects.playFlap();
        break;
      case "dead":
        // En modo sala se juega una sola partida por ronda: sin reintento.
        if (this.room) return;
        if (this.deadFor > 0.6) this.beginCountdown();
        break;
    }
  }

  /** Resets the world and runs the 3-2-1-YA countdown before play begins. */
  private beginCountdown(): void {
    this.bird.reset();
    this.pipes.reset();
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.showScore(false);
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private start(): void {
    this.state = "playing";
    this.score = 0;
    this.hud.setScore(0);
    this.hud.showScore(true);
    this.hud.hide();
    this.hud.showCountdown(null);
  }

  private die(): void {
    this.state = "dead";
    this.deadFor = 0;
    SoundEffects.playHit();
    this.hud.showScore(false);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.hud.setBest(this.best);
    }
    this.hud.showGameOver(this.score, this.best);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("flappy-bird", this.score);
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    this.renderer.update(dt);

    if (this.state === "playing") {
      this.groundScroll += PIPE_SPEED * dt;
      this.bird.update(dt);
      const gained = this.pipes.update(dt, this.bird.x);
      if (gained > 0) {
        this.score += gained;
        SoundEffects.playScore();
      }
      this.hud.setScore(this.score);

      const floor = VIEW_HEIGHT - GROUND_HEIGHT - this.bird.radius;
      if (this.bird.y >= floor) {
        this.bird.y = floor;
        this.die();
      } else if (this.bird.y - this.bird.radius <= 0 || this.pipes.collides(this.bird)) {
        this.die();
      }
    } else if (this.state === "ready" || this.state === "countdown") {
      // Gentle idle bob so the bird reads as alive on the start/countdown screen.
      this.bird.y = VIEW_HEIGHT * 0.45 + Math.sin(this.lastTime / 260) * 8;
      if (this.state === "countdown") this.updateCountdown(dt);
    } else if (this.state === "dead") {
      this.deadFor += dt;
      // Let the bird finish falling to the ground after a mid-air death.
      const floor = VIEW_HEIGHT - GROUND_HEIGHT - this.bird.radius;
      if (this.bird.y < floor) {
        this.bird.update(dt);
        if (this.bird.y > floor) this.bird.y = floor;
      }
    }
  }

  /** Advances the countdown, updating the label and starting play when done. */
  private updateCountdown(dt: number): void {
    this.countdownTime += dt;
    const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
    if (index >= COUNTDOWN_LABELS.length) this.start();
    else if (index !== this.lastCountdownIndex) {
      this.lastCountdownIndex = index;
      SoundEffects.playCountdownTick();
      this.hud.showCountdown(COUNTDOWN_LABELS[index]);
    }
  }

  private render(): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);
    // Clip to the fixed view box so pipes scrolling past the left edge don't
    // linger in the letterbox side bars on wide windows.
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.clip();
    this.renderer.draw(ctx, this.bird, this.pipes, this.groundScroll);
    ctx.restore();
  }

  // --- Canvas scaling: fit the fixed VIEW box into the window, letterboxed. ---
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const fit = Math.min(w / VIEW_WIDTH, h / VIEW_HEIGHT);
    this.scale = fit * dpr;
    this.offsetX = (w / fit - VIEW_WIDTH) / 2;
    this.offsetY = (h / fit - VIEW_HEIGHT) / 2;
  };

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
  }
}
