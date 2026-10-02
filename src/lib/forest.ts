import type { MapGeometry, Vec2 } from '../types/index.ts';
import { pointInPolygon, pointInRing } from './geometry.ts';

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tree {
  pos: Vec2;
  /** Tamaño relativo (0.7–1.4). */
  size: number;
  /** 0–1, para variar el tono. */
  shade: number;
}

/**
 * Reparte árboles sobre todo lo que queda dentro del contorno y no es transitable, agua ni roca.
 * Grilla con desorden determinista: el mismo mapa siempre da el mismo bosque, en 2D y en 2.5D.
 * `cols` es la cantidad de árboles a lo ancho del mapa.
 */
export function scatterForest(g: MapGeometry, aspect: number, cols: number, seed = 7): Tree[] {
  const rand = mulberry32(seed);
  const step = 1 / cols;
  const rows = Math.ceil(cols / aspect);
  const out: Tree[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = { x: (c + 0.5 + (rand() - 0.5)) * step, y: ((r + 0.5 + (rand() - 0.5)) * step) * aspect };
      const size = 0.7 + rand() * 0.7;
      const shade = rand();
      if (!pointInRing(pos, g.bounds)) continue;
      if (g.walkable.some((p) => pointInPolygon(pos, p)) || g.water.some((p) => pointInRing(pos, p.points))) continue;
      if (g.obstacles.some((o) => o.kind !== 'forest' && pointInRing(pos, o.points))) continue;
      out.push({ pos, size, shade });
    }
  }
  return out;
}
