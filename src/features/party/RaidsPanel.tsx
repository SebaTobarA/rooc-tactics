import { useState } from 'react';
import { modeById } from '../../config/modes/index.ts';
import { RAID_MIME } from '../board/dnd.ts';
import { button, heading, input } from '../board/ui.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { Raid } from '../../types/index.ts';
import {
  addRaid, applyFormation, mergeRaid, partyMembers, placeGroupToken, raidOf, raidPlayerCount, removeRaid, renameRaid, setPartyRaid, spawnPosition, splitRaid,
} from './groupActions.ts';

function RaidCard({ raid, index, onError }: { raid: Raid; index: number; onError: (msg: string | null) => void }) {
  const { parties, raids, allySide, modeId } = useStrategyStore((s) => s.strategy);
  const checkpoint = useStrategyStore((s) => s.checkpoint);
  const respawn = useMapStore((s) => s.map.markers.find((m) => m.kind === 'respawn' && m.side === allySide)?.pos);
  const { setSelection, setTool } = useUiStore();
  const max = modeById(modeId)?.raidMaxParties ?? 8;
  const mine = raid.partyIds.map((id) => parties.find((p) => p.id === id)).filter((p) => !!p);
  const loose = parties.filter((p) => !raidOf(raids, p.id));
  const spawn = spawnPosition(respawn, index * 2);
  const show = (ids: string[]) => {
    if (!ids.length) return;
    setTool('select');
    setSelection(ids);
  };

  return (
    <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex items-center gap-1.5">
        <span
          draggable
          onDragStart={(e) => { e.dataTransfer.setData(RAID_MIME, raid.id); e.dataTransfer.effectAllowed = 'copy'; }}
          title="Arrastra al mapa: la raid completa queda como una sola ficha"
          className="flex h-8 w-9 shrink-0 cursor-grab items-center justify-center bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900"
          style={{ clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' }}
        >
          R{raid.number}
        </span>
        <input className={`${input} min-w-0 flex-1 font-medium`} value={raid.name} aria-label="Nombre de la raid" onFocus={checkpoint} onChange={(e) => renameRaid(raid.id, e.target.value)} />
        <button className="px-1 text-slate-400 hover:text-red-500" title="Eliminar raid (las partys quedan sueltas)" aria-label="Eliminar raid" onClick={() => removeRaid(raid.id)}>×</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">{mine.length}/{max} partys · {raidPlayerCount(raid, parties)} jugadores</p>

      <ul className="mt-1 space-y-1">
        {mine.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded bg-slate-200/70 px-2 py-1 text-xs dark:bg-slate-800/70">
            <span className="font-bold">P{p.number}</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="tabular-nums text-slate-500">{partyMembers(p).length}/{p.slots.length}</span>
            <button className="text-slate-400 hover:text-red-500" title="Sacar de la raid" aria-label={`Sacar ${p.name} de la raid`} onClick={() => onError(setPartyRaid(p.id, null))}>×</button>
          </li>
        ))}
      </ul>
      {mine.length < max && loose.length > 0 && (
        <select className={`${input} mt-1 text-xs`} value="" aria-label="Agregar party a la raid" onChange={(e) => e.target.value && onError(setPartyRaid(e.target.value, raid.id))}>
          <option value="">Agregar party suelta…</option>
          {loose.map((p) => <option key={p.id} value={p.id}>P{p.number} · {p.name}</option>)}
        </select>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1">
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData(RAID_MIME, raid.id); e.dataTransfer.effectAllowed = 'copy'; }}
          className="cursor-grab rounded border border-dashed border-sky-500 px-2 py-1 text-center text-xs text-sky-600 dark:text-sky-300"
        >
          ⠿ Arrastrar al mapa
        </div>
        <button className={`${button} text-xs`} title="Pone la ficha de la raid junto al respawn de mi guild" onClick={() => show(placeGroupToken('raid', raid.id, spawn))}>Colocar en el mapa</button>
        <button className={`${button} text-xs`} disabled={!mine.length} title="En este paso, cada party de la raid pasa a tener su propia ficha" onClick={() => show(splitRaid(raid.id, spawn))}>Separar en partys</button>
        <button className={`${button} text-xs`} title="En este paso, la raid vuelve a moverse como una sola ficha" onClick={() => show(mergeRaid(raid.id, spawn))}>Juntar la raid</button>
      </div>
    </section>
  );
}

/** Raids: grupos de partys que se mueven con una sola ficha, o separadas por party según el paso. */
export function RaidsPanel() {
  const { raids, parties, modeId } = useStrategyStore((s) => s.strategy);
  const mode = modeById(modeId);
  const [preset, setPreset] = useState('');
  const [error, setError] = useState<string | null>(null);
  const loose = parties.filter((p) => !raidOf(raids, p.id));
  const presets = mode?.raidPresets ?? [];

  return (
    <div className="space-y-3 p-3">
      {error && <p className="rounded bg-red-500/20 px-2 py-1 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p>}
      <p className="text-xs text-slate-500">
        Una raid junta hasta {mode?.raidMaxParties ?? 8} partys de {mode?.partySize ?? 5}. En cada paso decides cómo se mueve: unida (una ficha hexagonal) o separada en partys (una ficha por party).
        Pasa el cursor sobre una ficha en el mapa para ver quiénes van.
      </p>

      <section className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
        <h3 className={heading}>Formación</h3>
        <div className="mt-1 flex gap-1">
          <select className={`${input} text-xs`} value={preset} aria-label="Formación de raids" onChange={(e) => setPreset(e.target.value)}>
            <option value="">Elegir formación…</option>
            {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button className={`${button} shrink-0 text-xs`} disabled={!preset} onClick={() => {
            const found = presets.find((p) => p.name === preset);
            if (found && (!raids.length || confirm('Esto reemplaza las raids actuales (los jugadores y las partys se conservan). ¿Continuar?'))) applyFormation(found.raids);
          }}>
            Aplicar
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Crea las raids y las partys que falten, y reparte las partys en orden. Después puedes moverlas entre raids a mano.</p>
      </section>

      {raids.map((r, i) => <RaidCard key={r.id} raid={r} index={i} onError={setError} />)}
      <button className={`${button} w-full`} onClick={addRaid}>+ Agregar raid</button>

      <p className="text-xs text-slate-500">
        {loose.length ? `Partys sueltas (sin raid): ${loose.map((p) => `P${p.number}`).join(', ')}.` : 'Todas las partys están en una raid.'} Los jugadores de cada party se editan en la pestaña Partys.
      </p>
    </div>
  );
}
