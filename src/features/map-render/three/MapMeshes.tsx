import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { pointInPolygon, pointInRing } from '../../../lib/geometry.ts';
import type { Projection3 } from '../../../lib/projection.ts';
import type { MapConfig, Polygon, Vec2 } from '../../../types/index.ts';

/** Unidades de mundo por unidad de `height` de la geometría. */
const HEIGHT_UNIT = 0.9;
const FLAT = -Math.PI / 2;

/** Polígono normalizado → Shape en el plano XY, listo para acostarse sobre el suelo (rotación -90° en X). */
function toShape(points: Vec2[], holes: Vec2[][], proj: Projection3): THREE.Shape {
  const ring = (pts: Vec2[]) => pts.map((p) => { const [x, z] = proj.toGround(p); return new THREE.Vector2(x, -z); });
  const shape = new THREE.Shape(ring(points));
  shape.holes = holes.map((h) => new THREE.Path(ring(h)));
  return shape;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Props {
  map: MapConfig;
  proj: Projection3;
}

/**
 * El mapa propio en volumen, generado desde la misma geometría que la vista 2D.
 * El bosque se deriva como "contorno menos transitable", así sigue los retoques del editor.
 */
export const MapMeshes = memo(function MapMeshes({ map, proj }: Props) {
  const { geometry: g, style } = map;
  const forestHeight = (g.obstacles.find((o) => o.kind === 'forest')?.height ?? 2) * HEIGHT_UNIT * 0.35;

  const geo = useMemo(() => {
    const ground = new THREE.ShapeGeometry(toShape(g.bounds, [], proj));
    const walkable = new THREE.ShapeGeometry(g.walkable.map((p) => toShape(p.points, p.holes ?? [], proj)));
    const water = new THREE.ShapeGeometry(g.water.map((p) => toShape(p.points, [], proj)));
    const forestShapes = [
      toShape(g.bounds, g.walkable.map((p) => p.points), proj),
      ...g.walkable.flatMap((p) => (p.holes ?? []).map((h) => toShape(h, [], proj))),
    ];
    const forest = new THREE.ExtrudeGeometry(forestShapes, { depth: forestHeight, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 1 });
    const solid = (p: Polygon) =>
      new THREE.ExtrudeGeometry(toShape(p.points, p.holes ?? [], proj), { depth: Math.max(0.2, p.height * HEIGHT_UNIT), bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 });
    const rocks = [...g.obstacles.filter((o) => o.kind !== 'forest'), ...g.decor].map((p) => ({ id: p.id, kind: p.kind, geometry: solid(p) }));
    return { ground, walkable, water, forest, rocks };
  }, [g, proj, forestHeight]);

  // Copas de árboles: grilla con desorden determinista sobre todo lo que no es transitable, agua ni plaza.
  const trees = useMemo(() => {
    const rand = mulberry32(7);
    const out: { x: number; z: number; s: number; shade: number }[] = [];
    const step = 2.7;
    for (let z = -proj.d / 2; z < proj.d / 2; z += step) {
      for (let x = -proj.w / 2; x < proj.w / 2; x += step) {
        const px = x + (rand() - 0.5) * step;
        const pz = z + (rand() - 0.5) * step;
        const s = 0.7 + rand() * 0.7;
        const shade = rand();
        const n = proj.toNorm(px, pz);
        if (!pointInRing(n, g.bounds)) continue;
        if (g.walkable.some((p) => pointInPolygon(n, p)) || g.water.some((p) => pointInRing(n, p.points))) continue;
        if (g.obstacles.some((o) => o.kind !== 'forest' && pointInRing(n, o.points))) continue;
        out.push({ x: px, z: pz, s, shade });
      }
    }
    return out;
  }, [g, proj]);

  const treeRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = treeRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const base = new THREE.Color(style.forest);
    const dark = new THREE.Color(style.forestShade);
    trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, forestHeight + 1.3 * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, base.clone().lerp(dark, t.shade * 0.7).offsetHSL(0, 0, 0.06));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [trees, style, forestHeight]);

  return (
    <group>
      <mesh geometry={geo.ground} rotation-x={FLAT} position-y={-0.02}>
        <meshLambertMaterial color={style.forestShade} />
      </mesh>
      <mesh geometry={geo.walkable} rotation-x={FLAT} position-y={0.02}>
        <meshLambertMaterial color={style.walkable} />
      </mesh>
      <mesh geometry={geo.water} rotation-x={FLAT} position-y={forestHeight + 0.06}>
        <meshLambertMaterial color={style.water} transparent opacity={0.75} />
      </mesh>
      <mesh geometry={geo.forest} rotation-x={FLAT}>
        <meshLambertMaterial color={style.forest} flatShading />
      </mesh>
      {geo.rocks.map((r) => (
        <mesh key={r.id} geometry={r.geometry} rotation-x={FLAT}>
          <meshLambertMaterial color={r.kind === 'rock' ? style.rock : style.plazaStroke} flatShading />
        </mesh>
      ))}
      <instancedMesh key={trees.length} ref={treeRef} args={[undefined, undefined, trees.length]}>
        <coneGeometry args={[1.25, 2.6, 6]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      {g.plazas.map((c) => {
        const [x, z] = proj.toGround(c.center);
        return (
          <mesh key={c.id} position={[x, 0.12, z]}>
            <cylinderGeometry args={[proj.len(c.radius), proj.len(c.radius) * 1.04, 0.24, 28]} />
            <meshLambertMaterial color={style.plaza} flatShading />
          </mesh>
        );
      })}
    </group>
  );
});
