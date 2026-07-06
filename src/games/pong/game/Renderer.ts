import { VIEW_HEIGHT, VIEW_WIDTH } from "./constants";
import type { Ball } from "./Ball";
import type { Paddle } from "./Paddle";

export class Renderer {
  draw(ctx: CanvasRenderingContext2D, player: Paddle, ai: Paddle, ball: Ball): void {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.drawCenterLine(ctx);

    this.drawPaddle(ctx, player);
    this.drawPaddle(ctx, ai);
    this.drawBall(ctx, ball);
  }

  private drawCenterLine(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(VIEW_WIDTH / 2, 0);
    ctx.lineTo(VIEW_WIDTH / 2, VIEW_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle): void {
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 10;
    const r = 3;
    ctx.beginPath();
    ctx.moveTo(paddle.x + r, paddle.y);
    ctx.lineTo(paddle.x + paddle.w - r, paddle.y);
    ctx.quadraticCurveTo(paddle.x + paddle.w, paddle.y, paddle.x + paddle.w, paddle.y + r);
    ctx.lineTo(paddle.x + paddle.w, paddle.y + paddle.h - r);
    ctx.quadraticCurveTo(paddle.x + paddle.w, paddle.y + paddle.h, paddle.x + paddle.w - r, paddle.y + paddle.h);
    ctx.lineTo(paddle.x + r, paddle.y + paddle.h);
    ctx.quadraticCurveTo(paddle.x, paddle.y + paddle.h, paddle.x, paddle.y + paddle.h - r);
    ctx.lineTo(paddle.x, paddle.y + r);
    ctx.quadraticCurveTo(paddle.x, paddle.y, paddle.x + r, paddle.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
