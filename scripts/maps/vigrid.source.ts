import type { Element, MarkerKind, Vec2 } from '../../src/types/index.ts';

/**
 * Parámetros de generación del mapa de Vigrid. Las posiciones (px) se tomaron a mano de las capturas
 * de referencia; el script las lleva al minimapa cenital, las normaliza y las acerca al sendero más próximo.
 */
export interface MarkerSeed {
  id: string;
  kind: MarkerKind;
  label: string;
  /** px en la imagen indicada por `from` (por defecto, el minimapa). */
  at: Vec2;
  from?: 'minimap' | 'spawns' | 'monsters';
  element?: Element;
  confirmed?: boolean;
}

export interface VigridSource {
  id: string;
  minimap: string;
  /** Respaldo para el recorte: zona del minimapa (px) que contiene el mapa. */
  crop: { x: number; y: number; w: number; h: number };
  /** Íconos que tapan el terreno y que podrían confundirse con roca o arena: se borran y se rellenan. */
  inpaint: { x: number; y: number; r: number }[];
  /** Íconos de objetivos parados sobre suelo transitable: su círculo se marca como arena. */
  clear: { x: number; y: number; r: number }[];
  /** Altura de las crestas o muros (unidades de la geometría). */
  obstacleHeight: number;
  /** Píxeles (de la grilla de 1000) que se le comen a cada lado de las crestas para ensanchar los senderos. */
  widen?: number;
  /** Plazas de piedra (px del minimapa, radio en px); con `height` son mesetas a las que se sube. */
  plazas: { id: string; kind: 'center' | 'pillar' | 'respawn'; at: Vec2; r: number; height?: number }[];
  /** Radio (en radios de la meseta) donde termina la rampa. */
  rampReach?: number;
  /** Pares de puntos para llevar otras capturas al minimapa (mismos objetos en ambas). */
  frames?: Partial<Record<'spawns' | 'monsters', { from: Vec2; to: Vec2 }[]>>;
  markers: MarkerSeed[];
}

const ENTRIES_FIELD: Vec2[] = [
  { x: 195, y: 178 },
  { x: 1012, y: 132 },
  { x: 190, y: 955 },
  { x: 1008, y: 968 },
];
const ALTARS_FIELD: Vec2[] = [
  { x: 300, y: 340 }, { x: 408, y: 437 }, { x: 880, y: 255 }, { x: 783, y: 388 },
  { x: 440, y: 738 }, { x: 345, y: 857 }, { x: 783, y: 735 }, { x: 922, y: 810 },
];
const LORDS_FIELD: Vec2[] = [
  { x: 538, y: 484 },
  { x: 695, y: 484 },
  { x: 538, y: 645 },
  { x: 695, y: 645 },
];

