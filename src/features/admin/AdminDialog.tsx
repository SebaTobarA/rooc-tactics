import { useState } from 'react';
import { REPO } from '../../lib/github.ts';
import { useAdminStore } from '../../store/adminStore.ts';
import { button, input } from '../board/ui.ts';

/** Ingreso del superadministrador: el único que puede editar los mapas y publicarlos para todos. */
export function AdminDialog({ onClose }: { onClose: () => void }) {
  const { login, signIn, signOut } = useAdminStore();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(token);
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo comprobar el token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Superadministrador</h2>
          <button className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800" onClick={onClose}>Cerrar</button>
        </div>

        {login ? (
          <>
            <p className="rounded bg-emerald-500/15 px-3 py-2 text-sm" role="status">Sesión iniciada como <strong>{login}</strong>. Puedes editar el mapa y publicarlo para todos.</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>«Editor de mapa» y la pestaña «Objet.» te dejan mover pilares y plazas, definir tiers y cargar los puntos.</li>
              <li>Los cambios quedan como borrador en este navegador hasta que pulses «Publicar para todos».</li>
              <li>Al publicar, el sitio se actualiza solo en un par de minutos para toda la guild.</li>
            </ul>
            <button className={button} onClick={signOut}>Cerrar sesión en este navegador</button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Solo el superadministrador puede editar los mapas. Se ingresa con un token de acceso de GitHub que tenga permiso de escritura sobre <code>{REPO}</code>: quien no lo tenga no puede cambiar nada.
            </p>
            <details className="rounded border border-slate-200 p-2 text-sm dark:border-slate-700">
              <summary className="cursor-pointer font-medium">Cómo crear el token (una sola vez)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600 dark:text-slate-300">
                <li>En GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>
                <li>Repository access: «Only select repositories» → <code>rooc-tactics</code>.</li>
                <li>Permissions → Repository permissions → Contents: «Read and write».</li>
                <li>Elige un vencimiento, genera el token y pégalo aquí.</li>
              </ol>
            </details>
            {error && <p className="rounded bg-red-500/15 px-3 py-2 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p>}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <input type="password" className={`${input} min-w-0 flex-1`} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de GitHub" aria-label="Token de GitHub" autoComplete="off" />
              <button className={`${button} bg-sky-600 text-white hover:bg-sky-500 dark:hover:bg-sky-500`} type="submit" disabled={busy || !token.trim()}>{busy ? 'Comprobando…' : 'Ingresar'}</button>
            </form>
            <p className="text-xs text-slate-500">El token se guarda solo en este navegador y se envía únicamente a GitHub. No lo compartas ni lo pegues en equipos ajenos; puedes revocarlo en GitHub cuando quieras.</p>
          </>
        )}
      </div>
    </div>
  );
}
