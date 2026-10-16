import type { MapConfig, MapGeometry, Marker, NumpadGrid } from '../../types/index.ts';
import fellandsGeometry from './vigrid-fellands.geo.json';
import fellandsPlaced from './vigrid-fellands.markers.json';
import fieldGeometry from './vigrid.geo.json';
import fieldPlaced from './vigrid.markers.json';
import { vigridFellandsStyle, vigridFieldStyle } from './vigrid.style.ts';

// Geometría generada desde los minimapas cenitales (npm run generate:vigrid); el superadministrador la retoca desde la web.

/** Vigrid Field: el campo principal (40 jugadores), con el cuerno, los jefes y los altares. */
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

/** Ruinscape (Fellands): el subcampo, laberinto de frutas y Nidhogg para juntar méritos. */
export const vigridFellands: MapConfig = {
  id: 'vigrid-fellands',
  name: 'Vigrid · Ruinscape (Fellands)',
  modeId: 'vigrid',
  enabled: true,
  aspect: fellandsPlaced.aspect,
  geometry: fellandsGeometry as MapGeometry,
  style: vigridFellandsStyle,
  numpad: fellandsPlaced.numpad as NumpadGrid,
  markers: fellandsPlaced.markers as Marker[],
  field: 'sub',
};
