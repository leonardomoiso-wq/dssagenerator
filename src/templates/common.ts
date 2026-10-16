// Campi e disegni condivisi dai modelli: fondo, testata (marchio ed etichetta), ritmo.
import { drawArrow, drawIridescentBg, drawLabel, drawLogotype, SHAPE_ANIM_OPTIONS, SHAPE_LOOP_OPTIONS } from '../brand/draw';
import { EASING_OPTIONS, Easing, clamp } from '../engine/anim';
import { TEXT_ANIM_OPTIONS, type TextStyle } from '../engine/text';
import type { Env, Field, FrameInfo, Props } from '../engine/types';
import {
  contrast,
  LABEL_GAP_X,
  LOGO_CAP_PX,
  PALETTE,
  PALETTE_LABEL,
  paletteNameOf,
  resolveColor,
  TEXT_ON,
  TYPE,
  autoTitleStyle,
  minContrastFor,
  type PaletteName,
} from '../brand/tokens';

export const BG_EXTRA = [
  { value: 'iridescente', label: 'Iridescente' },
  { value: 'sfumaturaFucsia', label: 'Sfumatura fucsia' },
];

export const IRI_STYLES = [
  { value: 'raggiera', label: 'Raggiera' },
  { value: 'raggieraTitolo', label: 'Raggiera · titolo' },
  { value: 'nativa', label: 'Sfumatura nativa' },
  { value: 'fucsia', label: 'Sfumatura fucsia' },
];

export const INK_EXTRA = [{ value: 'auto', label: 'Automatico (regola del manuale)' }];

// --- Gruppi di campi riutilizzabili ---

export function fondoFields(def: string = 'viola', opts: { extra?: boolean } = {}): Field[] {
  return [
    {
      type: 'color',
      key: 'fondo',
      label: 'Colore del fondo',
      group: 'Fondo',
      default: def,
      extra: opts.extra === false ? [] : BG_EXTRA,
    },
    {
      type: 'select',
      key: 'iriStile',
      label: 'Materia iridescente',
      group: 'Fondo',
      default: 'raggiera',
      options: IRI_STYLES,
      when: (p) => p.fondo === 'iridescente',
    },
    {
      type: 'number',
      key: 'iriSeme',
      label: 'Variante della materia',
      group: 'Fondo',
      default: 7,
      min: 0,
      max: 99,
      step: 1,
      when: (p) => p.fondo === 'iridescente' || p.fondo === 'sfumaturaFucsia',
    },
    {
      type: 'number',
      key: 'iriVelocita',
      label: 'Movimento della materia',
      group: 'Fondo',
      default: 1,
      min: 0,
      max: 4,
      step: 0.1,
      when: (p) => p.fondo === 'iridescente' || p.fondo === 'sfumaturaFucsia',
    },
  ];
}

export function testataFields(label = 'Nome della serie'): Field[] {
  return [
    { type: 'boolean', key: 'marchio', label: 'Logotipo DSSA in alto a sinistra', group: 'Testata', default: true },
    { type: 'text', key: 'etichetta', label: 'Etichetta di serie', group: 'Testata', default: label, placeholder: 'Vuota: nessuna etichetta' },
    {
      type: 'color',
      key: 'inchiostro',
      label: 'Colore di testi e marchio',
      group: 'Testata',
      default: 'auto',
      extra: INK_EXTRA,
      only: ['nero', 'bianco'],
      help: 'Automatico: bianco su viola, nero, duotono e iridescente; nero su fucsia, verde, giallo e bianco (p. 15, 24).',
    },
    { type: 'boolean', key: 'freccia', label: 'Freccia in basso a sinistra (la serie continua)', group: 'Testata', default: false },
  ];
}

