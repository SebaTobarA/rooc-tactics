import { useState, type DragEvent } from 'react';
import { jobById, jobs } from '../../config/jobs.ts';
import { modeById } from '../../config/modes/index.ts';
import { roleById, roles } from '../../config/roles.ts';
import { PARTY_MIME, PLAYER_MIME } from '../board/dnd.ts';
import { button, heading, input } from '../board/ui.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import type { Party, Player, RoleId } from '../../types/index.ts';
import {
  addParty, addPlayer, applyTemplate, assignPlayer, deleteTemplate, importPlayers, listTemplates, partyOf, patchPlayer,
  removeParty, removePlayer, renameParty, saveTemplate, summarize, unassignPlayer, type ImportResult,
} from './partyActions.ts';

const dragPlayer = (id: string) => (e: DragEvent) => {
  e.stopPropagation();
  e.dataTransfer.setData(PLAYER_MIME, id);
  e.dataTransfer.effectAllowed = 'move';
};
const allowPlayer = (e: DragEvent) => e.dataTransfer.types.includes(PLAYER_MIME) && e.preventDefault();

function JobBadge({ jobId }: { jobId: string }) {
  const job = jobById(jobId);
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: job?.color ?? '#475569' }}>{job?.abbr ?? '?'}</span>;
}

/** Fila editable de un jugador (en la banca o en un slot). Se arrastra a un slot, a la banca o al mapa. */
function PlayerRow({ player, compact }: { player: Player; compact?: boolean }) {
  const checkpoint = useStrategyStore((s) => s.checkpoint);
  return (
    <div draggable onDragStart={dragPlayer(player.id)} className="cursor-grab rounded-md border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">
        <JobBadge jobId={player.jobId} />
        <input className={`${input} min-w-0 flex-1 py-0.5`} value={player.name} aria-label="Nombre del jugador" onFocus={checkpoint} onChange={(e) => patchPlayer(player.id, { name: e.target.value })} />
        <button className="px-1 text-slate-400 hover:text-red-500" title="Eliminar jugador" aria-label="Eliminar jugador" onClick={() => removePlayer(player.id)}>×</button>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <select className={`${input} py-0.5 text-xs`} value={player.jobId} aria-label="Job" onChange={(e) => { checkpoint(); patchPlayer(player.id, { jobId: e.target.value }); }}>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
        <select className={`${input} py-0.5 text-xs`} value={player.role ?? ''} aria-label="Rol" onChange={(e) => { checkpoint(); patchPlayer(player.id, { role: (e.target.value || undefined) as RoleId | undefined }); }}>
          <option value="">Sin rol</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      {!compact && (
        <input className={`${input} mt-1 py-0.5 text-xs`} value={player.note ?? ''} placeholder="Nota" aria-label="Nota" onFocus={checkpoint} onChange={(e) => patchPlayer(player.id, { note: e.target.value || undefined })} />
      )}
    </div>
  );
}

