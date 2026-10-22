// Disegno degli elementi dell'identità: simboli e forme animate, marchio, etichetta,
// freccia, duotono, fondi.
import { clamp, Easing, getEasing, spring } from '../engine/anim';
import { font } from '../engine/fonts';
import { drawIridescent, type IridescentParams, type IridescentStyle } from './iridescent';
import { partCentroid, partPath, partPivot, partsBounds, type Part } from './symbols';
import { DENOMINAZIONE, DUOTONE, LOCKUP, PALETTE, VELATURA_ALPHA } from './tokens';

// --------------------------------------------------------------------------
// Simboli e forme
// --------------------------------------------------------------------------

export type FillMode = 'piatto' | 'iridescente' | 'opaco';

export interface Fill {
  mode: FillMode;
  color: string;
  iri?: IridescentParams;
}

export interface PartState {
  scale: number;
  rot: number;
  dx: number;
  dy: number;
  alpha: number;
}

const IDENTITY: PartState = { scale: 1, rot: 0, dx: 0, dy: 0, alpha: 1 };

export type ShapeAnim = 'assembla' | 'ruota' | 'scorre' | 'cresce' | 'dissolvenza' | 'nessuna';
export const SHAPE_ANIM_OPTIONS: { value: ShapeAnim; label: string }[] = [
  { value: 'assembla', label: 'Le parti si compongono' },
  { value: 'ruota', label: 'Le parti ruotano di 90°' },
  { value: 'scorre', label: 'Le parti arrivano dai lati' },
  { value: 'cresce', label: 'Crescita dal centro' },
  { value: 'dissolvenza', label: 'Dissolvenza' },
  { value: 'nessuna', label: 'Nessuna' },
];

export type ShapeLoop = 'nessuno' | 'respiro' | 'onda' | 'pulsazione';
export const SHAPE_LOOP_OPTIONS: { value: ShapeLoop; label: string }[] = [
  { value: 'nessuno', label: 'Fermo' },
  { value: 'respiro', label: 'Respiro leggero' },
  { value: 'onda', label: 'Onda tra le parti' },
  { value: 'pulsazione', label: 'Pulsazione a tempo' },
];

export interface ShapeMotion {
  anim: ShapeAnim;
  /** Battiti trascorsi al secondo t, se le animazioni seguono la musica. */
  beats?: (t: number) => number;
  /** Frame corrente. */
  frame: number;
  fps: number;
  /** Frame d'inizio. */
  start: number;
  /** Durata in frame di ogni parte. */
  dur: number;
  /** Ritardo tra le parti, in frame. */
  stagger: number;
  easing?: string;
  loop?: ShapeLoop;
  /** Avanzamento d'uscita 0-1. */
  out?: number;
  /** Ordine delle parti: come definite, dall'alto, dal centro, casuale. */
  order?: 'parti' | 'alto' | 'centro';
}

