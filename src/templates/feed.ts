// Le otto composizioni del feed Instagram (manuale p. 57) e la copertina con simbolo.
// Costanti: formato, palette, Basier Circle, marchio ed etichetta in alto a sinistra,
// un solo elemento grafico oltre al testo.
import { drawDuotone, drawImageCover, partsClipPath, partStates } from '../brand/draw';
import { getSymbol } from '../brand/symbols';
import { DUOTONE, LILLA_SEGNAPOSTO, PALETTE, resolveColor } from '../brand/tokens';
import { clamp, Easing, getEasing } from '../engine/anim';
import { drawText, layoutText, textAnimEnd, type TextAnim } from '../engine/text';
import type { Composition, Env, FrameInfo, Props } from '../engine/types';
import {
  checkTextContrast,
  drawFondo,
  drawFreccia,
  drawTestata,
  exitProgress,
  fondoFields,
  inkFor,
  placeText,
  ritmoFields,
  styleOf,
  t0,
  testataFields,
  titleStyle,
  titoloStileField,
} from './common';
import { fillOf, motionOf, placeSymbol, symbolEnd, symbolFields } from './symbol-helpers';

const W = (f: FrameInfo) => f.width - f.safe.left - f.safe.right;

function textOpts(props: Props, env: Env, start: number, out: number) {
  return {
    anim: (props.animTesto ?? 'maschera') as TextAnim,
    start,
    dur: env.sec(0.6),
    stagger: env.sec(0.08),
    easing: props.curva,
    out,
  };
}

