import { memo, useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { jobById } from '../../../config/jobs.ts';
import { roleById } from '../../../config/roles.ts';
import { zoneCenters, zoneOf, ZONE_KEYS } from '../../../lib/numpad.ts';
import { partyOfToken } from '../../party/partyActions.ts';
import type { Projection3 } from '../../../lib/projection.ts';
import type { Drawing, MapConfig, Marker, ObjectiveState, Party, Side, Token, Vec2 } from '../../../types/index.ts';
import { curveControl } from '../../board/hit.ts';
import { teamColor } from '../../board/konva/Tokens.tsx';
import type { Draft } from '../../board/useToolController.ts';
import { formatTimer, SIDE_COLORS, STATUS_COLORS } from '../konva/Markers.tsx';
import { labelTexture, pingTexture, tokenTexture } from './textures.ts';

const FLAT = -Math.PI / 2;
/** Altura a la que se proyectan los dibujos; además se dibujan sin prueba de profundidad para que nada los tape. */
const DRAW_Y = 0.6;
export const TOKEN_Y = 2.6;

function Label({ text, position, color, height = 1.6 }: { text: string; position: [number, number, number]; color?: string; height?: number }) {
  const { texture, aspect } = labelTexture(text, color);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={20}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

// ---------- Marcadores ----------

function Pillar({ marker, objective, x, z }: { marker: Marker; objective?: ObjectiveState; x: number; z: number }) {
  const central = marker.kind === 'central-pillar';
  const status = objective?.status ?? 'pending';
  const r = central ? 1.5 : 1;
  const h = status === 'destroyed' ? 0.8 : central ? 6 : 4.2;
  const color = status === 'pending' ? '#cbd5e1' : STATUS_COLORS[status];
  return (
    <group position={[x, 0.24, z]}>
      <mesh position-y={h / 2}>
        <cylinderGeometry args={[r * 0.8, r, h, 8]} />
        <meshLambertMaterial color={color} flatShading transparent={status === 'pending'} opacity={status === 'pending' ? 0.35 : 1}
          emissive={status === 'active' ? '#f5b82e' : '#000000'} emissiveIntensity={status === 'active' ? 0.45 : 0} />
      </mesh>
      {status.startsWith('captured') && (
        <mesh rotation-x={FLAT} position-y={0.05}>
          <ringGeometry args={[r * 2.2, r * 2.8, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      )}
      {objective?.tier && <Label text={objective.tier} position={[0, h + 1.2, 0]} color="#fde68a" height={2.2} />}
      {objective?.timerSeconds != null && <Label text={formatTimer(objective.timerSeconds)} position={[0, h + (objective.tier ? 3 : 1.2), 0]} color="#fde68a" />}
    </group>
  );
}

export const Markers3D = memo(function Markers3D({ map, proj, objectives }: { map: MapConfig; proj: Projection3; objectives: ObjectiveState[] }) {
  return (
    <group>
      {map.markers.map((m) => {
        const [x, z] = proj.toGround(m.pos);
        const label = <Label text={`${m.label}${m.confirmed ? '' : ' (?)'} · Z${zoneOf(m.pos, map.numpad)}`} position={[x, 0.3, z + 2.6]} height={1.2} />;
        if (m.kind === 'central-pillar' || m.kind === 'pillar-slot') {
          return <group key={m.id}><Pillar marker={m} objective={objectives.find((o) => o.markerId === m.id)} x={x} z={z} />{label}</group>;
        }
        if (m.kind === 'respawn') {
          const color = SIDE_COLORS[m.side ?? 'green'];
          return (
            <group key={m.id}>
              <mesh position={[x, 0.45, z]}>
                <cylinderGeometry args={[2.1, 2.4, 0.5, 6]} />
                <meshLambertMaterial color={color} flatShading />
              </mesh>
              <mesh position={[x, 1.3, z]}>
                <boxGeometry args={[0.7, 1.2, 2.2]} />
                <meshLambertMaterial color="#ffffff" />
              </mesh>
              <mesh position={[x, 1.3, z]}>
                <boxGeometry args={[2.2, 1.2, 0.7]} />
                <meshLambertMaterial color="#ffffff" />
              </mesh>
              {label}
            </group>
          );
        }
        const color = m.kind === 'point-green' ? '#a3d93a' : '#a970e6';
        return (
          <group key={m.id}>
            <mesh position={[x, 1.6, z]}>
              {m.kind === 'point-green' ? <octahedronGeometry args={[1.1]} /> : <cylinderGeometry args={[0.7, 1, 2.4, 6]} />}
              <meshLambertMaterial color={color} flatShading />
            </mesh>
            {label}
          </group>
        );
      })}
    </group>
  );
});

// ---------- Grilla numpad ----------

export const Numpad3D = memo(function Numpad3D({ map, proj, azimuth }: { map: MapConfig; proj: Projection3; azimuth: number }) {
  const { cols, rows } = map.numpad;
  const y = DRAW_Y - 0.1;
  const at = (p: Vec2): [number, number, number] => { const [x, z] = proj.toGround(p); return [x, y, z]; };
  const seg = (a: Vec2, b: Vec2) => [at(a), at(b)];
  const lines = [...cols.map((x) => seg({ x, y: 0 }, { x, y: 1 })), ...rows.map((v) => seg({ x: 0, y: v }, { x: 1, y: v }))];
  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={map.style.grid} lineWidth={1.5} transparent opacity={0.55} depthTest={false} renderOrder={5} />
      ))}
      {zoneCenters(map.numpad).map(({ zone, center }) => {
        const [x, z] = proj.toGround(center);
        const { texture, aspect } = labelTexture(`${zone} ${ZONE_KEYS[zone]}`.trim(), map.style.grid, 64);
        // Acostado sobre el suelo y girado para leerse desde la cámara.
        return (
          <mesh key={zone} position={[x, y, z]} rotation={[FLAT, 0, azimuth]} renderOrder={5}>
            <planeGeometry args={[4.5 * aspect, 4.5]} />
            <meshBasicMaterial map={texture} transparent opacity={0.5} depthTest={false} />
          </mesh>
        );
      })}
    </group>
  );
});