/** Stato di ogni parte nel frame: l'animazione finisce sempre sulla forma esatta. */
export function partStates(parts: Part[], m: ShapeMotion): PartState[] {
  const n = parts.length;
  const ease = getEasing(m.easing);
  const bounds = partsBounds(parts);
  const cxS = bounds.x + bounds.w / 2;
  const cyS = bounds.y + bounds.h / 2;
  // Ordine di ingresso.
  const idx = parts.map((_, i) => i);
  if (m.order === 'alto') idx.sort((a, b) => partCentroid(parts[a])[1] - partCentroid(parts[b])[1]);
  if (m.order === 'centro')
    idx.sort((a, b) => {
      const [ax, ay] = partCentroid(parts[a]);
      const [bx, by] = partCentroid(parts[b]);
      return Math.hypot(ax - cxS, ay - cyS) - Math.hypot(bx - cxS, by - cyS);
    });
  const rank = new Array(n);
  idx.forEach((pi, r) => (rank[pi] = r));

  return parts.map((p, i) => {
    const s0 = m.start + rank[i] * m.stagger;
    const t = clamp((m.frame - s0) / Math.max(1, m.dur));
    const e = ease(t);
    const st: PartState = { ...IDENTITY };
    switch (m.anim) {
      case 'assembla': {
        const sp = spring(m.frame, m.fps, { delay: s0, stiffness: 140, damping: 15 });
        st.scale = m.easing === 'back' ? sp : e;
        st.alpha = clamp(t * 4);
        break;
      }
      case 'ruota': {
        st.rot = (1 - e) * (i % 2 ? -1 : 1) * (Math.PI / 2);
        st.scale = 0.2 + 0.8 * e;
        st.alpha = clamp(t * 3);
        break;
      }
      case 'scorre': {
        const [px, py] = partCentroid(p);
        let vx = px - cxS,
          vy = py - cyS;
        const len = Math.hypot(vx, vy) || 1;
        if (len < 1e-3) (vx = 0), (vy = 1);
        st.dx = (vx / len) * (1 - e) * 140;
        st.dy = (vy / len) * (1 - e) * 140;
        st.alpha = clamp(t * 2.5);
        break;
      }
      case 'cresce': {
        const sp = spring(m.frame, m.fps, { delay: m.start, stiffness: 110, damping: 16 });
        st.scale = sp;
        st.alpha = clamp((m.frame - m.start) / 4);
        break;
      }
      case 'dissolvenza':
        st.alpha = ease(clamp((m.frame - m.start) / Math.max(1, m.dur * 1.5)));
        break;
    }
    // Movimento continuo dopo l'ingresso.
    const tt = m.frame / m.fps;
    if (m.loop === 'onda' && t >= 1) {
      const b = m.beats?.(tt);
      const ph = (b !== undefined ? b * Math.PI : tt * 2.2) - rank[i] * 0.55;
      st.scale *= 1 - 0.045 * (0.5 - 0.5 * Math.cos(ph));
    }
    if (m.loop === 'pulsazione' && t >= 1) {
      const x = (m.beats?.(tt) ?? tt) - rank[i] * 0.08;
      const beat = ((x % 1) + 1) % 1;
      st.scale *= 1 - 0.06 * Math.exp(-beat * 6) * Math.sin(beat * Math.PI);
    }
    if (m.out && m.out > 0) {
      const o = Easing.in(clamp(m.out * 1.3 - (rank[i] / Math.max(1, n)) * 0.3));
      st.scale *= 1 - o;
      st.alpha *= 1 - o * 0.5;
    }
    return st;
  });
}

/** Scala globale per il «respiro». */
export function breath(m: ShapeMotion) {
  if (m.loop !== 'respiro') return 1;
  return 1 + 0.018 * Math.sin((m.frame / m.fps) * Math.PI * 0.8);
}

const scratch = { canvas: null as HTMLCanvasElement | null };
function scratchCanvas(w: number, h: number) {
  if (!scratch.canvas) scratch.canvas = document.createElement('canvas');
  const c = scratch.canvas;
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, Math.ceil(w));
    c.height = Math.max(c.height, Math.ceil(h));
  }
  return c;
}

/**
 * Disegna un insieme di parti (un simbolo o una forma) nel riquadro x, y, size × size.
 * Le unità delle parti vanno da 0 a 100.
 */
