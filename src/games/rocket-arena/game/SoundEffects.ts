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

function tone(
  freq: number,
  type: OscillatorType,
  peak: number,
  dur: number,
  startAt = 0,
  sweepTo?: number,
): void {
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
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.start(now);
  osc.stop(now + dur);
}

/** Synthesized sound effects (Web Audio API, no assets). */
export class SoundEffects {
  /** Punchy thump when the player's car strikes the ball. */
  static playKick(): void {
    tone(220, "square", 0.14, 0.1, 0, 120);
  }

  /** Rising three-note fanfare when a goal is scored. */
  static playGoal(): void {
    const notes = [523.25, 659.25, 880];
    notes.forEach((freq, idx) => tone(freq, "sawtooth", 0.16, 0.28, idx * 0.1));
  }

  /** Bright shimmer when a boost pad is collected. */
  static playBoostPad(): void {
    tone(660, "sine", 0.1, 0.12, 0, 990);
  }

  /** Harsh burst when the player's car is demolished. */
  static playDemolish(): void {
    tone(180, "sawtooth", 0.2, 0.4, 0, 40);
  }

  /** Countdown tick (3 / 2 / 1 / YA) — same blip as El Trile. */
  static playCountdownTick(): void {
    tone(750, "sine", 0.08, 0.05);
  }

  /** Referee-style whistle burst at the final whistle. */
  static playWhistle(): void {
    tone(1760, "sine", 0.12, 0.35, 0, 2093);
  }
}