// ---------- Tokens ----------

interface TokensProps {
  tokens: Token[];
  proj: Projection3;
  map: MapConfig;
  parties: Party[];
  allySide: Side;
  selection: string[];
}

export const Tokens3D = memo(function Tokens3D({ tokens, proj, map, parties, allySide, selection }: TokensProps) {
  return (
    <group>
      {tokens.map((t) => {
        const [x, z] = proj.toGround(t.pos);
        const job = jobById(t.jobId);
        const role = roleById(t.role);
        const ring = teamColor(t.team, allySide);
        const texture = tokenTexture({
          abbr: job?.abbr ?? '?',
          color: job?.color ?? '#475569',
          ring,
          party: partyOfToken(parties, t)?.number,
          roleColor: role?.color,
          label: `${t.playerName ? t.playerName + ' · ' : ''}${role ? role.short + ' · ' : ''}Z${zoneOf(t.pos, map.numpad)}`,
          selected: selection.includes(t.id),
          locked: !!t.locked,
        });
        return (
          <group key={t.id}>
            <mesh position={[x, 0.3, z]} rotation-x={FLAT} renderOrder={8}>
              <circleGeometry args={[1.2, 20]} />
              <meshBasicMaterial color={ring} transparent opacity={0.85} depthTest={false} />
            </mesh>
            {/* Billboard: el sprite siempre mira a la cámara. */}
            <sprite position={[x, TOKEN_Y, z]} scale={[7, 7, 1]} renderOrder={15}>
              <spriteMaterial map={texture} depthTest={false} transparent />
            </sprite>
          </group>
        );
      })}
    </group>
  );
});

// ---------- Dibujos ----------