export function drawParts(
  ctx: CanvasRenderingContext2D,
  parts: Part[],
  x: number,
  y: number,
  size: number,
  fill: Fill,
  states?: PartState[],
  opts: { rotate?: number; globalScale?: number } = {},
) {
  const k = size / 100;
  const g = opts.globalScale ?? 1;
  const base = new DOMMatrix()
    .translate(x + size / 2, y + size / 2)
    .rotate(((opts.rotate ?? 0) * 180) / Math.PI)
    .scale(g * k)
    .translate(-50, -50);
  const mats = parts.map((p, i) => {
    const s = states?.[i] ?? IDENTITY;
    const [px, py] = partPivot(p);
    return base
      .translate(s.dx, s.dy)
      .translate(px, py)
      .rotate((s.rot * 180) / Math.PI)
      .scale(Math.max(0.0001, s.scale))
      .translate(-px, -py);
  });

  // Parti ferme e piene: un solo percorso, così tra parti adiacenti non restano giunture.
  const settled = parts.every((_, i) => (states?.[i] ?? IDENTITY).alpha >= 0.999);
  const union = new Path2D();
  const paths = parts.map((p, i) => {
    const s = states?.[i] ?? IDENTITY;
    const path = new Path2D();
    if (s.alpha <= 0.001 || s.scale <= 0.0001) return null;
    path.addPath(partPath(p), mats[i]);
    union.addPath(path);
    return path;
  });

  if (fill.mode === 'iridescente') {
    // Materia renderizzata una volta sul riquadro, poi ritagliata dalle parti.
    const pad = size * 0.25;
    const W = Math.ceil(size + pad * 2);
    const sc = scratchCanvas(W, W);
    const sctx = sc.getContext('2d')!;
    sctx.clearRect(0, 0, W, W);
    drawIridescent(sctx, 0, 0, W, W, fill.iri ?? { style: 'raggiera', time: 0, seed: 1 });
    const paint = (clip: Path2D, alpha: number, shadeParts: number[]) => {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.clip(clip);
      ctx.drawImage(sc, 0, 0, W, W, x - pad, y - pad, W, W);
      // L'ombreggiatura di ogni parte resta dentro la parte.
      for (const i of shadeParts) {
        const pth = paths[i];
        if (!pth) continue;
        ctx.save();
        ctx.clip(pth);
        shade(ctx, parts[i], mats[i], 0.22);
        ctx.restore();
      }
      ctx.restore();
    };
    if (settled) paint(union, 1, parts.map((_, i) => i));
    else paths.forEach((path, i) => path && paint(path, (states?.[i] ?? IDENTITY).alpha, [i]));
    return;
  }

  if (settled) {
    ctx.save();
    ctx.fillStyle = fill.color;
    ctx.fill(union);
    if (fill.mode === 'opaco')
      paths.forEach((path, i) => {
        if (!path) return;
        ctx.save();
        ctx.clip(path);
        shade(ctx, parts[i], mats[i], 1);
        ctx.restore();
      });
    ctx.restore();
    return;
  }

  paths.forEach((path, i) => {
    if (!path) return;
    ctx.save();
    ctx.globalAlpha *= (states?.[i] ?? IDENTITY).alpha;
    ctx.fillStyle = fill.color;
    ctx.fill(path);
    if (fill.mode === 'opaco') {
      ctx.clip(path);
      shade(ctx, parts[i], mats[i], 1);
    }
    ctx.restore();
  });
}

/** Ombreggiatura morbida della versione «opaca» (volume, luce in alto a sinistra). */
function shade(ctx: CanvasRenderingContext2D, p: Part, m: DOMMatrix, amount: number) {
  const [cx, cy] = partCentroid(p);
  const R = p.k === 'bowl' ? p.rx : p.k === 'ring' ? p.R : p.r;
  const c = m.transformPoint(new DOMPoint(cx, cy));
  const e = m.transformPoint(new DOMPoint(cx + R, cy));
  const rad = Math.max(1, Math.hypot(e.x - c.x, e.y - c.y));
  const hl = ctx.createRadialGradient(c.x - rad * 0.35, c.y - rad * 0.45, 0, c.x - rad * 0.2, c.y - rad * 0.3, rad * 1.3);
  hl.addColorStop(0, `rgba(255,255,255,${0.42 * amount})`);
  hl.addColorStop(0.45, `rgba(255,255,255,${0.08 * amount})`);
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(c.x - rad * 3, c.y - rad * 3, rad * 6, rad * 6);
  const sh = ctx.createRadialGradient(c.x + rad * 0.5, c.y + rad * 0.6, rad * 0.2, c.x, c.y, rad * 1.5);
  sh.addColorStop(0, `rgba(0,0,0,${0.0})`);
  sh.addColorStop(0.6, `rgba(0,0,0,${0.06 * amount})`);
  sh.addColorStop(1, `rgba(0,0,0,${0.16 * amount})`);
  ctx.fillStyle = sh;
  ctx.fillRect(c.x - rad * 3, c.y - rad * 3, rad * 6, rad * 6);
}

