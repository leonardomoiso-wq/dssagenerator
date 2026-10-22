// Ponte con Figma: la scena esportata dal plugin «DSSA → Compositore» diventa una
// composizione a livelli. In Figma si decidono contenuti e impaginazione, nel compositore
// il movimento. A ogni nuovo invio i contenuti si aggiornano e le animazioni restano.
import { FORMATS, getFormat, paletteNameOf, type PaletteName } from '../brand/tokens';
import type { SymbolId } from '../brand/symbols';
import { getComposition } from '../templates';
import { newLayer } from '../templates/libera';
import { defaultsOf, type Layer, type Project, type Props } from './types';
import type { Series } from './series';

// --- Formato della scena (lo stesso scritto dal plugin, figma-plugin/code.js) ---

export interface FigmaScene {
  kind: 'dssa-figma';
  version: 1;
  fileName?: string;
  fileKey?: string;
  page?: string;
  exportedAt?: string;
  frames: FigmaFrame[];
  /** Avvisi del plugin (componenti non riconosciuti, caratteri mancanti…). */
  warnings?: string[];
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Colore pieno del fondo, se c'è. */
  background?: string | null;
  nodes: FigmaNode[];
}

export interface FigmaText {
  characters: string;
  /** Testo con «**» intorno ai tratti in neretto. */
  markup?: string;
  family: string;
  weight: number;
  size: number;
  /** Interlinea in px; null = automatica. */
  lineHeight: number | null;
  /** Spaziatura in px. */
  letterSpacing: number;
  align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  autoWidth: boolean;
  color: string;
  styleName?: string;
}

interface NodeBase {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  /** Nome del componente principale, se è un'istanza (es. «Simboli/Design for Food/Viola»). */
  component?: string;
  /** Immagine del livello esportata da Figma (PNG/JPG data URL), sempre presente come riserva. */
  image?: string;
}

export type FigmaNode =
  | (NodeBase & { kind: 'text'; text: FigmaText })
  | (NodeBase & { kind: 'symbol'; symbol: SymbolId; fill: 'piatto' | 'iridescente' | 'opaco'; color?: string })
  | (NodeBase & { kind: 'mark'; config: 'logotipo' | 'monogramma' | 'lockup'; color?: string })
  | (NodeBase & { kind: 'label'; text: string; color?: string })
  | (NodeBase & { kind: 'arrow'; color?: string })
  | (NodeBase & { kind: 'image'; photo?: boolean });

export function isScene(v: unknown): v is FigmaScene {
  return !!v && typeof v === 'object' && (v as FigmaScene).kind === 'dssa-figma' && Array.isArray((v as FigmaScene).frames);
}

// --- Indicazioni nei nomi dei livelli: «Titolo [parole] [inizio=0.4]» ---

const ANIM_WORDS: Record<string, string> = {
  fermo: 'nessuna',
  statico: 'nessuna',
  nessuna: 'nessuna',
  maschera: 'maschera',
  sali: 'sali',
  parole: 'parole',
  lettere: 'macchina',
  macchina: 'macchina',
  dissolvenza: 'dissolvenza',
  assembla: 'assembla',
  ruota: 'ruota',
  scorre: 'scorre',
  cresce: 'cresce',
  scala: 'scala',
  tendina: 'tendina',
};

function parseName(name: string): { name: string; anim?: string; inizio?: number; durata?: number; fine?: number } {
  const out: ReturnType<typeof parseName> = { name: name.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim() || name };
  for (const m of name.matchAll(/\[([^\]]+)\]/g)) {
    for (const tok of m[1].split(/[\s,;]+/)) {
      const [k, v] = tok.toLowerCase().split('=');
      if (v !== undefined) {
        const n = parseFloat(v.replace(',', '.'));
        if (Number.isFinite(n)) {
          if (k === 'inizio' || k === 'entra') out.inizio = n;
          if (k === 'durata') out.durata = n;
          if (k === 'fine' || k === 'esce') out.fine = n;
        }
      } else if (ANIM_WORDS[k]) out.anim = ANIM_WORDS[k];
    }
  }
  return out;
}

