import { useMemo } from 'react';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { Step } from '../../types/index.ts';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Paso intermedio de una transición: los tokens con el mismo id se mueven en línea recta. */
export function interpolateSteps(a: Step, b: Step, t: number): Step {
  const k = ease(t);
  const late = t >= 0.5;
  const tokens = [
    ...a.tokens.flatMap((ta) => {
      const tb = b.tokens.find((x) => x.id === ta.id);
      if (!tb) return late ? [] : [ta];
      return [{ ...tb, pos: { x: ta.pos.x + (tb.pos.x - ta.pos.x) * k, y: ta.pos.y + (tb.pos.y - ta.pos.y) * k } }];
    }),
    ...(late ? b.tokens.filter((tb) => !a.tokens.some((x) => x.id === tb.id)) : []),
  ];
  return { ...(late ? b : a), tokens };
}

/** Paso que deben dibujar las vistas 2D y 3D: el actual, o el interpolado durante la reproducción. */
export function useDisplayedStep(): Step {
  const steps = useStrategyStore((s) => s.strategy.steps);
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const playback = useUiStore((s) => s.playback);
  return useMemo(() => {
    if (playback && steps[playback.from] && steps[playback.to]) return interpolateSteps(steps[playback.from], steps[playback.to], playback.t);
    return steps[stepIndex];
  }, [steps, stepIndex, playback]);
}