export const vigridField: VigridSource = {
  id: 'vigrid',
  minimap: 'assets-src/vigrid-field-minimap.webp',
  crop: { x: 28, y: 18, w: 1150, h: 1150 },
  inpaint: [
    { x: 1030, y: 128, r: 46 }, // flecha del jugador
    { x: 945, y: 1110, r: 26 }, // cursor
  ],
  clear: [
    { x: 590, y: 562, r: 46 }, // cuerno al centro
    ...LORDS_FIELD.map((p) => ({ ...p, r: 36 })),
    ...ALTARS_FIELD.map((p) => ({ ...p, r: 32 })),
    ...ENTRIES_FIELD.map((p) => ({ ...p, r: 30 })),
  ],
  // Crestas bajas, como en el juego: bordes de roca de ~2,3 m; las mesetas de los altares (2,2) quedan casi a su altura.
  obstacleHeight: 2.6,
  // En el juego los pasillos y las subidas son anchos: las crestas se adelgazan hasta 9 px por lado.
  widen: 9,
  // Los altares están sobre mesetas: se sube por la espiral que los rodea (vista 3D del juego).
  rampReach: 2.6,
  plazas: [
    { id: 'center', kind: 'center', at: { x: 590, y: 562 }, r: 70, height: 0.8 },
    ...ENTRIES_FIELD.map((p, i) => ({ id: `entry-${i + 1}`, kind: 'respawn' as const, at: p, r: 34 })),
    ...ALTARS_FIELD.map((p, i) => ({ id: `altar-${i + 1}`, kind: 'pillar' as const, at: p, r: 40, height: 2.4 })),
  ],
  frames: {
    // Captura de entradas y respawns: las 4 entradas.
    spawns: [
      { from: { x: 163, y: 363 }, to: ENTRIES_FIELD[0] },
      { from: { x: 715, y: 330 }, to: ENTRIES_FIELD[1] },
      { from: { x: 150, y: 890 }, to: ENTRIES_FIELD[2] },
      { from: { x: 710, y: 905 }, to: ENTRIES_FIELD[3] },
    ],
    // Captura de monstruos: entradas, centro y Señores Elementales.
    monsters: [
      { from: { x: 170, y: 355 }, to: ENTRIES_FIELD[0] },
      { from: { x: 728, y: 322 }, to: ENTRIES_FIELD[1] },
      { from: { x: 160, y: 887 }, to: ENTRIES_FIELD[2] },
      { from: { x: 715, y: 893 }, to: ENTRIES_FIELD[3] },
      { from: { x: 443, y: 620 }, to: { x: 590, y: 562 } },
      { from: { x: 397, y: 562 }, to: LORDS_FIELD[0] },
      { from: { x: 505, y: 562 }, to: LORDS_FIELD[1] },
      { from: { x: 392, y: 676 }, to: LORDS_FIELD[2] },
      { from: { x: 500, y: 676 }, to: LORDS_FIELD[3] },
    ],
  },
  markers: [
    { id: 'horn', kind: 'horn', label: 'Cuerno · Fallen Valkyrie', at: { x: 590, y: 548 } },
    { id: 'fenrir', kind: 'fenrir', label: 'Fenrir', at: { x: 590, y: 590 } },
    { id: 'lord-earth', kind: 'element-lord', element: 'earth', label: 'Señor de Tierra', at: LORDS_FIELD[0] },
    { id: 'lord-water', kind: 'element-lord', element: 'water', label: 'Señor de Agua', at: LORDS_FIELD[1] },
    { id: 'lord-wind', kind: 'element-lord', element: 'wind', label: 'Señor de Viento', at: LORDS_FIELD[2] },
    { id: 'lord-fire', kind: 'element-lord', element: 'fire', label: 'Señor de Fuego', at: LORDS_FIELD[3] },
    ...ENTRIES_FIELD.map((p, i) => ({ id: `entry-${i + 1}`, kind: 'entry' as const, label: `Entrada ${['NO', 'NE', 'SO', 'SE'][i]}`, at: p })),
    ...[
      { x: 443, y: 422 }, { x: 354, y: 541 }, { x: 518, y: 544 }, { x: 243, y: 632 },
      { x: 623, y: 613 }, { x: 364, y: 703 }, { x: 519, y: 690 }, { x: 442, y: 815 },
    ].map((p, i) => ({ id: `respawn-${i + 1}`, kind: 'respawn-point' as const, label: `Respawn ${i + 1}`, at: p, from: 'spawns' as const })),
    ...ALTARS_FIELD.map((p, i) => ({ id: `altar-${i + 1}`, kind: 'altar' as const, label: `Altar ${i + 1}`, at: p })),
    ...[
      { x: 337, y: 420 }, { x: 530, y: 425 }, { x: 232, y: 562 }, { x: 668, y: 531 },
      { x: 223, y: 727 }, { x: 641, y: 690 }, { x: 347, y: 852 }, { x: 550, y: 834 },
    ].map((p, i) => ({ id: `dracula-${i + 1}`, kind: 'dracula' as const, label: `Dracula ${i + 1}`, at: p, from: 'monsters' as const })),
  ],
};
