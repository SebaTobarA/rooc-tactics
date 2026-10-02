import type { MapGeometry, Vec2 } from '../types/index.ts';
import { pointInPolygon } from './geometry.ts';

/**
 * Terreno transitable: fichas, flechas y animaciones no pasan por el bosque.
 * Se trabaja sobre una grilla derivada de los polígonos `walkable` de la geometría,
 * así que sigue los retoques del editor de mapa.
 */

const COLS = 176;

/** Celdas de holgura respecto del bosque: las rutas pasan por el centro de los senderos, no pegadas al borde. */
const CLEARANCE = 3;

interface Grid {
  cols: number;
  rows: number;
  /** 1 = transitable. */
  cells: Uint8Array;
  /** 1 = transitable y a más de CLEARANCE celdas del bosque. */
  clear: Uint8Array;
}

const grids = new WeakMap<MapGeometry, Grid>();
const routes = new WeakMap<MapGeometry, Map<string, Vec2[]>>();

/** ¿El punto está sobre terreno transitable? (prueba exacta contra los polígonos) */
export const isWalkable = (p: Vec2, g: MapGeometry): boolean => g.walkable.some((poly) => pointInPolygon(p, poly));

function gridOf(g: MapGeometry, aspect: number): Grid {
  let grid = grids.get(g);
  if (grid) return grid;
  const cols = COLS;
  const rows = Math.max(1, Math.round(COLS / aspect));
  const cells = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells[r * cols + c] = isWalkable({ x: (c + 0.5) / cols, y: (r + 0.5) / rows }, g) ? 1 : 0;
  const clear = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let ok = cells[r * cols + c] === 1;
      for (let dr = -CLEARANCE; ok && dr <= CLEARANCE; dr++) {
        for (let dc = -CLEARANCE; ok && dc <= CLEARANCE; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (dr * dr + dc * dc <= CLEARANCE * CLEARANCE && (nr < 0 || nc < 0 || nr >= rows || nc >= cols || !cells[nr * cols + nc])) ok = false;
        }
      }
      clear[r * cols + c] = ok ? 1 : 0;
    }
  }
  grid = { cols, rows, cells, clear };
  grids.set(g, grid);
  return grid;
}

const cellOf = (p: Vec2, grid: Grid) => ({
  c: Math.min(grid.cols - 1, Math.max(0, Math.floor(p.x * grid.cols))),
  r: Math.min(grid.rows - 1, Math.max(0, Math.floor(p.y * grid.rows))),
});
const centerOf = (c: number, r: number, grid: Grid): Vec2 => ({ x: (c + 0.5) / grid.cols, y: (r + 0.5) / grid.rows });
const round = (p: Vec2): Vec2 => ({ x: Math.round(p.x * 10000) / 10000, y: Math.round(p.y * 10000) / 10000 });

/** Si el punto cae en el bosque, lo lleva al punto transitable más cercano; si no, lo devuelve igual. */
export function snapToWalkable(p: Vec2, g: MapGeometry, aspect: number): Vec2 {
  if (!g.walkable.length || isWalkable(p, g)) return p;
  const grid = gridOf(g, aspect);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < grid.cells.length; i++) {
    if (!grid.cells[i]) continue;
    const c = i % grid.cols;
    const r = (i - c) / grid.cols;
    const dx = (c + 0.5) / grid.cols - p.x;
    const dy = ((r + 0.5) / grid.rows - p.y) / aspect;
    const d = dx * dx + dy * dy;
    if (d < bestDist) (bestDist = d), (best = i);
  }
  if (best < 0) return p;
  const inside = centerOf(best % grid.cols, Math.floor(best / grid.cols), grid);
  // Acerca el resultado al punto pedido todo lo que el borde permita.
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2;
    if (isWalkable({ x: inside.x + (p.x - inside.x) * mid, y: inside.y + (p.y - inside.y) * mid }, g)) lo = mid;
    else hi = mid;
  }
  // Un poco hacia adentro del borde, y verificado después de redondear: el resultado siempre es transitable.
  for (const k of [lo * 0.92, lo * 0.7, 0]) {
    const q = round({ x: inside.x + (p.x - inside.x) * k, y: inside.y + (p.y - inside.y) * k });
    if (isWalkable(q, g)) return q;
  }
  return inside;
}

/** ¿El tramo recto entre dos puntos va completo por terreno transitable? */
export function segmentWalkable(a: Vec2, b: Vec2, g: MapGeometry, aspect: number): boolean {
  const grid = gridOf(g, aspect);
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, (b.y - a.y) / aspect) * grid.cols * 2.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, g)) return false;
  }
  return true;
}

/**
 * Tramo recto apto para una ruta: transitable y, salvo cerca de los extremos de la ruta
 * (donde la ficha puede estar junto al borde), con holgura respecto del bosque.
 */
