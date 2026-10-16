// Materia iridescente (manuale p. 23): sfumatura nativa, raggiere, sfumatura fucsia.
// Generata con uno shader WebGL, deterministico rispetto al tempo: lo stesso frame
// produce sempre la stessa immagine, in anteprima e in esportazione.

export type IridescentStyle = 'raggiera' | 'nativa' | 'fucsia' | 'raggieraTitolo';

export interface IridescentParams {
  style: IridescentStyle;
  /** Secondi: fa scorrere la materia. */
  time: number;
  /** Variante della materia (0-99). */
  seed: number;
  /** Centro della raggiera, 0-1 sul riquadro. */
  cx?: number;
  cy?: number;
  /** Intensità dei raggi, 0-1. */
  rays?: number;
  /** Velocità relativa del movimento. */
  speed?: number;
}

const VERT = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 res;
uniform float t;
uniform float seed;
uniform int mode;
uniform vec2 ctr;
uniform float rays;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// Colori della materia: viola, lilla, magenta, rosa, giallo tenue, azzurro, verde.
vec3 pal(float x){
  x = fract(x);
  vec3 c0 = vec3(0.439, 0.369, 0.949); // viola #705EF2
  vec3 c1 = vec3(0.600, 0.520, 0.980); // lilla
  vec3 c2 = vec3(0.850, 0.470, 0.960); // magenta
  vec3 c3 = vec3(1.000, 0.560, 0.760); // rosa
  vec3 c4 = vec3(0.980, 0.900, 0.640); // giallo tenue
  vec3 c5 = vec3(0.470, 0.890, 0.960); // azzurro
  vec3 c6 = vec3(0.420, 0.870, 0.720); // verde
  float s = x*7.0;
  vec3 c = c0;
  c = mix(c, c1, smoothstep(0.0,1.0,s));
  c = mix(c, c2, smoothstep(1.0,2.0,s));
  c = mix(c, c3, smoothstep(2.0,3.0,s));
  c = mix(c, c4, smoothstep(3.0,3.6,s));
  c = mix(c, c5, smoothstep(3.6,4.6,s));
  c = mix(c, c6, smoothstep(4.6,5.6,s));
  c = mix(c, c0, smoothstep(5.6,7.0,s));
  return c;
}

