import type { MapStyle } from '../../types/index.ts';

/** Paleta propia inspirada en el mapa original; no usa arte del juego. */
export const valeOfClashStyle: MapStyle = {
  fog: '#101a26',
  ground: '#2f5d3a',
  walkable: '#dccb8f',
  walkableStroke: '#b39a63',
  forest: '#245a36',
  forestShade: '#1d4530',
  rock: '#6f7780',
  water: '#3b82c4',
  plaza: '#a7adb5',
  plazaStroke: '#6c737c',
  grid: '#ffffff',
  textureOpacity: 0.08,
  grass: '#86c24c',
  wall: '#9aa1a9',
  cloud: '#eef3f8',
  canopy: ['#2f7040', '#3d8a4a', '#27603b', '#4c9a55'],
  canopyShade: '#143524',
};