// --- Traduzione dei nodi in livelli ---

const pct = (v: number, of: number) => Math.round((v / of) * 100000) / 1000;

function colorValue(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  return paletteNameOf(hex) ?? hex.toUpperCase();
}

/** Proprietà che appartengono al compositore (movimento ed effetti): restano tra un invio e l'altro. */
const COMPOSER_KEYS = ['anim', 'inizio', 'durata', 'fine', 'curva', 'loop', 'sfalsamento', 'usaImmagine', 'iri', 'seme', 'trattamento', 'zoom', 'maschera', 'giri'];

function isFullBleed(n: FigmaNode, fr: FigmaFrame) {
  return n.x <= 1 && n.y <= 1 && n.x + n.w >= fr.width - 1 && n.y + n.h >= fr.height - 1;
}

function nodeToLayer(n: FigmaNode, fr: FigmaFrame): Layer {
  const meta = parseName(n.name);
  const geo = { x: pct(n.x, fr.width), y: pct(n.y, fr.height), fw: pct(n.w, fr.width), fh: pct(n.h, fr.height), rif: fr.width, src: n.image ?? '' };
  let layer: Layer;
  switch (n.kind) {
    case 'text': {
      const t = n.text;
      const family = /wotfard/i.test(t.family) ? 'testo' : 'titolo';
      layer = newLayer('testo', {
        ...geo,
        testo: t.markup ?? t.characters,
        carattere: family,
        colore: colorValue(t.color, 'nero'),
        allinea: t.align === 'CENTER' ? 'center' : t.align === 'RIGHT' ? 'right' : 'left',
        larghezza: geo.fw,
        ft: { size: t.size, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, weight: t.weight, autoWidth: t.autoWidth, family: t.family, styleName: t.styleName },
        anim: 'maschera',
        durata: 0.6,
      });
      break;
    }
    case 'symbol':
      layer = newLayer('simbolo', { ...geo, simbolo: n.symbol, riempimento: n.fill, colore: colorValue(n.color, 'bianco'), anim: 'assembla', durata: 0.7 });
      break;
    case 'mark':
      layer = newLayer('marchio', { ...geo, configurazione: n.config, colore: colorValue(n.color, 'nero'), durata: 0.55 });
      break;
    case 'label':
      layer = newLayer('etichetta', { ...geo, testo: n.text, colore: colorValue(n.color, 'nero'), durata: 0.5 });
      break;
    case 'arrow':
      layer = newLayer('freccia', { ...geo, colore: colorValue(n.color, 'nero'), durata: 0.5 });
      break;
    default:
      layer = newLayer('immagine', { ...geo, w: geo.fw, h: geo.fh, maschera: 'rettangolo', anim: isFullBleed(n, fr) ? 'nessuna' : n.photo ? 'dissolvenza' : 'sali', durata: 0.8 });
  }
  layer.name = meta.name;
  layer.figmaId = n.id;
  if (n.opacity !== undefined && n.opacity < 1) layer.props.opacita = n.opacity;
  if (meta.anim) layer.props.anim = meta.anim;
  if (meta.inizio !== undefined) layer.props.inizio = meta.inizio;
  if (meta.durata !== undefined) layer.props.durata = meta.durata;
  if (meta.fine !== undefined) layer.props.fine = meta.fine;
  layer.props._daNome = meta.inizio !== undefined;
  return layer;
}

