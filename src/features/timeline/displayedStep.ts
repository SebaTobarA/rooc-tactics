import { useMemo } from 'react';
import { pointAlong, route } from '../../lib/walk.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { MapGeometry, Step } from '../../types/index.ts';

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Paso intermedio de una transición: los tokens con el mismo id avanzan por los senderos, sin cruzar el bosque. */
export function interpolateSteps(a: Step, b: Step, t: number, geometry: MapGeometry, aspect: number): Step {
  const k = ease(t);
  const late = t >= 0.5;
  const tokens = [
    ...a.tokens.flatMap((ta) => {
      const tb = b.tokens.find((x) => x.id === ta.id);
      if (!tb) return late ? [] : [ta];
      return [{ ...tb, pos: pointAlong(route(ta.pos, tb.pos, geometry, aspect), k, aspect) }];
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
  const geometry = useMapStore((s) => s.map.geometry);
  const aspect = useMapStore((s) => s.map.aspect);
  return useMemo(() => {
    if (playback && steps[playback.from] && steps[playback.to]) return interpolateSteps(steps[playback.from], steps[playback.to], playback.t, geometry, aspect);
    return steps[stepIndex];
  }, [steps, stepIndex, playback, geometry, aspect]);
}
