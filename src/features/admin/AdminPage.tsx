import { useEffect, useState } from 'react';
import { maps } from '../../config/maps/index.ts';
import { REPO } from '../../lib/github.ts';
import { useAdminStore } from '../../store/adminStore.ts';
import { button, input } from '../board/ui.ts';

/** Bloque de sesión con token: lo que permite publicar para todos. */
export function TokenSession() {
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

  if (login) {
    return (
      <div className="space-y-2">
        <p className="rounded bg-emerald-500/15 px-3 py-2 text-sm" role="status">Token activo de <strong>{login}</strong>: «Publicar para todos» guarda tus cambios en el sistema.</p>
        <button className={button} onClick={signOut}>Quitar el token de este navegador</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Para que tus cambios queden guardados para toda la guild hace falta un token de GitHub con permiso de escritura sobre <code>{REPO}</code>. Sin él, lo que edites queda como borrador en este navegador.
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
        <button className={`${button} bg-sky-600 text-white hover:bg-sky-500 dark:hover:bg-sky-500`} type="submit" disabled={busy || !token.trim()}>{busy ? 'Comprobando…' : 'Guardar token'}</button>
      </form>
      <p className="text-xs text-slate-500">El token se guarda solo en este navegador y se envía únicamente a GitHub. Puedes revocarlo en GitHub cuando quieras.</p>
    </div>
  );
}

/**
 * Página de administración. No tiene botón ni enlace en el sitio: se entra escribiendo la dirección.
 * Al abrirla, este navegador queda en modo edición del mapa.
 */
export function AdminPage() {
  const { editMode, setEditMode } = useAdminStore();
  useEffect(() => setEditMode(true), [setEditMode]);
  const first = Object.values(maps)[0];
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h2 className="text-2xl font-semibold">Administración</h2>
        <p className="text-slate-500 dark:text-slate-400">Esta página no aparece en ningún menú. Guarda su dirección: es la forma de activar la edición del mapa en un navegador.</p>
      </div>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold">1 · Editar el mapa</h3>
        <p className="rounded bg-emerald-500/15 px-3 py-2 text-sm" role="status">
          {editMode ? 'Modo edición activado en este navegador. En el tablero ya aparecen «Editor de mapa» y los controles de pilares en la pestaña Objet.' : 'Modo edición desactivado.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <a className={`${button} bg-emerald-600 text-white hover:bg-emerald-500 dark:hover:bg-emerald-500`} href={`#/board/${first.id}`}>Ir a editar {first.name}</a>
          <button className={button} onClick={() => setEditMode(!editMode)}>{editMode ? 'Desactivar el modo edición aquí' : 'Activar el modo edición'}</button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold">2 · Publicar para todos</h3>
        <TokenSession />
      </section>
    </main>
  );
}
