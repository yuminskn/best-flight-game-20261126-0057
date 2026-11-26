// audio.js — procedural WebAudio: engine hum, wind, chimes, thuds.
// One job: every sound the game makes, synthesized from nothing.
// No audio files exist; the context starts on the first user gesture.

let ctx = null;
let engineOsc = null;
let engineOsc2 = null;
let engineGain = null;
let windSrc = null;
let windGain = null;
let windFilter = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (engineGain) engineGain.gain.value = muted ? 0 : 0.05;
  if (windGain) windGain.gain.value = muted ? 0 : 0;
  return muted;
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  // Engine: two detuned saws, low-passed, pitch follows throttle.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineOsc2 = ctx.createOscillator();
  engineOsc2.type = 'sawtooth';
  engineOsc2.frequency.value = 55 * 1.5;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineGain = ctx.createGain();
  engineGain.gain.value = muted ? 0 : 0.05;
  engineOsc.connect(engineFilter);
  engineOsc2.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(ctx.destination);
  engineOsc.start();
  engineOsc2.start();

  // Wind: looped noise through a band-pass, loudness follows speed.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  windSrc = ctx.createBufferSource();
  windSrc.buffer = buf;
  windSrc.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 500;
  windFilter.Q.value = 0.6;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(ctx.destination);
  windSrc.start();
}

export function updateAudio(throttle, speed) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.1);
  engineOsc2.frequency.setTargetAtTime(78 + throttle * 102, t, 0.1);
  engineGain.gain.setTargetAtTime(0.03 + throttle * 0.05, t, 0.1);
  windGain.gain.setTargetAtTime(Math.min(0.12, (speed / 62) * 0.12), t, 0.15);
  windFilter.frequency.setTargetAtTime(300 + speed * 14, t, 0.15);
}

function tone(freq, dur, type, vol, when = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playRing() {
  tone(880, 0.5, 'sine', 0.16);
  tone(1318, 0.6, 'sine', 0.12, 0.08);
}

export function playGate() {
  tone(659, 0.4, 'sine', 0.15);
  tone(988, 0.5, 'sine', 0.12, 0.07);
}

export function playThud() {
  tone(70, 0.35, 'sine', 0.3);
}

export function playCrash() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = ctx.sampleRate * 0.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  src.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  tone(55, 0.6, 'sine', 0.3);
}

export function playFanfare() {
  tone(523, 0.4, 'sine', 0.15);
  tone(659, 0.4, 'sine', 0.15, 0.12);
  tone(784, 0.5, 'sine', 0.15, 0.24);
  tone(1046, 0.7, 'sine', 0.15, 0.36);
}
