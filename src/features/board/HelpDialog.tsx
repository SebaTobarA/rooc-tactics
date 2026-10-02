import { useUiStore } from '../../store/uiStore.ts';
import { SHORTCUTS } from './tools.ts';

export function HelpDialog() {
  const { helpOpen, setHelpOpen } = useUiStore();
  if (!helpOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHelpOpen(false)}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atajos de teclado</h2>
          <button className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setHelpOpen(false)}>Cerrar</button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(([key, text]) => (
              <tr key={key} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{key}</td>
                <td className="py-1.5">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
