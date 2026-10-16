// Composizioni per video e caroselli: apertura e chiusura con il marchio, i sette ambiti
// in sequenza, composizione di forme dal vocabolario, copertina dei caroselli LinkedIn.
import { drawDuotone, drawImageCover, drawLockup, drawLogotypeReveal, drawMonogram, drawMonogramBox, drawNextButton, drawParts, lockupSize, logotypeWidth, monogramSize, partStates, type Fill } from '../brand/draw';
import { FORMS, SYMBOLS, type FormId } from '../brand/symbols';
import { ACCOUNT, ATENEI, DUOTONE, LOCKUP, PALETTE, resolveColor, TINTS, type PaletteName } from '../brand/tokens';
import { clamp, Easing, getEasing, rng } from '../engine/anim';
import { font } from '../engine/fonts';
import { layoutText, textAnimEnd, type TextAnim } from '../engine/text';
import type { Composition, FrameInfo, Props } from '../engine/types';
import { drawFondo, exitProgress, placeText, fondoFields, inkFor, IRI_STYLES, ritmoFields, styleOf, t0, testataFields, drawTestata, titleStyle } from './common';
import { FILL_OPTIONS, motionOf, placeSymbol } from './symbol-helpers';

// ---------------------------------------------------------------------------
// Apertura e chiusura con il marchio
// ---------------------------------------------------------------------------

