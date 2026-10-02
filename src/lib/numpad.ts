import type { NumpadGrid, Vec2 } from '../types/index.ts';

/** Convención de la guild: el mapa se divide como un pad numérico. */
export const ZONE_KEYS: Record<number, string> = {
  7: 'Home', 8: '↑', 9: 'PgUp',
  4: '←', 5: '', 6: '→',
  1: 'End', 2: '↓', 3: 'PgDn',
};

/** Zona (1–9) en la que cae un punto normalizado. */
export function zoneOf(p: Vec2, grid: NumpadGrid): number {
  const col = p.x < grid.cols[0] ? 0 : p.x < grid.cols[1] ? 1 : 2;
  const row = p.y < grid.rows[0] ? 0 : p.y < grid.rows[1] ? 1 : 2;
  return (2 - row) * 3 + col + 1;
}

/** Centro normalizado de cada zona, para dibujar su etiqueta. */
export function zoneCenters(grid: NumpadGrid): { zone: number; center: Vec2 }[] {
  const xs = [0, ...grid.cols, 1];
  const ys = [0, ...grid.rows, 1];
  const out: { zone: number; center: Vec2 }[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      out.push({ zone: (2 - row) * 3 + col + 1, center: { x: (xs[col] + xs[col + 1]) / 2, y: (ys[row] + ys[row + 1]) / 2 } });
  return out;
}
