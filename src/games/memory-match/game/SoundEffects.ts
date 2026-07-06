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

function blip(freqFrom: number, freqTo: number, duration: number, type: OscillatorType): void {
  const ctx = resumed();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freqTo, ctx.currentTime + duration);

  gain.gain.setValueAtTime(0.01, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export class SoundEffects {
  /** Countdown tick (3 / 2 / 1 / YA) — same blip as El Trile. */
  static playCountdownTick(): void {
    const ctx = resumed();
    if (!ctx) return;

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

  /** Carta que se da vuelta. */
  static playFlip(): void {
    blip(320, 520, 0.09, "triangle");
  }

  /** Par encontrado. */
  static playMatch(): void {
    const ctx = resumed();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 987.77].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.01, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.25);
    });
  }

  /** Las cartas no eran par. */
  static playFail(): void {
    blip(240, 120, 0.16, "sawtooth");
  }

  /** Fin de la partida. */
  static playVictory(): void {
    const ctx = resumed();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.01, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  }
}
