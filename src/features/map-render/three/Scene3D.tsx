import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeProjection3, type Projection3 } from '../../../lib/projection.ts';
import { moveItems } from '../../../store/boardActions.ts';
import { useMapStore } from '../../../store/mapStore.ts';
import { useStrategyStore } from '../../../store/strategyStore.ts';
import { useUiStore } from '../../../store/uiStore.ts';
import type { Vec2 } from '../../../types/index.ts';
import { acceptsBoardDrop, dropOnBoard } from '../../board/dnd.ts';
import { hitDrawing } from '../../board/hit.ts';
import { stageHandle } from '../../board/stageHandle.ts';
import { isDrawingTool, useToolController } from '../../board/useToolController.ts';
import { useDisplayedStep } from '../../timeline/displayedStep.ts';
import { Drawings3D, Markers3D, Numpad3D, Tokens3D, TOKEN_Y } from './BoardObjects3D.tsx';
import { MapMeshes } from './MapMeshes.tsx';

/** Elevación de la cámara isométrica. */
const ISO_ELEVATION = (35.264 * Math.PI) / 180;
const ISO_DISTANCE = 300;
const SKY = '#a9d3ee';
const FREE_MIN_DIST = 3;
const FREE_MAX_DIST = 220;
/** Altura del punto al que mira la cámara libre: más o menos la de un personaje. */
const EYE = 1.6;
const DEG = Math.PI / 180;
const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

/** `iso`: ortográfica isométrica. `free`: perspectiva que orbita, se acerca hasta el suelo y recorre el mapa. */
type CameraMode = 'iso' | 'free';

interface Rig {
  /** Giro horizontal extra, en radianes (en isométrica, múltiplos de 90°). */
  yaw: number;
  /** Isométrica: factor de zoom. */
  zoom: number;
  /** Libre: elevación sobre el horizonte y distancia al punto observado. */
  pitch: number;
  dist: number;
  target: [number, number];
}

const INITIAL: Rig = { yaw: 0, zoom: 1, pitch: 32 * DEG, dist: 95, target: [0, 0] };

interface Handle {
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
}

/** Coloca la cámara según el modo y la expone, junto al canvas, al resto de la vista. */
function CameraRig({ mode, rig, azimuth, proj, handle }: { mode: CameraMode; rig: Rig; azimuth: number; proj: Projection3; handle: { current: Handle | null } }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const apply = useCallback(() => {
    const [tx, tz] = rig.target;
    const elevation = mode === 'iso' ? ISO_ELEVATION : rig.pitch;
    const dir = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.set(tx, 0, tz).addScaledVector(dir, ISO_DISTANCE);
      camera.lookAt(tx, 0, tz);
      // Zoom 1 = el mapa completo cabe en el lienzo.
      const span = (proj.w + proj.d) * Math.SQRT1_2;
      camera.zoom = rig.zoom * Math.min(size.width / (span * 1.06), size.height / (span * Math.sin(ISO_ELEVATION) + 14));
      camera.near = 1;
      camera.far = ISO_DISTANCE * 3;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.set(tx, EYE, tz).addScaledVector(dir, rig.dist);
      camera.lookAt(tx, EYE, tz);
      if (size.height > 0) camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    handle.current = { camera, canvas: gl.domElement };
  }, [mode, rig, azimuth, proj, camera, gl, size, handle]);
  useLayoutEffect(() => {
    apply();
    invalidate();
  }, [apply, invalidate]);
  // También en cada cuadro: R3F reconfigura la cámara al crear el canvas y pisaría la posición inicial.
  useFrame(apply);
  // Con frameloop "demand", asegura un cuadro cuando el canvas recién creado ya tiene tamaño y texturas.
  useEffect(() => {
    const timers = [60, 400, 1200].map((ms) => setTimeout(() => invalidate(), ms));
    return () => timers.forEach(clearTimeout);
  }, [invalidate]);
  return null;
}

