import { useCallback, useEffect, useState } from 'react';
import { download } from '../engine/export';
import { createModel, deleteMine, fileNameOf, listMine, listTeam, parseModel, saveMine, thumbnailOf, type SavedModel } from '../engine/library';
import type { Project } from '../engine/types';
import { getComposition } from '../templates';

function hasImages(v: unknown): boolean {
  if (typeof v === 'string') return v.startsWith('data:image/') && !v.startsWith('data:image/svg');
  if (Array.isArray(v)) return v.some(hasImages);
  if (v && typeof v === 'object') return Object.values(v).some(hasImages);
  return false;
}

/** Modelli della casa: della squadra (repository) e miei (browser). */
export function Library({ project, onApply, onNotice }: { project: Project; onApply: (p: Project, name: string) => void; onNotice: (s: string) => void }) {
  const [team, setTeam] = useState<SavedModel[]>([]);
  const [mine, setMine] = useState<SavedModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [t, m] = await Promise.all([listTeam(), listMine()]);
    setTeam(t);
    setMine(m);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = (m: SavedModel) => {
    onApply(structuredClone(m.project), m.name);
    setMenu(null);
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const m = parseModel(await f.text(), f.name);
      if (!m.thumbnail) m.thumbnail = await thumbnailOf(m.project);
      await saveMine({ ...m, id: `mod-${Date.now().toString(36)}` });
      await refresh();
      onNotice(`Modello «${m.name}» aggiunto ai tuoi.`);
    } catch (e) {
      onNotice((e as Error).message);
    }
  };

  const item = (m: SavedModel) => (
    <div key={(m.origin ?? '') + m.id} className="model">
      <button className="model-main" onClick={() => apply(m)} title={m.description || m.name}>
        {m.thumbnail ? <img src={m.thumbnail} alt="" /> : <span className="ph" />}
        <span className="model-text">
          <b>{m.name}</b>
          <small>
            {getComposition(m.project.composition).name}
            {m.project.serie ? ` · ${m.project.serie.slides.length} slide` : ''}
            {m.project.audio ? ' · ♪' : ''}
          </small>
          {m.description && <small className="desc">{m.description}</small>}
        </span>
      </button>
      <button className="icon" title="Altre azioni" onClick={() => setMenu(menu === m.id ? null : m.id)}>
        ⋯
      </button>
      {menu === m.id && (
        <div className="model-menu">
          <button onClick={() => (download(new Blob([JSON.stringify({ ...m, origin: undefined, file: undefined }, null, 2)], { type: 'application/json' }), fileNameOf(m)), setMenu(null))}>
            Esporta il file (per la squadra)
          </button>
          {m.origin === 'miei' && (
            <>
              <button
                onClick={async () => {
                  const name = prompt('Nuovo nome del modello', m.name);
                  if (name) {
                    await saveMine({ ...m, name });
                    await refresh();
                  }
                  setMenu(null);
                }}
              >
                Rinomina
              </button>
              <button
                onClick={async () => {
                  await saveMine({ ...m, project: structuredClone(project), thumbnail: await thumbnailOf(project), createdAt: new Date().toISOString() });
                  await refresh();
                  setMenu(null);
                  onNotice(`«${m.name}» aggiornato con il progetto corrente.`);
                }}
              >
                Sostituisci con il progetto corrente
              </button>
              <button
                className="danger"
                onClick={async () => {
                  if (confirm(`Eliminare il modello «${m.name}»?`)) {
                    await deleteMine(m.id);
                    await refresh();
                  }
                  setMenu(null);
                }}
              >
                Elimina
              </button>
            </>
          )}
          {m.origin === 'squadra' && <small className="help">File: public/libreria/{m.file}. Per cambiarlo si modifica il file nel repository.</small>}
        </div>
      )}
    </div>
  );

  return (
    <section className="library">
      <h3>Modelli della casa</h3>
      <div className="row">
        <button className="btn small" onClick={() => setSaving(true)}>
          + Salva come modello
        </button>
        <label className="btn small ghost">
          Importa…
          <input type="file" accept=".json,application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        </label>
      </div>
      {team.length > 0 && <h4>Della squadra</h4>}
      {team.map(item)}
      <h4>Miei</h4>
      {mine.length === 0 && <p className="help">Nessun modello salvato. Salva un progetto riuscito per ripartire da lì la prossima volta.</p>}
      {mine.map(item)}
      {saving && (
        <SaveDialog
          project={project}
          onClose={() => setSaving(false)}
          onSaved={async (m) => {
            await saveMine(m);
            await refresh();
            setSaving(false);
            onNotice(`Modello «${m.name}» salvato. Per condividerlo con la squadra: ⋯ → Esporta il file, poi aggiungilo a public/libreria/.`);
          }}
        />
      )}
    </section>
  );
}

function SaveDialog({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: (m: SavedModel) => void }) {
  const comp = getComposition(project.composition);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const withImages = hasImages(project);
  const [images, setImages] = useState(false);
  const [audio, setAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <h2>Salva come modello</h2>
        <p className="help">
          Si salva tutto il progetto: {comp.name.toLowerCase()}, testi, colori, tempi, ritocchi di ogni formato{project.serie ? `, le ${project.serie.slides.length} slide della serie` : ''}.
        </p>
        <label className="field">
          <span className="label">Nome</span>
          <input type="text" value={name} placeholder="Es. Open day 2027 · Story" autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Quando usarlo</span>
          <textarea rows={2} value={description} placeholder="Es. Invito agli open day; cambiare data, sede e aula." onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Autore (facoltativo)</span>
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        {withImages && (
          <label className="field check">
            <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
            <span className="label">Tieni le fotografie</span>
            <small className="help">Di solito no: il modello resta leggero e ogni volta si carica la foto giusta. Attenzione alle persone riconoscibili (p. 60).</small>
          </label>
        )}
        {project.audio && (
          <label className="field check">
            <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
            <span className="label">Tieni la musica</span>
          </label>
        )}
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>
            Annulla
          </button>
          <button
            className="btn primary"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              onSaved(await createModel(project, { name, description, author, images, audio }));
            }}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
