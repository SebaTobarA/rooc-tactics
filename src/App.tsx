import { maps } from './config/maps/index.ts';
import { AdminPage } from './features/admin/AdminPage.tsx';
import { useAdminStore, useIsAdmin } from './store/adminStore.ts';
import { ErrorBoundary } from './features/board/ErrorBoundary.tsx';
import { BoardPage } from './features/board/BoardPage.tsx';
import { Home } from './features/home/Home.tsx';
import { PublishedLink } from './features/share/PublishedLink.tsx';
import { SharedLink } from './features/share/SharedLink.tsx';
import { useHashRoute } from './lib/useHashRoute.ts';
import { useUiStore } from './store/uiStore.ts';

export function App() {
  const route = useHashRoute();
  const { theme, toggleTheme } = useUiStore();
  const adminLogin = useAdminStore((s) => s.login);
  const editing = useIsAdmin();
  const board = route.name === 'board' && maps[route.mapId] ? route : null;

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <a href="#/" className="text-lg font-semibold tracking-tight">ROOC Tactics</a>
        {/* Sin botón de administración: solo se muestra un aviso en el navegador donde ya se activó el modo edición. */}
        <span className="ml-auto" />
        {editing && <a href="#/admin" className="rounded-md border border-emerald-500 bg-emerald-500/15 px-3 py-1.5 text-sm">Modo edición{adminLogin ? ` · ${adminLogin}` : ''}</a>}
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-800" onClick={toggleTheme}>
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </header>
      <ErrorBoundary label="la página">
        {route.name === 'admin' ? <AdminPage /> : route.name === 'published' ? <PublishedLink slug={route.slug} /> : route.name === 'shared' ? <SharedLink data={route.data} /> : board ? <BoardPage mapId={board.mapId} /> : <Home />}
      </ErrorBoundary>
    </div>
  );
}
