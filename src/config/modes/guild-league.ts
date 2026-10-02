import type { ModeConfig } from '../../types/index.ts';

export const guildLeague: ModeConfig = {
  id: 'guild-league',
  name: 'Guild League',
  enabled: true,
  description: 'GvG por liga. Gana la primera guild que llegue a 3000 puntos.',
  maps: ['vale-of-clash', 'stellar-clash', 'guild-league-map-3'],
  partySize: 5,
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
