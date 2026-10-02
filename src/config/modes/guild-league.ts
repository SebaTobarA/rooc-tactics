import type { ModeConfig } from '../../types/index.ts';

export const guildLeague: ModeConfig = {
  id: 'guild-league',
  name: 'Guild League',
  enabled: true,
  description: 'GvG por liga. Gana la primera guild que llegue a 3000 puntos.',
  maps: ['vale-of-clash', 'stellar-clash', 'guild-league-map-3'],
  partySize: 5,
  raidMaxParties: 8,
  raidPresets: [
    { name: '1 raid de 40', raids: [40] },
    { name: '2 raids de 20', raids: [20, 20] },
    { name: '3 raids (15, 15 y 20)', raids: [15, 15, 20] },
  ],
  scoring: {
    winScore: 3000,
    killPoints: 1,
    // TODO: cargar los valores reales desde las tablas del juego (assets-src/pillar-points-*.webp).
    tiers: [
      { id: 'B', destroyPoints: null, capturePointsPerTick: null },
      { id: 'A', destroyPoints: null, capturePointsPerTick: null },
      { id: 'S', destroyPoints: null, capturePointsPerTick: null },
    ],
    // TODO: cada cuántos segundos suma puntos una zona capturada.
    captureTickSeconds: null,
  },
};
