/**
 * Sound.
 *
 * Every effect is SYNTHESISED with the Web Audio API rather than loaded from
 * a file. That is a real trade -- a sampled "clack" of a real dice is nicer
 * than an oscillator pretending to be one -- but it buys three things that
 * matter more here: the app ships with no audio assets to license or host,
 * it makes no network request, and it starts instantly.
 *
 * Browsers refuse to play audio until the user has interacted with the page,
 * so the AudioContext is created lazily on the first click and resumed on
 * every play in case the tab was backgrounded.
 */

export type SoundName =
  | "click"
  | "toggle"
  | "dice"
  | "diceResult"
  | "step"
  | "capture"
  | "ladder"
  | "snake"
  | "home"
  | "victory"
  | "sparkle"
  | "error"
  | "select"
  | "pop";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

let soundOn = true;
let musicOn = true;
let musicTimer: number | null = null;
let musicStep = 0;

/** Shared noise buffer: dice rattle and confetti both use it. */
let noiseBuffer: AudioBuffer | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = soundOn ? 1 : 0;
  sfxGain.connect(master);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(master);

  const frames = ctx.sampleRate * 0.6;
  noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

  return ctx;
}

/** Call from any user gesture; unlocks audio on browsers that require it. */
export function unlockAudio(): void {
  const c = ensureContext();
  if (c && c.state === "suspended") void c.resume();
  if (musicOn) startMusic();
}

function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  peak: number,
  destination: AudioNode,
  endFreq?: number,
): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
  }
  // A short attack then an exponential tail: percussive without a click.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.015, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(start: number, duration: number, peak: number, filterHz: number): void {
  if (!ctx || !noiseBuffer || !sfxGain) return;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterHz;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export function playSound(name: SoundName): void {
  if (!soundOn) return;
  const c = ensureContext();
  if (!c || !sfxGain) return;
  if (c.state === "suspended") void c.resume();

  const now = c.currentTime;
  const out = sfxGain;

  switch (name) {
    case "click":
      tone(660, now, 0.07, "triangle", 0.22, out, 880);
      break;

    case "select":
      tone(523.25, now, 0.09, "triangle", 0.22, out);
      tone(783.99, now + 0.05, 0.1, "triangle", 0.18, out);
      break;

    case "toggle":
      tone(440, now, 0.08, "square", 0.12, out, 660);
      break;

    case "pop":
      tone(300, now, 0.09, "sine", 0.28, out, 900);
      break;

    case "dice":
      // Four little knocks: a die tumbling in a cup.
      for (let i = 0; i < 5; i += 1) {
        noise(now + i * 0.075, 0.06, 0.2, 900 + Math.random() * 1400);
      }
      break;

    case "diceResult":
      tone(880, now, 0.1, "triangle", 0.25, out);
      tone(1174.66, now + 0.07, 0.16, "triangle", 0.2, out);
      break;

    case "step":
      tone(1050, now, 0.045, "sine", 0.14, out);
      break;

    case "capture":
      // A downward swoop and a thump: something has been knocked over.
      tone(700, now, 0.22, "sawtooth", 0.18, out, 120);
      noise(now + 0.14, 0.16, 0.22, 220);
      break;

    case "ladder": {
      // Rising major arpeggio -- unmistakably "up".
      const up = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      up.forEach((f, i) => tone(f, now + i * 0.075, 0.22, "triangle", 0.2, out));
      break;
    }

    case "snake": {
      // A long glide down, plus a hiss.
      tone(700, now, 0.75, "sine", 0.2, out, 130);
      noise(now, 0.6, 0.07, 2600);
      break;
    }

    case "home":
      [783.99, 1046.5, 1318.51].forEach((f, i) =>
        tone(f, now + i * 0.08, 0.34, "triangle", 0.2, out),
      );
      break;

    case "victory": {
      // A short fanfare: I-IV-V-I with the last chord held.
      const melody: [number, number][] = [
        [523.25, 0],
        [659.25, 0.13],
        [783.99, 0.26],
        [1046.5, 0.39],
        [783.99, 0.56],
        [1046.5, 0.68],
        [1318.51, 0.82],
      ];
      for (const [freq, at] of melody) {
        tone(freq, now + at, 0.3, "triangle", 0.24, out);
        tone(freq / 2, now + at, 0.3, "sine", 0.1, out);
      }
      tone(1046.5, now + 1.0, 0.9, "triangle", 0.22, out);
      tone(1567.98, now + 1.0, 0.9, "sine", 0.12, out);
      break;
    }

    case "sparkle":
      for (let i = 0; i < 7; i += 1) {
        tone(1400 + Math.random() * 1600, now + i * 0.045, 0.14, "sine", 0.09, out);
      }
      break;

    case "error":
      // Low and short. Never harsh: it tells a child "not that one", not
      // "you did something bad".
      tone(200, now, 0.14, "square", 0.1, out, 150);
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Background music                                                    */
/* ------------------------------------------------------------------ */

/**
 * A slow major-pentatonic loop. Pentatonic because no two notes in it can
 * clash, so a randomly wandering melody still sounds deliberate -- and
 * because the tune never resolves anywhere it does not nag after ten
 * minutes of play, which is the real risk with children's game music.
 */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const BASS = [130.81, 174.61, 196.0, 146.83];

function scheduleMusicBar(): void {
  if (!ctx || !musicGain) return;
  const now = ctx.currentTime + 0.05;
  const beat = 0.44;
  const bar = musicStep % 4;

  tone(BASS[bar], now, beat * 1.8, "sine", 0.16, musicGain);
  tone(BASS[bar] * 2, now + beat * 2, beat * 1.4, "sine", 0.08, musicGain);

  for (let i = 0; i < 4; i += 1) {
    // Leave gaps: a melody with rests is far less tiring than a constant one.
    if (Math.random() < 0.32) continue;
    const note = SCALE[Math.floor(Math.random() * SCALE.length)];
    tone(note, now + i * beat, beat * 0.85, "triangle", 0.055, musicGain);
  }

  musicStep += 1;
}

export function startMusic(): void {
  if (!musicOn) return;
  const c = ensureContext();
  if (!c || !musicGain) return;
  if (c.state === "suspended") void c.resume();
  if (musicTimer !== null) return;

  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setValueAtTime(musicGain.gain.value, c.currentTime);
  musicGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 1.4);

  scheduleMusicBar();
  musicTimer = window.setInterval(scheduleMusicBar, 4 * 440);
}

export function stopMusic(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  }
}

export function setSoundEnabled(enabled: boolean): void {
  soundOn = enabled;
  if (sfxGain && ctx) {
    sfxGain.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.02);
  }
}

export function setMusicEnabled(enabled: boolean): void {
  musicOn = enabled;
  if (enabled) startMusic();
  else stopMusic();
}
