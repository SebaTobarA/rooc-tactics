import { memo } from 'react';
import { Circle, Group, Path, Star, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { zoneOf } from '../../../lib/numpad.ts';
import type { Projection } from '../../../lib/projection.ts';
import type { Marker, NumpadGrid, ObjectiveState, ObjectiveStatus, Side, Vec2 } from '../../../types/index.ts';

export const SIDE_COLORS: Record<Side, string> = { green: '#34c759', red: '#ef4444' };

const CROSS = 'M-4.5,-12h9v7.5h7.5v9h-7.5v7.5h-9v-7.5h-7.5v-9h7.5z';
const TOWER = 'M-6,8h12v-2.5h-2v-6h2.5v-5h-3v2.5h-2v-2.5h-3v2.5h-2v-2.5h-3v5h2.5v6h-2z';

export const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  pending: 'Por aparecer',
  active: 'Activo',
  destroyed: 'Destruido',
  'captured-green': 'Capturado por Verde',
  'captured-red': 'Capturado por Roja',
};

export const STATUS_COLORS: Record<ObjectiveStatus, string> = {
  pending: 'rgba(15,23,42,0.35)',
  active: '#f5b82e',
  destroyed: '#475569',
  'captured-green': SIDE_COLORS.green,
  'captured-red': SIDE_COLORS.red,
};

export const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Pilar (central o ubicación posible): el color indica el estado y la letra el tier. */
function PillarIcon({ central, objective }: { central: boolean; objective?: ObjectiveState }) {
  const status = objective?.status ?? 'pending';
  const r = central ? 15 : 11;
  return (
    <>
      <Circle radius={r} fill={STATUS_COLORS[status]} stroke={central ? '#7a5200' : '#f8fafc'} strokeWidth={2} dash={status === 'pending' ? [4, 3] : undefined} />
      {objective?.tier ? (
        <Text text={objective.tier} fontSize={central ? 16 : 13} fontStyle="bold" fill={status === 'pending' ? '#f8fafc' : '#111827'} width={30} offsetX={15} offsetY={central ? 8 : 6} align="center" />
      ) : central ? (
        <Star numPoints={8} innerRadius={5} outerRadius={11} fill="#fff4cf" stroke="#7a5200" strokeWidth={1} />
      ) : (
        <Circle radius={2.5} fill="#f8fafc" />
      )}
      {status === 'destroyed' && <Path data={`M${-r * 0.6},${-r * 0.6}L${r * 0.6},${r * 0.6}M${r * 0.6},${-r * 0.6}L${-r * 0.6},${r * 0.6}`} stroke="#f8fafc" strokeWidth={2.5} lineCap="round" />}
      {objective?.timerSeconds != null && (
        <Text text={formatTimer(objective.timerSeconds)} y={-r - 14} fontSize={11} fontStyle="bold" fill="#fde68a" width={60} offsetX={30} align="center" shadowColor="#000" shadowBlur={3} shadowOpacity={1} />
      )}
    </>
  );
}

/** Íconos propios (formas simples); no usan arte del juego. */
function MarkerIcon({ marker, objective }: { marker: Marker; objective?: ObjectiveState }) {
  switch (marker.kind) {
    case 'respawn':
      return <Path data={CROSS} fill={SIDE_COLORS[marker.side ?? 'green']} stroke="#fff" strokeWidth={2} lineJoin="round" />;
    case 'central-pillar':
    case 'pillar-slot':
      return <PillarIcon central={marker.kind === 'central-pillar'} objective={objective} />;
    case 'point-green':
      return (
        <>
          <Circle radius={11} fill="#a3d93a" stroke="#3f5c0b" strokeWidth={2} />
          <Star numPoints={4} innerRadius={2.5} outerRadius={8} fill="#3f5c0b" />
        </>
      );
    case 'point-purple':
      return (
        <>
          <Circle radius={12} fill="#a970e6" stroke="#fff" strokeWidth={1.5} />
          <Path data={TOWER} fill="#fff" scaleX={0.85} scaleY={0.85} />
        </>
      );
  }
}

interface Props {
  markers: Marker[];
  proj: Projection;
  grid: NumpadGrid;
  objectives?: ObjectiveState[];
  selectedId?: string;
  /** Editor de mapa: los marcadores se pueden seleccionar y arrastrar. */
  editable?: boolean;
  onSelect?: (id: string) => void;
  onMoveStart?: () => void;
  onMove?: (id: string, pos: Vec2) => void;
}

export const Markers = memo(function Markers({ markers, proj, grid, objectives, selectedId, editable, onSelect, onMoveStart, onMove }: Props) {
  return (
    <Group listening={!!editable}>
      {markers.map((m) => {
        const p = proj.toWorld(m.pos);
        const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => (e.cancelBubble = true);
        return (
          <Group
            key={m.id}
            x={p.x}
            y={p.y}
            draggable={editable}
            onMouseDown={stop}
            onTouchStart={stop}
            onClick={(e) => { stop(e); onSelect?.(m.id); }}
            onDragStart={() => { onSelect?.(m.id); onMoveStart?.(); }}
            onDragMove={(e) => onMove?.(m.id, proj.toNorm(e.target.position()))}
          >
            {selectedId === m.id && <Circle radius={20} stroke="#38bdf8" strokeWidth={2} dash={[5, 4]} />}
            <MarkerIcon marker={m} objective={objectives?.find((o) => o.markerId === m.id)} />
            <Text
              text={`${m.label}${m.confirmed ? '' : ' (?)'} · Z${zoneOf(m.pos, grid)}`}
              y={m.kind === 'central-pillar' ? 19 : 15}
              width={160}
              offsetX={80}
              align="center"
              fontSize={10}
              fontStyle="bold"
              fill="#fff"
              shadowColor="#000"
              shadowBlur={3}
              shadowOpacity={1}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
});
