#!/usr/bin/env node
// Esportazione da riga di comando: apre il compositore in Chromium senza interfaccia,
// genera ogni fotogramma come PNG e li passa a ffmpeg (H.264, yuv420p, BT.709, faststart).
//
//   npm run render -- --project progetto.json --out video.mp4
//   npm run render -- --project progetto.json --format ig-story --out storia.mp4
//   npm run render -- --project progetto.json --png 45 --out fotogramma.png
//
// Richiede: ffmpeg nel PATH; Chromium (playwright install chromium) oppure Chrome
// installato (--chrome) o un percorso in CHROME_PATH.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);

if (!args.project && !args.composition && !args.list) {
  console.error(`Uso:
  npm run render -- --project progetto.json [--out video.mp4] [--format ig-post] [--fps 30] [--crf 16] [--png N]
  npm run render -- --composition cifra [--props valori.json] [--format ig-story] [--out video.mp4]
  npm run render -- --project serie.json --carosello zip|pdf   (immagini del carosello)
  npm run render -- --project serie.json --slide 2             (una sola slide)
  npm run render -- --project progetto.json --formati instagram|linkedin|tutti|ig-post,li-landscape --out cartella
  npm run render -- --list`);
  process.exit(1);
}

let project = args.project ? JSON.parse(readFileSync(resolve(args.project), 'utf8')) : null;
// Un modello della libreria (public/libreria/*.json) contiene il progetto in «project».
if (project?.kind === 'dssa-modello') project = project.project;
if (project?.serie) {
  // Allinea la slide attiva all'elenco delle slide, come fa il compositore al salvataggio.
  const s = project.serie;
  s.slides[s.active] = { ...s.slides[s.active], composition: project.composition, props: project.props, duration: project.duration };
}

// --- Server statico della build ---
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('Manca la build: esegui prima «npm run build».');
  process.exit(1);
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === '/fonts/index.json') {
    // Elenco aggiornato: i caratteri aggiunti dopo la build valgono subito.
    const dir = join(root, 'public', 'fonts');
    const list = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(woff2?|otf|ttf)$/i.test(f)) : [];
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(list));
  }
  let file = join(dist, url === '/' ? 'index.html' : url);
  if (!file.startsWith(dist) || !existsSync(file)) {
    // I caratteri si leggono anche da public/fonts senza ricostruire.
    const alt = join(root, 'public', url);
    if (url.startsWith('/fonts/') && existsSync(alt)) file = alt;
    else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('404');
    }
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// --- Browser ---
const { chromium } = await import('playwright-core');
function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && existsSync(base)) {
    for (const d of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      for (const p of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        if (existsSync(join(base, d, p))) return join(base, d, p);
      }
    }
  }
  return undefined;
}
let browser;
const launchArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'];
try {
  browser = await chromium.launch(args.chrome ? { channel: 'chrome', args: launchArgs } : { executablePath: findChromium(), args: launchArgs });
} catch (e) {
  try {
    browser = await chromium.launch({ channel: 'chrome', args: launchArgs });
  } catch {
    console.error('Chromium non trovato. Installa con «npx playwright install chromium», oppure usa Chrome con --chrome, oppure indica CHROME_PATH.\n' + e.message);
    server.close();
    process.exit(1);
  }
}
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && console.error('[pagina]', m.text()));
await page.goto(`http://127.0.0.1:${port}/?headless=1`);
await page.waitForFunction(() => window.__DSSA__);
await page.evaluate(() => window.__DSSA__.ready);
const fonts = await page.evaluate(() => window.__DSSA__.fonts());
if (!fonts.basier) console.warn('Attenzione: Basier Circle non trovato in public/fonts: il video usa Karla, il carattere sostitutivo.');
const catalog = await page.evaluate(() => window.__DSSA__.compositions());
if (args.list) {
  for (const c of catalog) console.log(`${c.id.padEnd(22)} ${c.name} (${c.defaultFormat}, ${c.defaultDuration} s)`);
  await browser.close();
  server.close();
  process.exit(0);
}
if (!project) {
  const c = catalog.find((x) => x.id === args.composition);
  if (!c) {
    console.error(`Modello «${args.composition}» inesistente. Usa --list.`);
    process.exit(1);
  }
  const extra = args.props ? JSON.parse(readFileSync(resolve(args.props), 'utf8')) : {};
  project = { version: 1, composition: c.id, format: c.defaultFormat, fps: 30, duration: c.defaultDuration, speed: 1, strict: true, props: { ...c.props, ...extra } };
}
if (args.fps) project.fps = parseInt(args.fps, 10);
if (args.duration) project.duration = parseFloat(args.duration);
const slideOpt = args.slide !== undefined ? { slide: parseInt(args.slide, 10) - 1 } : {};

