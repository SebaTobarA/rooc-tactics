import { memo, useMemo } from 'react';
import { Circle, Group, Line, Path, Rect, Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import { scatterForest, mulberry32 } from '../../../lib/forest.ts';
import { centroid, ringsToPath } from '../../../lib/geometry.ts';
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

const TAU = Math.PI * 2;

/**
 * El mapa propio en 2D. Todo se dibuja desde la geometría y el estilo de la config:
 * bosque con copas, senderos de pasto y arena, muros de ruinas, plazas de piedra, agua y nubes.
 */
export const MapShapes = memo(function MapShapes({ map, proj, onPick }: Props) {
  const { geometry: g, style } = map;
  const listening = !!onPick;
  const d = (p: Polygon) => ringsToPath([p.points, ...(p.holes ?? [])], proj);
  const pick = (list: PolyList, id: string) => (onPick ? () => onPick({ type: 'polygon', list, id }) : undefined);
  const boundsPath = useMemo(() => ringsToPath([g.bounds], proj), [g.bounds, proj]);
  const boundsWorld = useMemo(() => g.bounds.map(proj.toWorld), [g.bounds, proj]);
  const clipBounds = (ctx: Context) => {
    ctx.beginPath();
    boundsWorld.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const rockFill = (p: Polygon) => (p.kind === 'rock' ? style.rock : p.kind === 'ruin' ? style.plazaStroke : style.forestShade);

  // Copas de árboles, ordenadas de arriba hacia abajo para que se solapen como un bosque visto desde el cielo.
  const trees = useMemo(
    () => scatterForest(g, map.aspect, 62).map((t) => ({ ...proj.toWorld(t.pos), r: 9 + t.size * 6, tone: Math.floor(t.shade * style.canopy.length) })).sort((a, b) => a.y - b.y),
    [g, map.aspect, proj, style.canopy.length],
  );

  // Nubes: bolas blancas repartidas por fuera del contorno, que lo tapan un poco como en el mapa original.
  const clouds = useMemo(() => {
    const rand = mulberry32(11);
    const c = proj.toWorld(centroid(g.bounds));
    const out: { x: number; y: number; r: number }[] = [];
    boundsWorld.forEach((p, i) => {
      const q = boundsWorld[(i + 1) % boundsWorld.length];
      const steps = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 34));
      for (let k = 0; k < steps; k++) {
        const x = p.x + ((q.x - p.x) * k) / steps;
        const y = p.y + ((q.y - p.y) * k) / steps;
        const len = Math.hypot(x - c.x, y - c.y) || 1;
        for (let layer = 0; layer < 3; layer++) {
          const out_ = 34 + layer * 40 + rand() * 24;
          out.push({ x: x + ((x - c.x) / len) * out_ + (rand() - 0.5) * 30, y: y + ((y - c.y) / len) * out_ + (rand() - 0.5) * 30, r: 26 + rand() * 30 + layer * 8 });
        }
      }
    });
    return out;
  }, [boundsWorld, g.bounds, proj]);

  // Los agujeros de lo transitable son los brazos de las espirales: ahí van los muros de las ruinas.
  const wallPath = useMemo(() => ringsToPath(g.walkable.flatMap((p) => p.holes ?? []), proj), [g.walkable, proj]);

  return (
    <Group listening={listening}>
      <Path data={boundsPath} fill={style.forest} stroke={style.forestShade} strokeWidth={3} lineJoin="round"
        shadowColor={style.forestShade} shadowBlur={28} shadowOpacity={0.9} onClick={pick('bounds', 'bounds')} />
      <Group clipFunc={clipBounds}>
        {g.obstacles.filter((p) => p.kind === 'forest').map((p) => (
          <Path key={p.id} data={d(p)} fill={style.forestShade} opacity={0.28} fillRule="evenodd" onClick={pick('obstacles', p.id)} />
        ))}
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            // Primero la sombra de todas las copas, después las copas por tono: pocos rellenos, muchos círculos.
            ctx.beginPath();
            for (const t of trees) { ctx.moveTo(t.x + 3 + t.r, t.y + 4); ctx.arc(t.x + 3, t.y + 4, t.r, 0, TAU); }
            ctx.fillStyle = style.canopyShade;
            ctx.globalAlpha = 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;
            for (const t of trees) {
              ctx.beginPath();
              ctx.arc(t.x, t.y, t.r, 0, TAU);
              ctx.fillStyle = style.canopy[t.tone];
              ctx.fill();
              ctx.beginPath();
              ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.3, t.r * 0.45, 0, TAU);
              ctx.fillStyle = 'rgba(255,255,255,0.09)';
              ctx.fill();
            }
          }}
        />
        {g.water.map((p) => (
          <Group key={p.id}>
            <Path data={d(p)} fill={style.water} stroke="#8fc3ee" strokeWidth={3} lineJoin="round" fillRule="evenodd"
              shadowColor="#0b2a4a" shadowBlur={10} shadowOpacity={0.6} onClick={pick('water', p.id)} />
          </Group>
        ))}
        {g.walkable.map((p) => {
          const data = d(p);
          return (
            <Group key={p.id}>
              {/* Sombra del bosque sobre el claro y base de arena. */}
              <Path data={data} fill={style.walkable} fillRule="evenodd" shadowColor="#07160d" shadowBlur={16} shadowOpacity={0.85} onClick={pick('walkable', p.id)} />
              {/* Pasto: un borde ancho y difuso recortado al interior, así la arena queda al centro de los senderos. */}
              <Group clipFunc={() => [new Path2D(data), 'evenodd']} listening={false}>
                <Path data={data} stroke={style.grass} strokeWidth={20} lineJoin="round" opacity={0.95} shadowColor={style.grass} shadowBlur={18} shadowOpacity={1} />
                <Path data={data} stroke={style.forest} strokeWidth={7} lineJoin="round" opacity={0.55} />
              </Group>
            </Group>
          );
        })}
        {/* Muros de ruinas: bloques de piedra a lo largo de los brazos de las espirales. */}
        <Path data={wallPath} stroke="#4b525a" strokeWidth={6.5} lineJoin="round" lineCap="butt" dash={[13, 5]} opacity={0.8} listening={false} />
        <Path data={wallPath} stroke={style.wall} strokeWidth={4} lineJoin="round" lineCap="butt" dash={[13, 5]} listening={false} />
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
          const spokes = c.kind === 'center' ? 16 : c.kind === 'respawn' ? 8 : 6;
          return (
            <Group key={c.id} x={o.x} y={o.y} onClick={onPick ? () => onPick({ type: 'plaza', id: c.id }) : undefined}>
              <Circle radius={r + 3} fill={style.plazaStroke} opacity={0.55} listening={false} />
              <Circle radius={r} fill={style.plaza} stroke={style.plazaStroke} strokeWidth={2.5} shadowColor="#000" shadowBlur={8} shadowOpacity={0.45} />
              {/* Losas de piedra: anillos concéntricos y juntas radiales. */}
              <Circle radius={r * 0.7} stroke={style.plazaStroke} strokeWidth={1} opacity={0.65} listening={false} />
              <Circle radius={r * 0.38} stroke={style.plazaStroke} strokeWidth={1} opacity={0.65} fill="rgba(255,255,255,0.12)" listening={false} />
              {Array.from({ length: spokes }, (_, i) => {
                const a = (i / spokes) * TAU;
                return <Line key={i} points={[Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, Math.cos(a) * r, Math.sin(a) * r]} stroke={style.plazaStroke} strokeWidth={1} opacity={0.5} listening={false} />;
              })}
            </Group>
          );
        })}
        {style.textureOpacity > 0 && (
          <Rect width={proj.w} height={proj.h} fillPatternImage={noise() as unknown as HTMLImageElement} opacity={style.textureOpacity}
            globalCompositeOperation="overlay" listening={false} />
        )}
      </Group>
      <Shape
        listening={false}
        opacity={0.96}
        fill={style.cloud}
        shadowColor={style.cloud}
        shadowBlur={22}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          for (const c of clouds) { ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, TAU); }
          ctx.fillStrokeShape(shape);
        }}
      />
    </Group>
  );
});
