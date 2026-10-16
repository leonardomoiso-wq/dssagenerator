// Caratteri: Basier Circle e Wotfard (commerciali, caricati dall'utente) con Karla come
// sostituto di anteprima (manuale p. 26-27). I file trascinati restano nel browser (IndexedDB).
import '@fontsource/karla/400.css';
import '@fontsource/karla/500.css';
import '@fontsource/karla/600.css';
import '@fontsource/karla/700.css';
import { FONT_FALLBACK, FONT_TEXT, FONT_TITLE } from '../brand/tokens';

export const fontState = { basier: false, wotfard: false };
const listeners = new Set<() => void>();
export function onFontsChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((l) => l());

/** Stringa CSS del carattere per il canvas. */
export function font(family: 'titolo' | 'testo', weight: number, sizePx: number) {
  const main = family === 'titolo' ? FONT_TITLE : FONT_TEXT;
  // Se Wotfard manca si usa Basier Circle (la ripartizione dei ruoli è una proposta, p. 27).
  const chain = family === 'testo' ? `"${FONT_TEXT}", "${FONT_TITLE}"` : `"${main}"`;
  return `${weight} ${sizePx}px ${chain}, "${FONT_FALLBACK}", "Liberation Sans", Arial, sans-serif`;
}

async function loadFromFolder() {
  let files: string[] = [];
  try {
    const res = await fetch('fonts/index.json', { cache: 'no-store' });
    if (res.ok) files = await res.json();
  } catch {
    /* nessun elenco: nessun carattere nella cartella */
  }
  await Promise.all(
    files.map(async (name) => {
      const info = detect(name);
      if (!info) return;
      try {
        const face = new FontFace(info.family, `url(fonts/${encodeURIComponent(name)})`, { weight: String(info.weight) });
        await face.load();
        document.fonts.add(face);
        mark(info.family);
      } catch {
        /* file non leggibile */
      }
    }),
  );
}

function detect(name: string): { family: string; weight: number } | null {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  let family: string | null = null;
  if (n.includes('basier')) family = FONT_TITLE;
  else if (n.includes('wotfard')) family = FONT_TEXT;
  if (!family) return null;
  let weight = 400;
  if (n.includes('semibold') || n.includes('demibold')) weight = 600;
  else if (n.includes('medium')) weight = 500;
  else if (n.includes('bold')) weight = 700;
  else if (n.includes('light')) weight = 300;
  return { family, weight };
}

function mark(family: string) {
  if (family === FONT_TITLE) fontState.basier = true;
  if (family === FONT_TEXT) fontState.wotfard = true;
}

// --- Persistenza nel browser ---

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dssa-compositore', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('fonts');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFont(name: string, data: ArrayBuffer) {
  try {
    const d = await db();
    d.transaction('fonts', 'readwrite').objectStore('fonts').put(data, name);
  } catch {
    /* archivio non disponibile: il carattere vale solo per questa sessione */
  }
}

async function storedFonts(): Promise<[string, ArrayBuffer][]> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const out: [string, ArrayBuffer][] = [];
      const req = d.transaction('fonts').objectStore('fonts').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(out);
        out.push([String(c.key), c.value as ArrayBuffer]);
        c.continue();
      };
      req.onerror = () => resolve(out);
    });
  } catch {
    return [];
  }
}

export async function clearStoredFonts() {
  try {
    const d = await db();
    d.transaction('fonts', 'readwrite').objectStore('fonts').clear();
  } catch {
    /* niente da cancellare */
  }
}

async function addFace(name: string, data: ArrayBuffer) {
  const info = detect(name);
  if (!info) return false;
  const face = new FontFace(info.family, data, { weight: String(info.weight) });
  await face.load();
  document.fonts.add(face);
  mark(info.family);
  return true;
}

/** Carica i file trascinati dall'utente. Restituisce i nomi riconosciuti. */
export async function addFontFiles(files: File[]): Promise<{ ok: string[]; ko: string[] }> {
  const ok: string[] = [];
  const ko: string[] = [];
  for (const f of files) {
    try {
      const data = await f.arrayBuffer();
      if (await addFace(f.name, data)) {
        ok.push(f.name);
        await saveFont(f.name, data);
      } else ko.push(f.name);
    } catch {
      ko.push(f.name);
    }
  }
  notify();
  return { ok, ko };
}

/** Carica i caratteri disponibili: cartella public/fonts, archivio del browser, sostituto. */
export async function loadFonts() {
  const jobs: Promise<unknown>[] = [loadFromFolder()];
  jobs.push(
    storedFonts().then((list) => Promise.all(list.map(([name, data]) => addFace(name, data).catch(() => false)))),
  );
  await Promise.all(jobs);
  // Il sostituto va caricato esplicitamente: il canvas non scarica i caratteri da solo.
  await Promise.all(
    [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px "${FONT_FALLBACK}"`, 'DSSA ə з àèé').catch(() => null)),
  );
  for (const w of [400, 500, 600]) {
    await document.fonts.load(font('titolo', w, 40), 'DSSA').catch(() => null);
    await document.fonts.load(font('testo', w, 40), 'DSSA').catch(() => null);
  }
  notify();
}
