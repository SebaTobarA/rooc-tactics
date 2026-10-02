import { useCallback, useRef, useState } from 'react';
import { roundVec } from '../../lib/geometry.ts';
import { addDrawing, removeItems } from '../../store/boardActions.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore, type Tool } from '../../store/uiStore.ts';
import type { Drawing, DrawingTool, Vec2 } from '../../types/index.ts';
import { curveControl, hitDrawing, normDist } from './hit.ts';

export type Draft = Omit<Drawing, 'id'>;
const DRAG_TOOLS: Tool[] = ['line', 'arrow', 'curve-arrow', 'rect', 'circle'];
export const isDrawingTool = (tool: Tool) => tool !== 'select' && tool !== 'pan';

/**
 * Lógica de las herramientas de dibujo en coordenadas normalizadas.
 * La comparten la vista 2D y la 2.5D: cada vista solo convierte el puntero a 0–1.
 */
export function useToolController(aspect: number) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const erasing = useRef(false);
  const put = (d: Draft | null) => {
    draftRef.current = d;
    setDraft(d);
  };

  const erase = useCallback((p: Vec2) => {
    const { strategy, stepIndex } = useStrategyStore.getState();
    const hit = strategy.steps[stepIndex].drawings.filter((d) => !d.locked && hitDrawing(d, p, aspect)).map((d) => d.id);
    if (hit.length) removeItems(hit);
  }, [aspect]);

  const down = useCallback((raw: Vec2) => {
    const { tool, color, width } = useUiStore.getState();
    const p = roundVec(raw);
    if (tool === 'eraser') {
      erasing.current = true;
      erase(p);
    } else if (tool === 'ping') {
      addDrawing({ tool: 'ping', points: [p], color, width });
    } else if (tool === 'text') {
      const text = prompt('Texto de la nota:')?.trim();
      if (text) addDrawing({ tool: 'text', points: [p], color, width, text });
    } else if (tool === 'pen') {
      put({ tool: 'pen', points: [p], color, width });
    } else if (DRAG_TOOLS.includes(tool)) {
      put({ tool: tool as DrawingTool, points: [p, p], color, width });
    }
  }, [erase]);

  const move = useCallback((raw: Vec2) => {
    const p = roundVec(raw);
    if (erasing.current) return erase(p);
    const d = draftRef.current;
    if (!d) return;
    if (d.tool === 'pen') {
      if (normDist(d.points[d.points.length - 1], p, aspect) > 0.004) put({ ...d, points: [...d.points, p] });
    } else {
      put({ ...d, points: [d.points[0], p] });
    }
  }, [aspect, erase]);

  const up = useCallback(() => {
    erasing.current = false;
    const d = draftRef.current;
    if (!d) return;
    put(null);
    const [a, b] = [d.points[0], d.points[d.points.length - 1]];
    if (d.points.length < 2 || normDist(a, b, aspect) < 0.006) return;
    addDrawing(d.tool === 'curve-arrow' ? { ...d, points: [a, roundVec(curveControl(a, b, aspect)), b] } : d);
  }, [aspect]);

  return { draft, down, move, up };
}
