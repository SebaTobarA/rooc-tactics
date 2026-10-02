import { useEffect, useRef, useState } from 'react';
import { newId } from '../../lib/id.ts';
import { decodeStrategy } from '../../lib/share.ts';
import { openAndSave } from '../../store/strategyStore.ts';

/** Ruta `#/s/<datos>`: abre la estrategia del enlace como una copia local y va al tablero. */
export function SharedLink({ data }: { data: string }) {
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);
  useEffect(() => {
    // En desarrollo React ejecuta el efecto dos veces; sin esto se guardarían dos copias.
    if (handled.current) return;
    handled.current = true;
    const strategy = decodeStrategy(data);
    if (!strategy) return setFailed(true);
    void openAndSave({ ...strategy, id: newId('strategy') }).then(() => location.replace(`#/board/${strategy.mapId}`));
  }, [data]);

  return (
    <main className="mx-auto max-w-xl p-6">
      {failed ? (
        <>
          <h2 className="mb-2 text-xl font-semibold">No se pudo abrir el enlace</h2>
          <p className="mb-4 text-slate-500 dark:text-slate-400">El enlace está incompleto o dañado (algunas apps cortan los enlaces largos). Pide que te envíen el archivo <code>.json</code> y ábrelo con «Guardar y compartir → Importar JSON».</p>
          <a href="#/" className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500">Ir al inicio</a>
        </>
      ) : (
        <p className="text-slate-500">Abriendo la estrategia compartida…</p>
      )}
    </main>
  );
}
