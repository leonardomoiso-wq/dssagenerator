import type { Composition } from '../engine/types';
import { FEED } from './feed';
import { libera } from './libera';
import { VIDEO } from './video';

export const COMPOSITIONS: Composition[] = [...FEED, ...VIDEO, libera];

export function getComposition(id: string): Composition {
  return COMPOSITIONS.find((c) => c.id === id) ?? COMPOSITIONS[0];
}

/** Durata imposta dal modello (in secondi), quando dipende dai parametri. */
export function autoDuration(comp: Composition, props: Record<string, any>): number | null {
  if (comp.id === 'sette-ambiti') return 7 * (props.perAmbito ?? 3);
  return null;
}