/** Segnaposto per un'immagine non ancora caricata (lilla, p. 22). */
function placeholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, clip?: Path2D) {
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.fillStyle = LILLA_SEGNAPOSTO;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (!clip) {
    ctx.save();
    ctx.strokeStyle = PALETTE.viola;
    ctx.setLineDash([10 * s, 8 * s]);
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x + s, y + s, w - 2 * s, h - 2 * s);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Solo testo · un contenuto da leggere
// ---------------------------------------------------------------------------

export const soloTesto: Composition = {
  id: 'solo-testo',
  name: 'Solo testo',
  source: 'Feed · «Solo testo», un contenuto da leggere (p. 57)',
  description: 'Titolo, sottotitolo e firma su fondo pieno. Le righe entrano una alla volta.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 6,
  fields: [
    { type: 'textarea', key: 'titolo', label: 'Titolo', group: 'Testi', default: 'L’arte funzionale', rows: 2 },
    { type: 'textarea', key: 'sottotitolo', label: 'Sottotitolo', group: 'Testi', default: 'Infografica e visualizzazione delle informazioni', rows: 3 },
    { type: 'text', key: 'firma', label: 'Firma o fonte', group: 'Testi', default: 'di Alberto Cairo' },
    titoloStileField(),
    {
      type: 'select',
      key: 'verticale',
      label: 'Posizione del blocco',
      group: 'Testi',
      default: 'centro',
      options: [
        { value: 'alto', label: 'Sotto la testata' },
        { value: 'centro', label: 'Al centro' },
        { value: 'basso', label: 'In basso' },
      ],
    },
    ...fondoFields('verde'),
    ...testataFields('Libro del mese'),
    ...ritmoFields({ shapes: false, loop: false }),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const top = drawTestata(ctx, f, p, env, ink);
    const s = f.s;
    const w = W(f);
    const tSt = titleStyle(p, p.titolo, s);
    const sSt = styleOf('testo38', s);
    const fSt = styleOf('fonte26', s);
    checkTextContrast(env, ink, p.fondo, sSt);
    const lt = layoutText(ctx, p.titolo, tSt, w);
    const ls = layoutText(ctx, p.sottotitolo, { ...sSt, weight: 600 }, w);
    const lf = layoutText(ctx, p.firma, fSt, w);
    const g1 = 44 * s,
      g2 = 30 * s;
    const H = lt.height + (p.sottotitolo ? g1 + ls.height : 0) + (p.firma ? g2 + lf.height : 0);
    const bottomLimit = f.height - f.safe.bottom - (p.freccia ? 39 * s + 60 * s : 0);
    let y = top + 120 * s;
    if (p.verticale === 'centro') y = Math.max(y, (f.height - H) / 2);
    if (p.verticale === 'basso') y = Math.max(y, bottomLimit - H);
    const start = t0(f, p, env) + env.sec(0.25);
    const out = exitProgress(f, p);
    const o = textOpts(p, env, start, out);
    placeText(ctx, env, 'titolo', 'Titolo', lt, f.safe.left, y, { ...o, color: ink, frame: f.frame });
    let end = textAnimEnd(lt, o);
    y += lt.height;
    if (p.sottotitolo) {
      y += g1;
      placeText(ctx, env, 'sottotitolo', 'Sottotitolo', ls, f.safe.left, y, { ...o, start: end - env.sec(0.3), color: ink, frame: f.frame });
      end = textAnimEnd(ls, { ...o, start: end - env.sec(0.3) });
      y += ls.height;
    }
    if (p.firma) {
      y += g2;
      placeText(ctx, env, 'firma', 'Firma', lf, f.safe.left, y, { ...o, anim: 'dissolvenza', start: end - env.sec(0.2), color: ink, frame: f.frame });
    }
    drawFreccia(ctx, f, p, env, ink, end);
  },
};

// ---------------------------------------------------------------------------
// Copertina con simbolo · Simbolo iridescente (un invito)
// ---------------------------------------------------------------------------

function renderSymbolCover(ctx: CanvasRenderingContext2D, f: FrameInfo, p: Props, env: Env) {
  drawFondo(ctx, f, p, env);
  const ink = inkFor(p, p.fondo, env);
  const top = p.testata === false ? f.safe.top : drawTestata(ctx, f, p, env, ink);
  const s = f.s;
  const start = t0(f, p, env);
  const out = exitProgress(f, p);
  const size = (f.width * (p.dimensione ?? 60)) / 100;
  const pos: string = p.posizione ?? 'centro';
  let x = (f.width - size) / 2;
  let y = (f.height - size) / 2;
  if (pos === 'tagliato') {
    // Grande, tagliato dal margine in basso a destra (p. 23).
    x = f.width - size * 0.78;
    y = f.height - size * 0.8;
  } else if (pos === 'basso') {
    y = f.height - f.safe.bottom - size;
  } else if (pos === 'centroBasso') {
    y = Math.max((f.height - size) / 2, f.height * 0.56 - size / 2);
  }
  const fill = fillOf(p, f, ink, env);
  const m = motionOf(p, f, env, start + env.sec(0.1), out);
  placeSymbol(ctx, env, p.simbolo, x, y, size, fill, m);

  // Testi in alto.
  const w = W(f);
  let ty = top + 90 * s;
  const tStart = start + env.sec(0.3);
  const o = textOpts(p, env, tStart, out);
  let end = tStart;
  const titolo = p.usaNome ? getSymbol(p.simbolo).name : p.titolo;
  if (titolo) {
    const lt = layoutText(ctx, titolo, titleStyle(p, titolo, s), w);
    placeText(ctx, env, 'titolo', 'Titolo', lt, f.safe.left, ty, { ...o, color: ink, frame: f.frame });
    end = textAnimEnd(lt, o);
    ty += lt.height + 40 * s;
  }
  const testo = p.usaNome && p.usaDefinizione ? getSymbol(p.simbolo).definition : p.testo;
  if (testo) {
    const st = styleOf('testo38', s);
    checkTextContrast(env, ink, p.fondo, st);
    const lt = layoutText(ctx, testo, st, w * 0.92);
    placeText(ctx, env, 'testo', 'Testo', lt, f.safe.left, ty, { ...o, start: end - env.sec(0.3), color: ink, frame: f.frame });
    end = textAnimEnd(lt, { ...o, start: end - env.sec(0.3) });
  }
  drawFreccia(ctx, f, p, env, ink, Math.max(end, symbolEnd(p.simbolo, m)));
}

const coverFields = (o: { fill: string; size: number; pos: string; bg: string; titolo: string; testo: string; label: string; testata?: boolean }) => [
  { type: 'textarea', key: 'titolo', label: 'Titolo', group: 'Testi', default: o.titolo, rows: 2 },
  { type: 'textarea', key: 'testo', label: 'Testo', group: 'Testi', default: o.testo, rows: 3 },
  { type: 'boolean', key: 'usaNome', label: 'Usa il nome dell’ambito come titolo', group: 'Testi', default: false },
  { type: 'boolean', key: 'usaDefinizione', label: 'Usa la definizione dell’ambito come testo', group: 'Testi', default: false, when: (p: Props) => p.usaNome },
  titoloStileField(),
  ...symbolFields({ def: 'space', fill: o.fill, size: o.size }),
  {
    type: 'select',
    key: 'posizione',
    label: 'Posizione del simbolo',
    group: 'Simbolo',
    default: o.pos,
    options: [
      { value: 'centro', label: 'Al centro' },
      { value: 'centroBasso', label: 'Sotto i testi' },
      { value: 'basso', label: 'In basso' },
      { value: 'tagliato', label: 'Grande, tagliato dal margine' },
    ],
  },
  ...fondoFields(o.bg),
  { type: 'boolean', key: 'testata', label: 'Mostra la testata', group: 'Testata', default: o.testata ?? true },
  ...testataFields(o.label),
  ...ritmoFields(),
] as Composition['fields'];

export const simboloIridescente: Composition = {
  id: 'simbolo-iridescente',
  name: 'Simbolo iridescente',
  source: 'Feed · «Simbolo iridescente», un invito (p. 57); materia iridescente (p. 23)',
  description: 'Un invito: titolo e informazioni, un solo simbolo iridescente grande, tagliato dal margine.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 6,
  fields: coverFields({
    fill: 'iridescente',
    size: 95,
    pos: 'tagliato',
    bg: 'fucsia',
    titolo: 'È tempo di Open day',
    testo: '[Sede] · [data]\nOre 10.00 · Aula 3',
    label: 'Open day',
  }),
  render: renderSymbolCover,
};

export const copertinaSimbolo: Composition = {
  id: 'copertina-simbolo',
  name: 'Simbolo animato',
  source: 'Simboli degli ambiti (p. 36-40); copertine delle storie in evidenza (p. 56)',
  description: 'Un simbolo su fondo pieno che si compone parte per parte. Per storie in evidenza, aperture e chiusure.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 5,
  fields: coverFields({ fill: 'piatto', size: 56, pos: 'centro', bg: 'verde', titolo: '', testo: '', label: '', testata: false }).map((fl) =>
    fl.key === 'coloreSimbolo' ? ({ ...fl, default: 'giallo' } as typeof fl) : fl,
  ),
  render: renderSymbolCover,
};

// ---------------------------------------------------------------------------
// Cifra · una data o un dato
// ---------------------------------------------------------------------------

function formatCount(target: string, p: number) {
  const digits = target.replace(/[^\d]/g, '');
  if (!digits || !/^[\d.\s]+$/.test(target.trim())) return target;
  const n = parseInt(digits, 10);
  const v = Math.round(n * p);
  let txt = String(v);
  if (target.includes('.')) txt = v.toLocaleString('it-IT');
  return txt.padStart(Math.min(digits.length, txt.length), '0');
}

export const cifra: Composition = {
  id: 'cifra',
  name: 'Cifra',
  source: 'Feed · «Cifra», una data o un dato (p. 57)',
  description: 'Un numero grande che conta fino al valore, un titolo e un frammento di simbolo.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 6,
  fields: [
    { type: 'text', key: 'cifra', label: 'Cifra', group: 'Testi', default: '17' },
    { type: 'text', key: 'unita', label: 'Accanto alla cifra', group: 'Testi', default: 'dic' },
    { type: 'boolean', key: 'conteggio', label: 'Conta fino al valore', group: 'Testi', default: true },
    { type: 'number', key: 'corpoCifra', label: 'Corpo della cifra', group: 'Testi', default: 400, min: 160, max: 700, step: 10, unit: 'px' },
    { type: 'textarea', key: 'titolo', label: 'Titolo', group: 'Testi', default: 'Sessione di laurea', rows: 2 },
    { type: 'textarea', key: 'testo', label: 'Testo', group: 'Testi', default: '[Sede] · [orario]', rows: 2 },
    titoloStileField('titolo80'),
    ...symbolFields({ def: 'with', fill: 'iridescente', size: 62 }),
    { type: 'boolean', key: 'mostraSimbolo', label: 'Mostra il simbolo', group: 'Simbolo', default: true },
    ...fondoFields('viola'),
    ...testataFields('Agenda'),
    ...ritmoFields(),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const top = drawTestata(ctx, f, p, env, ink);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    if (p.mostraSimbolo) {
      const size = (f.width * p.dimensione) / 100;
      const m = motionOf(p, f, env, start + env.sec(0.6), out);
      placeSymbol(ctx, env, p.simbolo, f.width - size * 0.82, f.height - size * 0.78, size, fillOf(p, f, ink, env), m);
    }
    // Cifra.
    const nSize = (p.corpoCifra ?? 400) * s;
    const nSt = { family: 'titolo' as const, size: nSize, weight: 600, lineHeight: 1, tracking: -0.04 };
    const ln = layoutText(ctx, String(p.cifra), nSt, f.width * 2);
    const y = top + 70 * s;
    const nx = f.safe.left - nSize * 0.03;
    env.place(
      'cifra',
      'Cifra',
      { x: nx, y: y - nSize * 0.1, w: ln.width, h: ln.capHeight + nSize * 0.2 },
      () => {
        const cp = p.conteggio ? Easing.out(clamp((f.frame - start - env.sec(0.2)) / env.sec(1.4))) : 1;
        const label = p.conteggio ? formatCount(String(p.cifra), cp) : String(p.cifra);
        const lt = layoutText(ctx, label, nSt, f.width * 2);
        const appear = getEasing(p.curva)(clamp((f.frame - start - env.sec(0.1)) / env.sec(0.6)));
        ctx.save();
        ctx.globalAlpha *= appear * (1 - out);
        drawText(ctx, lt, nx, y + (1 - appear) * 40 * s, { color: ink });
        ctx.restore();
      },
      'testo',
      { start: start + env.sec(0.1), end: start + env.sec(p.conteggio ? 1.6 : 0.7) },
    );
    let x2 = f.safe.left + ln.width + 18 * s;
    if (p.unita) {
      const us = styleOf('testo46', s);
      const lu = layoutText(ctx, p.unita, { ...us, weight: 600 }, f.width);
      const uy = y + ln.capHeight - lu.capHeight;
      const ux = x2;
      env.place(
        'unita',
        'Accanto alla cifra',
        { x: ux, y: uy - lu.style.size * 0.12, w: lu.width, h: lu.height + lu.style.size * 0.4 },
        () => {
          const up = clamp((f.frame - start - env.sec(1.1)) / env.sec(0.5));
          drawText(ctx, lu, ux, uy, { color: ink, anim: 'sali', frame: up * 30, start: 0, dur: 30, out });
        },
        'testo',
        { start: start + env.sec(1.1), end: start + env.sec(1.6) },
      );
      x2 += lu.width;
    }
    // Titolo e testo.
    let ty = y + ln.capHeight + 80 * s;
    const o = textOpts(p, env, start + env.sec(0.8), out);
    let end = start + env.sec(0.8);
    if (p.titolo) {
      const l = layoutText(ctx, p.titolo, titleStyle(p, p.titolo, s), W(f));
      placeText(ctx, env, 'titolo', 'Titolo', l, f.safe.left, ty, { ...o, color: ink, frame: f.frame });
      end = textAnimEnd(l, o);
      ty += l.height + 36 * s;
    }
    if (p.testo) {
      const st = styleOf('testo38', s);
      checkTextContrast(env, ink, p.fondo, st);
      const l = layoutText(ctx, p.testo, st, W(f) * 0.7);
      placeText(ctx, env, 'testo', 'Testo', l, f.safe.left, ty, { ...o, start: end - env.sec(0.3), color: ink, frame: f.frame });
      end = textAnimEnd(l, { ...o, start: end - env.sec(0.3) });
    }
    drawFreccia(ctx, f, p, env, ink, end);
  },
};

// ---------------------------------------------------------------------------
// Duotono · un luogo o un evento
// ---------------------------------------------------------------------------

const tintOptions = (['fucsia', 'verde', 'viola', 'giallo'] as const).map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }));

