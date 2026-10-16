// I sette simboli degli ambiti (manuale p. 36-40) e il vocabolario delle forme (p. 35).
//
// Le forme sono ricostruite come primitive geometriche (cerchio, semicerchio, quarto di
// cerchio, corona) su un riquadro di 100 unità, misurando i componenti del file Figma
// riprodotti nel manuale. Ogni simbolo è una lista di parti: così le parti si animano una
// per una, mentre la forma finale resta quella del simbolo (non si ruota, non si deforma).

const PI = Math.PI;

export type Part =
  | { k: 'disc'; cx: number; cy: number; r: number }
  /** Settore circolare: semicerchio (ampiezza π) o quarto di cerchio (π/2). */
  | { k: 'sector'; cx: number; cy: number; r: number; a0: number; a1: number }
  /** Corona (anello) o settore di corona. */
  | { k: 'ring'; cx: number; cy: number; R: number; r: number; a0: number; a1: number }
  /** Ciotola: semiellisse con il lato piatto in alto. */
  | { k: 'bowl'; cx: number; cy: number; rx: number; ry: number };

export type SymbolId = 'for' | 'with' | 'service' | 'about' | 'space' | 'communication' | 'systemic';

export interface SymbolDef {
  id: SymbolId;
  n: number;
  name: string;
  short: string;
  definition: string;
  parts: Part[];
}

export const SYMBOLS: SymbolDef[] = [
  {
    id: 'for',
    n: 1,
    name: 'Design for Food',
    short: 'for',
    definition:
      'La progettazione di oggetti e accessori per trasformare, cucinare, consumare, contenere e preservare il cibo.',
    parts: [
      { k: 'bowl', cx: 50, cy: 1.4, rx: 43, ry: 43 },
      { k: 'bowl', cx: 50, cy: 45.2, rx: 43, ry: 31.5 },
      { k: 'bowl', cx: 50, cy: 76.7, rx: 43, ry: 15.4 },
      { k: 'bowl', cx: 50, cy: 92.1, rx: 43, ry: 6.5 },
    ],
  },
  {
    id: 'with',
    n: 2,
    name: 'Design with Food',
    short: 'with',
    definition:
      'La progettazione di artefatti edibili per la produzione in serie e artigianale con i relativi nuovi modi di consumo.',
    parts: [
      { k: 'disc', cx: 50, cy: 50, r: 25 },
      { k: 'sector', cx: 50, cy: 25, r: 25, a0: PI, a1: 2 * PI },
      { k: 'sector', cx: 75, cy: 50, r: 25, a0: -PI / 2, a1: PI / 2 },
      { k: 'sector', cx: 50, cy: 75, r: 25, a0: 0, a1: PI },
      { k: 'sector', cx: 25, cy: 50, r: 25, a0: PI / 2, a1: (3 * PI) / 2 },
      { k: 'sector', cx: 25, cy: 25, r: 25, a0: PI, a1: (3 * PI) / 2 },
      { k: 'sector', cx: 75, cy: 25, r: 25, a0: (3 * PI) / 2, a1: 2 * PI },
      { k: 'sector', cx: 75, cy: 75, r: 25, a0: 0, a1: PI / 2 },
      { k: 'sector', cx: 25, cy: 75, r: 25, a0: PI / 2, a1: PI },
    ],
  },
  {
    id: 'service',
    n: 3,
    name: 'Food Service & Eating Design',
    short: 'service',
    definition: 'La progettazione di servizi ed esperienze per la gestione, la vendita e il consumo del cibo.',
    parts: [
      { k: 'sector', cx: 50, cy: 96.2, r: 29.3, a0: PI, a1: 2 * PI },
      { k: 'sector', cx: 50, cy: 67.1, r: 48.2, a0: PI, a1: 2 * PI },
      { k: 'disc', cx: 50, cy: 11.6, r: 7.4 },
    ],
  },
  {
    id: 'about',
    n: 4,
    name: 'Design about Food',
    short: 'about',
    definition:
      'La progettazione di prodotti, servizi e sistemi che, ispirati al mondo del cibo, enfatizzano messaggi e significati.',
    parts: [
      { k: 'sector', cx: 9.5, cy: 50, r: 28.5, a0: -PI / 2, a1: PI / 2 },
      { k: 'ring', cx: 9.5, cy: 50, R: 48.5, r: 32.5, a0: 0, a1: PI / 2 },
      { k: 'ring', cx: 90.5, cy: 50, R: 48.5, r: 32.5, a0: PI, a1: (3 * PI) / 2 },
      { k: 'sector', cx: 90.5, cy: 50, r: 28.5, a0: PI / 2, a1: (3 * PI) / 2 },
    ],
  },
  {
    id: 'space',
    n: 5,
    name: 'Food Space & Interior Design for Food',
    short: 'space',
    definition: 'La progettazione degli spazi per la trasformazione, la vendita e il consumo del cibo.',
    parts: [
      { k: 'ring', cx: 50, cy: 50, R: 48, r: 34, a0: 0, a1: 2 * PI },
      { k: 'ring', cx: 50, cy: 50, R: 30, r: 17, a0: 0, a1: 2 * PI },
      { k: 'disc', cx: 50, cy: 50, r: 13 },
    ],
  },
  {
    id: 'communication',
    n: 6,
    name: 'Communication for Food',
    short: 'communication',
    definition:
      'La progettazione di strategie e azioni comunicative in ogni forma e tecnologia per valorizzare il sistema alimentare.',
    parts: [
      { k: 'sector', cx: 0, cy: 0, r: 50, a0: 0, a1: PI / 2 },
      { k: 'ring', cx: 100, cy: 50, R: 50, r: 25, a0: PI, a1: (3 * PI) / 2 },
      { k: 'ring', cx: 50, cy: 50, R: 50, r: 25, a0: 0, a1: PI / 2 },
      { k: 'ring', cx: 50, cy: 100, R: 50, r: 25, a0: PI, a1: (3 * PI) / 2 },
    ],
  },
  {
    id: 'systemic',
    n: 7,
    name: 'Systemic & Social Food Design',
    short: 'systemic',
    definition: 'La progettazione della sostenibilità ambientale, economica e sociale del sistema cibo.',
    parts: [
      { k: 'ring', cx: 57.5, cy: 50, R: 50, r: 35, a0: PI / 2, a1: (3 * PI) / 2 },
      { k: 'sector', cx: 57.5, cy: 50, r: 35, a0: -PI / 2, a1: PI / 2 },
      { k: 'sector', cx: 57.5, cy: 50, r: 17.5, a0: PI / 2, a1: (3 * PI) / 2 },
    ],
  },
];

