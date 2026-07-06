import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  RING_RADIUS,
  RING_WIDTH,
  MARKER_THICKNESS,
  MARKER_OVERHANG,
  BASE_ANGULAR_SPEED,
  ANGULAR_SPEED_INCREMENT,
  MAX_ANGULAR_SPEED,
  BASE_TARGET_HALF,
  TARGET_HALF_SHRINK,
  MIN_TARGET_HALF,
  RELOCATE_MIN_AHEAD,
  RELOCATE_MAX_AHEAD,
  REVERSE_CHANCE,
  MAX_DT,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  BEST_KEY,
} from "./constants";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "playing" | "dead";

const TAU = Math.PI * 2;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const ACCENT = "#ff007f";
/** The orbiting marker: neon cyan so it stands out against the magenta target arc. */
const MARKER_COLOR = "#00f3ff";

/** Shortest absolute angular distance between two angles (0..PI). */
function angDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: Hud;
  private readonly room: RoomMode | null;

  private state: State = "ready";
  private score = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  private lastTime = 0;
  private deadFor = 0;
  private countdownTime = 0;
  private lastCountdownIndex = -1;

  // Orbit + target state.
  private markerAngle = -Math.PI / 2;
  private direction = 1;
  private angularSpeed = BASE_ANGULAR_SPEED;
  private targetCenter = Math.PI / 2;
  private targetHalf = BASE_TARGET_HALF;

  // Visual effects state.
  private hitFlash = 0;
  private markerHistory: { angle: number }[] = [];

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container);
    this.hud.showScore(false);
    this.hud.showStart(this.best);

    this.room = initRoomMode("ring-runner", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    this.bindInputs();
    this.resize();
    window.addEventListener("resize", this.resize);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private bindInputs(): void {
    window.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") {
        e.preventDefault();
        this.onAction();
      }
    });

    // A single pointerdown on window unifies mouse and touch (one fire per
    // press, no mousedown+click double-tap) and fires whether the pointer lands
    // on the canvas or on the start/game-over overlay that covers it. Taps on
    // the leaderboard panel (name form, rows) must not double as a restart.
    window.addEventListener("pointerdown", (e) => {
      if ((e.target as Element | null)?.closest(".mg-lb")) return;
      this.onAction();
    });
  }

  private onAction(): void {
    switch (this.state) {
      case "ready":
        this.beginCountdown();
        break;
      case "countdown":
        break;
      case "playing":
        this.attempt();
        break;
      case "dead":
        // En modo sala se juega una sola partida por ronda: sin reintento.
        if (this.room) return;
        if (this.deadFor > 0.6) this.beginCountdown();
        break;
    }
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.score = 0;
    this.markerAngle = -Math.PI / 2;
    this.direction = 1;
    this.angularSpeed = BASE_ANGULAR_SPEED;
    this.targetHalf = BASE_TARGET_HALF;
    this.relocateTarget();
    this.hitFlash = 0;
    this.markerHistory = [];
    this.hud.showScore(false);
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private start(): void {
    this.state = "playing";
    this.score = 0;
    // Score is drawn in the ring's center (see render), so the top HUD stays hidden.
    this.hud.hide();
    this.hud.showCountdown(null);
  }

  /** A tap while playing: a hit if the marker is inside the target arc, else death. */
  private attempt(): void {
    if (angDiff(this.markerAngle, this.targetCenter) <= this.targetHalf) {
      this.score++;
      this.hud.setScore(this.score);
      SoundEffects.playHit(this.score);
      this.hitFlash = 1;
      this.angularSpeed = Math.min(this.angularSpeed + ANGULAR_SPEED_INCREMENT, MAX_ANGULAR_SPEED);
      this.targetHalf = Math.max(this.targetHalf - TARGET_HALF_SHRINK, MIN_TARGET_HALF);
      if (Math.random() < REVERSE_CHANCE) this.direction *= -1;
      this.relocateTarget();
    } else {
      this.die();
    }
  }

  /** Drops the target a random distance ahead of the marker along its travel. */
  private relocateTarget(): void {
    const ahead = RELOCATE_MIN_AHEAD + Math.random() * (RELOCATE_MAX_AHEAD - RELOCATE_MIN_AHEAD);
    this.targetCenter = (this.markerAngle + this.direction * ahead) % TAU;
  }

  private die(): void {
    if (this.state === "dead") return;
    this.state = "dead";
    this.deadFor = 0;
    SoundEffects.playMiss();
    this.hud.showScore(false);

    const isNewBest = this.score > this.best;
    if (isNewBest) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }

    this.hud.showGameOver(this.score, this.best, isNewBest);

    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("ring-runner", this.score);
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

    if (this.state === "playing") {
      this.markerHistory.push({ angle: this.markerAngle });
      if (this.markerHistory.length > 10) {
        this.markerHistory.shift();
      }
      this.markerAngle = (this.markerAngle + this.direction * this.angularSpeed * dt + TAU) % TAU;
    } else {
      this.markerHistory = [];
    }

    if (this.state === "countdown") {
      this.updateCountdown(dt);
    } else if (this.state === "dead") {
      this.deadFor += dt;
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

  private render(): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark background base color
    ctx.fillStyle = "#030208";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);

    // Dynamic, deep ambient radial gradient centering on the ring.
    const pulseFactor = 1.0 + Math.sin(performance.now() * 0.003) * 0.03;
    const bgGrad = ctx.createRadialGradient(
      CENTER_X,
      CENTER_Y,
      10,
      CENTER_X,
      CENTER_Y,
      VIEW_WIDTH * 0.75 * pulseFactor
    );
    bgGrad.addColorStop(0, "#0c0721");
    bgGrad.addColorStop(0.4, "#060312");
    bgGrad.addColorStop(1, "#030208");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Subtle background mesh/grid effect (cyberpunk vibes)
    ctx.strokeStyle = "rgba(0, 243, 255, 0.02)";
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < VIEW_WIDTH; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < VIEW_HEIGHT; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_WIDTH, y);
      ctx.stroke();
    }

    const overlapping = angDiff(this.markerAngle, this.targetCenter) <= this.targetHalf;

    // Groove: a semi-transparent dark recessed track.
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS, 0, TAU);
    ctx.lineWidth = RING_WIDTH + 6;
    ctx.strokeStyle = "rgba(14, 14, 28, 0.6)";
    ctx.stroke();

    // The frosted glass-like main ring.
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS, 0, TAU);
    ctx.lineWidth = RING_WIDTH;
    ctx.strokeStyle = "rgba(244, 244, 251, 0.06)";
    ctx.stroke();

    // Double concentric border rings (cyberpunk borders)
    ctx.save();
    ctx.strokeStyle = "rgba(0, 243, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#00f3ff";
    ctx.shadowBlur = 8;
    // Outer border
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS + RING_WIDTH / 2, 0, TAU);
    ctx.stroke();
    // Inner border
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS - RING_WIDTH / 2, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // The target arc: pitch-black track with bright neon magenta edges and intense shadow glow.
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS, this.targetCenter - this.targetHalf, this.targetCenter + this.targetHalf);
    ctx.lineWidth = RING_WIDTH;
    ctx.strokeStyle = "#020205";
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = overlapping ? 38 : 20;
    ctx.stroke();
    ctx.restore();

    // Radial magenta borders/caps at target edges
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = overlapping ? 12 : 6;
    const halfWidth = RING_WIDTH / 2;
    for (const angle of [this.targetCenter - this.targetHalf, this.targetCenter + this.targetHalf]) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(CENTER_X + cosA * (RING_RADIUS - halfWidth), CENTER_Y + sinA * (RING_RADIUS - halfWidth));
      ctx.lineTo(CENTER_X + cosA * (RING_RADIUS + halfWidth), CENTER_Y + sinA * (RING_RADIUS + halfWidth));
      ctx.stroke();
    }
    ctx.restore();

    // Draw Marker Motion Blur / Trail
    const trailLen = this.markerHistory.length;
    this.markerHistory.forEach((hist, i) => {
      const ratio = (i + 1) / (trailLen + 1);
      const alpha = ratio * 0.45;
      const cosH = Math.cos(hist.angle);
      const sinH = Math.sin(hist.angle);
      const trailHalfLen = RING_WIDTH / 2 + MARKER_OVERHANG - 2;
      
      ctx.save();
      ctx.strokeStyle = `rgba(0, 243, 255, ${alpha})`;
      ctx.lineWidth = (MARKER_THICKNESS - 1.5) * ratio;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(CENTER_X + cosH * (RING_RADIUS - trailHalfLen), CENTER_Y + sinH * (RING_RADIUS - trailHalfLen));
      ctx.lineTo(CENTER_X + cosH * (RING_RADIUS + trailHalfLen), CENTER_Y + sinH * (RING_RADIUS + trailHalfLen));
      ctx.stroke();
      ctx.restore();
    });

    // Marker: a thin radial bar ("|") crossing the ring at the current angle.
    const dirX = Math.cos(this.markerAngle);
    const dirY = Math.sin(this.markerAngle);
    const halfLen = RING_WIDTH / 2 + MARKER_OVERHANG;
    ctx.save();
    
    // Sparkly hit flash or sleek neon cyan
    const markerColor = this.hitFlash > 0 ? "#ffffff" : MARKER_COLOR;
    const shadowColor = this.hitFlash > 0 ? "#3ce88b" : MARKER_COLOR;
    
    ctx.strokeStyle = markerColor;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 18 + this.hitFlash * 28;
    ctx.lineWidth = MARKER_THICKNESS + this.hitFlash * 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(CENTER_X + dirX * (RING_RADIUS - halfLen), CENTER_Y + dirY * (RING_RADIUS - halfLen));
    ctx.lineTo(CENTER_X + dirX * (RING_RADIUS + halfLen), CENTER_Y + dirY * (RING_RADIUS + halfLen));
    ctx.stroke();
    ctx.restore();

    // Combo count in the middle: upgraded font (Orbitron) and neon shadow
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 84px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = overlapping ? "#ff007f" : "#00f3ff";
    ctx.shadowBlur = overlapping ? 22 : 12;
    if (this.state === "playing" || this.state === "dead") {
      ctx.fillText(String(this.score), CENTER_X, CENTER_Y);
    }
    ctx.restore();

    ctx.restore();
  }

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
}
