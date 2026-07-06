let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

/** Efectos sintetizados con Web Audio (sin assets). */
export class SoundEffects {
  /** Countdown tick (3 / 2 / 1 / YA) — mismo blip que el resto del repo. */
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

  /** Ficha que cae: un tono distinto por jugador (0 grave, 1 agudo) con un toque de golpe. */
  static playDrop(player: number): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    const base = player === 0 ? 330.0 : 440.0; // E4 / A4
    osc.frequency.setValueAtTime(base * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Arpegio ascendente al ganar la partida. */
  static playWin(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 783.99]; // G4 C5 E5 G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "triangle";
      const t = now + idx * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  /** Figura descendente al perder. */
  static playLose(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = [523.25, 415.3, 311.13]; // C5 G#4 D#4
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "triangle";
      const t = now + idx * 0.14;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Empate (tablero lleno): dos tonos neutros. */
  static playDraw(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = [440.0, 440.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      const t = now + idx * 0.16;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  }
}