const warnings = new Set();
const tempFiles = [];
const grab = async (i) => {
  const r = await page.evaluate((n) => window.__DSSA__.frame(n), i);
  r.warnings.forEach((w) => warnings.add(w));
  if (r.error) throw new Error(r.error);
  return Buffer.from(r.data.split(',')[1], 'base64');
};

/** Esporta il progetto in un formato. */
async function renderOne(proj, out) {
  const info = await page.evaluate(([p, o]) => window.__DSSA__.setProject(p, o), [proj, slideOpt]);
  if (info.slides > 1) console.log(`Serie di ${info.slides} slide${args.slide !== undefined ? `: esporto la slide ${args.slide}` : ', in sequenza'}.`);
  console.log(`Composizione «${proj.composition}», formato ${proj.format}, ${info.width} × ${info.height}, ${info.fps} fps, ${info.frames} fotogrammi.`);
  if (args.carosello) {
    const kind = args.carosello === 'pdf' || (args.carosello === true && proj.format.startsWith('li')) ? 'pdf' : 'zip';
    const b64 = await page.evaluate((k) => window.__DSSA__.carousel(k), kind);
    const file = out.replace(/\.(mp4|png|zip|pdf)$/, '') + '.' + kind;
    writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('Scritto', file);
    return;
  }
  if (args.png !== undefined) {
    const n = args.png === true ? info.still : parseInt(args.png, 10) || 0;
    writeFileSync(out, await grab(n));
    console.log('Scritto', out);
    return;
  }
    // Musica del progetto: stesso inviluppo dell'anteprima (volume, entrata, uscita).
    const seconds = info.frames / info.fps;
    const audioIn = [];
    const audioOut = [];
    const track = proj.audio;
    if (track?.src && !args['no-audio']) {
      const m = /^data:([^;]+);base64,(.*)$/s.exec(track.src);
      if (m) {
        const ext = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/flac': 'flac' }[m[1]] ?? 'audio';
        const file = join(tmpdir(), `dssa-audio-${process.pid}.${ext}`);
        writeFileSync(file, Buffer.from(m[2], 'base64'));
        tempFiles.push(file);
        const off = info.audioOffset ?? 0;
        const fadeInLeft = Math.max(0, (track.fadeIn ?? 0) - off);
        const filters = [];
        if (track.fadeIn > 0 && off < track.fadeIn) filters.push(`afade=t=in:st=0:d=${fadeInLeft.toFixed(3)}`);
        if (track.fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, seconds - track.fadeOut).toFixed(3)}:d=${track.fadeOut}`);
        filters.push(`volume=${track.volume ?? 1}`, 'apad');
        audioIn.push('-ss', String((track.start ?? 0) + off), '-i', file);
        audioOut.push('-map', '0:v', '-map', '1:a', '-filter:a', filters.join(','), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
      }
    }
    const ff = spawn(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-',
        ...audioIn,
        ...audioOut,
        '-t', seconds.toFixed(3),
        '-c:v', 'libx264', '-preset', args.preset ?? 'slow', '-crf', String(args.crf ?? 16),
        '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-movflags', '+faststart', '-r', String(info.fps),
        out,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg è uscito con codice ' + c)))));
    const t = Date.now();
    for (let i = 0; i < info.frames; i++) {
      const buf = await grab(i);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 15 === 0 || i === info.frames - 1) process.stdout.write(`\r  fotogramma ${i + 1}/${info.frames}`);
    }
    ff.stdin.end();
    await done;
    console.log(`\nScritto ${out} in ${((Date.now() - t) / 1000).toFixed(1)} s.`);
}

try {
  if (args.formati) {
    // Lo stesso progetto in più formati, ognuno con i suoi ritocchi.
    const all = ['ig-post', 'ig-story', 'ig-reel-cover', 'ig-square', 'li-portrait', 'li-square', 'li-landscape'];
    const ids = args.formati === true || args.formati === 'tutti' ? all : args.formati === 'instagram' ? all.filter((f) => f.startsWith('ig')) : args.formati === 'linkedin' ? all.filter((f) => f.startsWith('li')) : String(args.formati).split(',').map((x) => x.trim());
    const dir = resolve(args.out ?? 'esportazioni');
    mkdirSync(dir, { recursive: true });
    const ext = args.png !== undefined ? 'png' : 'mp4';
    for (const id of ids) {
      if (!all.includes(id)) {
        console.error(`Formato «${id}» sconosciuto. Formati: ${all.join(', ')}.`);
        continue;
      }
      await renderOne({ ...project, format: id }, join(dir, `${project.composition}-${id}.${ext}`));
    }
  } else {
    if (args.format) project.format = args.format;
    const out = resolve(args.out ?? (args.png !== undefined ? 'fotogramma.png' : `${project.composition}-${project.format}.mp4`));
    await renderOne(project, out);
  }
  if (warnings.size) console.log('Avvisi del manuale:\n- ' + [...warnings].join('\n- '));
} finally {
  for (const f of tempFiles) rmSync(f, { force: true });
  await browser.close();
  server.close();
}
