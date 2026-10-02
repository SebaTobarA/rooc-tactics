import type { MapConfig, MapGeometry, Marker, NumpadGrid } from '../../types/index.ts';
import align from './vale-of-clash.align.json';
import geometry from './vale-of-clash.geo.json';
import placed from './vale-of-clash.markers.json';
import { valeOfClashStyle } from './vale-of-clash.style.ts';

// La geometría (`.geo.json`) y los marcadores con la grilla (`.markers.json`) son los datos que
// el superadministrador edita desde la web y publica en el repositorio; no se editan a mano aquí.
export const valeOfClash: MapConfig = {
  id: 'vale-of-clash',
  name: 'Vale of Clash',
  modeId: 'guild-league',
  enabled: true,
  aspect: align.aspect,
  geometry: geometry as MapGeometry,
  style: valeOfClashStyle,
  reference: {
    image: 'assets-src/vale-of-clash-base.webp',
    crop: { x: 0, y: 0, w: 1, h: 1 },
    minimapToMap: align.minimapToMap,
  },
  numpad: placed.numpad as NumpadGrid,
  markers: placed.markers as Marker[],
};
