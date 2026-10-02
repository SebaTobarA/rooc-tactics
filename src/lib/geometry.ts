import type { Vec2 } from '../types/index.ts';
import type { Projection } from './projection.ts';

export const round4 = (v: number) => Math.round(v * 10000) / 10000;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const roundVec = (p: Vec2): Vec2 => ({ x: round4(clamp01(p.x)), y: round4(clamp01(p.y)) });

/** Anillos normalizados → atributo `d` de un path en coordenadas de mundo. */
export function ringsToPath(rings: Vec2[][], proj: Projection): string {
  return rings
    .map((ring) => 'M' + ring.map((p) => { const q = proj.toWorld(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join('L') + 'Z')
    .join('');
}

export function centroid(ring: Vec2[]): Vec2 {
  const n = ring.length || 1;
  return { x: ring.reduce((a, p) => a + p.x, 0) / n, y: ring.reduce((a, p) => a + p.y, 0) / n };
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Arista más cercana a `p` entre varios anillos (distancias en el espacio que entregue `to`). */
export function nearestEdge(p: Vec2, rings: Vec2[][], to: (v: Vec2) => Vec2): { ring: number; index: number; dist: number } {
  let best = { ring: 0, index: 0, dist: Infinity };
  const q = to(p);
  rings.forEach((ring, r) => {
    for (let i = 0; i < ring.length; i++) {
      const d = distToSegment(q, to(ring[i]), to(ring[(i + 1) % ring.length]));
      if (d < best.dist) best = { ring: r, index: i, dist: d };
    }
  });
  return best;
}

export function pointInRing(p: Vec2, ring: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Punto dentro de un polígono con agujeros. */
export const pointInPolygon = (p: Vec2, poly: { points: Vec2[]; holes?: Vec2[][] }): boolean =>
  pointInRing(p, poly.points) && !(poly.holes ?? []).some((h) => pointInRing(p, h));
