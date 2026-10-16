import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getFormat } from './brand/tokens';
import { fontState, loadFonts } from './engine/fonts';
import { exportCarousel } from './engine/export';
import { durationInFrames, preloadImages, renderFrame } from './engine/render';
import { renderSeriesFrame, seriesTimeline, slideCount, slideProject, stillFrame, type Timeline } from './engine/series';
import { defaultsOf, type Project } from './engine/types';
import { COMPOSITIONS } from './templates';
import './styles.css';

const params = new URLSearchParams(location.search);

if (params.has('headless')) {
  // Interfaccia per l'esportazione da riga di comando (scripts/render.mjs).
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  let project: Project | null = null;
  let flat: Project | null = null;
  let tl: Timeline | null = null;
  let timeOffset = 0;
  const ready = loadFonts();
  (window as any).__DSSA__ = {
    ready: ready.then(() => true),
    fonts: () => ({ ...fontState }),
    /** Elenco dei modelli con i valori predefiniti, per creare un progetto senza interfaccia. */
    compositions: () =>
      COMPOSITIONS.map((c) => ({ id: c.id, name: c.name, defaultFormat: c.defaultFormat, defaultDuration: c.defaultDuration, props: defaultsOf(c.fields) })),
    /** opts.slide: una sola slide della serie (da 0); senza, la serie intera in sequenza. */
    async setProject(p: Project, opts: { slide?: number } = {}) {
      project = p;
      const single = opts.slide !== undefined || slideCount(p) <= 1;
      tl = single ? null : seriesTimeline(p);
      flat = slideProject(p, opts.slide ?? p.serie?.active ?? 0);
      const fmt = getFormat(p.format);
      canvas.width = fmt.width;
      canvas.height = fmt.height;
      await preloadImages(p);
      // Scarto della slide nella serie, per far partire la musica dal punto giusto.
      const audioOffset = !single || slideCount(p) <= 1 ? 0 : seriesTimeline(p).starts[opts.slide ?? p.serie?.active ?? 0] / p.fps;
      timeOffset = tl ? 0 : audioOffset;
      return { width: fmt.width, height: fmt.height, fps: p.fps, frames: tl ? tl.total : durationInFrames(flat), slides: slideCount(p), audioOffset, still: stillFrame(flat) };
    },
    /** Carosello come ZIP di PNG o PDF, in base64. */
    async carousel(kind: 'zip' | 'pdf') {
      if (!project) throw new Error('Nessun progetto');
      const blob = await exportCarousel(project, kind);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    frame(i: number, type = 'image/png') {
      if (!project) throw new Error('Nessun progetto');
      const ctx = canvas.getContext('2d')!;
      const res = tl ? renderSeriesFrame(ctx, project, i, tl) : renderFrame(ctx, flat!, i, { timeOffset });
      return { data: canvas.toDataURL(type), warnings: res.warnings, error: res.error };
    },
  };
} else {
  loadFonts();
  createRoot(document.getElementById('root')!).render(<App />);
}
