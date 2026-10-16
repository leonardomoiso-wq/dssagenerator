// Esportazione nel browser: MP4 H.264 con WebCodecs, fotogramma PNG, progetto JSON.
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { getFormat } from '../brand/tokens';
import { dataUrlBytes, makePdf, makeZip } from './files';
import { durationInFrames, preloadImages, renderFrame } from './render';
import { renderSeriesFrame, seriesTimeline, slideCount, slideProject, stillFrame } from './series';
import type { Project } from './types';

export interface ExportProgress {
  frame: number;
  total: number;
}

const CODECS = ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0034', 'avc1.42003e', 'avc1.42001f'];
/** Ripiego quando il browser non codifica H.264 (es. Chromium senza codec proprietari). */
const FALLBACK = ['vp09.00.40.08', 'vp09.00.50.08'];

export async function supportedCodec(w: number, h: number, fps: number, fallback = false): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of fallback ? [...CODECS, ...FALLBACK] : CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, framerate: fps, bitrate: 12e6 });
      if (r.supported) return codec;
    } catch {
      /* prova il successivo */
    }
  }
  return null;
}

/** Qualità: bitrate in Mbit/s per i formati da 1080 px (Instagram ricomprime comunque). */
export const QUALITY: Record<string, number> = { alta: 16, media: 10, leggera: 6 };

export async function exportMp4(
  project: Project,
  opts: { quality?: keyof typeof QUALITY; onProgress?: (p: ExportProgress) => void; signal?: AbortSignal; series?: boolean } = {},
): Promise<{ blob: Blob; codec: string }> {
  const format = getFormat(project.format);
  const { width, height } = format;
  const fps = project.fps;
  // Serie intera (slide una dopo l'altra) oppure la sola slide attiva.
  const asSeries = !!opts.series && slideCount(project) > 1;
  const tl = asSeries ? seriesTimeline(project) : null;
  const flat = slideProject(project);
  const total = tl ? tl.total : durationInFrames(flat);
  const codec = await supportedCodec(width, height, fps, true);
  if (!codec) throw new Error('Questo browser non codifica video con WebCodecs. Usa Chrome o Edge aggiornati, oppure l’esportazione da riga di comando (npm run render).');
  const avc = codec.startsWith('avc');
  await preloadImages(project);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' } as CanvasRenderingContext2DSettings)!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: avc ? 'avc' : 'vp9', width, height, frameRate: fps },
    fastStart: 'in-memory',
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure({
    codec,
    width,
    height,
    framerate: fps,
    bitrate: (QUALITY[opts.quality ?? 'alta'] ?? 16) * 1e6 * ((width * height) / (1080 * 1920)) ** 0.7,
    bitrateMode: 'variable',
    latencyMode: 'quality',
    ...(avc ? { avc: { format: 'avc' as const } } : {}),
  });

  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) {
      encoder.close();
      throw new DOMException('Esportazione annullata', 'AbortError');
    }
    if (failure) throw failure;
    if (tl) renderSeriesFrame(ctx, project, i, tl);
    else renderFrame(ctx, flat, i);
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
    opts.onProgress?.({ frame: i + 1, total });
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), codec };
}

export async function exportPng(project: Project, frame: number): Promise<Blob> {
  const format = getFormat(project.format);
  await preloadImages(project);
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d')!;
  renderFrame(ctx, slideProject(project), frame);
  return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG'))), 'image/png'));
}

/**
 * Immagini fisse di tutte le slide: ZIP di PNG (carosello Instagram) o PDF (carosello LinkedIn).
 * Per ogni slide si usa l'ultimo fotogramma prima dell'eventuale finale animato.
 */
export async function exportCarousel(project: Project, kind: 'zip' | 'pdf', onProgress?: (p: ExportProgress) => void): Promise<Blob> {
  const format = getFormat(project.format);
  await preloadImages(project);
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d', { alpha: false } as CanvasRenderingContext2DSettings)!;
  const n = slideCount(project);
  const files: { name: string; data: Uint8Array }[] = [];
  const pages: { jpeg: Uint8Array; width: number; height: number }[] = [];
  for (let i = 0; i < n; i++) {
    const sp = slideProject(project, i);
    renderFrame(ctx, sp, stillFrame(sp));
    if (kind === 'zip') files.push({ name: `${String(i + 1).padStart(2, '0')}-${sp.composition}.png`, data: dataUrlBytes(canvas.toDataURL('image/png')) });
    else pages.push({ jpeg: dataUrlBytes(canvas.toDataURL('image/jpeg', 0.92)), width: format.width, height: format.height });
    onProgress?.({ frame: i + 1, total: n });
    await new Promise((r) => setTimeout(r, 0));
  }
  return kind === 'zip' ? makeZip(files) : makePdf(pages);
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function fileName(project: Project, ext: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `dssa-${project.composition}-${project.format}-${stamp}.${ext}`;
}
