import { maps } from './config/maps/index.ts';
import { ErrorBoundary } from './features/board/ErrorBoundary.tsx';
import { BoardPage } from './features/board/BoardPage.tsx';
import { Home } from './features/home/Home.tsx';
import { SharedLink } from './features/share/SharedLink.tsx';
import { useHashRoute } from './lib/useHashRoute.ts';
import { useUiStore } from './store/uiStore.ts';

export function App() {
  const route = useHashRoute();
  const { theme, toggleTheme } = useUiStore();
  const board = route.name === 'board' && maps[route.mapId] ? route : null;

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <a href="#/" className="text-lg font-semibold tracking-tight">ROOC Tactics</a>
        <button className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-800" onClick={toggleTheme}>
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </header>
      <ErrorBoundary label="la página">
        {route.name === 'shared' ? <SharedLink data={route.data} /> : board ? <BoardPage mapId={board.mapId} /> : <Home />}
      </ErrorBoundary>
    </div>
  );
}
