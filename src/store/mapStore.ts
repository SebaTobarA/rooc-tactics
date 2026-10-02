import { create } from 'zustand';
import { maps } from '../config/maps/index.ts';
import type { MapConfig } from '../types/index.ts';

/**
 * Copia de trabajo de la config del mapa. La app siempre lee el mapa desde aquí;
 * el editor de mapa la modifica y la exporta como JSON/TS para reemplazar en el proyecto.
 */
interface MapState {
  map: MapConfig;
  /** true si la copia local difiere de la config del proyecto. */
  dirty: boolean;
  past: MapConfig[];
  load(id: string): void;
  /** Guarda un punto de deshacer (llamar antes de un cambio o al empezar un arrastre). */
  checkpoint(): void;
  /** Aplica un cambio mutando un clon de la config. */
  update(fn: (map: MapConfig) => void): void;
  undo(): void;
  reset(): void;
}

const storageKey = (id: string) => `rooc-tactics:map:${id}`;
const MAX_UNDO = 50;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function readLocal(id: string): MapConfig | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as MapConfig) : null;
  } catch {
    return null;
  }
}

const first = Object.values(maps)[0];

export const useMapStore = create<MapState>((set, get) => ({
  map: first,
  dirty: false,
  past: [],
  load: (id) => {
    const base = maps[id];
    if (!base) return;
    const local = readLocal(id);
    set({ map: local ?? base, dirty: local !== null, past: [] });
  },
  checkpoint: () => set((s) => ({ past: [...s.past.slice(-MAX_UNDO + 1), s.map] })),
  update: (fn) => {
    const next = structuredClone(get().map);
    fn(next);
    set({ map: next, dirty: true });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => localStorage.setItem(storageKey(next.id), JSON.stringify(get().map)), 400);
  },
  undo: () => {
    const { past } = get();
    if (!past.length) return;
    set({ map: past[past.length - 1], past: past.slice(0, -1), dirty: true });
    localStorage.setItem(storageKey(get().map.id), JSON.stringify(get().map));
  },
  reset: () => {
    const id = get().map.id;
    clearTimeout(saveTimer);
    localStorage.removeItem(storageKey(id));
    set({ map: maps[id], dirty: false, past: [] });
  },
}));
