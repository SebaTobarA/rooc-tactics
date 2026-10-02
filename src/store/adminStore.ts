import { create } from 'zustand';
import { checkAccess } from '../lib/github.ts';

/**
 * Sesión de superadministrador. No hay servidor propio: la identidad es un token de GitHub con
 * permiso de escritura sobre el repositorio. Quien no lo tenga no puede publicar nada, aunque
 * manipule la página; ocultar los controles es solo comodidad, la protección real es de GitHub.
 */
interface AdminState {
  token: string | null;
  login: string | null;
  /** Inicia sesión con un token; lanza un error con el motivo si no sirve. */
  signIn(token: string): Promise<void>;
  signOut(): void;
}

const KEY = 'rooc-tactics:admin';

function load(): { token: string; login: string } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as { token: string; login: string } | null;
  } catch {
    return null;
  }
}

const saved = load();

export const useAdminStore = create<AdminState>((set) => ({
  token: saved?.token ?? null,
  login: saved?.login ?? null,
  signIn: async (token) => {
    const clean = token.trim();
    const login = await checkAccess(clean);
    // El token queda solo en este navegador.
    localStorage.setItem(KEY, JSON.stringify({ token: clean, login }));
    set({ token: clean, login });
  },
  signOut: () => {
    localStorage.removeItem(KEY);
    set({ token: null, login: null });
  },
}));

export const useIsAdmin = () => useAdminStore((s) => s.token !== null);
