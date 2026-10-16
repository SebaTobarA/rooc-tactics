import type { MapConfig } from '../../types/index.ts';
import { valeOfClash } from './vale-of-clash.ts';
import { vigridField } from './vigrid.ts';

export interface MapSummary {
  id: string;
  name: string;
  enabled: boolean;
}

/** Mapas con config completa. */
export const maps: Record<string, MapConfig> = {
  [valeOfClash.id]: valeOfClash,
  [vigridField.id]: vigridField,
};

/** Catálogo para el selector, incluidos los mapas "Próximamente". */
const upcoming: MapSummary[] = [
  { id: 'stellar-clash', name: 'Stellar Clash', enabled: false },
];

export const mapSummary = (id: string): MapSummary =>
  maps[id] ? { id, name: maps[id].name, enabled: maps[id].enabled } : (upcoming.find((m) => m.id === id) ?? { id, name: id, enabled: false });
