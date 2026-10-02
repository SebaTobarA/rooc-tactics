import type { ModeScoring, ObjectiveState, Step, TierId } from '../../types/index.ts';

/**
 * Cálculos del sistema de puntos. Todo se deriva de la config del modo (sello, puntos por tick,
 * segundos por tick y ticks máximos): si cambia un número, cambian todos los totales.
 */

export interface TierValues {
  id: TierId;
  seal: number;
  perTick: number;
  maxTicks: number;
}

export interface TierStats extends TierValues {
  /** Puntos de una captura completa (perTick × maxTicks). */
  captureTotal: number;
  /** Sello + captura completa. */
  pillarTotal: number;
  /** Puntos por segundo mientras se captura. */
  pointsPerSecond: number;
  /** Segundos que dura una captura completa. */
  captureSeconds: number;
}

/** Valores en uso por tier; un dato faltante cuenta como 0. */
export function tierValues(scoring: ModeScoring, override?: (id: TierId) => Partial<Omit<TierValues, 'id'>>): TierValues[] {
  return scoring.tiers.map((t) => {
    const o = override?.(t.id) ?? {};
    return { id: t.id, seal: o.seal ?? t.destroyPoints ?? 0, perTick: o.perTick ?? t.capturePointsPerTick ?? 0, maxTicks: o.maxTicks ?? t.maxTicks ?? 0 };
  });
}

export function tierStats(t: TierValues, tickSeconds: number): TierStats {
  const captureTotal = t.perTick * t.maxTicks;
  return {
    ...t,
    captureTotal,
    pillarTotal: t.seal + captureTotal,
    pointsPerSecond: tickSeconds > 0 ? t.perTick / tickSeconds : 0,
    captureSeconds: t.maxTicks * tickSeconds,
  };
}

/** Máximo de una sola pasada: cada pilar del mapa roto y capturado completo una vez. */
export function onePassMax(stats: TierStats[], pillarTiers: (TierId | undefined)[]): number {
  return pillarTiers.reduce((sum, tier) => sum + (stats.find((s) => s.id === tier)?.pillarTotal ?? 0), 0);
}

/** Pilares completos (sello + captura máxima) de un tier que faltan para ganar, dados unos puntos ya logrados. */
export function pillarsNeeded(stat: TierStats, winScore: number, alreadyHave: number): number | null {
  const remaining = winScore - alreadyHave;
  if (remaining <= 0) return 0;
  return stat.pillarTotal > 0 ? Math.ceil(remaining / stat.pillarTotal) : null;
}

export interface GuildRow {
  /** Sellos rotos. */
  seals: number;
  /** Pilares capturados. */
  captured: number;
  /** Ticks logrados en cada captura (se acota a maxTicks). */
  ticks: number;
  /** Pilares en captura ahora mismo (para estimar el tiempo hasta ganar). */
  holding: number;
}

export interface GuildResult {
  seals: number;
  capture: number;
  kills: number;
  total: number;
  remaining: number;
  rate: number;
  secondsToWin: number | null;
}

/** Puntos de una guild a partir de lo ingresado por tier. La captura de cada pilar nunca supera su máximo de ticks. */
export function guildScore(stats: TierStats[], rows: Record<TierId, GuildRow>, kills: number, scoring: ModeScoring): GuildResult {
  let seals = 0;
  let capture = 0;
  let rate = 0;
  for (const s of stats) {
    const r = rows[s.id];
    if (!r) continue;
    seals += r.seals * s.seal;
    capture += r.captured * Math.min(Math.max(0, r.ticks), s.maxTicks) * s.perTick;
    rate += r.holding * s.pointsPerSecond;
  }
  const killPts = kills * scoring.killPoints;
  const total = seals + capture + killPts;
  const remaining = Math.max(0, scoring.winScore - total);
  return { seals, capture, kills: killPts, total, remaining, rate, secondsToWin: remaining === 0 ? 0 : rate > 0 ? remaining / rate : null };
}

export type SideId = 'green' | 'red';
const captor = (o: ObjectiveState | undefined): SideId | null => (o?.status === 'captured-green' ? 'green' : o?.status === 'captured-red' ? 'red' : null);

/**
 * Puntos acumulados según la línea de tiempo, hasta el paso indicado (incluido).
 * Regla: cuando un pilar pasa a "en captura" por una guild, esa guild suma el sello y la captura
 * (los ticks anotados en el paso, o la captura completa si no se anotaron). Mientras siga en captura
 * por la misma guild en los pasos siguientes no vuelve a sumar.
 */
export function timelineScore(steps: Step[], upTo: number, tierOf: (markerId: string, o: ObjectiveState) => TierId | undefined, stats: TierStats[]): Record<SideId, { seals: number; capture: number }> {
  const out = { green: { seals: 0, capture: 0 }, red: { seals: 0, capture: 0 } };
  for (let i = 0; i <= upTo && i < steps.length; i++) {
    for (const o of steps[i].objectives) {
      const side = captor(o);
      if (!side) continue;
      const before = i > 0 ? captor(steps[i - 1].objectives.find((x) => x.markerId === o.markerId)) : null;
      if (before === side) continue;
      const s = stats.find((x) => x.id === tierOf(o.markerId, o));
      if (!s) continue;
      out[side].seals += s.seal;
      out[side].capture += Math.min(o.ticks ?? s.maxTicks, s.maxTicks) * s.perTick;
    }
  }
  return out;
}
