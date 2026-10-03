import { useEffect, useMemo, useState } from 'react';
import { fieldScoring, FIELD_LABELS, modeById } from '../../config/modes/index.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { resolvedStats, useScoringStore } from '../../store/scoringStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import type { FieldId, Side, TierId } from '../../types/index.ts';
import { button, heading, input } from '../board/ui.ts';
import { SIDE_COLORS } from '../map-render/konva/Markers.tsx';
import { guildScore, NO_FIESTA, onePassMax, pillarsNeeded, targetOf, timelineScore, type GuildRow, type Multipliers } from './scoring.ts';

const SIDES: { id: Side; name: string }[] = [{ id: 'green', name: 'Guild Verde' }, { id: 'red', name: 'Guild Roja' }];
const fmt = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 2 });
const fmtTime = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

interface SimState {
  rows: Record<Side, Record<TierId, GuildRow>>;
  kills: Record<Side, number>;
  fiesta: boolean;
  scenario: { kills: number; mix: Record<TierId, number> };
}

function Num({ value, onChange, label, max }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  return (
    <input type="number" min={0} max={max} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label={label} value={value}
      onChange={(e) => onChange(Math.min(max ?? Infinity, Math.max(0, Math.floor(e.target.valueAsNumber) || 0)))} />
  );
}

