import { lazy, Suspense, useEffect } from 'react';
import { maps } from '../../config/maps/index.ts';
import { modeById } from '../../config/modes/index.ts';
import { repository } from '../../data/StrategyRepository.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { lastStrategyId, newStrategy, useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { Timeline } from '../timeline/Timeline.tsx';
import { EditorPanel } from '../map-editor/EditorPanel.tsx';
import { BoardStage } from './BoardStage.tsx';
import { HelpDialog } from './HelpDialog.tsx';
import { Legend } from './Legend.tsx';
import { RightPanel } from './RightPanel.tsx';
import { Toolbar } from './Toolbar.tsx';
import { active, button } from './ui.ts';
import { useBoardShortcuts } from './useBoardShortcuts.ts';

// Three.js se carga solo al abrir la vista 2.5D.
const Scene3D = lazy(() => import('../map-render/three/Scene3D.tsx'));

export function BoardPage({ mapId }: { mapId: string }) {
  const map = useMapStore((s) => s.map);
  const loadMap = useMapStore((s) => s.load);
  const { strategy, past, future, undo, redo, checkpoint, set, open } = useStrategyStore();
  const editorActive = useEditorStore((s) => s.active);
  const setEditorActive = useEditorStore((s) => s.setActive);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  // El editor de mapa trabaja siempre en 2D.
  const show3d = viewMode === '3d' && !editorActive;
  useBoardShortcuts();

  useEffect(() => {
    loadMap(mapId);
    // Retoma la última estrategia de este mapa; si no hay, empieza una nueva.
    void (async () => {
      const last = lastStrategyId();
      const saved = last ? await repository.get(last) : null;
      if (saved?.mapId === mapId) open(saved);
      else if (useStrategyStore.getState().strategy.mapId !== mapId) open(newStrategy(maps[mapId]?.modeId ?? 'guild-league', mapId));
    })();
  }, [mapId, loadMap, open]);

  const change = (fn: Parameters<typeof set>[0]) => {
    checkpoint();
    set(fn);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-sm text-slate-500 dark:text-slate-400">{modeById(map.modeId)?.name} › {map.name}</span>
        <input
          className="mr-auto w-56 rounded border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-slate-300 focus:border-sky-500 focus:outline-none dark:hover:border-slate-700"
          value={strategy.name}
          aria-label="Nombre de la estrategia"
          onFocus={checkpoint}
          onChange={(e) => set((s) => ({ ...s, name: e.target.value }))}
        />
        <button className={button} disabled={!past.length || editorActive} onClick={undo} title="Deshacer (Ctrl+Z)">Deshacer</button>
        <button className={button} disabled={!future.length || editorActive} onClick={redo} title="Rehacer (Ctrl+Y)">Rehacer</button>
        <button className={button} onClick={() => change((s) => ({ ...s, allySide: s.allySide === 'green' ? 'red' : 'green' }))} title="Guild a la que pertenecen los tokens aliados">
          Mi guild: {strategy.allySide === 'green' ? 'Verde' : 'Roja'}
        </button>
        <div className="flex" title="Alterna entre la vista cenital y la isométrica; no cambia ningún dato">
          <button className={`${button} rounded-r-none ${!show3d ? active : ''}`} disabled={editorActive} onClick={() => setViewMode('2d')}>2D</button>
          <button className={`${button} rounded-l-none border-l-0 ${show3d ? active : ''}`} disabled={editorActive} onClick={() => setViewMode('3d')}>2.5D</button>
        </div>
        <button className={`${button} ${strategy.flipped ? active : ''}`} onClick={() => change((s) => ({ ...s, flipped: !s.flipped }))} title="Rota la vista 180°; no cambia los datos">
          Invertir lados
        </button>
        <button className={`${button} ${editorActive ? active : ''}`} onClick={() => setEditorActive(!editorActive)}>Editor de mapa</button>
      </div>
      <div className="flex min-h-0 flex-1">
        {!editorActive && <Toolbar />}
        <div className="relative min-w-0 flex-1">
          {show3d ? (
            <Suspense fallback={<p className="p-4 text-sm text-slate-400">Cargando la vista 2.5D…</p>}>
              <Scene3D />
            </Suspense>
          ) : (
            <BoardStage />
          )}
          {!editorActive && <Legend />}
        </div>
        {editorActive ? <EditorPanel /> : <RightPanel />}
      </div>
      {!editorActive && <Timeline />}
      <HelpDialog />
    </div>
  );
}
