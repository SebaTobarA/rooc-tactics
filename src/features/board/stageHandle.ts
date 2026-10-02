import type Konva from 'konva';

/** Referencia al Stage 2D activo, para exportar a PNG desde fuera del lienzo. */
export const stageHandle: { current: Konva.Stage | null } = { current: null };
