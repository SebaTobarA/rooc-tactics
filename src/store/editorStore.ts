import { create } from 'zustand';
import type { MarkerKind, Vec2 } from '../types/index.ts';

export type PolyList = 'bounds' | 'walkable' | 'obstacles' | 'water' | 'decor';

export type Selection =
  | { type: 'marker'; id: string }
  | { type: 'polygon'; list: PolyList; id: string }
  | { type: 'plaza'; id: string }
  | null;

export type EditorTool = 'select' | 'add-marker' | 'draw-polygon' | 'add-plaza';

interface EditorState {
  active: boolean;
  tool: EditorTool;
  markerKind: MarkerKind;
  selection: Selection;
  /** Vértices del polígono que se está trazando. */
  draft: Vec2[];
  showReference: boolean;
  /** Opacidad del mapa propio mientras se muestra la foto de referencia. */
  mapOpacity: number;
  reference: HTMLImageElement | null;
  setActive(active: boolean): void;
  setTool(tool: EditorTool): void;
  setMarkerKind(kind: MarkerKind): void;
  select(selection: Selection): void;
  setDraft(draft: Vec2[]): void;
  setShowReference(show: boolean): void;
  setMapOpacity(opacity: number): void;
  setReference(img: HTMLImageElement | null): void;
}

export const useEditorStore = create<EditorState>((set) => ({
  active: false,
  tool: 'select',
  markerKind: 'pillar-slot',
  selection: null,
  draft: [],
  showReference: false,
  mapOpacity: 0.55,
  reference: null,
  setActive: (active) => set({ active, tool: 'select', selection: null, draft: [] }),
  setTool: (tool) => set({ tool, draft: [] }),
  setMarkerKind: (markerKind) => set({ markerKind }),
  select: (selection) => set({ selection }),
  setDraft: (draft) => set({ draft }),
  setShowReference: (showReference) => set({ showReference }),
  setMapOpacity: (mapOpacity) => set({ mapOpacity }),
  setReference: (reference) => set({ reference }),
}));
