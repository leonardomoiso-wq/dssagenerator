import { useEffect, useRef, useState } from 'react';
import { getFormat } from '../brand/tokens';
import { preloadImages, renderFrame } from '../engine/render';
import { addSlide, moveSlide, removeSlide, setSeries, slideProject, stillFrame, switchTo } from '../engine/series';
import type { Project, Props } from '../engine/types';
import { COMPOSITIONS, getComposition } from '../templates';
import { defaultsOf } from '../engine/types';

// Miniature: una per oggetto props (immutabile) e per regole di serie.
const thumbs = new WeakMap<Props, { key: string; url: string }>();
const big = { c: null as HTMLCanvasElement | null };

function thumbnail(project: Project, i: number): string {
  const own: Props = i === project.serie?.active ? project.props : project.serie!.slides[i].props;
  const sp = slideProject(project, i);
  const key = `${project.format}|${sp.composition}|${sp.duration}|${sp.props.etichetta}|${sp.props.freccia}|${sp.props.pulsante}`;
  const hit = thumbs.get(own);
  if (hit && hit.key === key) return hit.url;
  const fmt = getFormat(project.format);
  if (!big.c) big.c = document.createElement('canvas');
  big.c.width = fmt.width;
  big.c.height = fmt.height;
  renderFrame(big.c.getContext('2d')!, sp, stillFrame(sp));
  const small = document.createElement('canvas');
  small.width = 160;
  small.height = Math.round((160 * fmt.height) / fmt.width);
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(big.c, 0, 0, small.width, small.height);
  const url = small.toDataURL('image/jpeg', 0.8);
  thumbs.set(own, { key, url });
  return url;
}

export function SeriesBar({
  project,
  setProject,
  onExportVideo,
  onExportStills,
  busy,
}: {
  project: Project;
  setProject: (fn: (p: Project) => Project) => void;
  onExportVideo: () => void;
  onExportStills: (kind: 'zip' | 'pdf') => void;
  busy: boolean;
}) {
  const serie = project.serie;
  const [urls, setUrls] = useState<string[]>([]);
  const [, setLoaded] = useState(0);
  const timer = useRef<number>();

  // Miniature aggiornate con calma, mentre si lavora.
  useEffect(() => {
    if (!serie) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setUrls(serie.slides.map((_, i) => thumbnail(project, i)));
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [project, serie]);

  useEffect(() => {
    preloadImages(project).then(() => setLoaded((n) => n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie?.slides.length]);

  if (!serie) {
    return (
      <div className="series empty">
        <button className="btn small ghost" onClick={() => setProject((p) => addSlide(p))}>
          + Aggiungi una slide (carosello o video a capitoli)
        </button>
      </div>
    );
  }

  const n = serie.slides.length;
  const a = serie.active;
  return (
    <div className="series">
      <div className="strip">
        {serie.slides.map((s, i) => (
          <div key={s.id} className={'slide' + (i === a ? ' on' : '')}>
            <button className="thumb" onClick={() => setProject((p) => switchTo(p, i))} title={getComposition(i === a ? project.composition : s.composition).name}>
              {urls[i] ? <img src={urls[i]} alt="" /> : <span className="ph" />}
              <span className="badge">{i + 1}</span>
            </button>
            {i === a && (
              <div className="slide-tools">
                <button className="icon" title="Sposta a sinistra" disabled={i === 0} onClick={() => setProject((p) => moveSlide(p, i, -1))}>
                  ‹
                </button>
                <button className="icon" title="Elimina la slide" onClick={() => setProject((p) => removeSlide(p, i))}>
                  ×
                </button>
                <button className="icon" title="Sposta a destra" disabled={i === n - 1} onClick={() => setProject((p) => moveSlide(p, i, 1))}>
                  ›
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="add">
          <button className="btn small ghost" onClick={() => setProject((p) => addSlide(p))} title="Duplica la slide attiva">
            + Duplica
          </button>
          <select
            value=""
            onChange={(e) => {
              const c = getComposition(e.target.value);
              setProject((p) => addSlide(p, { composition: c.id, props: defaultsOf(c.fields), duration: c.defaultDuration }));
            }}
          >
            <option value="">+ Nuova da modello…</option>
            {COMPOSITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="series-settings">
        <div className="seg">
          <button className={serie.anteprima === 'slide' ? 'on' : ''} onClick={() => setProject((p) => setSeries(p, { anteprima: 'slide' }))}>
            Slide {a + 1}
          </button>
          <button className={serie.anteprima === 'serie' ? 'on' : ''} onClick={() => setProject((p) => setSeries(p, { anteprima: 'serie' }))}>
            Serie intera
          </button>
        </div>
        <label className="check small" title="Aggiunge «· 2/5» all'etichetta di serie">
          <input type="checkbox" checked={serie.numera} onChange={(e) => setProject((p) => setSeries(p, { numera: e.target.checked }))} /> Numera l’etichetta
        </label>
        <label className="check small" title="Freccia e pulsante «avanti» su tutte le slide tranne l'ultima">
          <input type="checkbox" checked={serie.frecciaAuto} onChange={(e) => setProject((p) => setSeries(p, { frecciaAuto: e.target.checked }))} /> Freccia automatica
        </label>
        <label className="check small">
          Passaggio nel video
          <select value={serie.transizione} onChange={(e) => setProject((p) => setSeries(p, { transizione: e.target.value as 'taglio' | 'dissolvenza' }))}>
            <option value="dissolvenza">Dissolvenza</option>
            <option value="taglio">Taglio netto</option>
          </select>
          {serie.transizione === 'dissolvenza' && (
            <input
              type="number"
              min={0.1}
              max={2}
              step={0.1}
              value={serie.durataTransizione}
              onChange={(e) => setProject((p) => setSeries(p, { durataTransizione: Math.max(0.1, parseFloat(e.target.value) || 0.4) }))}
              title="Secondi"
            />
          )}
        </label>
        <span className="spacer" />
        <button className="btn small ghost" disabled={busy} onClick={() => onExportStills('zip')} title="Una PNG per slide, per il carosello Instagram">
          PNG carosello (.zip)
        </button>
        <button className="btn small ghost" disabled={busy} onClick={() => onExportStills('pdf')} title="Un PDF con una pagina per slide, per il carosello LinkedIn">
          PDF LinkedIn
        </button>
        <button className="btn small" disabled={busy} onClick={onExportVideo} title="Tutte le slide in un unico MP4">
          Video della serie
        </button>
      </div>
      {n > 20 && <p className="help">Instagram accetta al massimo 20 slide per carosello.</p>}
      {project.format.startsWith('li') && (n < 4 || n > 6) && <p className="help">I caroselli LinkedIn del manuale hanno da 4 a 6 slide (p. 58).</p>}
    </div>
  );
}
