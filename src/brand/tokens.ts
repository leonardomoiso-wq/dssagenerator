// Valori del manuale della brand identity DSSA v1.2 (pagine tra parentesi).

/** Palette sRGB (p. 20-21). I valori Display P3 (#6F5FEB ecc.) non si usano. */
export const PALETTE = {
  viola: '#705EF2',
  fucsia: '#FF4A75',
  verde: '#4ED1A6',
  giallo: '#FBDB4B',
  nero: '#111114',
  bianco: '#FFFFFF',
} as const;

export type PaletteName = keyof typeof PALETTE;
export const PALETTE_NAMES = Object.keys(PALETTE) as PaletteName[];
export const TINTS: PaletteName[] = ['viola', 'fucsia', 'verde', 'giallo'];

export const PALETTE_LABEL: Record<PaletteName, string> = {
  viola: 'Viola',
  fucsia: 'Fucsia',
  verde: 'Verde',
  giallo: 'Giallo',
  nero: 'Nero',
  bianco: 'Bianco',
};

/** Colori derivati del duotono (p. 22): chiaro in Multiply, scuro in Screen, velatura scuro al 28%. */
export const DUOTONE: Record<'viola' | 'fucsia' | 'verde' | 'giallo', { chiaro: string; scuro: string }> = {
  viola: { chiaro: '#8375F2', scuro: '#120C4A' },
  fucsia: { chiaro: '#FF4A75', scuro: '#2A0612' },
  verde: { chiaro: '#4ED1A6', scuro: '#06281C' },
  giallo: { chiaro: '#FBDB4B', scuro: '#2B2204' },
};
export const VELATURA_ALPHA = 0.28;

/** Colore di servizio: lilla dei segnaposto (p. 22). */
export const LILLA_SEGNAPOSTO = '#DDD9F5';

/**
 * Testo sopra ogni fondo (p. 21, 24): bianco su viola e nero, nero su fucsia, verde, giallo e bianco.
 * Su duotono, sfumature e iridescente: bianco (p. 15, 34).
 */
export const TEXT_ON: Record<PaletteName, PaletteName> = {
  viola: 'bianco',
  fucsia: 'nero',
  verde: 'nero',
  giallo: 'nero',
  nero: 'bianco',
  bianco: 'nero',
};

/** Colore di un valore di colore: nome della palette o esadecimale libero. */
export type ColorValue = PaletteName | `#${string}`;

export function resolveColor(c: ColorValue | string | undefined, fallback: string = PALETTE.nero): string {
  if (!c) return fallback;
  if (c in PALETTE) return PALETTE[c as PaletteName];
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c;
  return fallback;
}

export function isPaletteColor(c: string): boolean {
  if (c in PALETTE) return true;
  const up = c.toUpperCase();
  return Object.values(PALETTE).includes(up as never) || Object.values(DUOTONE).some((d) => d.chiaro === up || d.scuro === up);
}

export function paletteNameOf(hex: string): PaletteName | undefined {
  const up = hex.toUpperCase();
  return PALETTE_NAMES.find((n) => PALETTE[n] === up);
}

// --- Contrasto WCAG 2.1 (p. 24) ---

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Testo grande per WCAG: da 18 pt (24 px) o da 14 pt in grassetto (≈18,7 px). */
export function minContrastFor(sizePx: number, weight: number) {
  const large = sizePx >= 24 || (weight >= 600 && sizePx >= 18.7);
  return large ? 3 : 4.5;
}

// --- Formati (p. 54, 58) ---