/** Percorso dell'intero insieme di parti: serve per le finestre (foto dentro il simbolo). */
export function partsClipPath(parts: Part[], x: number, y: number, size: number, states?: PartState[]) {
  const k = size / 100;
  const base = new DOMMatrix().translate(x, y).scale(k);
  const out = new Path2D();
  parts.forEach((p, i) => {
    const s = states?.[i] ?? IDENTITY;
    if (s.scale <= 0.0001) return;
    const [px, py] = partPivot(p);
    const m = base
      .translate(s.dx, s.dy)
      .translate(px, py)
      .rotate((s.rot * 180) / Math.PI)
      .scale(s.scale)
      .translate(-px, -py);
    out.addPath(partPath(p), m);
  });
  return out;
}

// --------------------------------------------------------------------------
// Marchio (p. 12-16)
// --------------------------------------------------------------------------

const capRatioCache = new Map<string, number>();
function capRatio(ctx: CanvasRenderingContext2D, weight: number) {
  ctx.font = font('titolo', weight, 100);
  const key = ctx.font;
  let r = capRatioCache.get(key);
  if (!r) {
    r = (ctx.measureText('DSSA').actualBoundingBoxAscent || 70) / 100;
    capRatioCache.set(key, r);
  }
  return r;
}
export function clearMarkCaches() {
  capRatioCache.clear();
}

/** Logotipo «DSSA» su una riga, in Basier Circle Medium. y è il bordo superiore della maiuscola. */
export function drawLogotype(ctx: CanvasRenderingContext2D, x: number, y: number, cap: number, color: string) {
  ctx.save();
  const size = cap / capRatio(ctx, 500);
  ctx.font = font('titolo', 500, size);
  (ctx as any).letterSpacing = '0px';
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('DSSA', x, y + cap);
  const w = ctx.measureText('DSSA').width;
  ctx.restore();
  return w;
}

/**
 * Rivelazione di una riga del marchio: la riga sale dentro la sua fascia.
 * r = 0 nascosta, 1 al suo posto.
 */
function maskedLine(ctx: CanvasRenderingContext2D, text: string, x: number, capTop: number, cap: number, r: number) {
  if (r <= 0) return;
  if (r >= 1) {
    ctx.fillText(text, x, capTop + cap);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - cap, capTop - cap * 0.12, cap * 40, cap * 1.36);
  ctx.clip();
  ctx.fillText(text, x, capTop + cap + (1 - r) * cap * 1.4);
  ctx.restore();
}

/** Misure del monogramma per una data altezza della maiuscola. */
export function monogramSize(ctx: CanvasRenderingContext2D, cap: number) {
  ctx.save();
  ctx.font = font('titolo', 500, cap / capRatio(ctx, 500));
  (ctx as any).letterSpacing = '0px';
  const w = Math.max(ctx.measureText('DS').width, ctx.measureText('SA').width);
  ctx.restore();
  return { w, h: cap * (2 + LOCKUP.lineGap) };
}

/** Misure del lockup orizzontale. */
export function lockupSize(ctx: CanvasRenderingContext2D, cap: number) {
  const mono = monogramSize(ctx, cap);
  const nameCap = cap * LOCKUP.nameCap;
  ctx.save();
  ctx.font = font('titolo', 400, nameCap / capRatio(ctx, 400));
  const nameW = Math.max(...DENOMINAZIONE.map((l) => ctx.measureText(l).width));
  ctx.restore();
  return { w: mono.w + cap * LOCKUP.nameGap + nameW, h: mono.h };
}

/** Monogramma su due righe: DS / SA, interlinea 0,26 x. reveal: avanzamento di ciascuna riga. */
export function drawMonogram(ctx: CanvasRenderingContext2D, x: number, y: number, cap: number, color: string, reveal: [number, number] = [1, 1]) {
  ctx.save();
  ctx.font = font('titolo', 500, cap / capRatio(ctx, 500));
  (ctx as any).letterSpacing = '0px';
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  maskedLine(ctx, 'DS', x, y, cap, reveal[0]);
  maskedLine(ctx, 'SA', x, y + cap * (1 + LOCKUP.lineGap), cap, reveal[1]);
  ctx.restore();
  return monogramSize(ctx, cap);
}

