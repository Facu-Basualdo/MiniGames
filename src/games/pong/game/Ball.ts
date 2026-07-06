import {
  BALL_RADIUS,
  BALL_SPEED_INCREMENT,
  BALL_SPEED_INITIAL,
  BALL_SPEED_MAX,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import type { Paddle } from "./Paddle";

export class Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  readonly radius = BALL_RADIUS;
  hits = 0;

  constructor() {
    this.x = VIEW_WIDTH / 2;
    this.y = VIEW_HEIGHT / 2;
    this.speed = BALL_SPEED_INITIAL;
    this.vx = 0;
    this.vy = 0;
  }

  get left(): number { return this.x - this.radius; }
  get right(): number { return this.x + this.radius; }
  get top(): number { return this.y - this.radius; }
  get bottom(): number { return this.y + this.radius; }

  launch(towardPlayer: boolean): void {
    this.x = VIEW_WIDTH / 2;
    this.y = VIEW_HEIGHT / 2 + (Math.random() - 0.5) * 120;
    this.speed = BALL_SPEED_INITIAL;
    this.hits = 0;

    const angle = (Math.random() - 0.5) * Math.PI * 0.6;
    const dir = towardPlayer ? -1 : 1;
    this.vx = Math.cos(angle) * this.speed * dir;
    this.vy = Math.sin(angle) * this.speed;
  }

  increaseSpeed(): void {
    this.speed = Math.min(this.speed + BALL_SPEED_INCREMENT, BALL_SPEED_MAX);
    const angle = Math.atan2(this.vy, this.vx);
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.top <= 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    } else if (this.bottom >= VIEW_HEIGHT) {
      this.y = VIEW_HEIGHT - this.radius;
      this.vy = -Math.abs(this.vy);
    }
  }

  bouncePaddle(paddle: Paddle): void {
    const relY = (this.y - paddle.y) / paddle.h;
    const angle = (relY - 0.5) * Math.PI * 0.7;
    const dir = this.vx > 0 ? -1 : 1;
    this.vx = Math.cos(angle) * this.speed * dir;
    this.vy = Math.sin(angle) * this.speed;
    this.hits++;
    this.increaseSpeed();
  }

  reset(): void {
    this.x = VIEW_WIDTH / 2;
    this.y = VIEW_HEIGHT / 2;
    this.vx = 0;
    this.vy = 0;
    this.speed = BALL_SPEED_INITIAL;
    this.hits = 0;
  }
}
