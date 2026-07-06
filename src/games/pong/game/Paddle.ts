import { PADDLE_HEIGHT, PADDLE_MARGIN, PADDLE_WIDTH, VIEW_HEIGHT } from "./constants";

export class Paddle {
  x: number;
  y: number;
  readonly w = PADDLE_WIDTH;
  readonly h = PADDLE_HEIGHT;

  constructor(x: number) {
    this.x = x;
    this.y = VIEW_HEIGHT / 2 - PADDLE_HEIGHT / 2;
  }

  get top(): number { return this.y; }
  get bottom(): number { return this.y + this.h; }
  get left(): number { return this.x; }
  get right(): number { return this.x + this.w; }

  clamp(): void {
    this.y = Math.max(PADDLE_MARGIN, Math.min(VIEW_HEIGHT - this.h - PADDLE_MARGIN, this.y));
  }

  reset(): void {
    this.y = VIEW_HEIGHT / 2 - this.h / 2;
  }
}
