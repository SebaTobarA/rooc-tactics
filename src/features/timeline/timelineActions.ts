import { newId } from '../../lib/id.ts';
import { emptyStep, useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { Step } from '../../types/index.ts';

const store = () => useStrategyStore.getState();
const MOVE_MS = 1400;
const HOLD_MS = 900;

/** Agrega un paso después del actual. Con `copy`, parte del paso actual (los tokens conservan su id para poder animarlos). */
export function addStep(copy: boolean): void {
  const { stepIndex, strategy } = store();
  const base = strategy.steps[stepIndex];
  const name = `Paso ${strategy.steps.length + 1}`;
  const step: Step = copy ? { ...base, id: newId('step'), name, note: '' } : emptyStep(name);
  store().checkpoint();
  store().set((s) => ({ ...s, steps: [...s.steps.slice(0, stepIndex + 1), step, ...s.steps.slice(stepIndex + 1)] }));
  goToStep(stepIndex + 1);
}

export function removeStep(index: number): void {
  if (store().strategy.steps.length <= 1) return;
  store().checkpoint();
  store().set((s) => ({ ...s, steps: s.steps.filter((_, i) => i !== index) }));
  goToStep(Math.min(store().stepIndex, store().strategy.steps.length - 1));
}

export function moveStep(index: number, dir: -1 | 1): void {
  const to = index + dir;
  if (to < 0 || to >= store().strategy.steps.length) return;
  store().checkpoint();
  store().set((s) => {
    const steps = [...s.steps];
    [steps[index], steps[to]] = [steps[to], steps[index]];
    return { ...s, steps };
  });
  goToStep(to);
}

export function patchStep(index: number, patch: Partial<Pick<Step, 'name' | 'note'>>): void {
  store().set((s) => ({ ...s, steps: s.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) }));
}

export function patchStepFlags(index: number, patch: Partial<Pick<Step, 'fiestaTempo'>>): void {
  store().set((s) => ({ ...s, steps: s.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) }));
}

export function goToStep(index: number): void {
  stopPlayback();
  useUiStore.getState().setSelection([]);
  store().setStepIndex(index);
}

let raf = 0;

export function stopPlayback(): void {
  cancelAnimationFrame(raf);
  if (useUiStore.getState().playback) useUiStore.getState().setPlayback(null);
}

/** Reproduce desde el paso actual hasta el último, animando los tokens entre pasos. */
export function play(): void {
  stopPlayback();
  const ui = useUiStore.getState();
  const last = store().strategy.steps.length - 1;
  let from = store().stepIndex >= last ? 0 : store().stepIndex;
  if (last < 1) return;
  ui.setSelection([]);
  store().setStepIndex(from);
  let start = performance.now();
  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= MOVE_MS + HOLD_MS) {
      from++;
      store().setStepIndex(from);
      start = now;
      if (from >= last) return void ui.setPlayback(null);
    }
    ui.setPlayback({ from, to: from + 1, t: Math.min(1, Math.max(0, (now - start) / MOVE_MS)) });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
