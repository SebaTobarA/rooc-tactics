import type { Strategy } from '../types/index.ts';

export interface StrategySummary {
  id: string;
  name: string;
  modeId: string;
  mapId: string;
  updatedAt: string;
}

/**
 * Capa de datos de las estrategias. La interfaz es asíncrona a propósito: así se puede
 * cambiar localStorage por Supabase o Firebase (con colaboración en tiempo real) sin tocar la UI.
 */
export interface StrategyRepository {
  list(): Promise<StrategySummary[]>;
  get(id: string): Promise<Strategy | null>;
  save(strategy: Strategy): Promise<void>;
  remove(id: string): Promise<void>;
}

const INDEX_KEY = 'rooc-tactics:strategies';
const itemKey = (id: string) => `rooc-tactics:strategy:${id}`;

export class LocalStorageRepository implements StrategyRepository {
  async list(): Promise<StrategySummary[]> {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as StrategySummary[];
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<Strategy | null> {
    try {
      const raw = localStorage.getItem(itemKey(id));
      return raw ? (JSON.parse(raw) as Strategy) : null;
    } catch {
      return null;
    }
  }

  async save(s: Strategy): Promise<void> {
    localStorage.setItem(itemKey(s.id), JSON.stringify(s));
    const rest = (await this.list()).filter((x) => x.id !== s.id);
    const summary: StrategySummary = { id: s.id, name: s.name, modeId: s.modeId, mapId: s.mapId, updatedAt: s.updatedAt };
    localStorage.setItem(INDEX_KEY, JSON.stringify([summary, ...rest]));
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(itemKey(id));
    localStorage.setItem(INDEX_KEY, JSON.stringify((await this.list()).filter((x) => x.id !== id)));
  }
}

export const repository: StrategyRepository = new LocalStorageRepository();
