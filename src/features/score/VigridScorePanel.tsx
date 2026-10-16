import { useEffect, useState } from 'react';
import { objectiveRules } from '../../config/modes/index.ts';
import { KIND_LOOKS } from '../../config/objectiveKinds.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import type { FieldId, MarkerKind, ObjectiveRules, Side } from '../../types/index.ts';
import { button, heading, input } from '../board/ui.ts';
import { SIDE_COLORS } from '../map-render/konva/Markers.tsx';
import { hornRate, vigridScore, vigridTimeline, type VigridInput } from './vigridScoring.ts';

const SIDES: { id: Side; name: string }[] = [{ id: 'green', name: 'Guild Verde' }, { id: 'red', name: 'Guild Roja' }];
const fmt = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 });
const fmtTime = (s: number) => `${Math.floor(s / 60)} min${s % 60 ? ` ${Math.round(s % 60)} s` : ''}`;

function Num({ value, onChange, label, step }: { value: number; onChange: (v: number) => void; label: string; step?: number }) {
  return (
    <input type="number" min={0} step={step} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label={label} value={value}
      onChange={(e) => onChange(Math.max(0, Math.floor(e.target.valueAsNumber) || 0))} />
  );
}

function Rules({ rules }: { rules: ObjectiveRules }) {
  return (
    <details className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
      <summary className="cursor-pointer font-semibold">Mecánicas de {rules.gameName}</summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {[...(rules.victory ?? []), ...rules.mechanics].map((m) => <li key={m}>{m}</li>)}
      </ul>
      {rules.pendingRules?.length ? (
        <ul className="mt-1 list-disc pl-4 text-amber-700 dark:text-amber-200">
          {rules.pendingRules.map((r) => <li key={r}>Por confirmar: {r}</li>)}
        </ul>
      ) : null}
    </details>
  );
}

interface MainSim {
  sides: Record<Side, VigridInput>;
  fiesta: boolean;
}
const blankInput = (): VigridInput => ({ hornSeconds: 0, kills: {}, playerKills: 0, holdsAtEnd: false });
const KEY = 'rooc-tactics:score-vigrid';

function load<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Puntos de Vigrid: valores, línea de tiempo y simulador del campo de la estrategia. */
export function VigridScorePanel() {
  const { modeId, field: chosen } = useStrategyStore((s) => s.strategy);
  const mapField = useMapStore((s) => s.map.field);
  const field: FieldId = chosen ?? mapField ?? 'main';
  const rules = objectiveRules(modeId, field);
  if (!rules) return <p className="p-3 text-sm text-slate-500">Este campo no tiene puntuación configurada.</p>;
  return <MainScore rules={rules} />;
}

