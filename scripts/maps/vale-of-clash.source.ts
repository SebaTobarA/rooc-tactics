import type { Plaza, Polygon, Vec2 } from '../../src/types/index.ts';

/** Parámetros de generación de Vale of Clash. Las posiciones en px son estimaciones a mano que el script refina por color. */
export const source = {
  id: 'vale-of-clash',
  /** Foto 1: define el área 0–1 del mapa (imagen completa). */
  base: 'assets-src/vale-of-clash-base.webp',
  /** Foto 2: fuente de la forma transitable. */
  minimap: 'assets-src/vale-of-clash-minimap.webp',
  /** Panel del minimapa sin el marco de la interfaz del juego (px). */
  minimapCrop: { x: 8, y: 112, w: 420, h: 414 },
  /** Respawns en el minimapa (px), en el mismo orden que `baseLandmarks`. */
  minimapLandmarks: [
    { x: 100, y: 187 },
    { x: 340, y: 183 },
    { x: 90, y: 432 },
    { x: 335, y: 430 },
  ] as Vec2[],
  /** Respawns en la foto base (px): verde 1, verde 2, roja 1, roja 2. */
  baseLandmarks: [
    { x: 333, y: 87 },
    { x: 817, y: 72 },
    { x: 317, y: 590 },
    { x: 812, y: 582 },
  ] as Vec2[],
  /** Íconos del minimapa (px) que tapan el terreno: se borran y se rellenan con el vecino más cercano. */
  inpaint: [
    { x: 253, y: 326, r: 11 }, // cursor del jugador
    { x: 311, y: 345, r: 13 }, // triángulo verde
    { x: 309, y: 381, r: 15 }, // flecha azul
    { x: 392, y: 490, r: 24 }, // botón de lupa
  ],
  /** Resolución del ráster intermedio (ancho); el alto sale del aspecto de la foto base. */
  rasterWidth: 1200,
  /** Plaza central (px de la foto base). */
  centerPlaza: { x: 573, y: 322, r: 56 },
  /** Radio de las plazas de respawn, en unidades del ancho del mapa. */
  respawnRadius: 0.028,
  /** Extras trazados a mano que se suman a lo detectado. */
  manual: {
    plazas: [] as Plaza[],
    water: [] as Polygon[],
    decor: [] as Polygon[],
  },
};
