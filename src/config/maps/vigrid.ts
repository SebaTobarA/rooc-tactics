import type { MapConfig, MapGeometry, Marker, NumpadGrid } from '../../types/index.ts';
import fieldGeometry from './vigrid.geo.json';
import fieldPlaced from './vigrid.markers.json';
import { vigridFieldStyle } from './vigrid.style.ts';

// Geometría generada desde el minimapa cenital (npm run generate:vigrid); el superadministrador la retoca desde la web.

/** Vigrid Avenge: un solo mapa, con el cuerno, los jefes y los altares. */
export const vigridField: MapConfig = {
  id: 'vigrid',
  name: 'Vigrid Avenge',
  modeId: 'vigrid',
  enabled: true,
  aspect: fieldPlaced.aspect,
  geometry: fieldGeometry as MapGeometry,
  style: vigridFieldStyle,
  numpad: fieldPlaced.numpad as NumpadGrid,
  markers: fieldPlaced.markers as Marker[],
  field: 'main',
};