export const duotono: Composition = {
  id: 'duotono',
  name: 'Duotono',
  source: 'Feed · «Duotono», un luogo o un evento (p. 57); duotono a quattro livelli (p. 33); sagoma bianca (p. 34)',
  description: 'Fotografia in duotono che si muove piano, titolo bianco e sagoma bianca di un simbolo.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 7,
  fields: [
    { type: 'image', key: 'foto', label: 'Fotografia', group: 'Fotografia', default: '' },
    { type: 'select', key: 'tinta', label: 'Duotono', group: 'Fotografia', default: 'fucsia', options: tintOptions },
    { type: 'number', key: 'velatura', label: 'Velatura (colore scuro)', group: 'Fotografia', default: 28, min: 0, max: 70, step: 1, unit: '%' },
    { type: 'number', key: 'zoom', label: 'Avvicinamento lento', group: 'Fotografia', default: 8, min: 0, max: 40, step: 1, unit: '%' },
    { type: 'number', key: 'fuocoX', label: 'Punto focale orizzontale', group: 'Fotografia', default: 50, min: 0, max: 100, step: 1, unit: '%' },
    { type: 'number', key: 'fuocoY', label: 'Punto focale verticale', group: 'Fotografia', default: 50, min: 0, max: 100, step: 1, unit: '%' },
    { type: 'textarea', key: 'titolo', label: 'Titolo', group: 'Testi', default: 'DSSA al [luogo della visita]', rows: 2 },
    { type: 'text', key: 'testo', label: 'Informazioni', group: 'Testi', default: '[Insegnamento] · [data]' },
    titoloStileField(),
    ...symbolFields({ def: 'space', fill: 'piatto', size: 80, color: 'bianco' }),
    { type: 'boolean', key: 'mostraSimbolo', label: 'Mostra la sagoma bianca', group: 'Simbolo', default: true },
    ...testataFields('In visita'),
    ...ritmoFields(),
  ],
  render(ctx, f, p, env) {
    const s = f.s;
    const img = env.image(p.foto);
    const z = 1 + ((p.zoom ?? 8) / 100) * clamp(f.frame / Math.max(1, f.durationInFrames - 1));
    if (img) {
      drawDuotone(ctx, img, 0, 0, f.width, f.height, p.tinta, {
        zoom: z,
        fx: (p.fuocoX ?? 50) / 100,
        fy: (p.fuocoY ?? 50) / 100,
        velatura: (p.velatura ?? 28) / 100,
      });
    } else {
      ctx.fillStyle = DUOTONE[p.tinta as keyof typeof DUOTONE]?.scuro ?? PALETTE.nero;
      ctx.fillRect(0, 0, f.width, f.height);
      env.warn('Carica una fotografia: senza duotono o velatura il marchio non si appoggia a una foto (p. 34).');
    }
    const props = { ...p, fondo: 'duotono' };
    const ink = inkFor(props, 'duotono', env);
    const top = drawTestata(ctx, f, props, env, ink);
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    if (p.mostraSimbolo) {
      const size = (f.width * p.dimensione) / 100;
      placeSymbol(ctx, env, p.simbolo, f.width - size * 0.8, f.height - size * 0.75, size, fillOf(p, f, ink, env), motionOf(p, f, env, start + env.sec(0.5), out));
    }
    const o = textOpts(p, env, start + env.sec(0.25), out);
    let ty = top + 60 * s;
    const lt = layoutText(ctx, p.titolo, titleStyle(p, p.titolo, s), W(f));
    placeText(ctx, env, 'titolo', 'Titolo', lt, f.safe.left, ty, { ...o, color: ink, frame: f.frame });
    let end = textAnimEnd(lt, o);
    ty += lt.height + 32 * s;
    if (p.testo) {
      const l = layoutText(ctx, p.testo, styleOf('testo38', s), W(f));
      placeText(ctx, env, 'testo', 'Testo', l, f.safe.left, ty, { ...o, start: end - env.sec(0.3), color: ink, frame: f.frame });
      end = textAnimEnd(l, { ...o, start: end - env.sec(0.3) });
    }
    drawFreccia(ctx, f, props, env, ink, end);
  },
};

