import { getSupabase } from "../../../shared/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  hits: number;
  p1Score: number;
  p2Score: number;
  /** Posicion Y de la paleta de P1, adosada a la pelota para ahorrar mensajes. */
  paddleY: number;
}

export class PongChannel {
  private readonly channel: RealtimeChannel | null;
  private readonly me: string;
  private readonly paddleCbs: Array<(player: string, y: number) => void> = [];
  private readonly ballCbs: Array<(state: BallState) => void> = [];
  private disposed = false;

  constructor(code: string, me: string) {
    this.me = me;
    const supabase = getSupabase();
    if (!supabase) { this.channel = null; return; }

    this.channel = supabase.channel(`room:${code}:pong`, {
      config: { broadcast: { self: false } },
    });

    (this.channel as RealtimeChannel).on("broadcast", { event: "paddle" }, ({ payload }: { payload: unknown }) => {
      const d = payload as { player: string; y: number };
      if (d.player !== this.me) {
        for (const cb of this.paddleCbs) cb(d.player, d.y);
      }
    });

    (this.channel as RealtimeChannel).on("broadcast", { event: "ball" }, ({ payload }: { payload: unknown }) => {
      for (const cb of this.ballCbs) cb(payload as BallState);
    });

    this.channel.subscribe();
  }

  sendPaddle(y: number): void {
    if (!this.channel || this.disposed) return;
    void this.channel.send({
      type: "broadcast",
      event: "paddle",
      payload: { player: this.me, y },
    });
  }

  sendBall(state: BallState): void {
    if (!this.channel || this.disposed) return;
    void this.channel.send({
      type: "broadcast",
      event: "ball",
      payload: state,
    });
  }

  onPaddle(cb: (player: string, y: number) => void): void {
    this.paddleCbs.push(cb);
  }

  onBall(cb: (state: BallState) => void): void {
    this.ballCbs.push(cb);
  }

  dispose(): void {
    this.disposed = true;
    const supabase = getSupabase();
    if (this.channel && supabase) void supabase.removeChannel(this.channel);
  }
}
