import { describe, expect, it } from 'vitest';
import { guildLeague } from '../../config/modes/guild-league.ts';
import type { Step } from '../../types/index.ts';
import { guildScore, onePassMax, pillarsNeeded, tierStats, tierValues, timelineScore } from './scoring.ts';

const scoring = guildLeague.scoring!;
const stats = tierValues(scoring).map((t) => tierStats(t, scoring.captureTickSeconds ?? 0));
const by = (id: string) => stats.find((s) => s.id === id)!;

describe('tabla de puntos del Main Field', () => {
  it('totales por pilar', () => {
    expect([by('B').captureTotal, by('B').pillarTotal]).toEqual([80, 100]);
    expect([by('A').captureTotal, by('A').pillarTotal]).toEqual([120, 150]);
    expect([by('S').captureTotal, by('S').pillarTotal]).toEqual([180, 230]);
  });

  it('ritmo y duración de captura', () => {
    expect(by('B').pointsPerSecond).toBeCloseTo(4 / 3);
    expect(by('A').pointsPerSecond).toBe(2);
    expect(by('S').pointsPerSecond).toBe(2);
    expect([by('B').captureSeconds, by('A').captureSeconds, by('S').captureSeconds]).toEqual([60, 60, 90]);
  });

  it('máximo de una pasada con 1 S, 6 A y 9 B', () => {
    const tiers = ['S', ...Array(6).fill('A'), ...Array(9).fill('B')];
    expect(onePassMax(stats, tiers)).toBe(2030);
  });

  it('solo con pilares S completos y 0 kills se necesitan 14', () => {
    expect(pillarsNeeded(by('S'), 3000, 0)).toBe(14);
    expect(13 * by('S').pillarTotal).toBe(2990);
  });
});

describe('simulador', () => {
  it('la captura no supera el máximo de ticks', () => {
    const r = guildScore(stats, { S: { seals: 1, captured: 1, ticks: 99, holding: 0 } }, 10, scoring);
    expect(r.total).toBe(50 + 180 + 10);
  });

  it('estima el tiempo para ganar con las capturas activas', () => {
    const r = guildScore(stats, { A: { seals: 0, captured: 0, ticks: 0, holding: 2 } }, 0, scoring);
    expect(r.rate).toBe(4);
    expect(r.secondsToWin).toBe(750);
  });
});

describe('línea de tiempo', () => {
  const step = (objectives: Step['objectives']): Step => ({ id: '', name: '', note: '', tokens: [], drawings: [], objectives });
  it('suma sello y captura al pasar a "en captura", una sola vez por episodio', () => {
    const steps = [
      step([{ markerId: 'c', status: 'active' }]),
      step([{ markerId: 'c', status: 'captured-green' }]),
      step([{ markerId: 'c', status: 'captured-green' }]),
      step([{ markerId: 'p', status: 'captured-red', ticks: 10 }]),
    ];
    const tierOf = (id: string) => (id === 'c' ? 'S' : 'A');
    expect(timelineScore(steps, 3, tierOf, stats)).toEqual({ green: { seals: 50, capture: 180 }, red: { seals: 30, capture: 60 } });
    expect(timelineScore(steps, 1, tierOf, stats).green).toEqual({ seals: 50, capture: 180 });
  });
});
