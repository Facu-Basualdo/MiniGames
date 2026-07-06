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

// Pentatonic ladder so climbing combos always sound consonant.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

function tone(freq: number, peak: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  osc.start(now);
  osc.stop(now + 0.16);
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

  /** Bright note on a perfect hit; pitch climbs the scale with the combo. */
  static playPerfect(combo: number): void {
    tone(SCALE[Math.min(combo, SCALE.length - 1)], 0.16);
  }

  /** Softer note on a good hit; also climbs with the combo. */
  static playGood(combo: number): void {
    tone(SCALE[Math.min(combo, SCALE.length - 1)] / 2, 0.12);
  }

  /** Dull buzz when a note is missed. */
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
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Descending three-note figure when health runs out. */
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