// ---------------------------------------------------------------------------
// Finestra · un ambito
// ---------------------------------------------------------------------------

export const finestra: Composition = {
  id: 'finestra',
  name: 'Finestra',
  source: 'Feed · «Finestra», un ambito (p. 57); la forma del simbolo contiene la fotografia (p. 34)',
  description: 'Il simbolo dell’ambito diventa una finestra sulla fotografia; il fondo ha il colore dell’ambito.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 6,
  fields: [
    { type: 'boolean', key: 'usaNome', label: 'Titolo e testo dall’ambito', group: 'Testi', default: true },
    { type: 'textarea', key: 'titolo', label: 'Titolo', group: 'Testi', default: 'Design for Food', rows: 2, when: (p) => !p.usaNome },
    { type: 'textarea', key: 'testo', label: 'Testo', group: 'Testi', default: '', rows: 3, when: (p) => !p.usaNome },
    titoloStileField(),
    { type: 'image', key: 'foto', label: 'Fotografia nella finestra', group: 'Fotografia', default: '' },
    { type: 'number', key: 'zoom', label: 'Avvicinamento lento', group: 'Fotografia', default: 10, min: 0, max: 40, step: 1, unit: '%' },
    { type: 'number', key: 'fuocoX', label: 'Punto focale orizzontale', group: 'Fotografia', default: 50, min: 0, max: 100, step: 1, unit: '%' },
    { type: 'number', key: 'fuocoY', label: 'Punto focale verticale', group: 'Fotografia', default: 50, min: 0, max: 100, step: 1, unit: '%' },
    ...symbolFields({ def: 'for', size: 74 }).filter((x) => !['riempimento', 'coloreSimbolo', 'simboloIri', 'simboloSeme'].includes(x.key)),
    ...fondoFields('verde', { extra: false }),
    ...testataFields('I 7 ambiti · 1/7'),
    ...ritmoFields(),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const top = drawTestata(ctx, f, p, env, ink);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    const def = getSymbol(p.simbolo);
    const titolo = p.usaNome ? def.name : p.titolo;
    const testo = p.usaNome ? def.definition : p.testo;
    const o = textOpts(p, env, start + env.sec(0.25), out);
    let ty = top + 60 * s;
    const lt = layoutText(ctx, titolo, titleStyle(p, titolo, s), W(f));
    placeText(ctx, env, 'titolo', 'Titolo', lt, f.safe.left, ty, { ...o, color: ink, frame: f.frame });
    let end = textAnimEnd(lt, o);
    ty += lt.height + 32 * s;
    if (testo) {
      const st = styleOf('testo38', s);
      checkTextContrast(env, ink, p.fondo, st);
      const l = layoutText(ctx, testo, st, W(f) * 0.9);
      placeText(ctx, env, 'testo', 'Testo', l, f.safe.left, ty, { ...o, start: end - env.sec(0.3), color: ink, frame: f.frame });
      end = textAnimEnd(l, { ...o, start: end - env.sec(0.3) });
      ty += l.height;
    }
    // Finestra: forma del simbolo con la fotografia dentro.
    const size = (f.width * p.dimensione) / 100;
    const x = (f.width - size) / 2;
    const y = Math.max(ty + 60 * s, f.height - f.safe.bottom - size * 0.92);
    const ws = start + env.sec(0.5);
    const wm = motionOf(p, f, env, ws, out);
    env.place('finestra', 'Finestra con la fotografia', { x, y, w: size, h: size }, () => {
    const states = partStates(def.parts, { ...wm, frame: f.frame });
    const clip = partsClipPath(def.parts, x, y, size, states);
    const img = env.image(p.foto);
    if (img) {
      ctx.save();
      ctx.clip(clip);
      const z = 1 + ((p.zoom ?? 10) / 100) * clamp(f.frame / Math.max(1, f.durationInFrames - 1));
      drawImageCover(ctx, img, x, y, size, size, { zoom: z, fx: p.fuocoX / 100, fy: p.fuocoY / 100 });
      ctx.restore();
    } else placeholder(ctx, x, y, size, size, s, clip);
    }, 'grafica', { start: ws, end: ws + (def.parts.length - 1) * wm.stagger + wm.dur });
    drawFreccia(ctx, f, p, env, ink, end);
  },
};

