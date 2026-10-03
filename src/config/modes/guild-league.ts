import type { ModeConfig, TierScoring } from '../../types/index.ts';
import raw from './guild-league.scoring.json';

const values = raw as { tiers: TierScoring[]; captureTickSeconds: number | null };

// Tabla del Main Field confirmada en el juego. Lo que sigue sin confirmar queda en pendingRules y no entra en los cálculos.

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
    // Los valores viven en guild-league.scoring.json; el superadministrador los puede corregir y publicar desde la web.
    tiers: values.tiers,
    captureTickSeconds: values.captureTickSeconds,
    pendingRules: [
      '¿Los pilares se refrescan (Crystal Pillar Refresh Countdown)? ¿Cada cuánto, por tier?',
      '¿Qué pasa con la captura cuando otra guild entra a la zona: se pausa, se reinicia o se pierde el progreso?',
    ],
    matchDurationSeconds: null,
    // Campo Secundario (Sub Field): no gana la partida; da moral, que se traduce en mejoras para el Principal.
    sub: {
      label: 'Campo Secundario',
      unit: 'moral',
      goal: null,
      thresholds: [
        { at: 1000, reward: 'Buff de Moral nivel 1 en el Campo Principal (reducción de daño y velocidad de movimiento)' },
        { at: 2000, reward: 'Buff de Moral nivel 2 en el Campo Principal' },
        { at: 3000, reward: 'Buff de Moral nivel 3 en el Campo Principal (último umbral; la moral puede seguir subiendo)' },
      ],
      killPoints: null,
      tiers: [
        { id: 'B', destroyPoints: 30, capturePointsPerTick: 5, maxTicks: 20 },
        { id: 'A', destroyPoints: 50, capturePointsPerTick: 7, maxTicks: 20 },
        { id: 'S', destroyPoints: 80, capturePointsPerTick: 7, maxTicks: 30 },
      ],
      captureTickSeconds: 3,
      commander: {
        trigger: 'S',
        target: 'main',
        skills: [
          { id: 'ice', name: 'Hielo (Ice)', radiusMeters: 15, effect: 'aturde a los enemigos dentro del radio alrededor del lanzador' },
          { id: 'curse', name: 'Maldición (Curse)', radiusMeters: 12, effect: 'ralentiza 30% a los enemigos del radio y reduce 50% su daño físico, mágico, efecto de curación y curación recibida' },
        ],
      },
      pendingRules: [
        '¿Las kills dan moral?',
        '¿Usa las mismas ubicaciones de pilares que el Principal? (por ahora se usan las mismas)',
        'Valores del Buff de Moral en cada umbral (reducción de daño y velocidad de movimiento).',
        'Habilidad de Comandante: ¿se entrega una o ambas? ¿Quién la lanza? Duración y enfriamiento.',
        '¿Los pilares se refrescan? ¿Cada cuánto?',
      ],
    },
    fiestaTempo: {
      triggerSecondsLeft: 300,
      captureMultiplier: 2,
      sealMultiplier: 1,
      appliesTo: ['sub'],
      pendingRules: ['¿Aplica también en el Campo Principal?', '¿Duplica también el sello?', '¿Qué buff da a los jugadores?'],
    },
  },
};
