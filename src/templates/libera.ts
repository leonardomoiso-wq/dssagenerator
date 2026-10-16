// Composizione libera a livelli: si combinano simboli, forme, testi, marchio, etichetta,
// immagini, materia iridescente e freccia, ognuno con il suo ingresso e il suo tempo.
import { drawArrow, drawDuotone, drawImageCover, drawLabel, drawLockup, drawLogotypeReveal, drawMonogram, labelWidth, lockupSize, logotypeWidth, monogramSize, drawParts, partsClipPath, partStates, breath, SHAPE_ANIM_OPTIONS, SHAPE_LOOP_OPTIONS, type Fill } from '../brand/draw';
import { FORMS, getSymbol } from '../brand/symbols';
import { drawIridescent } from '../brand/iridescent';
import { isPaletteColor, PALETTE, resolveColor, TYPE } from '../brand/tokens';
import { clamp, EASING_OPTIONS, getEasing } from '../engine/anim';
import { drawText, layoutText, TEXT_ANIM_OPTIONS, type TextAnim } from '../engine/text';
import type { Box, Composition, Env, Field, FrameInfo, Layer, Props } from '../engine/types';
import { defaultsOf } from '../engine/types';
import { drawFondo, exitProgress, fondoFields, IRI_STYLES, ritmoFields } from './common';
import { FILL_OPTIONS } from './symbol-helpers';

const pos = (x: number, y: number): Field[] => [
  { type: 'number', key: 'x', label: 'Posizione orizzontale', group: 'Posizione', default: x, min: -50, max: 150, step: 0.5, unit: '%' },
  { type: 'number', key: 'y', label: 'Posizione verticale', group: 'Posizione', default: y, min: -50, max: 150, step: 0.5, unit: '%' },
];
const timing = (start = 0.2): Field[] => [
  { type: 'number', key: 'inizio', label: 'Inizio', group: 'Tempo', default: start, min: 0, max: 60, step: 0.05, unit: 's' },
  { type: 'number', key: 'durata', label: 'Durata dell’ingresso', group: 'Tempo', default: 0.7, min: 0.05, max: 5, step: 0.05, unit: 's' },
  { type: 'number', key: 'fine', label: 'Esce a', group: 'Tempo', default: 0, min: 0, max: 60, step: 0.05, unit: 's (0 = resta)' },
  { type: 'select', key: 'curva', label: 'Curva', group: 'Tempo', default: 'dssa', options: EASING_OPTIONS },
];

const TEXT_STYLES = Object.keys(TYPE).map((k) => ({ value: k, label: k.replace(/(\d+)/, ' $1 px').replace('titolo', 'Titolo').replace('testo', 'Testo').replace('etichetta', 'Etichetta').replace('fonte', 'Fonte') }));

