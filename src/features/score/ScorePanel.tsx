import { useEffect, useMemo, useState } from 'react';
import { modeById } from '../../config/modes/index.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import type { Side } from '../../types/index.ts';
import { button, heading, input } from '../board/ui.ts';
import { SIDE_COLORS } from '../map-render/konva/Markers.tsx';
import { emptyGuild, resolve, scoreGuild, type GuildInput, type Overrides, type ScoreInput } from './scoreMath.ts';

const SIDES: { id: Side; name: string }[] = [{ id: 'green', name: 'Guild Verde' }, { id: 'red', name: 'Guild Roja' }];
const KEY = 'rooc-tactics:score';
const fmtTime = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

function Num({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <input type="number" min={0} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label={label} value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, e.target.valueAsNumber || 0))} />
  );
}

/** Simulador de puntos de Guild League. Usa los valores de la config del modo. */
export function ScorePanel() {
  const modeId = useStrategyStore((s) => s.strategy.modeId);
  const scoring = modeById(modeId)?.scoring;
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null') as { input: ScoreInput; overrides: Overrides } | null;
    } catch {
      return null;
    }
  }, []);
  const [data, setData] = useState<ScoreInput | null>(saved?.input ?? null);
  const [overrides, setOverrides] = useState<Overrides>(saved?.overrides ?? { destroy: {}, capture: {}, tickSeconds: null });
  const scoreInput = data ?? (scoring ? { green: emptyGuild(scoring), red: emptyGuild(scoring) } : null);
  useEffect(() => {
    if (scoreInput) localStorage.setItem(KEY, JSON.stringify({ input: scoreInput, overrides }));
  }, [scoreInput, overrides]);

  if (!scoring || !scoreInput) return <p className="p-3 text-sm text-slate-500">Este modo no tiene puntuación configurada.</p>;

  const r = resolve(scoring, overrides);
  const scores = { green: scoreGuild(scoring, r, scoreInput.green), red: scoreGuild(scoring, r, scoreInput.red) };
  const diff = scores.green.total - scores.red.total;
  const edit = (side: Side, fn: (g: GuildInput) => GuildInput) => setData({ ...scoreInput, [side]: fn(scoreInput[side]) });
  const missing = r.todo.filter((label) => {
    const tier = label.split(' ').pop()!;
    if (label.startsWith('destrucción')) return r.destroy[tier] == null;
    if (label.startsWith('captura')) return r.capture[tier] == null;
    return r.tickSeconds == null;
  });

  return (
    <div className="space-y-3 p-3 text-sm">
      {r.todo.length > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200" role="alert">
          <p className="font-semibold">TODO: faltan valores en la config del modo</p>
          <p>Sin cargar desde las tablas del juego: {r.todo.join(', ')}. Complétalos en <code>src/config/modes/guild-league.ts</code>.</p>
          {missing.length > 0 && <p className="mt-1">Lo que falta cuenta como 0, así que el total está incompleto.</p>}
          {r.provisional && <p className="mt-1 font-semibold">El total usa valores provisionales escritos abajo, no valores de la config.</p>}
        </div>
      )}

      <section>
        <h3 className={heading}>Valores por tier</h3>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-slate-500"><th className="text-left font-normal">Tier</th><th className="font-normal">Destruir</th><th className="font-normal">Captura / tick</th></tr>
          </thead>
          <tbody>
            {scoring.tiers.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold">{t.id}</td>
                <td className="p-0.5">{t.destroyPoints != null ? <span className="block text-right">{t.destroyPoints}</span> : <Num label={`Puntos provisionales por destruir tier ${t.id}`} value={overrides.destroy[t.id] ?? null} onChange={(v) => setOverrides({ ...overrides, destroy: { ...overrides.destroy, [t.id]: v } })} />}</td>
                <td className="p-0.5">{t.capturePointsPerTick != null ? <span className="block text-right">{t.capturePointsPerTick}</span> : <Num label={`Puntos provisionales de captura por tick tier ${t.id}`} value={overrides.capture[t.id] ?? null} onChange={(v) => setOverrides({ ...overrides, capture: { ...overrides.capture, [t.id]: v } })} />}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="text-slate-500">Segundos por tick</td>
              <td className="p-0.5">{scoring.captureTickSeconds != null ? <span className="block text-right">{scoring.captureTickSeconds}</span> : <Num label="Segundos provisionales por tick" value={overrides.tickSeconds} onChange={(v) => setOverrides({ ...overrides, tickSeconds: v })} />}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-xs text-slate-500">Kill = {scoring.killPoints} punto. Gana quien llegue a {scoring.winScore}. Los campos editables son provisionales: solo se usan donde la config dice TODO.</p>
      </section>

      {SIDES.map(({ id, name }) => {
        const g = scoreInput[id];
        const sc = scores[id];
        return (
          <section key={id} className="rounded-lg border-2 p-2" style={{ borderColor: SIDE_COLORS[id] }}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{name}</h3>
              <span className="text-2xl font-bold tabular-nums">{sc.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-300 dark:bg-slate-800">
              <div className="h-full" style={{ width: `${Math.min(100, (sc.total / scoring.winScore) * 100)}%`, background: SIDE_COLORS[id] }} />
            </div>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-slate-500"><th className="text-left font-normal">Tier</th><th className="font-normal">Destruidos</th><th className="font-normal">Seg. captura</th><th className="font-normal">Zonas ahora</th></tr>
              </thead>
              <tbody>
                {scoring.tiers.map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold">{t.id}</td>
                    <td className="p-0.5"><Num label={`${name}: pilares ${t.id} destruidos`} value={g.destroyed[t.id] ?? 0} onChange={(v) => edit(id, (x) => ({ ...x, destroyed: { ...x.destroyed, [t.id]: v ?? 0 } }))} /></td>
                    <td className="p-0.5"><Num label={`${name}: segundos de captura tier ${t.id}`} value={g.captureSeconds[t.id] ?? 0} onChange={(v) => edit(id, (x) => ({ ...x, captureSeconds: { ...x.captureSeconds, [t.id]: v ?? 0 } }))} /></td>
                    <td className="p-0.5"><Num label={`${name}: zonas ${t.id} controladas ahora`} value={g.zonesHeld[t.id] ?? 0} onChange={(v) => edit(id, (x) => ({ ...x, zonesHeld: { ...x.zonesHeld, [t.id]: v ?? 0 } }))} /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="text-slate-500">Kills</td>
                  <td className="p-0.5"><Num label={`${name}: kills`} value={g.kills} onChange={(v) => edit(id, (x) => ({ ...x, kills: v ?? 0 }))} /></td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">
              Destrucción {sc.destroy} · captura {sc.capture} · kills {sc.kills}. Faltan <strong>{sc.remaining}</strong> para {scoring.winScore}.
            </p>
            <p className="text-xs">
              {sc.remaining === 0 ? '¡Llegó a la meta!' : sc.secondsToWin != null ? `Con las zonas actuales gana en ~${fmtTime(sc.secondsToWin)} (${sc.rate.toFixed(2)} pts/s).` : 'Sin puntos por captura con las zonas actuales: no se puede estimar el tiempo.'}
            </p>
          </section>
        );
      })}

      <p className="text-center font-medium">
        {diff === 0 ? 'Empate' : `${diff > 0 ? 'Verde' : 'Roja'} va arriba por ${Math.abs(diff)} puntos`}
      </p>
      <button className={`${button} w-full`} onClick={() => setData({ green: emptyGuild(scoring), red: emptyGuild(scoring) })}>Reiniciar simulación</button>
    </div>
  );
}
