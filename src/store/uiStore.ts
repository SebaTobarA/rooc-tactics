import { create } from 'zustand';
import type { Vec2 } from '../types/index.ts';

export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  flipped: boolean;
  showGrid: boolean;
  /** Posición del cursor sobre el mapa (normalizada), para la barra de estado. */
  cursor: Vec2 | null;
  toggleTheme(): void;
  toggleFlipped(): void;
  toggleGrid(): void;
  setCursor(p: Vec2 | null): void;
}

const savedTheme = (localStorage.getItem('rooc-tactics:theme') as Theme | null) ?? 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

export const useUiStore = create<UiState>((set) => ({
  theme: savedTheme,
  flipped: false,
  showGrid: true,
  cursor: null,
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('rooc-tactics:theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      return { theme };
    }),
  toggleFlipped: () => set((s) => ({ flipped: !s.flipped })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setCursor: (cursor) => set({ cursor }),
}));
