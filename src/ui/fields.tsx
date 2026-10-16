import { useEffect, useRef, useState } from 'react';
import { drawParts } from '../brand/draw';
import { SYMBOLS, getSymbol } from '../brand/symbols';
import { PALETTE, PALETTE_LABEL, PALETTE_NAMES, resolveColor } from '../brand/tokens';
import type { Field, Layer, Props } from '../engine/types';
import { LAYER_TYPES, newLayer } from '../templates/libera';

interface Ctx {
  strict: boolean;
}

export function FieldList({ fields, values, onChange, ctx }: { fields: Field[]; values: Props; onChange: (key: string, v: any) => void; ctx: Ctx }) {
  const visible = fields.filter((f) => (!f.when || f.when(values)) && !(ctx.strict && f.free));
  const groups: [string, Field[]][] = [];
  for (const f of visible) {
    const g = f.group ?? 'Parametri';
    let entry = groups.find((x) => x[0] === g);
    if (!entry) groups.push((entry = [g, []]));
    entry[1].push(f);
  }
  return (
    <>
      {groups.map(([g, fs]) => (
        <details key={g} className="group" open>
          <summary>{g}</summary>
          {fs.map((f) => (
            <FieldControl key={f.key} field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} ctx={ctx} />
          ))}
        </details>
      ))}
    </>
  );
}

function FieldControl({ field: f, value, onChange, ctx }: { field: Field; value: any; onChange: (v: any) => void; ctx: Ctx }) {
  const v = value ?? (f as any).default;
  const label = (
    <span className="label">
      {f.label}
      {f.free && <em className="free"> · libero</em>}
    </span>
  );
  const help = f.help ? <small className="help">{f.help}</small> : null;
  switch (f.type) {
    case 'text':
      return (
        <label className="field">
          {label}
          <input type="text" value={v} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
          {help}
        </label>
      );
    case 'textarea':
      return (
        <label className="field">
          {label}
          <textarea rows={f.rows ?? 3} value={v} onChange={(e) => onChange(e.target.value)} />
          {help}
        </label>
      );
    case 'number':
      return (
        <label className="field">
          {label}
          <div className="num">
            <input type="range" min={f.min} max={f.max} step={f.step ?? 1} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} />
            <input type="number" min={f.min} max={f.max} step={f.step ?? 1} value={v} onChange={(e) => onChange(e.target.value === '' ? f.default : parseFloat(e.target.value))} />
            {f.unit && <span className="unit">{f.unit}</span>}
          </div>
          {help}
        </label>
      );
    case 'select':
      return (
        <label className="field">
          {label}
          <select value={v} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </label>
      );
    case 'boolean':
      return (
        <label className="field check">
          <input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} />
          {label}
          {help}
        </label>
      );
    case 'color':
      return (
        <div className="field">
          {label}
          <ColorPicker value={v} onChange={onChange} extra={f.extra} only={f.only} strict={ctx.strict} />
          {help}
        </div>
      );
    case 'symbol':
      return (
        <div className="field">
          {label}
          <div className="symbols">
            {f.allowNone && (
              <button className={'sym none' + (v === 'nessuno' || !v ? ' on' : '')} onClick={() => onChange('nessuno')} title="Nessuno">
                ∅
              </button>
            )}
            {SYMBOLS.map((s) => (
              <button key={s.id} className={'sym' + (v === s.id ? ' on' : '')} onClick={() => onChange(s.id)} title={`${s.n} · ${s.name}`}>
                <SymbolIcon id={s.id} color={v === s.id ? '#FFFFFF' : '#705EF2'} />
              </button>
            ))}
          </div>
          <small className="help">{v && v !== 'nessuno' ? `${getSymbol(v).n} · ${getSymbol(v).name}` : 'Nessun simbolo'}</small>
        </div>
      );
    case 'image':
      return (
        <div className="field">
          {label}
          <ImagePicker value={v} onChange={onChange} />
          {help}
        </div>
      );
    case 'svg':
      return (
        <div className="field">
          {label}
          <SvgPicker value={v} onChange={onChange} />
          {help}
        </div>
      );
    case 'layers':
      return <LayersEditor layers={v} onChange={onChange} ctx={ctx} />;
  }
}

