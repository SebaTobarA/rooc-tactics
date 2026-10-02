import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { describeToken } from '../party/describeToken.ts';

/** Mensaje emergente al pasar el cursor por un token: quiénes van en esa party o raid, con su job. */
export function TokenTooltip() {
  const hover = useUiStore((s) => s.hover);
  const strategy = useStrategyStore((s) => s.strategy);
  const stepIndex = useStrategyStore((s) => s.stepIndex);
  const token = hover && strategy.steps[stepIndex].tokens.find((t) => t.id === hover.tokenId);
  if (!hover || !token) return null;
  const info = describeToken(token, strategy);
  const left = Math.min(hover.x + 16, window.innerWidth - 300);
  const top = Math.min(hover.y + 16, window.innerHeight - 60 - info.lines.length * 18);
  return (
    <div className="pointer-events-none fixed z-40 max-w-[18rem] rounded-lg border border-slate-600 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl" style={{ left, top: Math.max(8, top) }} role="tooltip">
      <p className="text-sm font-semibold">{info.title}</p>
      {info.subtitle && <p className="text-slate-400">{info.subtitle}</p>}
      {info.lines.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {info.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </div>
  );
}