// ---------------------------------------------------------------------------
// Ritratto · una persona
// ---------------------------------------------------------------------------

export const ritratto: Composition = {
  id: 'ritratto',
  name: 'Ritratto',
  source: 'Feed · «Ritratto», una persona (p. 57)',
  description: 'Una frase tra virgolette, nome e ruolo, la fotografia della persona in una forma.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 7,
  fields: [
    { type: 'textarea', key: 'citazione', label: 'Citazione (massimo 25 parole)', group: 'Testi', default: '«Una frase su un’attività reale svolta nel corso, al massimo 25 parole.»', rows: 3 },
    { type: 'text', key: 'nome', label: 'Nome e cognome', group: 'Testi', default: '[Nome Cognome]' },
    { type: 'textarea', key: 'ruolo', label: 'Ruolo', group: 'Testi', default: '[percorso o ruolo]\n[anno]', rows: 2 },
    { type: 'image', key: 'foto', label: 'Fotografia della persona', group: 'Fotografia', default: '' },
    {
      type: 'select',
      key: 'forma',
      label: 'Forma della fotografia',
      group: 'Fotografia',
      default: 'semicerchio',
      options: [
        { value: 'semicerchio', label: 'Semicerchio' },
        { value: 'cerchio', label: 'Cerchio' },
        { value: 'scontornata', label: 'Scontornata (PNG trasparente)' },
      ],
    },
    { type: 'boolean', key: 'duotonoFoto', label: 'Fotografia in duotono fucsia', group: 'Fotografia', default: false },
    ...fondoFields('sfumaturaFucsia'),
    ...testataFields('Voci'),
    ...ritmoFields({ shapes: false, loop: false }),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const top = drawTestata(ctx, f, p, env, ink);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    if (String(p.citazione).trim().split(/\s+/).length > 25) env.warn('La citazione supera le 25 parole del modello.');
    const o = textOpts(p, env, start + env.sec(0.25), out);
    let ty = top + 60 * s;
    const lq = layoutText(ctx, p.citazione, { ...styleOf('titolo80', s), size: 64 * s, lineHeight: 1.1 }, W(f));
    placeText(ctx, env, 'citazione', 'Citazione', lq, f.safe.left, ty, { ...o, color: ink, frame: f.frame });
    let end = textAnimEnd(lq, o);
    ty += lq.height + 44 * s;
    const ln = layoutText(ctx, p.nome, { ...styleOf('fonte26', s), weight: 600 }, W(f));
    placeText(ctx, env, 'nome', 'Nome', ln, f.safe.left, ty, { ...o, anim: 'dissolvenza', start: end - env.sec(0.2), color: ink, frame: f.frame });
    ty += ln.height + 12 * s;
    const lr = layoutText(ctx, p.ruolo, styleOf('fonte26', s), W(f));
    placeText(ctx, env, 'ruolo', 'Ruolo', lr, f.safe.left, ty, { ...o, anim: 'dissolvenza', start: end, color: ink, frame: f.frame });
    ty += lr.height;
    end += env.sec(0.4);
    // Fotografia.
    const img = env.image(p.foto);
    const size = f.width * 0.62;
    const cx = f.width * 0.6;
    const bottom = f.height;
    const y0 = Math.max(ty + 40 * s, bottom - size * (p.forma === 'cerchio' ? 1.05 : 0.6));
    env.place('foto', 'Fotografia', { x: cx - size / 2, y: p.forma === 'semicerchio' ? bottom - size / 2 : y0, w: size, h: p.forma === 'cerchio' ? size : bottom - (p.forma === 'semicerchio' ? bottom - size / 2 : y0) }, () => {
    const ap = getEasing(p.curva)(clamp((f.frame - start - env.sec(0.6)) / env.sec(0.9)));
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    let clip: Path2D | undefined;
    let rect: [number, number, number, number];
    if (p.forma === 'cerchio') {
      const r = size / 2;
      clip = new Path2D();
      clip.arc(cx, y0 + r + (1 - ap) * 80 * s, r * (0.6 + 0.4 * ap), 0, Math.PI * 2);
      rect = [cx - r, y0, size, size];
    } else if (p.forma === 'semicerchio') {
      const r = size / 2;
      clip = new Path2D();
      const by = bottom + (1 - ap) * r;
      clip.moveTo(cx - r, by);
      clip.arc(cx, by, r, Math.PI, 2 * Math.PI);
      clip.closePath();
      rect = [cx - r, by - r, size, r];
    } else {
      rect = [cx - size / 2, y0 + (1 - ap) * 80 * s, size, bottom - y0];
    }
    if (img) {
      ctx.save();
      if (clip) ctx.clip(clip);
      ctx.globalAlpha *= p.forma === 'scontornata' ? ap : 1;
      if (p.duotonoFoto) drawDuotone(ctx, img, rect[0], rect[1], rect[2], rect[3], 'fucsia');
      else if (p.forma === 'scontornata') {
        const iw = img.naturalWidth,
          ih = img.naturalHeight;
        const sc = Math.min(rect[2] / iw, rect[3] / ih);
        ctx.drawImage(img, rect[0] + (rect[2] - iw * sc) / 2, rect[1] + rect[3] - ih * sc, iw * sc, ih * sc);
      } else drawImageCover(ctx, img, rect[0], rect[1], rect[2], rect[3], { fy: 0.3 });
      ctx.restore();
    } else if (clip) placeholder(ctx, rect[0], rect[1], rect[2], rect[3], s, clip);
    else placeholder(ctx, rect[0], rect[1], rect[2], rect[3], s);
    ctx.restore();
    }, 'grafica', { start: start + env.sec(0.6), end: start + env.sec(1.5) });
    drawFreccia(ctx, f, p, env, ink, end);
  },
};