export function ColorPicker({ value, onChange, extra, only, strict }: { value: string; onChange: (v: string) => void; extra?: { value: string; label: string }[]; only?: string[]; strict: boolean }) {
  const names = only ?? PALETTE_NAMES;
  const isHex = typeof value === 'string' && value.startsWith('#');
  return (
    <div className="colors">
      {extra?.map((x) => (
        <button key={x.value} className={'chip' + (value === x.value ? ' on' : '')} onClick={() => onChange(x.value)}>
          {x.value === 'iridescente' && <span className="iri" />}
          {x.label}
        </button>
      ))}
      {names.map((n) => (
        <button
          key={n}
          className={'swatch' + (value === n ? ' on' : '')}
          style={{ background: PALETTE[n as keyof typeof PALETTE] }}
          title={`${PALETTE_LABEL[n as keyof typeof PALETTE]} ${PALETTE[n as keyof typeof PALETTE]}`}
          onClick={() => onChange(n)}
        />
      ))}
      {!strict && (
        <label className={'swatch custom' + (isHex ? ' on' : '')} title="Colore libero (fuori dalla palette)">
          <input type="color" value={isHex ? value : resolveColor(value, '#705EF2')} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        </label>
      )}
    </div>
  );
}

export function SymbolIcon({ id, color = 'currentColor' }: { id: string; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const col = color === 'currentColor' ? getComputedStyle(c).color : color;
    drawParts(ctx, getSymbol(id).parts, 4, 4, c.width - 8, { mode: 'piatto', color: col });
  }, [id, color]);
  return <canvas ref={ref} width={64} height={64} />;
}

async function fileToDataUrl(file: File, max = 2400): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const png = file.type === 'image/png' || file.type === 'image/webp';
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ImagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [drag, setDrag] = useState(false);
  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith('image/')) onChange(await fileToDataUrl(f));
  };
  return (
    <div
      className={'drop' + (drag ? ' drag' : '')}
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => (e.preventDefault(), setDrag(false), pick(e.dataTransfer.files))}
    >
      {value ? <img src={value} alt="" /> : <span>Trascina qui una fotografia o</span>}
      <div className="row">
        <label className="btn small">
          Scegli…
          <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
        </label>
        {value && (
          <button className="btn small ghost" onClick={() => onChange('')}>
            Togli
          </button>
        )}
      </div>
    </div>
  );
}

function SvgPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (f) onChange(await f.text());
  };
  return (
    <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), pick(e.dataTransfer.files))}>
      <span>{value ? 'Disegno caricato' : 'Trascina un file SVG o'}</span>
      <div className="row">
        <label className="btn small">
          Scegli…
          <input type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => pick(e.target.files)} />
        </label>
        {value && (
          <button className="btn small ghost" onClick={() => onChange('')}>
            Togli
          </button>
        )}
      </div>
    </div>
  );
}

function LayersEditor({ layers, onChange, ctx }: { layers: Layer[]; onChange: (v: Layer[]) => void; ctx: Ctx }) {
  const [sel, setSel] = useState<string | null>(layers[layers.length - 1]?.id ?? null);
  const current = layers.find((l) => l.id === sel) ?? null;
  const update = (id: string, patch: Partial<Layer>) => onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const move = (id: string, d: number) => {
    const i = layers.findIndex((l) => l.id === id);
    const j = i + d;
    if (j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (type: string) => {
    const l = newLayer(type);
    onChange([...layers, l]);
    setSel(l.id);
  };
  return (
    <div className="layers">
      <div className="layer-add">
        {Object.entries(LAYER_TYPES).map(([k, t]) => (
          <button key={k} className="btn small ghost" onClick={() => add(k)}>
            + {t.label}
          </button>
        ))}
      </div>
      <ol className="layer-list">
        {[...layers].reverse().map((l) => (
          <li key={l.id} className={l.id === sel ? 'on' : ''} onClick={() => setSel(l.id)}>
            <button className="icon" title={l.hidden ? 'Mostra' : 'Nascondi'} onClick={(e) => (e.stopPropagation(), update(l.id, { hidden: !l.hidden }))}>
              {l.hidden ? '○' : '●'}
            </button>
            <input value={l.name} onChange={(e) => update(l.id, { name: e.target.value })} onClick={(e) => e.stopPropagation()} />
            <button className="icon" title="Sopra" onClick={(e) => (e.stopPropagation(), move(l.id, 1))}>
              ↑
            </button>
            <button className="icon" title="Sotto" onClick={(e) => (e.stopPropagation(), move(l.id, -1))}>
              ↓
            </button>
            <button
              className="icon"
              title="Duplica"
              onClick={(e) => {
                e.stopPropagation();
                const copy = { ...structuredClone(l), id: newLayer(l.type).id, name: l.name + ' copia' };
                onChange([...layers, copy]);
                setSel(copy.id);
              }}
            >
              ⧉
            </button>
            <button className="icon" title="Elimina" onClick={(e) => (e.stopPropagation(), onChange(layers.filter((x) => x.id !== l.id)))}>
              ×
            </button>
          </li>
        ))}
      </ol>
      {current && (
        <div className="layer-props">
          <FieldList
            fields={LAYER_TYPES[current.type].fields}
            values={current.props}
            onChange={(k, v) => update(current.id, { props: { ...current.props, [k]: v } })}
            ctx={ctx}
          />
        </div>
      )}
    </div>
  );
}
