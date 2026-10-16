import { FIELD_LABELS, fieldScoring, hasFields, modeById } from '../../config/modes/index.ts';
import { repository } from '../../data/StrategyRepository.ts';
import { newStrategy, openAndSave, useStrategyStore } from '../../store/strategyStore.ts';
import type { FieldId } from '../../types/index.ts';

function describe(modeId: string, field: FieldId): string {
  const own = modeById(modeId)?.fieldMaps?.[field];
  if (own) return own.description;
  const fs = fieldScoring(modeId, field);
  if (!fs) return '';
  return fs.goal != null
    ? `Aquí se gana la partida: la primera guild en llegar a ${fs.goal} ${fs.unit}.`
    : `No da la victoria: acumula ${fs.unit}, que en ${(fs.thresholds ?? []).map((t) => t.at).join(' / ')} desbloquea mejoras para el ${FIELD_LABELS.main}.${fs.commander ? ` Romper el sello ${fs.commander.trigger} entrega Habilidad de Comandante.` : ''}`;
}

/** Elegir el campo en que se concentra la estrategia. Define el objetivo de los puntos, el simulador y el asistente IA. */
export function FieldChooser({ onClose }: { onClose?: () => void }) {
  const { modeId, field } = useStrategyStore((s) => s.strategy);
  const fieldMaps = modeById(modeId)?.fieldMaps;
  const choose = async (f: FieldId) => {
    const store = useStrategyStore.getState();
    const target = fieldMaps?.[f].mapId;
    // En Vigrid cada campo es otro mapa: se abre la última estrategia de ese mapa o una nueva con la misma guild.
    if (target && target !== store.strategy.mapId) {
      const current = store.strategy;
      const last = (await repository.list()).filter((x) => x.mapId === target).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const saved = last ? await repository.get(last.id) : null;
      const next = saved ? { ...saved, field: f } : { ...newStrategy(modeId, target), name: current.name, field: f, roster: current.roster, parties: current.parties, raids: current.raids, allySide: current.allySide };
      await openAndSave(next);
      onClose?.();
      location.hash = `#/board/${target}`;
      return;
    }
    if (store.strategy.field !== f) {
      store.checkpoint();
      store.set((s) => ({ ...s, field: f }));
    }
    onClose?.();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl space-y-3 rounded-xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">¿En qué campo se concentra esta estrategia?</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Guild League se juega en dos campos a la vez. El campo elegido define cómo se calculan los puntos, qué muestra el simulador y cómo responde el asistente IA.
          {fieldMaps ? ' En Vigrid cada campo tiene su propio mapa: al cambiar de campo se abre ese mapa con la misma guild.' : ''} Puedes cambiarlo después.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['main', 'sub'] as FieldId[]).map((f) => (
            <button key={f} onClick={() => void choose(f)}
              className={`rounded-lg border-2 p-3 text-left hover:border-sky-500 ${field === f ? 'border-sky-500 bg-sky-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              <span className="block font-semibold">{fieldMaps?.[f].label ?? FIELD_LABELS[f]} <span className="font-normal text-slate-500">({fieldMaps ? (f === 'main' ? 'campo principal' : 'subcampo') : f === 'main' ? 'Main Field' : 'Sub Field'})</span></span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{describe(modeId, f)}</span>
            </button>
          ))}
        </div>
        {!hasFields(modeId) && <p className="text-xs text-slate-500">Este modo no distingue campos.</p>}
      </div>
    </div>
  );
}
