import { FIELD_LABELS, fieldScoring, hasFields } from '../../config/modes/index.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import type { FieldId } from '../../types/index.ts';

function describe(modeId: string, field: FieldId): string {
  const fs = fieldScoring(modeId, field);
  if (!fs) return '';
  return fs.goal != null
    ? `Aquí se gana la partida: la primera guild en llegar a ${fs.goal} ${fs.unit}.`
    : `No da la victoria: acumula ${fs.unit}, que en ${(fs.thresholds ?? []).map((t) => t.at).join(' / ')} desbloquea mejoras para el ${FIELD_LABELS.main}.${fs.commander ? ` Romper el sello ${fs.commander.trigger} entrega Habilidad de Comandante.` : ''}`;
}

/** Elegir el campo en que se concentra la estrategia. Define el objetivo de los puntos, el simulador y el asistente IA. */
export function FieldChooser({ onClose }: { onClose?: () => void }) {
  const { modeId, field } = useStrategyStore((s) => s.strategy);
  const choose = (f: FieldId) => {
    const store = useStrategyStore.getState();
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Guild League se juega en dos campos a la vez. El campo elegido define cómo se calculan los puntos, qué muestra el simulador y cómo responde el asistente IA. Puedes cambiarlo después.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['main', 'sub'] as FieldId[]).map((f) => (
            <button key={f} onClick={() => choose(f)}
              className={`rounded-lg border-2 p-3 text-left hover:border-sky-500 ${field === f ? 'border-sky-500 bg-sky-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              <span className="block font-semibold">{FIELD_LABELS[f]} <span className="font-normal text-slate-500">({f === 'main' ? 'Main Field' : 'Sub Field'})</span></span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{describe(modeId, f)}</span>
            </button>
          ))}
        </div>
        {!hasFields(modeId) && <p className="text-xs text-slate-500">Este modo no distingue campos.</p>}
      </div>
    </div>
  );
}
