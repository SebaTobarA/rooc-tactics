import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'board'; mapId: string } | { name: 'shared'; data: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 's' && parts[1]) return { name: 'shared', data: parts[1] };
  if (parts[0] === 'board' && parts[1]) return { name: 'board', mapId: parts[1] };
  return { name: 'home' };
}

/** Rutas por hash: funcionan en GitHub Pages sin configuración extra. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