/** Puntos del campo en que se concentra la estrategia: valor por pilar, simulador, escenarios y línea de tiempo. */
export function ScorePanel() {
  const { modeId, steps, field: chosen } = useStrategyStore((s) => s.strategy);
  const field: FieldId = chosen ?? 'main';
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const markers = useMapStore((s) => s.map.markers);
  const overrides = useScoringStore((s) => s.overrides);
  const fs = fieldScoring(modeId, field);
  const fiestaCfg = modeById(modeId)?.scoring?.fiestaTempo;
  const fiestaConfirmed = !!fiestaCfg?.appliesTo.includes(field);
  const { stats, tickSeconds, missing } = useMemo(() => resolvedStats(modeId, overrides, field), [modeId, overrides, field]);
  const key = `rooc-tactics:score-v3:${field}`;
  const blankRows = () => Object.fromEntries(stats.map((s) => [s.id, { seals: 0, captured: 0, ticks: s.maxTicks, holding: 0 }])) as Record<TierId, GuildRow>;
  const blank = (): SimState => ({ rows: { green: blankRows(), red: blankRows() }, kills: { green: 0, red: 0 }, fiesta: false, scenario: { kills: 0, mix: {} } });
  const [sims, setSims] = useState<Partial<Record<FieldId, SimState>>>(() => {
    const out: Partial<Record<FieldId, SimState>> = {};
    for (const f of ['main', 'sub'] as FieldId[]) {
      try {
        const saved = JSON.parse(localStorage.getItem(`rooc-tactics:score-v3:${f}`) ?? 'null') as SimState | null;
        if (saved?.rows && saved.scenario) out[f] = saved;
      } catch {
        // se empieza de cero
      }
    }
    return out;
  });
  const sim = sims[field] ?? blank();
  const setSim = (next: SimState) => setSims({ ...sims, [field]: next });
  useEffect(() => {
    if (sims[field]) localStorage.setItem(key, JSON.stringify(sims[field]));
  }, [sims, field, key]);

  if (!fs) return <p className="p-3 text-sm text-slate-500">Este modo no tiene puntuación configurada.</p>;

  const unit = fs.unit;
  const target = targetOf(fs);
  const fiesta: Multipliers = sim.fiesta && fiestaCfg ? { seal: fiestaCfg.sealMultiplier, capture: fiestaCfg.captureMultiplier } : NO_FIESTA;
  const pillarTiers = markers.filter((m) => m.kind === 'central-pillar' || m.kind === 'pillar-slot').map((m) => m.tier);
  const countByTier = (id: TierId) => pillarTiers.filter((t) => t === id).length;
  const untiered = pillarTiers.filter((t) => !t).length;
  const onePass = onePassMax(stats, pillarTiers);
  const results = Object.fromEntries(SIDES.map(({ id }) => [id, guildScore(stats, sim.rows[id], sim.kills[id], fs, fiesta)])) as Record<Side, ReturnType<typeof guildScore>>;
  const diff = results.green.total - results.red.total;
  const row = (side: Side, tier: TierId): GuildRow => sim.rows[side][tier] ?? { seals: 0, captured: 0, ticks: stats.find((s) => s.id === tier)?.maxTicks ?? 0, holding: 0 };
  const setRow = (side: Side, tier: TierId, patch: Partial<GuildRow>) => setSim({ ...sim, rows: { ...sim.rows, [side]: { ...sim.rows[side], [tier]: { ...row(side, tier), ...patch } } } });

  const tierOf = (markerId: string, o: { tier?: TierId }) => o.tier ?? markers.find((m) => m.id === markerId)?.tier;
  const fiestaForStep = (step: { fiestaTempo?: boolean }): Multipliers => (step.fiestaTempo && fiestaCfg && fiestaConfirmed ? { seal: fiestaCfg.sealMultiplier, capture: fiestaCfg.captureMultiplier } : NO_FIESTA);
  const timeline = timelineScore(steps, stepIndex, tierOf, stats, fiestaForStep);
  const killValue = fs.killPoints ?? 0;
  const mixPoints = stats.reduce((a, s) => a + (sim.scenario.mix[s.id] ?? 0) * s.pillarTotal, 0) + sim.scenario.kills * killValue;
  const reached = (total: number) => (fs.thresholds ?? []).filter((t) => total >= t.at);
  const commanderTier = fs.commander?.trigger;

  return (
    <div className="space-y-4 p-3 text-sm">
      <div className="rounded-md bg-sky-500/15 px-2 py-1.5 text-xs">
        <strong>{FIELD_LABELS[field]}</strong> · {fs.goal != null ? `gana quien llegue a ${fs.goal} ${unit}` : `no gana la partida: la ${unit} desbloquea mejoras en umbrales de ${(fs.thresholds ?? []).map((t) => t.at).join(' / ')}`}.
        {!chosen && ' (La estrategia aún no tiene campo elegido; se muestra el Principal.)'}
      </div>
      {missing.length > 0 && <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200" role="alert">Faltan valores: {missing.join(', ')}. Cuentan como 0.</p>}

      <section>
        <h3 className={heading}>Valor por pilar ({unit})</h3>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-normal">Tier</th><th className="text-right font-normal">Sello</th><th className="text-right font-normal">Por s</th>
              <th className="text-right font-normal">Dura</th><th className="text-right font-normal">Captura</th><th className="text-right font-normal">Total</th>
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
          Un tick cada {tickSeconds} s. Kill = {fs.killPoints != null ? `${fs.killPoints} ${unit}` : 'sin confirmar (no suma)'}. ×N = pilares de ese tier en el mapa{untiered ? ` (${untiered} sin tier)` : ''}.
        </p>
        <p className="mt-1 rounded bg-slate-200/70 px-2 py-1 text-xs dark:bg-slate-800/70">
          Máximo de una pasada: <strong>{onePass}</strong> {unit}
          {fs.goal != null ? (onePass < fs.goal ? ` de ${fs.goal}: no alcanza; o los pilares se refrescan, o las kills deciden.` : ` de ${fs.goal}.`) : reached(onePass).length ? ` (alcanza ${reached(onePass).length} de ${(fs.thresholds ?? []).length} umbrales).` : '.'}
        </p>
        {fs.thresholds && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {fs.thresholds.map((t) => <li key={t.at}><strong>{t.at}</strong>: {t.reward}</li>)}
          </ul>
        )}
        {fs.commander && (
          <p className="mt-1 text-xs">
            Romper el sello de un pilar <strong>{fs.commander.trigger}</strong> entrega Habilidad de Comandante para el {FIELD_LABELS[fs.commander.target]}:{' '}
            {fs.commander.skills.map((k) => `${k.name}, ${k.radiusMeters} m, ${k.effect}`).join('; ')}.
          </p>
        )}
        {[...(fs.pendingRules ?? []), ...(fiestaCfg?.pendingRules ?? [])].length ? (
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-700 dark:text-amber-200">
            {[...(fs.pendingRules ?? []), ...(fiestaCfg?.pendingRules.map((r) => `Fiesta Tempo: ${r}`) ?? [])].map((r) => <li key={r}>Por confirmar: {r}</li>)}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-sky-500/40 p-2">
        <h3 className={heading}>Según la línea de tiempo (hasta el paso {stepIndex + 1})</h3>
        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
          {SIDES.map(({ id, name }) => (
            <div key={id}>
              <p className="font-semibold" style={{ color: SIDE_COLORS[id] }}>{name}: {timeline[id].seals + timeline[id].capture} {unit}</p>
              <p className="text-slate-500">sellos {timeline[id].seals} · captura {timeline[id].capture}</p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Cuenta los pilares marcados «En captura» en Objet. (sello + captura completa o los ticks anotados) y duplica la captura en los pasos con Fiesta Tempo{fiestaConfirmed ? '' : ' (en este campo está sin confirmar, así que no se aplica)'}. No incluye kills.</p>
      </section>

      {fiestaCfg && (
        <label className="flex items-center gap-2 rounded bg-fuchsia-500/10 px-2 py-1.5 text-xs">
          <input type="checkbox" checked={sim.fiesta} onChange={(e) => setSim({ ...sim, fiesta: e.target.checked })} />
          Simular Fiesta Tempo (captura ×{fiestaCfg.captureMultiplier}){fiestaConfirmed ? '' : ' — en este campo está sin confirmar'}
        </label>
      )}

      {SIDES.map(({ id, name }) => {
        const r = results[id];
        const seals = row(id, commanderTier ?? '').seals;
        return (
          <section key={id} className="rounded-lg border-2 p-2" style={{ borderColor: SIDE_COLORS[id] }}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{name}</h3>
              <span className="text-2xl font-bold tabular-nums">{r.total} <span className="text-xs font-normal">{unit}</span></span>
            </div>
            <div className="relative h-2 overflow-hidden rounded bg-slate-300 dark:bg-slate-800">
              <div className="h-full" style={{ width: `${Math.min(100, (r.total / (target || 1)) * 100)}%`, background: SIDE_COLORS[id] }} />
              {(fs.thresholds ?? []).slice(0, -1).map((t) => <span key={t.at} className="absolute top-0 h-full w-0.5 bg-slate-900/60 dark:bg-white/60" style={{ left: `${(t.at / target) * 100}%` }} />)}
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
                {fs.killPoints != null && (
                  <tr>
                    <td colSpan={4} className="text-slate-500">Kills</td>
                    <td className="p-0.5"><Num label={`${name}: kills`} value={sim.kills[id]} onChange={(v) => setSim({ ...sim, kills: { ...sim.kills, [id]: v } })} /></td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">Sellos {fmt(r.seals)} · captura {fmt(r.capture)}{fs.killPoints != null ? ` · kills ${r.kills}` : ''}.</p>
            {fs.goal != null ? (
              <p className="text-xs">
                Faltan <strong>{r.remaining}</strong> para {fs.goal}.{' '}
                {r.remaining === 0 ? '¡Ganó!' : r.secondsToWin != null ? `Con las capturas activas gana en ~${fmtTime(r.secondsToWin)} (${fmt(r.rate)}/s), si nadie se las quita.` : 'Sin capturas activas no se puede estimar el tiempo.'}
              </p>
            ) : (
              <p className="text-xs">
                {reached(r.total).length ? `Umbrales alcanzados: ${reached(r.total).map((t) => t.at).join(', ')}.` : 'Aún sin umbrales.'}{' '}
                {(fs.thresholds ?? []).find((t) => r.total < t.at) ? `Próximo: ${(fs.thresholds ?? []).find((t) => r.total < t.at)!.at} (faltan ${(fs.thresholds ?? []).find((t) => r.total < t.at)!.at - r.total}).` : 'Todos los umbrales alcanzados.'}
              </p>
            )}
            {fs.commander && seals > 0 && <p className="mt-1 rounded bg-amber-400/20 px-2 py-0.5 text-xs font-medium">Habilidad de Comandante disponible para el {FIELD_LABELS[fs.commander.target]}.</p>}
          </section>
        );
      })}
      <p className="text-center font-medium">{diff === 0 ? 'Empate' : `${diff > 0 ? 'Verde' : 'Roja'} va arriba por ${fmt(Math.abs(diff))} ${unit}`}</p>

      <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
        <h3 className={heading}>{fs.goal != null ? `¿Cuántos pilares para llegar a ${fs.goal}?` : '¿Cuántos pilares para cada umbral de moral?'}</h3>
        {fs.killPoints != null && (
          <label className="mt-1 grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
            Kills esperadas
            <Num label="Kills esperadas" value={sim.scenario.kills} onChange={(v) => setSim({ ...sim, scenario: { ...sim.scenario, kills: v } })} />
          </label>
        )}
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-slate-500"><th className="text-left font-normal">Solo con pilares</th>{(fs.goal != null ? [fs.goal] : (fs.thresholds ?? []).map((t) => t.at)).map((g) => <th key={g} className="text-right font-normal">{g}</th>)}</tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.id} completos</td>
                {(fs.goal != null ? [fs.goal] : (fs.thresholds ?? []).map((t) => t.at)).map((g) => <td key={g} className="text-right">{pillarsNeeded(s, g, sim.scenario.kills * killValue) ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
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
          Total: <strong>{mixPoints}</strong> {unit}{' '}
          {fs.goal != null ? (mixPoints >= fs.goal ? '— alcanza para ganar.' : `— faltan ${fs.goal - mixPoints}.`) : `— umbrales: ${reached(mixPoints).map((t) => t.at).join(', ') || 'ninguno'}.`}
        </p>
      </section>

      <button className={`${button} w-full`} onClick={() => setSim(blank())}>Reiniciar simulación de este campo</button>
    </div>
  );
}
