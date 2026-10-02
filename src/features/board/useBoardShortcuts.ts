import { useEffect } from 'react';
import { duplicateItems, removeItems, toggleLock } from '../../store/boardActions.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { goToStep } from '../timeline/timelineActions.ts';
import { TOOLS } from './tools.ts';

const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

/** Atajos de teclado del tablero. En el editor de mapa, Ctrl+Z deshace cambios del mapa. */
export function useBoardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const ui = useUiStore.getState();
      const strategy = useStrategyStore.getState();
      const editing = useEditorStore.getState().active;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (editing) useMapStore.getState().undo();
        else if (e.shiftKey) strategy.redo();
        else strategy.undo();
        return;
      }
      if (editing) return;
      if (mod && key === 'y') return e.preventDefault(), strategy.redo();
      if (mod && key === 'd') return e.preventDefault(), duplicateItems(ui.selection);
      if (mod && key === 'l') return e.preventDefault(), toggleLock(ui.selection);
      if (mod && key === 'a') {
        e.preventDefault();
        const step = strategy.strategy.steps[strategy.stepIndex];
        return ui.setSelection([...step.tokens, ...step.drawings].map((x) => x.id));
      }
      if (mod || e.altKey) return;
      if (e.key === 'Delete' || e.key === 'Backspace') return removeItems(ui.selection);
      if (e.key === 'Escape') return ui.helpOpen ? ui.setHelpOpen(false) : ui.setSelection([]);
      if (e.key === '[') return goToStep(strategy.stepIndex - 1);
      if (e.key === ']') return goToStep(strategy.stepIndex + 1);
      if (e.key === '?') return ui.setHelpOpen(!ui.helpOpen);
      const tool = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (tool) ui.setTool(tool.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
