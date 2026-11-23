import { BellSound } from '../types';

let audioCtxInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtxInstance) {
    const CtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (CtxClass) {
      audioCtxInstance = new CtxClass();
    }
  }
  return audioCtxInstance;
}

export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playDeskBellRing(ctx: AudioContext, startTime: number, masterGain: GainNode): void {
  const frequencies = [1850, 3700, 5550];
  const relativeGains = [0.6, 0.25, 0.15];

  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = idx === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const gainVal = relativeGains[idx];
    oscGain.gain.setValueAtTime(gainVal, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
}

function playDeskBell(ctx: AudioContext, volume: number): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, ctx.currentTime);
  master.connect(ctx.destination);

  playDeskBellRing(ctx, ctx.currentTime, master);
  playDeskBellRing(ctx, ctx.currentTime + 0.32, master);
}

function playAscendingChime(ctx: AudioContext, volume: number): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, ctx.currentTime);
  master.connect(ctx.destination);

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const stepTime = 0.18;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const t = ctx.currentTime + idx * stepTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    noteGain.gain.setValueAtTime(0.001, t);
    noteGain.gain.linearRampToValueAtTime(0.7, t + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

    osc.connect(noteGain);
    noteGain.connect(master);

    osc.start(t);
    osc.stop(t + 0.7);
  });
}

function playDigitalBeep(ctx: AudioContext, volume: number): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(volume * 0.8, ctx.currentTime);
  master.connect(ctx.destination);

  const pulseLen = 0.08;
  const gap = 0.06;

  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * (pulseLen + gap);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.setValueAtTime(0.0001, t + pulseLen);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + pulseLen + 0.01);
  }
}

export function playBell(sound: BellSound = 'bell', volume = 0.8): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const safeVol = Math.max(0, Math.min(1, volume));

  if (sound === 'bell') {
    playDeskBell(ctx, safeVol);
  } else if (sound === 'chime') {
    playAscendingChime(ctx, safeVol);
  } else {
    playDigitalBeep(ctx, safeVol);
  }
}
