import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { roundVec } from '../../lib/geometry.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { fitView, makeProjection, screenToWorld, type View } from '../../lib/projection.ts';
import { moveItems } from '../../store/boardActions.ts';
import { useEditorStore, type Selection } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import { useCurrentStep, useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { Vec2 } from '../../types/index.ts';
import { EditorOverlay } from '../map-editor/EditorOverlay.tsx';
import { addMarker, addPlaza, addPolygon } from '../map-editor/geometryOps.ts';
import { MapShapes } from '../map-render/konva/MapShapes.tsx';
import { Markers } from '../map-render/konva/Markers.tsx';
import { NumpadGrid } from '../map-render/konva/NumpadGrid.tsx';
import { acceptsBoardDrop, dropOnBoard } from './dnd.ts';
import { Drawings, DrawingShape } from './konva/Drawings.tsx';
import { Tokens } from './konva/Tokens.tsx';
import { stageHandle } from './stageHandle.ts';
import { isDrawingTool, useToolController } from './useToolController.ts';

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

/** Lienzo 2D: mapa propio, grilla, marcadores, tokens y dibujos, con zoom y desplazamiento. */
export function BoardStage() {
  const map = useMapStore((s) => s.map);
  const updateMap = useMapStore((s) => s.update);
  const checkpointMap = useMapStore((s) => s.checkpoint);
  const step = useCurrentStep();
  const flipped = useStrategyStore((s) => s.strategy.flipped);
  const allySide = useStrategyStore((s) => s.strategy.allySide);
  const parties = useStrategyStore((s) => s.strategy.parties);
  const { tool, layers, selection, setSelection, setCursor } = useUiStore();
  const editor = useEditorStore();

  const proj = useMemo(() => makeProjection(map.aspect, flipped), [map.aspect, flipped]);
  const controller = useToolController(map.aspect);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [band, setBandState] = useState<{ a: Vec2; b: Vec2 } | null>(null);
  // El ref evita depender del re-render entre mousedown y mouseup.
  const bandRef = useRef<{ a: Vec2; b: Vec2 } | null>(null);
  const setBand = (b: { a: Vec2; b: Vec2 } | null) => {
    bandRef.current = b;
    setBandState(b);
  };
  const pan = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    stageHandle.current = stageRef.current;
    return () => void (stageHandle.current = null);
  }, []);

  const fit = useCallback(() => setView(fitView(proj, size.w, size.h)), [proj, size]);
  useEffect(() => {
    if (!fitted.current && size.w > 0) {
      fitted.current = true;
      fit();
    }
  }, [size, fit]);

  const zoomAt = useCallback((point: Vec2, factor: number) => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: point.x - (point.x - v.x) * k, y: point.y - (point.y - v.y) * k };
    });
  }, []);

  const finishDraft = useCallback(() => {
    const { draft, select, setDraft, setTool } = useEditorStore.getState();
    if (draft.length < 3) return;
    checkpointMap();
    let created: Selection = null;
    updateMap((m) => (created = { type: 'polygon', ...addPolygon(m, draft) }));
    setDraft([]);
    setTool('select');
    select(created);
  }, [checkpointMap, updateMap]);

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
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [finishDraft]);

  const pointerWorld = () => {
    const p = stageRef.current?.getPointerPosition();
    return p ? screenToWorld(p, view) : null;
  };
  const pointerNorm = () => {
    const w = pointerWorld();
    return w ? proj.toNorm(w) : null;
  };

  const editing = editor.active;
  // Herramientas que usan el clic izquierdo para colocar o dibujar; ahí se desplaza con espacio o botón central.
  const placing = editing ? editor.tool !== 'select' : isDrawingTool(tool);
  const selecting = !editing && tool === 'select';

  const startPan = (clientX: number, clientY: number) => (pan.current = { x: clientX, y: clientY, moved: false });

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const { button, clientX, clientY } = e.evt;
    if (button === 1 || (button === 0 && (spaceDown || tool === 'pan' || (editing && !placing)))) {
      e.evt.preventDefault();
      return startPan(clientX, clientY);
    }
    if (button !== 0 || editing) return;
    if (selecting) {
      const w = pointerWorld();
      if (!w) return;
      if (!e.evt.shiftKey) setSelection([]);
      setBand({ a: w, b: w });
    } else {
      const p = pointerNorm();
      if (p) controller.down(p);
    }
  };

  const onMouseMove = () => {
    const w = pointerWorld();
    if (!w) return;
    const p = proj.toNorm(w);
    setCursor(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? p : null);
    if (bandRef.current) setBand({ a: bandRef.current.a, b: w });
    else if (!editing && !pan.current) controller.move(p);
  };

  const finishBand = () => {
    const band = bandRef.current;
    if (!band) return;
    const [x0, x1] = [Math.min(band.a.x, band.b.x), Math.max(band.a.x, band.b.x)];
    const [y0, y1] = [Math.min(band.a.y, band.b.y), Math.max(band.a.y, band.b.y)];
    setBand(null);
    if (x1 - x0 < 3 && y1 - y0 < 3) return;
    const inside = (n: Vec2) => {
      const w = proj.toWorld(n);
      return w.x >= x0 && w.x <= x1 && w.y >= y0 && w.y <= y1;
    };
    const visible = (team: 'ally' | 'enemy') => (team === 'ally' ? layers.allies : layers.enemies);
    const ids = [
      ...step.tokens.filter((t) => visible(t.team) && inside(t.pos)).map((t) => t.id),
      ...step.drawings.filter((d) => (d.tool === 'text' ? layers.notes : layers.drawings) && d.points.every(inside)).map((d) => d.id),
    ];
    setSelection([...new Set([...useUiStore.getState().selection, ...ids])]);
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
    zoomAt(stageRef.current!.getPointerPosition()!, Math.exp(-e.evt.deltaY * (e.evt.ctrlKey ? 0.01 : 0.0015)));
  };

  const onTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length !== 1 || editing) return;
    const p = pointerNorm();
    if (p && isDrawingTool(tool)) controller.down(p);
    else if (tool === 'pan') startPan(e.evt.touches[0].clientX, e.evt.touches[0].clientY);
  };
  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    e.evt.preventDefault();
    if (t.length === 1) {
      const p = pointerNorm();
      if (pan.current) {
        const dx = t[0].clientX - pan.current.x;
        const dy = t[0].clientY - pan.current.y;
        pan.current = { x: t[0].clientX, y: t[0].clientY, moved: true };
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      } else if (p && !editing) controller.move(p);
      return;
    }
    if (t.length !== 2) return;
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
  const release = () => {
    pinch.current = null;
    finishBand();
    controller.up();
  };

  const onEditorClick = (e: KonvaEventObject<MouseEvent>) => {
    if (!editing || e.evt.button !== 0 || pan.current?.moved || spaceDown) return;
    const raw = pointerNorm();
    if (!raw) return;
    const p = roundVec(raw);
    if (editor.tool === 'add-marker') {
      checkpointMap();
      let id = '';
      updateMap((m) => (id = addMarker(m, editor.markerKind, p).id));
      editor.select({ type: 'marker', id });
    } else if (editor.tool === 'add-plaza') {
      checkpointMap();
      let id = '';
      updateMap((m) => (id = addPlaza(m, p).id));
      editor.select({ type: 'plaza', id });
      editor.setTool('select');
    } else if (editor.tool === 'draw-polygon') {
      editor.setDraft([...editor.draft, p]);
    } else if (e.target === e.target.getStage()) {
      editor.select(null);
    }
  };

  const onPick = useCallback((sel: Selection) => {
    const ed = useEditorStore.getState();
    if (ed.tool === 'select' && !pan.current?.moved) ed.select(sel);
  }, []);
  const moveMarker = useCallback((id: string, pos: Vec2) => {
    updateMap((m) => (m.markers.find((k) => k.id === id)!.pos = roundVec(pos)));
  }, [updateMap]);
  const moveGridLine = useCallback((axis: 'cols' | 'rows', index: 0 | 1, value: number) => {
    updateMap((m) => {
      const pair = m.numpad[axis];
      const lo = index === 0 ? 0.02 : pair[0] + 0.02;
      const hi = index === 0 ? pair[1] - 0.02 : 0.98;
      pair[index] = Math.round(Math.min(hi, Math.max(lo, value)) * 1000) / 1000;
    });
  }, [updateMap]);
  const selectMarker = useCallback((id: string) => useEditorStore.getState().select({ type: 'marker', id }), []);

  // Tokens y dibujos: seleccionar y mover (todos los seleccionados a la vez).
  const selectItem = useCallback((id: string, additive: boolean) => {
    const cur = useUiStore.getState().selection;
    if (additive) setSelection(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    else if (!cur.includes(id)) setSelection([id]);
  }, [setSelection]);
  const startMove = useCallback(() => useStrategyStore.getState().checkpoint(), []);
  const moveItem = useCallback((id: string, delta: Vec2) => {
    const cur = useUiStore.getState().selection;
    moveItems(cur.includes(id) ? cur : [id], delta);
  }, []);

  const onDrop = (e: DragEvent) => {
    if (!acceptsBoardDrop(e.dataTransfer)) return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const ids = dropOnBoard(e.dataTransfer, proj.toNorm(screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, view)));
    if (ids.length) setSelection(ids);
  };

  const showPhoto = editing && editor.showReference && editor.reference;
  const cursorStyle = pan.current?.moved || spaceDown || tool === 'pan' ? 'grab' : placing ? 'crosshair' : 'default';
  const tokens = step.tokens.filter((t) => (t.team === 'ally' ? layers.allies : layers.enemies));
  const drawings = step.drawings.filter((d) => (d.tool === 'text' ? layers.notes : layers.drawings));

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: map.style.fog, cursor: cursorStyle }}
      onDragOver={(e) => acceptsBoardDrop(e.dataTransfer) && e.preventDefault()} onDrop={onDrop}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={release}
        onMouseLeave={() => { setCursor(null); release(); }}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { pan.current = null; release(); }}
        onClick={onEditorClick}
        onDblClick={() => editing && editor.tool === 'draw-polygon' && finishDraft()}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer>
          {showPhoto && (
            <KonvaImage image={editor.reference!} width={proj.w} height={proj.h} listening={false}
              rotation={flipped ? 180 : 0} x={flipped ? proj.w : 0} y={flipped ? proj.h : 0} />
          )}
        </Layer>
        <Layer opacity={showPhoto ? editor.mapOpacity : 1} visible={layers.map || editing}>
          <MapShapes map={map} proj={proj} onPick={editing ? onPick : undefined} />
        </Layer>
        <Layer>
          {(layers.grid || editing) && (
            <NumpadGrid grid={map.numpad} proj={proj} color={map.style.grid} editable={editing && editor.tool === 'select'}
              onMoveStart={checkpointMap} onMove={moveGridLine} />
          )}
          {(layers.objectives || editing) && (
            <Markers
              markers={map.markers}
              proj={proj}
              grid={map.numpad}
              objectives={step.objectives}
              editable={editing && editor.tool === 'select'}
              selectedId={editor.selection?.type === 'marker' ? editor.selection.id : undefined}
              onSelect={selectMarker}
              onMoveStart={checkpointMap}
              onMove={moveMarker}
            />
          )}
          {editing && <EditorOverlay proj={proj} scale={view.scale} />}
        </Layer>
        <Layer visible={!editing}>
          <Drawings drawings={drawings} proj={proj} selection={selection} interactive={selecting} onSelect={selectItem} onMoveStart={startMove} onMove={moveItem} />
          <Tokens tokens={tokens} proj={proj} grid={map.numpad} parties={parties} allySide={allySide} selection={selection}
            interactive={selecting} onSelect={selectItem} onMoveStart={startMove} onMove={moveItem} />
          {controller.draft && <DrawingShape d={controller.draft} proj={proj} />}
          {band && (
            <Rect x={Math.min(band.a.x, band.b.x)} y={Math.min(band.a.y, band.b.y)} width={Math.abs(band.b.x - band.a.x)} height={Math.abs(band.b.y - band.a.y)}
              fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth={1 / view.scale} listening={false} />
          )}
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

export function CursorStatus() {
  const cursor = useUiStore((s) => s.cursor);
  const grid = useMapStore((s) => s.map.numpad);
  if (!cursor) return null;
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200 shadow">
      x {cursor.x.toFixed(3)} · y {cursor.y.toFixed(3)} · zona {zoneOf(cursor, grid)}
    </div>
  );
}
