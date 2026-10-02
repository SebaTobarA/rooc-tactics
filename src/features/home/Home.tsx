import { useEffect, useState } from 'react';
import { mapSummary } from '../../config/maps/index.ts';
import { modes } from '../../config/modes/index.ts';

/** Pantalla inicial: elegir Modo → Mapa. Todo sale de la config. */
interface Published {
  slug: string;
  name: string;
  mapId: string;
  updatedAt: string;
}

export function Home() {
  const [published, setPublished] = useState<Published[]>([]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}strategies/index.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<Published[]>) : []))
      .then(setPublished)
      .catch(() => setPublished([]));
  }, []);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h2 className="mb-1 text-2xl font-semibold">Elige un modo y un mapa</h2>
      <p className="mb-6 text-slate-500 dark:text-slate-400">Planificador de estrategias para los eventos de guild de Ragnarok Origin Classic.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {modes.map((mode) => (
          <section key={mode.id} className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${mode.enabled ? '' : 'opacity-60'}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{mode.name}</h3>
              {!mode.enabled && <span className="rounded bg-slate-500/20 px-2 py-0.5 text-xs">Próximamente</span>}
            </div>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{mode.description}</p>
            <ul className="space-y-1">
              {mode.maps.map(mapSummary).map((m) =>
                m.enabled ? (
                  <li key={m.id}>
                    <a href={`#/board/${m.id}`} className="block rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500">{m.name}</a>
                  </li>
                ) : (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-slate-700">
                    {m.name}
                    <span className="text-xs">Próximamente</span>
                  </li>
                ),
              )}
              {mode.maps.length === 0 && <li className="text-sm text-slate-500">Mapas por agregar.</li>}
            </ul>
          </section>
        ))}
      </div>
      {published.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Estrategias publicadas</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {published.map((p) => (
              <li key={p.slug}>
                <a href={`#/p/${p.slug}`} className="block rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-sky-500 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-xs text-slate-500">{mapSummary(p.mapId).name} · {new Date(p.updatedAt).toLocaleDateString('es')} · enlace corto: #/p/{p.slug}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
