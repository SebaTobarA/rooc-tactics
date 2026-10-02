import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
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
const ELEVATION = (35.264 * Math.PI) / 180;
const DISTANCE = 300;
const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

interface Rig {
  /** Giros de 90° aplicados por el usuario. */
  turns: number;
  zoom: number;
  target: [number, number];
}

interface Handle {
  camera: THREE.OrthographicCamera;
  canvas: HTMLCanvasElement;
}

/** Coloca la cámara ortográfica y expone cámara + canvas al resto de la vista. */
function CameraRig({ rig, azimuth, proj, handle }: { rig: Rig; azimuth: number; proj: Projection3; handle: { current: Handle | null } }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const [tx, tz] = rig.target;
    const dir = new THREE.Vector3(Math.sin(azimuth) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(azimuth) * Math.cos(ELEVATION));
    camera.position.set(tx, 0, tz).addScaledVector(dir, DISTANCE);
    camera.lookAt(tx, 0, tz);
    // Zoom 1 = el mapa completo cabe en el lienzo.
    const span = (proj.w + proj.d) * Math.SQRT1_2;
    camera.zoom = rig.zoom * Math.min(size.width / (span * 1.06), size.height / (span * Math.sin(ELEVATION) + 14));
    camera.near = 1;
    camera.far = DISTANCE * 3;
    camera.updateProjectionMatrix();
    handle.current = { camera, canvas: gl.domElement };
    invalidate();
  }, [rig, azimuth, proj, camera, gl, size, handle, invalidate]);
  return null;
}

/** Vista 2.5D: el mismo mapa y la misma estrategia que la vista 2D, en volumen. */
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
  const [rig, setRig] = useState<Rig>({ turns: 0, zoom: 1, target: [0, 0] });
  const [spaceDown, setSpaceDown] = useState(false);
  const handle = useRef<Handle | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ ids: string[]; last: Vec2; moved: boolean } | null>(null);
  // "Invertir lados" gira la cámara 180°; los datos no cambian.
  const azimuth = Math.PI / 4 + (rig.turns * Math.PI) / 2 + (flipped ? Math.PI : 0);

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

  /** Token cuyo sprite está bajo el puntero (distancia en pantalla). */
  const tokenAt = (clientX: number, clientY: number): string | null => {
    const h = handle.current;
    if (!h) return null;
    const rect = h.canvas.getBoundingClientRect();
    let best: { id: string; dist: number } | null = null;
    for (const t of step.tokens) {
      if (!(t.team === 'ally' ? layers.allies : layers.enemies)) continue;
      const [x, z] = proj.toGround(t.pos);
      const s = new THREE.Vector3(x, TOKEN_Y + 0.5, z).project(h.camera);
      const dist = Math.hypot(((s.x + 1) / 2) * rect.width + rect.left - clientX, ((1 - s.y) / 2) * rect.height + rect.top - clientY);
      if (dist < Math.max(16, h.camera.zoom * 1.9) && (!best || dist < best.dist)) best = { id: t.id, dist };
    }
    return best?.id ?? null;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === 'pan'))) {
      e.preventDefault();
      pan.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0 || playing) return;
    const p = groundAt(e.clientX, e.clientY);
    if (!p) return;
    wrapRef.current?.setPointerCapture(e.pointerId);
    if (isDrawingTool(tool)) return controller.down(p);
    const id = tokenAt(e.clientX, e.clientY) ?? [...step.drawings].reverse().find((d) => (d.tool === 'text' ? layers.notes : layers.drawings) && hitDrawing(d, p, map.aspect, 0.015))?.id;
    if (!id) return setSelection(e.shiftKey ? selection : []);
    const ids = e.shiftKey ? (selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]) : selection.includes(id) ? selection : [id];
    setSelection(ids);
    drag.current = { ids, last: p, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pan.current) {
      const h = handle.current!;
      const dx = (e.clientX - pan.current.x) / h.camera.zoom;
      const dy = (e.clientY - pan.current.y) / h.camera.zoom / Math.sin(ELEVATION);
      pan.current = { x: e.clientX, y: e.clientY };
      const right = [Math.cos(azimuth), -Math.sin(azimuth)];
      const forward = [-Math.sin(azimuth), -Math.cos(azimuth)];
      setRig((r) => ({ ...r, target: [r.target[0] - right[0] * dx + forward[0] * dy, r.target[1] - right[1] * dx + forward[1] * dy] }));
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

  const onPointerUp = () => {
    pan.current = null;
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

  const zoomBy = (f: number) => setRig((r) => ({ ...r, zoom: Math.min(8, Math.max(0.4, r.zoom * f)) }));
  const tokens = step.tokens.filter((t) => (t.team === 'ally' ? layers.allies : layers.enemies));
  const drawings = step.drawings.filter((d) => (d.tool === 'text' ? layers.notes : layers.drawings));
  const btn = 'rounded px-2 py-1 hover:bg-slate-700';

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{ background: map.style.fog, cursor: spaceDown || tool === 'pan' ? 'grab' : isDrawingTool(tool) ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onWheel={(e) => zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => acceptsBoardDrop(e.dataTransfer) && e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Sin sombras y con dpr acotado: pensado para gráficas integradas. */}
      <Canvas orthographic flat frameloop="demand" dpr={[1, 1.5]} gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={[map.style.fog]} />
        <CameraRig rig={rig} azimuth={azimuth} proj={proj} handle={handle} />
        {/* Luz de cielo + sol cálido desde el noroeste (las sombras van horneadas en la textura del suelo). */}
        <hemisphereLight args={['#ffffff', '#5d7a55', 1.7]} />
        <directionalLight position={[-60, 90, -45]} intensity={1.7} color="#fff3d6" />
        {layers.map && <MapMeshes map={map} proj={proj} />}
        {layers.grid && <Numpad3D map={map} proj={proj} azimuth={azimuth} />}
        {layers.objectives && <Markers3D map={map} proj={proj} objectives={step.objectives} />}
        <Drawings3D drawings={drawings} draft={controller.draft} proj={proj} aspect={map.aspect} selection={selection} />
        <Tokens3D tokens={tokens} proj={proj} map={map} parties={parties} allySide={allySide} selection={selection} />
      </Canvas>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-slate-900/80 p-1 text-xs text-slate-200 shadow" onPointerDown={(e) => e.stopPropagation()}>
        <button className={btn} onClick={() => setRig((r) => ({ ...r, turns: r.turns - 1 }))} title="Rotar 90° a la izquierda">⟲ 90°</button>
        <button className={btn} onClick={() => setRig((r) => ({ ...r, turns: r.turns + 1 }))} title="Rotar 90° a la derecha">90° ⟳</button>
        <button className={btn} onClick={() => zoomBy(1 / 1.25)} title="Alejar">−</button>
        <span className="w-10 text-center tabular-nums">{Math.round(rig.zoom * 100)}%</span>
        <button className={btn} onClick={() => zoomBy(1.25)} title="Acercar">+</button>
        <button className={btn} onClick={() => setRig({ turns: 0, zoom: 1, target: [0, 0] })} title="Restablecer la cámara">Encajar</button>
      </div>
    </div>
  );
}
