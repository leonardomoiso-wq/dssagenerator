// Ritocchi diretti sull'anteprima: selezione, trascinamento, scala, guide magnetiche.
import type { Safe } from '../brand/tokens';
import { adjustmentsOf, withAdjustment } from '../engine/render';
import type { Adjust, Box, Layer, PlacedElement, Project, Props } from '../engine/types';

export const NO_ADJUST: Adjust = { dx: 0, dy: 0, s: 1 };

export function hitTest(elements: PlacedElement[], x: number, y: number): PlacedElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const e = elements[i];
    if (e.hidden) continue;
    const b = e.box;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return e;
  }
  return null;
}

/** Elementi senza doppioni (lo stesso id può essere disegnato più volte). */
export function uniqueElements(elements: PlacedElement[]) {
  const seen = new Map<string, PlacedElement>();
  for (const e of elements) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()];
}

export interface SnapLine {
  x?: number;
  y?: number;
}

/** Aggancia bordi e centro del riquadro ai margini sicuri e al centro della tavola. */
export function snapBox(box: Box, W: number, H: number, safe: Safe, thr: number): { dx: number; dy: number; lines: SnapLine[] } {
  const xs = [safe.left, W / 2, W - safe.right, 0, W];
  const ys = [safe.top, H / 2, H - safe.bottom, 0, H];
  const bx = [box.x, box.x + box.w / 2, box.x + box.w];
  const by = [box.y, box.y + box.h / 2, box.y + box.h];
  let best = { d: thr + 1, v: 0, line: 0 };
  for (const t of xs)
    for (const b of bx) {
      const d = Math.abs(t - b);
      if (d < best.d) best = { d, v: t - b, line: t };
    }
  let bestY = { d: thr + 1, v: 0, line: 0 };
  for (const t of ys)
    for (const b of by) {
      const d = Math.abs(t - b);
      if (d < bestY.d) bestY = { d, v: t - b, line: t };
    }
  const lines: SnapLine[] = [];
  const dx = best.d <= thr ? best.v : 0;
  const dy = bestY.d <= thr ? bestY.v : 0;
  if (best.d <= thr) lines.push({ x: best.line });
  if (bestY.d <= thr) lines.push({ y: bestY.line });
  return { dx, dy, lines };
}

export function getAdjust(project: Project, id: string): Adjust {
  return { ...NO_ADJUST, ...adjustmentsOf(project.props, project.format)[id] };
}

export function setAdjust(project: Project, id: string, a: Adjust | null): Project {
  const clean = a && Math.abs(a.dx) < 0.01 && Math.abs(a.dy) < 0.01 && Math.abs(a.s - 1) < 0.001 && !a.hidden ? null : a;
  return { ...project, props: withAdjustment(project.props, project.format, id, clean) };
}

export function resetAll(project: Project): Project {
  const all = { ...(project.props.ritocchi ?? {}) };
  delete all[project.format];
  return { ...project, props: { ...project.props, ritocchi: all } };
}

export function hasAdjustments(props: Props, format: string) {
  return Object.keys(adjustmentsOf(props, format)).length > 0;
}

// --- Livelli della composizione libera ---

const LAYER_KEYS = ['livelli', 'extra'];

export function findLayer(project: Project, id: string): Layer | undefined {
  for (const k of LAYER_KEYS) {
    const l = (project.props[k] as Layer[] | undefined)?.find((x) => x.id === id);
    if (l) return l;
  }
  return undefined;
}

export function updateLayer(project: Project, id: string, patch: (l: Layer) => Layer): Project {
  const props = { ...project.props };
  for (const k of LAYER_KEYS) {
    const list = props[k] as Layer[] | undefined;
    if (list?.some((l) => l.id === id)) props[k] = list.map((l) => (l.id === id ? patch(l) : l));
  }
  return { ...project, props };
}

const round = (v: number, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

export function moveLayer(l: Layer, ddx: number, ddy: number, W: number, H: number, orig: Layer): Layer {
  return { ...l, props: { ...l.props, x: round(orig.props.x + (ddx / W) * 100), y: round(orig.props.y + (ddy / H) * 100) } };
}

/** Scala un livello cambiando il campo che ne decide la dimensione. Null se non si scala. */
export function scaleLayer(orig: Layer, k: number): Layer | null {
  const p = orig.props;
  switch (orig.type) {
    case 'simbolo':
    case 'forma':
      return { ...orig, props: { ...p, dimensione: round(Math.max(2, p.dimensione * k), 1) } };
    case 'marchio':
      return { ...orig, props: { ...p, altezza: Math.round(Math.max(14, p.altezza * k)) } };
    case 'immagine':
    case 'iridescente':
      return { ...orig, props: { ...p, w: round(Math.max(1, p.w * k), 1), h: round(Math.max(1, p.h * k), 1) } };
    default:
      return null;
  }
}
