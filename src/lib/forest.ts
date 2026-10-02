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
 * Grilla con desorden determinista: el mismo mapa siempre da el mismo bosque, en 2D y en 3D.
 * `cols` es la cantidad de árboles a lo ancho del mapa. Con `area: 'rect'` el bosque llena todo el rectángulo del mapa.
 */
export function scatterForest(g: MapGeometry, aspect: number, cols: number, seed = 7, area: 'bounds' | 'rect' = 'bounds'): Tree[] {
  const rand = mulberry32(seed);
  const step = 1 / cols;
  const rows = Math.ceil(cols / aspect);
  const out: Tree[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = { x: (c + 0.5 + (rand() - 0.5)) * step, y: ((r + 0.5 + (rand() - 0.5)) * step) * aspect };
      const size = 0.7 + rand() * 0.7;
      const shade = rand();
      if (area === 'bounds' ? !pointInRing(pos, g.bounds) : pos.x < 0 || pos.x > 1 || pos.y < 0 || pos.y > 1) continue;
      if (g.walkable.some((p) => pointInPolygon(pos, p)) || g.water.some((p) => pointInRing(pos, p.points))) continue;
      if (g.obstacles.some((o) => o.kind !== 'forest' && pointInRing(pos, o.points))) continue;
      out.push({ pos, size, shade });
    }
  }
  return out;
}

export interface Puff {
  pos: Vec2;
  /** Radio en unidades del ancho del mapa. */
  radius: number;
  /** 0–1, para variar altura y forma. */
  seed: number;
}

/** Nubes repartidas por fuera del contorno jugable, en tres franjas. */
export function scatterClouds(bounds: Vec2[], aspect: number, seed = 11): Puff[] {
  const rand = mulberry32(seed);
  const c = { x: bounds.reduce((a, p) => a + p.x, 0) / bounds.length, y: bounds.reduce((a, p) => a + p.y, 0) / bounds.length };
  const out: Puff[] = [];
  bounds.forEach((p, i) => {
    const q = bounds[(i + 1) % bounds.length];
    const steps = Math.max(1, Math.round(Math.hypot(q.x - p.x, (q.y - p.y) / aspect) / 0.04));
    for (let k = 0; k < steps; k++) {
      const x = p.x + ((q.x - p.x) * k) / steps;
      const y = p.y + ((q.y - p.y) * k) / steps;
      const dx = x - c.x;
      const dy = (y - c.y) / aspect;
      const len = Math.hypot(dx, dy) || 1;
      for (let layer = 0; layer < 3; layer++) {
        const off = 0.035 + layer * 0.04 + rand() * 0.02;
        out.push({
          pos: { x: x + (dx / len) * off + (rand() - 0.5) * 0.025, y: y + ((dy / len) * off + (rand() - 0.5) * 0.025) * aspect },
          radius: 0.026 + rand() * 0.026 + layer * 0.008,
          seed: rand(),
        });
      }
    }
  });
  return out;
}

export interface WallBlock {
  pos: Vec2;
  /** Ángulo del tramo de muro, en el plano normalizado corregido por aspecto. */
  angle: number;
  /** 0–1: altura y tono del bloque. */
  seed: number;
}

/** Bloques de piedra a lo largo de un anillo, con huecos, para los muros de las ruinas. `spacing` en unidades del ancho del mapa. */
export function wallBlocks(ring: Vec2[], aspect: number, spacing: number, rand: () => number): WallBlock[] {
  const out: WallBlock[] = [];
  let carry = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = (b.y - a.y) / aspect;
    const len = Math.hypot(dx, dy);
    let d = carry;
    while (d < len) {
      const t = d / len;
      const seed = rand();
      // Un quinto de los bloques falta: son ruinas.
      if (rand() > 0.2) out.push({ pos: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, angle: Math.atan2(dy, dx), seed });
      d += spacing;
    }
    carry = d - len;
  }
  return out;
}
