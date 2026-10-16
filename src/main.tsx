import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getFormat } from './brand/tokens';
import { fontState, loadFonts } from './engine/fonts';
import { durationInFrames, preloadImages, renderFrame } from './engine/render';
import { defaultsOf, type Project } from './engine/types';
import { COMPOSITIONS } from './templates';
import './styles.css';

const params = new URLSearchParams(location.search);

if (params.has('headless')) {
  // Interfaccia per l'esportazione da riga di comando (scripts/render.mjs).
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  let project: Project | null = null;
  const ready = loadFonts();
  (window as any).__DSSA__ = {
    ready: ready.then(() => true),
    fonts: () => ({ ...fontState }),
    /** Elenco dei modelli con i valori predefiniti, per creare un progetto senza interfaccia. */
    compositions: () =>
      COMPOSITIONS.map((c) => ({ id: c.id, name: c.name, defaultFormat: c.defaultFormat, defaultDuration: c.defaultDuration, props: defaultsOf(c.fields) })),
    async setProject(p: Project) {
      project = p;
      const fmt = getFormat(p.format);
      canvas.width = fmt.width;
      canvas.height = fmt.height;
      await preloadImages(p.props);
      return { width: fmt.width, height: fmt.height, fps: p.fps, frames: durationInFrames(p) };
    },
    frame(i: number, type = 'image/png') {
      if (!project) throw new Error('Nessun progetto');
      const ctx = canvas.getContext('2d')!;
      const res = renderFrame(ctx, project, i);
      return { data: canvas.toDataURL(type), warnings: res.warnings, error: res.error };
    },
  };
} else {
  loadFonts();
  createRoot(document.getElementById('root')!).render(<App />);
}
