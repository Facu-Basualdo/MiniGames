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

/** Synthesized sound effects (Web Audio API, no assets). */
export class SoundEffects {
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

  static playScore(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  static playHit(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.3);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  static playLaser(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  static playEnemyLaser(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.18);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  static playExplosion(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    
    // Create noise buffer
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Add a low rumble oscillator to make the explosion heavier
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    rumble.type = "triangle";
    rumble.frequency.setValueAtTime(120, now);
    rumble.frequency.linearRampToValueAtTime(30, now + 0.4);

    rumbleGain.gain.setValueAtTime(0.15, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.start(now);
    rumble.start(now);
    
    noise.stop(now + 0.45);
    rumble.stop(now + 0.45);
  }

  static playPowerUp(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.05 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.2);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.22);
    });
  }
}
