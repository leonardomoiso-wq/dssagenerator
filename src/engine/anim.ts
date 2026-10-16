// Funzioni di animazione, sul modello di Remotion: tutto dipende dal numero del frame,
// così l'anteprima e l'esportazione producono gli stessi fotogrammi.

export type EasingFn = (t: number) => number;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function bezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    t = clamp(t);
    return sy(t);
  };
}

export const Easing = {
  linear: (t: number) => t,
  inOut: bezier(0.65, 0, 0.35, 1),
  out: bezier(0.22, 1, 0.36, 1),
  in: bezier(0.55, 0, 1, 0.45),
  /** Movimento netto e calmo: parte deciso, si posa piano. */
  dssa: bezier(0.7, 0, 0.18, 1),
  back: (t: number) => {
    const c1 = 1.70158,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  bezier,
};

export type EasingName = 'dssa' | 'inOut' | 'out' | 'in' | 'linear' | 'back';
export const EASING_OPTIONS: { value: EasingName; label: string }[] = [
  { value: 'dssa', label: 'DSSA (deciso, si posa piano)' },
  { value: 'out', label: 'Uscita morbida' },
  { value: 'inOut', label: 'Simmetrica' },
  { value: 'back', label: 'Con rimbalzo' },
  { value: 'linear', label: 'Lineare' },
];

/** Avanzamento 0-1 tra due frame, con curva. */
export function progress(frame: number, start: number, duration: number, easing: EasingFn = Easing.dssa) {
  if (duration <= 0) return frame >= start ? 1 : 0;
  return easing(clamp((frame - start) / duration));
}

/** Mappa un valore da un intervallo a un altro (come interpolate di Remotion). */
export function interpolate(
  input: number,
  inRange: number[],
  outRange: number[],
  opts: { easing?: EasingFn; clamp?: boolean } = {},
) {
  const { easing = Easing.linear, clamp: cl = true } = opts;
  let i = 1;
  while (i < inRange.length - 1 && input > inRange[i]) i++;
  const a = inRange[i - 1],
    b = inRange[i];
  let t = b === a ? 1 : (input - a) / (b - a);
  if (cl) t = clamp(t);
  return lerp(outRange[i - 1], outRange[i], easing(t));
}

/** Molla smorzata in forma chiusa: stesso risultato in qualsiasi ordine di rendering. */
export function spring(
  frame: number,
  fps: number,
  { stiffness = 120, damping = 14, mass = 1, delay = 0 }: { stiffness?: number; damping?: number; mass?: number; delay?: number } = {},
) {
  const t = (frame - delay) / fps;
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let x: number;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    x = Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  } else if (zeta === 1) {
    x = Math.exp(-w0 * t) * (1 + w0 * t);
  } else {
    const s1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const s2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    x = (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
  }
  return 1 - x;
}

/** Generatore pseudo-casuale con seme (mulberry32). */
export function rng(seed: number) {
  let a = Math.floor(seed * 9973 + 12345) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getEasing(name: string | undefined): EasingFn {
  return (Easing as unknown as Record<string, EasingFn>)[name ?? 'dssa'] ?? Easing.dssa;
}
