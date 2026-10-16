// Rendering di un fotogramma: lo stesso codice serve l'anteprima, l'esportazione MP4
// nel browser e l'esportazione da riga di comando.
import { getFormat, PALETTE, resolveColor } from '../brand/tokens';
import { autoDuration, getComposition } from '../templates';
import { clamp, Easing } from './anim';
import { fontState } from './fonts';
import type { Composition, Env, FrameInfo, Project, Props } from './types';

// --- Immagini ---

const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const done = images.get(src);
  if (done) return Promise.resolve(done);
  let p = pending.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        images.set(src, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    pending.set(src, p);
  }
  return p;
}

function collectImages(v: unknown, out: Set<string>) {
  if (typeof v === 'string') {
    if (v.startsWith('data:image/') && !v.startsWith('data:image/svg')) out.add(v);
    else if (/^(https?:|blob:|\.?\/?assets\/)/.test(v) && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(v)) out.add(v);
  } else if (Array.isArray(v)) v.forEach((x) => collectImages(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectImages(x, out));
}

/** Carica tutte le immagini usate dai parametri: va atteso prima di esportare. */
export async function preloadImages(props: Props) {
  const set = new Set<string>();
  collectImages(props, set);
  await Promise.all([...set].map(loadImage));
}

// --- Durata ---

export function durationInFrames(project: Project, comp: Composition = getComposition(project.composition)) {
  const auto = autoDuration(comp, project.props);
  return Math.max(1, Math.round((auto ?? project.duration) * project.fps));
}

// --- Transizioni di apertura e chiusura ---

function coverShape(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, color: string, lead: string, corner: 'br' | 'tl') {
  const diag = Math.hypot(w, h) * 1.02;
  const [cx, cy] = corner === 'br' ? [w, h] : [0, 0];
  const r1 = diag * Easing.inOut(clamp(p * 1.15));
  const r0 = diag * Easing.inOut(clamp(p * 1.15 - 0.15));
  ctx.save();
  if (r1 > 0) {
    ctx.fillStyle = lead;
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (r0 > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function applyTransitions(ctx: CanvasRenderingContext2D, f: FrameInfo, props: Props, env: Env) {
  const color = resolveColor(props.coloreTransizione ?? 'nero', PALETTE.nero);
  const lead = color === PALETTE.viola ? PALETTE.fucsia : PALETTE.viola;
  if (props.entrata === 'forme') {
    const n = env.sec(0.8);
    if (f.frame < n) coverShape(ctx, f.width, f.height, 1 - f.frame / n, color, lead, 'tl');
  }
  if (props.uscita === 'forme') {
    const n = env.sec(0.8);
    const k = f.frame - (f.durationInFrames - n);
    if (k > 0) coverShape(ctx, f.width, f.height, k / (n - 1), color, lead, 'br');
  }
}

// --- Fotogramma ---

export interface RenderResult {
  warnings: string[];
  error?: string;
}

export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, frame: number): RenderResult {
  const comp = getComposition(project.composition);
  const format = getFormat(project.format);
  const fps = project.fps;
  const total = durationInFrames(project, comp);
  const w = format.width;
  const h = format.height;
  const warnings = new Set<string>();
  const speed = project.speed || 1;
  const env: Env = {
    strict: project.strict,
    warn: (m) => warnings.add(m),
    image: (src) => (src ? images.get(src) ?? (loadImage(src), null) : null),
    sec: (s) => (s * fps) / speed,
    fontsReady: { basier: fontState.basier, wotfard: fontState.wotfard },
  };
  const f: FrameInfo = {
    frame: Math.max(0, Math.min(total - 1, frame)),
    fps,
    durationInFrames: total,
    width: w,
    height: h,
    s: Math.min(w, h) / 1080,
    safe: format.safe,
    format,
    time: frame / fps,
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  let error: string | undefined;
  try {
    comp.render(ctx, f, project.props, env);
    applyTransitions(ctx, f, project.props, env);
  } catch (e) {
    console.error(e);
    error = e instanceof Error ? e.message : String(e);
  }
  ctx.restore();
  if (!fontState.basier) warnings.add('Basier Circle non è caricato: l’anteprima usa Karla. Carica i caratteri prima dell’esportazione definitiva.');
  return { warnings: [...warnings], error };
}