export const LAYER_TYPES: Record<string, { label: string; fields: Field[] }> = {
  simbolo: {
    label: 'Simbolo',
    fields: [
      { type: 'symbol', key: 'simbolo', label: 'Ambito', group: 'Simbolo', default: 'with' },
      { type: 'select', key: 'riempimento', label: 'Versione', group: 'Simbolo', default: 'piatto', options: FILL_OPTIONS },
      { type: 'color', key: 'colore', label: 'Colore', group: 'Simbolo', default: 'bianco', when: (p) => p.riempimento !== 'iridescente' },
      { type: 'select', key: 'iri', label: 'Materia', group: 'Simbolo', default: 'raggiera', options: IRI_STYLES, when: (p) => p.riempimento === 'iridescente' },
      { type: 'number', key: 'seme', label: 'Variante della materia', group: 'Simbolo', default: 3, min: 0, max: 99, step: 1, when: (p) => p.riempimento === 'iridescente' },
      { type: 'number', key: 'dimensione', label: 'Dimensione', group: 'Simbolo', default: 50, min: 2, max: 200, step: 0.5, unit: '% della larghezza' },
      { type: 'number', key: 'rotazione', label: 'Rotazione', group: 'Simbolo', default: 0, min: 0, max: 270, step: 90, unit: '°', free: true, help: 'Fuori dalle regole: i simboli non si ruotano (p. 40).' },
      ...pos(50, 50),
      { type: 'select', key: 'anim', label: 'Ingresso', group: 'Tempo', default: 'assembla', options: SHAPE_ANIM_OPTIONS },
      { type: 'select', key: 'loop', label: 'Movimento continuo', group: 'Tempo', default: 'nessuno', options: SHAPE_LOOP_OPTIONS },
      { type: 'number', key: 'sfalsamento', label: 'Sfalsamento tra le parti', group: 'Tempo', default: 0.08, min: 0, max: 1, step: 0.01, unit: 's' },
      ...timing(),
    ],
  },
  forma: {
    label: 'Forma del vocabolario',
    fields: [
      { type: 'select', key: 'forma', label: 'Forma', group: 'Forma', default: 'quarto', options: FORMS.map((f) => ({ value: f.id, label: f.label })) },
      { type: 'select', key: 'riempimento', label: 'Versione', group: 'Forma', default: 'piatto', options: FILL_OPTIONS },
      { type: 'color', key: 'colore', label: 'Colore', group: 'Forma', default: 'fucsia', when: (p) => p.riempimento !== 'iridescente' },
      { type: 'select', key: 'iri', label: 'Materia', group: 'Forma', default: 'raggiera', options: IRI_STYLES, when: (p) => p.riempimento === 'iridescente' },
      { type: 'number', key: 'dimensione', label: 'Dimensione', group: 'Forma', default: 40, min: 2, max: 300, step: 0.5, unit: '% della larghezza' },
      { type: 'number', key: 'rotazione', label: 'Rotazione', group: 'Forma', default: 0, min: 0, max: 270, step: 90, unit: '°' },
      { type: 'number', key: 'giri', label: 'Rotazioni di 90° durante il video', group: 'Forma', default: 0, min: 0, max: 20, step: 1 },
      ...pos(50, 50),
      { type: 'select', key: 'anim', label: 'Ingresso', group: 'Tempo', default: 'cresce', options: SHAPE_ANIM_OPTIONS },
      ...timing(),
    ],
  },
  testo: {
    label: 'Testo',
    fields: [
      { type: 'textarea', key: 'testo', label: 'Testo (**neretto**)', group: 'Testo', default: 'Titolo', rows: 3 },
      { type: 'select', key: 'stile', label: 'Stile', group: 'Testo', default: 'titolo96', options: TEXT_STYLES },
      { type: 'number', key: 'corpo', label: 'Corpo libero', group: 'Testo', default: 0, min: 0, max: 600, step: 1, unit: 'px (0 = dallo stile)', free: true },
      {
        type: 'select',
        key: 'carattere',
        label: 'Carattere',
        group: 'Testo',
        default: 'titolo',
        options: [
          { value: 'titolo', label: 'Basier Circle' },
          { value: 'testo', label: 'Wotfard (testi a stampa)' },
        ],
      },
      { type: 'color', key: 'colore', label: 'Colore', group: 'Testo', default: 'bianco' },
      { type: 'number', key: 'larghezza', label: 'Larghezza del blocco', group: 'Testo', default: 83.7, min: 5, max: 100, step: 0.5, unit: '%' },
      {
        type: 'select',
        key: 'allinea',
        label: 'Allineamento',
        group: 'Testo',
        default: 'left',
        options: [
          { value: 'left', label: 'A sinistra' },
          { value: 'center', label: 'Al centro' },
          { value: 'right', label: 'A destra' },
        ],
      },
      ...pos(8.15, 30),
      { type: 'select', key: 'anim', label: 'Ingresso', group: 'Tempo', default: 'maschera', options: TEXT_ANIM_OPTIONS },
      ...timing(0.3),
    ],
  },
  marchio: {
    label: 'Marchio',
    fields: [
      {
        type: 'select',
        key: 'configurazione',
        label: 'Configurazione',
        group: 'Marchio',
        default: 'logotipo',
        options: [
          { value: 'logotipo', label: 'Logotipo' },
          { value: 'monogramma', label: 'Monogramma' },
          { value: 'lockup', label: 'Lockup orizzontale' },
        ],
      },
      { type: 'number', key: 'altezza', label: 'Altezza della maiuscola', group: 'Marchio', default: 29, min: 14, max: 500, step: 1, unit: 'px' },
      { type: 'color', key: 'colore', label: 'Colore', group: 'Marchio', default: 'bianco', only: ['nero', 'bianco', 'viola'] },
      ...pos(8.15, 6.5),
      ...timing(0),
    ],
  },
  etichetta: {
    label: 'Etichetta di serie',
    fields: [
      { type: 'text', key: 'testo', label: 'Testo', group: 'Etichetta', default: 'Nome della serie · 1/7' },
      { type: 'color', key: 'colore', label: 'Colore', group: 'Etichetta', default: 'bianco', only: ['nero', 'bianco'] },
      ...pos(24, 7.6),
      ...timing(0.1),
    ],
  },
  immagine: {
    label: 'Immagine',
    fields: [
      { type: 'image', key: 'src', label: 'File', group: 'Immagine', default: '' },
      { type: 'number', key: 'w', label: 'Larghezza', group: 'Immagine', default: 100, min: 1, max: 200, step: 0.5, unit: '%' },
      { type: 'number', key: 'h', label: 'Altezza', group: 'Immagine', default: 100, min: 1, max: 200, step: 0.5, unit: '%' },
      {
        type: 'select',
        key: 'maschera',
        label: 'Forma',
        group: 'Immagine',
        default: 'rettangolo',
        options: [
          { value: 'rettangolo', label: 'Rettangolo' },
          { value: 'cerchio', label: 'Cerchio' },
          { value: 'simbolo', label: 'Finestra in un simbolo' },
        ],
      },
      { type: 'symbol', key: 'simbolo', label: 'Simbolo della finestra', group: 'Immagine', default: 'for', when: (p) => p.maschera === 'simbolo' },
      {
        type: 'select',
        key: 'trattamento',
        label: 'Trattamento',
        group: 'Immagine',
        default: 'nessuno',
        options: [
          { value: 'nessuno', label: 'Nessuno' },
          { value: 'fucsia', label: 'Duotono fucsia' },
          { value: 'verde', label: 'Duotono verde' },
          { value: 'viola', label: 'Duotono viola' },
          { value: 'giallo', label: 'Duotono giallo' },
        ],
      },
      { type: 'number', key: 'zoom', label: 'Avvicinamento lento', group: 'Immagine', default: 0, min: 0, max: 50, step: 1, unit: '%' },
      ...pos(0, 0),
      { type: 'select', key: 'anim', label: 'Ingresso', group: 'Tempo', default: 'dissolvenza', options: [
        { value: 'dissolvenza', label: 'Dissolvenza' },
        { value: 'sali', label: 'Sale' },
        { value: 'nessuna', label: 'Nessuna' },
      ] },
      ...timing(0),
    ],
  },
  iridescente: {
    label: 'Materia iridescente',
    fields: [
      { type: 'select', key: 'stile', label: 'Materia', group: 'Materia', default: 'raggiera', options: IRI_STYLES },
      { type: 'number', key: 'seme', label: 'Variante', group: 'Materia', default: 5, min: 0, max: 99, step: 1 },
      { type: 'number', key: 'velocita', label: 'Movimento', group: 'Materia', default: 1, min: 0, max: 4, step: 0.1 },
      { type: 'number', key: 'w', label: 'Larghezza', group: 'Materia', default: 100, min: 1, max: 200, step: 0.5, unit: '%' },
      { type: 'number', key: 'h', label: 'Altezza', group: 'Materia', default: 100, min: 1, max: 200, step: 0.5, unit: '%' },
      ...pos(0, 0),
      ...timing(0),
    ],
  },
  freccia: {
    label: 'Freccia',
    fields: [{ type: 'color', key: 'colore', label: 'Colore', group: 'Freccia', default: 'bianco', only: ['nero', 'bianco'] }, ...pos(8.15, 90), ...timing(1)],
  },
};

