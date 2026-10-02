import { memo } from 'react';
import { Arrow, Circle, Group, Line, Rect, RegularPolygon, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Projection } from '../../../lib/projection.ts';
import type { Drawing, Vec2 } from '../../../types/index.ts';
import { curveControl } from '../hit.ts';
import type { Draft } from '../useToolController.ts';

/** Un dibujo en coordenadas de mundo. También dibuja el trazo en curso (sin id). */
export function DrawingShape({ d, proj, selected }: { d: Draft; proj: Projection; selected?: boolean }) {
  const pts = d.points.map(proj.toWorld);
  const flat = pts.flatMap((p) => [p.x, p.y]);
  const common = {
    stroke: d.color,
    strokeWidth: d.width,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    hitStrokeWidth: Math.max(14, d.width + 8),
    shadowColor: selected ? '#38bdf8' : '#000',
    shadowBlur: selected ? 12 : 3,
    shadowOpacity: selected ? 1 : 0.6,
  };
  switch (d.tool) {
    case 'pen':
      return <Line points={flat} tension={0.4} {...common} />;
    case 'line':
      return <Line points={flat} {...common} />;
    case 'arrow':
      return <Arrow points={flat} fill={d.color} pointerLength={d.width * 3} pointerWidth={d.width * 3} {...common} />;
    case 'curve-arrow': {
      // Mientras se arrastra solo hay 2 puntos; el control se calcula igual que al confirmar.
      const [a, b] = [d.points[0], d.points[d.points.length - 1]];
      const c = proj.toWorld(d.points.length === 3 ? d.points[1] : curveControl(a, b, proj.w / proj.h));
      const [wa, wb] = [proj.toWorld(a), proj.toWorld(b)];
      return <Arrow points={[wa.x, wa.y, c.x, c.y, wb.x, wb.y]} tension={0.5} fill={d.color} pointerLength={d.width * 3} pointerWidth={d.width * 3} {...common} />;
    }
    case 'rect': {
      const [a, b] = pts;
      return <Rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill={d.color + '22'} cornerRadius={4} {...common} />;
    }
    case 'circle': {
      const [c, e] = pts;
      return <Circle x={c.x} y={c.y} radius={Math.hypot(e.x - c.x, e.y - c.y)} fill={d.color + '22'} {...common} />;
    }
    case 'text':
      return (
        <Text x={pts[0].x} y={pts[0].y} text={d.text ?? ''} fontSize={10 + d.width * 2} fontStyle="bold" fill={d.color}
          shadowColor={selected ? '#38bdf8' : '#000'} shadowBlur={selected ? 10 : 4} shadowOpacity={1} />
      );
    case 'ping':
      return (
        <Group x={pts[0].x} y={pts[0].y}>
          <Circle radius={20} stroke={d.color} strokeWidth={2} opacity={0.7} dash={[5, 4]} />
          <RegularPolygon sides={3} radius={13} fill={d.color} stroke={selected ? '#38bdf8' : '#111827'} strokeWidth={2} lineJoin="round" />
          <Text text="!" fontSize={14} fontStyle="bold" fill="#111827" width={20} offsetX={10} offsetY={6} align="center" />
        </Group>
      );
  }
}

interface Props {
  drawings: Drawing[];
  proj: Projection;
  selection: string[];
  interactive: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onMoveStart: (id: string) => void;
  onMove: (id: string, delta: Vec2) => void;
}

export const Drawings = memo(function Drawings({ drawings, proj, selection, interactive, onSelect, onMoveStart, onMove }: Props) {
  const origin = proj.toNorm({ x: 0, y: 0 });
  return (
    <Group listening={interactive}>
      {drawings.map((d) => {
        const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => (e.cancelBubble = true);
        return (
          <Group
            key={d.id}
            draggable={interactive && !d.locked}
            opacity={d.locked ? 0.75 : 1}
            onMouseDown={(e) => { stop(e); onSelect(d.id, e.evt.shiftKey); }}
            onTouchStart={(e) => { stop(e); onSelect(d.id, false); }}
            onDragStart={() => onMoveStart(d.id)}
            onDragMove={(e) => {
              const n = proj.toNorm(e.target.position());
              e.target.position({ x: 0, y: 0 });
              onMove(d.id, { x: n.x - origin.x, y: n.y - origin.y });
            }}
          >
            <DrawingShape d={d} proj={proj} selected={selection.includes(d.id)} />
          </Group>
        );
      })}
    </Group>
  );
});
