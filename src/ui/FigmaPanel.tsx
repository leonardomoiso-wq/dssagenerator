import { useEffect, useRef, useState } from 'react';
import { importScene, isScene, matchesScene, type FigmaScene, type ImportReport } from '../engine/figma';
import type { Project } from '../engine/types';

const AUTO_KEY = 'dssa-figma-auto';

/** Collegamento con il plugin: eventi dal server di sviluppo (npm run dev). */
export function useFigmaBridge(onScene: (s: FigmaScene) => void) {
  const [live, setLive] = useState<boolean | null>(null);
  const seen = useRef<number>(0);
  const handler = useRef(onScene);
  handler.current = onScene;
  useEffect(() => {
    if (typeof EventSource === 'undefined') return setLive(false);
    let es: EventSource | null = new EventSource('api/figma/eventi');
    let first = true;
    es.onmessage = async (ev) => {
      setLive(true);
      const msg = JSON.parse(ev.data);
      if (msg.hello) {
        // All'apertura non si ricarica l'ultima scena già vista in una sessione precedente.
        seen.current = msg.stamp ?? 0;
        first = false;
        return;
      }
      if (first || !msg.stamp || msg.stamp <= seen.current) return;
      seen.current = msg.stamp;
      try {
        const r = await fetch('api/figma/ultima', { cache: 'no-store' });
        const scene = await r.json();
        if (isScene(scene)) handler.current(scene);
      } catch {
        /* scena non leggibile */
      }
    };
    es.onerror = () => {
      // Senza server di sviluppo (sito pubblicato) resta l'importazione dei file .dssa.json.
      setLive(false);
      es?.close();
      es = null;
    };
    return () => es?.close();
  }, []);
  return live;
}

export function readSceneFile(file: File): Promise<FigmaScene> {
  return file.text().then((t) => {
    const data = JSON.parse(t);
    if (!isScene(data)) throw new Error('Il file non è una scena esportata dal plugin DSSA → Compositore.');
    return data;
  });
}

export function autoUpdateEnabled() {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Arrivo di una scena: aggiornamento automatico se il progetto viene dalle stesse tavole. */
export function handleIncoming(scene: FigmaScene, project: Project, apply: (r: ImportReport) => void, ask: (s: FigmaScene) => void) {
  if (autoUpdateEnabled() && matchesScene(project, scene)) apply(importScene(scene, project));
  else ask(scene);
}

export function reportText(r: ImportReport) {
  const what = r.frames > 1 ? `${r.frames} tavole` : 'la tavola';
  if (r.mode === 'nuovo') return `Da Figma: ${what}, ${r.added} elementi con un’animazione di partenza.`;
  const parts = [`${r.updated} aggiornati`];
  if (r.added) parts.push(`${r.added} nuovi`);
  if (r.removed) parts.push(`${r.removed} tolti`);
  return `Aggiornato da Figma: ${parts.join(', ')}. Le animazioni sono rimaste.`;
}

export function FigmaDialog({
  live,
  pending,
  project,
  onApply,
  onClose,
  onNotice,
}: {
  live: boolean | null;
  pending: FigmaScene | null;
  project: Project;
  onApply: (r: ImportReport) => void;
  onClose: () => void;
  onNotice: (s: string) => void;
}) {
  const [scene, setScene] = useState<FigmaScene | null>(pending);
  const [auto, setAuto] = useState(autoUpdateEnabled());
  const [drag, setDrag] = useState(false);
  useEffect(() => setScene(pending), [pending]);
  const matches = scene ? matchesScene(project, scene) : false;

  const load = async (f: File | undefined) => {
    if (!f) return;
    try {
      setScene(await readSceneFile(f));
    } catch (e) {
      onNotice((e as Error).message);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="card wide figma" onClick={(e) => e.stopPropagation()}>
        <h2>Da Figma</h2>
        <p className={'status ' + (live ? 'ok' : 'off')}>
          {live
            ? '● Collegato: il plugin può inviare le tavole direttamente.'
            : '○ Collegamento diretto non attivo (serve «npm run dev»). Si possono comunque trascinare qui i file .dssa.json scaricati dal plugin.'}
        </p>
        {scene ? (
          <div className="incoming">
            <b>
              {scene.frames.length > 1 ? `${scene.frames.length} tavole` : `«${scene.frames[0]?.name}»`}
              {scene.fileName ? ` · ${scene.fileName}` : ''}
            </b>
            <ul>
              {scene.frames.map((fr) => (
                <li key={fr.id}>
                  {fr.name} · {Math.round(fr.width)} × {Math.round(fr.height)} · {fr.nodes.length} elementi
                  <small> ({summary(fr.nodes)})</small>
                </li>
              ))}
            </ul>
            {!!scene.warnings?.length && (
              <ul className="warnings">
                {scene.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="row end">
              {matches && (
                <button className="btn primary" onClick={() => onApply(importScene(scene, project))}>
                  Aggiorna questo progetto (le animazioni restano)
                </button>
              )}
              <button className={'btn' + (matches ? ' ghost' : ' primary')} onClick={() => onApply(importScene(scene, null))}>
                Apri come nuovo progetto
              </button>
            </div>
          </div>
        ) : (
          <label
            className={'drop big' + (drag ? ' drag' : '')}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => (e.preventDefault(), setDrag(false), load(e.dataTransfer.files[0]))}
          >
            Trascina qui un file .dssa.json esportato dal plugin, oppure inviane uno da Figma
            <input type="file" accept=".json,application/json" hidden onChange={(e) => load(e.target.files?.[0])} />
          </label>
        )}
        <label className="check small">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              try {
                localStorage.setItem(AUTO_KEY, e.target.checked ? '1' : '0');
              } catch {
                /* preferenza solo per questa sessione */
              }
            }}
          />
          Aggiorna da solo quando arriva una tavola già aperta qui
        </label>
        <details className="group">
          <summary>Come installare il plugin</summary>
          <ol className="help steps">
            <li>Apri Figma desktop → menu Plugins → Development → Import plugin from manifest…</li>
            <li>Scegli il file <code>figma-plugin/manifest.json</code> di questo repository.</li>
            <li>Avvia il compositore con <code>npm run dev</code> (indirizzo predefinito http://localhost:5173).</li>
            <li>In Figma seleziona una o più tavole → Plugins → Development → DSSA → Compositore → «Invia al compositore».</li>
          </ol>
          <p className="help">
            Simboli, marchio, etichetta e freccia si riconoscono dal nome del componente; i testi restano testi; il resto arriva come immagine. Nei nomi dei livelli si può indicare
            l’ingresso: «Titolo [parole]», «Foto [fermo]», «Cifra [inizio=1.2]». Dopo il primo invio l’animazione si decide qui.
          </p>
        </details>
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function summary(nodes: FigmaScene['frames'][number]['nodes']) {
  const c: Record<string, number> = {};
  for (const n of nodes) c[n.kind] = (c[n.kind] ?? 0) + 1;
  const L: Record<string, string> = { text: 'testi', symbol: 'simboli', mark: 'marchio', label: 'etichette', arrow: 'frecce', image: 'immagini' };
  return Object.entries(c)
    .map(([k, v]) => `${v} ${L[k] ?? k}`)
    .join(', ');
}
