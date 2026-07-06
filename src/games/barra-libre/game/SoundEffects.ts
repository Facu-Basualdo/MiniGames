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
 *  filtered-noise textures (pour foam, glass crash, bar murmur), in the
 *  spirit of 16-bit consoles. All synthesized here — no samples. */
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

  /** Filtered noise burst: foam, sliding glass, breaking glass, murmur. */
  private static noise(
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
    const source = ctx.createBufferSource();
    source.buffer = buffer;
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
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(at);
    source.stop(at + dur);
  }

  /** Tap open: foamy noise swelling up while the mug fills. */
  static playPour(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.noise(ctx, now, 0.5, SOUND_VOLUME * 0.45, 500, 1300, true);
  }

  /** The mug hits full: a satisfied little ding. */
  static playFull(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 1046, 1046, 0.09, SOUND_VOLUME * 0.5, "sine");
  }

  /** Full mug shoved down the bar: a swish over a low knock. */
  static playServe(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 300, 170, 0.08, SOUND_VOLUME * 0.7);
    this.noise(ctx, now, 0.16, SOUND_VOLUME * 0.4, 1800, 700, false);
  }

  /** A customer grabs the beer mid-slide. */
  static playServedHit(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 520, 660, 0.08, SOUND_VOLUME * 0.6);
  }

  /** Satisfied customer shoved out the far end: little cheer. */
  static playSatisfied(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 659, 659, 0.07, SOUND_VOLUME * 0.6);
    this.blip(ctx, now + 0.08, 880, 880, 0.12, SOUND_VOLUME * 0.6);
    this.noise(ctx, now + 0.04, 0.4, SOUND_VOLUME * 0.4, 800, 1400, true);
  }

  /** Empty mug caught at the tap end. */
  static playCatch(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 880, 740, 0.06, SOUND_VOLUME * 0.5, "triangle");
    this.blip(ctx, now, 190, 150, 0.05, SOUND_VOLUME * 0.5);
  }

  /** Tip grabbed: the classic two-note coin. */
  static playCoin(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 988, 988, 0.08, SOUND_VOLUME * 0.6);
    this.blip(ctx, now + 0.08, 1319, 1319, 0.25, SOUND_VOLUME * 0.6);
  }

  /** Half-poured mug dumped in the sink: a sad droop. */
  static playDiscard(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 220, 130, 0.14, SOUND_VOLUME * 0.5, "triangle");
    this.noise(ctx, now, 0.12, SOUND_VOLUME * 0.3, 900, 400, false);
  }

  /** A beer smashes on the far wall: bright glass burst. */
  static playCrash(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.noise(ctx, now, 0.3, SOUND_VOLUME * 0.6, 3200, 1200, false);
    this.blip(ctx, now + 0.02, 1200, 500, 0.12, SOUND_VOLUME * 0.4, "square");
  }

  /** Any strike: sour falling buzzer. */
  static playStrike(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    const notes = [440, 349.2, 277.2]; // A4, F4, C#4 — sour on purpose
    notes.forEach((freq, i) => {
      this.blip(ctx, now + i * 0.13, freq, freq * 0.97, 0.14, SOUND_VOLUME * 0.8);
    });
  }

  /** Round start on YA: the service bell, ding-ding. */
  static playBell(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    this.resume(ctx);
    const now = ctx.currentTime;
    this.blip(ctx, now, 1568, 1568, 0.18, SOUND_VOLUME * 0.5, "sine");
    this.blip(ctx, now + 0.14, 1568, 1568, 0.3, SOUND_VOLUME * 0.5, "sine");
  }

  /** Game over: slow falling arpeggio, the night is done. */
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
