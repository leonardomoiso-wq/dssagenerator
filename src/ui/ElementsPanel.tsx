import type { PlacedElement, Project } from '../engine/types';
import { findLayer, getAdjust, hasAdjustments, scaleLayer, setAdjust, updateLayer, uniqueElements } from './editing';

/** Elenco degli elementi del fotogramma: selezione, visibilità, posizione e scala. */
export function ElementsPanel({
  elements,
  selected,
  project,
  onSelect,
  onChange,
  onResetAll,
}: {
  elements: PlacedElement[];
  selected: string | null;
  project: Project;
  onSelect: (id: string | null) => void;
  onChange: (fn: (p: Project) => Project) => void;
  onResetAll: () => void;
}) {
  const list = uniqueElements(elements);
  const sel = list.find((e) => e.id === selected);
  const layer = sel?.layer ? findLayer(project, sel.id) : undefined;
  const adj = sel && !sel.layer ? getAdjust(project, sel.id) : null;
  const touched = hasAdjustments(project.props, project.format);

  const toggle = (e: PlacedElement) =>
    onChange((p) => {
      if (e.layer) return updateLayer(p, e.id, (l) => ({ ...l, hidden: !l.hidden }));
      const a = getAdjust(p, e.id);
      return setAdjust(p, e.id, { ...a, hidden: !a.hidden });
    });

  return (
    <details className="group elements" open>
      <summary>Elementi</summary>
      <p className="help">
        Clicca un elemento nell’anteprima e trascinalo; la maniglia in basso a destra lo scala. Frecce: 1 px (Maiusc: 10 px). Maiusc mentre trascini blocca la direzione, Alt toglie l’aggancio ai margini.
        I ritocchi valgono per il formato corrente.
      </p>
      {list.length === 0 && <p className="help">Nessun elemento in questo fotogramma: spostati più avanti nella timeline.</p>}
      <ul className="el-list">
        {list.map((e) => {
          const moved = !e.layer && (() => {
            const a = getAdjust(project, e.id);
            return a.dx !== 0 || a.dy !== 0 || a.s !== 1;
          })();
          return (
            <li key={e.id} className={(e.id === selected ? 'on ' : '') + (e.hidden ? 'off' : '')} onClick={() => onSelect(e.id)}>
              <button className="icon" title={e.hidden ? 'Mostra' : 'Nascondi'} onClick={(ev) => (ev.stopPropagation(), toggle(e))}>
                {e.hidden ? '○' : '●'}
              </button>
              <span>{e.label}</span>
              {moved && <em title="Spostato o scalato">ritoccato</em>}
            </li>
          );
        })}
      </ul>
      {sel && adj && (
        <div className="el-props">
          <div className="row3">
            <label className="field">
              <span className="label">Sposta X</span>
              <input type="number" step={1} value={Math.round(adj.dx)} onChange={(ev) => onChange((p) => setAdjust(p, sel.id, { ...adj, dx: parseFloat(ev.target.value) || 0 }))} />
            </label>
            <label className="field">
              <span className="label">Sposta Y</span>
              <input type="number" step={1} value={Math.round(adj.dy)} onChange={(ev) => onChange((p) => setAdjust(p, sel.id, { ...adj, dy: parseFloat(ev.target.value) || 0 }))} />
            </label>
            <label className="field">
              <span className="label">Scala %</span>
              <input
                type="number"
                step={1}
                min={20}
                max={500}
                value={Math.round(adj.s * 100)}
                onChange={(ev) => onChange((p) => setAdjust(p, sel.id, { ...adj, s: Math.min(5, Math.max(0.2, (parseFloat(ev.target.value) || 100) / 100)) }))}
              />
            </label>
          </div>
          <div className="row">
            <button className="btn small ghost" onClick={() => onChange((p) => setAdjust(p, sel.id, null))}>
              Rimetti com’era
            </button>
          </div>
        </div>
      )}
      {sel && layer && (
        <p className="help">
          Livello «{layer.name}»: posizione {layer.props.x}% · {layer.props.y}%.{' '}
          {scaleLayer(layer, 1) ? 'Si scala dalla maniglia.' : 'Per la dimensione usa lo stile o la larghezza nei campi del livello.'}
        </p>
      )}
      {touched && (
        <div className="row">
          <button className="btn small ghost" onClick={onResetAll}>
            Rimetti tutto com’era in questo formato
          </button>
        </div>
      )}
    </details>
  );
}
