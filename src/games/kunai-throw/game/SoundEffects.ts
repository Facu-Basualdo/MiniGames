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

  /** Countdown tick (3 / 2 / 1 / YA) — same blip as El Trile. */
  static playCountdownTick(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);

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

  /** Whoosh of a kunai being launched. */
  static playThrow(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Solid "thunk" of the blade sinking into the wood. */
  static playStick(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    // Short noise burst for the impact texture.
    const dur = 0.12;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(SOUND_VOLUME, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + dur);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);

    // Low thud body.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.1);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Metallic clang when two kunais collide (fail). */
  static playClang(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const freqs = [1200, 1800, 2600];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + 0.3);
      gain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  /** Rising arpeggio when a level is cleared. */
  static playLevelUp(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 784.0]; // G4, C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(SOUND_VOLUME * 0.8, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.25);
    });
  }
}
