// Modelli della casa: progetti salvati con nome per ripartire da una configurazione riuscita.
// «Miei»: nel browser (IndexedDB). «Della squadra»: file .json in public/libreria/ del repository.
import { getFormat } from '../brand/tokens';
import { preloadImages, renderFrame } from './render';
import { slideProject, stillFrame, syncActive } from './series';
import type { Project } from './types';

export interface SavedModel {
  kind: 'dssa-modello';
  version: 1;
  id: string;
  name: string;
  description: string;
  author?: string;
  createdAt: string;
  /** Miniatura JPEG (data URL). */
  thumbnail: string;
  project: Project;
  /** Solo in memoria: da dove viene. */
  origin?: 'miei' | 'squadra';
  file?: string;
}

// --- Creazione ---

function stripImages(v: unknown): unknown {
  if (typeof v === 'string') return v.startsWith('data:image/') && !v.startsWith('data:image/svg') ? '' : v;
  if (Array.isArray(v)) return v.map(stripImages);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripImages(x)]));
  return v;
}

export async function thumbnailOf(project: Project, height = 240): Promise<string> {
  await preloadImages(project);
  const p = slideProject(syncActive(project));
  const fmt = getFormat(p.format);
  const c = document.createElement('canvas');
  c.width = fmt.width;
  c.height = fmt.height;
  renderFrame(c.getContext('2d')!, p, stillFrame(p));
  const s = document.createElement('canvas');
  s.height = height;
  s.width = Math.round((height * fmt.width) / fmt.height);
  const ctx = s.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, s.width, s.height);
  return s.toDataURL('image/jpeg', 0.82);
}

export async function createModel(
  project: Project,
  o: { name: string; description: string; author?: string; images: boolean; audio: boolean },
): Promise<SavedModel> {
  let p: Project = structuredClone(syncActive(project));
  const thumbnail = await thumbnailOf(p);
  if (!o.images) p = stripImages(p) as Project;
  if (!o.audio) delete p.audio;
  return {
    kind: 'dssa-modello',
    version: 1,
    id: `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: o.name.trim() || 'Senza nome',
    description: o.description.trim(),
    author: o.author?.trim() || undefined,
    createdAt: new Date().toISOString(),
    thumbnail,
    project: p,
  };
}

/** Accetta un modello salvato oppure un progetto salvato con «Salva progetto». */
export function parseModel(text: string, fallbackName: string): SavedModel {
  const data = JSON.parse(text);
  if (data?.kind === 'dssa-modello' && data.project) return data as SavedModel;
  if (data?.composition && data?.props) {
    return {
      kind: 'dssa-modello',
      version: 1,
      id: `mod-${Date.now().toString(36)}`,
      name: fallbackName.replace(/\.json$/i, ''),
      description: '',
      createdAt: new Date().toISOString(),
      thumbnail: '',
      project: data as Project,
    };
  }
  throw new Error('Il file non è un modello né un progetto del compositore.');
}

export function fileNameOf(m: SavedModel) {
  const slug = m.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'modello'}.json`;
}

// --- I miei modelli (IndexedDB) ---

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dssa-libreria', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('modelli', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction('modelli', mode).objectStore('modelli'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function listMine(): Promise<SavedModel[]> {
  try {
    const all = await tx<SavedModel[]>('readonly', (s) => s.getAll() as IDBRequest<SavedModel[]>);
    return all.map((m) => ({ ...m, origin: 'miei' as const })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveMine(m: SavedModel) {
  const { origin: _o, file: _f, ...clean } = m;
  void _o;
  void _f;
  await tx('readwrite', (s) => s.put(clean));
}

export async function deleteMine(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

// --- Modelli della squadra (public/libreria) ---

export async function listTeam(): Promise<SavedModel[]> {
  try {
    const res = await fetch('libreria/index.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const files: string[] = await res.json();
    const out = await Promise.all(
      files.map(async (f) => {
        try {
          const r = await fetch(`libreria/${encodeURIComponent(f)}`, { cache: 'no-store' });
          const m = parseModel(await r.text(), f);
          return { ...m, origin: 'squadra' as const, file: f };
        } catch {
          return null;
        }
      }),
    );
    return out.filter((m): m is NonNullable<typeof m> => m !== null).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  } catch {
    return [];
  }
}
