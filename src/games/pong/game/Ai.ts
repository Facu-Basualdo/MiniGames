import { AI_MARGIN, AI_SPEED, PADDLE_HEIGHT } from "./constants";
import type { Paddle } from "./Paddle";
import type { Ball } from "./Ball";

export class Ai {
  private readonly paddle: Paddle;

  constructor(paddle: Paddle) {
    this.paddle = paddle;
  }

  update(dt: number, ball: Ball): void {
    const targetY = ball.y - PADDLE_HEIGHT / 2;

    const diff = targetY - this.paddle.y;
    const margin = AI_MARGIN;

    if (Math.abs(diff) > margin) {
      this.paddle.y += Math.sign(diff) * AI_SPEED * dt;
    }

    this.paddle.clamp();
  }

  reset(): void {
    this.paddle.reset();
  }
}
