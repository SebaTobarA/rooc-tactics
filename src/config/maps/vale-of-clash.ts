import type { MapConfig, MapGeometry } from '../../types/index.ts';
import align from './vale-of-clash.align.json';
import geometry from './vale-of-clash.geo.json';
import { valeOfClashStyle } from './vale-of-clash.style.ts';

// El bloque `markers` + `numpad` se puede reemplazar con lo que exporta el editor de mapa.
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
  numpad: { cols: [0.387, 0.606], rows: [0.332, 0.584] },
  markers: [
    { id: 'central-pillar', kind: 'central-pillar', tier: 'S', pos: { x: 0.5048, y: 0.4813 }, label: 'Pilar central', confirmed: true },
    { id: 'respawn-green-1', kind: 'respawn', side: 'green', pos: { x: 0.2943, y: 0.1306 }, label: 'Respawn Verde 1', confirmed: true },
    { id: 'respawn-green-2', kind: 'respawn', side: 'green', pos: { x: 0.7198, y: 0.1094 }, label: 'Respawn Verde 2', confirmed: true },
    { id: 'respawn-red-1', kind: 'respawn', side: 'red', pos: { x: 0.2801, y: 0.8837 }, label: 'Respawn Roja 1', confirmed: true },
    { id: 'respawn-red-2', kind: 'respawn', side: 'red', pos: { x: 0.7155, y: 0.8707 }, label: 'Respawn Roja 2', confirmed: true },
    // TODO: nombre y función de los puntos verdes y morados por confirmar.
    { id: 'point-green-1', kind: 'point-green', pos: { x: 0.42, y: 0.13 }, label: 'Punto verde 1', confirmed: false },
    { id: 'point-green-2', kind: 'point-green', pos: { x: 0.73, y: 0.52 }, label: 'Punto verde 2', confirmed: false },
    { id: 'point-green-3', kind: 'point-green', pos: { x: 0.27, y: 0.69 }, label: 'Punto verde 3', confirmed: false },
    { id: 'point-green-4', kind: 'point-green', pos: { x: 0.62, y: 0.93 }, label: 'Punto verde 4', confirmed: false },
    { id: 'point-purple-1', kind: 'point-purple', pos: { x: 0.39, y: 0.26 }, label: 'Punto morado 1', confirmed: false },
    { id: 'point-purple-2', kind: 'point-purple', pos: { x: 0.63, y: 0.69 }, label: 'Punto morado 2', confirmed: false },
    { id: 'point-purple-3', kind: 'point-purple', pos: { x: 0.42, y: 0.83 }, label: 'Punto morado 3', confirmed: false },
    // Posibles ubicaciones de pilares detectadas en la foto; el resto se ubica con el editor de mapa.
    { id: 'pillar-slot-1', kind: 'pillar-slot', pos: { x: 0.5932, y: 0.2792 }, label: 'Pilar 1', confirmed: false },
    { id: 'pillar-slot-2', kind: 'pillar-slot', pos: { x: 0.7181, y: 0.33 }, label: 'Pilar 2', confirmed: false },
    { id: 'pillar-slot-3', kind: 'pillar-slot', pos: { x: 0.2841, y: 0.3872 }, label: 'Pilar 3', confirmed: false },
    { id: 'pillar-slot-4', kind: 'pillar-slot', pos: { x: 0.3943, y: 0.4318 }, label: 'Pilar 4', confirmed: false },
    { id: 'pillar-slot-5', kind: 'pillar-slot', pos: { x: 0.766, y: 0.6898 }, label: 'Pilar 5', confirmed: false },
    { id: 'pillar-slot-6', kind: 'pillar-slot', pos: { x: 0.4737, y: 0.6938 }, label: 'Pilar 6', confirmed: false },
  ],
};
