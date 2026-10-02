import { baseClasses, jobs } from '../../config/jobs.ts';
import { roleById } from '../../config/roles.ts';
import { addToken } from '../../store/boardActions.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { JOB_MIME } from './dnd.ts';
import { active, button, heading } from './ui.ts';

/** Paleta de jobs: se arrastran al mapa para crear tokens. */
export function JobsPanel() {
  const { newTokenTeam, setNewTokenTeam, setSelection, setTool } = useUiStore();
  return (
    <div className="space-y-3 p-3">
      <div>
        <h3 className={heading}>Equipo de los tokens nuevos</h3>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button className={`${button} ${newTokenTeam === 'ally' ? active : ''}`} onClick={() => setNewTokenTeam('ally')}>Aliado</button>
          <button className={`${button} ${newTokenTeam === 'enemy' ? active : ''}`} onClick={() => setNewTokenTeam('enemy')}>Enemigo</button>
        </div>
      </div>
      <p className="text-xs text-slate-500">Arrastra un job al mapa, o haz doble clic para ponerlo en el centro.</p>
      {baseClasses.map((base) => (
        <div key={base}>
          <h3 className={heading}>{base}</h3>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {jobs.filter((j) => j.baseClass === base).map((j) => (
              <div
                key={j.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData(JOB_MIME, j.id); e.dataTransfer.effectAllowed = 'copy'; }}
                onDoubleClick={() => { setTool('select'); setSelection([addToken(j.id, { x: 0.5, y: 0.5 })]); }}
                title={`${j.name} · ${roleById(j.role)?.name}`}
                className="flex cursor-grab items-center gap-2 rounded-md border border-slate-200 px-1.5 py-1 text-xs hover:bg-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: j.color }}>{j.abbr}</span>
                <span className="truncate">{j.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
