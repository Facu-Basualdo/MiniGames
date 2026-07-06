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
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export class SoundEffects {
  /** Countdown tick */
  static playTick(): void {
    blip(750, 750, 0.05, "sine", 0.08);
  }

  /** Shuffling start */
  static playStart(): void {
    blip(880, 1320, 0.15, "triangle", 0.12);
  }

  /** Swap whoosh sound */
  static playSwap(): void {
    blip(400, 200, 0.08, "triangle", 0.05);
  }

  /** Click cup selection */
  static playSelect(): void {
    blip(600, 400, 0.03, "sine", 0.1);
  }

  /** Correct guess chime */
  static playSuccess(): void {
    const ctx = resumed();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.01, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.25);
    });
  }

  /** Wrong guess buzzer */
  static playFail(): void {
    blip(180, 90, 0.35, "sawtooth", 0.12);
  }
}
