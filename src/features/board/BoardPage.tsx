import { useEffect } from 'react';
import { modeById } from '../../config/modes/index.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { EditorPanel } from '../map-editor/EditorPanel.tsx';
import { BoardStage } from './BoardStage.tsx';

const chip = 'rounded-md border px-3 py-1.5 text-sm transition-colors';
const off = 'border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-800';
const on = 'border-sky-500 bg-sky-500/20';

export function BoardPage({ mapId }: { mapId: string }) {
  const map = useMapStore((s) => s.map);
  const load = useMapStore((s) => s.load);
  const { flipped, showGrid, toggleFlipped, toggleGrid } = useUiStore();
  const editorActive = useEditorStore((s) => s.active);
  const setEditorActive = useEditorStore((s) => s.setActive);
  useEffect(() => load(mapId), [mapId, load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-sm text-slate-500 dark:text-slate-400">{modeById(map.modeId)?.name} ›</span>
        <strong className="mr-auto">{map.name}</strong>
        <button className={`${chip} ${flipped ? on : off}`} onClick={toggleFlipped} title="Rota la vista 180°; no cambia los datos">
          Invertir lados · vista {flipped ? 'Roja' : 'Verde'}
        </button>
        <button className={`${chip} ${showGrid ? on : off}`} onClick={toggleGrid}>Grilla numpad</button>
        <button className={`${chip} ${editorActive ? on : off}`} onClick={() => setEditorActive(!editorActive)}>Editor de mapa</button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <BoardStage />
        </div>
        {editorActive && <EditorPanel />}
      </div>
    </div>
  );
}
