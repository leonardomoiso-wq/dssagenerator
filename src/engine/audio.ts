// Traccia audio del progetto: decodifica, inviluppo (volume e dissolvenze), mixaggio per
// l'esportazione, forma d'onda per l'interfaccia, rilevamento dei battiti al minuto.

export interface AudioTrack {
  /** File audio come data URL (resta dentro il progetto salvato). */
  src: string;
  name: string;
  /** Secondo della traccia da cui parte il video. */
  start: number;
  /** 0-1. */
  volume: number;
  fadeIn: number;
  fadeOut: number;
  /** Battiti al minuto (0 = non impostato). */
  bpm: number;
  /** Secondo della traccia in cui cade un battito. */
  beatOffset: number;
  /** Aggancia pulsazioni, onde e rotazioni ai battiti. */
  sync: boolean;
}

export function newTrack(src: string, name: string): AudioTrack {
  return { src, name, start: 0, volume: 0.9, fadeIn: 0.3, fadeOut: 1, bpm: 0, beatOffset: 0, sync: false };
}

let actx: AudioContext | null = null;
function audioContext() {
  if (!actx) actx = new AudioContext();
  return actx;
}

const buffers = new Map<string, Promise<AudioBuffer>>();

export function decodeTrack(src: string): Promise<AudioBuffer> {
  let p = buffers.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => r.arrayBuffer())
      .then((b) => audioContext().decodeAudioData(b));
    buffers.set(src, p);
  }
  return p;
}

/** Guadagno nel secondo t del video (durata d): volume con dissolvenze. */
export function envelope(a: AudioTrack, t: number, d: number) {
  let g = a.volume;
  if (a.fadeIn > 0) g *= Math.min(1, Math.max(0, t / a.fadeIn));
  if (a.fadeOut > 0) g *= Math.min(1, Math.max(0, (d - t) / a.fadeOut));
  return g;
}

/**
 * Mixaggio della traccia per un video lungo `duration` secondi che inizia `offset` secondi
 * dopo l'inizio della serie (0 per un video singolo).
 */
export async function renderTrack(a: AudioTrack, duration: number, offset = 0, sampleRate = 48000): Promise<AudioBuffer> {
  const buf = await decodeTrack(a.src);
  const ch = Math.min(2, buf.numberOfChannels);
  const off = new OfflineAudioContext(ch, Math.max(1, Math.ceil(duration * sampleRate)), sampleRate);
  const node = off.createBufferSource();
  node.buffer = buf;
  const gain = off.createGain();
  // Inviluppo campionato fitto: dissolvenze lineari esatte.
  const steps = Math.max(2, Math.ceil(duration * 50));
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) curve[i] = envelope(a, offset + (i / (steps - 1)) * duration, offset + duration);
  gain.gain.setValueCurveAtTime(curve, 0, duration);
  node.connect(gain).connect(off.destination);
  const from = a.start + offset;
  if (from < buf.duration) node.start(0, from);
  return off.startRendering();
}

/** Picchi della forma d'onda, normalizzati, per il disegno. */
export async function waveform(src: string, points = 600): Promise<{ peaks: Float32Array; duration: number }> {
  const buf = await decodeTrack(src);
  const data = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / points));
  const peaks = new Float32Array(points);
  let max = 1e-6;
  for (let i = 0; i < points; i++) {
    let m = 0;
    const end = Math.min(data.length, (i + 1) * step);
    for (let j = i * step; j < end; j += 4) m = Math.max(m, Math.abs(data[j]));
    peaks[i] = m;
    max = Math.max(max, m);
  }
  for (let i = 0; i < points; i++) peaks[i] /= max;
  return { peaks, duration: buf.duration };
}

/**
 * Stima dei battiti al minuto e della fase: inviluppo di energia, attacchi (differenze
 * positive), autocorrelazione tra 70 e 180 BPM con preferenza intorno a 120.
 */
