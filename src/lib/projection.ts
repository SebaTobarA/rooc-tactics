import type { Vec2 } from '../types/index.ts';

/** Ancho del mapa en unidades de mundo 2D; el alto sale del aspecto. */
export const WORLD_W = 1200;

export interface Projection {
  w: number;
  h: number;
  flipped: boolean;
  /** Normalizado (0–1) → mundo 2D. */
  toWorld(p: Vec2): Vec2;
  /** Mundo 2D → normalizado (0–1). */
  toNorm(p: Vec2): Vec2;
  /** Longitud normalizada (en unidades del ancho del mapa) → mundo. */
  len(n: number): number;
}

/** "Invertir lados" rota la vista 180°; los datos nunca cambian. */
export function makeProjection(aspect: number, flipped: boolean): Projection {
  const w = WORLD_W;
  const h = WORLD_W / aspect;
  return {
    w,
    h,
    flipped,
    toWorld: (p) => (flipped ? { x: (1 - p.x) * w, y: (1 - p.y) * h } : { x: p.x * w, y: p.y * h }),
    toNorm: (p) => (flipped ? { x: 1 - p.x / w, y: 1 - p.y / h } : { x: p.x / w, y: p.y / h }),
    len: (n) => n * w,
  };
}

export interface View {
  scale: number;
  x: number;
  y: number;
}

/** Pantalla (px del lienzo) → mundo 2D. */
export const screenToWorld = (p: Vec2, view: View): Vec2 => ({ x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale });

/** Vista que encaja el mapa completo en el lienzo. */
export function fitView(proj: Projection, width: number, height: number, margin = 24): View {
  const scale = Math.max(0.05, Math.min((width - margin * 2) / proj.w, (height - margin * 2) / proj.h));
  return { scale, x: (width - proj.w * scale) / 2, y: (height - proj.h * scale) / 2 };
}

// ---------- Vista 2.5D ----------

/** Ancho del mapa en unidades de mundo 3D. El suelo es el plano XZ, con Y hacia arriba. */
export const WORLD3_W = 100;

export interface Projection3 {
  w: number;
  d: number;
  /** Normalizado (0–1) → [x, z] sobre el suelo. */
  toGround(p: Vec2): [number, number];
  /** Punto del suelo → normalizado (0–1). */
  toNorm(x: number, z: number): Vec2;
  /** Longitud normalizada (en unidades del ancho del mapa) → mundo 3D. */
  len(n: number): number;
}

export function makeProjection3(aspect: number): Projection3 {
  const w = WORLD3_W;
  const d = WORLD3_W / aspect;
  return {
    w,
    d,
    toGround: (p) => [(p.x - 0.5) * w, (p.y - 0.5) * d],
    toNorm: (x, z) => ({ x: x / w + 0.5, y: z / d + 0.5 }),
    len: (n) => n * w,
  };
}
