import type { Drawing, Vec2 } from '../../types/index.ts';

/** Distancia entre puntos normalizados, corregida por el aspecto y medida en unidades del ancho del mapa. */
export const normDist = (a: Vec2, b: Vec2, aspect: number) => Math.hypot(a.x - b.x, (a.y - b.y) / aspect);

function distToSegment(p: Vec2, a: Vec2, b: Vec2, aspect: number): number {
  const ax = a.x, ay = a.y / aspect, bx = b.x, by = b.y / aspect, px = p.x, py = p.y / aspect;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** ¿El punto toca el dibujo? Sirve para el borrador en 2D y 3D. */
export function hitDrawing(d: Drawing, p: Vec2, aspect: number, tol = 0.012): boolean {
  const pts = d.points;
  if (d.tool === 'text' || d.tool === 'ping') return normDist(pts[0], p, aspect) < tol * 2.5;
  if (d.tool === 'circle') return Math.abs(normDist(pts[0], p, aspect) - normDist(pts[0], pts[1], aspect)) < tol;
  const line = d.tool === 'rect'
    ? [pts[0], { x: pts[1].x, y: pts[0].y }, pts[1], { x: pts[0].x, y: pts[1].y }, pts[0]]
    : pts;
  for (let i = 0; i < line.length - 1; i++) if (distToSegment(p, line[i], line[i + 1], aspect) < tol) return true;
  return false;
}

/** Punto de control de una flecha de rotación: el medio, desplazado en perpendicular. */
export function curveControl(a: Vec2, b: Vec2, aspect: number): Vec2 {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) / aspect;
  return { x: (a.x + b.x) / 2 - dy * 0.3, y: (a.y + b.y) / 2 + dx * 0.3 * aspect };
}
