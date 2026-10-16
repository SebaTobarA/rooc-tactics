import type { Marker, MarkerKind, ObjectiveRules, ObjectiveState, Side, Step } from '../../types/index.ts';

/**
 * Puntos de Vigrid: cuerno por tiempo, jefes al último golpe, kills, bono final y Fiesta Tempo.
 * Todo sale de las reglas del campo; si cambia un número de la config, cambian los totales.
 */

/** Multiplicador de Fiesta Tempo (1 si no está activa o el campo no la tiene). */
export const fiestaMultiplier = (rules: Pick<ObjectiveRules, 'fiesta'>, active: boolean) => (active && rules.fiesta ? rules.fiesta.multiplier : 1);

/** Puntos por sostener el cuerno: solo cuentan los ticks completos. */
export function hornPoints(rules: Pick<ObjectiveRules, 'horn'>, seconds: number, multiplier = 1): number {
  if (!rules.horn || seconds <= 0) return 0;
  return Math.floor(seconds / rules.horn.tickSeconds) * rules.horn.pointsPerTick * multiplier;
}

/** Puntos por segundo mientras se tiene el cuerno. */
export const hornRate = (rules: Pick<ObjectiveRules, 'horn'>, multiplier = 1) => (rules.horn ? (rules.horn.pointsPerTick / rules.horn.tickSeconds) * multiplier : 0);

export const sourcePoints = (rules: Pick<ObjectiveRules, 'sources'>, kind: MarkerKind) => rules.sources.find((s) => s.kind === kind)?.points ?? 0;

export interface VigridInput {
  /** Segundos con el cuerno. */
  hornSeconds: number;
  /** Último golpe por tipo de jefe. */
  kills: Partial<Record<MarkerKind, number>>;
  playerKills: number;
  /** ¿Termina la partida con el cuerno? */
  holdsAtEnd: boolean;
}

export interface VigridResult {
  horn: number;
  bosses: number;
  kills: number;
  endBonus: number;
  total: number;
  remaining: number;
  /** Segundos de cuerno que faltan para la meta con lo demás fijo; null si el campo no tiene meta o cuerno. */
  hornSecondsToWin: number | null;
}

/** Total de una guild. Fiesta Tempo multiplica el cuerno y los jefes (lo confirmado); las kills y el bono no. */
export function vigridScore(rules: ObjectiveRules, input: VigridInput, fiesta = false): VigridResult {
  const m = fiestaMultiplier(rules, fiesta);
  const horn = hornPoints(rules, input.hornSeconds, m);
  const bosses = rules.sources.reduce((a, s) => a + (input.kills[s.kind] ?? 0) * (s.points ?? 0) * m, 0);
  const kills = input.playerKills * (rules.killPoints ?? 0);
  const endBonus = input.holdsAtEnd && rules.horn ? rules.horn.endBonus : 0;
  const total = horn + bosses + kills + endBonus;
  const remaining = rules.goal != null ? Math.max(0, rules.goal - total) : 0;
  const rate = hornRate(rules, m);
  return { horn, bosses, kills, endBonus, total, remaining, hornSecondsToWin: rules.goal == null || rate <= 0 ? null : remaining === 0 ? 0 : Math.ceil(remaining / rules.horn!.pointsPerTick / m) * rules.horn!.tickSeconds };
}

const lastHit = (o: ObjectiveState | undefined): Side | null => (o?.status === 'captured-green' ? 'green' : o?.status === 'captured-red' ? 'red' : null);

export interface TimelineTally {
  horn: number;
  bosses: number;
  /** Último golpe por tipo de marcador. */
  count: Partial<Record<MarkerKind, number>>;
}

/**
 * Puntos según la línea de tiempo hasta el paso indicado (incluido).
 * Cuerno: los segundos anotados en cada paso, para quien lo tiene. Jefes: cuando un marcador pasa a
 * "último golpe" de una guild suma una vez; si sigue igual en el paso siguiente no vuelve a sumar
 * (un Dracula que reaparece se marca vivo entre medio). Fiesta Tempo del paso multiplica ambos.
 */
export function vigridTimeline(steps: Step[], upTo: number, markers: Pick<Marker, 'id' | 'kind'>[], rules: ObjectiveRules): Record<Side, TimelineTally> {
  const out: Record<Side, TimelineTally> = { green: { horn: 0, bosses: 0, count: {} }, red: { horn: 0, bosses: 0, count: {} } };
  for (let i = 0; i <= upTo && i < steps.length; i++) {
    const step = steps[i];
    const m = fiestaMultiplier(rules, !!step.fiestaTempo);
    if (step.horn?.holder) out[step.horn.holder].horn += hornPoints(rules, step.horn.seconds ?? 0, m);
    for (const o of step.objectives) {
      const side = lastHit(o);
      if (!side) continue;
      const before = i > 0 ? lastHit(steps[i - 1].objectives.find((x) => x.markerId === o.markerId)) : null;
      if (before === side) continue;
      const kind = markers.find((k) => k.id === o.markerId)?.kind;
      if (!kind || !rules.sources.some((s) => s.kind === kind)) continue;
      out[side].bosses += sourcePoints(rules, kind) * m;
      out[side].count[kind] = (out[side].count[kind] ?? 0) + 1;
    }
  }
  return out;
}
