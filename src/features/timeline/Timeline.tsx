import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { button, input } from '../board/ui.ts';
import { addStep, goToStep, moveStep, patchStep, play, removeStep, stopPlayback } from './timelineActions.ts';

/** Línea de tiempo: pasos de la estrategia, nota por paso y reproducción animada. */
export function Timeline() {
  const steps = useStrategyStore((s) => s.strategy.steps);
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const checkpoint = useStrategyStore((s) => s.checkpoint);
  const playing = useUiStore((s) => s.playback !== null);
  const step = steps[stepIndex];

  return (
    <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-1">
          <button className={button} disabled={stepIndex === 0} onClick={() => goToStep(stepIndex - 1)} title="Paso anterior ([)">◀</button>
          <button className={`${button} w-28`} disabled={steps.length < 2} onClick={() => (playing ? stopPlayback() : play())} title="Anima los tokens entre pasos">
            {playing ? '■ Detener' : '▶ Reproducir'}
          </button>
          <button className={button} disabled={stepIndex === steps.length - 1} onClick={() => goToStep(stepIndex + 1)} title="Paso siguiente (])">▶</button>
          <span className="mx-1 text-xs tabular-nums text-slate-500">{stepIndex + 1}/{steps.length}</span>
          <button className={button} onClick={() => addStep(true)} title="Nuevo paso con los tokens y dibujos del paso actual como base">+ Copiar paso</button>
          <button className={button} onClick={() => addStep(false)} title="Nuevo paso en blanco">+ Vacío</button>
          <button className={button} disabled={stepIndex === 0} onClick={() => moveStep(stepIndex, -1)} title="Mover el paso a la izquierda">←</button>
          <button className={button} disabled={stepIndex === steps.length - 1} onClick={() => moveStep(stepIndex, 1)} title="Mover el paso a la derecha">→</button>
          <button className={button} disabled={steps.length < 2} onClick={() => removeStep(stepIndex)} title="Eliminar el paso actual">Eliminar</button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => goToStep(i)}
              className={`shrink-0 rounded-md border px-3 py-1 text-sm ${i === stepIndex ? 'border-sky-500 bg-sky-500/20 font-semibold' : 'border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
              <span className="mr-1 text-xs text-slate-500">{i + 1}</span>
              {s.name || 'Sin nombre'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex w-[26rem] max-w-[45%] shrink-0 flex-col gap-1">
        <input className={`${input} font-medium`} value={step.name} placeholder="Nombre del paso (ej.: 0:00 salida)" aria-label="Nombre del paso" onFocus={checkpoint} onChange={(e) => patchStep(stepIndex, { name: e.target.value })} />
        <textarea className={`${input} h-12 resize-none text-xs`} value={step.note} placeholder="Instrucciones para la guild en este paso (ej.: party 2 → zona 7)" aria-label="Nota del paso" onFocus={checkpoint} onChange={(e) => patchStep(stepIndex, { note: e.target.value })} />
      </div>
    </div>
  );
}
