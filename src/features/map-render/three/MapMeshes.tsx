import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, scatterClouds, scatterForest, wallBlocks } from '../../../lib/forest.ts';
import type { Projection3 } from '../../../lib/projection.ts';
import type { MapConfig, Polygon, Vec2 } from '../../../types/index.ts';
import { buildGroundTexture } from './groundTexture.ts';

/** Unidades de mundo por unidad de `height` de la geometría. */
const HEIGHT_UNIT = 0.9;
const FLAT = -Math.PI / 2;
/** Espesor de la maqueta bajo el suelo. */
const SLAB = 3.2;

/** Polígono normalizado → Shape en el plano XY, listo para acostarse sobre el suelo (rotación -90° en X). */
function toShape(points: Vec2[], holes: Vec2[][], proj: Projection3): THREE.Shape {
  const ring = (pts: Vec2[]) => pts.map((p) => { const [x, z] = proj.toGround(p); return new THREE.Vector2(x, -z); });
  const shape = new THREE.Shape(ring(points));
  shape.holes = holes.map((h) => new THREE.Path(ring(h)));
  return shape;
}

/** Pinta todos los vértices de una geometría de un color (se multiplica por el color de la instancia). */
function tint(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

const TRUNK = '#8a6a4a';

/** Pino: tronco y tres pisos de follaje. */
function pineGeometry(): THREE.BufferGeometry {
  const tier = (r: number, h: number, y: number) => tint(new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0), '#ffffff');
  return mergeGeometries([
    tint(new THREE.CylinderGeometry(0.16, 0.24, 0.9, 5).translate(0, 0.45, 0), TRUNK),
    tier(1.2, 1.3, 0.6),
    tier(0.95, 1.2, 1.35),
    tier(0.65, 1.2, 2.05),
  ])!;
}

/** Árbol de copa redonda: tronco y dos masas de follaje facetadas. */
function roundTreeGeometry(): THREE.BufferGeometry {
  return mergeGeometries([
    tint(new THREE.CylinderGeometry(0.18, 0.28, 1.2, 5).translate(0, 0.6, 0), TRUNK),
    tint(new THREE.IcosahedronGeometry(1.15, 0).scale(1, 0.85, 1).translate(0, 1.85, 0), '#ffffff'),
    tint(new THREE.IcosahedronGeometry(0.75, 0).translate(0.45, 2.55, 0.2), '#ffffff'),
  ])!;
}

interface Instance {
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  color: THREE.Color;
}

