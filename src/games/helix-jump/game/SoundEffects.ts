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
  /** Countdown tick (3 / 2 / 1 / YA) — same blip as El Trile / Jump Ball. */
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

  /** Soft rubbery bounce when ball hits a platform. */
  static playBounce(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Loud shattering explosion sound when a platform is smashed in fireball mode. */
  static playBreak(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    
    // Noise buffer for shatter
    const bufferSize = ctx.sampleRate * 0.25; // 0.25 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    
    const gain = ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    // Also a low frequency sub-thump for power
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    
    subOsc.type = "triangle";
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.linearRampToValueAtTime(40, now + 0.18);
    
    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    noise.start(now);
    noise.stop(now + 0.25);
    subOsc.start(now);
    subOsc.stop(now + 0.2);
  }

  /** Quick bright high chime for passing a level. */
  static playPassLevel(levelCombo: number): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    // Pitch gets slightly higher for combos!
    const pitch = 500 + levelCombo * 120;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Sad descending slide on game over. */
  static playDeath(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.45);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);
  }
}