// ---------------------------------------------------------------------------
// Parola · un progetto
// ---------------------------------------------------------------------------

export const parola: Composition = {
  id: 'parola',
  name: 'Parola',
  source: 'Feed · «Parola», un progetto (p. 57)',
  description: 'Una parola enorme che scorre oltre il margine, il testo del progetto, l’immagine e un piccolo simbolo.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 8,
  fields: [
    { type: 'text', key: 'parola', label: 'Parola', group: 'Testi', default: 'STRADA' },
    { type: 'color', key: 'coloreParola', label: 'Colore della parola', group: 'Testi', default: 'viola' },
    { type: 'number', key: 'corpoParola', label: 'Corpo della parola', group: 'Testi', default: 420, min: 200, max: 800, step: 10, unit: 'px' },
    { type: 'number', key: 'scorrimento', label: 'Scorrimento verso sinistra', group: 'Testi', default: 0, min: 0, max: 200, step: 5, unit: 'px/s' },
    { type: 'textarea', key: 'testo', label: 'Testo del progetto', group: 'Testi', default: 'Progettiamo con:\n[Nome Cognome]\n[Nome Cognome]\n[Nome Cognome]', rows: 4 },
    { type: 'image', key: 'foto', label: 'Immagine del progetto (meglio PNG scontornato)', group: 'Fotografia', default: '' },
    ...symbolFields({ def: 'service', fill: 'iridescente', size: 12 }),
    { type: 'boolean', key: 'mostraSimbolo', label: 'Mostra il piccolo simbolo', group: 'Simbolo', default: true },
    ...fondoFields('bianco', { extra: false }),
    ...testataFields(''),
    ...ritmoFields(),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const top = drawTestata(ctx, f, p, env, ink);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    const color = resolveColor(p.coloreParola, PALETTE.viola);
    // Parola: entra da destra, poi scorre lenta oltre il margine.
    const size = (p.corpoParola ?? 420) * s;
    const st = { family: 'titolo' as const, size, weight: 600, lineHeight: 1, tracking: -0.03 };
    const lw = layoutText(ctx, p.parola, st, 1e6);
    const x = f.safe.left - size * 0.04;
    const y = top + 50 * s;
    env.place(
      'parola',
      'Parola',
      { x, y: y - size * 0.1, w: lw.width, h: lw.capHeight + size * 0.2 },
      () => {
        const ein = getEasing(p.curva)(clamp((f.frame - start) / env.sec(0.9)));
        const drift = ((p.scorrimento ?? 40) * s * Math.max(0, f.frame)) / f.fps;
        ctx.save();
        ctx.globalAlpha *= ein * (1 - out);
        drawText(ctx, lw, x + (1 - ein) * f.width * 0.6 - drift, y, { color });
        ctx.restore();
      },
      'testo',
      { start, end: start + env.sec(0.9) },
    );
    // Testo.
    const o = textOpts(p, env, start + env.sec(0.5), out);
    const tst = { ...styleOf('fonte26', s), size: 30 * s, weight: 500 };
    const lt = layoutText(ctx, p.testo, tst, W(f) * 0.45);
    const ty = y + lw.capHeight + 70 * s;
    placeText(ctx, env, 'testo', 'Testo del progetto', lt, f.safe.left, ty, { ...o, color, frame: f.frame });
    // Immagine.
    const img = env.image(p.foto);
    const bx = f.width * 0.38,
      by = ty + 40 * s,
      bw = f.width - bx - f.safe.right * 0.5,
      bh = f.height - by - f.safe.bottom;
    env.place('immagine', 'Immagine', { x: bx, y: by, w: bw, h: bh }, () => {
    const ia = Easing.out(clamp((f.frame - start - env.sec(0.7)) / env.sec(0.8)));
    if (img) {
      ctx.save();
      ctx.globalAlpha *= ia * (1 - out);
      const iw = img.naturalWidth,
        ih = img.naturalHeight;
      const sc = Math.min(bw / iw, bh / ih);
      ctx.drawImage(img, bx + (bw - iw * sc) / 2, by + (bh - ih * sc) + (1 - ia) * 40 * s, iw * sc, ih * sc);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha *= ia;
      placeholder(ctx, bx, by, bw, bh, s);
      ctx.restore();
    }
    }, 'grafica', { start: start + env.sec(0.7), end: start + env.sec(1.5) });
    if (p.mostraSimbolo) {
      const ss = Math.max(48, (f.width * p.dimensione) / 100);
      placeSymbol(ctx, env, p.simbolo, f.safe.left, f.height - f.safe.bottom - ss, ss, fillOf(p, f, ink, env), motionOf(p, f, env, start + env.sec(0.9), out));
    }
  },
};

