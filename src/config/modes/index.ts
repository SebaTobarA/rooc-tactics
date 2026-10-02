import type { ModeConfig } from '../../types/index.ts';
import { dimensionDrill } from './dimension-drill.ts';
import { emperiumOverrun } from './emperium-overrun.ts';
import { guildLeague } from './guild-league.ts';

export const modes: ModeConfig[] = [guildLeague, emperiumOverrun, dimensionDrill];
export const modeById = (id: string) => modes.find((m) => m.id === id);

/**
 * Tamaño relativo de un pilar según su tier: 0 para el tier más bajo de la lista del modo, 1 para el más alto.
 * Un pilar sin tier se dibuja como el más bajo.
 */
export function tierRank(modeId: string, tier: string | undefined): number {
  const tiers = modeById(modeId)?.scoring?.tiers ?? [];
  const index = tiers.findIndex((t) => t.id === tier);
  return index < 0 || tiers.length < 2 ? 0 : index / (tiers.length - 1);
}
