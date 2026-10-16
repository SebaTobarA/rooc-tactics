import type { MapStyle } from '../../types/index.ts';

/** Vigrid Field: cañón de arena con crestas de roca rojiza. Paleta propia; no usa arte del juego. */
export const vigridFieldStyle: MapStyle = {
  terrain: 'canyon',
  fog: '#24170f',
  ground: '#8a5a36',
  walkable: '#e9d3a0',
  walkableStroke: '#c39f66',
  forest: '#6e4128',
  forestShade: '#4f2d1a',
  rock: '#a5663d',
  water: '#3b82c4',
  plaza: '#d3c19c',
  plazaStroke: '#8e7a5a',
  grid: '#ffffff',
  textureOpacity: 0.1,
  grass: '#d2ad74',
  wall: '#b48a60',
  cloud: '#f1e4cc',
  canopy: ['#a86b40', '#b97a4a', '#94593a', '#c48a58'],
  canopyShade: '#3f2414',
};