// ---------------------------------------------------------------------------
// Tratto · una tesi
// ---------------------------------------------------------------------------

interface Stroke {
  path: Path2D;
  len: number;
}
const svgCache = new Map<string, { strokes: Stroke[]; vb: [number, number, number, number] } | null>();

/** Legge un SVG: percorsi, linee, cerchi e rettangoli, con la loro lunghezza. */
function parseSvg(src: string) {
  if (svgCache.has(src)) return svgCache.get(src)!;
  let out: { strokes: Stroke[]; vb: [number, number, number, number] } | null = null;
  try {
    const text = src.startsWith('data:') ? decodeURIComponent(escape(atob(src.split(',')[1]))) : src;
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (svg) {
      const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      host.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
      document.body.appendChild(host);
      const vbAttr = svg.getAttribute('viewBox');
      let vb: [number, number, number, number] = [0, 0, parseFloat(svg.getAttribute('width') ?? '100'), parseFloat(svg.getAttribute('height') ?? '100')];
      if (vbAttr) vb = vbAttr.split(/[\s,]+/).map(Number) as typeof vb;
      const strokes: Stroke[] = [];
      svg.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect').forEach((el) => {
        const clone = document.importNode(el, true) as unknown as SVGGeometryElement;
        host.appendChild(clone);
        let d = '';
        const a = (n: string) => parseFloat(el.getAttribute(n) ?? '0');
        switch (el.tagName.toLowerCase()) {
          case 'path':
            d = el.getAttribute('d') ?? '';
            break;
          case 'line':
            d = `M${a('x1')} ${a('y1')}L${a('x2')} ${a('y2')}`;
            break;
          case 'polyline':
          case 'polygon': {
            const pts = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
            for (let i = 0; i < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`;
            if (el.tagName.toLowerCase() === 'polygon') d += 'Z';
            break;
          }
          case 'circle':
          case 'ellipse': {
            const rx = el.tagName === 'circle' ? a('r') : a('rx');
            const ry = el.tagName === 'circle' ? a('r') : a('ry');
            d = `M${a('cx') - rx} ${a('cy')}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
            break;
          }
          case 'rect':
            d = `M${a('x')} ${a('y')}h${a('width')}v${a('height')}h${-a('width')}Z`;
            break;
        }
        let len = 0;
        try {
          len = clone.getTotalLength();
        } catch {
          len = 1000;
        }
        if (d) strokes.push({ path: new Path2D(d), len });
      });
      host.remove();
      out = { strokes, vb };
    }
  } catch {
    out = null;
  }
  svgCache.set(src, out);
  return out;
}

/** Contorno di un simbolo come tratto, quando non c'è un disegno caricato. */
function symbolStrokes(id: string): { strokes: Stroke[]; vb: [number, number, number, number] } {
  const key = 'sym:' + id;
  if (svgCache.has(key)) return svgCache.get(key)!;
  const strokes: Stroke[] = getSymbol(id).parts.map((pt) => {
    const path = new Path2D();
    let len = 0;
    if (pt.k === 'disc') {
      path.arc(pt.cx, pt.cy, pt.r, -Math.PI / 2, 1.5 * Math.PI);
      len = 2 * Math.PI * pt.r;
    } else if (pt.k === 'sector') {
      path.moveTo(pt.cx + pt.r * Math.cos(pt.a0), pt.cy + pt.r * Math.sin(pt.a0));
      path.arc(pt.cx, pt.cy, pt.r, pt.a0, pt.a1);
      path.lineTo(pt.cx, pt.cy);
      path.closePath();
      len = pt.r * (pt.a1 - pt.a0) + 2 * pt.r;
    } else if (pt.k === 'ring') {
      path.moveTo(pt.cx + pt.R * Math.cos(pt.a0), pt.cy + pt.R * Math.sin(pt.a0));
      path.arc(pt.cx, pt.cy, pt.R, pt.a0, pt.a1);
      path.lineTo(pt.cx + pt.r * Math.cos(pt.a1), pt.cy + pt.r * Math.sin(pt.a1));
      path.arc(pt.cx, pt.cy, pt.r, pt.a1, pt.a0, true);
      path.closePath();
      len = (pt.R + pt.r) * (pt.a1 - pt.a0) + 2 * (pt.R - pt.r);
    } else {
      path.moveTo(pt.cx - pt.rx, pt.cy);
      path.lineTo(pt.cx + pt.rx, pt.cy);
      path.ellipse(pt.cx, pt.cy, pt.rx, pt.ry, 0, 0, Math.PI);
      len = 2 * pt.rx + Math.PI * Math.sqrt((pt.rx * pt.rx + pt.ry * pt.ry) / 2);
    }
    return { path, len };
  });
  const v = { strokes, vb: [-4, -4, 108, 108] as [number, number, number, number] };
  svgCache.set(key, v);
  return v;
}

