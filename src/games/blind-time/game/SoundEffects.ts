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
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export class SoundEffects {
  /** Countdown number ticks (3, 2, 1) */
  static playTick(): void {
    blip(800, 800, 0.05, "sine", 0.1);
  }

  /** Start gameplay beep (YA!) */
  static playStart(): void {
    blip(1000, 1500, 0.15, "triangle", 0.15);
  }

  /** Stopped close to target (< 150 ms) */
  static playSuccess(): void {
    const ctx = resumed();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Arpeggio C major
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.01, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  }

  /** Stopped with moderate precision */
  static playNeutral(): void {
    blip(600, 650, 0.12, "sine", 0.12);
  }

  /** Early click or timeout fail */
  static playFail(): void {
    blip(220, 110, 0.3, "sawtooth", 0.15);
  }
}