function MainScore({ rules }: { rules: ObjectiveRules }) {
  const steps = useStrategyStore((s) => s.strategy.steps);
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const markers = useMapStore((s) => s.map.markers);
  const [sim, setSim] = useState<MainSim>(() => load(KEY, { sides: { green: blankInput(), red: blankInput() }, fiesta: false }));
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(sim)), [sim]);
  const goal = rules.goal!;
  const horn = rules.horn;
  const rate = hornRate(rules);
  const fiestaMult = rules.fiesta?.multiplier ?? 1;
  const timeline = vigridTimeline(steps, stepIndex, markers, rules);
  const holderNow = steps[stepIndex]?.horn?.holder ?? null;
  const results = Object.fromEntries(SIDES.map(({ id }) => [id, vigridScore(rules, sim.sides[id], sim.fiesta)])) as Record<Side, ReturnType<typeof vigridScore>>;
  const diff = results.green.total - results.red.total;
  const setSide = (side: Side, patch: Partial<VigridInput>) => setSim({ ...sim, sides: { ...sim.sides, [side]: { ...sim.sides[side], ...patch } } });
  const countOf = (kind: MarkerKind) => markers.filter((m) => m.kind === kind).length;

  return (
    <div className="space-y-4 p-3 text-sm">
      <div className="rounded-md bg-sky-500/15 px-2 py-1.5 text-xs">
        <strong>{rules.label}</strong> · gana al instante la primera guild en llegar a <strong>{fmt(goal)}</strong> puntos; si se acaba el tiempo, la de más puntos.
      </div>

      <section>
        <h3 className={heading}>Fuentes de puntos</h3>
        <table className="mt-1 w-full text-xs">
          <tbody>
            {horn && (
              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-0.5">📯 Mantener el cuerno</td>
                <td className="text-right font-semibold">{fmt(horn.pointsPerTick)} / {horn.tickSeconds} s</td>
              </tr>
            )}
            {rules.sources.map((s) => (
              <tr key={s.kind} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-0.5">{KIND_LOOKS[s.kind]?.icon} {s.name} <span className="text-slate-500">×{countOf(s.kind)}</span></td>
                <td className="text-right font-semibold">{s.points != null ? fmt(s.points) : 'sin dato'}</td>
              </tr>
            ))}
            {rules.killPoints != null && (
              <tr className="border-t border-slate-200 dark:border-slate-800"><td className="py-0.5">⚔ Kill de jugador</td><td className="text-right font-semibold">{fmt(rules.killPoints)}</td></tr>
            )}
            {horn && (
              <tr className="border-t border-slate-200 dark:border-slate-800"><td className="py-0.5">🏁 Terminar con el cuerno</td><td className="text-right font-semibold">{fmt(horn.endBonus)}</td></tr>
            )}
          </tbody>
        </table>
        {horn && (
          <ul className="mt-1 space-y-0.5 rounded bg-slate-200/70 px-2 py-1 text-xs dark:bg-slate-800/70">
            <li>El cuerno rinde <strong>{fmt(rate * 60)}</strong> por minuto: solo con él, {fmt(goal)} toma <strong>{fmtTime(goal / rate)}</strong>{rules.fiesta ? ` (${fmtTime(goal / rate / fiestaMult)} en Fiesta Tempo)` : ''}.</li>
            {rules.sources.filter((s) => s.points).map((s) => <li key={s.kind}>{s.name} equivale a {fmt(s.points! / rate)} s de cuerno.</li>)}
            {rules.killPoints ? <li>Una kill equivale a {fmt(rules.killPoints / rate)} s de cuerno: farmear kills sin el cuerno rinde poco.</li> : null}
          </ul>
        )}
        {rules.fiesta && <p className="mt-1 rounded bg-fuchsia-500/10 px-2 py-1 text-xs">Fiesta Tempo: {rules.fiesta.applies}</p>}
      </section>

      <section className="rounded-lg border border-sky-500/40 p-2">
        <h3 className={heading}>Según la línea de tiempo (hasta el paso {stepIndex + 1})</h3>
        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
          {SIDES.map(({ id, name }) => {
            const t = timeline[id];
            return (
              <div key={id}>
                <p className="font-semibold" style={{ color: SIDE_COLORS[id] }}>{name}: {fmt(t.horn + t.bosses)}</p>
                <p className="text-slate-500">cuerno {fmt(t.horn)} · jefes {fmt(t.bosses)}</p>
                {holderNow === id && horn && <p className="text-slate-500">Si termina aquí: +{fmt(horn.endBonus)} → {fmt(t.horn + t.bosses + horn.endBonus)}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">Suma los segundos con el cuerno y los «Último golpe» anotados en Objet. (Fiesta Tempo del paso los duplica). No incluye kills.</p>
      </section>

      {rules.fiesta && (
        <label className="flex items-center gap-2 rounded bg-fuchsia-500/10 px-2 py-1.5 text-xs">
          <input type="checkbox" checked={sim.fiesta} onChange={(e) => setSim({ ...sim, fiesta: e.target.checked })} />
          Simular todo en Fiesta Tempo (cuerno y jefes ×{fiestaMult})
        </label>
      )}

      {SIDES.map(({ id, name }) => {
        const r = results[id];
        const input_ = sim.sides[id];
        return (
          <section key={id} className="rounded-lg border-2 p-2" style={{ borderColor: SIDE_COLORS[id] }}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{name}</h3>
              <span className="text-2xl font-bold tabular-nums">{fmt(r.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-300 dark:bg-slate-800">
              <div className="h-full" style={{ width: `${Math.min(100, (r.total / goal) * 100)}%`, background: SIDE_COLORS[id] }} />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_5rem] items-center gap-1 text-xs">
              {horn && (
                <>
                  <span>Segundos con el cuerno <span className="text-slate-500">({fmtTime(input_.hornSeconds)})</span></span>
                  <Num label={`${name}: segundos con el cuerno`} step={5} value={input_.hornSeconds} onChange={(v) => setSide(id, { hornSeconds: v })} />
                </>
              )}
              {rules.sources.map((s) => (
                <span key={s.kind} className="contents">
                  <span>{KIND_LOOKS[s.kind]?.icon} {s.name} (últimos golpes)</span>
                  <Num label={`${name}: ${s.name}`} value={input_.kills[s.kind] ?? 0} onChange={(v) => setSide(id, { kills: { ...input_.kills, [s.kind]: v } })} />
                </span>
              ))}
              {rules.killPoints != null && (
                <>
                  <span>Kills de jugadores</span>
                  <Num label={`${name}: kills`} value={input_.playerKills} onChange={(v) => setSide(id, { playerKills: v })} />
                </>
              )}
            </div>
            {horn && (
              <label className="mt-1 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={input_.holdsAtEnd} onChange={(e) => setSide(id, { holdsAtEnd: e.target.checked })} />
                Termina con el cuerno (+{fmt(horn.endBonus)})
              </label>
            )}
            <p className="mt-1 text-xs text-slate-500">Cuerno {fmt(r.horn)} · jefes {fmt(r.bosses)} · kills {fmt(r.kills)}{r.endBonus ? ` · bono ${fmt(r.endBonus)}` : ''}.</p>
            <p className="text-xs">
              {r.remaining === 0 ? '¡Llegó a la meta!' : <>Faltan <strong>{fmt(r.remaining)}</strong>{r.hornSecondsToWin != null ? `: ~${fmtTime(r.hornSecondsToWin)} más de cuerno${sim.fiesta ? ' en Fiesta Tempo' : ''}.` : '.'}</>}
            </p>
          </section>
        );
      })}
      <p className="text-center font-medium">{diff === 0 ? 'Empate' : `${diff > 0 ? 'Verde' : 'Roja'} va arriba por ${fmt(Math.abs(diff))}`}</p>
      <p className="text-xs text-slate-500">Empate al final: gana quien sostuvo el cuerno por último; si persiste, el mayor poder de los 10 mejores miembros.</p>
      <Rules rules={rules} />
      <button className={`${button} w-full`} onClick={() => setSim({ sides: { green: blankInput(), red: blankInput() }, fiesta: false })}>Reiniciar simulación</button>
    </div>
  );
}