export async function detectBeat(src: string, from = 0, seconds = 45): Promise<{ bpm: number; offset: number } | null> {
  const buf = await decodeTrack(src);
  const sr = buf.sampleRate;
  const hop = 512;
  const fr = sr / hop;
  const s0 = Math.floor(from * sr);
  const s1 = Math.min(buf.length, s0 + Math.floor(seconds * sr));
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const n = Math.floor((s1 - s0) / hop);
  if (n < fr * 4) return null;
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (const ch of chans) for (let j = s0 + i * hop; j < s0 + (i + 1) * hop; j += 2) e += ch[j] * ch[j];
    energy[i] = Math.log1p(e * 100);
  }
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, energy[i] - energy[i - 1]);
  const mean = onset.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) onset[i] = Math.max(0, onset[i] - mean);
  const minLag = Math.floor((60 / 180) * fr);
  const maxLag = Math.ceil((60 / 70) * fr);
  let best = { lag: 0, v: -Infinity };
  const score: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let v = 0;
    for (let i = 0; i + lag < n; i++) v += onset[i] * onset[i + lag];
    const bpm = (60 * fr) / lag;
    v *= Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    score[lag] = v;
    if (v > best.v) best = { lag, v };
  }
  if (!best.lag) return null;
  // Rifinitura parabolica del picco.
  const a = score[best.lag - 1] ?? best.v;
  const c = score[best.lag + 1] ?? best.v;
  const delta = a - 2 * best.v + c !== 0 ? (0.5 * (a - c)) / (a - 2 * best.v + c) : 0;
  const lag = best.lag + Math.max(-0.5, Math.min(0.5, delta));
  const bpm = Math.round(((60 * fr) / lag) * 2) / 2;
  // Fase: la griglia di battiti che raccoglie più attacchi.
  const period = (60 / bpm) * fr;
  let bestPhase = { p: 0, v: -1 };
  for (let p = 0; p < period; p++) {
    let v = 0;
    for (let k = p; k < n; k += period) v += onset[Math.round(k)] ?? 0;
    if (v > bestPhase.v) bestPhase = { p, v };
  }
  return { bpm, offset: from + bestPhase.p / fr };
}

/** Battiti trascorsi nel secondo t del video (con l'eventuale scarto della slide nella serie). */
export function beatsAt(a: AudioTrack | undefined, t: number, timelineOffset = 0) {
  if (!a || !a.sync || !a.bpm) return t;
  return ((a.start + timelineOffset + t - a.beatOffset) * a.bpm) / 60;
}

// --- Codifica per l'esportazione nel browser ---

export async function audioCodec(sampleRate: number, channels: number): Promise<{ codec: string; mux: 'aac' | 'opus' } | null> {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const [codec, mux] of [
    ['mp4a.40.2', 'aac'],
    ['opus', 'opus'],
  ] as const) {
    try {
      const r = await AudioEncoder.isConfigSupported({ codec, sampleRate, numberOfChannels: channels, bitrate: 192000 });
      if (r.supported) return { codec, mux };
    } catch {
      /* il successivo */
    }
  }
  return null;
}

/** Codifica il buffer in blocchi e li passa al multiplexer. */
export async function encodeAudio(buf: AudioBuffer, codec: string, onChunk: (c: EncodedAudioChunk, m?: EncodedAudioChunkMetadata) => void) {
  let failure: unknown = null;
  const enc = new AudioEncoder({ output: onChunk, error: (e) => (failure = e) });
  enc.configure({ codec, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels, bitrate: 192000 });
  const block = 1024;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  for (let i = 0; i < buf.length; i += block) {
    const len = Math.min(block, buf.length - i);
    const planar = new Float32Array(len * chans.length);
    chans.forEach((ch, c) => planar.set(ch.subarray(i, i + len), c * len));
    const ad = new AudioData({
      format: 'f32-planar',
      sampleRate: buf.sampleRate,
      numberOfFrames: len,
      numberOfChannels: chans.length,
      timestamp: Math.round((i / buf.sampleRate) * 1e6),
      data: planar,
    });
    enc.encode(ad);
    ad.close();
    if (failure) throw failure;
    if (enc.encodeQueueSize > 20) await new Promise((r) => setTimeout(r, 1));
  }
  await enc.flush();
  enc.close();
  if (failure) throw failure;
}
