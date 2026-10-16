import type { MapGeometry, Vec2 } from '../types/index.ts';
import { rasterize } from './geometry.ts';

/**
 * Relieve del terreno transitable. Las plazas con `height` son mesetas; desde su borde el sendero baja en
 * rampa según la distancia a pie (no en línea recta), así la subida sigue la espiral real que rodea cada altar.
 * Lo usan el suelo 3D, las fichas, los marcadores, los dibujos y el sombreado de las rampas.
 */

/** Unidades de mundo 3D por unidad de altura de la geometría (igual que las crestas y muros). */
export const HEIGHT_UNIT = 0.9;
/** La rampa termina donde el camino sale del círculo de este radio (en radios de la meseta). */
const DEFAULT_REACH = 2.6;
/** Tope de largo de una rampa, a pie (unidades del ancho del mapa). */
const MAX_RAMP = 0.6;
/** Columnas de la grilla del relieve: más fina que la de rutas para no cerrar las aberturas angostas de las espirales. */
const COLS = 420;


export interface Elevation {
  cols: number;
  rows: number;
  /** Altura por celda, en unidades de la geometría. */
  h: Float32Array;
}

const cache = new WeakMap<MapGeometry, Elevation | null>();

const smooth = (t: number) => t * t * (3 - 2 * t);

export function elevationOf(g: MapGeometry, aspect: number): Elevation | null {
  if (cache.has(g)) return cache.get(g)!;
  const zones = g.plazas.filter((p) => (p.height ?? 0) > 0);
  if (!zones.length) {
    cache.set(g, null);
    return null;
  }
  const cols = COLS;
  const rows = Math.max(1, Math.round(COLS / aspect));
  const cells = rasterize(g, cols, rows);
  const n = cols * rows;
  const h = new Float32Array(n);
  const reach = g.rampReach ?? DEFAULT_REACH;
  const cw = 1 / cols;
  const ch = 1 / rows / aspect;
  // Float64: con Float32 el redondeo hacía que la cola descartara celdas y la rampa se cortara.
  const dist = new Float64Array(n);
  for (const z of zones) {
    // Dijkstra desde el disco de la meseta, solo por celdas transitables.
    dist.fill(Infinity);
    // La cima es lo que se alcanza a pie desde el centro sin salir del disco: si el disco pisa el pasillo
    // del otro lado del muro de la espiral, ese pasillo no queda en altura.
    const queue: [number, number][] = [];
    const inDisc = (i: number) => Math.hypot(((i % cols) + 0.5) * cw - z.center.x, ((Math.floor(i / cols) + 0.5) / rows - z.center.y) / aspect) <= z.radius;
    const start = Math.min(rows - 1, Math.floor(z.center.y * rows)) * cols + Math.min(cols - 1, Math.floor(z.center.x * cols));
    const stack = [start];
    dist[start] = 0;
    while (stack.length) {
      const i = stack.pop()!;
      queue.push([0, i]);
      const c = i % cols;
      for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i >= cols ? i - cols : -1, i < n - cols ? i + cols : -1]) {
        if (j >= 0 && dist[j] !== 0 && cells[j] && inDisc(j)) (dist[j] = 0), stack.push(j);
      }
    }
    // La rampa mide lo que se camina desde la meseta hasta salir de su círculo: en un altar es toda la espiral.
    const out = z.radius * reach;
    let ramp = MAX_RAMP;
    const heap = new MinHeap(queue);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > dist[i] || d >= ramp) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      if (Math.hypot((c + 0.5) * cw - z.center.x, ((r + 0.5) / rows - z.center.y) / aspect) >= out) {
        ramp = Math.min(ramp, d);
        continue;
      }
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if ((!dr && !dc) || nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const j = nr * cols + nc;
          if (!cells[j]) continue;
          const nd = d + Math.hypot(dc * cw, dr * ch);
          if (nd < dist[j]) (dist[j] = nd), heap.push([nd, j]);
        }
      }
    }
    const top = z.height!;
    for (let i = 0; i < n; i++) if (dist[i] < ramp) h[i] = Math.max(h[i], top * (1 - smooth(dist[i] / ramp)));
  }
  // Bajo las crestas vecinas el suelo acompaña a la meseta, para que no aparezcan saltos al borde del sendero.
  for (let pass = 0; pass < 12; pass++) {
    const next = h.slice();
    for (let i = 0; i < n; i++) {
      if (cells[i]) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      let m = h[i];
      for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1]) if (j >= 0) m = Math.max(m, h[j]);
      next[i] = m;
    }
    h.set(next);
  }
  const out = { cols, rows, h };
  cache.set(g, out);
  return out;
}

/** Altura del terreno en un punto normalizado, en unidades de mundo 3D (0 en mapas sin relieve). */
export function elevationAt(g: MapGeometry, aspect: number, p: Vec2): number {
  const e = elevationOf(g, aspect);
  if (!e) return 0;
  const fx = Math.min(e.cols - 1, Math.max(0, p.x * e.cols - 0.5));
  const fy = Math.min(e.rows - 1, Math.max(0, p.y * e.rows - 0.5));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fy);
  const c1 = Math.min(e.cols - 1, c0 + 1);
  const r1 = Math.min(e.rows - 1, r0 + 1);
  const tx = fx - c0;
  const ty = fy - r0;
  const at = (r: number, c: number) => e.h[r * e.cols + c];
  return ((at(r0, c0) * (1 - tx) + at(r0, c1) * tx) * (1 - ty) + (at(r1, c0) * (1 - tx) + at(r1, c1) * tx) * ty) * HEIGHT_UNIT;
}

/**
 * Sombreado de las rampas, una celda por píxel (se dibuja escalado y suavizado): claro en las caras que miran
 * a la luz, oscuro en las otras, transparente en lo plano. Las mesetas llevan un tinte claro.
 */
export function hillshade(g: MapGeometry, aspect: number): HTMLCanvasElement | null {
  const e = elevationOf(g, aspect);
  if (!e) return null;
  const canvas = document.createElement('canvas');
  canvas.width = e.cols;
  canvas.height = e.rows;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(e.cols, e.rows);
  const at = (r: number, c: number) => e.h[Math.min(e.rows - 1, Math.max(0, r)) * e.cols + Math.min(e.cols - 1, Math.max(0, c))];
  for (let r = 0; r < e.rows; r++) {
    for (let c = 0; c < e.cols; c++) {
      const gx = at(r, c + 1) - at(r, c - 1);
      const gy = at(r + 1, c) - at(r - 1, c);
      const slope = Math.hypot(gx, gy);
      const i = (r * e.cols + c) * 4;
      if (slope > 0.01) {
        // Luz desde arriba a la izquierda.
        const lit = (-gx - gy) / (slope * Math.SQRT2);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = lit > 0 ? 255 : 30;
        img.data[i + 3] = Math.min(140, (Math.abs(lit) * 0.6 + 0.3) * Math.min(1, slope * 2.5) * 255);
      } else if (at(r, c) > 0.01) {
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = 45;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Montículo binario mínimo de [distancia, celda]. */
class MinHeap {
  private a: [number, number][] = [];
  constructor(items: [number, number][]) {
    for (const it of items) this.push(it);
  }
  get size() {
    return this.a.length;
  }
  push(it: [number, number]) {
    const a = this.a;
    a.push(it);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

