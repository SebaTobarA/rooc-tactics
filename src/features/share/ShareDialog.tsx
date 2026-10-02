import { useEffect, useMemo, useState } from 'react';
import { mapSummary } from '../../config/maps/index.ts';
import { modeById } from '../../config/modes/index.ts';
import { repository, type StrategySummary } from '../../data/StrategyRepository.ts';
import { newId } from '../../lib/id.ts';
import { parseStrategy, shareUrl, URL_MAX_LENGTH, URL_WARN_LENGTH } from '../../lib/share.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { newStrategy, openAndSave, useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { button, heading } from '../board/ui.ts';
import { download } from '../map-editor/exportMap.ts';
import { exportPng } from './exportPng.ts';

/** Guardar y compartir: enlace, PNG, JSON y la lista de estrategias guardadas en este navegador. */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const strategy = useStrategyStore((s) => s.strategy);
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const viewMode = useUiStore((s) => s.viewMode);
  const fog = useMapStore((s) => s.map.style.cloud);
  const [saved, setSaved] = useState<StrategySummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const url = useMemo(() => shareUrl(strategy), [strategy]);
  const refresh = () => void repository.list().then(setSaved);
  useEffect(refresh, [strategy.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Enlace copiado.');
    } catch {
      setMessage('No se pudo copiar automáticamente: selecciona el enlace y cópialo a mano.');
    }
  };
  const exportJson = () => download(`${strategy.name || 'estrategia'}.json`, JSON.stringify(strategy, null, 2));
  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseStrategy(JSON.parse(await file.text()));
      if (!parsed) return setMessage('El archivo no es una estrategia válida de ROOC Tactics (o usa un mapa que esta versión no tiene).');
      await openAndSave({ ...parsed, id: newId('strategy') });
      setMessage(`"${parsed.name}" importada.`);
    } catch {
      setMessage('No se pudo leer el archivo JSON.');
    }
  };
  const open = async (id: string) => {
    const s = await repository.get(id);
    if (s) await openAndSave(s);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Guardar y compartir</h2>
          <button className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={onClose}>Cerrar</button>
        </div>
        {message && <p className="rounded bg-sky-500/15 px-2 py-1 text-sm" role="status">{message}</p>}

        <section className="space-y-2">
          <h3 className={heading}>Compartir por enlace</h3>
          <div className="flex gap-1">
            <input readOnly value={url} aria-label="Enlace para compartir" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded border border-slate-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-slate-700" />
            <button className={button} disabled={url.length > URL_MAX_LENGTH} onClick={copy}>Copiar</button>
          </div>
          <p className="text-xs text-slate-500">{url.length.toLocaleString('es')} caracteres. La estrategia completa va comprimida dentro del enlace; no se sube a ningún servidor.</p>
          <p className="text-xs text-slate-500">Para un enlace corto y estable (<code>#/p/nombre</code>), exporta el JSON y publícalo en la carpeta <code>public/strategies/</code> del proyecto; aparecerá en «Estrategias publicadas» del inicio.</p>
          {url.length > URL_MAX_LENGTH ? (
            <p className="text-sm text-red-600 dark:text-red-300" role="alert">El enlace quedó demasiado largo para funcionar de forma confiable. Usa «Exportar JSON» y comparte el archivo.</p>
          ) : url.length > URL_WARN_LENGTH ? (
            <p className="text-sm text-amber-600 dark:text-amber-300" role="alert">El enlace supera los {URL_WARN_LENGTH.toLocaleString('es')} caracteres: no cabe en un mensaje de Discord y algunas apps lo cortan. Si falla, exporta el JSON y comparte el archivo.</p>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className={heading}>Exportar e importar</h3>
          <div className="grid grid-cols-3 gap-1">
            <button className={button} onClick={async () => setMessage((await exportPng(strategy, strategy.steps[stepIndex], stepIndex, viewMode === '3d', fog)) ? 'PNG del paso actual descargado.' : 'No se pudo capturar el lienzo.')}>
              PNG del paso actual
            </button>
            <button className={button} onClick={exportJson}>Exportar JSON</button>
            <label className={`${button} cursor-pointer text-center`}>
              Importar JSON
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importJson(e.target.files?.[0])} />
            </label>
          </div>
          <p className="text-xs text-slate-500">El PNG captura la vista actual ({viewMode === '3d' ? '3D' : '2D'}) e incluye el nombre del paso, su nota y la leyenda de partys.</p>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className={heading}>Estrategias guardadas en este navegador</h3>
            <button className={button} onClick={() => void openAndSave(newStrategy(strategy.modeId, strategy.mapId))}>+ Nueva</button>
          </div>
          <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name || 'Sin título'}{s.id === strategy.id && <span className="ml-2 text-xs text-sky-500">abierta</span>}</p>
                  <p className="text-xs text-slate-500">{modeById(s.modeId)?.name} · {mapSummary(s.mapId).name} · {new Date(s.updatedAt).toLocaleString('es')}</p>
                </div>
                <button className={button} disabled={s.id === strategy.id} onClick={() => void open(s.id)}>Abrir</button>
                <button className={button} onClick={async () => { const full = await repository.get(s.id); if (full) { await repository.save({ ...full, id: newId('strategy'), name: `${full.name} (copia)`, updatedAt: new Date().toISOString() }); refresh(); } }}>Duplicar</button>
                <button className={button} disabled={s.id === strategy.id} onClick={async () => { if (confirm(`¿Eliminar "${s.name}"? No se puede deshacer.`)) { await repository.remove(s.id); refresh(); } }}>Eliminar</button>
              </li>
            ))}
            {!saved.length && <li className="py-2 text-slate-500">Aún no hay estrategias guardadas. Se guardan solas al editar.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
