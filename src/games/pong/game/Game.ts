import {
  MAX_DT,
  PADDLE_HEIGHT,
  PADDLE_MARGIN,
  PADDLE_WIDTH,
  PLAYER_SPEED,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import { Paddle } from "./Paddle";
import { Ball } from "./Ball";
import { Ai } from "./Ai";
import { Renderer } from "./Renderer";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { PongChannel } from "./PongChannel";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "pong:best";
const SCORE_LIMIT = 7;
/** 25 Hz: cada cliente manda 1 msg/tick, holgado bajo el tope de 40 msg/s. */
const BROADCAST_INTERVAL = 0.04;

const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;
/** Velocidad de interpolacion de la paleta rival (mayor = mas pegado, menos suave). */
const PADDLE_LERP_RATE = 18;
/** Reconciliacion de la pelota en P2 hacia el snapshot del host (suave, no tironea). */
const BALL_RECONCILE_RATE = 6;
/** Adelanto (seg) con que se extrapola el snapshot: compensa que llega del pasado. */
const SNAPSHOT_LEAD = 0.05;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly player = new Paddle(PADDLE_MARGIN);
  private readonly aiPaddle = new Paddle(VIEW_WIDTH - PADDLE_WIDTH - PADDLE_MARGIN);
  private readonly ai = new Ai(this.aiPaddle);
  private readonly ball = new Ball();
  private readonly renderer = new Renderer();
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly room: RoomMode | null;
  private readonly isRoomMode: boolean;
  private pongChan: PongChannel | null = null;

  private amPlayer1 = true;
  private hasOpponent = false;
  private rolesReady = false;
  private opponentPaddleY = VIEW_HEIGHT / 2 - PADDLE_HEIGHT / 2;
  private opponentPaddleTargetY = VIEW_HEIGHT / 2 - PADDLE_HEIGHT / 2;
  private broadcastTimer = 0;

  private ballTargetX = VIEW_WIDTH / 2;
  private ballTargetY = VIEW_HEIGHT / 2;
  private hasReceivedBall = false;

  private state: State = "ready";
  private score = 0;
  private opponentScore = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  private lastTime = 0;
  private deadFor = 0;
  private countdownTime = 0;
  private lastCountdownIndex = -1;

  /** Mouse/touch follow: view-space Y the local paddle centers on, or inactive
   *  until the pointer is first used (keyboard-only players stay unaffected). */
  private pointerActive = false;
  private pointerTargetY = VIEW_HEIGHT / 2;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container);
    this.hud.showScore(false);
    this.hud.showStart();

    this.room = initRoomMode("pong", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });
    this.isRoomMode = this.room !== null;

    this.hud.setHintText(
      this.isRoomMode ? "esperando emparejamiento…" : "mouse / flechas / W S para mover",
    );

    this.input = new InputController(
      container,
      () => this.onAction(),
    );

    // El mouse (y el arrastre tactil) mueve la paleta local: sigue la Y del
    // cursor. El teclado tiene prioridad cuando hay una tecla apretada.
    this.canvas.addEventListener("pointermove", this.onPointerMove);

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
      case "dead":
        if (this.room) return;
        if (this.deadFor > 0.6) this.beginCountdown();
        break;
    }
  }

  /**
   * Fija el rol (J1 izquierda / J2 derecha / vs IA) y crea el canal recien
   * cuando arranca la ronda: en el constructor la lista de jugadores del room
   * todavia no cargo (boot() es async), asi que hay que resolverla aca, cuando
   * onStart dispara la cuenta regresiva y room.players() ya esta poblada.
   */
  private setupRoles(): void {
    if (!this.isRoomMode || this.rolesReady) return;
    const room = this.room!;
    const players = room.players();
    const myIdx = players.indexOf(room.me);
    if (myIdx < 0) return; // lista aun no disponible: reintentar en el proximo inicio

    this.amPlayer1 = myIdx % 2 === 0;
    const oppIdx = this.amPlayer1 ? myIdx + 1 : myIdx - 1;
    this.hasOpponent = oppIdx >= 0 && oppIdx < players.length;

    if (this.hasOpponent) {
      this.pongChan = new PongChannel(room.code, room.me);
      // P1 recibe la paleta de P2 por su propio evento "paddle".
      this.pongChan.onPaddle((_player, y) => {
        this.opponentPaddleTargetY = y;
      });
      if (!this.amPlayer1) {
        this.pongChan.onBall((state) => {
          this.ballTargetX = state.x;
          this.ballTargetY = state.y;
          this.ball.vx = state.vx;
          this.ball.vy = state.vy;
          this.ball.speed = state.speed;
          this.ball.hits = state.hits;
          this.score = state.p2Score;
          this.opponentScore = state.p1Score;
          // La paleta de P1 viaja adosada a la pelota (un solo mensaje).
          this.opponentPaddleTargetY = state.paddleY;
          this.hasReceivedBall = true;
        });
      }
    }

    this.hud.setHintText(
      this.hasOpponent
        ? this.amPlayer1 ? "mouse / W S — sos J1 (izquierda)" : "mouse / FLECHAS — sos J2 (derecha)"
        : "mouse / flechas / W S para mover (vs IA)",
    );
    this.rolesReady = true;
  }

  private beginCountdown(): void {
    this.setupRoles();
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.player.reset();
    this.aiPaddle.reset();
    this.ball.reset();
    this.opponentPaddleY = VIEW_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    this.opponentPaddleTargetY = VIEW_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    this.hasReceivedBall = false;
    this.hud.showScore(false);
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private start(): void {
    this.state = "playing";
    this.score = 0;
    this.opponentScore = 0;
    this.broadcastTimer = 0;
    this.hasReceivedBall = false;

    if (this.isRoomMode) {
      this.hud.showScoreRoom(0, 0);
      if (!this.hasOpponent) {
        // Impar / sin pareja: juega contra la IA, lanza la pelota localmente.
        this.ball.launch(true);
      } else if (this.amPlayer1) {
        this.ball.launch(Math.random() < 0.5);
        this.broadcastBall();
      }
      // J2 con pareja: espera el estado de la pelota por broadcast.
    } else {
      this.hud.setScore(0);
      this.hud.showScore(true);
      this.ball.launch(true);
    }
    this.hud.hide();
    this.hud.showCountdown(null);
  }

  private die(): void {
    if (this.state === "dead") return;
    this.state = "dead";
    this.deadFor = 0;
    SoundEffects.playLose();
    this.hud.showScore(false);
    if (!this.isRoomMode && this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    this.hud.showGameOver(this.score, this.best, this.opponentScore, this.isRoomMode);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("pong", this.score);
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    if (this.state === "playing") {
      if (this.isRoomMode && this.hasOpponent) {
        this.updateOnline(dt);
      } else if (this.isRoomMode && !this.hasOpponent) {
        this.updateUnpaired(dt);
      } else {
        this.updateSolo(dt);
      }
    } else if (this.state === "countdown") {
      this.updateCountdown(dt);
    } else if (this.state === "dead") {
      this.deadFor += dt;
    }
  }

  /** Moves a local paddle: keyboard direction when held, else follow the mouse.
   *  Last input wins: pressing a key disables mouse-follow until the mouse moves
   *  again, so releasing a key doesn't snap the paddle back to the cursor. */
  private movePlayer(paddle: Paddle, dir: number, dt: number): void {
    if (dir !== 0) {
      paddle.y += dir * PLAYER_SPEED * dt;
      paddle.clamp();
      this.pointerActive = false;
    } else if (this.pointerActive) {
      paddle.y = this.pointerTargetY - PADDLE_HEIGHT / 2;
      paddle.clamp();
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTargetY = (e.clientY - rect.top) / this.cssScale - this.offsetY;
    this.pointerActive = true;
  };

  private updateSolo(dt: number): void {
    this.movePlayer(this.player, this.input.moveDir, dt);
    this.ai.update(dt, this.ball);
    this.ball.update(dt);
    this.checkCollisions();
  }

  private updateUnpaired(dt: number): void {
    this.movePlayer(this.player, this.input.moveDir, dt);
    this.ai.update(dt, this.ball);
    this.ball.update(dt);
    this.checkCollisionsRoom();
  }

  /** Suaviza la paleta rival hacia la ultima posicion recibida (anti-salto). */
  private smoothOpponentPaddle(dt: number): void {
    const t = Math.min(1, dt * PADDLE_LERP_RATE);
    this.opponentPaddleY += (this.opponentPaddleTargetY - this.opponentPaddleY) * t;
  }

  private updateOnline(dt: number): void {
    this.smoothOpponentPaddle(dt);

    if (this.amPlayer1) {
      this.movePlayer(this.player, this.input.p1Dir, dt);
      this.aiPaddle.y = this.opponentPaddleY;
      this.ball.update(dt);
      this.checkCollisionsRoom();

      if (this.state === "dead") {
        // Match ended on this frame: push the final score so P2 also ends.
        this.broadcastBall();
        return;
      }

      // P1 manda un solo mensaje por tick: la pelota lleva adosada su paleta.
      this.broadcastTimer += dt;
      if (this.broadcastTimer >= BROADCAST_INTERVAL) {
        this.broadcastTimer = 0;
        this.broadcastBall();
      }
    } else {
      this.player.y = this.opponentPaddleY;
      this.movePlayer(this.aiPaddle, this.input.p2Dir, dt);

      if (this.hasReceivedBall) {
        // Prediccion local con la fisica real del host (avance + rebote en
        // paredes) para que la pelota se mueva a velocidad real y fluida entre
        // snapshots, usando el vx/vy/speed que llega en cada broadcast.
        this.ball.update(dt);
        // Reconciliacion suave hacia el snapshot, extrapolado hacia adelante
        // por SNAPSHOT_LEAD: el snapshot es del pasado, asi que corregir hacia
        // su posicion cruda tironearia la pelota hacia atras (efecto stutter).
        const k = Math.min(1, dt * BALL_RECONCILE_RATE);
        this.ball.x += (this.ballTargetX + this.ball.vx * SNAPSHOT_LEAD - this.ball.x) * k;
        this.ball.y += (this.ballTargetY + this.ball.vy * SNAPSHOT_LEAD - this.ball.y) * k;
      }

      if (this.score >= SCORE_LIMIT || this.opponentScore >= SCORE_LIMIT) {
        this.die();
      }
      this.hud.showScoreRoom(this.opponentScore, this.score);

      this.broadcastTimer += dt;
      if (this.broadcastTimer >= BROADCAST_INTERVAL) {
        this.broadcastTimer = 0;
        this.pongChan!.sendPaddle(this.aiPaddle.y);
      }
    }
  }

  private broadcastBall(): void {
    this.pongChan!.sendBall({
      x: this.ball.x,
      y: this.ball.y,
      vx: this.ball.vx,
      vy: this.ball.vy,
      speed: this.ball.speed,
      hits: this.ball.hits,
      p1Score: this.amPlayer1 ? this.score : this.opponentScore,
      p2Score: this.amPlayer1 ? this.opponentScore : this.score,
      // Solo P1 emite la pelota, asi que esta es siempre su paleta izquierda.
      paddleY: this.player.y,
    });
  }

  private checkCollisions(): void {
    if (this.ball.left <= 0) { this.die(); return; }

    if (this.ball.right >= VIEW_WIDTH) {
      this.score++;
      this.hud.setScore(this.score);
      SoundEffects.playScore();
      this.ball.launch(true);
      return;
    }

    this.paddleCollisionPlayer();
    this.paddleCollisionAi();
    this.wallBounceSound();
  }

  private checkCollisionsRoom(): void {
    if (this.ball.left <= 0) {
      this.opponentScore++;
      this.hud.showScoreRoom(this.score, this.opponentScore);
      SoundEffects.playScore();
      if (this.score >= SCORE_LIMIT || this.opponentScore >= SCORE_LIMIT) { this.die(); return; }
      this.ball.launch(true);
      return;
    }

    if (this.ball.right >= VIEW_WIDTH) {
      this.score++;
      this.hud.showScoreRoom(this.score, this.opponentScore);
      SoundEffects.playScore();
      if (this.score >= SCORE_LIMIT || this.opponentScore >= SCORE_LIMIT) { this.die(); return; }
      this.ball.launch(false);
      return;
    }

    this.paddleCollisionPlayer();
    this.paddleCollisionAi();
    this.wallBounceSound();
  }

  private paddleCollisionPlayer(): void {
    if (
      this.ball.vx < 0 &&
      this.ball.left <= this.player.right &&
      this.ball.x > this.player.x &&
      this.ball.bottom > this.player.top &&
      this.ball.top < this.player.bottom
    ) {
      this.ball.x = this.player.right + this.ball.radius;
      this.ball.bouncePaddle(this.player);
      SoundEffects.playHit();
    }
  }

  private paddleCollisionAi(): void {
    if (
      this.ball.vx > 0 &&
      this.ball.right >= this.aiPaddle.left &&
      this.ball.x < this.aiPaddle.x + this.aiPaddle.w &&
      this.ball.bottom > this.aiPaddle.top &&
      this.ball.top < this.aiPaddle.bottom
    ) {
      this.ball.x = this.aiPaddle.left - this.ball.radius;
      this.ball.bouncePaddle(this.aiPaddle);
      SoundEffects.playHit();
    }
  }

  private wallBounceSound(): void {
    if (this.ball.top <= 0 || this.ball.bottom >= VIEW_HEIGHT) {
      SoundEffects.playWall();
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
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.clip();
    this.renderer.draw(ctx, this.player, this.aiPaddle, this.ball);
    ctx.restore();
  }

  private scale = 1;
  /** CSS pixels per view unit (scale without dpr), for mapping pointer input. */
  private cssScale = 1;
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
    this.cssScale = fit;
    this.offsetX = (w / fit - VIEW_WIDTH) / 2;
    this.offsetY = (h / fit - VIEW_HEIGHT) / 2;
  };

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.input.dispose();
    this.pongChan?.dispose();
  }
}
