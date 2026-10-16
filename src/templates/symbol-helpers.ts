import { breath, drawParts, partStates, type Fill, type ShapeMotion } from '../brand/draw';
import { getSymbol, type Part } from '../brand/symbols';
import { isPaletteColor, PALETTE, resolveColor } from '../brand/tokens';
import type { Env, Field, FrameInfo, Props } from '../engine/types';
import { IRI_STYLES } from './common';

export const FILL_OPTIONS = [
  { value: 'piatto', label: 'Piatto' },
  { value: 'iridescente', label: 'Iridescente' },
  { value: 'opaco', label: 'Opaco (volume)' },
];

export function symbolFields(o: { def?: string; fill?: string; color?: string; size?: number; group?: string; sizeLabel?: string } = {}): Field[] {
  const group = o.group ?? 'Simbolo';
  return [
    { type: 'symbol', key: 'simbolo', label: 'Ambito', group, default: o.def ?? 'with' },
    { type: 'select', key: 'riempimento', label: 'Versione', group, default: o.fill ?? 'piatto', options: FILL_OPTIONS },
    {
      type: 'color',
      key: 'coloreSimbolo',
      label: 'Colore del simbolo',
      group,
      default: o.color ?? 'auto',
      extra: [{ value: 'auto', label: 'Come i testi' }],
      when: (p) => p.riempimento !== 'iridescente',
    },
    {
      type: 'select',
      key: 'simboloIri',
      label: 'Materia',
      group,
      default: 'raggiera',
      options: IRI_STYLES,
      when: (p) => p.riempimento === 'iridescente',
    },
    { type: 'number', key: 'simboloSeme', label: 'Variante della materia', group, default: 3, min: 0, max: 99, step: 1, when: (p) => p.riempimento === 'iridescente' },
    { type: 'number', key: 'dimensione', label: o.sizeLabel ?? 'Dimensione', group, default: o.size ?? 60, min: 10, max: 160, step: 1, unit: '% della larghezza' },
    {
      type: 'select',
      key: 'ordine',
      label: 'Ordine delle parti',
      group: 'Animazione',
      default: 'parti',
      options: [
        { value: 'parti', label: 'Come nel disegno' },
        { value: 'alto', label: 'Dall’alto' },
        { value: 'centro', label: 'Dal centro' },
      ],
    },
    { type: 'number', key: 'durataParti', label: 'Durata per parte', group: 'Animazione', default: 0.7, min: 0.1, max: 3, step: 0.05, unit: 's' },
    { type: 'number', key: 'sfalsamento', label: 'Sfalsamento tra le parti', group: 'Animazione', default: 0.09, min: 0, max: 1, step: 0.01, unit: 's' },
  ];
}

export function fillOf(props: Props, f: FrameInfo, ink: string, env: Env): Fill {
  const mode = props.riempimento ?? 'piatto';
  const raw: string = props.coloreSimbolo ?? 'auto';
  const color = raw === 'auto' ? ink : resolveColor(raw, PALETTE.bianco);
  if (raw !== 'auto' && !isPaletteColor(color)) env.warn('Simbolo in un colore fuori dalla palette: i simboli non si ricolorano fuori dalle varianti previste (p. 40).');
  return {
    mode,
    color,
    iri: { style: props.simboloIri ?? 'raggiera', time: f.time, seed: props.simboloSeme ?? 3, speed: props.iriVelocita ?? 1, rays: 0.9 },
  };
}

export function motionOf(props: Props, f: FrameInfo, env: Env, start: number, out = 0): ShapeMotion {
  return {
    anim: props.animForme ?? 'assembla',
    frame: f.frame,
    fps: f.fps,
    start,
    dur: env.sec(props.durataParti ?? 0.7),
    stagger: env.sec(props.sfalsamento ?? 0.09),
    easing: props.curva,
    loop: props.loop,
    order: props.ordine,
    out,
  };
}

/** Disegna un simbolo animato nel riquadro quadrato x, y, size. */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  id: string | Part[],
  x: number,
  y: number,
  size: number,
  fill: Fill,
  motion?: ShapeMotion,
) {
  const parts = typeof id === 'string' ? getSymbol(id).parts : id;
  const states = motion ? partStates(parts, motion) : undefined;
  drawParts(ctx, parts, x, y, size, fill, states, { globalScale: motion ? breath(motion) : 1 });
}

/** Fine dell'ingresso del simbolo, in frame. */
export function symbolEnd(id: string, m: ShapeMotion) {
  const n = getSymbol(id).parts.length;
  return m.start + (n - 1) * m.stagger + m.dur;
}
