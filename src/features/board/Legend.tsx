import { roles } from '../../config/roles.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { teamColor } from './konva/Tokens.tsx';

/** Leyenda fija: colores de guild y de roles. */
export function Legend() {
  const allySide = useStrategyStore((s) => s.strategy.allySide);
  const dot = (color: string, ring = false) => (
    <span className="inline-block h-2.5 w-2.5 rounded-full" style={ring ? { border: `3px solid ${color}` } : { background: color }} />
  );
  return (
    <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-200 shadow">
      <span className="flex items-center gap-1">{dot(teamColor('ally', allySide), true)} Aliados ({allySide === 'green' ? 'Verde' : 'Roja'})</span>
      <span className="flex items-center gap-1">{dot(teamColor('enemy', allySide), true)} Enemigos</span>
      {roles.map((r) => (
        <span key={r.id} className="flex items-center gap-1">{dot(r.color)} {r.name}</span>
      ))}
    </div>
  );
}
