import { modeById } from '../../config/modes/index.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { setObjective } from '../../store/boardActions.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useCurrentStep, useStrategyStore } from '../../store/strategyStore.ts';
import type { ObjectiveStatus } from '../../types/index.ts';
import { STATUS_LABELS } from '../map-render/konva/Markers.tsx';
import { input } from './ui.ts';

/** Estado de los pilares en el paso actual: tier, estado y temporizador. */
export function ObjectivesPanel() {
  const map = useMapStore((s) => s.map);
  const step = useCurrentStep();
  const modeId = useStrategyStore((s) => s.strategy.modeId);
  const tiers = modeById(modeId)?.scoring?.tiers ?? [];
  const pillars = map.markers.filter((m) => m.kind === 'central-pillar' || m.kind === 'pillar-slot');

  return (
    <div className="space-y-2 p-3">
      <p className="text-xs text-slate-500">El estado de los pilares se guarda por paso. Las ubicaciones se agregan o mueven con el editor de mapa.</p>
      {pillars.map((m) => {
        const o = step.objectives.find((x) => x.markerId === m.id);
        return (
          <div key={m.id} className="rounded-md border border-slate-200 p-2 dark:border-slate-800">
            <div className="mb-1 flex justify-between text-sm font-medium">
              <span>{m.label}</span>
              <span className="text-slate-500">zona {zoneOf(m.pos, map.numpad)}</span>
            </div>
            <div className="grid grid-cols-[1fr_4rem_4.5rem] gap-1">
              <select className={input} aria-label="Estado" value={o?.status ?? 'pending'} onChange={(e) => setObjective(m.id, { status: e.target.value as ObjectiveStatus })}>
                {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <select className={input} aria-label="Tier" value={o?.tier ?? ''} onChange={(e) => setObjective(m.id, { tier: e.target.value || undefined })}>
                <option value="">Tier</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
              </select>
              <input className={input} type="number" min={0} placeholder="seg" title="Temporizador en segundos (opcional)" aria-label="Temporizador en segundos"
                value={o?.timerSeconds ?? ''} onChange={(e) => setObjective(m.id, { timerSeconds: e.target.value === '' ? undefined : Math.max(0, e.target.valueAsNumber || 0) })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
