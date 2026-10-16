import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FORMATS, getFormat } from './brand/tokens';
import { download, exportMp4, exportPng, fileName, QUALITY, supportedCodec } from './engine/export';
import { addFontFiles, clearStoredFonts, fontState, onFontsChange } from './engine/fonts';
import { durationInFrames, renderFrame } from './engine/render';
import { clearTextCaches } from './engine/text';
import { clearMarkCaches } from './brand/draw';
import { defaultsOf, type Project, type Props } from './engine/types';
import { autoDuration, COMPOSITIONS, getComposition } from './templates';
import { FieldList } from './ui/fields';

const STORAGE = 'dssa-compositore-progetto';

function initialProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const p = JSON.parse(raw) as Project;
      const comp = getComposition(p.composition);
      return { ...p, props: { ...defaultsOf(comp.fields), ...p.props } };
    }
  } catch {
    /* progetto salvato illeggibile: si riparte dal modello */
  }
  const comp = COMPOSITIONS[0];
  return { version: 1, composition: comp.id, format: comp.defaultFormat, fps: 30, duration: comp.defaultDuration, speed: 1, strict: true, props: defaultsOf(comp.fields) };
}

export function App() {
  const [project, setProject] = useState<Project>(initialProject);
  const [frame, setFrame] = useState(1e9);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [guides, setGuides] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [, setFontTick] = useState(0);
  const [exporting, setExporting] = useState<{ frame: number; total: number } | null>(null);
  const [quality, setQuality] = useState<keyof typeof QUALITY>('alta');
  const [codecOk, setCodecOk] = useState<boolean | null>(null);
  const [showFonts, setShowFonts] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const memory = useRef(new Map<string, Props>());
  const abortRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const comp = getComposition(project.composition);
  const format = getFormat(project.format);
  const total = durationInFrames(project, comp);
  const auto = autoDuration(comp, project.props);

  // Ridisegno quando cambiano i caratteri.
  useEffect(
    () =>
      onFontsChange(() => {
        clearTextCaches();
        clearMarkCaches();
        setFontTick((t) => t + 1);
      }) as () => void,
    [],
  );

  // Salvataggio automatico.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(project));
      } catch {
        /* immagini troppo grandi per l'archivio del browser: si salva con «Salva progetto» */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [project]);

  useEffect(() => {
    supportedCodec(format.width, format.height, project.fps).then((c) => setCodecOk(!!c));
  }, [format.width, format.height, project.fps]);

  // Disegno del fotogramma corrente.
  const draw = useCallback(
    (fr: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d', { colorSpace: 'srgb' } as CanvasRenderingContext2DSettings)!;
      const res = renderFrame(ctx, project, fr);
      setWarnings((w) => (w.join('|') === res.warnings.join('|') ? w : res.warnings));
      setError(res.error);
    },
    [project],
  );

  useEffect(() => {
    if (!playing) draw(frame);
  }, [draw, frame, playing]);

  // Riproduzione in tempo reale.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now() - (frame / project.fps) * 1000;
    const tick = (now: number) => {
      let fr = Math.floor(((now - t0) / 1000) * project.fps);
      if (fr >= total) {
        if (loop) fr = fr % total;
        else {
          setPlaying(false);
          setFrame(total - 1);
          return;
        }
      }
      draw(fr);
      setFrame(fr);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, draw, total, loop]);

  useEffect(() => {
    if (frame >= total) setFrame(total - 1);
  }, [total, frame]);

  // Guide: margini sicuri e zone dell'interfaccia (non esportate).
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!guides) return;
    const s = format.safe;
    ctx.save();
    for (const g of format.guides) {
      ctx.fillStyle = g.kind === 'interfaccia' ? 'rgba(255,74,117,0.22)' : 'rgba(17,17,20,0.28)';
      ctx.fillRect(...g.rect);
      if (g.label) {
        ctx.fillStyle = 'rgba(17,17,20,0.75)';
        ctx.font = '600 22px Karla, sans-serif';
        ctx.fillText(g.label, g.rect[0] + 16, g.rect[1] + 34);
      }
    }
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,200,255,0.85)';
    ctx.strokeRect(s.left, s.top, format.width - s.left - s.right, format.height - s.top - s.bottom);
    ctx.restore();
  }, [guides, format]);

  // Tastiera: spazio, frecce.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFrame((f) => (f >= total - 1 ? 0 : f));
        setPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') setFrame((f) => Math.min(total - 1, f + (e.shiftKey ? project.fps : 1)));
      else if (e.code === 'ArrowLeft') setFrame((f) => Math.max(0, f - (e.shiftKey ? project.fps : 1)));
      else if (e.code === 'Home') setFrame(0);
      else if (e.code === 'End') setFrame(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, project.fps]);

  const setProp = (key: string, v: unknown) => setProject((p) => ({ ...p, props: { ...p.props, [key]: v } }));

  const chooseComposition = (id: string) => {
    if (id === project.composition) return;
    memory.current.set(project.composition, project.props);
    const next = getComposition(id);
    setProject((p) => ({
      ...p,
      composition: id,
      format: next.defaultFormat.startsWith('li') && !p.format.startsWith('li') ? next.defaultFormat : p.format,
      duration: next.defaultDuration,
      props: memory.current.get(id) ?? defaultsOf(next.fields),
    }));
    // Si mostra la composizione finita; «▶» la fa partire dall'inizio.
    setFrame(1e9);
  };

  const reset = () => {
    setProject((p) => ({ ...p, props: defaultsOf(comp.fields), duration: comp.defaultDuration }));
    setFrame(1e9);
  };

  const saveProject = () => download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), fileName(project, 'json'));

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = JSON.parse(await file.text()) as Project;
      const c = getComposition(p.composition);
      setProject({ ...p, props: { ...defaultsOf(c.fields), ...p.props } });
      setFrame(0);
    } catch {
      setNotice('Il file non è un progetto del compositore.');
    }
  };

  const doExport = async () => {
    setPlaying(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setExporting({ frame: 0, total });
    try {
      const { blob, codec } = await exportMp4(project, { quality, onProgress: setExporting, signal: ctrl.signal });
      download(blob, fileName(project, 'mp4'));
      setNotice(
        `MP4 esportato: ${format.width} × ${format.height}, ${project.fps} fps, ${(total / project.fps).toFixed(1)} s, ${(blob.size / 1e6).toFixed(1)} MB.` +
          (codec.startsWith('avc') ? '' : ' Attenzione: questo browser non codifica H.264 e il video è in VP9, non adatto a Instagram. Usa Chrome o Edge, oppure npm run render.'),
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNotice((e as Error).message);
    } finally {
      setExporting(null);
      abortRef.current = null;
      draw(frame);
    }
  };

  const doPng = async () => download(await exportPng(project, frame), fileName(project, 'png'));

  const groups = useMemo(() => {
    const g = new Map<string, typeof COMPOSITIONS>();
    for (const c of COMPOSITIONS) g.set(c.category, [...(g.get(c.category) ?? []), c]);
    return [...g.entries()];
  }, []);

  const time = (fr: number) => {
    const s = fr / project.fps;
    return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  };

  const fontsMissing = !fontState.basier;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <b>DSSA</b> <span>Compositore</span>
        </div>
        <div className="actions">
          <button className={'btn ghost' + (fontsMissing ? ' warn' : '')} onClick={() => setShowFonts(true)}>
            Caratteri {fontsMissing ? '· mancano' : '· ok'}
          </button>
          <label className="btn ghost">
            Apri progetto
            <input type="file" accept=".json,application/json" hidden onChange={(e) => openProject(e.target.files?.[0])} />
          </label>
          <button className="btn ghost" onClick={saveProject}>
            Salva progetto
          </button>
          <button className="btn ghost" onClick={doPng}>
            PNG del fotogramma
          </button>
          <select value={quality} onChange={(e) => setQuality(e.target.value as keyof typeof QUALITY)} title="Qualità del video">
            <option value="alta">Qualità alta</option>
            <option value="media">Qualità media</option>
            <option value="leggera">File leggero</option>
          </select>
          <button className="btn primary" onClick={doExport} disabled={!!exporting} title={codecOk === false ? 'Questo browser non codifica H.264: il video uscirà in VP9. Per Instagram usa Chrome, Edge o npm run render.' : 'H.264, pronto per Instagram e LinkedIn'}>
            Esporta MP4{codecOk === false ? ' (VP9)' : ''}
          </button>
        </div>
      </header>

      <aside className="left">
        {groups.map(([cat, list]) => (
          <section key={cat}>
            <h3>{cat === 'Feed' ? 'Composizioni del feed' : cat === 'Video' ? 'Video e sequenze' : 'Da zero'}</h3>
            {list.map((c) => (
              <button key={c.id} className={'comp' + (c.id === project.composition ? ' on' : '')} onClick={() => chooseComposition(c.id)}>
                <b>{c.name}</b>
                <small>{c.description}</small>
              </button>
            ))}
          </section>
        ))}
      </aside>

      <main className="stage">
        <div className="canvas-wrap" style={{ aspectRatio: `${format.width} / ${format.height}` }}>
          <canvas ref={canvasRef} width={format.width} height={format.height} />
          <canvas ref={overlayRef} className="overlay" width={format.width} height={format.height} />
        </div>
        <div className="transport">
          <button
            className="btn round"
            onClick={() => {
              if (!playing && frame >= total - 1) setFrame(0);
              setPlaying((p) => !p);
            }}
            title="Spazio"
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button className="btn round ghost" onClick={() => (setPlaying(false), setFrame(0))} title="Inizio">
            ⏮
          </button>
          <input className="scrub" type="range" min={0} max={total - 1} value={frame} onChange={(e) => (setPlaying(false), setFrame(parseInt(e.target.value, 10)))} />
          <span className="tc">
            {time(frame)} / {time(total)} · {frame + 1}/{total}
          </span>
          <label className="check small">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Ciclo
          </label>
          <label className="check small">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Guide
          </label>
        </div>
        <p className="source">{comp.source}</p>
        {error && <p className="error">Errore nel modello: {error}</p>}
        {warnings.length > 0 && (
          <ul className="warnings">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </main>

      <aside className="right">
        <section className="settings">
          <label className="field">
            <span className="label">Formato</span>
            <select value={project.format} onChange={(e) => setProject((p) => ({ ...p, format: e.target.value }))}>
              {['Instagram', 'LinkedIn'].map((pl) => (
                <optgroup key={pl} label={pl}>
                  {FORMATS.filter((f) => f.platform === pl).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <small className="help">{format.note}</small>
          </label>
          <div className="row3">
            <label className="field">
              <span className="label">Durata (s)</span>
              <input
                type="number"
                min={0.5}
                max={120}
                step={0.5}
                value={auto ?? project.duration}
                disabled={auto !== null}
                onChange={(e) => setProject((p) => ({ ...p, duration: Math.max(0.5, parseFloat(e.target.value) || 1) }))}
              />
            </label>
            <label className="field">
              <span className="label">Fotogrammi/s</span>
              <select value={project.fps} onChange={(e) => setProject((p) => ({ ...p, fps: parseInt(e.target.value, 10) }))}>
                {[24, 25, 30, 50, 60].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Velocità</span>
              <input type="number" min={0.25} max={4} step={0.05} value={project.speed} onChange={(e) => setProject((p) => ({ ...p, speed: Math.max(0.25, parseFloat(e.target.value) || 1) }))} />
            </label>
          </div>
          <label className="field check">
            <input type="checkbox" checked={project.strict} onChange={(e) => setProject((p) => ({ ...p, strict: e.target.checked }))} />
            <span className="label">Regole del manuale</span>
            <small className="help">Attive: solo i colori della palette e le varianti previste. Disattive: colori liberi, rotazioni e corpi fuori scala, con avviso.</small>
          </label>
        </section>
        <div className="inspector">
          <div className="inspector-head">
            <h2>{comp.name}</h2>
            <button className="btn small ghost" onClick={reset}>
              Valori del modello
            </button>
          </div>
          <FieldList fields={comp.fields} values={project.props} onChange={setProp} ctx={{ strict: project.strict }} />
        </div>
      </aside>

      {exporting && (
        <div className="modal">
          <div className="card">
            <h2>Esportazione MP4</h2>
            <progress max={exporting.total} value={exporting.frame} />
            <p>
              Fotogramma {exporting.frame} di {exporting.total}
            </p>
            <button className="btn ghost" onClick={() => abortRef.current?.abort()}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {showFonts && <FontsDialog onClose={() => setShowFonts(false)} onNotice={setNotice} />}

      {notice && (
        <div className="toast" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
    </div>
  );
}

function FontsDialog({ onClose, onNotice }: { onClose: () => void; onNotice: (s: string) => void }) {
  const [drag, setDrag] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const { ok, ko } = await addFontFiles([...files]);
    onNotice(`${ok.length ? 'Caricati: ' + ok.join(', ') + '. ' : ''}${ko.length ? 'Non riconosciuti: ' + ko.join(', ') + ' (il nome deve contenere «Basier» o «Wotfard»).' : ''}`);
  };
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <h2>Caratteri</h2>
        <ul className="fonts">
          <li className={fontState.basier ? 'ok' : 'ko'}>Basier Circle · {fontState.basier ? 'caricato' : 'mancante'}</li>
          <li className={fontState.wotfard ? 'ok' : 'ko'}>Wotfard · {fontState.wotfard ? 'caricato' : 'mancante (si usa Basier Circle)'}</li>
        </ul>
        <p>
          Sono caratteri commerciali di Atipo Foundry: trascina qui i file con licenza (Regular, Medium, SemiBold). Restano salvati in questo browser. Senza, l’anteprima usa Karla, il sostituto
          documentato per Google Slides (manuale, p. 26-27).
        </p>
        <label
          className={'drop big' + (drag ? ' drag' : '')}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => (e.preventDefault(), setDrag(false), add(e.dataTransfer.files))}
        >
          Trascina qui i file .otf, .ttf, .woff o .woff2
          <input type="file" multiple accept=".otf,.ttf,.woff,.woff2" hidden onChange={(e) => add(e.target.files)} />
        </label>
        <div className="row">
          <button
            className="btn small ghost"
            onClick={async () => {
              await clearStoredFonts();
              onNotice('Caratteri salvati rimossi: ricarica la pagina.');
            }}
          >
            Dimentica i caratteri salvati
          </button>
          <button className="btn small" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
