import { memo } from 'react';
import { Circle, Group, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { jobById } from '../../../config/jobs.ts';
import { roleById } from '../../../config/roles.ts';
import { zoneOf } from '../../../lib/numpad.ts';
import type { Projection } from '../../../lib/projection.ts';
import type { NumpadGrid, Party, Side, Token, Vec2 } from '../../../types/index.ts';
import { SIDE_COLORS } from '../../map-render/konva/Markers.tsx';

export const teamColor = (team: Token['team'], allySide: Side) =>
  SIDE_COLORS[team === 'ally' ? allySide : allySide === 'green' ? 'red' : 'green'];

interface Props {
  tokens: Token[];
  proj: Projection;
  grid: NumpadGrid;
  parties: Party[];
  allySide: Side;
  selection: string[];
  interactive: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onMoveStart: (id: string) => void;
  onMove: (id: string, delta: Vec2) => void;
}

export const TOKEN_RADIUS = 15;

export const Tokens = memo(function Tokens({ tokens, proj, grid, parties, allySide, selection, interactive, onSelect, onMoveStart, onMove }: Props) {
  return (
    <Group listening={interactive}>
      {tokens.map((t) => {
        const p = proj.toWorld(t.pos);
        const job = jobById(t.jobId);
        const party = parties.find((x) => x.id === t.partyId);
        const role = roleById(t.role);
        const selected = selection.includes(t.id);
        const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => (e.cancelBubble = true);
        return (
          <Group
            key={t.id}
            x={p.x}
            y={p.y}
            draggable={interactive && !t.locked}
            onMouseDown={(e) => { stop(e); onSelect(t.id, e.evt.shiftKey); }}
            onTouchStart={(e) => { stop(e); onSelect(t.id, false); }}
            onDragStart={() => onMoveStart(t.id)}
            onDragMove={(e) => {
              const n = proj.toNorm(e.target.position());
              onMove(t.id, { x: n.x - t.pos.x, y: n.y - t.pos.y });
              // La posición la manda el estado (queda acotada a 0–1).
              e.target.position(proj.toWorld(t.pos));
            }}
          >
            {selected && <Circle radius={TOKEN_RADIUS + 6} stroke="#38bdf8" strokeWidth={2} dash={[5, 4]} />}
            <Circle radius={TOKEN_RADIUS} fill={job?.color ?? '#475569'} stroke={teamColor(t.team, allySide)} strokeWidth={4}
              shadowColor="#000" shadowBlur={6} shadowOpacity={0.6} opacity={t.locked ? 0.8 : 1} />
            <Text text={job?.abbr ?? '?'} fontSize={12} fontStyle="bold" fill="#fff" width={30} offsetX={15} offsetY={6} align="center" listening={false} />
            {party && (
              <Group x={12} y={-12} listening={false}>
                <Circle radius={8} fill="#0f172a" stroke="#fff" strokeWidth={1.5} />
                <Text text={String(party.number)} fontSize={10} fontStyle="bold" fill="#fff" width={16} offsetX={8} offsetY={5} align="center" />
              </Group>
            )}
            {role && <Circle x={-12} y={12} radius={5} fill={role.color} stroke="#0f172a" strokeWidth={1.5} listening={false} />}
            <Text
              text={`${t.playerName ? t.playerName + ' · ' : ''}${role ? role.short + ' · ' : ''}Z${zoneOf(t.pos, grid)}`}
              y={TOKEN_RADIUS + 5}
              width={140}
              offsetX={70}
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