export const SYMBOL_IDS = SYMBOLS.map((s) => s.id);

export function getSymbol(id: string): SymbolDef {
  return SYMBOLS.find((s) => s.id === id) ?? SYMBOLS[0];
}

// --- Vocabolario delle forme (p. 35): per le composizioni, su una cella di 100 unità ---

export type FormId =
  | 'cerchio'
  | 'semicerchio'
  | 'coppia'
  | 'quarto'
  | 'ciotole'
  | 'corone'
  | 'quartoCorona'
  | 'mezzaCorona';

export const FORMS: { id: FormId; label: string; parts: Part[] }[] = [
  { id: 'cerchio', label: 'Cerchio', parts: [{ k: 'disc', cx: 50, cy: 50, r: 50 }] },
  { id: 'semicerchio', label: 'Semicerchio', parts: [{ k: 'sector', cx: 50, cy: 100, r: 50, a0: PI, a1: 2 * PI }] },
  {
    id: 'coppia',
    label: 'Coppia di semicerchi',
    parts: [
      { k: 'sector', cx: 50, cy: 47, r: 47, a0: PI, a1: 2 * PI },
      { k: 'sector', cx: 50, cy: 53, r: 47, a0: 0, a1: PI },
    ],
  },
  { id: 'quarto', label: 'Quarto di cerchio', parts: [{ k: 'sector', cx: 0, cy: 100, r: 100, a0: (3 * PI) / 2, a1: 2 * PI }] },
  { id: 'ciotole', label: 'Pila di ciotole', parts: SYMBOLS[0].parts },
  {
    id: 'corone',
    label: 'Corone concentriche',
    parts: [
      { k: 'ring', cx: 50, cy: 50, R: 50, r: 38, a0: 0, a1: 2 * PI },
      { k: 'ring', cx: 50, cy: 50, R: 30, r: 20, a0: 0, a1: 2 * PI },
      { k: 'disc', cx: 50, cy: 50, r: 12 },
    ],
  },
  { id: 'quartoCorona', label: 'Quarto di corona', parts: [{ k: 'ring', cx: 0, cy: 100, R: 100, r: 50, a0: (3 * PI) / 2, a1: 2 * PI }] },
  { id: 'mezzaCorona', label: 'Mezza corona', parts: [{ k: 'ring', cx: 50, cy: 100, R: 50, r: 25, a0: PI, a1: 2 * PI }] },
];

