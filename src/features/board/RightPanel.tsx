import { useState } from 'react';
import { PartiesPanel } from '../party/PartiesPanel.tsx';
import { RaidsPanel } from '../party/RaidsPanel.tsx';
import { ScorePanel } from '../score/ScorePanel.tsx';
import { JobsPanel } from './JobsPanel.tsx';
import { LayersPanel } from './LayersPanel.tsx';
import { ObjectivesPanel } from './ObjectivesPanel.tsx';
import { SelectionInspector } from './SelectionInspector.tsx';

const TABS = [
  { id: 'jobs', name: 'Jobs', render: () => <JobsPanel /> },
  { id: 'raids', name: 'Raids', render: () => <RaidsPanel /> },
  { id: 'parties', name: 'Partys', render: () => <PartiesPanel /> },
  { id: 'objectives', name: 'Objet.', render: () => <ObjectivesPanel /> },
  { id: 'score', name: 'Puntos', render: () => <ScorePanel /> },
  { id: 'layers', name: 'Capas', render: () => <LayersPanel /> },
] as const;

/** Panel derecho con pestañas. */
export function RightPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('jobs');
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex border-b border-slate-200 text-sm dark:border-slate-800">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-0.5 py-2 text-xs ${tab === t.id ? 'border-b-2 border-sky-500 font-semibold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SelectionInspector />
        {TABS.find((t) => t.id === tab)!.render()}
      </div>
    </aside>
  );
}
