import { useRef, useState } from 'react';
import type { PlacedElement, Project } from '../engine/types';
import { findLayer, getAdjust, setAdjust, updateLayer } from './editing';

type DragMode = 'move' | 'resize' | 'exit';

/**
 * Timeline degli elementi: una riga per elemento con l'ingresso come barra.
 * Elementi dei modelli: si spostano nel tempo (ritardo). Livelli: si spostano, si allunga
 * l'ingresso, si sposta l'uscita.
 */
export function Timeline({
  elements,
  project,
  setProject,
  frame,
  total,
  onSeek,
  selected,
  onSelect,
}: {
  elements: PlacedElement[];
  project: Project;
  setProject: (fn: (p: Project) => Project) => void;
  frame: number;
  total: number;
  onSeek: (f: number) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const fps = project.fps;
  const speed = project.speed || 1;
  const trackRef = useRef<HTMLDivElement>(null);
  const [snapAt, setSnapAt] = useState<number | null>(null);
  const drag = useRef<{ el: PlacedElement; mode: DragMode; x0: number; orig: { dt: number; inizio: number; durata: number; fine: number } } | null>(null);

  const pct = (f: number) => `${(Math.max(0, Math.min(total, f)) / total) * 100}%`;
  const framesFromPx = (px: number) => {
    const w = trackRef.current?.getBoundingClientRect().width ?? 1;
    return (px / w) * total;
  };
  const toSec = (frames: number) => (frames * speed) / fps;
  const fmt = (sec: number) => `${sec >= 0 ? '+' : '−'}${Math.abs(sec).toFixed(2).replace('.', ',')} s`;

  // Punti a cui le barre si agganciano: inizio, testina, inizi e fini delle altre barre.
  const snapPoints = (exclude: string) => {
    const pts = [0, frame, total - 1];
    for (const e of elements) if (e.id !== exclude && e.time) pts.push(e.time.start, e.time.end);
    return pts;
  };
  const snap = (value: number, exclude: string, alt: boolean) => {
    if (alt) return { v: value, at: null };
    const thr = framesFromPx(6);
    let best: number | null = null;
    for (const p of snapPoints(exclude)) if (Math.abs(p - value) <= thr && (best === null || Math.abs(p - value) < Math.abs(best - value))) best = p;
    return best === null ? { v: value, at: null } : { v: best, at: best };
  };

  const start = (e: React.PointerEvent, el: PlacedElement, mode: DragMode) => {
    e.stopPropagation();
    onSelect(el.id);
    const layer = el.layer ? findLayer(project, el.id) : undefined;
    drag.current = {
      el,
      mode,
      x0: e.clientX,
      orig: { dt: getAdjust(project, el.id).dt ?? 0, inizio: layer?.props.inizio ?? 0, durata: layer?.props.durata ?? 0.7, fine: layer?.props.fine ?? 0 },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !d.el.time) return;
    let df = framesFromPx(e.clientX - d.x0);
    const t = d.el.time;
    const round = (v: number) => Math.round(v * 100) / 100;
    if (d.mode === 'move') {
      const sn = snap(t.start + df, d.el.id, e.altKey);
      const sn2 = snap(t.end + df, d.el.id, e.altKey);
      if (sn.at !== null) df = sn.v - t.start;
      else if (sn2.at !== null) df = sn2.v - t.end;
      setSnapAt(sn.at ?? sn2.at);
      // L'elemento non entra prima dell'inizio del video.
      df = Math.max(df, -t.start);
      const sec = toSec(df);
      setProject((p) =>
        d.el.layer
          ? updateLayer(p, d.el.id, (l) => ({ ...l, props: { ...l.props, inizio: round(Math.max(0, d.orig.inizio + sec)), fine: d.orig.fine > 0 ? round(Math.max(0, d.orig.fine + sec)) : 0 } }))
          : setAdjust(p, d.el.id, { ...getAdjust(p, d.el.id), dt: round(d.orig.dt + sec) }),
      );
    } else if (d.mode === 'resize') {
      const sn = snap(t.end + df, d.el.id, e.altKey);
      if (sn.at !== null) df = sn.v - t.end;
      setSnapAt(sn.at);
      const sec = toSec(df);
      setProject((p) => updateLayer(p, d.el.id, (l) => ({ ...l, props: { ...l.props, durata: round(Math.max(0.05, d.orig.durata + sec)) } })));
    } else {
      const base = t.exit ?? total;
      const sn = snap(base + df, d.el.id, e.altKey);
      if (sn.at !== null) df = sn.v - base;
      setSnapAt(sn.at);
      const fine = toSec(base + df);
      setProject((p) => updateLayer(p, d.el.id, (l) => ({ ...l, props: { ...l.props, fine: fine >= toSec(total) - 0.05 ? 0 : round(Math.max(toSec(t.end), fine)) } })));
    }
  };
  const up = () => {
    drag.current = null;
    setSnapAt(null);
  };

  const seek = (e: React.PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect();
    onSeek(Math.round(((e.clientX - r.left) / r.width) * (total - 1)));
  };

  if (!elements.length) return null;
  const secs = total / fps;
  const step = secs > 20 ? 5 : secs > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= secs + 1e-6; t += step) ticks.push(t);

  return (
    <div className="timeline" onPointerMove={move} onPointerUp={up}>
      <div className="tl-row tl-ruler">
        <span className="tl-label">
          <small>Trascina le barre · Alt: senza aggancio</small>
        </span>
        <div className="tl-track" ref={trackRef} onPointerDown={seek}>
          {ticks.map((t) => (
            <span key={t} className="tick" style={{ left: pct(t * fps) }}>
              {t}s
            </span>
          ))}
        </div>
      </div>
      <div className="tl-rows">
        {elements.map((el) => {
          const t = el.time;
          const dt = el.layer ? null : getAdjust(project, el.id).dt ?? 0;
          return (
            <div key={el.id} className={'tl-row' + (el.id === selected ? ' on' : '') + (el.hidden ? ' off' : '')} onClick={() => onSelect(el.id)}>
              <span className="tl-label" title={el.label}>
                {el.label}
                {dt ? <em>{fmt(dt)}</em> : null}
              </span>
              <div className="tl-track" onPointerDown={seek}>
                {t ? (
                  <>
                    <span className="tl-life" style={{ left: pct(t.end), width: `calc(${pct(t.exit ?? total)} - ${pct(t.end)})` }} />
                    <span
                      className={'tl-bar' + (el.layer ? ' layer' : '')}
                      style={{ left: pct(t.start), width: `max(6px, calc(${pct(t.end)} - ${pct(t.start)}))` }}
                      onPointerDown={(e) => start(e, el, 'move')}
                      onDoubleClick={() => !el.layer && setProject((p) => setAdjust(p, el.id, { ...getAdjust(p, el.id), dt: 0 }))}
                      title={el.layer ? 'Trascina per spostare l’ingresso' : 'Trascina per anticipare o ritardare · doppio clic: rimetti com’era'}
                    >
                      {el.layer && <span className="tl-handle" onPointerDown={(e) => start(e, el, 'resize')} title="Durata dell’ingresso" />}
                    </span>
                    {el.layer && (
                      <span className="tl-exit" style={{ left: pct(t.exit ?? total - 1) }} onPointerDown={(e) => start(e, el, 'exit')} title={t.exit ? 'Uscita: trascina' : 'Trascina per farlo uscire prima della fine'} />
                    )}
                    {!el.layer && t.exit !== undefined && <span className="tl-exit fixed" style={{ left: pct(t.exit) }} />}
                  </>
                ) : (
                  <span className="tl-life static" style={{ left: 0, width: '100%' }} title="Senza ingresso animato" />
                )}
              </div>
            </div>
          );
        })}
        <div className="tl-playhead" style={{ left: `calc(var(--tl-label) + (100% - var(--tl-label)) * ${frame / Math.max(1, total - 1)})` }} />
        {snapAt !== null && <div className="tl-snap" style={{ left: `calc(var(--tl-label) + (100% - var(--tl-label)) * ${snapAt / Math.max(1, total)})` }} />}
      </div>
    </div>
  );
}
