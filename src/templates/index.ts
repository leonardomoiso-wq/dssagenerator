import type { Composition } from '../engine/types';
import { FEED } from './feed';
import { exitProgress } from './common';
import { drawLayers, libera } from './libera';
import { VIDEO } from './video';

/**
 * Ogni modello accetta elementi in più, disegnati sopra la composizione: gli stessi livelli
 * della composizione libera.
 */
function withExtras(c: Composition): Composition {
  return {
    ...c,
    fields: [...c.fields, { type: 'layers', key: 'extra', label: 'Elementi in più', group: 'Elementi in più', default: [] }],
    render(ctx, f, props, env) {
      c.render(ctx, f, props, env);
      if (props.extra?.length) {
        const symbolInTemplate = c.fields.some((x) => x.type === 'symbol') && props.mostraSimbolo !== false && props.simbolo !== 'nessuno';
        if (symbolInTemplate && props.extra.some((l: { type: string; hidden?: boolean }) => l.type === 'simbolo' && !l.hidden))
          env.warn('Un simbolo in più si aggiunge a quello del modello: in una copertina social va un solo simbolo (p. 40).');
        drawLayers(ctx, f, props.extra, env, exitProgress(f, props));
      }
    },
  };
}

export const COMPOSITIONS: Composition[] = [...FEED.map(withExtras), ...VIDEO.map(withExtras), libera];

export function getComposition(id: string): Composition {
  return COMPOSITIONS.find((c) => c.id === id) ?? COMPOSITIONS[0];
}

/** Durata imposta dal modello (in secondi), quando dipende dai parametri. */
export function autoDuration(comp: Composition, props: Record<string, any>): number | null {
  if (comp.id === 'sette-ambiti') return 7 * (props.perAmbito ?? 3);
  return null;
}
