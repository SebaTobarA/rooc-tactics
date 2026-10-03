import { memo } from 'react';
import { Circle, Group, Path, Star, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { tierRank } from '../../../config/modes/index.ts';
import { resolvedStats, useScoringStore } from '../../../store/scoringStore.ts';
import { useStrategyStore } from '../../../store/strategyStore.ts';
import { zoneOf } from '../../../lib/numpad.ts';
import type { Projection } from '../../../lib/projection.ts';
import type { Marker, NumpadGrid, ObjectiveState, ObjectiveStatus, Side, Vec2 } from '../../../types/index.ts';

export const SIDE_COLORS: Record<Side, string> = { green: '#34c759', red: '#ef4444' };

const CROSS = 'M-4.5,-12h9v7.5h7.5v9h-7.5v7.5h-9v-7.5h-7.5v-9h7.5z';
const TOWER = 'M-6,8h12v-2.5h-2v-6h2.5v-5h-3v2.5h-2v-2.5h-3v2.5h-2v-2.5h-3v5h2.5v6h-2z';

export const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  pending: 'Por aparecer',
  active: 'Activo (sello intacto)',
  destroyed: 'Agotado',
  'captured-green': 'En captura: Verde',
  'captured-red': 'En captura: Roja',
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
/** Radio del ícono de un pilar: crece con el tier (B < A < S). */
export const pillarRadius = (rank: number) => 8.5 + rank * 7.5;

function PillarIcon({ central, objective, mapTier, modeId }: { central: boolean; objective?: ObjectiveState; mapTier?: string; modeId: string }) {
  const status = objective?.status ?? 'pending';
  const tier = objective?.tier ?? mapTier;
  const r = pillarRadius(tierRank(modeId, tier));
  return (
    <>
      <Circle radius={r} fill={STATUS_COLORS[status]} stroke={central ? '#7a5200' : '#f8fafc'} strokeWidth={2} dash={status === 'pending' ? [4, 3] : undefined} />
      {tier ? (
        <Text text={tier} fontSize={r * 1.1} fontStyle="bold" fill={status === 'pending' ? '#f8fafc' : '#111827'} width={40} offsetX={20} offsetY={r * 0.52} align="center" />
      ) : central ? (
        <Star numPoints={8} innerRadius={r * 0.33} outerRadius={r * 0.73} fill="#fff4cf" stroke="#7a5200" strokeWidth={1} />
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
function MarkerIcon({ marker, objective, modeId }: { marker: Marker; objective?: ObjectiveState; modeId: string }) {
  switch (marker.kind) {
    case 'respawn':
      return <Path data={CROSS} fill={SIDE_COLORS[marker.side ?? 'green']} stroke="#fff" strokeWidth={2} lineJoin="round" />;
    case 'central-pillar':
    case 'pillar-slot':
      return <PillarIcon central={marker.kind === 'central-pillar'} objective={objective} mapTier={marker.tier} modeId={modeId} />;
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
  modeId: string;
  objectives?: ObjectiveState[];
  selectedId?: string;
  /** Editor de mapa: los marcadores se pueden seleccionar y arrastrar. */
  editable?: boolean;
  onSelect?: (id: string) => void;
  onMoveStart?: () => void;
  onMove?: (id: string, pos: Vec2) => void;
}

export const Markers = memo(function Markers({ markers, proj, grid, modeId, objectives, selectedId, editable, onSelect, onMoveStart, onMove }: Props) {
  const overrides = useScoringStore((s) => s.overrides);
  const field = useStrategyStore((s) => s.strategy.field) ?? 'main';
  const { stats } = resolvedStats(modeId, overrides, field);
  const unitShort = field === 'sub' ? 'moral' : 'pts';
  /** Total de un pilar de ese tier (sello + captura completa). */
  const valueOf = (tier: string | undefined) => stats.find((s) => s.id === tier)?.pillarTotal ?? null;
  return (
    <Group listening={!!editable}>
      {markers.map((m) => {
        const p = proj.toWorld(m.pos);
        const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => (e.cancelBubble = true);
        const objective = objectives?.find((o) => o.markerId === m.id);
        const pillar = m.kind === 'central-pillar' || m.kind === 'pillar-slot';
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
            <MarkerIcon marker={m} objective={objective} modeId={modeId} />
            <Text
              text={`${m.label}${m.confirmed || pillar ? '' : ' (?)'} · Z${zoneOf(m.pos, grid)}${pillar && valueOf(objective?.tier ?? m.tier) != null ? ` · ${valueOf(objective?.tier ?? m.tier)} ${unitShort}` : ''}`}
              y={pillar ? pillarRadius(tierRank(modeId, objective?.tier ?? m.tier)) + 4 : 15}
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
