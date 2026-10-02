import type { Overrides } from '../../store/scoringStore.ts';
import type { ModeScoring, Side, TierId } from '../../types/index.ts';

export interface GuildInput {
  /** Pilares destruidos por tier. */
  destroyed: Record<TierId, number>;
  /** Segundos acumulados de captura por tier. */
  captureSeconds: Record<TierId, number>;
  /** Zonas controladas ahora por tier (para estimar el tiempo hasta ganar). */
  zonesHeld: Record<TierId, number>;
  kills: number;
}

export type ScoreInput = Record<Side, GuildInput>;

export interface GuildScore {
  destroy: number;
  capture: number;
  kills: number;
  total: number;
  remaining: number;
  /** Puntos por segundo con las zonas controladas ahora. */
  rate: number;
  /** Segundos estimados para ganar; null si no suma puntos por captura. */
  secondsToWin: number | null;
}

export interface Resolved {
  destroy: Record<TierId, number | null>;
  capture: Record<TierId, number | null>;
  tickSeconds: number | null;
  /** Valores que todavía nadie ha cargado. */
  todo: string[];
  /** true si algún valor usado es un borrador sin publicar. */
  provisional: boolean;
}

export const emptyGuild = (scoring: ModeScoring): GuildInput => {
  const zero = () => Object.fromEntries(scoring.tiers.map((t) => [t.id, 0]));
  return { destroyed: zero(), captureSeconds: zero(), zonesHeld: zero(), kills: 0 };
};

/** Valores de puntuación en uso: lo publicado, o el borrador del superadministrador si lo hay. */
export function resolve(scoring: ModeScoring, overrides: Overrides): Resolved {
  const todo: string[] = [];
  let provisional = false;
  const pick = (configured: number | null, override: number | null | undefined, label: string) => {
    const value = override ?? configured;
    if (value == null) todo.push(label);
    if (override != null && override !== configured) provisional = true;
    return value;
  };
  const destroy: Resolved['destroy'] = {};
  const capture: Resolved['capture'] = {};
  for (const t of scoring.tiers) {
    destroy[t.id] = pick(t.destroyPoints, overrides.destroy[t.id], `destrucción tier ${t.id}`);
    capture[t.id] = pick(t.capturePointsPerTick, overrides.capture[t.id], `captura por tick tier ${t.id}`);
  }
  const tickSeconds = pick(scoring.captureTickSeconds, overrides.tickSeconds, 'segundos por tick de captura');
  return { destroy, capture, tickSeconds, todo, provisional };
}

export function scoreGuild(scoring: ModeScoring, r: Resolved, g: GuildInput): GuildScore {
  let destroy = 0;
  let capture = 0;
  let rate = 0;
  for (const t of scoring.tiers) {
    destroy += (g.destroyed[t.id] ?? 0) * (r.destroy[t.id] ?? 0);
    const perSecond = r.capture[t.id] != null && r.tickSeconds ? r.capture[t.id]! / r.tickSeconds : 0;
    capture += (g.captureSeconds[t.id] ?? 0) * perSecond;
    rate += (g.zonesHeld[t.id] ?? 0) * perSecond;
  }
  const kills = g.kills * scoring.killPoints;
  const total = Math.floor(destroy + capture + kills);
  const remaining = Math.max(0, scoring.winScore - total);
  return { destroy, capture: Math.floor(capture), kills, total, remaining, rate, secondsToWin: remaining === 0 ? 0 : rate > 0 ? remaining / rate : null };
}
