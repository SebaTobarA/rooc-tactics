import { jobs } from '../../config/jobs.ts';
import { roles } from '../../config/roles.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { duplicateItems, patchDrawing, patchToken, removeItems, toggleLock } from '../../store/boardActions.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useCurrentStep, useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { RoleId, Token } from '../../types/index.ts';
import { COLORS } from './tools.ts';
import { button, heading, input } from './ui.ts';

/** Propiedades de lo seleccionado en el tablero (tokens y dibujos). */
export function SelectionInspector() {
  const selection = useUiStore((s) => s.selection);
  const step = useCurrentStep();
  const parties = useStrategyStore((s) => s.strategy.parties);
  const checkpoint = useStrategyStore((s) => s.checkpoint);
  const grid = useMapStore((s) => s.map.numpad);
  if (!selection.length) return null;

  const token = selection.length === 1 ? step.tokens.find((t) => t.id === selection[0]) : undefined;
  const drawing = selection.length === 1 ? step.drawings.find((d) => d.id === selection[0]) : undefined;
  const locked = [...step.tokens, ...step.drawings].filter((x) => selection.includes(x.id)).every((x) => x.locked);
  const edit = (patch: Partial<Token>) => {
    checkpoint();
    patchToken(token!.id, patch);
  };

  return (
    <div className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-800">
      <h3 className={heading}>Selección ({selection.length})</h3>
      {token && (
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-slate-500">Jugador</span>
          <input className={input} value={token.playerName ?? ''} placeholder="Nombre (opcional)" onFocus={checkpoint} onChange={(e) => patchToken(token.id, { playerName: e.target.value || undefined })} />
          <span className="text-slate-500">Job</span>
          <select className={input} value={token.jobId} onChange={(e) => edit({ jobId: e.target.value })}>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <span className="text-slate-500">Rol</span>
          <select className={input} value={token.role ?? ''} onChange={(e) => edit({ role: (e.target.value || undefined) as RoleId | undefined })}>
            <option value="">Sin rol</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <span className="text-slate-500">Party</span>
          <select className={input} value={token.partyId ?? ''} onChange={(e) => edit({ partyId: e.target.value || undefined })}>
            <option value="">Sin party</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}
          </select>
          <span className="text-slate-500">Equipo</span>
          <select className={input} value={token.team} onChange={(e) => edit({ team: e.target.value as Token['team'] })}>
            <option value="ally">Aliado</option>
            <option value="enemy">Enemigo</option>
          </select>
          <span className="text-slate-500">Zona</span>
          <span>{zoneOf(token.pos, grid)}</span>
        </div>
      )}
      {drawing && (
        <div className="space-y-2 text-sm">
          {drawing.tool === 'text' && (
            <input className={input} value={drawing.text ?? ''} onFocus={checkpoint} onChange={(e) => patchDrawing(drawing.id, { text: e.target.value })} />
          )}
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button key={c} aria-label={`Color ${c}`} onClick={() => { checkpoint(); patchDrawing(drawing.id, { color: c }); }}
                className={`h-5 w-5 rounded-full border ${drawing.color === c ? 'ring-2 ring-sky-400' : 'border-slate-400'}`} style={{ background: c }} />
            ))}
          </div>
          {drawing.points.length > 0 && <span className="text-slate-500">Zona {zoneOf(drawing.points[0], grid)}</span>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1">
        <button className={button} onClick={() => duplicateItems(selection)}>Duplicar</button>
        <button className={button} onClick={() => toggleLock(selection)}>{locked ? 'Desbloquear' : 'Bloquear'}</button>
        <button className={button} onClick={() => removeItems(selection)}>Eliminar</button>
      </div>
    </div>
  );
}
