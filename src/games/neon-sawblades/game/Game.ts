import { MAX_DT, MAX_TIME, START_TIME, VIEW_HEIGHT, VIEW_WIDTH } from "./constants";
import { Player } from "./Player";
import { SawbladeField } from "./SawbladeField";
import { Renderer } from "./Renderer";
import { Particles } from "./Particles";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "neon-sawblades:best";

/** Countdown before a run starts: one label shown per COUNTDOWN_STEP seconds. */
const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;

/** Death screen-shake. */
const SHAKE_DURATION = 0.4;
const SHAKE_MAGNITUDE = 16;

/** Burst colours (match the neon palette in Renderer). */
const SAW_BURST = "#ff2d78";
const COIN_BURST = "#ffd23f";

/** Orchestrates the canvas, the state machine and the fixed-view game loop. */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly player = new Player();
  private readonly field = new SawbladeField();
  private readonly renderer = new Renderer();
  private readonly particles = new Particles();
  private readonly hud: Hud;
  private readonly input: InputController;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private state: State = "ready";
  private score = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  private timeLeft = START_TIME;
  private lastTime = 0;
  /** Delay before a jump can restart after dying, avoids an instant retry. */
  private deadFor = 0;
  /** Elapsed time in the pre-run countdown. */
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  /** Remaining death-shake time. */
  private shakeTime = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container);
    this.hud.setBest(this.best);
    this.hud.showScore(false);
    this.hud.showStart();

    this.room = initRoomMode("neon-sawblades", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    this.input = new InputController(container, {
      onAction: () => this.onAction(),
      onActionRelease: () => this.onActionRelease(),
    });

    this.resize();
    window.addEventListener("resize", this.resize);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private onAction(): void {
    switch (this.state) {
      case "ready":
        this.beginCountdown();
        break;
      case "playing":
        if (this.player.jump()) SoundEffects.playJump();
        break;
      case "dead":
        // En modo sala se juega una sola partida por ronda: sin reintento.
        if (this.room) return;
        if (this.deadFor > 0.6) this.beginCountdown();
        break;
    }
  }

  private onActionRelease(): void {
    if (this.state === "playing") this.player.releaseJump();
  }

  /** Resets the world and runs the 3-2-1-YA countdown before play begins. */
  private beginCountdown(): void {
    this.player.reset();
    this.field.reset();
    this.particles.clear();
    this.renderer.resetTrail();
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
    this.timeLeft = START_TIME;
    this.hud.setScore(0);
    this.hud.showScore(true);
    this.hud.hide();
    this.hud.showCountdown(null);
  }

  private die(): void {
    this.state = "dead";
    this.deadFor = 0;
    this.shakeTime = SHAKE_DURATION;
    this.particles.burst(this.player.x, this.player.centerY, SAW_BURST, 26, 360);
    SoundEffects.playHit();
    this.hud.showScore(false);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.hud.setBest(this.best);
    }
    this.hud.showGameOver(this.score, this.best);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("neon-sawblades", this.score);
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
    this.particles.update(dt);
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);

    if (this.state === "playing") {
      this.player.update(dt, this.input.dir);
      const res = this.field.update(dt, this.player);

      for (const b of res.bursts) {
        if (b.kind === "saw") this.particles.burst(b.x, b.y, SAW_BURST, 14, 260);
        else this.particles.burst(b.x, b.y, COIN_BURST, 10, 200);
      }
      if (res.sawsDestroyed > 0) SoundEffects.playDestroy();
      if (res.coinsCollected > 0) SoundEffects.playCoin();
      if (res.points > 0) {
        this.score += res.points;
        this.hud.setScore(this.score);
      }
      if (res.timeGained > 0) {
        this.timeLeft = Math.min(this.timeLeft + res.timeGained, MAX_TIME);
      }

      this.timeLeft -= dt;
      if (res.died || this.timeLeft <= 0) {
        this.timeLeft = Math.max(0, this.timeLeft);
        this.die();
      }
    } else if (this.state === "countdown") {
      this.updateCountdown(dt);
    } else if (this.state === "dead") {
      this.deadFor += dt;
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

    // Death screen-shake: jitter the world (not the letterbox bars).
    if (this.shakeTime > 0) {
      const amt = SHAKE_MAGNITUDE * (this.shakeTime / SHAKE_DURATION);
      ctx.translate((Math.random() * 2 - 1) * amt, (Math.random() * 2 - 1) * amt);
    }

    ctx.beginPath();
    ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.clip();
    this.renderer.draw(ctx, this.player, this.field, this.particles, this.timeLeft / MAX_TIME);
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
