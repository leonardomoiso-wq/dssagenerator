import { useEffect, useMemo, useState } from 'react';
import { FORMATS, getFormat } from '../brand/tokens';
import { exportCarousel, exportMp4, exportPng, QUALITY } from '../engine/export';
import { makeZip } from '../engine/files';
import { preloadImages, renderFrame } from '../engine/render';
import { slideCount, slideProject, stillFrame } from '../engine/series';
import type { Project } from '../engine/types';
import { hasAdjustments } from './editing';

const PRESETS: { label: string; ids: string[] }[] = [
  { label: 'Instagram', ids: ['ig-post', 'ig-story', 'ig-reel-cover'] },
  { label: 'LinkedIn', ids: ['li-portrait', 'li-landscape'] },
  { label: 'Tutti', ids: FORMATS.map((f) => f.id) },
];

interface Preview {
  url: string;
  warnings: string[];
}

function previewOf(project: Project, format: string): Preview {
  const p = slideProject({ ...project, format });
  const fmt = getFormat(format);
  const c = document.createElement('canvas');
  c.width = fmt.width;
  c.height = fmt.height;
  const res = renderFrame(c.getContext('2d')!, p, stillFrame(p));
  const small = document.createElement('canvas');
  const h = 150;
  small.height = h;
  small.width = Math.round((h * fmt.width) / fmt.height);
  small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height);
  return { url: small.toDataURL('image/jpeg', 0.8), warnings: res.warnings.filter((w) => !w.startsWith('Basier Circle')) };
}

