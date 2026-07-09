import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "../../../shared/supabase";

/** Position snapshot each client broadcasts ~11 times per second (room mode). */
export interface DodgePayload {
  /** Nickname of the sender. */
  p: string;
  x: number;
  y: number;
  /** Facing angle in radians. */
  a: number;
  /** False once the sender has been hit (drawn as a wreck). */
  alive: boolean;
}

/**
 * Ephemeral per-room+round channel: pure broadcast (no DB) of every pirate's
 * position, kept separate from the RoomChannel so the high-frequency traffic
 * doesn't mix with the room sync. Same idea as Neon Drift's RaceChannel.
 */
export class DodgeChannel {
  private readonly channel: RealtimeChannel | null;
  private readonly cbs: Array<(p: DodgePayload) => void> = [];

  constructor(code: string, round: number) {
    const supabase = getSupabase();
    if (!supabase) {
      this.channel = null;
      return;
    }

    this.channel = supabase.channel(`dodge:${code}:${round}`, {
      config: { broadcast: { self: false } },
    });
    this.channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      for (const cb of this.cbs) cb(payload as DodgePayload);
    });
    this.channel.subscribe();
  }

  send(payload: DodgePayload): void {
    if (!this.channel) return;
    void this.channel.send({ type: "broadcast", event: "pos", payload });
  }

  onPos(cb: (p: DodgePayload) => void): void {
    this.cbs.push(cb);
  }

  dispose(): void {
    if (!this.channel) return;
    const supabase = getSupabase();
    if (supabase) void supabase.removeChannel(this.channel);
  }
}
