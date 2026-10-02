import { useEffect, useMemo, useState } from 'react';
import { modeById } from '../../config/modes/index.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { resolvedStats, useScoringStore } from '../../store/scoringStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import type { Side, TierId } from '../../types/index.ts';
import { button, heading, input } from '../board/ui.ts';
import { SIDE_COLORS } from '../map-render/konva/Markers.tsx';
import { guildScore, onePassMax, pillarsNeeded, timelineScore, type GuildRow } from './scoring.ts';

const SIDES: { id: Side; name: string }[] = [{ id: 'green', name: 'Guild Verde' }, { id: 'red', name: 'Guild Roja' }];
const KEY = 'rooc-tactics:score-v2';
const fmt = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 2 });
const fmtTime = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

interface SimState {
  rows: Record<Side, Record<TierId, GuildRow>>;
  kills: Record<Side, number>;
  /** Calculadora de escenarios. */
  scenario: { kills: number; mix: Record<TierId, number> };
}

function Num({ value, onChange, label, max }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  return (
    <input type="number" min={0} max={max} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label={label} value={value}
      onChange={(e) => onChange(Math.min(max ?? Infinity, Math.max(0, Math.floor(e.target.valueAsNumber) || 0)))} />
  );
}

/** Puntos de Guild League: valor por pilar, simulador, escenarios y lo acumulado en la línea de tiempo. */
export function ScorePanel() {
  const { modeId, steps } = useStrategyStore((s) => s.strategy);
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const markers = useMapStore((s) => s.map.markers);
  const overrides = useScoringStore((s) => s.overrides);
  const scoring = modeById(modeId)?.scoring;
  const { stats, tickSeconds, missing } = useMemo(() => resolvedStats(modeId, overrides), [modeId, overrides]);
  const blankRows = () => Object.fromEntries(stats.map((s) => [s.id, { seals: 0, captured: 0, ticks: s.maxTicks, holding: 0 }])) as Record<TierId, GuildRow>;
  const [sim, setSim] = useState<SimState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SimState | null;
      if (saved?.rows && saved.scenario) return saved;
    } catch {
      // se empieza de cero
    }
    return { rows: { green: blankRows(), red: blankRows() }, kills: { green: 0, red: 0 }, scenario: { kills: 0, mix: {} } };
  });
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(sim)), [sim]);

  if (!scoring) return <p className="p-3 text-sm text-slate-500">Este modo no tiene puntuación configurada.</p>;

  const pillarTiers = markers.filter((m) => m.kind === 'central-pillar' || m.kind === 'pillar-slot').map((m) => m.tier);
  const countByTier = (id: TierId) => pillarTiers.filter((t) => t === id).length;
  const untiered = pillarTiers.filter((t) => !t).length;
  const onePass = onePassMax(stats, pillarTiers);
  const results = Object.fromEntries(SIDES.map(({ id }) => [id, guildScore(stats, sim.rows[id], sim.kills[id], scoring)])) as Record<Side, ReturnType<typeof guildScore>>;
  const diff = results.green.total - results.red.total;
  const row = (side: Side, tier: TierId): GuildRow => sim.rows[side][tier] ?? { seals: 0, captured: 0, ticks: stats.find((s) => s.id === tier)?.maxTicks ?? 0, holding: 0 };
  const setRow = (side: Side, tier: TierId, patch: Partial<GuildRow>) =>
    setSim({ ...sim, rows: { ...sim.rows, [side]: { ...sim.rows[side], [tier]: { ...row(side, tier), ...patch } } } });

  const tierOf = (markerId: string, o: { tier?: TierId }) => o.tier ?? markers.find((m) => m.id === markerId)?.tier;
  const timeline = timelineScore(steps, stepIndex, tierOf, stats);
  const mixPoints = stats.reduce((a, s) => a + (sim.scenario.mix[s.id] ?? 0) * s.pillarTotal, 0) + sim.scenario.kills * scoring.killPoints;
  const top = [...stats].sort((a, b) => b.pillarTotal - a.pillarTotal)[0];

  return (
    <div className="space-y-4 p-3 text-sm">
      {missing.length > 0 && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200" role="alert">Faltan valores: {missing.join(', ')}. Cuentan como 0.</p>
      )}

      <section>
        <h3 className={heading}>Valor por pilar</h3>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-normal">Tier</th>
              <th className="text-right font-normal">Sello</th>
              <th className="text-right font-normal">Pts/s</th>
              <th className="text-right font-normal">Dura</th>
              <th className="text-right font-normal">Captura</th>
              <th className="text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-0.5 font-semibold">{s.id} <span className="font-normal text-slate-500">×{countByTier(s.id)}</span></td>
                <td className="text-right">{s.seal}</td>
                <td className="text-right">{fmt(s.pointsPerSecond)}</td>
                <td className="text-right">{s.captureSeconds} s</td>
                <td className="text-right">{s.captureTotal}</td>
                <td className="text-right font-semibold">{s.pillarTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-slate-500">
          Un tick cada {tickSeconds} s. Kill = {scoring.killPoints} punto. A y S capturan al mismo ritmo, pero S dura más y su sello vale más.
          ×N = pilares de ese tier en el mapa{untiered ? ` (${untiered} sin tier)` : ''}.
        </p>
        <p className="mt-1 rounded bg-slate-200/70 px-2 py-1 text-xs dark:bg-slate-800/70">
          Máximo de una pasada (cada pilar del mapa roto y capturado completo una vez): <strong>{onePass}</strong> de {scoring.winScore}.
          {onePass < scoring.winScore && ' No alcanza: o los pilares reaparecen, o las kills son decisivas.'}
        </p>
        {scoring.pendingRules?.length ? (
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-700 dark:text-amber-200">
            {scoring.pendingRules.map((r) => <li key={r}>Por confirmar: {r}</li>)}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-sky-500/40 p-2">
        <h3 className={heading}>Según la línea de tiempo (hasta el paso {stepIndex + 1})</h3>
        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
          {SIDES.map(({ id, name }) => (
            <div key={id}>
              <p className="font-semibold" style={{ color: SIDE_COLORS[id] }}>{name}: {timeline[id].seals + timeline[id].capture}</p>
              <p className="text-slate-500">sellos {timeline[id].seals} · captura {timeline[id].capture}</p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Cuenta los pilares marcados «En captura» en la pestaña Objet.: la guild que lo captura suma el sello y la captura completa (o los ticks anotados). No incluye kills.</p>
      </section>

      {SIDES.map(({ id, name }) => {
        const r = results[id];
        return (
          <section key={id} className="rounded-lg border-2 p-2" style={{ borderColor: SIDE_COLORS[id] }}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{name}</h3>
              <span className="text-2xl font-bold tabular-nums">{r.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-300 dark:bg-slate-800">
              <div className="h-full" style={{ width: `${Math.min(100, (r.total / scoring.winScore) * 100)}%`, background: SIDE_COLORS[id] }} />
            </div>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-slate-500"><th className="text-left font-normal">Tier</th><th className="font-normal">Sellos</th><th className="font-normal">Capturas</th><th className="font-normal">Ticks c/u</th><th className="font-normal">En captura</th></tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.id}</td>
                    <td className="p-0.5"><Num label={`${name}: sellos ${s.id} rotos`} value={row(id, s.id).seals} onChange={(v) => setRow(id, s.id, { seals: v })} /></td>
                    <td className="p-0.5"><Num label={`${name}: pilares ${s.id} capturados`} value={row(id, s.id).captured} onChange={(v) => setRow(id, s.id, { captured: v })} /></td>
                    <td className="p-0.5"><Num label={`${name}: ticks por captura ${s.id}`} max={s.maxTicks} value={Math.min(row(id, s.id).ticks, s.maxTicks)} onChange={(v) => setRow(id, s.id, { ticks: v })} /></td>
                    <td className="p-0.5"><Num label={`${name}: pilares ${s.id} en captura ahora`} value={row(id, s.id).holding} onChange={(v) => setRow(id, s.id, { holding: v })} /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="text-slate-500">Kills</td>
                  <td className="p-0.5"><Num label={`${name}: kills`} value={sim.kills[id]} onChange={(v) => setSim({ ...sim, kills: { ...sim.kills, [id]: v } })} /></td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">Sellos {r.seals} · captura {r.capture} · kills {r.kills}. Faltan <strong>{r.remaining}</strong> para {scoring.winScore}.</p>
            <p className="text-xs">
              {r.remaining === 0 ? '¡Llegó a la meta!' : r.secondsToWin != null ? `Con las capturas activas gana en ~${fmtTime(r.secondsToWin)} (${fmt(r.rate)} pts/s), si nadie se las quita.` : 'Sin capturas activas: no se puede estimar el tiempo.'}
            </p>
          </section>
        );
      })}
      <p className="text-center font-medium">{diff === 0 ? 'Empate' : `${diff > 0 ? 'Verde' : 'Roja'} va arriba por ${Math.abs(diff)} puntos`}</p>

      <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
        <h3 className={heading}>¿Cuántos pilares necesitamos para ganar?</h3>
        <label className="mt-1 grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
          Kills esperadas
          <Num label="Kills esperadas" value={sim.scenario.kills} onChange={(v) => setSim({ ...sim, scenario: { ...sim.scenario, kills: v } })} />
        </label>
        <ul className="mt-2 space-y-0.5 text-xs">
          {stats.map((s) => {
            const n = pillarsNeeded(s, scoring.winScore, sim.scenario.kills * scoring.killPoints);
            return <li key={s.id}>Solo con pilares {s.id} completos: <strong>{n ?? '—'}</strong>{s.id === top?.id ? ' (el de más valor)' : ''}</li>;
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-500">O arma una combinación de pilares completos:</p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {stats.map((s) => (
            <label key={s.id} className="text-xs">
              {s.id}
              <Num label={`Pilares ${s.id} completos en la combinación`} value={sim.scenario.mix[s.id] ?? 0} onChange={(v) => setSim({ ...sim, scenario: { ...sim.scenario, mix: { ...sim.scenario.mix, [s.id]: v } } })} />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs">
          Total: <strong>{mixPoints}</strong> {mixPoints >= scoring.winScore ? '— alcanza para ganar.' : `— faltan ${scoring.winScore - mixPoints}.`}
        </p>
      </section>

      <button className={`${button} w-full`} onClick={() => setSim({ rows: { green: blankRows(), red: blankRows() }, kills: { green: 0, red: 0 }, scenario: { kills: 0, mix: {} } })}>Reiniciar simulación</button>
    </div>
  );
}
