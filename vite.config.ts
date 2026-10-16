import { readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const FONT_EXT = /\.(woff2?|otf|ttf)$/i;

/** Elenco dei caratteri presenti in public/fonts, letto dal compositore all'avvio. */
function fontIndex(): Plugin {
  const list = () => {
    try {
      return readdirSync('public/fonts').filter((f) => FONT_EXT.test(f));
    } catch {
      return [];
    }
  };
  return {
    name: 'dssa-font-index',
    configureServer(server) {
      server.middlewares.use('/fonts/index.json', (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(list()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'fonts/index.json', source: JSON.stringify(list()) });
    },
  };
}

export default defineConfig({
  plugins: [react(), fontIndex()],
  base: './',
});
