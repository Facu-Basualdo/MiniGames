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

  /** Solid thunk when a block is placed. Pitch rises slightly with the stack height. */
  static playPlace(height: number): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const base = 180 + Math.min(height, 30) * 12;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.6, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  /** Bright two-note chime rewarding a perfect (full-width) drop. */
  static playPerfect(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = [783.99, 1046.5]; // G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.13, now + idx * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.2);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.2);
    });
  }

  /** Low crumble when a drop misses and the tower falls. */
  static playMiss(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}
