import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { roundVec } from '../../lib/geometry.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { fitView, makeProjection, screenToWorld, type View } from '../../lib/projection.ts';
import { useEditorStore, type Selection } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { EditorOverlay } from '../map-editor/EditorOverlay.tsx';
import { addMarker, addPlaza, addPolygon } from '../map-editor/geometryOps.ts';
import { MapShapes } from '../map-render/konva/MapShapes.tsx';
import { Markers } from '../map-render/konva/Markers.tsx';
import { NumpadGrid } from '../map-render/konva/NumpadGrid.tsx';

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

/** Lienzo 2D: mapa propio, grilla, marcadores y controles del editor, con zoom y desplazamiento. */
export function BoardStage() {
  const map = useMapStore((s) => s.map);
  const update = useMapStore((s) => s.update);
  const checkpoint = useMapStore((s) => s.checkpoint);
  const flipped = useUiStore((s) => s.flipped);
  const showGrid = useUiStore((s) => s.showGrid);
  const setCursor = useUiStore((s) => s.setCursor);
  const editor = useEditorStore();

  const proj = useMemo(() => makeProjection(map.aspect, flipped), [map.aspect, flipped]);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const pan = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => setView(fitView(proj, size.w, size.h)), [proj, size]);
  useEffect(() => {
    if (!fitted.current && size.w > 0) {
      fitted.current = true;
      fit();
    }
  }, [size, fit]);

  const zoomAt = useCallback((point: { x: number; y: number }, factor: number) => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: point.x - (point.x - v.x) * k, y: point.y - (point.y - v.y) * k };
    });
  }, []);

  const finishDraft = useCallback(() => {
    const { draft, select, setDraft, setTool } = useEditorStore.getState();
    if (draft.length < 3) return;
    checkpoint();
    let created: Selection = null;
    update((m) => (created = { type: 'polygon', ...addPolygon(m, draft) }));
    setDraft([]);
    setTool('select');
    select(created);
  }, [checkpoint, update]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
      }
      const ed = useEditorStore.getState();
      if (!ed.active) return;
      if (e.key === 'Escape') ed.draft.length ? ed.setDraft([]) : ed.select(null);
      if (e.key === 'Enter') finishDraft();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useMapStore.getState().undo();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [finishDraft]);

  const pointerNorm = () => {
    const p = stageRef.current?.getPointerPosition();
    return p ? proj.toNorm(screenToWorld(p, view)) : null;
  };

  // En el editor, las herramientas que colocan cosas usan el clic izquierdo; ahí se desplaza con espacio o botón central.
  const placing = editor.active && editor.tool !== 'select';

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const { button, clientX, clientY } = e.evt;
    if (button === 1 || (button === 0 && (spaceDown || !placing))) {
      e.evt.preventDefault();
      pan.current = { x: clientX, y: clientY, moved: false };
    }
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const p = pan.current;
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) < 4) return;
      p.moved = true;
      p.x = e.clientX;
      p.y = e.clientY;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    };
    // El clic que sigue al mouseup todavía necesita saber si hubo arrastre.
    const up = () => setTimeout(() => (pan.current = null));
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = stageRef.current!.getPointerPosition()!;
    zoomAt(p, Math.exp(-e.evt.deltaY * (e.evt.ctrlKey ? 0.01 : 0.0015)));
  };

  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = (t[0].clientX + t[1].clientX) / 2 - rect.left;
    const cy = (t[0].clientY + t[1].clientY) / 2 - rect.top;
    const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const last = pinch.current;
    if (last) {
      zoomAt({ x: cx, y: cy }, dist / last.dist);
      setView((v) => ({ ...v, x: v.x + cx - last.cx, y: v.y + cy - last.cy }));
    }
    pinch.current = { dist, cx, cy };
  };

  const onClick = (e: KonvaEventObject<MouseEvent>) => {
    if (!editor.active || e.evt.button !== 0 || pan.current?.moved || spaceDown) return;
    const raw = pointerNorm();
    if (!raw) return;
    const p = roundVec(raw);
    if (editor.tool === 'add-marker') {
      checkpoint();
      let id = '';
      update((m) => (id = addMarker(m, editor.markerKind, p).id));
      editor.select({ type: 'marker', id });
    } else if (editor.tool === 'add-plaza') {
      checkpoint();
      let id = '';
      update((m) => (id = addPlaza(m, p).id));
      editor.select({ type: 'plaza', id });
      editor.setTool('select');
    } else if (editor.tool === 'draw-polygon') {
      editor.setDraft([...editor.draft, p]);
    } else if (e.target === e.target.getStage()) {
      editor.select(null);
    }
  };

  const onPick = useCallback((selection: Selection) => {
    const ed = useEditorStore.getState();
    if (ed.tool === 'select' && !pan.current?.moved) ed.select(selection);
  }, []);

  const moveMarker = useCallback((id: string, pos: { x: number; y: number }) => {
    update((m) => (m.markers.find((k) => k.id === id)!.pos = roundVec(pos)));
  }, [update]);
  const moveGridLine = useCallback((axis: 'cols' | 'rows', index: 0 | 1, value: number) => {
    update((m) => {
      const pair = m.numpad[axis];
      const lo = index === 0 ? 0.02 : pair[0] + 0.02;
      const hi = index === 0 ? pair[1] - 0.02 : 0.98;
      pair[index] = Math.round(Math.min(hi, Math.max(lo, value)) * 1000) / 1000;
    });
  }, [update]);
  const selectMarker = useCallback((id: string) => useEditorStore.getState().select({ type: 'marker', id }), []);

  const showPhoto = editor.active && editor.showReference && editor.reference;
  const cursorStyle = pan.current?.moved || spaceDown ? 'grab' : placing ? 'crosshair' : 'default';

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: map.style.fog, cursor: cursorStyle }}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={() => (pinch.current = null)}
        onClick={onClick}
        onDblClick={() => editor.active && editor.tool === 'draw-polygon' && finishDraft()}
        onMouseMove={() => {
          const p = pointerNorm();
          setCursor(p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? p : null);
        }}
        onMouseLeave={() => setCursor(null)}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer>
          {showPhoto && (
            <KonvaImage image={editor.reference!} width={proj.w} height={proj.h} listening={false}
              rotation={flipped ? 180 : 0} x={flipped ? proj.w : 0} y={flipped ? proj.h : 0} />
          )}
        </Layer>
        <Layer opacity={showPhoto ? editor.mapOpacity : 1}>
          <MapShapes map={map} proj={proj} onPick={editor.active ? onPick : undefined} />
        </Layer>
        <Layer>
          {showGrid && (
            <NumpadGrid grid={map.numpad} proj={proj} color={map.style.grid} editable={editor.active && editor.tool === 'select'}
              onMoveStart={checkpoint} onMove={moveGridLine} />
          )}
          <Markers
            markers={map.markers}
            proj={proj}
            grid={map.numpad}
            editable={editor.active && editor.tool === 'select'}
            selectedId={editor.selection?.type === 'marker' ? editor.selection.id : undefined}
            onSelect={selectMarker}
            onMoveStart={checkpoint}
            onMove={moveMarker}
          />
          {editor.active && <EditorOverlay proj={proj} scale={view.scale} />}
        </Layer>
      </Stage>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-slate-900/80 p-1 text-xs text-slate-200 shadow">
        <button className="rounded px-2 py-1 hover:bg-slate-700" onClick={() => zoomAt({ x: size.w / 2, y: size.h / 2 }, 1 / 1.25)} title="Alejar">−</button>
        <span className="w-10 text-center tabular-nums">{Math.round(view.scale * 100)}%</span>
        <button className="rounded px-2 py-1 hover:bg-slate-700" onClick={() => zoomAt({ x: size.w / 2, y: size.h / 2 }, 1.25)} title="Acercar">+</button>
        <button className="rounded px-2 py-1 hover:bg-slate-700" onClick={fit} title="Encajar el mapa en la pantalla">Encajar</button>
      </div>
      <CursorStatus />
    </div>
  );
}

function CursorStatus() {
  const cursor = useUiStore((s) => s.cursor);
  const grid = useMapStore((s) => s.map.numpad);
  if (!cursor) return null;
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200 shadow">
      x {cursor.x.toFixed(3)} · y {cursor.y.toFixed(3)} · zona {zoneOf(cursor, grid)}
    </div>
  );
}
