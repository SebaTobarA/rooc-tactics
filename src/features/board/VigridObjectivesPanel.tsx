import { objectiveRules } from '../../config/modes/index.ts';
import { ELEMENT_LOOKS, KIND_LOOKS, lookOf } from '../../config/objectiveKinds.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { setObjective } from '../../store/boardActions.ts';
import { useIsAdmin } from '../../store/adminStore.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useCurrentStep, useStrategyStore } from '../../store/strategyStore.ts';
import type { MarkerKind, ObjectiveStatus, Side } from '../../types/index.ts';
import { PublishButton } from '../admin/PublishButton.tsx';
import { hornPoints } from '../score/vigridScoring.ts';
import { patchStepFlags } from '../timeline/timelineActions.ts';
import { button, heading, input } from './ui.ts';

/** Orden en que se listan los objetivos. */
const ORDER: MarkerKind[] = ['horn', 'fenrir', 'element-lord', 'altar', 'dracula', 'entry', 'respawn-point'];

const fmt = (n: number) => n.toLocaleString('es');

/** Objetivos de Vigrid en el paso actual: quién tiene el cuerno, jefes (último golpe) y altares (corrupción). */
export function VigridObjectivesPanel() {
  const map = useMapStore((s) => s.map);
  const dirty = useMapStore((s) => s.dirty);
  const step = useCurrentStep();
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const checkpoint = useStrategyStore((s) => s.checkpoint);
  const { modeId, field } = useStrategyStore((s) => s.strategy);
  const rules = objectiveRules(modeId, field ?? map.field ?? 'main');
  const admin = useIsAdmin();
  const horn = step.horn ?? { holder: null };
  const setHorn = (patch: Partial<NonNullable<typeof step.horn>>) => {
    checkpoint();
    patchStepFlags(stepIndex, { horn: { ...horn, ...patch } });
  };
  const openEditor = (selectId?: string) => {
    useEditorStore.getState().setActive(true);
    if (selectId) useEditorStore.getState().select({ type: 'marker', id: selectId });
  };
  const fiesta = !!step.fiestaTempo && !!rules?.fiesta;
  const groups = ORDER.map((kind) => ({ kind, markers: map.markers.filter((m) => m.kind === kind) })).filter((g) => g.markers.length);

  return (
    <div className="space-y-3 p-3">
      {rules?.horn && (
        <section className="space-y-1 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2">
          <h3 className={heading}>📯 Cuerno en este paso</h3>
          <div className="grid grid-cols-[1fr_5rem] gap-1">
            <select className={input} aria-label="Quién tiene el cuerno" value={horn.holder ?? ''} onChange={(e) => setHorn({ holder: (e.target.value || null) as Side | null })}>
              <option value="">Nadie lo tiene</option>
              <option value="green">Lo tiene Verde</option>
              <option value="red">Lo tiene Roja</option>
            </select>
            <input className={input} type="number" min={0} step={5} placeholder="seg" aria-label="Segundos con el cuerno en este paso" title="Segundos que lo sostiene durante este paso"
              value={horn.seconds ?? ''} onChange={(e) => setHorn({ seconds: e.target.value === '' ? undefined : Math.max(0, e.target.valueAsNumber || 0) })} />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {horn.holder
              ? `${horn.holder === 'green' ? 'Verde' : 'Roja'} suma ${fmt(hornPoints(rules, horn.seconds ?? 0, fiesta ? rules.fiesta!.multiplier : 1))} en este paso (${fmt(rules.horn.pointsPerTick * (fiesta ? rules.fiesta!.multiplier : 1))} cada ${rules.horn.tickSeconds} s${fiesta ? ', Fiesta Tempo' : ''}).`
              : `${fmt(rules.horn.pointsPerTick)} cada ${rules.horn.tickSeconds} s para quien lo tenga; ${fmt(rules.horn.endBonus)} extra si lo tiene al terminar.`}
          </p>
          <p className="text-xs text-slate-500">El portador pierde 10% de HP cada 5 s; cada altar activo le da 60 s de inmunidad.</p>
        </section>
      )}

      {admin && (
        <section className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className={heading}>Mapa</h3>
            {dirty && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300">Borrador del mapa</span>}
          </div>
          <button className={`${button} w-full text-xs`} onClick={() => openEditor()} title="Abre el editor de mapa: arrastra los objetivos a su lugar">Mover objetivos en el mapa</button>
          <PublishButton />
        </section>
      )}

      {groups.map(({ kind, markers }) => {
        const look = KIND_LOOKS[kind]!;
        const source = rules?.sources.find((s) => s.kind === kind);
        return (
          <section key={kind} className="space-y-1">
            <h3 className={heading}>
              {look.icon} {look.label} ({markers.length}){source?.points != null ? ` · ${fmt(source.points * (fiesta ? rules!.fiesta!.multiplier : 1))} pts` : ''}
            </h3>
            {(source?.reward || source?.spawn) && <p className="text-xs text-slate-500">{[source.spawn && `Aparece ${source.spawn}`, source.reward && `Da ${source.reward}`].filter(Boolean).join('. ')}.</p>}
            {kind === 'altar' && <p className="text-xs text-slate-500">Cada 5 min se corrompen: primero 3, luego 2, luego 1. Marca «Corrompido» los que ya no sirven en este paso.</p>}
            {markers.map((m) => {
              const o = step.objectives.find((x) => x.markerId === m.id);
              const statuses = lookOf(m)?.statuses;
              return (
                <div key={m.id} className="rounded-md border border-slate-200 p-1.5 dark:border-slate-800">
                  <div className="flex items-center gap-1 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{m.label}{m.confirmed ? '' : ' (?)'}</span>
                    <span className="shrink-0 text-xs text-slate-500">zona {zoneOf(m.pos, map.numpad)}</span>
                    {admin && <button className="px-1 text-slate-400 hover:text-sky-500" title="Mover en el mapa" aria-label={`Mover ${m.label}`} onClick={() => openEditor(m.id)}>✥</button>}
                  </div>
                  {m.element && <p className="text-xs text-slate-500">{ELEMENT_LOOKS[m.element].icon} Bufo de 60 s: {ELEMENT_LOOKS[m.element].buff}.</p>}
                  {statuses && (
                    <div className="mt-1 grid grid-cols-[1fr_4rem] gap-1">
                      <select className={input} aria-label={`Estado de ${m.label} en este paso`} value={o?.status ?? (statuses.pending ? 'pending' : 'active')} onChange={(e) => setObjective(m.id, { status: e.target.value as ObjectiveStatus })}>
                        {Object.entries(statuses).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                      <input className={input} type="number" min={0} placeholder="seg" title="Temporizador en segundos (opcional): cuánto falta para que aparezca o se corrompa"
                        aria-label={`Temporizador de ${m.label}`} value={o?.timerSeconds ?? ''}
                        onChange={(e) => setObjective(m.id, { timerSeconds: e.target.value === '' ? undefined : Math.max(0, e.target.valueAsNumber || 0) })} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="text-xs text-slate-500">En los jefes, «Último golpe» suma sus puntos a esa guild en la pestaña Puntos (una vez por paso en que cambia).</p>
    </div>
  );
}