/** Malla instanciada: una sola llamada de dibujo para cientos de objetos iguales. */
function Instances({ geometry, items, flat = true }: { geometry: THREE.BufferGeometry; items: Instance[]; flat?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      m.compose(new THREE.Vector3(...it.position), q.setFromAxisAngle(up, it.rotationY), new THREE.Vector3(...it.scale));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, it.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return (
    <instancedMesh key={items.length} ref={ref} args={[geometry, undefined, items.length]}>
      <meshLambertMaterial vertexColors={!!geometry.attributes.color} flatShading={flat} />
    </instancedMesh>
  );
}

interface Props {
  map: MapConfig;
  proj: Projection3;
}

/**
 * El mapa propio en volumen, generado desde la misma geometría que la vista 2D:
 * maqueta con espesor, suelo pintado, bosque de dos especies, muros de ruinas, plazas escalonadas y nubes.
 */
export const MapMeshes = memo(function MapMeshes({ map, proj }: Props) {
  const { geometry: g, style } = map;

  const trees = useMemo(() => scatterForest(g, map.aspect, 46), [g, map.aspect]);
  const ground = useMemo(() => buildGroundTexture(map, trees), [map, trees]);
  useEffect(() => () => ground.dispose(), [ground]);

  const geo = useMemo(() => {
    const slab = new THREE.ExtrudeGeometry(toShape(g.bounds, [], proj), { depth: SLAB, bevelEnabled: false });
    const solid = (p: Polygon) =>
      new THREE.ExtrudeGeometry(toShape(p.points, p.holes ?? [], proj), { depth: Math.max(0.2, p.height * HEIGHT_UNIT), bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 });
    const rocks = [...g.obstacles.filter((o) => o.kind !== 'forest'), ...g.decor].map((p) => ({ id: p.id, kind: p.kind, geometry: solid(p) }));
    return {
      slab,
      rocks,
      pine: pineGeometry(),
      round: roundTreeGeometry(),
      block: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      puff: new THREE.IcosahedronGeometry(1, 2),
      bush: new THREE.IcosahedronGeometry(1, 0),
    };
  }, [g, proj]);

  const instances = useMemo(() => {
    const tones = style.canopy.map((c) => new THREE.Color(c));
    const pines: Instance[] = [];
    const rounds: Instance[] = [];
    const bushes: Instance[] = [];
    const rand = mulberry32(5);
    for (const t of trees) {
      const [x, z] = proj.toGround(t.pos);
      const tone = tones[Math.floor(t.shade * tones.length)].clone().offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
      const s = 0.62 + t.size * 0.38;
      const item: Instance = { position: [x, 0, z], rotationY: rand() * Math.PI * 2, scale: [s, s * (0.85 + rand() * 0.5), s], color: tone };
      (t.shade < 0.55 ? pines : rounds).push(item);
      // Matorral al pie de algunos árboles, para cerrar el bosque.
      if (rand() < 0.45) {
        const b = 0.5 + rand() * 0.5;
        bushes.push({ position: [x + (rand() - 0.5) * 2, b * 0.4, z + (rand() - 0.5) * 2], rotationY: rand() * 6, scale: [b * 1.3, b * 0.8, b * 1.3], color: tone.clone().offsetHSL(0, 0.05, -0.04) });
      }
    }

    // Muros de ruinas a lo largo de los brazos de las espirales (los agujeros de lo transitable).
    const stone = new THREE.Color(style.wall);
    const walls: Instance[] = [];
    for (const ring of g.walkable.flatMap((p) => p.holes ?? [])) {
      for (const b of wallBlocks(ring, map.aspect, 0.0135, rand)) {
        const [x, z] = proj.toGround(b.pos);
        const tall = b.seed > 0.86;
        walls.push({
          position: [x, 0, z],
          rotationY: -b.angle + (rand() - 0.5) * 0.25,
          scale: [1.25 + rand() * 0.3, tall ? 2.4 + rand() * 1.2 : 0.7 + b.seed * 1.3, 0.75 + rand() * 0.25],
          color: stone.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.16),
        });
      }
    }

    const white = new THREE.Color(style.cloud);
    const clouds: Instance[] = scatterClouds(g.bounds, map.aspect).map((c) => {
      const [x, z] = proj.toGround(c.pos);
      const r = proj.len(c.radius);
      // Bajas y achatadas: rodean la maqueta sin tapar el mapa.
      return { position: [x, -2.6 + c.seed * 1.6, z], rotationY: c.seed * 6, scale: [r * 0.66, r * (0.24 + c.seed * 0.12), r * 0.66], color: white.clone().offsetHSL(0, 0, -c.seed * 0.05) };
    });
    return { pines, rounds, bushes, walls, clouds };
  }, [trees, g, map.aspect, proj, style]);

  return (
    <group>
      {/* Maqueta: bloque de tierra con el contorno del mapa. */}
      <mesh geometry={geo.slab} rotation-x={FLAT} position-y={-SLAB - 0.02}>
        <meshLambertMaterial color="#3b2f25" />
      </mesh>
      <mesh rotation-x={FLAT}>
        <planeGeometry args={[proj.w, proj.d]} />
        <meshLambertMaterial map={ground} transparent alphaTest={0.5} />
      </mesh>
      {geo.rocks.map((r) => (
        <mesh key={r.id} geometry={r.geometry} rotation-x={FLAT}>
          <meshLambertMaterial color={r.kind === 'rock' ? style.rock : style.plazaStroke} flatShading />
        </mesh>
      ))}
      <Instances geometry={geo.pine} items={instances.pines} />
      <Instances geometry={geo.round} items={instances.rounds} />
      <Instances geometry={geo.bush} items={instances.bushes} />
      <Instances geometry={geo.block} items={instances.walls} />
      <Instances geometry={geo.puff} items={instances.clouds} flat={false} />
      {g.plazas.map((c) => {
        const [x, z] = proj.toGround(c.center);
        const r = proj.len(c.radius);
        return (
          <group key={c.id} position={[x, 0, z]}>
            {/* Plaza de piedra en dos escalones. */}
            <mesh position-y={0.1}>
              <cylinderGeometry args={[r * 1.06, r * 1.12, 0.2, 32]} />
              <meshLambertMaterial color={style.plazaStroke} flatShading />
            </mesh>
            <mesh position-y={0.3}>
              <cylinderGeometry args={[r * 0.92, r * 0.96, 0.24, 32]} />
              <meshLambertMaterial color={style.plaza} />
            </mesh>
            <mesh position-y={0.44} rotation-x={FLAT}>
              <ringGeometry args={[r * 0.5, r * 0.56, 32]} />
              <meshLambertMaterial color={style.plazaStroke} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});