function Drawing3D({ d, proj, aspect, selected }: { d: Draft; proj: Projection3; aspect: number; selected: boolean }) {
  const v = (p: Vec2): [number, number, number] => { const [x, z] = proj.toGround(p); return [x, DRAW_Y, z]; };
  const color = d.color;
  const width = d.width * 0.9 + (selected ? 2 : 0);
  const line = (pts: [number, number, number][]) => <Line points={pts} color={selected ? '#38bdf8' : color} lineWidth={width} depthTest={false} renderOrder={10} transparent />;

  const head = useMemo(() => {
    if (d.tool !== 'arrow' && d.tool !== 'curve-arrow') return null;
    const end = d.points[d.points.length - 1];
    const prev = d.tool === 'curve-arrow' ? (d.points.length === 3 ? d.points[1] : curveControl(d.points[0], end, aspect)) : d.points[0];
    const [ex, ez] = proj.toGround(end);
    const [px, pz] = proj.toGround(prev);
    return { ex, ez, angle: Math.atan2(ex - px, ez - pz) };
  }, [d, proj, aspect]);

  switch (d.tool) {
    case 'pen':
    case 'line':
      return d.points.length > 1 ? line(d.points.map(v)) : null;
    case 'arrow':
    case 'curve-arrow': {
      const [a, b] = [d.points[0], d.points[d.points.length - 1]];
      let pts = [v(a), v(b)];
      if (d.tool === 'curve-arrow') {
        const c = d.points.length === 3 ? d.points[1] : curveControl(a, b, aspect);
        pts = new THREE.CatmullRomCurve3([a, c, b].map((p) => new THREE.Vector3(...v(p)))).getPoints(24).map((p) => [p.x, p.y, p.z]);
      }
      const size = 0.45 + d.width * 0.14;
      return (
        <>
          {line(pts)}
          {head && (
            <mesh position={[head.ex, DRAW_Y, head.ez]} rotation={[FLAT, 0, head.angle + Math.PI]} renderOrder={10}>
              <coneGeometry args={[size, size * 2, 3]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
          )}
        </>
      );
    }
    case 'rect': {
      const [a, b] = d.points;
      const corners = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a].map(v);
      const [cx, cz] = proj.toGround({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return (
        <>
          <mesh position={[cx, DRAW_Y - 0.02, cz]} rotation-x={FLAT} renderOrder={9}>
            <planeGeometry args={[Math.abs(b.x - a.x) * proj.w, Math.abs(b.y - a.y) * proj.d]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} depthTest={false} />
          </mesh>
          {line(corners)}
        </>
      );
    }
    case 'circle': {
      const [c, e] = d.points;
      const [cx, cz] = proj.toGround(c);
      const [ex, ez] = proj.toGround(e);
      const r = Math.hypot(ex - cx, ez - cz);
      const pts = Array.from({ length: 49 }, (_, i): [number, number, number] => [cx + r * Math.cos((i / 48) * Math.PI * 2), DRAW_Y, cz + r * Math.sin((i / 48) * Math.PI * 2)]);
      return (
        <>
          <mesh position={[cx, DRAW_Y - 0.02, cz]} rotation-x={FLAT} renderOrder={9}>
            <circleGeometry args={[r, 40]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} depthTest={false} />
          </mesh>
          {line(pts)}
        </>
      );
    }
    case 'text': {
      const p = v(d.points[0]);
      return <Label text={d.text ?? ''} position={[p[0], 1.6, p[2]]} color={selected ? '#38bdf8' : color} height={1.2 + d.width * 0.25} />;
    }
    case 'ping': {
      const p = v(d.points[0]);
      return (
        <sprite position={[p[0], 2.2, p[2]]} scale={[3.6, 3.6, 1]} renderOrder={12}>
          <spriteMaterial map={pingTexture(color, selected)} depthTest={false} transparent />
        </sprite>
      );
    }
  }
}

interface DrawingsProps {
  drawings: Drawing[];
  draft: Draft | null;
  proj: Projection3;
  aspect: number;
  selection: string[];
}

export const Drawings3D = memo(function Drawings3D({ drawings, draft, proj, aspect, selection }: DrawingsProps) {
  return (
    <group>
      {drawings.map((d) => <Drawing3D key={d.id} d={d} proj={proj} aspect={aspect} selected={selection.includes(d.id)} />)}
      {draft && <Drawing3D d={draft} proj={proj} aspect={aspect} selected={false} />}
    </group>
  );
});
