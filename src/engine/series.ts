// Serie: più slide in un solo progetto (caroselli Instagram e LinkedIn, video a capitoli).
// La slide attiva vive nei campi principali del progetto (composition, props, duration):
// così editor, ritocchi, cronologia ed esportazione della singola slide restano invariati.
import { getComposition } from '../templates';
import { durationInFrames, renderFrame, type RenderResult } from './render';
import type { Project, Props } from './types';

export interface Slide {
  id: string;
  composition: string;
  props: Props;
  duration: number;
}

export interface Series {
  slides: Slide[];
  active: number;
  /** Aggiunge «· 2/5» all'etichetta di serie. */
  numera: boolean;
  /** Freccia in basso a sinistra su tutte le slide tranne l'ultima (p. 41). */
  frecciaAuto: boolean;
  /** Passaggio tra le slide nel video della serie. */
  transizione: 'taglio' | 'dissolvenza';
  /** Secondi di sovrapposizione nella dissolvenza. */
  durataTransizione: number;
  /** Anteprima della slide attiva o della serie intera. */
  anteprima: 'slide' | 'serie';
}

let uid = 0;
const newId = () => `slide-${Date.now().toString(36)}-${uid++}`;

export function slideCount(p: Project) {
  return p.serie?.slides.length ?? 1;
}

/** Copia la slide attiva (campi principali) dentro l'elenco delle slide. */
export function syncActive(p: Project): Project {
  if (!p.serie) return p;
  const slides = p.serie.slides.map((s, i) => (i === p.serie!.active ? { ...s, composition: p.composition, props: p.props, duration: p.duration } : s));
  return { ...p, serie: { ...p.serie, slides } };
}

export function switchTo(p: Project, i: number): Project {
  if (!p.serie || i === p.serie.active || i < 0 || i >= p.serie.slides.length) return p;
  const synced = syncActive(p);
  const s = synced.serie!.slides[i];
  return { ...synced, composition: s.composition, props: s.props, duration: s.duration, serie: { ...synced.serie!, active: i } };
}

/** Trasforma il progetto in una serie (se non lo è) e aggiunge una slide dopo quella attiva. */
export function addSlide(p: Project, opts: { composition?: string; props?: Props; duration?: number } = {}): Project {
  const base: Project = p.serie
    ? syncActive(p)
    : {
        ...p,
        serie: {
          slides: [{ id: newId(), composition: p.composition, props: p.props, duration: p.duration }],
          active: 0,
          numera: true,
          frecciaAuto: true,
          transizione: 'dissolvenza',
          durataTransizione: 0.4,
          anteprima: 'slide',
        },
      };
  const serie = base.serie!;
  const cur = serie.slides[serie.active];
  const slide: Slide = {
    id: newId(),
    composition: opts.composition ?? cur.composition,
    props: structuredClone(opts.props ?? cur.props),
    duration: opts.duration ?? cur.duration,
  };
  const slides = [...serie.slides];
  slides.splice(serie.active + 1, 0, slide);
  const withSlide: Project = { ...base, serie: { ...serie, slides } };
  return switchTo({ ...withSlide, serie: { ...withSlide.serie!, active: serie.active } }, serie.active + 1);
}

export function removeSlide(p: Project, i: number): Project {
  if (!p.serie) return p;
  const synced = syncActive(p);
  const slides = synced.serie!.slides.filter((_, k) => k !== i);
  if (slides.length <= 1) {
    // Torna un progetto singolo con la slide rimasta.
    const s = slides[0];
    const { serie: _drop, ...rest } = synced;
    void _drop;
    return { ...rest, composition: s.composition, props: s.props, duration: s.duration };
  }
  const active = Math.min(i <= synced.serie!.active ? Math.max(0, synced.serie!.active - 1) : synced.serie!.active, slides.length - 1);
  const s = slides[active];
  return { ...synced, composition: s.composition, props: s.props, duration: s.duration, serie: { ...synced.serie!, slides, active } };
}

export function moveSlide(p: Project, i: number, d: number): Project {
  if (!p.serie) return p;
  const j = i + d;
  const synced = syncActive(p);
  const slides = [...synced.serie!.slides];
  if (j < 0 || j >= slides.length) return p;
  [slides[i], slides[j]] = [slides[j], slides[i]];
  let active = synced.serie!.active;
  if (active === i) active = j;
  else if (active === j) active = i;
  return { ...synced, serie: { ...synced.serie!, slides, active } };
}

