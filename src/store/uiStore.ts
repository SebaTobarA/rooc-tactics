import { create } from 'zustand';
import type { Token, Vec2 } from '../types/index.ts';

export type Theme = 'dark' | 'light';
export type Tool = 'select' | 'pan' | 'pen' | 'line' | 'arrow' | 'curve-arrow' | 'rect' | 'circle' | 'text' | 'ping' | 'eraser';
export type LayerId = 'map' | 'grid' | 'objectives' | 'allies' | 'enemies' | 'drawings' | 'notes';
export type ViewMode = '2d' | '3d';

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'map', name: 'Mapa' },
  { id: 'grid', name: 'Grilla numpad' },
  { id: 'objectives', name: 'Objetivos' },
  { id: 'allies', name: 'Tokens aliados' },
  { id: 'enemies', name: 'Tokens enemigos' },
  { id: 'drawings', name: 'Dibujos' },
  { id: 'notes', name: 'Notas' },
];

interface UiState {
  theme: Theme;
  viewMode: ViewMode;
  tool: Tool;
  color: string;
  width: number;
  layers: Record<LayerId, boolean>;
  /** Ids de tokens y dibujos seleccionados. */
  selection: string[];
  newTokenTeam: Token['team'];
  helpOpen: boolean;
  /** Posición del cursor sobre el mapa (normalizada), para la barra de estado. */
  cursor: Vec2 | null;
  toggleTheme(): void;
  setViewMode(mode: ViewMode): void;
  setTool(tool: Tool): void;
  setColor(color: string): void;
  setWidth(width: number): void;
  toggleLayer(id: LayerId): void;
  setSelection(ids: string[]): void;
  setNewTokenTeam(team: Token['team']): void;
  setHelpOpen(open: boolean): void;
  setCursor(p: Vec2 | null): void;
}

const savedTheme = (localStorage.getItem('rooc-tactics:theme') as Theme | null) ?? 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

export const useUiStore = create<UiState>((set) => ({
  theme: savedTheme,
  viewMode: '2d',
  tool: 'select',
  color: '#f8fafc',
  width: 4,
  layers: { map: true, grid: true, objectives: true, allies: true, enemies: true, drawings: true, notes: true },
  selection: [],
  newTokenTeam: 'ally',
  helpOpen: false,
  cursor: null,
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('rooc-tactics:theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      return { theme };
    }),
  setViewMode: (viewMode) => set({ viewMode }),
  setTool: (tool) => set({ tool, selection: [] }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setSelection: (selection) => set({ selection }),
  setNewTokenTeam: (newTokenTeam) => set({ newTokenTeam }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setCursor: (cursor) => set({ cursor }),
}));
