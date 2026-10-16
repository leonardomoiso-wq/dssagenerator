// Composizione e animazione del testo sul canvas.
// I blocchi si posizionano dall'altezza della maiuscola della prima riga e finiscono
// sulla linea di base dell'ultima: è il modo in cui si allineano nei modelli.
import { font } from './fonts';
import { clamp, Easing, getEasing } from './anim';

export interface TextStyle {
  family: 'titolo' | 'testo';
  size: number;
  weight: number;
  lineHeight: number;
  tracking: number;
}

interface Run {
  text: string;
  bold: boolean;
  width: number;
}
export interface Line {
  runs: Run[];
  width: number;
}
export interface TextLayout {
  lines: Line[];
  style: TextStyle;
  lineHeightPx: number;
  capHeight: number;
  /** Dalla maiuscola della prima riga alla linea di base dell'ultima. */
  height: number;
  width: number;
}

function setFont(ctx: CanvasRenderingContext2D, st: TextStyle, bold: boolean) {
  const w = bold ? Math.max(600, st.weight) : st.weight;
  ctx.font = font(st.family, w, st.size);
  (ctx as any).letterSpacing = `${st.tracking * st.size}px`;
}

const capCache = new Map<string, number>();
function capHeightOf(ctx: CanvasRenderingContext2D, st: TextStyle) {
  const key = `${ctx.font}`;
  let v = capCache.get(key);
  if (v === undefined) {
    v = ctx.measureText('HDSA').actualBoundingBoxAscent || st.size * 0.7;
    if (capCache.size > 500) capCache.clear();
    capCache.set(key, v);
  }
  return v;
}

export function clearTextCaches() {
  capCache.clear();
}

/** Spezza il testo in righe. «**parola**» va in neretto. «\n» va a capo. */
export function layoutText(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, maxWidth: number): TextLayout {
  ctx.save();
  const lines: Line[] = [];
  const paragraphs = (text ?? '').split('\n');
  setFont(ctx, st, false);
  const space = ctx.measureText(' ').width;
  const capHeight = capHeightOf(ctx, st);
  for (const para of paragraphs) {
    // Parole con il loro stato di neretto.
    const words: { text: string; bold: boolean }[] = [];
    let bold = false;
    for (const chunk of para.split(/(\*\*)/)) {
      if (chunk === '**') {
        bold = !bold;
        continue;
      }
      for (const w of chunk.split(/(\s+)/)) {
        if (!w) continue;
        if (/^\s+$/.test(w)) words.push({ text: ' ', bold });
        else words.push({ text: w, bold });
      }
    }
    let line: Line = { runs: [], width: 0 };
    const push = () => {
      // Toglie gli spazi finali.
      while (line.runs.length && line.runs[line.runs.length - 1].text === ' ') {
        line.width -= line.runs.pop()!.width;
      }
      lines.push(line);
      line = { runs: [], width: 0 };
    };
    for (const w of words) {
      if (w.text === ' ') {
        if (line.runs.length) line.runs.push({ text: ' ', bold: w.bold, width: space }), (line.width += space);
        continue;
      }
      setFont(ctx, st, w.bold);
      const wd = ctx.measureText(w.text).width;
      if (line.width + wd > maxWidth && line.runs.length) push();
      line.runs.push({ text: w.text, bold: w.bold, width: wd });
      line.width += wd;
    }
    push();
  }
  ctx.restore();
  const lineHeightPx = st.size * st.lineHeight;
  return {
    lines,
    style: st,
    lineHeightPx,
    capHeight,
    height: capHeight + Math.max(0, lines.length - 1) * lineHeightPx,
    width: Math.max(0, ...lines.map((l) => l.width)),
  };
}

export type TextAnim = 'nessuna' | 'dissolvenza' | 'sali' | 'maschera' | 'parole' | 'macchina';

export const TEXT_ANIM_OPTIONS: { value: TextAnim; label: string }[] = [
  { value: 'maschera', label: 'Righe dalla maschera' },
  { value: 'sali', label: 'Righe che salgono' },
  { value: 'parole', label: 'Parola per parola' },
  { value: 'macchina', label: 'Lettera per lettera' },
  { value: 'dissolvenza', label: 'Dissolvenza' },
  { value: 'nessuna', label: 'Nessuna' },
];

export interface DrawTextOpts {
  color: string;
  align?: 'left' | 'center' | 'right';
  anim?: TextAnim;
  /** Frame corrente. */
  frame?: number;
  /** Frame d'inizio dell'animazione. */
  start?: number;
  /** Durata in frame per riga (o parola). */
  dur?: number;
  /** Ritardo tra righe in frame. */
  stagger?: number;
  easing?: string;
  /** Avanzamento d'uscita 0-1 (1 = scomparso). */
  out?: number;
}

