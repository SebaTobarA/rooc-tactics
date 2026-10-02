import { memo } from 'react';
import { Group, Line, Text } from 'react-konva';
import { zoneCenters, ZONE_KEYS } from '../../../lib/numpad.ts';
import type { Projection } from '../../../lib/projection.ts';
import type { NumpadGrid as Grid } from '../../../types/index.ts';

interface Props {
  grid: Grid;
  proj: Projection;
  color: string;
  /** Editor de mapa: las líneas se pueden arrastrar. */
  editable?: boolean;
  onMoveStart?: () => void;
  onMove?: (axis: 'cols' | 'rows', index: 0 | 1, value: number) => void;
}

/** Grilla 3×3 tipo pad numérico (convención de la guild). */
export const NumpadGrid = memo(function NumpadGrid({ grid, proj, color, editable, onMoveStart, onMove }: Props) {
  const line = (axis: 'cols' | 'rows', index: 0 | 1) => {
    const v = grid[axis][index];
    const a = proj.toWorld(axis === 'cols' ? { x: v, y: 0 } : { x: 0, y: v });
    const vertical = axis === 'cols';
    return (
      <Line
        key={`${axis}-${index}`}
        x={vertical ? a.x : 0}
        y={vertical ? 0 : a.y}
        points={vertical ? [0, 0, 0, proj.h] : [0, 0, proj.w, 0]}
        stroke={editable ? '#38bdf8' : color}
        strokeWidth={editable ? 2.5 : 1.5}
        opacity={editable ? 0.95 : 0.55}
        hitStrokeWidth={16}
        draggable={editable}
        dragBoundFunc={function (pos) {
          const abs = this.getAbsolutePosition();
          return vertical ? { x: pos.x, y: abs.y } : { x: abs.x, y: pos.y };
        }}
        onMouseDown={(e) => (e.cancelBubble = true)}
        onMouseEnter={(e) => editable && (e.target.getStage()!.container().style.cursor = vertical ? 'ew-resize' : 'ns-resize')}
        onMouseLeave={(e) => (e.target.getStage()!.container().style.cursor = '')}
        onDragStart={onMoveStart}
        onDragMove={(e) => {
          const n = proj.toNorm(e.target.position());
          onMove?.(axis, index, vertical ? n.x : n.y);
        }}
      />
    );
  };

  return (
    <Group listening={!!editable}>
      {line('cols', 0)}
      {line('cols', 1)}
      {line('rows', 0)}
      {line('rows', 1)}
      {zoneCenters(grid).map(({ zone, center }) => {
        const p = proj.toWorld(center);
        return (
          <Group key={zone} x={p.x} y={p.y} listening={false} opacity={0.5}>
            <Text text={String(zone)} fontSize={44} fontStyle="bold" fill={color} width={120} offsetX={60} offsetY={30} align="center" shadowColor="#000" shadowBlur={6} />
            <Text text={ZONE_KEYS[zone]} fontSize={14} fill={color} width={120} offsetX={60} offsetY={-16} align="center" shadowColor="#000" shadowBlur={4} />
          </Group>
        );
      })}
    </Group>
  );
});