/** Ingressi di partenza: in ordine di lettura, dall'alto a sinistra, ogni 0,15 s. */
function defaultTiming(layers: Layer[], fr: FigmaFrame) {
  const animated = layers
    .filter((l) => l.props.anim !== 'nessuna' && !l.props._daNome)
    .sort((a, b) => a.props.y - b.props.y || a.props.x - b.props.x);
  let t = 0.2;
  for (const l of animated) {
    // Marchio ed etichetta in alto aprono subito, insieme.
    const header = (l.type === 'marchio' || l.type === 'etichetta') && l.props.y < 15;
    l.props.inizio = header ? (l.type === 'etichetta' ? 0.15 : 0) : Math.round(t * 100) / 100;
    if (!header) t += 0.15;
  }
  for (const l of layers) {
    if (l.props.anim === 'nessuna' && !l.props._daNome) l.props.inizio = 0;
    delete l.props._daNome;
  }
  void fr;
}

/** Livelli di una tavola; con i livelli precedenti, conserva il movimento già impostato. */
export function frameToLayers(fr: FigmaFrame, previous: Layer[] = []): { layers: Layer[]; added: number; updated: number; removed: number } {
  const fresh = fr.nodes.map((n) => nodeToLayer(n, fr));
  defaultTiming(fresh, fr);
  const byFigma = new Map(previous.filter((l) => l.figmaId).map((l) => [l.figmaId!, l]));
  let updated = 0;
  const layers = fresh.map((l) => {
    const old = byFigma.get(l.figmaId!);
    if (!old || old.type !== l.type) return l;
    updated++;
    const kept: Props = {};
    for (const k of COMPOSER_KEYS) if (old.props[k] !== undefined) kept[k] = old.props[k];
    return { ...l, id: old.id, hidden: old.hidden, props: { ...l.props, ...kept } };
  });
  // I livelli aggiunti nel compositore (senza corrispondenza in Figma) restano sopra.
  const own = previous.filter((l) => !l.figmaId);
  const removed = previous.filter((l) => l.figmaId && !fr.nodes.some((n) => n.id === l.figmaId)).length;
  return { layers: [...layers, ...own], added: fresh.length - updated, updated, removed };
}

function formatFor(fr: FigmaFrame, current?: string): string {
  const exact = FORMATS.filter((f) => f.width === Math.round(fr.width) && f.height === Math.round(fr.height));
  const li = /linked\s*in|\bli\b/i.test(fr.name);
  if (current && exact.some((f) => f.id === current)) return current;
  if (exact.length) return (exact.find((f) => (li ? f.platform === 'LinkedIn' : f.platform === 'Instagram')) ?? exact[0]).id;
  const ar = fr.width / fr.height;
  return [...FORMATS].sort((a, b) => Math.abs(a.width / a.height - ar) - Math.abs(b.width / b.height - ar))[0].id;
}

function slidePropsFor(fr: FigmaFrame, scene: FigmaScene, previous?: Props): { props: Props; stats: ReturnType<typeof frameToLayers> } {
  const base = previous ?? defaultsOf(getComposition('libera').fields);
  const stats = frameToLayers(fr, previous?.livelli ?? []);
  const bg = fr.background ? colorValue(fr.background, 'bianco') : 'bianco';
  return {
    props: {
      ...base,
      fondo: bg,
      livelli: stats.layers,
      figma: { frameId: fr.id, frameName: fr.name, fileName: scene.fileName, fileKey: scene.fileKey, importedAt: new Date().toISOString(), width: fr.width, height: fr.height },
    },
    stats,
  };
}

function durationFor(props: Props, fallback: number) {
  const last = Math.max(0, ...(props.livelli as Layer[]).map((l) => (l.props.inizio ?? 0) + (l.props.durata ?? 0.7)));
  return Math.max(fallback, Math.ceil((last + 2.5) * 2) / 2);
}

export interface ImportReport {
  project: Project;
  mode: 'nuovo' | 'aggiornato';
  frames: number;
  added: number;
  updated: number;
  removed: number;
  warnings: string[];
}

/** Il progetto attuale viene da queste tavole di Figma? */
export function matchesScene(p: Project, scene: FigmaScene): boolean {
  const ids = new Set(scene.frames.map((f) => f.id));
  if (p.props.figma && ids.has(p.props.figma.frameId)) return true;
  return !!p.serie?.slides.some((s) => s.props.figma && ids.has(s.props.figma.frameId));
}

