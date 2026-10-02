import { Circle, Group, Line, Path } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { nearestEdge, ringsToPath, roundVec } from '../../lib/geometry.ts';
import type { Projection } from '../../lib/projection.ts';
import { useEditorStore } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import type { Plaza } from '../../types/index.ts';
import { ringsOf } from './geometryOps.ts';

interface Props {
  proj: Projection;
  /** Escala de la vista, para que los controles midan lo mismo en pantalla. */
  scale: number;
}

const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => (e.cancelBubble = true);

/** Controles del editor de mapa sobre el lienzo: vértices, radio de plazas y polígono en curso. */
export function EditorOverlay({ proj, scale }: Props) {
  const map = useMapStore((s) => s.map);
  const update = useMapStore((s) => s.update);
  const checkpoint = useMapStore((s) => s.checkpoint);
  const selection = useEditorStore((s) => s.selection);
  const draft = useEditorStore((s) => s.draft);
  const r = 5 / scale;

  let controls = null;
  if (selection?.type === 'polygon') {
    const { list, id } = selection;
    const rings = ringsOf(map.geometry, list, id);
    if (rings) {
      const insertVertex = (e: KonvaEventObject<MouseEvent>) => {
        stop(e);
        const pointer = e.target.getStage()!.getRelativePointerPosition()!;
        const p = proj.toNorm(pointer);
        const edge = nearestEdge(p, rings, proj.toWorld);
        checkpoint();
        update((m) => ringsOf(m.geometry, list, id)![edge.ring].splice(edge.index + 1, 0, roundVec(p)));
      };
      controls = (
        <>
          <Path data={ringsToPath(rings, proj)} stroke="#38bdf8" strokeWidth={2 / scale} hitStrokeWidth={14 / scale} fillEnabled={false} onDblClick={insertVertex} onMouseDown={stop} />
          {rings.map((ring, ri) =>
            ring.map((v, vi) => {
              const p = proj.toWorld(v);
              return (
                <Circle
                  key={`${ri}-${vi}-${ring.length}`}
                  x={p.x}
                  y={p.y}
                  radius={r}
                  fill={ri === 0 ? '#fff' : '#fde68a'}
                  stroke="#0369a1"
                  strokeWidth={1.5 / scale}
                  draggable
                  onMouseDown={stop}
                  onTouchStart={stop}
                  onDragStart={checkpoint}
                  onDragMove={(e) => {
                    const n = roundVec(proj.toNorm(e.target.position()));
                    update((m) => (ringsOf(m.geometry, list, id)![ri][vi] = n));
                  }}
                  onClick={(e) => {
                    stop(e);
                    if (!e.evt.altKey || ring.length <= 3) return;
                    checkpoint();
                    update((m) => ringsOf(m.geometry, list, id)![ri].splice(vi, 1));
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    if (ring.length <= 3) return;
                    checkpoint();
                    update((m) => ringsOf(m.geometry, list, id)![ri].splice(vi, 1));
                  }}
                />
              );
            }),
          )}
        </>
      );
    }
  } else if (selection?.type === 'plaza') {
    const plaza = map.geometry.plazas.find((p) => p.id === selection.id);
    if (plaza) {
      const c = proj.toWorld(plaza.center);
      const rad = proj.len(plaza.radius);
      const edit = (fn: (p: Plaza) => void) => update((m) => fn(m.geometry.plazas.find((p) => p.id === plaza.id)!));
      controls = (
        <>
          <Circle x={c.x} y={c.y} radius={rad} stroke="#38bdf8" strokeWidth={2 / scale} listening={false} />
          <Circle x={c.x} y={c.y} radius={r * 1.2} fill="#fff" stroke="#0369a1" strokeWidth={1.5 / scale} draggable onMouseDown={stop} onTouchStart={stop}
            onDragStart={checkpoint} onDragMove={(e) => { const n = roundVec(proj.toNorm(e.target.position())); edit((p) => (p.center = n)); }} />
          <Circle x={c.x + rad} y={c.y} radius={r} fill="#fde68a" stroke="#0369a1" strokeWidth={1.5 / scale} draggable onMouseDown={stop} onTouchStart={stop}
            onDragStart={checkpoint}
            onDragMove={(e) => {
              const d = Math.hypot(e.target.x() - c.x, e.target.y() - c.y);
              edit((p) => (p.radius = Math.max(0.004, Math.round((d / proj.w) * 10000) / 10000)));
            }}
            onDragEnd={(e) => e.target.position({ x: c.x + proj.len(plaza.radius), y: c.y })} />
        </>
      );
    }
  }

  const draftWorld = draft.map(proj.toWorld);
  return (
    <Group>
      {controls}
      {draft.length > 0 && (
        <>
          <Line points={draftWorld.flatMap((p) => [p.x, p.y])} stroke="#f472b6" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
          {draftWorld.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={r} fill="#f472b6" listening={false} />
          ))}
        </>
      )}
    </Group>
  );
}
