import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
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

/**
 * Ponte con il plugin Figma «DSSA → Compositore» durante lo sviluppo (npm run dev):
 * POST /api/figma riceve la scena, GET /api/figma/ultima la restituisce,
 * GET /api/figma/eventi avvisa il compositore aperto (Server-Sent Events).
 */
function figmaBridge(): Plugin {
  const file = '.figma/ultima.json';
  let last: string | null = existsSync(file) ? readFileSync(file, 'utf8') : null;
  let stamp = last ? Date.now() : 0;
  const clients = new Set<ServerResponse>();
  const cors = (res: ServerResponse) => {
    // L'interfaccia dei plugin Figma ha origine «null».
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  };
  return {
    name: 'dssa-figma-bridge',
    configureServer(server) {
      server.middlewares.use('/api/figma', (req, res) => {
        cors(res);
        const url = req.url ?? '/';
        if (req.method === 'OPTIONS') return res.end();
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf8');
              const scene = JSON.parse(body);
              if (scene?.kind !== 'dssa-figma') throw new Error('Non è una scena del plugin DSSA');
              last = body;
              stamp = Date.now();
              mkdirSync('.figma', { recursive: true });
              writeFileSync(file, body);
              for (const c of clients) c.write(`data: ${JSON.stringify({ stamp, frames: scene.frames?.length ?? 0, fileName: scene.fileName ?? '' })}\n\n`);
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ ok: true, frames: scene.frames?.length ?? 0, viewers: clients.size }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
            }
          });
          return;
        }
        if (url.startsWith('/eventi')) {
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
          res.write(`data: ${JSON.stringify({ hello: true, stamp })}\n\n`);
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }
        if (url.startsWith('/ultima')) {
          if (!last) {
            res.statusCode = 404;
            return res.end('{}');
          }
          res.setHeader('content-type', 'application/json');
          return res.end(last);
        }
        res.statusCode = 404;
        res.end('{}');
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), folderIndex('fonts', FONT_EXT), folderIndex('libreria', /\.json$/i), figmaBridge()],
  base: './',
});