export function setSeries(p: Project, patch: Partial<Series>): Project {
  return p.serie ? { ...p, serie: { ...p.serie, ...patch } } : p;
}

const NUM = /\s*·\s*\d+\s*\/\s*\d+\s*$/;

/**
 * Progetto piatto per rendere la slide i, con le regole della serie applicate:
 * numero nell'etichetta, freccia e pulsante «avanti» tranne che sull'ultima.
 */
export function slideProject(p: Project, i = p.serie?.active ?? 0): Project {
  if (!p.serie) return p;
  const n = p.serie.slides.length;
  const s = i === p.serie.active ? { composition: p.composition, props: p.props, duration: p.duration } : p.serie.slides[i];
  const props: Props = { ...s.props };
  const comp = getComposition(s.composition);
  const has = (k: string) => comp.fields.some((f) => f.key === k);
  if (p.serie.numera && typeof props.etichetta === 'string' && props.etichetta.trim()) props.etichetta = `${props.etichetta.replace(NUM, '')} · ${i + 1}/${n}`;
  if (p.serie.frecciaAuto) {
    if (has('freccia')) props.freccia = i < n - 1;
    if (has('pulsante')) props.pulsante = i < n - 1;
  }
  const { serie: _s, ...rest } = p;
  void _s;
  return { ...rest, composition: s.composition, props, duration: s.duration };
}

// --- Video della serie ---

export interface Timeline {
  starts: number[];
  lengths: number[];
  overlap: number;
  total: number;
}

export function seriesTimeline(p: Project): Timeline {
  const n = slideCount(p);
  const lengths: number[] = [];
  for (let i = 0; i < n; i++) lengths.push(durationInFrames(slideProject(p, i)));
  const wanted = p.serie?.transizione === 'dissolvenza' ? Math.round((p.serie.durataTransizione ?? 0.4) * p.fps) : 0;
  const overlap = Math.max(0, Math.min(wanted, ...lengths.map((l) => Math.floor(l / 2))));
  const starts: number[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    starts.push(t);
    t += lengths[i] - (i < n - 1 ? overlap : 0);
  }
  return { starts, lengths, overlap, total: t };
}

const mix = { c: null as HTMLCanvasElement | null };

/** Fotogramma g del video della serie, con dissolvenza incrociata tra le slide. */
export function renderSeriesFrame(ctx: CanvasRenderingContext2D, p: Project, g: number, tl = seriesTimeline(p)): RenderResult & { slide: number } {
  const n = tl.starts.length;
  let i = n - 1;
  while (i > 0 && g < tl.starts[i]) i--;
  const res = renderFrame(ctx, slideProject(p, i), g - tl.starts[i], { timeOffset: tl.starts[i] / p.fps });
  // Nella sovrapposizione la slide successiva entra in dissolvenza.
  const next = i + 1;
  if (next < n && tl.overlap > 0 && g >= tl.starts[next]) {
    if (!mix.c) mix.c = document.createElement('canvas');
    const c = mix.c;
    c.width = ctx.canvas.width;
    c.height = ctx.canvas.height;
    const r2 = renderFrame(c.getContext('2d')!, slideProject(p, next), g - tl.starts[next], { timeOffset: tl.starts[next] / p.fps });
    ctx.save();
    ctx.globalAlpha = Math.min(1, (g - tl.starts[next] + 1) / tl.overlap);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
    return { ...r2, warnings: [...new Set([...res.warnings, ...r2.warnings])], slide: next };
  }
  return { ...res, slide: i };
}

/** Secondi tra l'inizio della serie e l'inizio della slide attiva (0 senza serie). */
export function slideOffset(p: Project): number {
  if (!p.serie || p.serie.slides.length <= 1) return 0;
  return seriesTimeline(p).starts[p.serie.active] / p.fps;
}

/** Fotogramma da usare come immagine fissa: l'ultimo, prima dell'eventuale finale animato. */
export function stillFrame(p: Project) {
  const total = durationInFrames(p, getComposition(p.composition));
  const exit = p.props.uscita && p.props.uscita !== 'nessuna' ? Math.ceil(0.9 * p.fps) : 0;
  return Math.max(0, total - 1 - exit);
}
