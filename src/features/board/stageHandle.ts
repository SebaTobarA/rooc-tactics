import type Konva from 'konva';

/** Acceso a los lienzos activos (2D y 3D) para exportar a PNG desde fuera. */
export const stageHandle: { current: Konva.Stage | null; canvas3d: (() => HTMLCanvasElement | null) | null } = { current: null, canvas3d: null };
