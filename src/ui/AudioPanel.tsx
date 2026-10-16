import { useEffect, useRef, useState } from 'react';
import { detectBeat, newTrack, waveform, type AudioTrack } from '../engine/audio';
import type { Project } from '../engine/types';

/** Traccia audio: file, punto di partenza sulla forma d'onda, volume, dissolvenze, ritmo. */
export function AudioPanel({
  project,
  setProject,
  videoSeconds,
  offset,
  muted,
  setMuted,
  onNotice,
}: {
  project: Project;
  setProject: (fn: (p: Project) => Project) => void;
  /** Durata di ciò che si sta guardando (slide o serie). */
  videoSeconds: number;
  /** Secondi tra l'inizio della serie e l'inizio di ciò che si guarda. */
  offset: number;
  muted: boolean;
  setMuted: (m: boolean) => void;
  onNotice: (s: string) => void;
}) {
  const a = project.audio;
  const [wave, setWave] = useState<{ peaks: Float32Array; duration: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  const set = (patch: Partial<AudioTrack>) => setProject((p) => (p.audio ? { ...p, audio: { ...p.audio, ...patch } } : p));

  useEffect(() => {
    setWave(null);
    if (!a?.src) return;
    waveform(a.src)
      .then(setWave)
      .catch(() => onNotice('Il file audio non si legge: prova un MP3, WAV o M4A.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.src]);

  // Forma d'onda, tratto usato dal video, battiti.
  useEffect(() => {
    const c = ref.current;
    if (!c || !wave || !a) return;
    const ctx = c.getContext('2d')!;
    const W = c.width,
      H = c.height;
    ctx.clearRect(0, 0, W, H);
    const x0 = ((a.start + offset) / wave.duration) * W;
    const x1 = ((a.start + offset + videoSeconds) / wave.duration) * W;
    ctx.fillStyle = 'rgba(112,94,242,0.14)';
    ctx.fillRect(x0, 0, x1 - x0, H);
    const n = wave.peaks.length;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * W;
      const h = Math.max(1, wave.peaks[i] * (H - 6));
      ctx.fillStyle = x >= x0 && x <= x1 ? '#705EF2' : '#b9b3e6';
      ctx.fillRect(x, (H - h) / 2, Math.max(1, W / n - 0.5), h);
    }
    if (a.bpm > 0) {
      const period = 60 / a.bpm;
      ctx.fillStyle = a.sync ? 'rgba(255,74,117,0.7)' : 'rgba(17,17,20,0.18)';
      let t = a.beatOffset - Math.ceil(a.beatOffset / period) * period;
      for (; t < wave.duration; t += period) if (t >= 0) ctx.fillRect((t / wave.duration) * W, H - 5, 1, 5);
    }
    ctx.fillStyle = '#FF4A75';
    ctx.fillRect(x0, 0, 2, H);
  }, [wave, a, videoSeconds, offset]);

  const load = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return onNotice('Serve un file audio (MP3, WAV, M4A…).');
    if (file.size > 25e6) onNotice('File audio grande: il progetto salvato crescerà di conseguenza.');
    const src = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
    setProject((p) => ({ ...p, audio: newTrack(src, file.name) }));
  };

  const detect = async () => {
    if (!a) return;
    setBusy(true);
    try {
      const r = await detectBeat(a.src, a.start);
      if (r) {
        set({ bpm: r.bpm, beatOffset: r.offset });
        onNotice(`Ritmo rilevato: ${r.bpm} BPM. Se sembra il doppio o la metà, correggilo a mano.`);
      } else onNotice('Ritmo non rilevato: inserisci i BPM a mano.');
    } finally {
      setBusy(false);
    }
  };

  if (!a) {
    return (
      <label
        className={'drop' + (drag ? ' drag' : '')}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), load(e.dataTransfer.files[0]))}
      >
        <span>Trascina qui una musica (MP3, WAV, M4A) o scegli un file</span>
        <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" hidden onChange={(e) => load(e.target.files?.[0])} />
      </label>
    );
  }

  const short = wave && a.start + offset + videoSeconds > wave.duration;
  return (
    <div className="audio">
      <div className="audio-head">
        <b title={a.name}>♪ {a.name}</b>
        <button className="icon" title={muted ? 'Riattiva in anteprima' : 'Silenzia in anteprima'} onClick={() => setMuted(!muted)}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="icon" title="Togli la musica" onClick={() => setProject((p) => ({ ...p, audio: undefined }))}>
          ×
        </button>
      </div>
      <canvas
        ref={ref}
        className="wave"
        width={640}
        height={64}
        title="Clicca per far partire il video da questo punto della traccia"
        onClick={(e) => {
          if (!wave) return;
          const r = e.currentTarget.getBoundingClientRect();
          const t = ((e.clientX - r.left) / r.width) * wave.duration - offset;
          set({ start: Math.max(0, Math.round(t * 100) / 100) });
        }}
      />
      <small className="help">
        {wave ? `Traccia ${wave.duration.toFixed(1)} s · video ${videoSeconds.toFixed(1)} s dal secondo ${(a.start + offset).toFixed(2)}.` : 'Lettura della traccia…'}
        {short && ' La traccia finisce prima del video: il resto è in silenzio.'}
      </small>
      <div className="row3">
        <label className="field">
          <span className="label">Parte da (s)</span>
          <input type="number" min={0} step={0.05} value={a.start} onChange={(e) => set({ start: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </label>
        <label className="field">
          <span className="label">Entrata (s)</span>
          <input type="number" min={0} max={10} step={0.1} value={a.fadeIn} onChange={(e) => set({ fadeIn: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </label>
        <label className="field">
          <span className="label">Uscita (s)</span>
          <input type="number" min={0} max={10} step={0.1} value={a.fadeOut} onChange={(e) => set({ fadeOut: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </label>
      </div>
      <label className="field">
        <span className="label">Volume</span>
        <div className="num">
          <input type="range" min={0} max={1} step={0.01} value={a.volume} onChange={(e) => set({ volume: parseFloat(e.target.value) })} />
          <input type="number" min={0} max={100} step={1} value={Math.round(a.volume * 100)} onChange={(e) => set({ volume: Math.min(1, Math.max(0, (parseFloat(e.target.value) || 0) / 100)) })} />
          <span className="unit">%</span>
        </div>
      </label>
      <div className="row">
        <label className="field" style={{ flex: 1, margin: 0 }}>
          <span className="label">Battiti al minuto</span>
          <input type="number" min={0} max={300} step={0.5} value={a.bpm || ''} placeholder="—" onChange={(e) => set({ bpm: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </label>
        <button className="btn small ghost" style={{ alignSelf: 'flex-end' }} disabled={busy} onClick={detect}>
          {busy ? 'Ascolto…' : 'Rileva'}
        </button>
      </div>
      <label className="field check">
        <input type="checkbox" checked={a.sync} disabled={!a.bpm} onChange={(e) => set({ sync: e.target.checked })} />
        <span className="label">Animazioni a tempo di musica</span>
        <small className="help">Pulsazione e onda dei simboli e rotazioni di 90° delle composizioni seguono i battiti.</small>
      </label>
    </div>
  );
}