export function getForm(id: string) {
  return FORMS.find((f) => f.id === id) ?? FORMS[0];
}

/** Percorso di una parte, in unità del riquadro. */
export function partPath(p: Part, path = new Path2D()): Path2D {
  switch (p.k) {
    case 'disc':
      path.moveTo(p.cx + p.r, p.cy);
      path.arc(p.cx, p.cy, p.r, 0, 2 * PI);
      path.closePath();
      break;
    case 'sector':
      path.moveTo(p.cx, p.cy);
      path.arc(p.cx, p.cy, p.r, p.a0, p.a1);
      path.closePath();
      break;
    case 'ring': {
      const full = Math.abs(p.a1 - p.a0) >= 2 * PI - 1e-6;
      if (full) {
        path.moveTo(p.cx + p.R, p.cy);
        path.arc(p.cx, p.cy, p.R, 0, 2 * PI);
        path.closePath();
        path.moveTo(p.cx + p.r, p.cy);
        path.arc(p.cx, p.cy, p.r, 2 * PI, 0, true);
        path.closePath();
      } else {
        path.moveTo(p.cx + p.R * Math.cos(p.a0), p.cy + p.R * Math.sin(p.a0));
        path.arc(p.cx, p.cy, p.R, p.a0, p.a1);
        path.lineTo(p.cx + p.r * Math.cos(p.a1), p.cy + p.r * Math.sin(p.a1));
        path.arc(p.cx, p.cy, p.r, p.a1, p.a0, true);
        path.closePath();
      }
      break;
    }
    case 'bowl':
      path.moveTo(p.cx + p.rx, p.cy);
      path.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, PI);
      path.closePath();
      break;
  }
  return path;
}

/** Punto attorno a cui la parte cresce e ruota: il centro del cerchio da cui nasce. */
export function partPivot(p: Part): [number, number] {
  return [p.cx, p.cy];
}

/** Baricentro approssimato della parte (per ordinare e sfalsare le animazioni). */
export function partCentroid(p: Part): [number, number] {
  switch (p.k) {
    case 'disc':
      return [p.cx, p.cy];
    case 'bowl':
      return [p.cx, p.cy + (p.ry * 4) / (3 * PI)];
    case 'sector':
    case 'ring': {
      const am = (p.a0 + p.a1) / 2;
      const span = Math.abs(p.a1 - p.a0);
      if (span >= 2 * PI - 1e-6) return [p.cx, p.cy];
      const R = p.k === 'sector' ? p.r : p.R;
      const r = p.k === 'sector' ? 0 : p.r;
      const d = ((2 * Math.sin(span / 2)) / (3 * (span / 2))) * ((R ** 3 - r ** 3) / (R ** 2 - r ** 2));
      return [p.cx + d * Math.cos(am), p.cy + d * Math.sin(am)];
    }
  }
}

/** Riquadro occupato dalle parti (unità). */
export function partsBounds(parts: Part[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const p of parts) {
    if (p.k === 'bowl') {
      add(p.cx - p.rx, p.cy);
      add(p.cx + p.rx, p.cy + p.ry);
      continue;
    }
    const R = p.k === 'disc' ? p.r : p.k === 'sector' ? p.r : p.R;
    const a0 = p.k === 'disc' ? 0 : p.a0;
    const a1 = p.k === 'disc' ? 2 * PI : p.a1;
    if (p.k === 'sector') add(p.cx, p.cy);
    if (p.k === 'ring') {
      add(p.cx + p.r * Math.cos(a0), p.cy + p.r * Math.sin(a0));
      add(p.cx + p.r * Math.cos(a1), p.cy + p.r * Math.sin(a1));
    }
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      add(p.cx + R * Math.cos(a), p.cy + R * Math.sin(a));
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