/** Logotipo con rivelazione dalla maschera. */
export function drawLogotypeReveal(ctx: CanvasRenderingContext2D, x: number, y: number, cap: number, color: string, r: number) {
  ctx.save();
  ctx.font = font('titolo', 500, cap / capRatio(ctx, 500));
  (ctx as any).letterSpacing = '0px';
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  maskedLine(ctx, 'DSSA', x, y, cap, r);
  ctx.restore();
}

/**
 * Lockup orizzontale: monogramma e denominazione su tre righe (p. 13).
 * reveal: [riga DS, riga SA, denominazione 0-1].
 */
export function drawLockup(ctx: CanvasRenderingContext2D, x: number, y: number, cap: number, color: string, reveal: number | [number, number, number] = 1) {
  const rv: [number, number, number] = typeof reveal === 'number' ? [1, 1, reveal] : reveal;
  const mono = drawMonogram(ctx, x, y, cap, color, [rv[0], rv[1]]);
  const nameCap = cap * LOCKUP.nameCap;
  const nx = x + mono.w + cap * LOCKUP.nameGap;
  ctx.save();
  ctx.font = font('titolo', 400, nameCap / capRatio(ctx, 400));
  (ctx as any).letterSpacing = '0px';
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  // Tre righe nell'altezza del monogramma: prima maiuscola in alto, ultima base in basso.
  const pitch = (mono.h - nameCap) / 2;
  let maxW = 0;
  DENOMINAZIONE.forEach((line, i) => {
    const p = clamp(rv[2] * 3 - i);
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.fillText(line, nx + (1 - Easing.out(p)) * cap * 0.4, y + nameCap + i * pitch);
    ctx.restore();
    maxW = Math.max(maxW, ctx.measureText(line).width);
  });
  ctx.restore();
  return { w: nx - x + maxW, h: mono.h };
}

/** Larghezza del logotipo per una data altezza della maiuscola. */
export function logotypeWidth(ctx: CanvasRenderingContext2D, cap: number) {
  ctx.save();
  ctx.font = font('titolo', 500, cap / capRatio(ctx, 500));
  const w = ctx.measureText('DSSA').width;
  ctx.restore();
  return w;
}

// --------------------------------------------------------------------------
// Etichetta di serie, freccia, pulsante (p. 41)
// --------------------------------------------------------------------------

/** Larghezza dell'etichetta di serie. */
export function labelWidth(ctx: CanvasRenderingContext2D, text: string, s: number) {
  ctx.save();
  ctx.font = font('titolo', 600, 30 * s);
  (ctx as any).letterSpacing = '0px';
  const w = ctx.measureText(text).width + 48 * s;
  ctx.restore();
  return w;
}

/** Etichetta di serie: SemiBold 30 px, contorno 1 px, estremità arrotondate. cy = centro verticale. */
export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, cy: number, s: number, color: string, alpha = 1) {
  if (!text) return 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font('titolo', 600, 30 * s);
  (ctx as any).letterSpacing = '0px';
  const tw = ctx.measureText(text).width;
  const padX = 24 * s;
  const h = (30 + 12 + 13) * s;
  const w = tw + padX * 2;
  const top = cy - h / 2;
  const lw = 1 * s;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.roundRect(x + lw / 2, top + lw / 2, w - lw, h - lw, h / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  // Centrata sull'altezza della maiuscola, misurata sulla linea di base.
  ctx.textBaseline = 'alphabetic';
  const cap = ctx.measureText('H').actualBoundingBoxAscent || 21 * s;
  ctx.fillText(text, x + padX, cy + cap / 2);
  ctx.restore();
  return w;
}

/** Freccia: 56 × 39 px, tratto 4,17 px, estremità arrotondate. */
export function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, p = 1) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.17 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = 56 * s,
    h = 39 * s;
  const lw = ctx.lineWidth / 2;
  const midY = y + h / 2;
  const e = Easing.out(clamp(p));
  const shaft = (w - lw * 2) * e;
  ctx.beginPath();
  ctx.moveTo(x + lw, midY);
  ctx.lineTo(x + lw + shaft, midY);
  const tip = x + lw + shaft;
  const head = (h / 2 - lw) * clamp(p * 1.5 - 0.5);
  ctx.moveTo(tip - head, midY - head);
  ctx.lineTo(tip, midY);
  ctx.lineTo(tip - head, midY + head);
  ctx.stroke();
  ctx.restore();
}