let uid = 0;
export function newLayer(type: string, overrides: Props = {}): Layer {
  const def = LAYER_TYPES[type];
  return {
    id: `${type}-${Date.now().toString(36)}-${uid++}`,
    type,
    name: def.label,
    props: { ...defaultsOf(def.fields), ...overrides },
  };
}

/** Riquadro di un livello, per la selezione e il trascinamento sull'anteprima. */
function layerBox(ctx: CanvasRenderingContext2D, f: FrameInfo, layer: Layer, env: Env): Box {
  const lp = layer.props;
  const s = f.s;
  const X = (lp.x / 100) * f.width;
  const Y = (lp.y / 100) * f.height;
  switch (layer.type) {
    case 'simbolo':
    case 'forma': {
      const size = (f.width * lp.dimensione) / 100;
      return { x: X - size / 2, y: Y - size / 2, w: size, h: size };
    }
    case 'testo': {
      const base = (TYPE as any)[lp.stile] ?? TYPE.titolo96;
      const size = (env.strict || !lp.corpo ? base.size : lp.corpo) * s;
      const w = (f.width * lp.larghezza) / 100;
      const lay = layoutText(ctx, lp.testo, { family: lp.carattere ?? 'titolo', size, weight: base.weight, lineHeight: base.lineHeight, tracking: base.tracking }, w);
      const x0 = lp.allinea === 'center' ? X + (w - lay.width) / 2 : lp.allinea === 'right' ? X + w - lay.width : X;
      return { x: x0, y: Y - size * 0.12, w: lay.width, h: lay.height + size * 0.4 };
    }
    case 'marchio': {
      const cap = lp.altezza * s;
      const sz = lp.configurazione === 'monogramma' ? monogramSize(ctx, cap) : lp.configurazione === 'lockup' ? lockupSize(ctx, cap) : { w: logotypeWidth(ctx, cap), h: cap };
      return { x: X, y: Y, ...sz };
    }
    case 'etichetta': {
      const h = 55 * s;
      return { x: X, y: Y - h / 2, w: labelWidth(ctx, lp.testo, s), h };
    }
    case 'freccia':
      return { x: X, y: Y, w: 56 * s, h: 39 * s };
    default:
      return { x: X, y: Y, w: (f.width * (lp.w ?? 100)) / 100, h: (f.height * (lp.h ?? 100)) / 100 };
  }
}

