import { create } from 'zustand';
import { modeById } from '../config/modes/index.ts';
import type { TierId } from '../types/index.ts';

/** Borrador de puntos por tier escrito por el superadministrador. Manda sobre lo publicado hasta que se publique. */
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

/** Puntos por tier ya resueltos: lo publicado, o el borrador del superadministrador si lo hay. */
export function tierPoints(modeId: string, overrides: Overrides): { tiers: TierPoints[]; tickSeconds: number | null } {
  const scoring = modeById(modeId)?.scoring;
  return {
    tiers: (scoring?.tiers ?? []).map((t) => ({
      id: t.id,
      destroy: overrides.destroy[t.id] ?? t.destroyPoints,
      capturePerTick: overrides.capture[t.id] ?? t.capturePointsPerTick,
      provisional: (overrides.destroy[t.id] != null && overrides.destroy[t.id] !== t.destroyPoints) || (overrides.capture[t.id] != null && overrides.capture[t.id] !== t.capturePointsPerTick),
    })),
    tickSeconds: overrides.tickSeconds ?? scoring?.captureTickSeconds ?? null,
  };
}