/**
 * Crea un progetto dalle tavole, oppure aggiorna quello corrente se viene dalle stesse tavole:
 * testi, immagini, posizioni e colori da Figma; ingressi, tempi ed effetti dal compositore.
 */
export function importScene(scene: FigmaScene, current: Project | null): ImportReport {
  const warnings = [...(scene.warnings ?? [])];
  const totals = { added: 0, updated: 0, removed: 0 };
  const add = (st: ReturnType<typeof frameToLayers>) => {
    totals.added += st.added;
    totals.updated += st.updated;
    totals.removed += st.removed;
  };
  if (!scene.frames.length) throw new Error('La scena non contiene tavole: in Figma seleziona una o più tavole (frame).');
  const update = !!current && matchesScene(current, scene);
  const base: Project = update
    ? current!
    : { version: 1, composition: 'libera', format: formatFor(scene.frames[0]), fps: 30, duration: 6, speed: 1, strict: true, props: {} };

  // Slide esistenti (o la sola tavola) per id di Figma.
  const existing: { composition: string; props: Props; duration: number; id?: string }[] = base.serie
    ? base.serie.slides.map((s, i) => (i === base.serie!.active ? { ...s, composition: base.composition, props: base.props, duration: base.duration } : s))
    : update
      ? [{ composition: base.composition, props: base.props, duration: base.duration }]
      : [];
  const byFrame = new Map(existing.filter((s) => s.props.figma?.frameId).map((s) => [s.props.figma.frameId as string, s]));

  const slides = scene.frames.map((fr, i) => {
    const prev = byFrame.get(fr.id);
    const { props, stats } = slidePropsFor(fr, scene, prev?.composition === 'libera' ? prev.props : undefined);
    add(stats);
    const fmt = getFormat(base.format);
    if (Math.round(fr.width) !== fmt.width || Math.round(fr.height) !== fmt.height)
      warnings.push(`«${fr.name}» è ${Math.round(fr.width)} × ${Math.round(fr.height)}: il formato del progetto è ${fmt.width} × ${fmt.height}, le posizioni si adattano in proporzione.`);
    return { id: prev?.id ?? `slide-figma-${fr.id.replace(/[^a-z0-9]/gi, '')}-${i}`, composition: 'libera', props, duration: prev ? prev.duration : durationFor(props, 6) };
  });
  // Le slide non arrivate da Figma (create nel compositore) restano in coda.
  if (update && base.serie) {
    for (const s of existing) if (!s.props.figma || !scene.frames.some((f) => f.id === s.props.figma.frameId)) slides.push({ ...s, id: s.id ?? `slide-${Math.random()}` });
  }

  let project: Project;
  if (slides.length === 1) {
    const s = slides[0];
    const { serie: _s, ...rest } = base;
    void _s;
    project = { ...rest, composition: 'libera', props: s.props, duration: s.duration };
  } else {
    const prevSerie = base.serie;
    const activeId = prevSerie ? prevSerie.slides[prevSerie.active]?.id : undefined;
    const active = Math.max(0, slides.findIndex((s) => s.id === activeId));
    const serie: Series = {
      numera: prevSerie?.numera ?? false,
      frecciaAuto: prevSerie?.frecciaAuto ?? false,
      transizione: prevSerie?.transizione ?? 'dissolvenza',
      durataTransizione: prevSerie?.durataTransizione ?? 0.4,
      anteprima: prevSerie?.anteprima ?? 'slide',
      slides: slides.map((s) => ({ id: s.id, composition: s.composition, props: s.props, duration: s.duration })),
      active,
    };
    const a = serie.slides[active];
    project = { ...base, composition: a.composition, props: a.props, duration: a.duration, serie };
  }
  return { project, mode: update ? 'aggiornato' : 'nuovo', frames: scene.frames.length, ...totals, warnings };
}

export const PALETTE_HINT: PaletteName[] = ['viola', 'fucsia', 'verde', 'giallo', 'nero', 'bianco'];
