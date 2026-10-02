import { create } from 'zustand';
import { modeById } from '../config/modes/index.ts';
import { tierStats, tierValues, type TierStats } from '../features/score/scoring.ts';
import type { TierId } from '../types/index.ts';

/** Borrador de puntos por tier escrito por el superadministrador. Manda sobre lo publicado hasta que se publique. */
export interface Overrides {
  destroy: Record<TierId, number | null>;
  capture: Record<TierId, number | null>;
  maxTicks: Record<TierId, number | null>;
  tickSeconds: number | null;
}

interface ScoringState {
  overrides: Overrides;
  setOverrides(overrides: Overrides): void;
}

const KEY = 'rooc-tactics:scoring-overrides';
const empty: Overrides = { destroy: {}, capture: {}, maxTicks: {}, tickSeconds: null };

function load(): Overrides {
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Overrides> | null) };
  } catch {
    return empty;
  }
}

export const useScoringStore = create<ScoringState>((set) => ({
  overrides: load(),
  setOverrides: (overrides) => {
    localStorage.setItem(KEY, JSON.stringify(overrides));
    set({ overrides });
  },
}));

export interface TierPoints {
  id: TierId;
  destroy: number | null;
  capturePerTick: number | null;
  maxTicks: number | null;
  /** true si algún valor viene del borrador y difiere de lo publicado. */
  provisional: boolean;
}

/** Puntos por tier ya resueltos: lo publicado, o el borrador del superadministrador si lo hay. */
export function tierPoints(modeId: string, overrides: Overrides): { tiers: TierPoints[]; tickSeconds: number | null } {
  const scoring = modeById(modeId)?.scoring;
  const pick = (o: number | null | undefined, c: number | null) => o ?? c;
  return {
    tiers: (scoring?.tiers ?? []).map((t) => {
      const destroy = pick(overrides.destroy[t.id], t.destroyPoints);
      const capturePerTick = pick(overrides.capture[t.id], t.capturePointsPerTick);
      const maxTicks = pick(overrides.maxTicks?.[t.id], t.maxTicks);
      return { id: t.id, destroy, capturePerTick, maxTicks, provisional: destroy !== t.destroyPoints || capturePerTick !== t.capturePointsPerTick || maxTicks !== t.maxTicks };
    }),
    tickSeconds: overrides.tickSeconds ?? scoring?.captureTickSeconds ?? null,
  };
}

/** Estadísticas por tier (totales, puntos por segundo, duración) con los valores en uso. */
export function resolvedStats(modeId: string, overrides: Overrides): { stats: TierStats[]; tickSeconds: number; missing: string[] } {
  const scoring = modeById(modeId)?.scoring;
  if (!scoring) return { stats: [], tickSeconds: 0, missing: [] };
  const points = tierPoints(modeId, overrides);
  const missing = points.tiers.flatMap((t) => [t.destroy == null && `sello ${t.id}`, t.capturePerTick == null && `captura ${t.id}`, t.maxTicks == null && `ticks máximos ${t.id}`].filter((x): x is string => !!x));
  if (points.tickSeconds == null) missing.push('segundos por tick');
  const tickSeconds = points.tickSeconds ?? 0;
  const values = tierValues(scoring, (id) => {
    const t = points.tiers.find((x) => x.id === id)!;
    return { seal: t.destroy ?? 0, perTick: t.capturePerTick ?? 0, maxTicks: t.maxTicks ?? 0 };
  });
  return { stats: values.map((v) => tierStats(v, tickSeconds)), tickSeconds, missing };
}
