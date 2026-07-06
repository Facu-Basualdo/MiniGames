let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/** Synthesized sound effects (Web Audio API, no assets). */
export class SoundEffects {
  /** Countdown tick (3 / 2 / 1 / YA) — same blip as El Trile. */
  static playCountdownTick(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(750, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Clean blip each time a wall is dodged. */
  static playScore(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "square"; // retro chip blip
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.06); // E6
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  /** Harsh noisy crash when the ship hits a wall. */
  static playHit(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "square";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.start(now);
    osc.stop(now + 0.45);
  }
}
