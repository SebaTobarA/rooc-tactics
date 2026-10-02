declare const __BUILD_ID__: string;

const GUARD = 'rooc-tactics:updated-to';

/**
 * GitHub Pages deja la página en caché varios minutos, y una pestaña abierta sigue con el código
 * con que se cargó. Esto compara la versión en ejecución con la publicada y, si hay una nueva,
 * recarga saltándose la caché. Las estrategias se guardan solas, así que no se pierde trabajo.
 */
async function check(): Promise<void> {
  if (import.meta.env.DEV) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { id } = (await res.json()) as { id?: string };
    // Una sola recarga por versión: si aun así llega código antiguo, no se entra en un ciclo.
    if (!id || id === __BUILD_ID__ || sessionStorage.getItem(GUARD) === id) return;
    sessionStorage.setItem(GUARD, id);
    // El parámetro cambia la URL, así el navegador no reutiliza la página que tiene en caché.
    location.replace(`${location.pathname}?v=${id}${location.hash}`);
  } catch {
    // Sin conexión: se sigue con la versión actual.
  }
}

export function startAutoUpdate(): void {
  void check();
  window.addEventListener('hashchange', () => void check());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void check());
  setInterval(() => void check(), 5 * 60 * 1000);
}