export const marchio: Composition = {
  id: 'marchio',
  name: 'Apertura e chiusura',
  source: 'Marchio: configurazioni e costruzione (p. 12-14); quale configurazione usare (p. 14)',
  description: 'Il marchio si compone lettera per lettera; i sette simboli possono scorrere prima della firma. Per aprire o chiudere un video.',
  category: 'Video',
  defaultFormat: 'ig-story',
  defaultDuration: 4,
  fields: [
    {
      type: 'select',
      key: 'configurazione',
      label: 'Configurazione',
      group: 'Marchio',
      default: 'lockup',
      options: [
        { value: 'lockup', label: 'Lockup orizzontale (il corso per esteso)' },
        { value: 'monogramma', label: 'Monogramma' },
        { value: 'logotipo', label: 'Logotipo' },
      ],
    },
    { type: 'number', key: 'altezza', label: 'Altezza della maiuscola', group: 'Marchio', default: 120, min: 29, max: 400, step: 1, unit: 'px' },
    {
      type: 'select',
      key: 'simboli',
      label: 'Simboli',
      group: 'Marchio',
      default: 'sequenza',
      options: [
        { value: 'nessuno', label: 'Nessuno' },
        { value: 'sequenza', label: 'I sette simboli in sequenza, poi il marchio' },
        { value: 'fila', label: 'I sette simboli in fila sotto il marchio' },
      ],
    },
    { type: 'number', key: 'tempoSimbolo', label: 'Tempo per simbolo', group: 'Marchio', default: 0.28, min: 0.1, max: 2, step: 0.02, unit: 's', when: (p) => p.simboli === 'sequenza' },
    { type: 'select', key: 'riempimento', label: 'Versione dei simboli', group: 'Marchio', default: 'piatto', options: FILL_OPTIONS, when: (p) => p.simboli !== 'nessuno' },
    { type: 'select', key: 'simboloIri', label: 'Materia', group: 'Marchio', default: 'raggiera', options: IRI_STYLES, when: (p) => p.riempimento === 'iridescente' },
    { type: 'boolean', key: 'atenei', label: 'Atenei in basso', group: 'Testi', default: true },
    { type: 'boolean', key: 'account', label: 'Nome dell’account', group: 'Testi', default: false },
    { type: 'color', key: 'inchiostro', label: 'Colore del marchio', group: 'Marchio', default: 'auto', extra: [{ value: 'auto', label: 'Automatico (regola del manuale)' }], only: ['nero', 'bianco'] },
    ...fondoFields('viola'),
    ...ritmoFields({ text: false, shapes: false, loop: false }),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    const ease = getEasing(p.curva);
    const cap = (p.altezza ?? 120) * s;
    if (cap < 29 * s) env.warn('Logotipo sotto i 29 px dei modelli social.');
    let markStart = start;
    // Sequenza dei sette simboli al centro.
    if (p.simboli === 'sequenza') {
      const per = env.sec(p.tempoSimbolo ?? 0.28);
      const size = Math.min(f.width, f.height) * 0.42;
      const i = Math.floor((f.frame - start) / per);
      if (f.frame >= start && i < SYMBOLS.length) {
        const local = (f.frame - start) - i * per;
        const sym = SYMBOLS[i];
        const fill: Fill = {
          mode: p.riempimento,
          color: ink,
          iri: { style: p.simboloIri ?? 'raggiera', time: f.time, seed: i * 11, rays: 0.9 },
        };
        const pop = Easing.out(clamp(local / Math.max(1, per * 0.5)));
        const sx = (f.width - size) / 2,
          sy = (f.height - size) / 2;
        env.place('sequenza', 'Sequenza dei simboli', { x: sx, y: sy, w: size, h: size }, () =>
          drawParts(ctx, sym.parts, sx, sy, size, fill, undefined, { globalScale: 0.85 + 0.15 * pop }),
        );
      }
      markStart = start + SYMBOLS.length * per;
    }
    if (f.frame < markStart) return;
    const lf = f.frame - markStart;
    const a = 1 - out;
    // Marchio: le righe salgono dalla maschera una dopo l'altra.
    ctx.save();
    ctx.globalAlpha *= a;
    const conf: string = p.configurazione ?? 'lockup';
    const size = conf === 'logotipo' ? { w: logotypeWidth(ctx, cap), h: cap } : conf === 'monogramma' ? monogramSize(ctx, cap) : lockupSize(ctx, cap);
    const mw = size.w;
    const mh = size.h;
    const x = (f.width - mw) / 2;
    const yTop = (f.height - mh) / 2 - (p.simboli === 'fila' ? cap * 0.6 : 0);
    const reveal = (i: number) => ease(clamp((lf - i * env.sec(0.12)) / env.sec(0.55)));
    env.place(
      'marchio',
      'Marchio',
      { x, y: yTop, w: mw, h: mh },
      () => {
        if (conf === 'logotipo') drawLogotypeReveal(ctx, x, yTop, cap, ink, reveal(0));
        else if (conf === 'monogramma') drawMonogram(ctx, x, yTop, cap, ink, [reveal(0), reveal(1)]);
        else drawLockup(ctx, x, yTop, cap, ink, [reveal(0), reveal(1), clamp((lf - env.sec(0.35)) / env.sec(0.7))]);
      },
      'marchio',
    );
    ctx.restore();
    // Fila dei simboli.
    if (p.simboli === 'fila') {
      const n = SYMBOLS.length;
      const gap = 0.35;
      const sz = Math.min((f.width - f.safe.left - f.safe.right) / (n + (n - 1) * gap), cap * 0.9);
      const total = n * sz + (n - 1) * gap * sz;
      const sx = (f.width - total) / 2;
      const sy = yTop + mh + cap * 1.1;
      env.place('fila', 'Fila dei simboli', { x: sx, y: sy, w: total, h: sz }, () => SYMBOLS.forEach((sym, i) => {
        const fill: Fill = { mode: p.riempimento, color: ink, iri: { style: p.simboloIri ?? 'raggiera', time: f.time, seed: i * 11, rays: 0.9 } };
        const m = { anim: 'assembla' as const, frame: f.frame, fps: f.fps, start: markStart + env.sec(0.5 + i * 0.08), dur: env.sec(0.5), stagger: env.sec(0.04), easing: p.curva, out };
        drawParts(ctx, sym.parts, sx + i * sz * (1 + gap), sy, sz, fill, partStates(sym.parts, m));
      }));
    }
    // Atenei e account.
    const fst = styleOf('fonte26', s);
    const fa = Easing.out(clamp((lf - env.sec(0.7)) / env.sec(0.6))) * a;
    ctx.save();
    ctx.globalAlpha *= fa;
    ctx.fillStyle = ink;
    ctx.font = font('titolo', 500, fst.size);
    ctx.textBaseline = 'alphabetic';
    const by = f.height - f.safe.bottom;
    if (p.atenei) {
      // Come nel poster: due atenei con una linea tra loro (p. 35).
      const left = ATENEI[0].toUpperCase();
      const right = ATENEI[1].toUpperCase();
      (ctx as any).letterSpacing = `${0.04 * fst.size}px`;
      const wl = ctx.measureText(left).width;
      const wr = ctx.measureText(right).width;
      const avail = f.width - f.safe.left - f.safe.right;
      const line = Math.max(40 * s, avail - wl - wr - 60 * s);
      const total = wl + wr + line + 60 * s;
      const lx = (f.width - total) / 2;
      env.place('atenei', 'Atenei', { x: lx, y: by - fst.size * 0.8, w: total, h: fst.size }, () => {
        ctx.fillText(left, lx, by);
        ctx.fillText(right, lx + total - wr, by);
        ctx.fillRect(lx + wl + 30 * s, by - fst.size * 0.35, line * Easing.inOut(fa), Math.max(1, 2 * s));
      }, 'testo');
    }
    if (p.account) {
      (ctx as any).letterSpacing = '0px';
      const w = ctx.measureText('@' + ACCOUNT).width;
      const ay = by - (p.atenei ? 70 * s : 0);
      env.place('account', 'Account', { x: (f.width - w) / 2, y: ay - fst.size * 0.8, w, h: fst.size }, () => ctx.fillText('@' + ACCOUNT, (f.width - w) / 2, ay), 'testo');
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------------------
// I sette ambiti in sequenza
// ---------------------------------------------------------------------------

export const setteAmbiti: Composition = {
  id: 'sette-ambiti',
  name: 'I 7 ambiti',
  source: 'I sette simboli, nomi e ordine della serie «I 7 ambiti» (p. 36-40)',
  description: 'Un ambito dopo l’altro: il simbolo si compone, il nome entra, poi lascia il posto al successivo.',
  category: 'Video',
  defaultFormat: 'ig-story',
  defaultDuration: 21,
  fields: [
    { type: 'number', key: 'perAmbito', label: 'Secondi per ambito', group: 'Sequenza', default: 3, min: 1, max: 10, step: 0.5, unit: 's' },
    { type: 'boolean', key: 'definizione', label: 'Mostra la definizione', group: 'Sequenza', default: true },
    { type: 'boolean', key: 'numero', label: 'Numero nell’etichetta (1/7)', group: 'Sequenza', default: true },
    {
      type: 'select',
      key: 'colori',
      label: 'Fondi',
      group: 'Sequenza',
      default: 'ciclo',
      options: [
        { value: 'ciclo', label: 'Un colore per ambito (viola, fucsia, verde, giallo…)' },
        { value: 'fisso', label: 'Sempre lo stesso fondo' },
      ],
    },
    { type: 'select', key: 'riempimento', label: 'Versione dei simboli', group: 'Simbolo', default: 'piatto', options: FILL_OPTIONS },
    { type: 'select', key: 'simboloIri', label: 'Materia', group: 'Simbolo', default: 'raggiera', options: IRI_STYLES, when: (p) => p.riempimento === 'iridescente' },
    { type: 'number', key: 'dimensione', label: 'Dimensione del simbolo', group: 'Simbolo', default: 62, min: 20, max: 100, step: 1, unit: '% della larghezza' },
    ...fondoFields('viola').map((fl) => ({ ...fl, when: (p: Props) => p.colori === 'fisso' && (!fl.when || fl.when(p)) })),
    ...testataFields('I 7 ambiti'),
    ...ritmoFields({ text: true, shapes: true, loop: false }),
  ],
  render(ctx, f, p, env) {
    const perFrames = Math.max(1, Math.round((p.perAmbito ?? 3) * f.fps));
    const i = Math.min(6, Math.floor(f.frame / perFrames));
    const local = f.frame - i * perFrames;
    const sym = SYMBOLS[i];
    const bgName: string = p.colori === 'ciclo' ? TINTS[i % TINTS.length] : p.fondo;
    const props: Props = { ...p, fondo: bgName, etichetta: p.etichetta && p.numero ? `${p.etichetta} · ${i + 1}/7` : p.etichetta };
    const lf: FrameInfo = { ...f, frame: local };
    drawFondo(ctx, f, props, env);
    const ink = inkFor(props, bgName, env);
    drawTestata(ctx, { ...lf, frame: i === 0 ? local : 1e6 }, props, env, ink);
    const s = f.s;
    const outN = Math.min(perFrames * 0.25, env.sec(0.45));
    const out = i < 6 || p.uscita === 'dissolvenza' ? clamp((local - (perFrames - outN)) / outN) : 0;
    const size = (f.width * (p.dimensione ?? 62)) / 100;
    const fill: Fill = {
      mode: p.riempimento,
      color: ink,
      iri: { style: p.simboloIri ?? 'raggiera', time: f.time, seed: i * 13, rays: 0.9 },
    };
    const m = motionOf({ ...p, durataParti: 0.6, sfalsamento: 0.07 }, lf, env, env.sec(0.1), out);
    const sy = f.safe.top + 140 * s;
    placeSymbol(ctx, env, sym.id, (f.width - size) / 2, sy, size, fill, m);
    // Nome e definizione.
    const o = { anim: (p.animTesto ?? 'maschera') as TextAnim, start: env.sec(0.35), dur: env.sec(0.5), stagger: env.sec(0.07), easing: p.curva, out };
    let ty = sy + size + 90 * s;
    const lt = layoutText(ctx, sym.name, titleStyle({ corpoTitolo: 'titolo80' }, sym.name, s), f.width - f.safe.left - f.safe.right);
    placeText(ctx, env, 'nome', 'Nome dell’ambito', lt, f.safe.left, ty, { ...o, color: ink, frame: local });
    ty += lt.height + 36 * s;
    if (p.definizione) {
      const l = layoutText(ctx, sym.definition, styleOf('testo38', s), f.width - f.safe.left - f.safe.right);
      placeText(ctx, env, 'definizione', 'Definizione', l, f.safe.left, ty, { ...o, start: textAnimEnd(lt, o) - env.sec(0.2), color: ink, frame: local });
    }
  },
};

// ---------------------------------------------------------------------------
// Composizione di forme (vocabolario, p. 35)
// ---------------------------------------------------------------------------

const FORM_SETS: Record<string, FormId[]> = {
  tutte: ['cerchio', 'semicerchio', 'coppia', 'quarto', 'ciotole', 'corone', 'quartoCorona', 'mezzaCorona'],
  cerchi: ['cerchio', 'semicerchio', 'coppia', 'quarto'],
  corone: ['corone', 'quartoCorona', 'mezzaCorona', 'cerchio'],
  quarti: ['quarto', 'quartoCorona', 'semicerchio'],
};

export const composizione: Composition = {
  id: 'composizione',
  name: 'Composizione di forme',
  source: 'Concept visivo e vocabolario delle forme (p. 35); rotazioni di 90° ammesse nelle composizioni',
  description: 'Una griglia di forme del vocabolario che si compone e ruota di 90°. Per teaser, sfondi e chiusure.',
  category: 'Video',
  defaultFormat: 'ig-post',
  defaultDuration: 8,
  fields: [
    { type: 'number', key: 'colonne', label: 'Colonne', group: 'Griglia', default: 4, min: 2, max: 10, step: 1 },
    { type: 'number', key: 'spazio', label: 'Spazio tra le forme', group: 'Griglia', default: 4, min: 0, max: 40, step: 1, unit: 'px' },
    { type: 'number', key: 'vuoti', label: 'Celle vuote', group: 'Griglia', default: 8, min: 0, max: 80, step: 1, unit: '%' },
    { type: 'number', key: 'seme', label: 'Variante', group: 'Griglia', default: 12, min: 0, max: 999, step: 1 },
    { type: 'select', key: 'insieme', label: 'Forme', group: 'Griglia', default: 'tutte', options: [
      { value: 'tutte', label: 'Tutto il vocabolario' },
      { value: 'cerchi', label: 'Cerchi, semicerchi, quarti' },
      { value: 'corone', label: 'Corone' },
      { value: 'quarti', label: 'Quarti e semicerchi' },
    ] },
    { type: 'color', key: 'coloreA', label: 'Colore delle forme', group: 'Colori', default: 'fucsia' },
    { type: 'color', key: 'coloreB', label: 'Secondo colore (facoltativo)', group: 'Colori', default: 'nessuno', extra: [{ value: 'nessuno', label: 'Nessuno: un colore' }] },
    { type: 'select', key: 'riempimento', label: 'Versione', group: 'Colori', default: 'piatto', options: FILL_OPTIONS },
    {
      type: 'select',
      key: 'onda',
      label: 'Ordine di ingresso',
      group: 'Animazione',
      default: 'diagonale',
      options: [
        { value: 'diagonale', label: 'In diagonale' },
        { value: 'righe', label: 'Per righe' },
        { value: 'centro', label: 'Dal centro' },
        { value: 'caso', label: 'A caso' },
      ],
    },
    { type: 'number', key: 'rotazioni', label: 'Rotazioni di 90° ogni', group: 'Animazione', default: 1.6, min: 0, max: 10, step: 0.1, unit: 's (0 = mai)' },
    {
      type: 'select',
      key: 'firma',
      label: 'Firma',
      group: 'Testi',
      default: 'lockup',
      options: [
        { value: 'nessuna', label: 'Nessuna (solo forme)' },
        { value: 'lockup', label: 'Lockup DSSA in basso' },
        { value: 'titolo', label: 'Titolo in basso' },
      ],
    },
    { type: 'textarea', key: 'titolo', label: 'Titolo', group: 'Testi', default: 'Si impara progettando', rows: 2, when: (p) => p.firma === 'titolo' },
    {
      type: 'color',
      key: 'coloreFirma',
      label: 'Colore della firma',
      group: 'Testi',
      default: 'forme',
      extra: [
        { value: 'forme', label: 'Come le forme' },
        { value: 'auto', label: 'Automatico' },
      ],
      when: (p) => p.firma === 'lockup',
    },
    { type: 'number', key: 'altezzaFirma', label: 'Altezza della firma', group: 'Testi', default: 30, min: 10, max: 60, step: 1, unit: '% dell’altezza', when: (p) => p.firma !== 'nessuna' },
    ...fondoFields('bianco'),
    ...ritmoFields({ text: false, shapes: true, loop: false }),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor({ ...p, inchiostro: 'auto' }, p.fondo, env);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    const ease = getEasing(p.curva);
    const margin = f.safe.left;
    const firmaH = p.firma === 'nessuna' ? 0 : (f.height * (p.altezzaFirma ?? 30)) / 100;
    const areaW = f.width - margin * 2;
    const areaH = f.height - f.safe.top - f.safe.bottom - firmaH;
    const cols = Math.max(2, Math.round(p.colonne ?? 4));
    const gap = (p.spazio ?? 4) * s;
    const cell = (areaW - gap * (cols - 1)) / cols;
    const rows = Math.max(1, Math.floor((areaH + gap) / (cell + gap)));
    const oy = f.safe.top + (areaH - (rows * cell + (rows - 1) * gap)) / 2;
    const r = rng(p.seme ?? 12);
    const set = FORM_SETS[p.insieme] ?? FORM_SETS.tutte;
    const colA = resolveColor(p.coloreA, PALETTE.fucsia);
    const colB = p.coloreB && p.coloreB !== 'nessuno' ? resolveColor(p.coloreB) : colA;
    const cells: { i: number; j: number; form: FormId; rot: number; color: string; order: number; empty: boolean }[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const form = set[Math.floor(r() * set.length)];
        const rot = Math.floor(r() * 4);
        const color = r() < 0.5 ? colA : colB;
        const empty = r() * 100 < (p.vuoti ?? 8);
        const rnd = r();
        let order = i + j;
        if (p.onda === 'righe') order = j * cols + i;
        if (p.onda === 'centro') order = Math.hypot(i - (cols - 1) / 2, j - (rows - 1) / 2) * 2;
        if (p.onda === 'caso') order = rnd * (cols + rows);
        cells.push({ i, j, form, rot, color, order, empty });
      }
    const maxOrder = Math.max(1, ...cells.map((c) => c.order));
    const spread = env.sec(1.2);
    const every = p.rotazioni > 0 ? env.sec(p.rotazioni) : 0;
    env.place('forme', 'Composizione di forme', { x: margin, y: oy, w: areaW, h: rows * cell + (rows - 1) * gap }, () => cells.forEach((c, k) => {
      if (c.empty) return;
      const st = start + (c.order / maxOrder) * spread;
      const e = ease(clamp((f.frame - st) / env.sec(0.6)));
      if (e <= 0) return;
      // Rotazioni di 90° a turno, dopo l'ingresso: a ogni battuta gira una cella su tre.
      let rot = c.rot * (Math.PI / 2);
      if (every > 0) {
        const after = f.frame - (start + spread + env.sec(0.8));
        if (after > 0) {
          // Con la musica agganciata la battuta dura un numero intero di battiti.
          let pos = after / every;
          if (env.beats) {
            const bpm = env.beats(61) - env.beats(1);
            const perBeat = Math.max(1, Math.round(((p.rotazioni ?? 1.6) * bpm) / 60));
            const t1 = (start + spread + env.sec(0.8)) / f.fps;
            pos = (env.beats(f.time) - env.beats(t1)) / perBeat;
          }
          const tick = Math.floor(pos);
          const fr = pos - tick;
          const r0 = (((-k) % 3) + 3) % 3;
          const done = tick > r0 ? Math.floor((tick - r0 - 1) / 3) + 1 : 0;
          rot += done * (Math.PI / 2);
          if ((k + tick) % 3 === 0) rot += ease(clamp(fr * 2.5)) * (Math.PI / 2);
        }
      }
      const fill: Fill = { mode: p.riempimento, color: c.color, iri: { style: 'raggiera', time: f.time, seed: k, rays: 0.8 } };
      const form = FORMS.find((x) => x.id === c.form)!;
      const x = margin + c.i * (cell + gap);
      const y = oy + c.j * (cell + gap);
      const sc = (p.animForme === 'nessuna' ? 1 : e) * (1 - Easing.in(out));
      ctx.save();
      ctx.globalAlpha *= p.animForme === 'dissolvenza' ? e : 1;
      drawParts(ctx, form.parts, x, y, cell, fill, undefined, { rotate: rot + (p.animForme === 'ruota' ? (1 - e) * (Math.PI / 2) : 0), globalScale: p.animForme === 'dissolvenza' ? 1 : sc });
      ctx.restore();
    }));
    // Firma.
    if (p.firma === 'lockup') {
      const unit = lockupSize(ctx, 100).w / 100;
      const cap = Math.min(firmaH * 0.32, 130 * s, areaW / unit);
      const fr = clamp((f.frame - start - spread * 0.6) / env.sec(1));
      const y = f.height - f.safe.bottom - cap * (2 + LOCKUP.lineGap);
      ctx.save();
      ctx.globalAlpha *= Easing.out(fr) * (1 - out);
      const fc = p.coloreFirma === 'forme' ? colA : p.coloreFirma === 'auto' || !p.coloreFirma ? ink : resolveColor(p.coloreFirma);
      const ls = lockupSize(ctx, cap);
      env.place('firma', 'Lockup', { x: margin, y, w: ls.w, h: ls.h }, () => drawLockup(ctx, margin, y + (1 - Easing.out(fr)) * 20 * s, cap, fc, fr), 'marchio');
      ctx.restore();
    } else if (p.firma === 'titolo' && p.titolo) {
      const lt = layoutText(ctx, p.titolo, titleStyle({}, p.titolo, s), areaW);
      placeText(ctx, env, 'titolo', 'Titolo', lt, margin, f.height - f.safe.bottom - lt.height, { color: ink, anim: 'maschera', frame: f.frame, start: start + spread * 0.6, dur: env.sec(0.6), stagger: env.sec(0.08), easing: p.curva, out });
    }
  },
};

// ---------------------------------------------------------------------------
// Copertina dei caroselli LinkedIn (p. 58)
// ---------------------------------------------------------------------------

const CATEGORIE: { value: PaletteName; label: string }[] = [
  { value: 'verde', label: 'Percorso formativo (verde)' },
  { value: 'giallo', label: 'Premi e notizie (giallo)' },
  { value: 'fucsia', label: 'Eventi ed esperienze (fucsia)' },
  { value: 'viola', label: 'Numeri, dati, inviti (viola)' },
];

export const linkedinCopertina: Composition = {
  id: 'linkedin-copertina',
  name: 'LinkedIn · copertina carosello',
  source: 'Caroselli LinkedIn (p. 58); monogramma in riquadro (p. 14); pulsante «avanti» (p. 41)',
  description: 'Fotografia a tutta tavola, nome della serie, una frase con le parole chiave in neretto, quadrato DS/SA e pulsante.',
  category: 'Feed',
  defaultFormat: 'li-portrait',
  defaultDuration: 6,
  fields: [
    { type: 'select', key: 'categoria', label: 'Categoria di colore', group: 'Serie', default: 'fucsia', options: CATEGORIE },
    { type: 'text', key: 'serie', label: 'Nome della serie', group: 'Serie', default: 'DSSA incontra [nome dell’azienda]' },
    { type: 'textarea', key: 'frase', label: 'Frase (massimo quattro righe, **neretto** per le parole chiave)', group: 'Testi', default: 'Una frase per slide, con le **parole chiave** in neretto, al massimo quattro righe.', rows: 4 },
    { type: 'image', key: 'foto', label: 'Fotografia', group: 'Fotografia', default: '' },
    {
      type: 'select',
      key: 'trattamento',
      label: 'Trattamento',
      group: 'Fotografia',
      default: 'velatura',
      options: [
        { value: 'velatura', label: 'Velatura scura (fotografia a colori)' },
        { value: 'duotono', label: 'Duotono del colore della categoria' },
      ],
    },
    { type: 'number', key: 'zoom', label: 'Avvicinamento lento', group: 'Fotografia', default: 6, min: 0, max: 40, step: 1, unit: '%' },
    { type: 'symbol', key: 'simbolo', label: 'Sagoma bianca', group: 'Simbolo', default: 'with', allowNone: true },
    { type: 'number', key: 'dimensione', label: 'Dimensione della sagoma', group: 'Simbolo', default: 34, min: 10, max: 100, step: 1, unit: '% della larghezza' },
    { type: 'boolean', key: 'pulsante', label: 'Pulsante «avanti»', group: 'Serie', default: true },
    ...ritmoFields({ shapes: true, loop: false }),
  ],
  render(ctx, f, p, env) {
    const s = f.s;
    const img = env.image(p.foto);
    const cat = (p.categoria ?? 'fucsia') as keyof typeof DUOTONE;
    const z = 1 + ((p.zoom ?? 6) / 100) * clamp(f.frame / Math.max(1, f.durationInFrames - 1));
    if (img) {
      if (p.trattamento === 'duotono') drawDuotone(ctx, img, 0, 0, f.width, f.height, cat, { zoom: z });
      else {
        drawImageCover(ctx, img, 0, 0, f.width, f.height, { zoom: z });
        ctx.fillStyle = 'rgba(17,17,20,0.38)';
        ctx.fillRect(0, 0, f.width, f.height);
      }
    } else {
      ctx.fillStyle = DUOTONE[cat].scuro;
      ctx.fillRect(0, 0, f.width, f.height);
    }
    const ink = PALETTE.bianco;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    const w = f.width - f.safe.left - f.safe.right;
    // Sagoma bianca.
    if (p.simbolo && p.simbolo !== 'nessuno') {
      const size = (f.width * p.dimensione) / 100;
      placeSymbol(ctx, env, p.simbolo, f.width - f.safe.right - size, f.safe.top + 90 * s, size, { mode: 'piatto', color: ink }, motionOf(p, f, env, start + env.sec(0.4), out));
    }
    // Nome della serie (SemiBold).
    const o = { anim: (p.animTesto ?? 'maschera') as TextAnim, start: start + env.sec(0.1), dur: env.sec(0.6), stagger: env.sec(0.08), easing: p.curva, out };
    const ls = layoutText(ctx, p.serie, { ...styleOf('etichetta30', s), size: 34 * s }, w);
    placeText(ctx, env, 'serie', 'Nome della serie', ls, f.safe.left, f.safe.top, { ...o, color: ink, frame: f.frame });
    // Frase in basso.
    const st = styleOf('testo46', s);
    const lf = layoutText(ctx, p.frase, st, w);
    if (lf.lines.length > 4) env.warn('La frase supera le quattro righe del modello LinkedIn.');
    const box = 64 * s;
    const fy = f.height - f.safe.bottom - box - 70 * s - lf.height;
    placeText(ctx, env, 'frase', 'Frase', lf, f.safe.left, fy, { ...o, start: start + env.sec(0.5), color: ink, frame: f.frame });
    const e = Easing.out(clamp((f.frame - start - env.sec(0.9)) / env.sec(0.5))) * (1 - out);
    ctx.save();
    ctx.globalAlpha *= e;
    const by = f.height - f.safe.bottom - box;
    env.place('riquadro', 'Monogramma in riquadro', { x: f.safe.left, y: by, w: box, h: box }, () => drawMonogramBox(ctx, f.safe.left, by, box), 'marchio');
    if (p.pulsante) env.place('pulsante', 'Pulsante «avanti»', { x: f.width - f.safe.right - box, y: by, w: box, h: box }, () => drawNextButton(ctx, f.width - f.safe.right - box, by, s));
    ctx.restore();
  },
};


export const VIDEO: Composition[] = [marchio, setteAmbiti, composizione, linkedinCopertina];
