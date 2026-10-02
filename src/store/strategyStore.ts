import { create } from 'zustand';
import { modeById } from '../config/modes/index.ts';
import { repository } from '../data/StrategyRepository.ts';
import { newId } from '../lib/id.ts';
import type { Party, Step, Strategy } from '../types/index.ts';

const MAX_HISTORY = 100;
const LAST_KEY = 'rooc-tactics:last';

export function emptyStep(name: string): Step {
  return { id: newId('step'), name, note: '', tokens: [], drawings: [], objectives: [] };
}

export function emptyParty(number: number, size: number): Party {
  return { id: newId('party'), name: `Party ${number}`, number, slots: Array<string | null>(size).fill(null) };
}

export function newStrategy(modeId: string, mapId: string): Strategy {
  const now = new Date().toISOString();
  const size = modeById(modeId)?.partySize ?? 5;
  return {
    schema: 1,
    id: newId('strategy'),
    name: 'Estrategia sin título',
    modeId,
    mapId,
    flipped: false,
    allySide: 'green',
    roster: [],
    parties: [1, 2, 3, 4].map((n) => emptyParty(n, size)),
    steps: [emptyStep('Inicio')],
    createdAt: now,
    updatedAt: now,
  };
}

interface StrategyState {
  strategy: Strategy;
  stepIndex: number;
  past: Strategy[];
  future: Strategy[];
  /** Reemplaza la estrategia completa (abrir, importar, enlace compartido). */
  open(strategy: Strategy): void;
  setStepIndex(index: number): void;
  /** Guarda un punto de deshacer; llamar antes de un cambio o al empezar un arrastre. */
  checkpoint(): void;
  /** Cambio inmutable de la estrategia. No toca el historial. */
  set(fn: (s: Strategy) => Strategy): void;
  /** Cambio inmutable del paso actual. */
  setStep(fn: (step: Step) => Step): void;
  undo(): void;
  redo(): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(get: () => StrategyState) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = get().strategy;
    void repository.save(s);
    localStorage.setItem(LAST_KEY, s.id);
  }, 500);
}

export const lastStrategyId = () => localStorage.getItem(LAST_KEY);

export const useStrategyStore = create<StrategyState>((set, get) => ({
  strategy: newStrategy('guild-league', 'vale-of-clash'),
  stepIndex: 0,
  past: [],
  future: [],
  open: (strategy) => set({ strategy, stepIndex: 0, past: [], future: [] }),
  setStepIndex: (index) => set((s) => ({ stepIndex: Math.max(0, Math.min(s.strategy.steps.length - 1, index)) })),
  checkpoint: () => set((s) => ({ past: [...s.past.slice(-MAX_HISTORY + 1), s.strategy], future: [] })),
  set: (fn) => {
    set((s) => {
      const strategy = { ...fn(s.strategy), updatedAt: new Date().toISOString() };
      return { strategy, stepIndex: Math.min(s.stepIndex, strategy.steps.length - 1) };
    });
    scheduleSave(get);
  },
  setStep: (fn) => {
    const i = get().stepIndex;
    get().set((s) => ({ ...s, steps: s.steps.map((step, k) => (k === i ? fn(step) : step)) }));
  },
  undo: () => {
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { strategy: prev, past: s.past.slice(0, -1), future: [s.strategy, ...s.future], stepIndex: Math.min(s.stepIndex, prev.steps.length - 1) };
    });
    scheduleSave(get);
  },
  redo: () => {
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return { strategy: next, past: [...s.past, s.strategy], future: s.future.slice(1), stepIndex: Math.min(s.stepIndex, next.steps.length - 1) };
    });
    scheduleSave(get);
  },
}));

export const useCurrentStep = () => useStrategyStore((s) => s.strategy.steps[s.stepIndex]);
