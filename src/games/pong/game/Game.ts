import {
  GAME_SERVER_URL,
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
import { PongSocket } from "./PongSocket";
import type { PongBall, PongMatchState } from "./PongProtocol";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "pong:best";
const SCORE_LIMIT = 7;
/** 50 Hz: cada cliente manda su paleta al server. Frecuente a proposito: cuanto
 *  antes llega tu Y, menos chance de que la pelota "pase" por donde ves tu paleta
 *  (la colision la resuelve el server con la Y que tiene). */
const BROADCAST_INTERVAL = 0.02;

const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;
/** Velocidad de interpolacion de la paleta rival (mayor = mas pegado, menos suave). */
const PADDLE_LERP_RATE = 18;
/** Reconciliacion suave de la pelota hacia el snapshot del server (no tironea). */
const BALL_RECONCILE_RATE = 6;
/** Adelanto (seg) con que se extrapola el snapshot: compensa que llega del pasado. */
const SNAPSHOT_LEAD = 0.05;
/** Salto (px) a partir del cual se hace snap en vez de reconciliar: cubre los
 *  eventos discretos del server (gol/relanzamiento, rebote fuerte). */
const BALL_SNAP_DIST = 130;

/**
 * PONG. Solo (landing): 1 jugador contra la IA, endless por devoluciones. En
 * sala hay dos modos:
 *  - CON game server (VITE_GAME_SERVER_URL): PvP autoritativo. El server empareja
 *    de a dos (impar = vs IA), corre la fisica y difunde `pg:state`; el cliente
 *    solo controla su paleta y renderiza los snapshots (prediccion + reconcile).
 *  - SIN game server: cada jugador cae a un partido local contra la IA y reporta
 *    su puntaje (degradacion elegante para que la sala no quede trabada).
 */
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
  /** En sala con game server: PvP arbitrado por el server. */
  private readonly serverMode: boolean;
  private socket: PongSocket | null = null;

  /** Lado propio segun el server ("p1" izquierda / "p2" derecha); null hasta el 1er estado. */
  private side: "p1" | "p2" | null = null;
  private latest: PongMatchState | null = null;
  private hintFixed = false;

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
    this.serverMode = this.isRoomMode && !!GAME_SERVER_URL;

    this.hud.setHintText(
      this.isRoomMode ? "esperando emparejamiento…" : "mouse / flechas / W S para mover",
    );

    this.input = new InputController(container, () => this.onAction());

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

  /** Conecta al game server cuando arranca la ronda (en el constructor la lista
   *  de jugadores todavia no cargo: boot() es async). El server empareja por el
   *  roster y responde con `pg:state`, de donde sale el lado propio. */
  private connectServer(): void {
    if (!this.serverMode || this.socket || !this.room || !GAME_SERVER_URL) return;
    const socket = new PongSocket(
      GAME_SERVER_URL,
      this.room.code,
      this.room.me,
      this.room.players(),
    );
    socket.onState((s) => this.onServerState(s));
    this.socket = socket;
    void socket.connect();
  }

  private beginCountdown(): void {
    if (this.state === "countdown" || this.state === "playing") return;
    if (this.serverMode) this.connectServer();
    else if (this.isRoomMode) this.hud.setHintText("mouse / flechas / W S para mover (vs IA)");

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
    this.broadcastTimer = 0;

    if (this.serverMode) {
      // El server es duenio de la pelota y el puntaje; solo se sincroniza al
      // ultimo snapshot recibido (o el centro si aun no llego ninguno).
      this.hud.showScoreRoom(this.leftScore(), this.rightScore());
      if (this.latest) this.applyBallSnapshot(this.latest.ball);
    } else if (this.isRoomMode) {
      // Sin server: partido local contra la IA (degradacion).
      this.score = 0;
      this.opponentScore = 0;
      this.hud.showScoreRoom(0, 0);
      this.ball.launch(true);
    } else {
      this.score = 0;
      this.opponentScore = 0;
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
      if (this.serverMode) this.updateServer(dt);
      else if (this.isRoomMode) this.updateUnpaired(dt);
      else this.updateSolo(dt);
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

  // ---------- Modo server (PvP autoritativo) ----------

  private onServerState(s: PongMatchState): void {
    this.side = s.side;
    this.latest = s;

    if (!this.hintFixed) {
      this.hintFixed = true;
      this.hud.setHintText(
        s.vsAi
          ? "mouse / flechas / W S para mover (vs IA)"
          : s.side === "p1"
            ? "mouse / flechas / W S — sos J1 (izquierda)"
            : "mouse / flechas / W S — sos J2 (derecha)",
      );
    }

    this.score = s.side === "p1" ? s.p1Score : s.p2Score;
    this.opponentScore = s.side === "p1" ? s.p2Score : s.p1Score;
    this.opponentPaddleTargetY = s.side === "p1" ? s.p2Y : s.p1Y;

    if (this.state === "playing") {
      this.applyBallSnapshot(s.ball);
      if (s.phase === "over") this.die();
    }
  }

  /** Sincroniza la pelota local con el snapshot del server: snap ante saltos
   *  grandes (gol/relanzamiento) y reconciliacion suave para el resto. */
  private applyBallSnapshot(b: PongBall): void {
    this.ball.vx = b.vx;
    this.ball.vy = b.vy;
    this.ball.speed = b.speed;
    this.ball.hits = b.hits;
    const far = Math.hypot(b.x - this.ball.x, b.y - this.ball.y) > BALL_SNAP_DIST;
    if (!this.hasReceivedBall || far) {
      this.ball.x = b.x;
      this.ball.y = b.y;
    }
    this.ballTargetX = b.x;
    this.ballTargetY = b.y;
    this.hasReceivedBall = true;
  }

  private updateServer(dt: number): void {
    if (!this.side) return; // sin asiento todavia: espera el primer estado

    const myPaddle = this.side === "p1" ? this.player : this.aiPaddle;
    const oppPaddle = this.side === "p1" ? this.aiPaddle : this.player;

    // Paleta propia: input local inmediato (no espera al server).
    this.movePlayer(myPaddle, this.input.moveDir, dt);

    // Paleta rival: interpolada hacia el ultimo valor recibido (anti-salto).
    this.smoothOpponentPaddle(dt);
    oppPaddle.y = this.opponentPaddleY;

    // Pelota: prediccion local con la fisica real + reconciliacion suave hacia el
    // snapshot extrapolado (SNAPSHOT_LEAD compensa que el snapshot es del pasado).
    if (this.hasReceivedBall) {
      this.ball.update(dt);
      const k = Math.min(1, dt * BALL_RECONCILE_RATE);
      this.ball.x += (this.ballTargetX + this.ball.vx * SNAPSHOT_LEAD - this.ball.x) * k;
      this.ball.y += (this.ballTargetY + this.ball.vy * SNAPSHOT_LEAD - this.ball.y) * k;
    }

    // Manda la paleta propia una vez por tick.
    this.broadcastTimer += dt;
    if (this.broadcastTimer >= BROADCAST_INTERVAL) {
      this.broadcastTimer = 0;
      this.socket?.sendPaddle(myPaddle.y);
    }

    this.hud.showScoreRoom(this.leftScore(), this.rightScore());
  }

  private leftScore(): number {
    return this.side === "p1" ? this.score : this.opponentScore;
  }

  private rightScore(): number {
    return this.side === "p1" ? this.opponentScore : this.score;
  }

  /** Suaviza la paleta rival hacia la ultima posicion recibida (anti-salto). */
  private smoothOpponentPaddle(dt: number): void {
    const t = Math.min(1, dt * PADDLE_LERP_RATE);
    this.opponentPaddleY += (this.opponentPaddleTargetY - this.opponentPaddleY) * t;
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
    this.socket?.dispose();
  }
}
