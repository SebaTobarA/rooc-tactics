import type { Tool } from '../../store/uiStore.ts';

export interface ToolDef {
  id: Tool;
  name: string;
  key: string;
  /** Path SVG en una caja de 24×24. */
  icon: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'select', name: 'Seleccionar y mover', key: 'V', icon: 'M5 3l14 8-6 2-2 6z' },
  { id: 'pan', name: 'Desplazar el mapa', key: 'H', icon: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3' },
  { id: 'pen', name: 'Lápiz libre', key: 'P', icon: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3' },
  { id: 'line', name: 'Línea', key: 'L', icon: 'M5 19L19 5' },
  { id: 'arrow', name: 'Flecha (ruta de movimiento)', key: 'A', icon: 'M5 19L19 5M19 5h-7M19 5v7' },
  { id: 'curve-arrow', name: 'Flecha de rotación (curva)', key: 'C', icon: 'M5 19C5 10 10 5 19 6M19 6l-5-3M19 6l-4 4' },
  { id: 'rect', name: 'Rectángulo (zona)', key: 'R', icon: 'M4 6h16v12H4z' },
  { id: 'circle', name: 'Círculo (zona)', key: 'O', icon: 'M12 4a8 8 0 100 16 8 8 0 000-16z' },
  { id: 'text', name: 'Texto / nota', key: 'T', icon: 'M5 6h14M12 6v13M9 19h6' },
  { id: 'ping', name: 'Ping / peligro', key: 'G', icon: 'M12 4l9 16H3zM12 10v5M12 17.5v.5' },
  { id: 'eraser', name: 'Borrador', key: 'E', icon: 'M4 16l9-9 6 6-6 6H8zM10 10l6 6M8 19h12' },
];

export const SHORTCUTS: [string, string][] = [
  ...TOOLS.map((t): [string, string] => [t.key, t.name]),
  ['Ctrl+Z', 'Deshacer'],
  ['Ctrl+Y / Ctrl+Shift+Z', 'Rehacer'],
  ['Supr / Retroceso', 'Eliminar la selección'],
  ['Ctrl+D', 'Duplicar la selección'],
  ['Ctrl+L', 'Bloquear o desbloquear la selección'],
  ['Ctrl+A', 'Seleccionar todo'],
  ['Shift+clic', 'Agregar o quitar de la selección'],
  ['Esc', 'Quitar la selección'],
  ['Rueda', 'Zoom'],
  ['Espacio + arrastrar / botón central', 'Desplazar el mapa'],
  ['?', 'Mostrar esta ayuda'],
];

export const COLORS = ['#f8fafc', '#111827', '#ef4444', '#f97316', '#facc15', '#34c759', '#38bdf8', '#a78bfa', '#f472b6'];
export const WIDTHS = [2, 4, 7];
