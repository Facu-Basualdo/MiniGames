import {
  CAM_LERP,
  DROP_GRAVITY,
  HOOK_FLOAT,
  HOOK_SCREEN_Y,
  MAX_DT,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import { Tower } from "./Tower";
import { Crane } from "./Crane";
import { Renderer, type BlockView } from "./Renderer";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "city-bloxx:best";

/** Countdown before a run starts: one label shown per COUNTDOWN_STEP seconds. */
const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;

/** Orchestrates canvas, state machine and the fixed-view game loop. */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tower = new Tower();
  private readonly crane = new Crane();
  private readonly renderer = new Renderer();
  private readonly hud: Hud;
  private readonly input: InputController;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private state: State = "ready";
  private score = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  private lastTime = 0;
  private deadFor = 0;
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  /** Consecutive perfect placements; drives the combo flash and chime pitch. */
  private perfectCombo = 0;

  /** The block in play (on the hook or falling), or null between spawns. */
  private block: BlockView | null = null;
  private blockFalling = false;
  private blockVx = 0;
  private blockVy = 0;

  /** Vertical world→screen pan, grows as the tower climbs. */
  private camY = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container);
    this.hud.setBest(this.best);
    this.hud.showScore(false);
    this.hud.showStart();

    this.room = initRoomMode("city-bloxx", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    this.input = new InputController(this.canvas, () => this.onDrop());

    this.resetWorld();
    this.resize();
    window.addEventListener("resize", this.resize);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private onDrop(): void {
    switch (this.state) {
      case "ready":
        this.beginCountdown();
        break;
      case "playing":
        if (this.block && !this.blockFalling) {
          this.blockFalling = true;
          this.blockVx = this.crane.vx;
          this.blockVy = this.crane.vy;
          SoundEffects.playDrop();
        }
        break;
      case "dead":
        // En modo sala se juega una sola partida por ronda: sin reintento.
        if (this.room) return;
        if (this.deadFor > 0.6) this.beginCountdown();
        break;
    }
  }

  /** Resets tower, crane and the current block to a fresh, empty site. */
  private resetWorld(): void {
    this.tower.reset();
    this.crane.reset();
    this.crane.update(0, 0, this.hangTopY());
    this.score = 0;
    this.perfectCombo = 0;
    this.hud.setScore(0);
    this.hud.setBalance(0);
    this.spawnBlock();
    this.camY = this.cameraTarget();
  }

  /** Puts a fresh block on the hook at the current landing height. */
  private spawnBlock(): void {
    this.block = { x: this.crane.x, topY: this.crane.y };
    this.blockFalling = false;
    this.blockVx = 0;
    this.blockVy = 0;
  }

  /** Resting top-Y of a hooked block (its landing spot minus the hang gap). */
  private hangTopY(): number {
    return this.tower.landingTopY() - HOOK_FLOAT;
  }

  private beginCountdown(): void {
    this.resetWorld();
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.showScore(false);
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private start(): void {
    this.state = "playing";
    this.hud.showScore(true);
    this.hud.hide();
    this.hud.showCountdown(null);
  }

  private die(): void {
    this.state = "dead";
    this.deadFor = 0;
    SoundEffects.playCollapse();
    this.hud.showScore(false);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.hud.setBest(this.best);
    }
    this.hud.showGameOver(this.score, this.best);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("city-bloxx", this.score);
  }

  /** Resolves a dropped block: a miss ends the run, a hit stacks and rebalances. */
  private resolveDrop(): void {
    const res = this.tower.place(this.block!.x);
    if (!res.ok) {
      // No support: let the block keep falling for the death animation.
      this.die();
      return;
    }
    this.score++;
    if (res.perfect) {
      this.perfectCombo++;
      SoundEffects.playPerfect(this.perfectCombo);
      const placed = this.tower.topFloor()!;
      this.renderer.spawnPerfect(placed.x, placed.topY);
      this.hud.flashPerfect(this.perfectCombo);
    } else {
      this.perfectCombo = 0;
      SoundEffects.playLand(this.score);
    }
    this.hud.setScore(this.score);
    this.hud.setBalance(this.tower.balanceRatio());
    if (this.tower.isToppled()) {
      this.tower.collapse();
      this.block = null;
      this.die();
      return;
    }
    this.spawnBlock();
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
    this.tower.update(dt);

    if (this.state === "playing") {
      // Always update the crane so it keeps swinging
      this.crane.update(dt, this.tower.count, this.hangTopY());

      if (this.block && this.blockFalling) {
        this.blockVy += DROP_GRAVITY * dt;
        this.block.topY += this.blockVy * dt;
        this.block.x += this.blockVx * dt;
        if (this.block.topY >= this.tower.landingTopY()) this.resolveDrop();
      } else if (this.block) {
        this.block.x = this.crane.x;
        this.block.topY = this.crane.y;
      }
      this.updateCamera(dt);
    } else if (this.state === "ready" || this.state === "countdown") {
      // Idle: the hook keeps sweeping so the scene reads as alive.
      this.crane.update(dt, 0, this.hangTopY());
      if (this.block) {
        this.block.x = this.crane.x;
        this.block.topY = this.crane.y;
      }
      if (this.state === "countdown") this.updateCountdown(dt);
    } else if (this.state === "dead") {
      this.deadFor += dt;
      // Crane keeps swinging while dying
      this.crane.update(dt, this.tower.count, this.hangTopY());
      // Let a missed block finish falling off the bottom of the screen.
      if (this.block && this.blockFalling && this.block.topY < VIEW_HEIGHT + 260) {
        this.blockVy += DROP_GRAVITY * dt;
        this.block.topY += this.blockVy * dt;
        this.block.x += this.blockVx * dt;
      }
    }
  }

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

  /** Target pan that pins the hook near the top once the tower is tall. */
  private cameraTarget(): number {
    return Math.max(0, HOOK_SCREEN_Y - this.hangTopY());
  }

  private updateCamera(dt: number): void {
    const target = this.cameraTarget();
    this.camY += (target - this.camY) * Math.min(1, CAM_LERP * dt);
  }

  private render(): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.clip();
    this.renderer.draw(
      ctx,
      this.tower,
      this.crane.x,
      this.crane.y,
      this.block,
      this.hangTopY(),
      this.camY,
    );
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