export function ritmoFields(o: { text?: boolean; shapes?: boolean; loop?: boolean } = {}): Field[] {
  const out: Field[] = [];
  if (o.text !== false)
    out.push({ type: 'select', key: 'animTesto', label: 'Ingresso del testo', group: 'Animazione', default: 'maschera', options: TEXT_ANIM_OPTIONS });
  if (o.shapes !== false)
    out.push({ type: 'select', key: 'animForme', label: 'Ingresso delle forme', group: 'Animazione', default: 'assembla', options: SHAPE_ANIM_OPTIONS });
  if (o.loop !== false)
    out.push({ type: 'select', key: 'loop', label: 'Movimento continuo', group: 'Animazione', default: 'onda', options: SHAPE_LOOP_OPTIONS });
  out.push(
    { type: 'select', key: 'curva', label: 'Curva di movimento', group: 'Animazione', default: 'dssa', options: EASING_OPTIONS },
    { type: 'number', key: 'ritardo', label: 'Ritardo iniziale', group: 'Animazione', default: 0.2, min: 0, max: 5, step: 0.1, unit: 's' },
    {
      type: 'select',
      key: 'uscita',
      label: 'Finale',
      group: 'Animazione',
      default: 'nessuna',
      options: [
        { value: 'nessuna', label: 'Nessuno (ultimo fotogramma fermo)' },
        { value: 'dissolvenza', label: 'Gli elementi escono' },
        { value: 'forme', label: 'Copertura con una forma' },
      ],
    },
    {
      type: 'select',
      key: 'entrata',
      label: 'Apertura',
      group: 'Animazione',
      default: 'nessuna',
      options: [
        { value: 'nessuna', label: 'Nessuna' },
        { value: 'forme', label: 'Scoperta da una forma' },
      ],
    },
    {
      type: 'color',
      key: 'coloreTransizione',
      label: 'Colore della forma di apertura e chiusura',
      group: 'Animazione',
      default: 'nero',
      when: (p) => p.uscita === 'forme' || p.entrata === 'forme',
    },
  );
  return out;
}

export function titoloStileField(def = 'auto'): Field {
  return {
    type: 'select',
    key: 'corpoTitolo',
    label: 'Corpo del titolo',
    group: 'Testi',
    default: def,
    options: [
      { value: 'auto', label: 'Automatico per numero di battute (p. 28)' },
      { value: 'titolo124', label: '124 px · fino a 20 battute' },
      { value: 'titolo104', label: '104 px · 16-20 battute con sottotitolo lungo' },
      { value: 'titolo96', label: '96 px · fino a 34 battute' },
      { value: 'titolo80', label: '80 px · oltre 34 battute' },
    ],
  };
}

// --- Risoluzione dei valori ---

export function isPhotoBg(v: string) {
  return v === 'iridescente' || v === 'sfumaturaFucsia' || v === 'duotono' || v === 'foto';
}

/** Colore del testo secondo il fondo. */
export function inkFor(props: Props, bg: string, env: Env): string {
  const choice: string = props.inchiostro ?? 'auto';
  let ink: string;
  if (choice === 'auto' || !choice) {
    if (isPhotoBg(bg)) ink = PALETTE.bianco;
    else {
      const name = (bg in PALETTE ? bg : paletteNameOf(resolveColor(bg))) as PaletteName | undefined;
      ink = name ? PALETTE[TEXT_ON[name]] : contrast(resolveColor(bg), '#000') > contrast(resolveColor(bg), '#fff') ? PALETTE.nero : PALETTE.bianco;
    }
  } else ink = resolveColor(choice);
  if (!isPhotoBg(bg)) {
    const c = contrast(ink, resolveColor(bg));
    if (c < 3) env.warn(`Testo ${colorName(ink)} su ${colorName(resolveColor(bg))}: contrasto ${c.toFixed(2).replace('.', ',')}:1, sotto 3:1 anche per i titoli (p. 24).`);
    else if (c < 4.5) env.warn(`Testo ${colorName(ink)} su ${colorName(resolveColor(bg))}: ${c.toFixed(2).replace('.', ',')}:1, regge solo i testi grandi (p. 24).`);
  }
  return ink;
}

export function checkTextContrast(env: Env, ink: string, bg: string, st: TextStyle) {
  if (isPhotoBg(bg)) return;
  const c = contrast(ink, resolveColor(bg));
  const need = minContrastFor(st.size, st.weight);
  if (c < need && c >= 3)
    env.warn(`Testo corrente a ${Math.round(st.size)} px con contrasto ${c.toFixed(2).replace('.', ',')}:1: sotto ${need}:1 (p. 24).`);
}

