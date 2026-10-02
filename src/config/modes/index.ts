import type { ModeConfig } from '../../types/index.ts';
import { dimensionDrill } from './dimension-drill.ts';
import { emperiumOverrun } from './emperium-overrun.ts';
import { guildLeague } from './guild-league.ts';

export const modes: ModeConfig[] = [guildLeague, emperiumOverrun, dimensionDrill];
export const modeById = (id: string) => modes.find((m) => m.id === id);
