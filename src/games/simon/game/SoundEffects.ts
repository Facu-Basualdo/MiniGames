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

// Un tono distinto por pad (verde / rojo / azul / amarillo).
const PAD_FREQS = [329.63, 261.63, 392.0, 493.88]; // E4, C4, G4, B4

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

  /** Tono del pad al encenderse (en la secuencia o al tocarlo). */
  static playPad(index: number): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(PAD_FREQS[index % PAD_FREQS.length], now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  /** Low buzz on a wrong pad. */
  static playWrong(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.28);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Descending figure when the run ends. */
  static playGameOver(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = [523.25, 415.3, 311.13]; // C5, G#4, D#4
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.3);

      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.3);
    });
  }
}
