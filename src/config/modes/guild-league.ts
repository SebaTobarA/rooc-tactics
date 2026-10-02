import type { ModeConfig, TierScoring } from '../../types/index.ts';
import raw from './guild-league.scoring.json';

const values = raw as { tiers: TierScoring[]; captureTickSeconds: number | null };

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
    // null = TODO. Los valores los carga el superadministrador desde la web (pestaña Objet.) y quedan en guild-league.scoring.json.
    tiers: values.tiers,
    captureTickSeconds: values.captureTickSeconds,
  },
};