export function MultiExport({ project, onClose, onNotice }: { project: Project; onClose: () => void; onNotice: (s: string) => void }) {
  const series = slideCount(project) > 1;
  const [chosen, setChosen] = useState<string[]>(() => (project.format.startsWith('li') ? PRESETS[1].ids : PRESETS[0].ids));
  const [video, setVideo] = useState(true);
  const [still, setStill] = useState(!series);
  const [carousel, setCarousel] = useState(series);
  const [wholeSeries, setWholeSeries] = useState(true);
  const [quality, setQuality] = useState<keyof typeof QUALITY>('alta');
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [progress, setProgress] = useState<{ label: string; frame: number; total: number } | null>(null);
  const [abort, setAbort] = useState<AbortController | null>(null);

  // Anteprime e avvisi per ogni formato, con calma.
  useEffect(() => {
    let alive = true;
    (async () => {
      await preloadImages(project);
      for (const f of FORMATS) {
        if (!alive) return;
        const pv = previewOf(project, f.id);
        setPreviews((old) => ({ ...old, [f.id]: pv }));
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => {
      alive = false;
    };
  }, [project]);

  const jobs = useMemo(() => {
    const n = chosen.length;
    return n * ((video ? 1 : 0) + (still ? 1 : 0) + (series && carousel ? 1 : 0));
  }, [chosen, video, still, carousel, series]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : FORMATS.map((f) => f.id).filter((x) => x === id || c.includes(x))));

  const run = async () => {
    const ctrl = new AbortController();
    setAbort(ctrl);
    const files: { name: string; data: Uint8Array }[] = [];
    const base = `dssa-${project.composition}`;
    let vp9 = false;
    try {
      for (const id of chosen) {
        const p = { ...project, format: id };
        if (video) {
          setProgress({ label: `${getFormat(id).label} · video`, frame: 0, total: 1 });
          const r = await exportMp4(p, { quality, series: series && wholeSeries, signal: ctrl.signal, onProgress: (x) => setProgress({ label: `${getFormat(id).label} · video`, ...x }) });
          if (!r.codec.startsWith('avc')) vp9 = true;
          files.push({ name: `${base}-${id}${series && wholeSeries ? '-serie' : ''}.mp4`, data: new Uint8Array(await r.blob.arrayBuffer()) });
        }
        if (still) {
          setProgress({ label: `${getFormat(id).label} · immagine`, frame: 0, total: 1 });
          const sp = slideProject(p);
          files.push({ name: `${base}-${id}.png`, data: new Uint8Array(await (await exportPng(p, stillFrame(sp))).arrayBuffer()) });
        }
        if (series && carousel) {
          const kind = id.startsWith('li') ? 'pdf' : 'zip';
          setProgress({ label: `${getFormat(id).label} · carosello`, frame: 0, total: slideCount(p) });
          const b = await exportCarousel(p, kind, (x) => setProgress({ label: `${getFormat(id).label} · carosello`, ...x }));
          files.push({ name: `${base}-${id}-carosello.${kind}`, data: new Uint8Array(await b.arrayBuffer()) });
        }
        if (ctrl.signal.aborted) throw new DOMException('annullata', 'AbortError');
      }
      const zip = makeZip(files);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = `${base}-formati.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      onNotice(`Esportati ${files.length} file in ${chosen.length} formati (${(zip.size / 1e6).toFixed(1)} MB).${vp9 ? ' Video in VP9: per Instagram usa Chrome/Edge o npm run render.' : ''}`);
      onClose();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') onNotice((e as Error).message);
    } finally {
      setProgress(null);
      setAbort(null);
    }
  };

  return (
    <div className="modal" onClick={() => !progress && onClose()}>
      <div className="card wide" onClick={(e) => e.stopPropagation()}>
        <h2>Esporta in più formati</h2>
        <div className="row">
          {PRESETS.map((p) => (
            <button key={p.label} className="btn small ghost" onClick={() => setChosen(p.ids)}>
              {p.label}
            </button>
          ))}
          <button className="btn small ghost" onClick={() => setChosen([])}>
            Nessuno
          </button>
        </div>
        <div className="formats">
          {FORMATS.map((f) => {
            const pv = previews[f.id];
            const on = chosen.includes(f.id);
            const touched = hasAdjustments(slideProject(project).props, f.id);
            return (
              <label key={f.id} className={'fmt' + (on ? ' on' : '')}>
                <input type="checkbox" checked={on} onChange={() => toggle(f.id)} />
                <div className="fmt-img">{pv ? <img src={pv.url} alt="" /> : <span className="ph" />}</div>
                <b>{f.platform}</b>
                <small>{f.label}</small>
                <small className={touched ? 'tag ok' : 'tag'}>{touched ? 'ritoccato per questo formato' : 'posizioni del modello'}</small>
                {pv && pv.warnings.length > 0 && (
                  <small className="tag warn" title={pv.warnings.join('\n')}>
                    {pv.warnings.length} {pv.warnings.length === 1 ? 'avviso' : 'avvisi'}
                  </small>
                )}
              </label>
            );
          })}
        </div>
        <div className="row opts">
          <label className="check small">
            <input type="checkbox" checked={video} onChange={(e) => setVideo(e.target.checked)} /> Video MP4
          </label>
          {series && video && (
            <label className="check small">
              <input type="checkbox" checked={wholeSeries} onChange={(e) => setWholeSeries(e.target.checked)} /> Video della serie intera
            </label>
          )}
          <label className="check small">
            <input type="checkbox" checked={still} onChange={(e) => setStill(e.target.checked)} /> Immagine PNG {series ? '(slide attiva)' : ''}
          </label>
          {series && (
            <label className="check small">
              <input type="checkbox" checked={carousel} onChange={(e) => setCarousel(e.target.checked)} /> Carosello (PNG .zip per Instagram, PDF per LinkedIn)
            </label>
          )}
          <select value={quality} onChange={(e) => setQuality(e.target.value as keyof typeof QUALITY)}>
            <option value="alta">Qualità alta</option>
            <option value="media">Qualità media</option>
            <option value="leggera">File leggero</option>
          </select>
        </div>
        <p className="help">
          Ogni formato usa i ritocchi fatti per quel formato; dove non ce ne sono valgono le posizioni del modello. Passa il puntatore sugli avvisi per leggerli, oppure apri il formato
          dal selettore per sistemarlo prima di esportare.
        </p>
        {progress && (
          <div className="prog">
            <progress max={progress.total} value={progress.frame} />
            <small>{progress.label}</small>
          </div>
        )}
        <div className="row end">
          {progress ? (
            <button className="btn ghost" onClick={() => abort?.abort()}>
              Annulla
            </button>
          ) : (
            <>
              <button className="btn ghost" onClick={onClose}>
                Chiudi
              </button>
              <button className="btn primary" disabled={!jobs} onClick={run}>
                Esporta {jobs} {jobs === 1 ? 'file' : 'file'} (.zip)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