void main(){
  vec2 uv = gl_FragCoord.xy/res;
  uv.y = 1.0 - uv.y;
  float asp = res.x/res.y;
  vec2 p = (uv - ctr)*vec2(asp, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 dir = vec2(cos(a), sin(a));
  float s = seed*7.31;
  vec3 col;

  if (mode == 1) {
    // Sfumatura nativa: viola al centro, azzurro e verde ai bordi.
    float n = fbm(p*1.1 + vec2(s, -s) + vec2(t*0.05, -t*0.04));
    float v = 0.05 + r*0.55 + n*0.25;
    col = mix(vec3(0.44,0.37,0.95), vec3(0.47,0.62,0.98), smoothstep(0.1,0.6,v));
    col = mix(col, vec3(0.45,0.88,0.84), smoothstep(0.55,1.0,v));
  } else if (mode == 2) {
    // Sfumatura fucsia: fucsia, rosa, giallo.
    float n = fbm(p*0.9 + vec2(s) + vec2(t*0.04, t*0.03));
    float v = uv.y*0.55 + uv.x*0.35 + n*0.35 - 0.1;
    col = mix(vec3(1.0,0.29,0.46), vec3(1.0,0.45,0.72), smoothstep(0.1,0.55,v));
    col = mix(col, vec3(0.99,0.80,0.45), smoothstep(0.55,1.0,v));
    float glow = smoothstep(0.9, 0.0, length(uv - vec2(0.85, 1.0)));
    col = mix(col, vec3(0.98,0.88,0.40), glow*0.5);
  } else {
    // Raggiera: fondo viola e lilla, campi magenta, azzurri e gialli, raggi dal centro.
    vec2 w = vec2(fbm(p*1.2 + vec2(s, t*0.05)), fbm(p*1.2 + vec2(-t*0.04, s+3.1)));
    vec2 q = p*1.5 + w*1.4;
    float streak = fbm(dir*9.0 + vec2(r*1.1 - t*0.12, s));
    float streak2 = fbm(dir*24.0 + vec2(r*0.5 + t*0.08, s*1.3));
    float rr = rays * smoothstep(0.03, 0.4, r);
    float sh = (streak - 0.5)*0.5*rr + (streak2 - 0.5)*0.3*rr;
    float n0 = fbm(q*0.8 + vec2(t*0.03, s));
    float n1 = fbm(q + vec2(s+1.7, t*0.035)) + sh;
    float n2 = fbm(q*1.1 + vec2(-t*0.03, s+5.3)) - sh;
    float n3 = fbm(q*1.3 + vec2(s+9.1, -t*0.02)) + sh*0.5;
    col = mix(vec3(0.42,0.35,0.95), vec3(0.62,0.56,0.99), smoothstep(0.3, 0.7, n0));
    col = mix(col, vec3(0.93,0.48,0.96), smoothstep(0.52, 0.68, n1));
    col = mix(col, vec3(1.0,0.52,0.78), smoothstep(0.62, 0.74, n1)*0.7);
    col = mix(col, vec3(0.42,0.87,0.98), smoothstep(0.54, 0.68, n2));
    col = mix(col, vec3(0.45,0.92,0.78), smoothstep(0.66, 0.76, n2)*0.6);
    col = mix(col, vec3(0.99,0.90,0.60), smoothstep(0.66, 0.78, n3)*0.8);
    col *= 0.92 + 0.22*(streak2 - 0.5)*rr + 0.12*(streak - 0.5)*rr;
    float bloom = exp(-r*r*7.0);
    col = mix(col, vec3(0.96,0.75,1.0), bloom*0.4*rays);
    if (mode == 3) {
      // Raggiera del titolo: più viola sotto il testo.
      col = mix(col, vec3(0.47,0.40,0.95), 0.4*smoothstep(0.55, 0.0, uv.y));
    }
  }
  // Grana leggera per evitare le bande nella compressione video.
  float g = hash(gl_FragCoord.xy + fract(t)*61.0) - 0.5;
  col += g*0.012;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

let gl: WebGLRenderingContext | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let program: WebGLProgram | null = null;
let failed = false;
const uni: Record<string, WebGLUniformLocation | null> = {};

function init(): boolean {
  if (gl) return true;
  if (failed) return false;
  glCanvas = document.createElement('canvas');
  gl = glCanvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
  if (!gl) {
    failed = true;
    return false;
  }
  const sh = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);
  } catch (e) {
    console.error(e);
    failed = true;
    gl = null;
    return false;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const u of ['res', 't', 'seed', 'mode', 'ctr', 'rays']) uni[u] = gl.getUniformLocation(program, u);
  return true;
}

const MODE: Record<IridescentStyle, number> = { raggiera: 0, nativa: 1, fucsia: 2, raggieraTitolo: 3 };

/**
 * Restituisce un canvas con la materia iridescente alla risoluzione richiesta.
 * Il canvas è condiviso: va disegnato subito.
 */
export function renderIridescent(w: number, h: number, params: IridescentParams): HTMLCanvasElement | null {
  if (!init() || !gl || !glCanvas) return null;
  // La materia è morbida: mezza risoluzione basta e tiene alta la velocità.
  const scale = 0.5;
  const W = Math.max(8, Math.round(w * scale));
  const H = Math.max(8, Math.round(h * scale));
  if (glCanvas.width !== W || glCanvas.height !== H) {
    glCanvas.width = W;
    glCanvas.height = H;
  }
  gl.viewport(0, 0, W, H);
  gl.uniform2f(uni.res, W, H);
  gl.uniform1f(uni.t, params.time * (params.speed ?? 1));
  gl.uniform1f(uni.seed, params.seed);
  gl.uniform1i(uni.mode, MODE[params.style] ?? 0);
  gl.uniform2f(uni.ctr, params.cx ?? 0.5, params.cy ?? 0.5);
  gl.uniform1f(uni.rays, params.rays ?? 0.8);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return glCanvas;
}

/** Disegna la materia sul rettangolo indicato; senza WebGL ripiega su una sfumatura. */
export function drawIridescent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  params: IridescentParams,
) {
  const c = renderIridescent(w, h, params);
  if (c) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, x, y, w, h);
    ctx.restore();
    return;
  }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#D97BF5');
  g.addColorStop(0.4, '#705EF2');
  g.addColorStop(0.75, '#77E3F5');
  g.addColorStop(1, '#4ED1A6');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
