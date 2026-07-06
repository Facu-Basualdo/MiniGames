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

  /** Golpe a un topo normal: un "bonk" grave y contundente. */
  static playWhack(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    gain.gain.setValueAtTime(SOUND_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // Chasquido corto encima
    const dur = 0.06;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);
  }

  /** Golpe a un topo dorado: campanita ascendente. */
  static playGolden(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    const notes = [660, 880, 1320];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.18);
    });
  }

  /** Golpe a una bomba: explosion. */
  static playBomb(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    const dur = 0.4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + dur);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(SOUND_VOLUME * 1.1, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Martillazo al vacio: un silbido seco. */
  static playMiss(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    const dur = 0.12;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(SOUND_VOLUME * 0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);
  }

  /** Tick del countdown 3/2/1/YA: blip senoidal de 750 Hz (ver root CLAUDE.md). */
  static playCountdownTick(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(750, now);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Fin de la partida: arpegio descendente. */
  static playGameOver(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;

    const notes = [523, 440, 349, 262];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(SOUND_VOLUME * 0.6, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.3);
    });
  }
}