/** Vista 2.5D / 3D: el mismo mapa y la misma estrategia que la vista 2D, en volumen. */
export default function Scene3D() {
  const map = useMapStore((s) => s.map);
  const step = useDisplayedStep();
  const playing = useUiStore((s) => s.playback !== null);
  const flipped = useStrategyStore((s) => s.strategy.flipped);
  const allySide = useStrategyStore((s) => s.strategy.allySide);
  const parties = useStrategyStore((s) => s.strategy.parties);
  const { tool, layers, selection, setSelection, setCursor } = useUiStore();

  const proj = useMemo(() => makeProjection3(map.aspect), [map.aspect]);
  const controller = useToolController(map.aspect);
  const [mode, setMode] = useState<CameraMode>('iso');
  const [rig, setRig] = useState<Rig>(INITIAL);
  const [spaceDown, setSpaceDown] = useState(false);
  const handle = useRef<Handle | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number } | null>(null);
  const orbit = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const drag = useRef<{ ids: string[]; last: Vec2; moved: boolean } | null>(null);
  // "Invertir lados" gira la cámara 180°; los datos no cambian.
  const azimuth = Math.PI / 4 + rig.yaw + (flipped ? Math.PI : 0);
  const azimuthRef = useRef(azimuth);
  azimuthRef.current = azimuth;

  const clampTarget = useCallback(
    (t: [number, number]): [number, number] => [Math.max(-proj.w / 2, Math.min(proj.w / 2, t[0])), Math.max(-proj.d / 2, Math.min(proj.d / 2, t[1]))],
    [proj],
  );
  /** Mueve el punto observado en ejes de pantalla: `right` hacia la derecha, `forward` hacia el fondo. */
  const moveTarget = useCallback((right: number, forward: number) => {
    const a = azimuthRef.current;
    setRig((r) => ({ ...r, target: clampTarget([r.target[0] + Math.cos(a) * right - Math.sin(a) * forward, r.target[1] - Math.sin(a) * right - Math.cos(a) * forward]) }));
  }, [clampTarget]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => !isTyping(e) && e.code === 'Space' && (e.preventDefault(), setSpaceDown(true));
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Cámara libre: las flechas recorren el mapa mientras se mantienen pulsadas.
  useEffect(() => {
    if (mode !== 'free') return;
    const held = new Set<string>();
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const right = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
      const forward = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
      if (right || forward) {
        setRig((r) => {
          const speed = Math.max(9, r.dist * 0.7) * dt;
          const a = azimuthRef.current;
          return { ...r, target: clampTarget([r.target[0] + (Math.cos(a) * right - Math.sin(a) * forward) * speed, r.target[1] + (-Math.sin(a) * right - Math.cos(a) * forward) * speed]) };
        });
      }
      raf = held.size ? requestAnimationFrame(tick) : 0;
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e) || !e.key.startsWith('Arrow')) return;
      e.preventDefault();
      held.add(e.key);
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [mode, clampTarget]);

  // Para exportar a PNG desde fuera.
  useEffect(() => {
    stageHandle.canvas3d = () => handle.current?.canvas ?? null;
    return () => void (stageHandle.canvas3d = null);
  }, []);

  /** Clic del mouse → punto del suelo (raycasting contra el plano y = 0) → coordenadas normalizadas. */
  const groundAt = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const h = handle.current;
    if (!h) return null;
    const rect = h.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, h.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return hit ? proj.toNorm(hit.x, hit.z) : null;
  }, [proj]);

  /** Token cuyo sprite está bajo el puntero (distancia en pantalla, según el tamaño aparente del sprite). */
  const tokenAt = (clientX: number, clientY: number): string | null => {
    const h = handle.current;
    if (!h) return null;
    const rect = h.canvas.getBoundingClientRect();
    const toScreen = (v: THREE.Vector3) => {
      const s = v.project(h.camera);
      return s.z > 1 ? null : { x: ((s.x + 1) / 2) * rect.width + rect.left, y: ((1 - s.y) / 2) * rect.height + rect.top };
    };
    let best: { id: string; dist: number } | null = null;
    for (const t of step.tokens) {
      if (!(t.team === 'ally' ? layers.allies : layers.enemies)) continue;
      const [x, z] = proj.toGround(t.pos);
      const center = toScreen(new THREE.Vector3(x, TOKEN_Y + 0.5, z));
      const edge = toScreen(new THREE.Vector3(x, TOKEN_Y + 2.4, z));
      if (!center || !edge) continue;
      const radius = Math.max(14, Math.hypot(edge.x - center.x, edge.y - center.y));
      const dist = Math.hypot(center.x - clientX, center.y - clientY);
      if (dist < radius && (!best || dist < best.dist)) best = { id: t.id, dist };
    }
    return best?.id ?? null;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    wrapRef.current?.setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === 'pan'))) {
      e.preventDefault();
      pan.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 2 && mode === 'free') {
      orbit.current = { x: e.clientX, y: e.clientY, moved: false };
      return;
    }
    if (e.button !== 0 || playing) return;
    const p = groundAt(e.clientX, e.clientY);
    if (isDrawingTool(tool)) return void (p && controller.down(p));
    const id = tokenAt(e.clientX, e.clientY) ?? (p ? [...step.drawings].reverse().find((d) => (d.tool === 'text' ? layers.notes : layers.drawings) && hitDrawing(d, p, map.aspect, 0.015))?.id : undefined);
    if (!id || !p) {
      // En cámara libre, arrastrar sobre el vacío gira la vista; un clic sin arrastre quita la selección.
      if (mode === 'free') orbit.current = { x: e.clientX, y: e.clientY, moved: false };
      else if (!e.shiftKey) setSelection([]);
      return;
    }
    const ids = e.shiftKey ? (selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]) : selection.includes(id) ? selection : [id];
    setSelection(ids);
    drag.current = { ids, last: p, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const h = handle.current;
    if (pan.current && h) {
      const dx = e.clientX - pan.current.x;
      const dy = e.clientY - pan.current.y;
      pan.current = { x: e.clientX, y: e.clientY };
      if (h.camera instanceof THREE.OrthographicCamera) moveTarget(-dx / h.camera.zoom, dy / h.camera.zoom / Math.sin(ISO_ELEVATION));
      else {
        // Unidades de mundo por píxel a la distancia del punto observado.
        const perPx = (2 * rig.dist * Math.tan((50 * DEG) / 2)) / h.canvas.clientHeight;
        moveTarget(-dx * perPx, (dy * perPx) / Math.max(0.35, Math.sin(rig.pitch)));
      }
      return;
    }
    if (orbit.current) {
      const dx = e.clientX - orbit.current.x;
      const dy = e.clientY - orbit.current.y;
      if (!orbit.current.moved && Math.hypot(dx, dy) < 4) return;
      orbit.current = { x: e.clientX, y: e.clientY, moved: true };
      setRig((r) => ({ ...r, yaw: r.yaw - dx * 0.006, pitch: Math.max(3 * DEG, Math.min(88 * DEG, r.pitch + dy * 0.005)) }));
      return;
    }
    const p = groundAt(e.clientX, e.clientY);
    if (!p) return;
    setCursor(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? p : null);
    const d = drag.current;
    if (d) {
      if (!d.moved) useStrategyStore.getState().checkpoint();
      d.moved = true;
      moveItems(d.ids, { x: p.x - d.last.x, y: p.y - d.last.y });
      d.last = p;
    } else controller.move(p);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (orbit.current && !orbit.current.moved && e.button === 0 && !e.shiftKey) setSelection([]);
    pan.current = null;
    orbit.current = null;
    drag.current = null;
    controller.up();
  };

  const onDrop = (e: DragEvent) => {
    const p = groundAt(e.clientX, e.clientY);
    if (!p || !acceptsBoardDrop(e.dataTransfer)) return;
    e.preventDefault();
    const ids = dropOnBoard(e.dataTransfer, p);
    if (ids.length) setSelection(ids);
  };

  const zoomBy = (f: number) =>
    setRig((r) => (mode === 'iso' ? { ...r, zoom: Math.min(8, Math.max(0.4, r.zoom * f)) } : { ...r, dist: Math.min(FREE_MAX_DIST, Math.max(FREE_MIN_DIST, r.dist / f)) }));
  const turn = (quarters: number) => setRig((r) => ({ ...r, yaw: r.yaw + (quarters * Math.PI) / 2 }));
  const switchMode = (next: CameraMode) => {
    if (next === mode) return;
    // Al volver a isométrica el giro se ajusta al múltiplo de 90° más cercano.
    setRig((r) => ({ ...r, yaw: next === 'iso' ? Math.round(r.yaw / (Math.PI / 2)) * (Math.PI / 2) : r.yaw }));
    setMode(next);
  };
  /** Baja la cámara al punto observado, a la altura de un personaje. */
  const groundLevel = () => setRig((r) => ({ ...r, pitch: 9 * DEG, dist: 9 }));

  const tokens = step.tokens.filter((t) => (t.team === 'ally' ? layers.allies : layers.enemies));
  const drawings = step.drawings.filter((d) => (d.tool === 'text' ? layers.notes : layers.drawings));
  const btn = 'rounded px-2 py-1 hover:bg-slate-700';
  const on = 'bg-sky-600 hover:bg-sky-500';
  const free = mode === 'free';
  const background = free ? SKY : map.style.fog;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{ background, cursor: spaceDown || tool === 'pan' ? 'grab' : isDrawingTool(tool) ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onWheel={(e) => zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => acceptsBoardDrop(e.dataTransfer) && e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Sin sombras en tiempo real y con dpr acotado: pensado para gráficas integradas. El canvas se recrea al cambiar de cámara. */}
      <Canvas
        key={mode}
        orthographic={!free}
        camera={free ? { fov: 50, near: 0.3, far: 900 } : undefined}
        flat
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[background]} />
        {free && <fog attach="fog" args={[SKY, 70, 420]} />}
        <CameraRig mode={mode} rig={rig} azimuth={azimuth} proj={proj} handle={handle} />
        {/* Luz de cielo + sol cálido desde el noroeste (las sombras van horneadas en la textura del suelo). */}
        <hemisphereLight args={['#ffffff', '#5d7a55', 1.7]} />
        <directionalLight position={[-60, 90, -45]} intensity={1.7} color="#fff3d6" />
        {free && (
          // Mar de nubes hasta el horizonte, para que el borde del mapa no dé al vacío.
          <mesh rotation-x={-Math.PI / 2} position-y={-3.4}>
            <circleGeometry args={[800, 48]} />
            <meshBasicMaterial color={map.style.cloud} />
          </mesh>
        )}
        {layers.map && <MapMeshes map={map} proj={proj} />}
        {layers.grid && <Numpad3D map={map} proj={proj} azimuth={azimuth} />}
        {layers.objectives && <Markers3D map={map} proj={proj} objectives={step.objectives} labelHeight={free ? 0.7 : 1.2} />}
        <Drawings3D drawings={drawings} draft={controller.draft} proj={proj} aspect={map.aspect} selection={selection} />
        <Tokens3D tokens={tokens} proj={proj} map={map} parties={parties} allySide={allySide} selection={selection} />
      </Canvas>
      {free && (
        <p className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 rounded-md bg-slate-900/75 px-3 py-1 text-xs text-slate-100 shadow">
          Arrastra para girar · rueda para acercarte · flechas para recorrer · espacio + arrastrar para desplazar
        </p>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-slate-900/80 p-1 text-xs text-slate-200 shadow" onPointerDown={(e) => e.stopPropagation()}>
        <button className={`${btn} ${!free ? on : ''}`} onClick={() => switchMode('iso')} title="Cámara isométrica (2.5D)">Isométrica</button>
        <button className={`${btn} ${free ? on : ''}`} onClick={() => switchMode('free')} title="Cámara libre en perspectiva: gira, acércate y recorre el mapa">Libre 3D</button>
        {free && <button className={btn} onClick={groundLevel} title="Baja la cámara a la altura de un personaje">A ras de suelo</button>}
        <span className="mx-1 h-4 w-px bg-slate-600" />
        <button className={btn} onClick={() => turn(-1)} title="Rotar 90° a la izquierda">⟲ 90°</button>
        <button className={btn} onClick={() => turn(1)} title="Rotar 90° a la derecha">90° ⟳</button>
        <button className={btn} onClick={() => zoomBy(1 / 1.25)} title="Alejar">−</button>
        {!free && <span className="w-10 text-center tabular-nums">{Math.round(rig.zoom * 100)}%</span>}
        <button className={btn} onClick={() => zoomBy(1.25)} title="Acercar">+</button>
        <button className={btn} onClick={() => setRig(INITIAL)} title="Restablecer la cámara">Encajar</button>
      </div>
    </div>
  );
}
