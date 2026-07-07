let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

function resumed(): AudioContext | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freqFrom: number, freqTo: number, duration: number, type: OscillatorType, volume = 0.15): void {
  const ctx = resumed();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
  if (freqTo !== freqFrom) {
    osc.frequency.exponentialRampToValueAtTime(freqTo, ctx.currentTime + duration);
  }
  gain.gain.setValueAtTime(0.01, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export class SoundEffects {
  /** Shared 750 Hz countdown tick (3, 2, 1, YA). */
  static playCountdownTick(): void {
    blip(750, 750, 0.08, "sine", 0.12);
  }

  /** Start gameplay beep (YA!). */
  static playStart(): void {
    blip(1000, 1500, 0.15, "triangle", 0.15);
  }

  /** The color vanishes at the end of the memorize window. */
  static playVanish(): void {
    blip(680, 240, 0.28, "sine", 0.12);
  }

  /** Reveal chord scaled by how good the guess was. */
  static playReveal(pct: number): void {
    const ctx = resumed();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Higher accuracy -> brighter, fuller chord.
    const base = pct >= 88 ? [523.25, 659.25, 783.99] : pct >= 65 ? [440, 554.37, 659.25] : [330, 392];
    base.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.01, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.35);
    });
  }

  /** Soft click when a slider is released / confirmed. */
  static playConfirm(): void {
    blip(520, 700, 0.1, "triangle", 0.1);
  }
}
