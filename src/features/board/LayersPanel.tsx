import { LAYERS, useUiStore } from '../../store/uiStore.ts';

export function LayersPanel() {
  const { layers, toggleLayer } = useUiStore();
  return (
    <div className="space-y-1 p-3">
      {LAYERS.map((l) => (
        <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-200 dark:hover:bg-slate-800">
          <input type="checkbox" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} />
          {l.name}
        </label>
      ))}
    </div>
  );
}
