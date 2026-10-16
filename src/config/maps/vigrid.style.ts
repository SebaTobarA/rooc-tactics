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

/** Ruinscape (Fellands): laberinto de muros de piedra sobre arena. */
export const vigridFellandsStyle: MapStyle = {
  terrain: 'ruins',
  fog: '#151a22',
  ground: '#5d6168',
  walkable: '#e6d4a4',
  walkableStroke: '#bea870',
  forest: '#5c6068',
  forestShade: '#42464d',
  rock: '#9aa0a8',
  water: '#3b82c4',
  plaza: '#c3c7cc',
  plazaStroke: '#757b84',
  grid: '#ffffff',
  textureOpacity: 0.08,
  grass: '#cdb680',
  wall: '#a9aeb5',
  cloud: '#eef3f8',
  canopy: ['#8e949c', '#a1a7ae', '#7d838b', '#b0b5bb'],
  canopyShade: '#2c3036',
};
