import { create } from 'zustand';
import { checkAccess } from '../lib/github.ts';

/**
 * Sesión de superadministrador. No hay servidor propio: la identidad es un token de GitHub con
 * permiso de escritura sobre el repositorio. Quien no lo tenga no puede publicar nada, aunque
 * manipule la página; ocultar los controles es solo comodidad, la protección real es de GitHub.
 */
interface AdminState {
  /** Modo edición activado en este navegador desde el enlace de administración (sin login). */
  editMode: boolean;
  token: string | null;
  login: string | null;
  setEditMode(on: boolean): void;
  /** Inicia sesión con un token; lanza un error con el motivo si no sirve. */
  signIn(token: string): Promise<void>;
  signOut(): void;
}

const KEY = 'rooc-tactics:admin';
const EDIT_KEY = 'rooc-tactics:edit-mode';

function load(): { token: string; login: string } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as { token: string; login: string } | null;
  } catch {
    return null;
  }
}

const saved = load();

export const useAdminStore = create<AdminState>((set) => ({
  editMode: localStorage.getItem(EDIT_KEY) === '1',
  setEditMode: (on) => {
    if (on) localStorage.setItem(EDIT_KEY, '1');
    else localStorage.removeItem(EDIT_KEY);
    set({ editMode: on });
  },
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

/** ¿Se puede editar el mapa en este navegador? (modo edición del enlace de administración, o sesión con token) */
export const useIsAdmin = () => useAdminStore((s) => s.editMode || s.token !== null);
/** ¿Se puede publicar para todos? Solo con el token. */
export const useCanPublish = () => useAdminStore((s) => s.token !== null);