export const tratto: Composition = {
  id: 'tratto',
  name: 'Tratto',
  source: 'Feed · «Tratto», una tesi (p. 57)',
  description: 'Titolo e testo della tesi; un disegno al tratto si traccia da solo. Carica un SVG o usa il contorno di un simbolo.',
  category: 'Feed',
  defaultFormat: 'ig-post',
  defaultDuration: 7,
  fields: [
    { type: 'text', key: 'titolo', label: 'Titolo', group: 'Testi', default: 'Ajò' },
    { type: 'textarea', key: 'testo', label: 'Testo', group: 'Testi', default: 'Un progetto per la valorizzazione enogastronomica sarda on the road\nDi Valentina Pomarico · a.a. 2024/25', rows: 3 },
    titoloStileField('titolo96'),
    { type: 'svg', key: 'disegno', label: 'Disegno al tratto (SVG)', group: 'Disegno', default: '' },
    { type: 'symbol', key: 'simbolo', label: 'Senza SVG: contorno del simbolo', group: 'Disegno', default: 'service' },
    { type: 'number', key: 'spessore', label: 'Spessore del tratto', group: 'Disegno', default: 10, min: 2, max: 30, step: 0.5, unit: 'px' },
    { type: 'number', key: 'durataTratto', label: 'Durata del tracciamento', group: 'Disegno', default: 2.4, min: 0.3, max: 10, step: 0.1, unit: 's' },
    { type: 'number', key: 'dimensione', label: 'Dimensione del disegno', group: 'Disegno', default: 80, min: 20, max: 120, step: 1, unit: '% della larghezza' },
    ...fondoFields('giallo', { extra: false }),
    ...testataFields('Tesi'),
    ...ritmoFields({ shapes: false, loop: false }),
  ],
  render(ctx, f, p, env) {
    drawFondo(ctx, f, p, env);
    const ink = inkFor(p, p.fondo, env);
    const top = drawTestata(ctx, f, p, env, ink);
    const s = f.s;
    const start = t0(f, p, env);
    const out = exitProgress(f, p);
    const o = textOpts(p, env, start + env.sec(0.25), out);
    let ty = top + 60 * s;
    const lt = layoutText(ctx, p.titolo, titleStyle(p, p.titolo, s), W(f));
    placeText(ctx, env, 'titolo', 'Titolo', lt, f.safe.left, ty, { ...o, color: ink, frame: f.frame });
    const end = textAnimEnd(lt, o);
    ty += lt.height + 30 * s;
    const ls = layoutText(ctx, p.testo, styleOf('fonte26', s), W(f) * 0.6);
    placeText(ctx, env, 'testo', 'Testo', ls, f.safe.left, ty, { ...o, start: end - env.sec(0.3), color: ink, frame: f.frame });
    ty += ls.height;
    // Disegno.
    const art = (p.disegno && parseSvg(p.disegno)) || symbolStrokes(p.simbolo);
    const [vx, vy, vw, vh] = art.vb;
    const boxW = (f.width * p.dimensione) / 100;
    const areaTop = ty + 80 * s;
    const areaH = f.height - f.safe.bottom - areaTop;
    const k = Math.min(boxW / vw, areaH / vh);
    const dx = (f.width - vw * k) / 2;
    const dy = areaTop + (areaH - vh * k) / 2;
    const total = art.strokes.reduce((a: number, b: Stroke) => a + b.len, 0) || 1;
    env.place('disegno', 'Disegno', { x: dx, y: dy, w: vw * k, h: vh * k }, () => {
    const prog = Easing.inOut(clamp((f.frame - start - env.sec(0.5)) / env.sec(p.durataTratto ?? 2.4))) * (1 - out);
    let acc = 0;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(k, k);
    ctx.translate(-vx, -vy);
    ctx.strokeStyle = ink;
    ctx.lineWidth = ((p.spessore ?? 10) * s) / k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const st of art.strokes) {
      const local = clamp((prog * total - acc) / st.len);
      acc += st.len;
      if (local <= 0) continue;
      ctx.setLineDash([st.len * local, st.len * 2]);
      ctx.stroke(st.path);
    }
    ctx.restore();
    }, 'grafica', { start: start + env.sec(0.5), end: start + env.sec(0.5 + (p.durataTratto ?? 2.4)) });
    drawFreccia(ctx, f, p, env, ink, start + env.sec(0.5 + (p.durataTratto ?? 2.4)));
  },
};

export const FEED: Composition[] = [parola, tratto, ritratto, duotono, soloTesto, simboloIridescente, finestra, cifra, copertinaSimbolo];

