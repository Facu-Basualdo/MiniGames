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

/** PSG-flavored effects: square/triangle voices with fast envelopes plus
 *  filtered-noise "crowd", in the spirit of 16-bit consoles. All synthesized
 *  here — no samples. */
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

  /** Square blip helper: one PSG voice with a pitch slide and a hard decay. */
  private static blip(
    ctx: AudioContext,
    at: number,
    from: number,
    to: number,
    dur: number,
    volume: number,
    type: OscillatorType = "square",
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur);
  }

  /** Filtered noise burst: the crowd voice (cheer up-swell or groan decay). */
  private static crowd(
    ctx: AudioContext,
    at: number,
    dur: number,
    volume: number,
    filterFrom: number,
    filterTo: number,
    swell: boolean,
  ): void {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(filterFrom, at);
    filter.frequency.exponentialRampToValueAtTime(filterTo, at + dur);
    const gain = ctx.createGain();
    if (swell) {
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + dur * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    } else {
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    }
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(at);
    noise.stop(at + dur);
  }

  /** Dry thump of the boot striking the ball. */
  static playKick(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 190, 70, 0.09, SOUND_VOLUME * 0.9, "square");
    this.crowd(ctx, now, 0.06, SOUND_VOLUME * 0.5, 2200, 900, false);
  }

  /** Save: two quick rising square notes plus a short cheer. */
  static playSave(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 659, 659, 0.07, SOUND_VOLUME * 0.7);
    this.blip(ctx, now + 0.08, 880, 880, 0.12, SOUND_VOLUME * 0.7);
    this.crowd(ctx, now + 0.05, 0.5, SOUND_VOLUME * 0.55, 900, 1600, true);
  }

  /** Conceded goal: a falling three-note buzzer over a crowd groan. */
  static playGoal(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const notes = [440, 349.2, 277.2]; // A4, F4, C#4 — sour on purpose
    notes.forEach((freq, i) => {
      this.blip(ctx, now + i * 0.13, freq, freq * 0.97, 0.14, SOUND_VOLUME * 0.8);
    });
    this.crowd(ctx, now, 0.8, SOUND_VOLUME * 0.6, 700, 250, false);
  }

  /** Referee whistle on YA: one shrill square with vibrato. */
  static playWhistle(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2350, now);
    vibrato.type = "sine";
    vibrato.frequency.setValueAtTime(38, now);
    vibratoGain.gain.setValueAtTime(90, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now);
    gain.gain.setValueAtTime(SOUND_VOLUME * 0.5, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    vibrato.start(now);
    osc.stop(now + 0.32);
    vibrato.stop(now + 0.32);
  }

  /** Game over: slow falling arpeggio, the run is done. */
  static playGameOver(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const notes = [523.25, 392, 311.1, 261.6]; // C5, G4, Eb4, C4
    notes.forEach((freq, i) => {
      this.blip(ctx, now + i * 0.16, freq, freq, 0.22, SOUND_VOLUME * 0.7, "triangle");
    });
  }
}