/** Disegna un blocco di testo con il bordo superiore della maiuscola in y. */
export function drawText(ctx: CanvasRenderingContext2D, lay: TextLayout, x: number, y: number, o: DrawTextOpts) {
  const st = lay.style;
  const anim = o.anim ?? 'nessuna';
  const frame = o.frame ?? Infinity;
  const start = o.start ?? 0;
  const dur = Math.max(1, o.dur ?? 18);
  const stagger = o.stagger ?? 4;
  const ease = getEasing(o.easing);
  const out = clamp(o.out ?? 0);
  ctx.save();
  ctx.fillStyle = o.color;
  ctx.textBaseline = 'alphabetic';
  let wordIndex = 0;
  let charIndex = 0;
  const totalChars = lay.lines.reduce((n, l) => n + l.runs.reduce((m, r) => m + r.text.length, 0), 0);
  lay.lines.forEach((line, li) => {
    const base = y + lay.capHeight + li * lay.lineHeightPx;
    let lx = x;
    if (o.align === 'center') lx = x - line.width / 2;
    else if (o.align === 'right') lx = x - line.width;
    const lineP = ease(clamp((frame - start - li * stagger) / dur));
    ctx.save();
    let alpha = 1;
    let dy = 0;
    if (anim === 'dissolvenza') alpha = ease(clamp((frame - start) / (dur * 1.5)));
    if (anim === 'sali') {
      alpha = lineP;
      dy = (1 - lineP) * st.size * 0.45;
    }
    if (anim === 'maschera') {
      // La riga sale dentro la sua fascia: si vede solo ciò che è entrato.
      const top = base - lay.capHeight - st.size * 0.3;
      ctx.beginPath();
      ctx.rect(lx - st.size, top, line.width + st.size * 2, lay.lineHeightPx + st.size * 0.35);
      ctx.clip();
      dy = (1 - lineP) * lay.lineHeightPx * 1.6;
      if (lineP <= 0) {
        ctx.restore();
        return;
      }
    }
    if (out > 0) {
      alpha *= 1 - Easing.inOut(out);
      dy -= Easing.in(out) * st.size * 0.3;
    }
    ctx.globalAlpha *= alpha;
    for (const run of line.runs) {
      setFont(ctx, st, run.bold);
      if (anim === 'parole' && run.text !== ' ') {
        const p = ease(clamp((frame - start - wordIndex * Math.max(1, stagger * 0.6)) / dur));
        ctx.save();
        ctx.globalAlpha *= p;
        ctx.fillText(run.text, lx, base + dy + (1 - p) * st.size * 0.3);
        ctx.restore();
        wordIndex++;
      } else if (anim === 'macchina') {
        const visible = Math.floor(clamp((frame - start) / Math.max(1, dur * 3)) * totalChars + 1e-6);
        const rest = visible - charIndex;
        if (rest > 0) ctx.fillText(run.text.slice(0, rest), lx, base + dy);
        charIndex += run.text.length;
      } else {
        ctx.fillText(run.text, lx, base + dy);
      }
      lx += run.width;
    }
    ctx.restore();
  });
  ctx.restore();
}

/** Ultima frame in cui l'animazione del testo è ancora in corso. */
export function textAnimEnd(lay: TextLayout, o: Pick<DrawTextOpts, 'anim' | 'start' | 'dur' | 'stagger'>) {
  const dur = o.dur ?? 18;
  const st = o.stagger ?? 4;
  const start = o.start ?? 0;
  const words = lay.lines.reduce((n, l) => n + l.runs.filter((r) => r.text !== ' ').length, 0);
  switch (o.anim) {
    case 'parole':
      return start + words * Math.max(1, st * 0.6) + dur;
    case 'macchina':
      return start + dur * 3;
    case 'nessuna':
      return start;
    default:
      return start + (lay.lines.length - 1) * st + dur;
  }
}

/** Il corpo scende fino al minimo finché il testo entra nelle righe indicate. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  st: TextStyle,
  maxWidth: number,
  maxHeight: number,
  minSize: number,
): TextLayout {
  let size = st.size;
  let lay = layoutText(ctx, text, st, maxWidth);
  while ((lay.height > maxHeight || lay.width > maxWidth * 1.001) && size > minSize) {
    size = Math.max(minSize, size - 2);
    lay = layoutText(ctx, text, { ...st, size }, maxWidth);
  }
  return lay;
}
