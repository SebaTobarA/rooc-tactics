import { contours } from 'd3-contour';
import simplify from 'simplify-js';
import type { Vec2 } from '../../src/types/index.ts';
import type { Mask } from './raster.ts';

export interface Shape {
  points: Vec2[];
  holes: Vec2[][];
}

interface Options {
  /** Área mínima (px²) de un polígono o agujero para conservarlo. */
  minArea: number;
  /** Tolerancia de simplificación en px. */
  tolerance: number;
}

/** Contornos del umbral 0.5 de la máscara, simplificados y normalizados a 0–1. */
export function maskToShapes(mask: Mask, { minArea, tolerance }: Options): Shape[] {
  const [multi] = contours().size([mask.w, mask.h]).thresholds([0.5])(Array.from(mask.data));
  const toRing = (ring: number[][]): Vec2[] | null => {
    if (Math.abs(ringArea(ring)) < minArea) return null;
    const simple = simplify(ring.slice(0, -1).map(([x, y]) => ({ x, y })), tolerance, true);
    if (simple.length < 3) return null;
    return simple.map((p) => ({ x: round(p.x / mask.w), y: round(p.y / mask.h) }));
  };
  const shapes: Shape[] = [];
  for (const [outer, ...holes] of multi.coordinates) {
    const points = toRing(outer);
    if (!points) continue;
    shapes.push({ points, holes: holes.map(toRing).filter((r): r is Vec2[] => r !== null) });
  }
  return shapes;
}

function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