/** Pulsante «avanti» dei caroselli LinkedIn: quadrato bianco con freccia. */
export function drawNextButton(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const size = 64 * s;
  ctx.save();
  ctx.fillStyle = PALETTE.bianco;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = PALETTE.nero;
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.42, y + size * 0.3);
  ctx.lineTo(x + size * 0.6, y + size * 0.5);
  ctx.lineTo(x + size * 0.42, y + size * 0.7);
  ctx.stroke();
  ctx.restore();
}

/** Monogramma in riquadro: quadrato bianco con la sigla (caroselli LinkedIn, p. 14). */
export function drawMonogramBox(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = PALETTE.bianco;
  ctx.fillRect(x, y, size, size);
  const cap = size * 0.2;
  const mono = monogramSize(ctx, cap);
  drawMonogram(ctx, x + (size - mono.w) / 2, y + (size - mono.h) / 2, cap, PALETTE.nero);
  ctx.restore();
}

// --------------------------------------------------------------------------
// Immagini e duotono (p. 33)
// --------------------------------------------------------------------------

export interface ImageFrame {
  zoom?: number;
  fx?: number;
  fy?: number;
}

/** Disegna l'immagine a copertura del rettangolo, con zoom e punto focale. */
export function drawImageCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, fr: ImageFrame = {}) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  if (!iw || !ih) return;
  const zoom = Math.max(1, fr.zoom ?? 1);
  const sc = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * sc,
    dh = ih * sc;
  const fx = fr.fx ?? 0.5,
    fy = fr.fy ?? 0.5;
  const dx = x + (w - dw) * fx;
  const dy = y + (h - dh) * fy;
  ctx.drawImage(img, dx, dy, dw, dh);
}

const duoCanvas = { c: null as HTMLCanvasElement | null };

/**
 * Duotono a quattro livelli: fotografia in scala di grigi, colore chiaro in Moltiplica,
 * colore scuro in Scolora (Screen), velatura del colore scuro al 28%.
 */
export function drawDuotone(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: keyof typeof DUOTONE,
  fr: ImageFrame & { velatura?: number; contrasto?: number } = {},
) {
  if (!duoCanvas.c) duoCanvas.c = document.createElement('canvas');
  const c = duoCanvas.c;
  const W = Math.ceil(w),
    H = Math.ceil(h);
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  const d = c.getContext('2d')!;
  d.save();
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, W, H);
  d.filter = `grayscale(1) contrast(${fr.contrasto ?? 1.05})`;
  drawImageCover(d, img, 0, 0, W, H, fr);
  d.filter = 'none';
  const col = DUOTONE[tint];
  d.globalCompositeOperation = 'multiply';
  d.fillStyle = col.chiaro;
  d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'screen';
  d.fillStyle = col.scuro;
  d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'source-over';
  d.globalAlpha = fr.velatura ?? VELATURA_ALPHA;
  d.fillStyle = col.scuro;
  d.fillRect(0, 0, W, H);
  d.restore();
  ctx.drawImage(c, x, y, w, h);
}

// --------------------------------------------------------------------------
// Fondi
// --------------------------------------------------------------------------

export type BackgroundKind = 'colore' | 'iridescente' | 'duotono' | 'foto';

export function drawSolid(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function iriParams(style: string, time: number, seed: number, speed = 1, rays = 0.8): IridescentParams {
  return { style: (style as IridescentStyle) || 'raggiera', time, seed, speed, rays };
}

/** Fondo iridescente a tutta tavola: «campi iridescenti a tutta pagina, sempre al vivo» (p. 23). */
export function drawIridescentBg(ctx: CanvasRenderingContext2D, f: { width: number; height: number }, params: IridescentParams) {
  drawIridescent(ctx, 0, 0, f.width, f.height, params);
}