function segmentClear(a: Vec2, b: Vec2, ends: [Vec2, Vec2], g: MapGeometry, aspect: number): boolean {
  const grid = gridOf(g, aspect);
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, (b.y - a.y) / aspect) * grid.cols * 2.5));
  const free = (CLEARANCE + 2) / grid.cols;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (!isWalkable(p, g)) return false;
    const { c, r } = cellOf(p, grid);
    if (grid.clear[r * grid.cols + c]) continue;
    const nearEnd = ends.some((e) => Math.hypot(e.x - p.x, (e.y - p.y) / aspect) < free);
    if (!nearEnd) return false;
  }
  return true;
}

/** A* sobre la grilla (8 vecinos, sin cortar esquinas). Devuelve índices de celda o null si no hay camino. */
function astar(start: number, goal: number, grid: Grid): number[] | null {
  const { cols, rows, cells, clear } = grid;
  const n = cells.length;
  const gScore = new Float32Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gc = goal % cols;
  const gr = (goal - gc) / cols;
  const h = (i: number) => Math.hypot((i % cols) - gc, Math.floor(i / cols) - gr);
  // Montículo binario mínimo de [prioridad, celda].
  const heap: [number, number][] = [];
  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  gScore[start] = 0;
  push([h(start), start]);
  while (heap.length) {
    const [, cur] = pop();
    if (cur === goal) {
      const path = [cur];
      for (let i = cur; from[i] >= 0; i = from[i]) path.push(from[i]);
      return path.reverse();
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const c = cur % cols;
    const r = (cur - c) / cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const next = nr * cols + nc;
        if (!cells[next] || closed[next]) continue;
        if (dr && dc && (!cells[r * cols + nc] || !cells[nr * cols + c])) continue;
        // Las celdas pegadas al bosque cuestan más: la ruta prefiere el centro del sendero, pero puede cruzar pasos angostos.
        const cost = gScore[cur] + (dr && dc ? Math.SQRT2 : 1) * (clear[next] ? 1 : 6);
        if (cost < gScore[next]) {
          gScore[next] = cost;
          from[next] = cur;
          push([cost + h(next), next]);
        }
      }
    }
  }
  return null;
}

/**
 * Ruta entre dos puntos que no cruza el bosque. Si la línea recta es transitable, devuelve solo los extremos.
 * Los extremos se ajustan primero a terreno transitable. Si no hay camino, devuelve la recta.
 */
export function route(a: Vec2, b: Vec2, g: MapGeometry, aspect: number): Vec2[] {
  if (!g.walkable.length) return [a, b];
  const key = `${a.x},${a.y}>${b.x},${b.y}`;
  let cache = routes.get(g);
  if (!cache) routes.set(g, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;

  const start = snapToWalkable(a, g, aspect);
  const end = snapToWalkable(b, g, aspect);
  let result: Vec2[] = [start, end];
  const ends: [Vec2, Vec2] = [start, end];
  if (!segmentClear(start, end, ends, g, aspect)) {
    const grid = gridOf(g, aspect);
    const nearestCell = (p: Vec2) => {
      const { c, r } = cellOf(p, grid);
      if (grid.cells[r * grid.cols + c]) return r * grid.cols + c;
      const s = cellOf(snapToWalkable(centerOf(c, r, grid), g, aspect), grid);
      return s.r * grid.cols + s.c;
    };
    const cellsPath = astar(nearestCell(start), nearestCell(end), grid);
    if (cellsPath) {
      const pts = [start, ...cellsPath.slice(1, -1).map((i) => centerOf(i % grid.cols, Math.floor(i / grid.cols), grid)), end];
      // Suavizado: desde cada punto se salta al más lejano que se ve en línea recta.
      const smooth = [pts[0]];
      let i = 0;
      while (i < pts.length - 1) {
        let j = pts.length - 1;
        while (j > i + 1 && !segmentClear(pts[i], pts[j], ends, g, aspect)) j--;
        smooth.push(pts[j]);
        i = j;
      }
      // En pasos angostos queda la escalera de la grilla: se quitan los puntos casi alineados si el tramo sigue siendo transitable.
      const tol = 1.3 / grid.cols;
      for (let k = 1; k < smooth.length - 1; ) {
        const [p0, p1, p2] = [smooth[k - 1], smooth[k], smooth[k + 1]];
        const dx = p2.x - p0.x;
        const dy = (p2.y - p0.y) / aspect;
        const dev = Math.abs(dx * ((p1.y - p0.y) / aspect) - dy * (p1.x - p0.x)) / (Math.hypot(dx, dy) || 1);
        if (dev < tol && segmentWalkable(p0, p2, g, aspect)) smooth.splice(k, 1);
        else k++;
      }
      result = smooth.map(round);
    }
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  return result;
}

/** Punto a una fracción `t` (0–1) del largo de una ruta. */
export function pointAlong(path: Vec2[], t: number, aspect: number): Vec2 {
  if (path.length < 2) return path[0];
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, (p.y - path[i].y) / aspect));
  let remaining = lengths.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, t));
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? Math.min(1, remaining / lengths[i]) : 0;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k };
    }
    remaining -= lengths[i];
  }
  return path[path.length - 1];
}