export interface Safe {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FormatSpec {
  id: string;
  label: string;
  platform: 'Instagram' | 'LinkedIn';
  width: number;
  height: number;
  /** Margini sicuri: dove il testo può stare. */
  safe: Safe;
  /** Guide da mostrare in anteprima (non esportate). */
  guides: { label: string; rect: [number, number, number, number]; kind: 'taglio' | 'interfaccia' }[];
  note: string;
}

const M = 88; // margine dei modelli social (p. 54)

export const FORMATS: FormatSpec[] = [
  {
    id: 'ig-post',
    label: 'Post e carosello · 1080 × 1350',
    platform: 'Instagram',
    width: 1080,
    height: 1350,
    safe: { top: M, right: M, bottom: M, left: M },
    guides: [
      { label: 'Fuori dalla griglia del profilo (3:4)', rect: [0, 0, 34, 1350], kind: 'taglio' },
      { label: '', rect: [1046, 0, 34, 1350], kind: 'taglio' },
    ],
    note: 'Nella griglia del profilo il post si vede in 3:4: restano fuori 34 px per lato.',
  },
  {
    id: 'ig-story',
    label: 'Story e Reel · 1080 × 1920',
    platform: 'Instagram',
    width: 1080,
    height: 1920,
    safe: { top: 250, right: M, bottom: 340, left: M },
    guides: [
      { label: 'Zona dell’interfaccia · in alto', rect: [0, 0, 1080, 250], kind: 'interfaccia' },
      { label: 'Zona dell’interfaccia · in basso', rect: [0, 1580, 1080, 340], kind: 'interfaccia' },
    ],
    note: 'Nessun testo nei 250 px in alto e nei 340 px in basso; angolo in alto a destra libero.',
  },
  {
    id: 'ig-reel-cover',
    label: 'Copertina del Reel · 1080 × 1920',
    platform: 'Instagram',
    width: 1080,
    height: 1920,
    safe: { top: 240 + M, right: M, bottom: 240 + M, left: M },
    guides: [
      { label: 'Fuori dalla griglia del profilo', rect: [0, 0, 1080, 240], kind: 'taglio' },
      { label: 'Fuori dalla griglia del profilo', rect: [0, 1680, 1080, 240], kind: 'taglio' },
    ],
    note: 'Di una copertina Reel si vede la fascia tra 240 e 1680 px.',
  },
  {
    id: 'ig-square',
    label: 'Quadrato · 1080 × 1080',
    platform: 'Instagram',
    width: 1080,
    height: 1080,
    safe: { top: M, right: M, bottom: M, left: M },
    guides: [],
    note: 'Formato non previsto dai modelli: utile per riuso e anteprime.',
  },
  {
    id: 'li-portrait',
    label: 'Verticale 4:5 · 1080 × 1350',
    platform: 'LinkedIn',
    width: 1080,
    height: 1350,
    safe: { top: M, right: M, bottom: M, left: M },
    guides: [],
    note: 'Formato dei caroselli LinkedIn (p. 58). Registro in terza persona.',
  },
  {
    id: 'li-square',
    label: 'Quadrato · 1080 × 1080',
    platform: 'LinkedIn',
    width: 1080,
    height: 1080,
    safe: { top: M, right: M, bottom: M, left: M },
    guides: [],
    note: 'Video quadrato per il feed LinkedIn.',
  },
  {
    id: 'li-landscape',
    label: 'Orizzontale 16:9 · 1920 × 1080',
    platform: 'LinkedIn',
    width: 1920,
    height: 1080,
    safe: { top: M, right: M, bottom: M, left: M },
    guides: [],
    note: 'Video orizzontale per LinkedIn e presentazioni.',
  },
];

export function getFormat(id: string): FormatSpec {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

// --- Tipografia (p. 25-28) ---

export const FONT_TITLE = 'Basier Circle';
export const FONT_TEXT = 'Wotfard';
export const FONT_FALLBACK = 'Karla';

/** Stili di testo dei modelli social, riferiti a tavole larghe 1080 px (p. 28). */
export const TYPE = {
  titolo124: { size: 124, weight: 600, lineHeight: 1.04, tracking: -0.02 },
  titolo104: { size: 104, weight: 600, lineHeight: 1.04, tracking: -0.02 },
  titolo96: { size: 96, weight: 600, lineHeight: 1.04, tracking: -0.02 },
  titolo80: { size: 80, weight: 600, lineHeight: 1.04, tracking: -0.02 },
  testo46: { size: 46, weight: 400, lineHeight: 1.22, tracking: 0 },
  testo38: { size: 38, weight: 400, lineHeight: 1.24, tracking: 0 },
  etichetta30: { size: 30, weight: 600, lineHeight: 1.0, tracking: 0 },
  fonte26: { size: 26, weight: 400, lineHeight: 1.25, tracking: 0 },
} as const;

export type TypeStyleName = keyof typeof TYPE;
export interface TypeStyle {
  size: number;
  weight: number;
  lineHeight: number;
  tracking: number;
}

/** Corpo minimo nelle tavole social: 26 px (p. 9, 28). */
export const MIN_TEXT_PX = 26;

/** Scelta automatica del corpo del titolo per numero di battute (p. 28). */
export function autoTitleStyle(text: string): TypeStyleName {
  const n = text.replace(/\s+/g, ' ').trim().length;
  if (n <= 20) return 'titolo124';
  if (n <= 34) return 'titolo96';
  return 'titolo80';
}

// --- Marchio (p. 13, 16) ---

/** Nei modelli social il logotipo è alto 29 px, a 88 px dal margine sinistro (p. 16). */
export const LOGO_CAP_PX = 29;
/** Distanza tra logotipo ed etichetta: 0,86 x (p. 16). */
export const LABEL_GAP_X = 0.86;
/** Lockup: interlinea del monogramma 0,26 x; distanza dalla denominazione 0,68 x; maiuscola della denominazione 0,47 x (p. 13). */
export const LOCKUP = { lineGap: 0.26, nameGap: 0.68, nameCap: 0.47 };

export const DENOMINAZIONE = ['Design Sostenibile', 'per il Sistema', 'Alimentare'];
export const ATENEI = ['Università di Parma', 'Politecnico di Torino'];
export const ACCOUNT = 'dssa_designandfood';
