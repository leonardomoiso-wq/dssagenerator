import type { FormatSpec, Safe } from '../brand/tokens';

// --- Schema dei parametri: genera il pannello di controllo, come gli schemi zod in Remotion ---

interface FieldBase {
  key: string;
  label: string;
  group?: string;
  help?: string;
  /** Mostra il campo solo se la condizione è vera. */
  when?: (props: Props) => boolean;
  /** Campo disponibile solo in modalità libera (fuori dalle regole del manuale). */
  free?: boolean;
}

export type Field =
  | (FieldBase & { type: 'text'; default: string; placeholder?: string })
  | (FieldBase & { type: 'textarea'; default: string; rows?: number })
  | (FieldBase & { type: 'number'; default: number; min: number; max: number; step?: number; unit?: string })
  | (FieldBase & { type: 'select'; default: string; options: { value: string; label: string }[] })
  | (FieldBase & {
      type: 'color';
      default: string;
      /** Valori speciali ammessi oltre ai colori: auto, iridescente, ecc. */
      extra?: { value: string; label: string }[];
      /** Limita la scelta a questi nomi della palette. */
      only?: string[];
    })
  | (FieldBase & { type: 'symbol'; default: string; allowNone?: boolean })
  | (FieldBase & { type: 'boolean'; default: boolean })
  | (FieldBase & { type: 'image'; default: string })
  | (FieldBase & { type: 'svg'; default: string })
  | (FieldBase & { type: 'layers'; default: Layer[] });

export type Props = Record<string, any>;

export interface Layer {
  id: string;
  type: string;
  name: string;
  hidden?: boolean;
  props: Props;
}

// --- Contesto di rendering ---

export interface FrameInfo {
  frame: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  /** Scala dei corpi rispetto a una tavola larga 1080 px. */
  s: number;
  safe: Safe;
  format: FormatSpec;
  /** Secondi dall'inizio. */
  time: number;
}

export interface Env {
  /** Modalità manuale: limita le scelte alle regole verificate. */
  strict: boolean;
  /** Segnala un problema di aderenza al manuale. */
  warn: (msg: string) => void;
  /** Immagini già caricate, per chiave (data URL). */
  image: (src: string | undefined) => HTMLImageElement | null;
  /** Frame da secondi, tenendo conto della velocità scelta. */
  sec: (s: number) => number;
  /** Il carattere ufficiale è caricato? */
  fontsReady: { basier: boolean; wotfard: boolean };
}

export interface Composition {
  id: string;
  name: string;
  /** Riferimento al manuale (composizione del feed, pagina). */
  source: string;
  description: string;
  category: 'Feed' | 'Video' | 'Story' | 'Libera';
  /** Formato consigliato all'apertura. */
  defaultFormat: string;
  defaultDuration: number;
  fields: Field[];
  render: (ctx: CanvasRenderingContext2D, f: FrameInfo, props: Props, env: Env) => void;
}

export function defaultsOf(fields: Field[]): Props {
  const out: Props = {};
  for (const f of fields) out[f.key] = structuredClone(f.default);
  return out;
}

/** Progetto salvabile: tutto ciò che serve per rigenerare il video. */
export interface Project {
  version: 1;
  composition: string;
  format: string;
  fps: number;
  duration: number;
  speed: number;
  strict: boolean;
  props: Props;
}
