import { describe, expect, it } from 'vitest';
import { objectiveRules } from '../../config/modes/index.ts';
import type { Step } from '../../types/index.ts';
import { hornPoints, hornRate, vigridScore, vigridTimeline } from './vigridScoring.ts';

const main = objectiveRules('vigrid', 'main')!;
const none = { hornSeconds: 0, kills: {}, playerKills: 0, holdsAtEnd: false };

describe('Vigrid Field', () => {
  it('el cuerno da 4.000 cada 5 s (800 por segundo) y solo cuenta ticks completos', () => {
    expect(hornRate(main)).toBe(800);
    expect(hornPoints(main, 60)).toBe(48000);
    expect(hornPoints(main, 9)).toBe(4000);
    expect(hornPoints(main, 60, 2)).toBe(96000);
  });

  it('suma jefes, kills y bono final', () => {
    const r = vigridScore(main, { hornSeconds: 300, kills: { horn: 1, fenrir: 1, 'element-lord': 2, dracula: 3 }, playerKills: 10, holdsAtEnd: true });
    // 240.000 de cuerno + 30.000 + 30.000 + 50.000 + 30.000 + 8.000 + 200.000
    expect(r.horn).toBe(240000);
    expect(r.bosses).toBe(140000);
    expect(r.kills).toBe(8000);
    expect(r.endBonus).toBe(200000);
    expect(r.total).toBe(588000);
    expect(r.remaining).toBe(212000);
    // 212.000 / 4.000 = 53 ticks = 265 s
    expect(r.hornSecondsToWin).toBe(265);
  });

  it('solo con el cuerno, llegar a 800.000 toma 1.000 s; en Fiesta Tempo, la mitad', () => {
    expect(vigridScore(main, none).hornSecondsToWin).toBe(1000);
    expect(vigridScore(main, none, true).hornSecondsToWin).toBe(500);
  });

  it('Fiesta Tempo duplica cuerno y jefes, no las kills', () => {
    const r = vigridScore(main, { hornSeconds: 10, kills: { fenrir: 1 }, playerKills: 1, holdsAtEnd: false }, true);
    expect(r.horn).toBe(16000);
    expect(r.bosses).toBe(60000);
    expect(r.kills).toBe(800);
  });

  it('la línea de tiempo cuenta cada último golpe una vez y el cuerno por segundos anotados', () => {
    const step = (objectives: Step['objectives'], horn?: Step['horn'], fiestaTempo = false): Step => ({ id: 'x', name: '', note: '', tokens: [], drawings: [], objectives, horn, fiestaTempo });
    const markers = [{ id: 'horn', kind: 'horn' as const }, { id: 'dracula-1', kind: 'dracula' as const }];
    const steps = [
      step([{ markerId: 'horn', status: 'captured-green' }], { holder: 'green', seconds: 60 }),
      step([{ markerId: 'horn', status: 'captured-green' }, { markerId: 'dracula-1', status: 'captured-red' }], { holder: 'green', seconds: 30 }),
      step([{ markerId: 'dracula-1', status: 'active' }], { holder: 'red', seconds: 20 }, true),
      step([{ markerId: 'dracula-1', status: 'captured-red' }], { holder: 'red', seconds: 0 }, true),
    ];
    const t = vigridTimeline(steps, 3, markers, main);
    expect(t.green).toEqual({ horn: 72000, bosses: 30000, count: { horn: 1 } });
    expect(t.red).toEqual({ horn: 32000, bosses: 30000, count: { dracula: 2 } });
  });
});
