import { memo, useMemo } from 'react';
import { Circle, Group, Path, Rect } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import { ringsToPath } from '../../../lib/geometry.ts';
import type { Projection } from '../../../lib/projection.ts';
import type { PolyList, Selection } from '../../../store/editorStore.ts';
import type { MapConfig, Polygon } from '../../../types/index.ts';

interface Props {
  map: MapConfig;
  proj: Projection;
  /** Si se entrega, las formas responden al clic (editor de mapa). */
  onPick?: (selection: Selection) => void;
}

let noiseCanvas: HTMLCanvasElement | undefined;
/** Textura de ruido generada una sola vez; da grano al mapa sin usar arte del juego. */
function noise(): HTMLCanvasElement {
  if (noiseCanvas) return noiseCanvas;
  const size = 160;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseCanvas.height = size;
  const ctx = noiseCanvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return noiseCanvas;
}

/** El mapa propio en 2D: se dibuja solo desde la geometría y el estilo de la config. */
export const MapShapes = memo(function MapShapes({ map, proj, onPick }: Props) {
  const { geometry: g, style } = map;
  const listening = !!onPick;
  const d = (p: Polygon) => ringsToPath([p.points, ...(p.holes ?? [])], proj);
  const pick = (list: PolyList, id: string) => (onPick ? () => onPick({ type: 'polygon', list, id }) : undefined);
  const boundsPath = useMemo(() => ringsToPath([g.bounds], proj), [g.bounds, proj]);
  const boundsWorld = useMemo(() => g.bounds.map(proj.toWorld), [g.bounds, proj]);
  const clip = (ctx: Context) => {
    ctx.beginPath();
    boundsWorld.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const rockFill = (p: Polygon) => (p.kind === 'rock' ? style.rock : p.kind === 'ruin' ? style.plazaStroke : style.forestShade);

  return (
    <Group listening={listening}>
      <Path data={boundsPath} fill={style.forest} stroke={style.forestShade} strokeWidth={3} lineJoin="round"
        shadowColor={style.forestShade} shadowBlur={28} shadowOpacity={0.9} onClick={pick('bounds', 'bounds')} />
      <Group clipFunc={clip}>
        {g.obstacles.filter((p) => p.kind === 'forest').map((p) => (
          <Path key={p.id} data={d(p)} fill={style.forestShade} opacity={0.28} fillRule="evenodd" onClick={pick('obstacles', p.id)} />
        ))}
        {g.water.map((p) => (
          <Path key={p.id} data={d(p)} fill={style.water} stroke="#8fc3ee" strokeWidth={2} lineJoin="round" fillRule="evenodd" onClick={pick('water', p.id)} />
        ))}
        {g.walkable.map((p) => (
          <Path key={p.id} data={d(p)} fill={style.walkable} stroke={style.walkableStroke} strokeWidth={3} lineJoin="round" fillRule="evenodd"
            shadowColor="#0b1f14" shadowBlur={14} shadowOpacity={0.75} onClick={pick('walkable', p.id)} />
        ))}
        {g.obstacles.filter((p) => p.kind !== 'forest').map((p) => (
          <Path key={p.id} data={d(p)} fill={rockFill(p)} stroke="#3d444c" strokeWidth={2} lineJoin="round" fillRule="evenodd"
            shadowColor="#000" shadowBlur={8} shadowOpacity={0.5} onClick={pick('obstacles', p.id)} />
        ))}
        {g.decor.map((p) => (
          <Path key={p.id} data={d(p)} fill={rockFill(p)} stroke="#3d444c" strokeWidth={1.5} lineJoin="round" fillRule="evenodd" onClick={pick('decor', p.id)} />
        ))}
        {g.plazas.map((c) => {
          const o = proj.toWorld(c.center);
          const r = proj.len(c.radius);
          return (
            <Group key={c.id} x={o.x} y={o.y} onClick={onPick ? () => onPick({ type: 'plaza', id: c.id }) : undefined}>
              <Circle radius={r} fill={style.plaza} stroke={style.plazaStroke} strokeWidth={2.5} />
              <Circle radius={r * 0.68} stroke={style.plazaStroke} strokeWidth={1} opacity={0.6} listening={false} />
            </Group>
          );
        })}
        {style.textureOpacity > 0 && (
          <Rect width={proj.w} height={proj.h} fillPatternImage={noise() as unknown as HTMLImageElement} opacity={style.textureOpacity}
            globalCompositeOperation="overlay" listening={false} />
        )}
      </Group>
    </Group>
  );
});
