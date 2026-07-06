import { SOUND_VOLUME } from "./constants";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

export class SoundEffects {
  private static resume(ctx: AudioContext): void {
    if (ctx.state === "suspended") ctx.resume();
  }

  /** Blip corto para cada paso del countdown 3 / 2 / 1 / YA. */
  static playCountdownTick(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(750, now);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Thwip de la telaraña enganchando un anclaje. */
  static playAttach(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.09);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /** Whoosh al soltarse de la telaraña. */
  static playRelease(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Arpegio ascendente para el bonus de lanzamiento veloz. */
  static playBonus(points: number): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const base = 523.25 * Math.pow(1.05, Math.min(points, 8));
    const notes = [base, base * 1.25, base * 1.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(SOUND_VOLUME * 0.8, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  /** Tonos descendentes cuando el cerdo se estrella contra la calle. */
  static playSplat(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const notes = [392.0, 311.13, 233.08]; // G4, Eb4, Bb3
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.25);
    });
  }
}
