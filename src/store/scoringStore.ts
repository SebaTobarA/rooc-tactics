import { create } from 'zustand';
import { modeById } from '../config/modes/index.ts';
import type { TierId } from '../types/index.ts';

/** Valores de puntuación escritos en la web. Solo se usan donde la config del modo todavía dice TODO (null). */
export interface Overrides {
  destroy: Record<TierId, number | null>;
  capture: Record<TierId, number | null>;
  tickSeconds: number | null;
}

interface ScoringState {
  overrides: Overrides;
  setOverrides(overrides: Overrides): void;
}

const KEY = 'rooc-tactics:scoring-overrides';
const empty: Overrides = { destroy: {}, capture: {}, tickSeconds: null };

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
  /** true si el valor viene de lo escrito en la web y no de la config. */
  provisional: boolean;
}

/** Puntos por tier ya resueltos: la config manda; lo escrito en la web rellena los TODO. */
export function tierPoints(modeId: string, overrides: Overrides): { tiers: TierPoints[]; tickSeconds: number | null } {
  const scoring = modeById(modeId)?.scoring;
  return {
    tiers: (scoring?.tiers ?? []).map((t) => ({
      id: t.id,
      destroy: t.destroyPoints ?? overrides.destroy[t.id] ?? null,
      capturePerTick: t.capturePointsPerTick ?? overrides.capture[t.id] ?? null,
      provisional: (t.destroyPoints == null && overrides.destroy[t.id] != null) || (t.capturePointsPerTick == null && overrides.capture[t.id] != null),
    })),
    tickSeconds: scoring?.captureTickSeconds ?? overrides.tickSeconds,
  };
}
