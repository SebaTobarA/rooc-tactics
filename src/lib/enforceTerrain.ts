import type { MapConfig, Strategy } from '../types/index.ts';
import { route, snapToWalkable } from './walk.ts';

/**
 * Ajusta una estrategia al terreno: saca del bosque las fichas y enruta por los senderos
 * las flechas y líneas rectas que lo cruzan. Sirve para estrategias creadas antes de esta regla.
 */
export function enforceTerrain(strategy: Strategy, map: MapConfig): Strategy {
  const { geometry: g, aspect } = map;
  return {
    ...strategy,
    steps: strategy.steps.map((step) => ({
      ...step,
      tokens: step.tokens.map((t) => {
        const pos = snapToWalkable(t.pos, g, aspect);
        return pos === t.pos ? t : { ...t, pos };
      }),
      drawings: step.drawings.map((d) => {
        if ((d.tool !== 'arrow' && d.tool !== 'line') || d.points.length !== 2) return d;
        const path = route(d.points[0], d.points[1], g, aspect);
        return path.length === 2 && path[0] === d.points[0] && path[1] === d.points[1] ? d : { ...d, points: path };
      }),
    })),
  };
}
