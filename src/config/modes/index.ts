import type { FieldId, FieldScoring, ModeConfig, ObjectiveRules } from '../../types/index.ts';
import { dimensionDrill } from './dimension-drill.ts';
import { emperiumOverrun } from './emperium-overrun.ts';
import { guildLeague } from './guild-league.ts';
import { vigrid } from './vigrid.ts';

export const modes: ModeConfig[] = [guildLeague, emperiumOverrun, dimensionDrill, vigrid];
export const modeById = (id: string) => modes.find((m) => m.id === id);

export const FIELD_LABELS: Record<FieldId, string> = { main: 'Campo Principal', sub: 'Campo Secundario' };

/** Reglas del campo pedido en forma común. Sin campo, o en un modo sin Secundario, se usa el Principal. */
export function fieldScoring(modeId: string, field: FieldId | undefined): FieldScoring | undefined {
  const s = modeById(modeId)?.scoring;
  if (!s) return undefined;
  if (field === 'sub' && s.sub) return { field: 'sub', ...s.sub };
  return { field: 'main', label: FIELD_LABELS.main, unit: 'puntos', goal: s.winScore, killPoints: s.killPoints, tiers: s.tiers, captureTickSeconds: s.captureTickSeconds, pendingRules: s.pendingRules };
}

/** ¿El modo distingue Campo Principal y Secundario? */
export const hasFields = (modeId: string) => !!modeById(modeId)?.scoring?.sub;

/** Reglas por objetivos (Vigrid) del campo pedido; undefined en los modos por pilares. */
export const objectiveRules = (modeId: string, field: FieldId | undefined): ObjectiveRules | undefined => modeById(modeId)?.objectives?.[field ?? 'main'];

/** Texto corto del objetivo del campo, para la cabecera. */
export function fieldGoalText(modeId: string, field: FieldId): string {
  const rules = objectiveRules(modeId, field);
  const goal = rules ? rules.goal : fieldScoring(modeId, field)?.goal;
  const unit = rules?.unit ?? fieldScoring(modeId, field)?.unit ?? 'puntos';
  return goal != null ? `meta ${goal.toLocaleString('es')} ${unit}` : unit;
}

/**
 * Tamaño relativo de un pilar según su tier: 0 para el tier más bajo de la lista del modo, 1 para el más alto.
 * Un pilar sin tier se dibuja como el más bajo.
 */
export function tierRank(modeId: string, tier: string | undefined): number {
  const tiers = modeById(modeId)?.scoring?.tiers ?? [];
  const index = tiers.findIndex((t) => t.id === tier);
  return index < 0 || tiers.length < 2 ? 0 : index / (tiers.length - 1);
}