export function colorName(hex: string) {
  const n = paletteNameOf(hex);
  return n ? PALETTE_LABEL[n].toLowerCase() : hex;
}

export function titleStyle(props: Props, text: string, s: number): TextStyle {
  const key = props.corpoTitolo && props.corpoTitolo !== 'auto' ? props.corpoTitolo : autoTitleStyle(text);
  const t = (TYPE as any)[key] ?? TYPE.titolo96;
  return { family: 'titolo', size: t.size * s, weight: t.weight, lineHeight: t.lineHeight, tracking: t.tracking };
}

export function styleOf(name: keyof typeof TYPE, s: number, family: 'titolo' | 'testo' = 'titolo'): TextStyle {
  const t = TYPE[name];
  return { family, size: t.size * s, weight: t.weight, lineHeight: t.lineHeight, tracking: t.tracking };
}

// --- Disegni comuni ---

/** Fondo: colore pieno, iridescente o sfumatura fucsia. */
export function drawFondo(ctx: CanvasRenderingContext2D, f: FrameInfo, props: Props, env: Env) {
  const bg: string = props.fondo ?? 'viola';
  if (bg === 'iridescente' || bg === 'sfumaturaFucsia') {
    drawIridescentBg(ctx, f, {
      style: bg === 'sfumaturaFucsia' ? 'fucsia' : props.iriStile ?? 'raggiera',
      time: f.time,
      seed: props.iriSeme ?? 7,
      speed: props.iriVelocita ?? 1,
      rays: 0.85,
    });
    return;
  }
  if (bg === 'duotono' || bg === 'foto') return;
  ctx.fillStyle = resolveColor(bg, PALETTE.viola);
  ctx.fillRect(0, 0, f.width, f.height);
  void env;
}

/** Inizio dell'animazione, in frame. */
export function t0(f: FrameInfo, props: Props, env: Env) {
  return env.sec(props.ritardo ?? 0);
}

/** Avanzamento d'uscita 0-1 negli ultimi istanti, se il finale lo prevede. */
export function exitProgress(f: FrameInfo, props: Props, seconds = 0.6) {
  if (props.uscita !== 'dissolvenza') return 0;
  const n = Math.round(seconds * f.fps);
  return clamp((f.frame - (f.durationInFrames - n)) / n);
}

/** Testata: logotipo ed etichetta in alto a sinistra (p. 16, 41). Restituisce il fondo della testata. */
export function drawTestata(ctx: CanvasRenderingContext2D, f: FrameInfo, props: Props, env: Env, ink: string) {
  const s = f.s;
  const x = f.safe.left;
  const y = f.safe.top;
  const cap = LOGO_CAP_PX * s;
  const start = t0(f, props, env);
  const p = Easing.out(clamp((f.frame - start) / env.sec(0.5)));
  const out = exitProgress(f, props);
  const a = p * (1 - out);
  if (a <= 0) return y + cap;
  ctx.save();
  ctx.globalAlpha *= a;
  let lx = x;
  if (props.marchio !== false) {
    const w = drawLogotype(ctx, x, y - (1 - p) * 10 * s, cap, ink);
    lx = x + w + cap * LABEL_GAP_X;
  }
  if (props.etichetta) {
    const lp = Easing.out(clamp((f.frame - start - env.sec(0.15)) / env.sec(0.5)));
    drawLabel(ctx, props.etichetta, lx + (1 - lp) * 16 * s, y + cap / 2, s, ink, lp);
  }
  ctx.restore();
  return y + Math.max(cap, 55 * s / 2 + cap / 2);
}

/** Freccia in basso a sinistra. */
export function drawFreccia(ctx: CanvasRenderingContext2D, f: FrameInfo, props: Props, env: Env, ink: string, appearAt: number) {
  if (!props.freccia) return;
  const p = clamp((f.frame - appearAt) / env.sec(0.5)) * (1 - exitProgress(f, props));
  drawArrow(ctx, f.safe.left, f.height - f.safe.bottom - 39 * f.s, f.s, ink, p);
}