function layerAlpha(f: FrameInfo, lp: Props, env: Env) {
  const start = env.sec(lp.inizio ?? 0);
  const dur = env.sec(lp.durata ?? 0.7);
  const e = getEasing(lp.curva)(clamp((f.frame - start) / Math.max(1, dur)));
  let out = 0;
  if (lp.fine > 0) out = clamp((f.frame - env.sec(lp.fine)) / Math.max(1, env.sec(0.4)));
  return { start, dur, e, out };
}

function drawLayer(ctx: CanvasRenderingContext2D, f: FrameInfo, layer: Layer, env: Env, globalOut: number) {
  const lp = layer.props;
  const { start, dur, e, out: lout } = layerAlpha(f, lp, env);
  const out = Math.max(lout, globalOut);
  if (f.frame < start) return;
  const s = f.s;
  const X = (lp.x / 100) * f.width;
  const Y = (lp.y / 100) * f.height;
  const color = resolveColor(lp.colore, PALETTE.bianco);
  if (lp.colore && !isPaletteColor(color)) env.warn(`«${layer.name}»: colore fuori dalla palette.`);
  switch (layer.type) {
    case 'simbolo':
    case 'forma': {
      const parts = layer.type === 'simbolo' ? getSymbol(lp.simbolo).parts : (FORMS.find((x) => x.id === lp.forma) ?? FORMS[0]).parts;
      const size = (f.width * lp.dimensione) / 100;
      const fill: Fill = { mode: lp.riempimento, color, iri: { style: lp.iri ?? 'raggiera', time: f.time, seed: lp.seme ?? 3, rays: 0.9 } };
      const m = { anim: lp.anim, frame: f.frame, fps: f.fps, start, dur, stagger: env.sec(lp.sfalsamento ?? 0.08), easing: lp.curva, loop: lp.loop, out };
      let rot = ((lp.rotazione ?? 0) * Math.PI) / 180;
      if (layer.type === 'simbolo' && rot !== 0) env.warn('Simbolo ruotato: i simboli non si ruotano (p. 40).');
      if (layer.type === 'forma' && lp.giri > 0) {
        const total = f.durationInFrames - start - dur;
        const step = total / (lp.giri + 1);
        const k = (f.frame - start - dur) / step;
        if (k > 0) {
          const n = Math.floor(k);
          const fr = k - n;
          rot += (Math.min(n, lp.giri) + (n < lp.giri ? getEasing('dssa')(clamp(fr * 3)) : 0)) * (Math.PI / 2);
        }
      }
      drawParts(ctx, parts, X - size / 2, Y - size / 2, size, fill, partStates(parts, m), { rotate: rot, globalScale: breath(m) });
      break;
    }
    case 'testo': {
      const base = (TYPE as any)[lp.stile] ?? TYPE.titolo96;
      const size = (env.strict || !lp.corpo ? base.size : lp.corpo) * s;
      if (size < 26 * s) env.warn(`«${layer.name}»: corpo sotto i 26 px minimi dei social (p. 28).`);
      const st = { family: lp.carattere ?? 'titolo', size, weight: base.weight, lineHeight: base.lineHeight, tracking: base.tracking };
      const w = (f.width * lp.larghezza) / 100;
      const lay = layoutText(ctx, lp.testo, st, w);
      const ax = lp.allinea === 'center' ? X + w / 2 : lp.allinea === 'right' ? X + w : X;
      drawText(ctx, lay, ax, Y, { color, align: lp.allinea, anim: lp.anim as TextAnim, frame: f.frame, start, dur, stagger: env.sec(0.08), easing: lp.curva, out });
      break;
    }
    case 'marchio': {
      const cap = lp.altezza * s;
      ctx.save();
      ctx.globalAlpha *= 1 - out;
      const r = (i: number) => getEasing(lp.curva)(clamp((f.frame - start - i * env.sec(0.1)) / Math.max(1, dur)));
      if (lp.configurazione === 'monogramma') drawMonogram(ctx, X, Y, cap, color, [r(0), r(1)]);
      else if (lp.configurazione === 'lockup') drawLockup(ctx, X, Y, cap, color, [r(0), r(1), r(3)]);
      else drawLogotypeReveal(ctx, X, Y, cap, color, r(0));
      ctx.restore();
      break;
    }
    case 'etichetta':
      drawLabel(ctx, lp.testo, X + (1 - e) * 16 * s, Y, s, color, e * (1 - out));
      break;
    case 'freccia':
      drawArrow(ctx, X, Y, s, color, e * (1 - out));
      break;
    case 'iridescente': {
      ctx.save();
      ctx.globalAlpha *= e * (1 - out);
      drawIridescent(ctx, X, Y, (f.width * lp.w) / 100, (f.height * lp.h) / 100, { style: lp.stile, time: f.time, seed: lp.seme, speed: lp.velocita, rays: 0.85 });
      ctx.restore();
      break;
    }
    case 'immagine': {
      const img = env.image(lp.src);
      const w = (f.width * lp.w) / 100;
      const h = (f.height * lp.h) / 100;
      const dy = lp.anim === 'sali' ? (1 - e) * 60 * s : 0;
      ctx.save();
      ctx.globalAlpha *= (lp.anim === 'nessuna' ? 1 : e) * (1 - out);
      if (lp.maschera === 'cerchio') {
        ctx.beginPath();
        ctx.ellipse(X + w / 2, Y + h / 2 + dy, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.clip();
      } else if (lp.maschera === 'simbolo') {
        const parts = getSymbol(lp.simbolo).parts;
        const sz = Math.min(w, h);
        ctx.clip(partsClipPath(parts, X + (w - sz) / 2, Y + (h - sz) / 2 + dy, sz));
      } else {
        ctx.beginPath();
        ctx.rect(X, Y + dy, w, h);
        ctx.clip();
      }
      const z = 1 + ((lp.zoom ?? 0) / 100) * clamp(f.frame / Math.max(1, f.durationInFrames - 1));
      if (img) {
        if (lp.trattamento && lp.trattamento !== 'nessuno') drawDuotone(ctx, img, X, Y + dy, w, h, lp.trattamento, { zoom: z });
        else drawImageCover(ctx, img, X, Y + dy, w, h, { zoom: z });
      } else {
        ctx.fillStyle = '#DDD9F5';
        ctx.fillRect(X, Y + dy, w, h);
      }
      ctx.restore();
      break;
    }
  }
}

/** Disegna una pila di livelli (composizione libera o elementi aggiunti a un modello). */
export function drawLayers(ctx: CanvasRenderingContext2D, f: FrameInfo, layers: Layer[], env: Env, out: number) {
  const symbols = layers.filter((l) => l.type === 'simbolo' && !l.hidden);
  if (symbols.length > 1) env.warn('Più di un simbolo: in una copertina social va un solo simbolo (p. 40).');
  for (const l of layers) {
    if (l.hidden) continue;
    ctx.save();
    try {
      const lp = l.props;
      const time = { start: env.sec(lp.inizio ?? 0), end: env.sec((lp.inizio ?? 0) + (lp.durata ?? 0.7)), exit: lp.fine > 0 ? env.sec(lp.fine) : undefined };
      env.place(l.id, l.name, layerBox(ctx, f, l, env), () => drawLayer(ctx, f, l, env, out), 'livello', time);
    } finally {
      ctx.restore();
    }
  }
}

export const libera: Composition = {
  id: 'libera',
  name: 'Composizione libera',
  source: 'Tutti gli elementi dell’identità, a livelli',
  description: 'Componi da zero: aggiungi simboli, forme, testi, marchio, immagini e materia iridescente, ognuno con il suo tempo.',
  category: 'Libera',
  defaultFormat: 'ig-story',
  defaultDuration: 8,
  fields: [
    ...fondoFields('viola'),
    {
      type: 'layers',
      key: 'livelli',
      label: 'Livelli',
      group: 'Livelli',
      default: [
        newLayer('marchio', { y: 13, x: 8.15 }),
        newLayer('etichetta', { testo: 'Nome della serie', x: 24.5, y: 13.75 }),
        newLayer('simbolo', { simbolo: 'systemic', riempimento: 'iridescente', dimensione: 92, x: 74, y: 76, inizio: 0.3 }),
        newLayer('testo', { testo: 'Componi\nda zero', y: 22, inizio: 0.5 }),
      ],
    },
    ...ritmoFields({ text: false, shapes: false, loop: false }).filter((x) => x.key !== 'curva' && x.key !== 'ritardo'),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const out = exitProgress(f, p);
    drawLayers(ctx, f, p.livelli ?? [], env, out);
  },
};