function PartyCard({ party, roster, onError }: { party: Party; roster: Player[]; onError: (msg: string | null) => void }) {
  const checkpoint = useStrategyStore((s) => s.checkpoint);
  const [templates, setTemplates] = useState(listTemplates);
  const summary = summarize(party, roster);
  const drop = (slot?: number) => (e: DragEvent) => {
    const id = e.dataTransfer.getData(PLAYER_MIME);
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    onError(assignPlayer(id, party.id, slot));
  };

  return (
    <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800" onDragOver={allowPlayer} onDrop={drop()}>
      <div className="flex items-center gap-1.5">
        <span
          draggable
          onDragStart={(e) => { e.dataTransfer.setData(PARTY_MIME, party.id); e.dataTransfer.effectAllowed = 'copy'; }}
          title="Arrastra al mapa para colocar la party completa"
          className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white ring-2 ring-white dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-900"
        >
          {party.number}
        </span>
        <input className={`${input} min-w-0 flex-1 font-medium`} value={party.name} aria-label="Nombre de la party" onFocus={checkpoint} onChange={(e) => renameParty(party.id, e.target.value)} />
        <span className="text-xs tabular-nums text-slate-500">{summary.size}/{party.slots.length}</span>
        <button className="px-1 text-slate-400 hover:text-red-500" title="Eliminar party" aria-label="Eliminar party" onClick={() => removeParty(party.id)}>×</button>
      </div>

      <div className="mt-2 space-y-1">
        {party.slots.map((id, i) => {
          const player = roster.find((p) => p.id === id);
          return (
            <div key={i} onDragOver={allowPlayer} onDrop={drop(i)}>
              {player ? <PlayerRow player={player} /> : <div className="rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500 dark:border-slate-700">Slot {i + 1} · vacío</div>}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {roles.filter((r) => summary.counts[r.id]).map((r) => (
          <span key={r.id} className="rounded px-1.5 py-0.5 text-slate-900" style={{ background: r.color }}>{r.short} {summary.counts[r.id]}</span>
        ))}
        {summary.warnings.map((w) => <span key={w} className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-600 dark:text-amber-300">⚠ {w}</span>)}
      </div>

      <div className="mt-2 flex gap-1">
        <select className={`${input} text-xs`} value="" aria-label="Aplicar plantilla"
          onChange={(e) => { const tpl = templates.find((t) => t.id === e.target.value); if (tpl) applyTemplate(party.id, tpl); }}>
          <option value="">Aplicar plantilla…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.builtin ? ' (ejemplo)' : ''}</option>)}
        </select>
        <button className={`${button} shrink-0 text-xs`} disabled={!summary.size} title="Guardar esta composición (jobs y roles) como plantilla"
          onClick={() => { const name = prompt('Nombre de la plantilla:', party.name)?.trim(); if (name) { saveTemplate(name, party, roster); setTemplates(listTemplates()); } }}>
          Guardar
        </button>
      </div>
      {templates.some((t) => !t.builtin) && (
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
          {templates.filter((t) => !t.builtin).map((t) => (
            <button key={t.id} className="hover:text-red-500" title="Eliminar plantilla" onClick={() => { deleteTemplate(t.id); setTemplates(listTemplates()); }}>{t.name} ×</button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Composición de partys: banca, partys de tamaño fijo, importación y plantillas. */
export function PartiesPanel() {
  const { roster, parties, modeId } = useStrategyStore((s) => s.strategy);
  const mode = modeById(modeId);
  const [name, setName] = useState('');
  const [jobId, setJobId] = useState(jobs[0].id);
  const [importText, setImportText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bench = roster.filter((p) => !partyOf(parties, p.id));

  return (
    <div className="space-y-3 p-3">
      {error && <p className="rounded bg-red-500/20 px-2 py-1 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p>}
      <p className="text-xs text-slate-500">
        Arrastra jugadores entre la banca, los slots y el mapa. Arrastra el número de una party al mapa para colocar sus tokens agrupados.
        Máximo {mode?.partySize ?? 5} por party{mode?.maxSameJobPerTeam ? ` y ${mode.maxSameJobPerTeam} del mismo job por equipo` : ''}.
      </p>

      {parties.map((p) => <PartyCard key={p.id} party={p} roster={roster} onError={setError} />)}
      <button className={`${button} w-full`} onClick={addParty}>+ Agregar party</button>

      <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800" onDragOver={allowPlayer}
        onDrop={(e) => { const id = e.dataTransfer.getData(PLAYER_MIME); if (id) { e.preventDefault(); unassignPlayer(id); setError(null); } }}>
        <h3 className={heading}>Banca ({bench.length})</h3>
        <div className="mt-2 space-y-1">
          {bench.map((p) => <PlayerRow key={p.id} player={p} compact />)}
          {!bench.length && <p className="text-xs text-slate-500">Sin jugadores en la banca. Suelta aquí un jugador para sacarlo de su party.</p>}
        </div>
        <form className="mt-2 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { addPlayer(name, jobId); setName(''); } }}>
          <input className={`${input} min-w-0 flex-1`} value={name} placeholder="Nombre" aria-label="Nombre del jugador nuevo" onChange={(e) => setName(e.target.value)} />
          <select className={`${input} w-28`} value={jobId} aria-label="Job del jugador nuevo" onChange={(e) => setJobId(e.target.value)}>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <button className={button} type="submit">+</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
        <h3 className={heading}>Importar jugadores</h3>
        <textarea className={`${input} mt-2 h-24 font-mono text-xs`} value={importText} onChange={(e) => setImportText(e.target.value)} aria-label="Lista de jugadores"
          placeholder={'Una línea por jugador:\nSeba;High Priest\nKira;Sniper\n\nO un JSON: [{"name":"Seba","job":"High Priest"}]'} />
        <button className={`${button} mt-1 w-full`} disabled={!importText.trim()} onClick={() => { const r = importPlayers(importText); setResult(r); if (!r.errors.length) setImportText(''); }}>
          Importar a la banca
        </button>
        {result && (
          <div className="mt-1 text-xs">
            <p className="text-emerald-600 dark:text-emerald-400">{result.added} jugador(es) importado(s).</p>
            {result.errors.map((e) => <p key={e} className="text-red-600 dark:text-red-300">{e}</p>)}
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500">Rol de cada jugador: {roles.map((r) => roleById(r.id)!.short + ' = ' + r.name).join(', ')}.</p>
    </div>
  );
}
