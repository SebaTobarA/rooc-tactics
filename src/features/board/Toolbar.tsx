import { useUiStore } from '../../store/uiStore.ts';
import { COLORS, TOOLS, WIDTHS } from './tools.ts';

/** Barra de herramientas izquierda: herramientas, color y grosor. */
export function Toolbar() {
  const { tool, color, width, setTool, setColor, setWidth, setHelpOpen } = useUiStore();
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-slate-200 py-2 dark:border-slate-800">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.name} (${t.key})`}
          aria-label={t.name}
          onClick={() => setTool(t.id)}
          className={`flex h-9 w-9 items-center justify-center rounded-md ${tool === t.id ? 'bg-sky-500 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={t.icon} />
          </svg>
        </button>
      ))}
      <div className="my-1 h-px w-8 bg-slate-300 dark:bg-slate-700" />
      <div className="grid grid-cols-2 gap-1">
        {COLORS.map((c) => (
          <button key={c} title={`Color ${c}`} aria-label={`Color ${c}`} onClick={() => setColor(c)}
            className={`h-4 w-4 rounded-full border ${color === c ? 'ring-2 ring-sky-400' : 'border-slate-400'}`} style={{ background: c }} />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Otro color" className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0" />
      </div>
      <div className="my-1 h-px w-8 bg-slate-300 dark:bg-slate-700" />
      {WIDTHS.map((w) => (
        <button key={w} title={`Grosor ${w}`} aria-label={`Grosor ${w}`} onClick={() => setWidth(w)}
          className={`flex h-6 w-9 items-center justify-center rounded ${width === w ? 'bg-sky-500/30' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
          <span className="block w-6 rounded-full bg-current" style={{ height: w }} />
        </button>
      ))}
      <button title="Atajos de teclado (?)" onClick={() => setHelpOpen(true)} className="mt-auto h-8 w-8 rounded-full border border-slate-300 text-sm font-bold hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-800">?</button>
    </div>
  );
}
