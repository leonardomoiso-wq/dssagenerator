// Rendering di un fotogramma: lo stesso codice serve l'anteprima, l'esportazione MP4
// nel browser e l'esportazione da riga di comando.
import { getFormat, PALETTE, resolveColor } from '../brand/tokens';
import { autoDuration, getComposition } from '../templates';
import { clamp, Easing } from './anim';
import { beatsAt } from './audio';
import { fontState } from './fonts';
import type { Adjust, Box, Composition, ElementKind, Env, FrameInfo, PlacedElement, Project, Props } from './types';

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
export async function preloadImages(props: Props | Project) {
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
  elements: PlacedElement[];
}

/** Ritocchi del progetto per un formato. */
export function adjustmentsOf(props: Props, format: string): Record<string, Adjust> {
  return props.ritocchi?.[format] ?? {};
}

export function withAdjustment(props: Props, format: string, id: string, a: Adjust | null): Props {
  const all = { ...(props.ritocchi ?? {}) };
  const cur = { ...(all[format] ?? {}) };
  if (a === null) delete cur[id];
  else cur[id] = a;
  all[format] = cur;
  return { ...props, ritocchi: all };
}

function transformBox(b: Box, a: Adjust): Box {
  const cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  const w = b.w * a.s,
    h = b.h * a.s;
  return { x: cx - w / 2 + a.dx, y: cy - h / 2 + a.dy, w, h };
}

/** opts.timeOffset: secondi dall'inizio della serie, per tenere la musica a tempo tra le slide. */
export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, frame: number, opts: { timeOffset?: number } = {}): RenderResult {
  const comp = getComposition(project.composition);
  const format = getFormat(project.format);
  const fps = project.fps;
  const total = durationInFrames(project, comp);
  const w = format.width;
  const h = format.height;
  const warnings = new Set<string>();
  const speed = project.speed || 1;
  const adj = adjustmentsOf(project.props, project.format);
  const elements: PlacedElement[] = [];
  const env: Env = {
    place: (id: string, label: string, box: Box, draw: () => void, kind: ElementKind = 'grafica') => {
      if (kind === 'livello') {
        elements.push({ id, label, kind, box, hidden: false, layer: true });
        draw();
        return;
      }
      const a = adj[id];
      if (!a) {
        elements.push({ id, label, kind, box, hidden: false });
        draw();
        return;
      }
      const tb = transformBox(box, a);
      elements.push({ id, label, kind, box: a.hidden ? box : tb, hidden: !!a.hidden });
      if (a.hidden) return;
      if (project.strict) {
        const sf = format.safe;
        const out = tb.x < sf.left - 1 || tb.y < sf.top - 1 || tb.x + tb.w > w - sf.right + 1 || tb.y + tb.h > h - sf.bottom + 1;
        if ((kind === 'testo' || kind === 'marchio') && out) warnings.add(`«${label}» esce dai margini sicuri del formato (p. 54).`);
        if (kind === 'testo' && Math.abs(a.s - 1) > 0.005) warnings.add(`«${label}» scalato: il corpo esce dalla scala tipografica (p. 28).`);
        if (id === 'testata' && (Math.abs(a.dx) > 1 || Math.abs(a.dy) > 1)) warnings.add('Marchio ed etichetta vanno in alto a sinistra (p. 57).');
      }
      const cx = box.x + box.w / 2,
        cy = box.y + box.h / 2;
      ctx.save();
      ctx.translate(a.dx + cx, a.dy + cy);
      ctx.scale(a.s, a.s);
      ctx.translate(-cx, -cy);
      draw();
      ctx.restore();
    },
    strict: project.strict,
    warn: (m) => warnings.add(m),
    image: (src) => (src ? images.get(src) ?? (loadImage(src), null) : null),
    sec: (s) => (s * fps) / speed,
    beats: project.audio?.sync && project.audio.bpm ? (t) => beatsAt(project.audio, t, opts.timeOffset ?? 0) : undefined,
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
  return { warnings: [...warnings], error, elements };
}
