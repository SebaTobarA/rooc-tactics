import { useMemo, useState } from 'react';
import { useMapStore } from '../../store/mapStore.ts';
import { useStrategyStore } from '../../store/strategyStore.ts';
import { button, heading, input } from '../board/ui.ts';
import { applyPlan, buildPrompt, parsePlan } from './aiPlan.ts';

/**
 * Asistente con Claude sin API: se copia el encargo al chat de Claude (sirve el plan que ya tengas)
 * y se pega de vuelta su respuesta para crear raids, partys y pasos automáticamente.
 */
export function AiDialog({ onClose }: { onClose: () => void }) {
  const strategy = useStrategyStore((s) => s.strategy);
  const map = useMapStore((s) => s.map);
  const [request, setRequest] = useState('');
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string; warnings?: string[] } | null>(null);
  const prompt = useMemo(() => buildPrompt(request, strategy, map), [request, strategy, map]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage({ ok: true, text: 'Instrucciones copiadas. Pégalas en un chat de Claude y envíalas.' });
    } catch {
      setMessage({ ok: false, text: 'No se pudo copiar automáticamente: abre «Ver instrucciones», selecciónalas y cópialas a mano.' });
    }
  };

  const apply = (replace: boolean) => {
    const plan = parsePlan(reply);
    if (typeof plan === 'string') return setMessage({ ok: false, text: plan });
    if (replace && !confirm('Esto reemplaza todos los pasos actuales por los del plan (se puede deshacer con Ctrl+Z). ¿Continuar?')) return;
    const store = useStrategyStore.getState();
    const result = applyPlan(plan, store.strategy, map, replace);
    store.checkpoint();
    store.set(() => result.strategy);
    store.setStepIndex(result.firstStep);
    setMessage({ ok: true, text: `Listo: ${plan.steps.length} paso(s) ${replace ? 'reemplazaron los anteriores' : 'agregados al final'}. Revisa el tablero y usa «Reproducir».`, warnings: result.warnings });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Asistente con Claude</h2>
          <button className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={onClose}>Cerrar</button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Funciona con tu chat de Claude de siempre, sin costo extra: la web arma el encargo, tú lo pegas en Claude y pegas aquí su respuesta. Nada se envía automáticamente.
        </p>
        {message && (
          <div className={`rounded px-3 py-2 text-sm ${message.ok ? 'bg-emerald-500/15' : 'bg-red-500/15'}`} role={message.ok ? 'status' : 'alert'}>
            <p>{message.text}</p>
            {message.warnings?.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-700 dark:text-amber-200">
                {message.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            ) : null}
          </div>
        )}

        <section className="space-y-2">
          <h3 className={heading}>1 · Cuéntale qué quieres</h3>
          <textarea className={`${input} h-28`} value={request} onChange={(e) => setRequest(e.target.value)} aria-label="Qué quieres que proponga Claude"
            placeholder="Ej.: Jugamos con 3 raids. La primera call es ir todos al punto S. Cuando lo tomemos o lo perdamos, cada raid va a un pilar distinto (A o B). Sugiere cómo componer las partys de choque y de captura." />
          <div className="flex flex-wrap gap-2">
            <button className={`${button} bg-sky-600 text-white hover:bg-sky-500 dark:hover:bg-sky-500`} onClick={copy}>Copiar instrucciones para Claude</button>
            <a className={button} href="https://claude.ai/new" target="_blank" rel="noreferrer">Abrir Claude</a>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500">Ver instrucciones ({prompt.length.toLocaleString('es')} caracteres: incluyen el mapa, las reglas y tus raids y partys actuales)</summary>
            <textarea readOnly className={`${input} mt-1 h-40 font-mono text-xs`} value={prompt} aria-label="Instrucciones para Claude" onFocus={(e) => e.target.select()} />
          </details>
        </section>

        <section className="space-y-2">
          <h3 className={heading}>2 · Pega la respuesta de Claude</h3>
          <textarea className={`${input} h-36 font-mono text-xs`} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Respuesta de Claude"
            placeholder={'Pega aquí la respuesta completa (o solo el bloque ```json). Claude explica la estrategia en el chat y entrega el plan en ese bloque.'} />
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={!reply.trim()} onClick={() => apply(false)}>Agregar pasos al final</button>
            <button className={button} disabled={!reply.trim()} onClick={() => apply(true)}>Reemplazar los pasos actuales</button>
          </div>
          <p className="text-xs text-slate-500">Crea las raids, rellena slots vacíos de las partys y arma los pasos con fichas, flechas, zonas, textos y estado de los pilares. Para ajustar, sigue la conversación en Claude («mueve la raid 2 a zona 3») y vuelve a pegar.</p>
        </section>
      </div>
    </div>
  );
}
