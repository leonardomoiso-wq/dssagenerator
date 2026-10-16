import { readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const FONT_EXT = /\.(woff2?|otf|ttf)$/i;

/**
 * Elenchi letti dal compositore all'avvio: i caratteri in public/fonts e i modelli della squadra
 * in public/libreria. In sviluppo sono sempre aggiornati; nella build si fissano al momento.
 */
function folderIndex(dir: string, test: RegExp): Plugin {
  const list = () => {
    try {
      return readdirSync(`public/${dir}`).filter((f) => test.test(f) && f !== 'index.json');
    } catch {
      return [];
    }
  };
  return {
    name: `dssa-index-${dir}`,
    configureServer(server) {
      server.middlewares.use(`/${dir}/index.json`, (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(list()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: `${dir}/index.json`, source: JSON.stringify(list()) });
    },
  };
}

export default defineConfig({
  plugins: [react(), folderIndex('fonts', FONT_EXT), folderIndex('libreria', /\.json$/i)],
  base: './',
});
