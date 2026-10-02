import { useState } from 'react';
import { useCanPublish, useIsAdmin } from '../../store/adminStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useScoringStore } from '../../store/scoringStore.ts';
import { button } from '../board/ui.ts';
import { pendingChanges, publishMap } from './publish.ts';

/** Publica el borrador del mapa y los puntos por tier para toda la guild. Solo lo ve el superadministrador. */
export function PublishButton() {
  const admin = useIsAdmin();
  const canPublish = useCanPublish();
  // Suscripciones para recalcular si hay cambios pendientes.
  useMapStore((s) => s.map);
  useScoringStore((s) => s.overrides);
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; text?: string }>({ kind: 'idle' });
  if (!admin) return null;
  const pending = pendingChanges();
  const any = pending.map || pending.scoring;

  const run = async () => {
    if (!confirm('Esto publica el mapa y los puntos por tier para toda la guild. ¿Continuar?')) return;
    setState({ kind: 'busy' });
    try {
      await publishMap();
      setState({ kind: 'done', text: 'Publicado. El sitio se actualiza solo en uno o dos minutos; tu borrador se mantiene igual mientras tanto.' });
    } catch (e) {
      setState({ kind: 'error', text: e instanceof Error ? e.message : 'No se pudo publicar.' });
    }
  };

  if (!canPublish) {
    return (
      <p className="rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-700 dark:text-amber-200">
        {any ? 'Tienes cambios en borrador: solo se ven en este navegador. ' : 'Lo que edites queda como borrador en este navegador. '}
        Para guardarlos en el sistema para todos, agrega el token en <a className="underline" href="#/admin">administración</a>.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <button className={`${button} w-full bg-emerald-600 font-medium text-white hover:bg-emerald-500 dark:hover:bg-emerald-500`} disabled={!any || state.kind === 'busy'} onClick={() => void run()}>
        {state.kind === 'busy' ? 'Publicando…' : any ? 'Publicar para todos' : 'Sin cambios por publicar'}
      </button>
      {any && state.kind === 'idle' && (
        <p className="text-xs text-amber-600 dark:text-amber-300">Borrador sin publicar: {[pending.map && 'mapa', pending.scoring && 'puntos por tier'].filter(Boolean).join(' y ')}. Solo tú lo ves por ahora.</p>
      )}
      {state.text && <p className={`text-xs ${state.kind === 'error' ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`} role={state.kind === 'error' ? 'alert' : 'status'}>{state.text}</p>}
    </div>
  );
}
