import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FORMATS, getFormat } from './brand/tokens';
import { download, exportCarousel, exportMp4, exportPng, fileName, QUALITY, supportedCodec } from './engine/export';
import { addFontFiles, clearStoredFonts, fontState, onFontsChange } from './engine/fonts';
import { durationInFrames, renderFrame } from './engine/render';
import { renderSeriesFrame, seriesTimeline, slideCount, slideOffset, slideProject } from './engine/series';
import { envelope } from './engine/audio';
import { AudioPanel } from './ui/AudioPanel';
import { SeriesBar } from './ui/SeriesBar';
import { clearTextCaches } from './engine/text';
import { clearMarkCaches } from './brand/draw';
import { defaultsOf, type Adjust, type Layer, type PlacedElement, type Project, type Props } from './engine/types';
import { findLayer, getAdjust, hitTest, moveLayer, resetAll, scaleLayer, setAdjust, snapBox, updateLayer, type SnapLine } from './ui/editing';
import { ElementsPanel } from './ui/ElementsPanel';
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<PlacedElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [cursor, setCursor] = useState('default');
  // --- Cronologia: annulla e ripeti ---
  const history = useRef({ past: [] as Project[], future: [] as Project[], last: project, lastTime: 0, skip: false, dragPushed: false });
  const [, setHistoryTick] = useState(0);
  useEffect(() => {
    const h = history.current;
    if (project === h.last) return;
    if (h.skip) {
      h.skip = false;
      h.last = project;
      return;
    }
    const now = performance.now();
    // Un trascinamento intero o una digitazione continua sono un solo passo.
    const push = drag.current ? !h.dragPushed : now - h.lastTime > 700;
    if (push) {
      h.past.push(h.last);
      if (h.past.length > 150) h.past.shift();
      h.future = [];
      if (drag.current) h.dragPushed = true;
      setHistoryTick((t) => t + 1);
    }
    h.lastTime = now;
    h.last = project;
  }, [project]);
  const undo = useCallback(() => {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(h.last);
    h.skip = true;
    h.lastTime = 0;
    setProject(prev);
    setHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(h.last);
    h.skip = true;
    h.lastTime = 0;
    setProject(next);
    setHistoryTick((t) => t + 1);
  }, []);
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  const drag = useRef<{
    id: string;
    mode: 'move' | 'scale';
    layer: boolean;
    x0: number;
    y0: number;
    box: { x: number; y: number; w: number; h: number };
    adj: Adjust;
    orig?: Layer;
  } | null>(null);

  const comp = getComposition(project.composition);
  const format = getFormat(project.format);
  const seriesMode = !!project.serie && project.serie.anteprima === 'serie' && slideCount(project) > 1;
  const timeline = useMemo(() => (seriesMode ? seriesTimeline(project) : null), [seriesMode, project]);
  const total = timeline ? timeline.total : durationInFrames(slideProject(project), comp);
  // Secondi tra l'inizio della serie e ciò che si guarda: tiene la musica a tempo.
  const previewOffset = useMemo(() => (timeline ? 0 : slideOffset(project)), [timeline, project]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();
  const [muted, setMuted] = useState(false);
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
        // Archivio del browser pieno (audio o immagini grandi): si tiene almeno il resto.
        try {
          localStorage.setItem(STORAGE, JSON.stringify({ ...project, audio: undefined }));
        } catch {
          /* si salva con «Salva progetto» */
        }
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
      // Serie intera in sola visione; la slide attiva si modifica (ritocchi compresi).
      const res = timeline ? renderSeriesFrame(ctx, project, fr, timeline) : renderFrame(ctx, slideProject(project), fr, { timeOffset: previewOffset });
      setWarnings((w) => (w.join('|') === res.warnings.join('|') ? w : res.warnings));
      const els = timeline ? [] : res.elements;
      setElements((old) => (JSON.stringify(old) === JSON.stringify(els) ? old : els));
      setError(res.error);
    },
    [project, timeline, previewOffset],
  );

  useEffect(() => {
    if (!playing) draw(frame);
  }, [draw, frame, playing]);

  // Riproduzione in tempo reale.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now() - (frame / project.fps) * 1000;
    // Musica: parte dal punto giusto della traccia e resta a tempo con i fotogrammi.
    const track = project.audio;
    const el = audioRef.current;
    const fps = project.fps;
    let lastFr = frame;
    if (track?.src && el) {
      if (el.src !== track.src) el.src = track.src;
      el.currentTime = track.start + previewOffset + frame / fps;
      el.volume = 0;
      el.play().catch(() => null);
    }
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
      if (track?.src && el) {
        const expected = track.start + previewOffset + fr / fps;
        if (fr < lastFr || Math.abs(el.currentTime - expected) > 0.12) el.currentTime = expected;
        el.volume = muted ? 0 : Math.min(1, envelope(track, previewOffset + fr / fps, previewOffset + total / fps));
      }
      lastFr = fr;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, draw, total, loop, muted]);

  useEffect(() => {
    if (frame >= total) setFrame(total - 1);
  }, [total, frame]);

  // Guide: margini sicuri e zone dell'interfaccia (non esportate).
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    // Selezione e guide magnetiche (sempre visibili, non esportate).
    const ratio = format.width / (wrapRef.current?.clientWidth || format.width);
    const drawBox = (el: PlacedElement, strong: boolean) => {
      const b = el.box;
      ctx.save();
      ctx.strokeStyle = '#705EF2';
      ctx.lineWidth = (strong ? 2.5 : 1.5) * ratio;
      if (strong) ctx.setLineDash([8 * ratio, 5 * ratio]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (strong) {
        const hs = 12 * ratio;
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x + b.w - hs / 2, b.y + b.h - hs / 2, hs, hs);
        ctx.strokeRect(b.x + b.w - hs / 2, b.y + b.h - hs / 2, hs, hs);
        ctx.font = `600 ${13 * ratio}px Karla, sans-serif`;
        const tw = ctx.measureText(el.label).width + 12 * ratio;
        const ty = b.y > 24 * ratio ? b.y - 22 * ratio : b.y + b.h + 4 * ratio;
        ctx.fillStyle = '#705EF2';
        ctx.fillRect(b.x, ty, tw, 18 * ratio);
        ctx.fillStyle = '#fff';
        ctx.fillText(el.label, b.x + 6 * ratio, ty + 13.5 * ratio);
      }
      ctx.restore();
    };
    const visible = elements.filter((e) => !e.hidden);
    const hv = visible.find((e) => e.id === hover);
    const sel = visible.find((e) => e.id === selected);
    if (hv && hv !== sel) drawBox(hv, false);
    if (sel) drawBox(sel, true);
    ctx.save();
    ctx.strokeStyle = '#FF4A75';
    ctx.lineWidth = 1.5 * ratio;
    for (const l of snapLines) {
      ctx.beginPath();
      if (l.x !== undefined) (ctx.moveTo(l.x, 0), ctx.lineTo(l.x, format.height));
      if (l.y !== undefined) (ctx.moveTo(0, l.y), ctx.lineTo(format.width, l.y));
      ctx.stroke();
    }
    ctx.restore();
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
  }, [guides, format, elements, selected, hover, snapLines]);

  // Tastiera: spazio, frecce.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
        // Nei campi di testo vale l'annulla del campo stesso.
        if (t.closest('input[type=text], input:not([type]), textarea')) return;
        e.preventDefault();
        if (e.key === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (t.closest('input, textarea, select')) return;
      if (selected && /^Arrow/.test(e.code)) {
        e.preventDefault();
        const st = e.shiftKey ? 10 : 1;
        const ddx = e.code === 'ArrowLeft' ? -st : e.code === 'ArrowRight' ? st : 0;
        const ddy = e.code === 'ArrowUp' ? -st : e.code === 'ArrowDown' ? st : 0;
        setProject((p) => {
          const layer = findLayer(p, selected);
          if (layer) return updateLayer(p, selected, (l) => moveLayer(l, ddx, ddy, format.width, format.height, l));
          const a = getAdjust(p, selected);
          return setAdjust(p, selected, { ...a, dx: a.dx + ddx, dy: a.dy + ddy });
        });
        return;
      }
      if (e.code === 'Escape') return setSelected(null);
      if (selected && (e.code === 'Delete' || e.code === 'Backspace')) {
        setProject((p) => (findLayer(p, selected) ? updateLayer(p, selected, (l) => ({ ...l, hidden: true })) : setAdjust(p, selected, { ...getAdjust(p, selected), hidden: true })));
        setSelected(null);
        return;
      }
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
  }, [total, project.fps, selected, format.width, format.height]);

  // --- Trascinamento sull'anteprima ---
  const toFormat = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * format.width, y: ((e.clientY - r.top) / r.height) * format.height, ratio: format.width / r.width };
  };
  const onHandle = (el: PlacedElement | undefined, x: number, y: number, ratio: number) => {
    if (!el) return false;
    const b = el.box;
    return Math.abs(x - (b.x + b.w)) < 12 * ratio && Math.abs(y - (b.y + b.h)) < 12 * ratio;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    history.current.dragPushed = false;
    const { x, y, ratio } = toFormat(e);
    const sel = elements.find((el) => el.id === selected && !el.hidden);
    const scaling = onHandle(sel, x, y, ratio);
    const hit = scaling ? sel! : hitTest(elements, x, y);
    if (!hit) {
      setSelected(null);
      return;
    }
    setPlaying(false);
    setSelected(hit.id);
    const layer = hit.layer ? findLayer(project, hit.id) : undefined;
    if (scaling && hit.layer && layer && !scaleLayer(layer, 1)) return;
    drag.current = { id: hit.id, mode: scaling ? 'scale' : 'move', layer: !!hit.layer, x0: x, y0: y, box: hit.box, adj: getAdjust(project, hit.id), orig: layer };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y, ratio } = toFormat(e);
    const d = drag.current;
    if (!d) {
      const sel = elements.find((el) => el.id === selected && !el.hidden);
      const h = hitTest(elements, x, y);
      setHover(h?.id ?? null);
      setCursor(onHandle(sel, x, y, ratio) ? 'nwse-resize' : h ? 'move' : 'default');
      return;
    }
    if (d.mode === 'move') {
      let ddx = x - d.x0;
      let ddy = y - d.y0;
      if (e.shiftKey) Math.abs(ddx) > Math.abs(ddy) ? (ddy = 0) : (ddx = 0);
      let lines: SnapLine[] = [];
      if (!e.altKey) {
        const sn = snapBox({ ...d.box, x: d.box.x + ddx, y: d.box.y + ddy }, format.width, format.height, format.safe, 10 * ratio);
        ddx += sn.dx;
        ddy += sn.dy;
        lines = sn.lines;
      }
      setSnapLines(lines);
      setProject((p) =>
        d.layer && d.orig
          ? updateLayer(p, d.id, (l) => moveLayer(l, ddx, ddy, format.width, format.height, d.orig!))
          : setAdjust(p, d.id, { ...d.adj, dx: Math.round(d.adj.dx + ddx), dy: Math.round(d.adj.dy + ddy) }),
      );
    } else {
      const cx = d.box.x + d.box.w / 2,
        cy = d.box.y + d.box.h / 2;
      const k = Math.max(0.05, Math.hypot(x - cx, y - cy) / Math.max(1, Math.hypot(d.x0 - cx, d.y0 - cy)));
      setProject((p) => {
        if (d.layer && d.orig) {
          const scaled = scaleLayer(d.orig, k);
          return scaled ? updateLayer(p, d.id, () => scaled) : p;
        }
        return setAdjust(p, d.id, { ...d.adj, s: Math.round(Math.min(5, Math.max(0.2, d.adj.s * k)) * 1000) / 1000 });
      });
    }
  };
  const onPointerUp = () => {
    history.current.lastTime = 0;
    drag.current = null;
    setSnapLines([]);
  };

  const setProp = (key: string, v: unknown) => setProject((p) => ({ ...p, props: { ...p.props, [key]: v } }));

  const chooseComposition = (id: string) => {
    if (id === project.composition) return;
    memory.current.set(project.composition, project.props);
    setSelected(null);
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

  const doExport = async (series = seriesMode) => {
    setPlaying(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const frames = series ? seriesTimeline(project).total : durationInFrames(slideProject(project));
    setExporting({ frame: 0, total: frames });
    try {
      const { blob, codec, audio } = await exportMp4(project, { quality, onProgress: setExporting, signal: ctrl.signal, series });
      download(blob, fileName(project, series ? 'serie.mp4' : 'mp4'));
      setNotice(
        `MP4 esportato${series ? ` (serie di ${slideCount(project)} slide)` : ''}: ${format.width} × ${format.height}, ${project.fps} fps, ${(frames / project.fps).toFixed(1)} s, ${(blob.size / 1e6).toFixed(1)} MB.` +
          (audio === 'aac' ? ' Audio AAC.' : audio === 'opus' ? ' Audio in Opus: questo browser non codifica AAC; per Instagram meglio npm run render.' : audio === 'assente' ? ' Audio non codificato da questo browser: usa npm run render.' : '') +
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

  const doStills = async (kind: 'zip' | 'pdf') => {
    setPlaying(false);
    setExporting({ frame: 0, total: slideCount(project) });
    try {
      const blob = await exportCarousel(project, kind, setExporting);
      download(blob, fileName(project, kind === 'zip' ? 'carosello.zip' : 'linkedin.pdf'));
      setNotice(`${kind === 'zip' ? 'Archivio PNG' : 'PDF'} esportato: ${slideCount(project)} slide, ${(blob.size / 1e6).toFixed(1)} MB.`);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

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
          <div className="history">
            <button className="btn round ghost" onClick={undo} disabled={!canUndo} title="Annulla (Ctrl/Cmd+Z)" aria-label="Annulla">
              ↶
            </button>
            <button className="btn round ghost" onClick={redo} disabled={!canRedo} title="Ripeti (Ctrl/Cmd+Maiusc+Z)" aria-label="Ripeti">
              ↷
            </button>
          </div>
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
          <button className="btn primary" onClick={() => doExport()} disabled={!!exporting} title={codecOk === false ? 'Questo browser non codifica H.264: il video uscirà in VP9. Per Instagram usa Chrome, Edge o npm run render.' : 'H.264, pronto per Instagram e LinkedIn'}>
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

      <main className={'stage' + (project.serie ? ' has-series' : '')}>
        <SeriesBar project={project} setProject={setProject} onExportVideo={() => doExport(true)} onExportStills={doStills} busy={!!exporting} />
        {timeline && <p className="help center">Anteprima della serie intera: per modificare torna a una slide.</p>}
        <div
          ref={wrapRef}
          className="canvas-wrap"
          style={{ aspectRatio: `${format.width} / ${format.height}`, cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
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
          <details className="group" open={!!project.audio}>
            <summary>Audio</summary>
            <AudioPanel
              project={project}
              setProject={setProject}
              videoSeconds={total / project.fps}
              offset={previewOffset}
              muted={muted}
              setMuted={setMuted}
              onNotice={setNotice}
            />
          </details>
        </section>
        <div className="inspector">
          <div className="inspector-head">
            <h2>{comp.name}</h2>
            <button className="btn small ghost" onClick={reset}>
              Valori del modello
            </button>
          </div>
          <ElementsPanel
            elements={elements}
            selected={selected}
            project={project}
            onSelect={setSelected}
            onChange={setProject}
            onResetAll={() => setProject((p) => resetAll(p))}
          />
          <FieldList fields={comp.fields} values={project.props} onChange={setProp} ctx={{ strict: project.strict, selected, onSelect: setSelected }} />
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
