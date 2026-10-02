import { centroid, round4 } from '../../lib/geometry.ts';
import { newId } from '../../lib/id.ts';
import type { PolyList } from '../../store/editorStore.ts';
import type { MapConfig, MapGeometry, Marker, MarkerKind, Plaza, Polygon, PolygonKind, Vec2 } from '../../types/index.ts';

export type EditableKind = PolygonKind | 'plaza';

export const KIND_LABELS: Record<EditableKind, string> = {
  walkable: 'Transitable',
  forest: 'Obstáculo: bosque',
  rock: 'Obstáculo: roca',
  water: 'Agua',
  ruin: 'Decoración: ruina o muro',
  plaza: 'Plaza (círculo)',
};

export const MARKER_LABELS: Record<MarkerKind, string> = {
  'central-pillar': 'Pilar central',
  respawn: 'Respawn',
  'pillar-slot': 'Ubicación de pilar',
  'point-green': 'Punto verde',
  'point-purple': 'Punto morado',
};

const LIST_FOR_KIND: Record<PolygonKind, Exclude<PolyList, 'bounds'>> = {
  walkable: 'walkable',
  forest: 'obstacles',
  rock: 'obstacles',
  water: 'water',
  ruin: 'decor',
};
const DEFAULT_HEIGHT: Record<PolygonKind, number> = { walkable: 0, forest: 2, rock: 1, water: 0, ruin: 0.5 };

export function findPolygon(g: MapGeometry, list: PolyList, id: string): Polygon | undefined {
  return list === 'bounds' ? undefined : g[list].find((p) => p.id === id);
}

/** Anillos (contorno + agujeros) del polígono; son referencias, se pueden mutar sobre un clon. */
export function ringsOf(g: MapGeometry, list: PolyList, id: string): Vec2[][] | null {
  if (list === 'bounds') return [g.bounds];
  const p = findPolygon(g, list, id);
  return p ? [p.points, ...(p.holes ?? [])] : null;
}

export function addPolygon(map: MapConfig, points: Vec2[], kind: PolygonKind = 'forest'): { list: PolyList; id: string } {
  const list = LIST_FOR_KIND[kind];
  const id = newId(kind);
  map.geometry[list].push({ id, kind, points, height: DEFAULT_HEIGHT[kind] });
  return { list, id };
}

export function removePolygon(map: MapConfig, list: PolyList, id: string): void {
  if (list === 'bounds') return;
  map.geometry[list] = map.geometry[list].filter((p) => p.id !== id);
}

/** Cambia el tipo de un polígono y lo mueve a la lista que corresponde. Devuelve la nueva lista. */
export function setPolygonKind(map: MapConfig, list: PolyList, id: string, kind: PolygonKind): PolyList {
  const poly = findPolygon(map.geometry, list, id);
  if (!poly || list === 'bounds') return list;
  const target = LIST_FOR_KIND[kind];
  poly.kind = kind;
  poly.height = DEFAULT_HEIGHT[kind];
  if (target !== list) {
    removePolygon(map, list, id);
    map.geometry[target].push(poly);
  }
  return target;
}

/** Convierte un polígono en plaza circular (centro = centroide, radio = distancia media). */
export function polygonToPlaza(map: MapConfig, list: PolyList, id: string): string | null {
  const poly = findPolygon(map.geometry, list, id);
  if (!poly) return null;
  const c = centroid(poly.points);
  // Los radios van en unidades del ancho del mapa; la distancia en y se corrige con el aspecto.
  const r = poly.points.reduce((a, p) => a + Math.hypot(p.x - c.x, (p.y - c.y) / map.aspect), 0) / poly.points.length;
  removePolygon(map, list, id);
  return addPlaza(map, c, r).id;
}

export function addPlaza(map: MapConfig, center: Vec2, radius = 0.016): Plaza {
  const plaza: Plaza = { id: newId('plaza'), kind: 'pillar', center: { x: round4(center.x), y: round4(center.y) }, radius: round4(radius) };
  map.geometry.plazas.push(plaza);
  return plaza;
}

export function addMarker(map: MapConfig, kind: MarkerKind, pos: Vec2): Marker {
  const count = map.markers.filter((m) => m.kind === kind).length + 1;
  const marker: Marker = {
    id: newId(kind),
    kind,
    pos,
    label: kind === 'central-pillar' ? MARKER_LABELS[kind] : `${kind === 'pillar-slot' ? 'Pilar' : MARKER_LABELS[kind]} ${count}`,
    confirmed: kind === 'respawn' || kind === 'central-pillar',
    ...(kind === 'respawn' ? { side: 'green' as const } : {}),
  };
  map.markers.push(marker);
  return marker;
}
