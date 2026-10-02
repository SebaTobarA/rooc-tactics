import { modeById } from '../../config/modes/index.ts';
import { newId } from '../../lib/id.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { snapToWalkable } from '../../lib/walk.ts';
import { setObjective } from '../../store/boardActions.ts';
import { useIsAdmin } from '../../store/adminStore.ts';
import { PublishButton } from '../admin/PublishButton.tsx';
import { useEditorStore } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { tierPoints, useScoringStore } from '../../store/scoringStore.ts';
import { useCurrentStep, useStrategyStore } from '../../store/strategyStore.ts';
import type { ObjectiveStatus } from '../../types/index.ts';
import { STATUS_LABELS } from '../map-render/konva/Markers.tsx';
import { button, heading, input } from './ui.ts';

const num = (v: string) => (v === '' ? null : Math.max(0, Number(v) || 0));

/** Pilares: ubicación y tier (propios del mapa), puntos por tier, y estado en el paso actual. */
export function ObjectivesPanel() {
  const { map, update, checkpoint, dirty } = useMapStore();
  const step = useCurrentStep();
  const modeId = useStrategyStore((s) => s.strategy.modeId);
  const { overrides, setOverrides } = useScoringStore();
  const scoring = modeById(modeId)?.scoring;
  const admin = useIsAdmin();
  const points = tierPoints(modeId, overrides);
  const pillars = map.markers.filter((m) => m.kind === 'central-pillar' || m.kind === 'pillar-slot');
  const editMap = (fn: Parameters<typeof update>[0]) => {
    checkpoint();
    update(fn);
  };
  const openEditor = (selectId?: string) => {
    useEditorStore.getState().setActive(true);
    if (selectId) useEditorStore.getState().select({ type: 'marker', id: selectId });
  };
  const addPillar = () => {
    const id = newId('pillar-slot');
    const count = map.markers.filter((m) => m.kind === 'pillar-slot').length + 1;
    editMap((m) => m.markers.push({ id, kind: 'pillar-slot', pos: snapToWalkable({ x: 0.5, y: 0.62 }, m.geometry, m.aspect), label: `Pilar ${count}`, confirmed: false }));
    openEditor(id);
  };

  // Puntos por tick que suma cada guild con los pilares capturados en este paso.
  const held = { green: 0, red: 0 };
  let heldUnknown = false;
  for (const m of pillars) {
    const o = step.objectives.find((x) => x.markerId === m.id);
    if (o?.status !== 'captured-green' && o?.status !== 'captured-red') continue;
    const p = points.tiers.find((t) => t.id === (o.tier ?? m.tier))?.capturePerTick;
    if (p == null) heldUnknown = true;
    else held[o.status === 'captured-green' ? 'green' : 'red'] += p;
  }

  return (
    <div className="space-y-3 p-3">
      <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
        <h3 className={heading}>Puntos por tier</h3>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-slate-500"><th className="text-left font-normal">Tier</th><th className="font-normal">Destruir</th><th className="font-normal">Captura / tick</th></tr>
          </thead>
          <tbody>
            {(scoring?.tiers ?? []).map((t) => (
              <tr key={t.id}>
                <td className="font-semibold">{t.id}</td>
                <td className="p-0.5">
                  {!admin ? <span className="block text-right">{points.tiers.find((x) => x.id === t.id)?.destroy ?? 'sin dato'}</span> : (
                    <input type="number" min={0} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label={`Puntos por destruir un pilar tier ${t.id}`} placeholder="sin dato"
                      value={overrides.destroy[t.id] ?? t.destroyPoints ?? ''} onChange={(e) => setOverrides({ ...overrides, destroy: { ...overrides.destroy, [t.id]: num(e.target.value) } })} />
                  )}
                </td>
                <td className="p-0.5">
                  {!admin ? <span className="block text-right">{points.tiers.find((x) => x.id === t.id)?.capturePerTick ?? 'sin dato'}</span> : (
                    <input type="number" min={0} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label={`Puntos de captura por tick tier ${t.id}`} placeholder="sin dato"
                      value={overrides.capture[t.id] ?? t.capturePointsPerTick ?? ''} onChange={(e) => setOverrides({ ...overrides, capture: { ...overrides.capture, [t.id]: num(e.target.value) } })} />
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="text-slate-500">Segundos por tick</td>
              <td className="p-0.5">
                {!admin ? <span className="block text-right">{points.tickSeconds ?? 'sin dato'}</span> : (
                  <input type="number" min={0} className={`${input} px-1 py-0.5 text-right text-xs`} aria-label="Segundos por tick de captura" placeholder="sin dato"
                    value={overrides.tickSeconds ?? scoring?.captureTickSeconds ?? ''} onChange={(e) => setOverrides({ ...overrides, tickSeconds: num(e.target.value) })} />
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-xs text-slate-500">{admin ? 'Tus cambios son un borrador hasta que pulses «Publicar para todos».' : 'Los usan el simulador de puntos y el asistente IA. Los carga el superadministrador.'}</p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={heading}>Pilares del mapa ({pillars.length})</h3>
          {admin && dirty && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300">Borrador del mapa</span>}
        </div>
        {admin && (
          <>
            <div className="grid grid-cols-2 gap-1">
              <button className={`${button} text-xs`} onClick={() => openEditor()} title="Abre el editor de mapa: arrastra los pilares a su lugar">Mover pilares en el mapa</button>
              <button className={`${button} text-xs`} onClick={addPillar}>+ Agregar pilar</button>
            </div>
            <PublishButton />
          </>
        )}
        <p className="text-xs text-slate-500">La ubicación y el tier son del mapa (valen para todos los pasos){admin ? '' : ' y los define el superadministrador'}. El estado y el temporizador son del paso actual.</p>

        {pillars.map((m) => {
          const o = step.objectives.find((x) => x.markerId === m.id);
          const p = points.tiers.find((t) => t.id === m.tier);
          return (
            <div key={m.id} className="rounded-md border border-slate-200 p-2 dark:border-slate-800">
              <div className="mb-1 flex items-center gap-1">
                {admin ? (
                  <input className={`${input} min-w-0 flex-1 py-0.5 text-sm font-medium`} value={m.label} aria-label="Nombre del pilar" onFocus={checkpoint}
                    onChange={(e) => update((map) => (map.markers.find((k) => k.id === m.id)!.label = e.target.value))} />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.label}</span>
                )}
                <span className="shrink-0 text-xs text-slate-500">zona {zoneOf(m.pos, map.numpad)}</span>
                {admin && <button className="px-1 text-slate-400 hover:text-sky-500" title="Mover este pilar en el mapa" aria-label={`Mover ${m.label}`} onClick={() => openEditor(m.id)}>✥</button>}
                {admin && m.kind === 'pillar-slot' && (
                  <button className="px-1 text-slate-400 hover:text-red-500" title="Eliminar este pilar del mapa" aria-label={`Eliminar ${m.label}`}
                    onClick={() => confirm(`¿Eliminar "${m.label}" del mapa?`) && editMap((map) => (map.markers = map.markers.filter((k) => k.id !== m.id)))}>×</button>
                )}
              </div>
              <div className="grid grid-cols-[4.5rem_1fr_4rem] gap-1">
                {admin ? (
                  <select className={`${input} font-semibold`} aria-label="Tier del pilar" value={m.tier ?? ''} onChange={(e) => editMap((map) => (map.markers.find((k) => k.id === m.id)!.tier = e.target.value || undefined))}>
                    <option value="">Tier…</option>
                    {(scoring?.tiers ?? []).map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                  </select>
                ) : (
                  <span className="flex items-center justify-center rounded border border-slate-300 text-sm font-semibold dark:border-slate-700">{m.tier ? `Tier ${m.tier}` : 'Sin tier'}</span>
                )}
                <select className={input} aria-label="Estado en este paso" value={o?.status ?? 'pending'} onChange={(e) => setObjective(m.id, { status: e.target.value as ObjectiveStatus })}>
                  {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <input className={input} type="number" min={0} placeholder="seg" title="Temporizador en segundos (opcional)" aria-label="Temporizador en segundos"
                  value={o?.timerSeconds ?? ''} onChange={(e) => setObjective(m.id, { timerSeconds: e.target.value === '' ? undefined : Math.max(0, e.target.valueAsNumber || 0) })} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {!m.tier ? (admin ? 'Define el tier para ver sus puntos.' : 'Tier sin definir.') : `Destruir: ${p?.destroy ?? 'sin dato'} pts · Captura: ${p?.capturePerTick ?? 'sin dato'} pts${points.tickSeconds ? ` cada ${points.tickSeconds} s` : ' por tick'}`}
              </p>
            </div>
          );
        })}
      </section>

      <p className="rounded bg-slate-200/70 px-2 py-1 text-xs dark:bg-slate-800/70">
        Captura en este paso — Verde: <strong>{held.green}</strong> pts/tick · Roja: <strong>{held.red}</strong> pts/tick{heldUnknown ? ' (hay pilares capturados sin puntos definidos)' : ''}
      </p>
    </div>
  );
}
