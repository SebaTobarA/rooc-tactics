import { useEffect, useRef, useState } from 'react';
import { repository } from '../../data/StrategyRepository.ts';
import { parseStrategy } from '../../lib/share.ts';
import { openAndSave } from '../../store/strategyStore.ts';

/** Ruta corta `#/p/<nombre>`: abre una estrategia publicada como archivo en `public/strategies/`. */
export function PublishedLink({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void (async () => {
      try {
        if (!/^[a-z0-9-]+$/i.test(slug)) throw new Error('nombre inválido');
        const res = await fetch(`${import.meta.env.BASE_URL}strategies/${slug}.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`no existe (${res.status})`);
        const published = parseStrategy(await res.json());
        if (!published) throw new Error('el archivo no es una estrategia válida');
        // Cada visitante trabaja sobre su copia local; si ya la tiene y la editó, se le pregunta antes de pisarla.
        const id = `published-${slug}`;
        const local = await repository.get(id);
        const keepLocal = local && local.updatedAt !== published.updatedAt && !confirm(`Ya tienes una copia de "${published.name}" con cambios tuyos. ¿Reemplazarla por la versión publicada? (Cancelar abre tu copia.)`);
        await openAndSave(keepLocal ? local : { ...published, id });
        location.replace(`#/board/${published.mapId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'error desconocido');
      }
    })();
  }, [slug]);

  return (
    <main className="mx-auto max-w-xl p-6">
      {error ? (
        <>
          <h2 className="mb-2 text-xl font-semibold">No se pudo abrir «{slug}»</h2>
          <p className="mb-4 text-slate-500 dark:text-slate-400">La estrategia publicada no está disponible: {error}.</p>
          <a href="#/" className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500">Ir al inicio</a>
        </>
      ) : (
        <p className="text-slate-500">Abriendo la estrategia…</p>
      )}
    </main>
  );
}
