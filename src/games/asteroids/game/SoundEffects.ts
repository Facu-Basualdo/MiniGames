import { SOUND_VOLUME } from "./constants";

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

  private static resumeContext(ctx: AudioContext): void {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  static playLaser(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resumeContext(ctx);

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    gain.gain.setValueAtTime(SOUND_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  static playExplosion(size: number): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resumeContext(ctx);

    const now = ctx.currentTime;
    // Map size: 3 = Large, 2 = Medium, 1 = Small
    const duration = size === 3 ? 0.6 : size === 2 ? 0.4 : 0.2;
    const volume = size === 3 ? SOUND_VOLUME * 1.5 : size === 2 ? SOUND_VOLUME * 1.1 : SOUND_VOLUME * 0.8;
    const filterFreq = size === 3 ? 200 : size === 2 ? 400 : 800;

    // Create white noise buffer
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(1, now);

    const gain = ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    // Add a low frequency oscillator for rumble on large explosions
    if (size === 3) {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(90, now);
      subOsc.frequency.linearRampToValueAtTime(10, now + duration);

      subGain.gain.setValueAtTime(volume * 0.8, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + duration);
    }

    noise.start(now);
    noise.stop(now + duration);
  }

  static playThrust(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resumeContext(ctx);

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Low frequency rumble whoosh
    osc.type = "triangle";
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.linearRampToValueAtTime(35, now + 0.1);

    gain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  static playLoseLife(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resumeContext(ctx);

    const now = ctx.currentTime;
    const duration = 0.8;

    // A sad descending siren sound + low rumble
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(350, now);
    osc1.frequency.linearRampToValueAtTime(80, now + duration);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(175, now);
    osc2.frequency.linearRampToValueAtTime(40, now + duration);

    gain.gain.setValueAtTime(SOUND_VOLUME * 1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + duration);
    osc2.start(now);
    osc2.stop(now + duration);
  }

  static playLevelUp(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resumeContext(ctx);

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(SOUND_VOLUME * 0.8, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(SOUND_VOLUME * 0.8, now + idx * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.25);
    });
  }
}
