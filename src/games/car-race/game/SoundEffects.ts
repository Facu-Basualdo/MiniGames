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

function tone(freq: number, type: OscillatorType, peak: number, dur: number, startAt = 0): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.start(now);
  osc.stop(now + dur);
}

/** Synthesized sound effects (Web Audio API, no assets). */
export class SoundEffects {
  /** Countdown tick (3 / 2 / 1 / YA) — same blip as El Trile. */
  static playCountdownTick(): void {
    tone(750, "sine", 0.08, 0.05);
  }

  /** Quick blip when a lap is completed (but the race continues). */
  static playLap(): void {
    tone(659.25, "triangle", 0.14, 0.12);
    tone(880, "triangle", 0.14, 0.14, 0.1);
  }

  /** Ascending fanfare when crossing the finish line. */
  static playFinish(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => tone(freq, "sine", 0.15, 0.3, idx * 0.11));
  }
}
