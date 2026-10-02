import { useEffect, type ReactNode } from 'react';
import { modeById } from '../../config/modes/index.ts';
import { round4 } from '../../lib/geometry.ts';
import { zoneOf } from '../../lib/numpad.ts';
import { useEditorStore, type EditorTool } from '../../store/editorStore.ts';
import { useMapStore } from '../../store/mapStore.ts';
import type { MarkerKind, PlazaKind, PolygonKind, Side } from '../../types/index.ts';
import { PublishButton } from '../admin/PublishButton.tsx';
import { download, exportGeoJson } from './exportMap.ts';
import { findPolygon, KIND_LABELS, MARKER_LABELS, polygonToPlaza, removePolygon, ringsOf, setPolygonKind, type EditableKind } from './geometryOps.ts';

const input = 'w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900';
const button = 'rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-200 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800';
const TOOLS: { id: EditorTool; label: string }[] = [
  { id: 'select', label: 'Seleccionar' },
  { id: 'add-marker', label: 'Marcador' },
  { id: 'draw-polygon', label: 'Polígono' },
  { id: 'add-plaza', label: 'Plaza' },
];
const PLAZA_LABELS: Record<PlazaKind, string> = { center: 'Central', pillar: 'Pilar', respawn: 'Respawn' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, step = 0.005, min = 0, max = 1 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <input type="number" className={input} value={value} step={step} min={min} max={max}
      onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(round4(Math.min(max, Math.max(min, e.target.valueAsNumber))))} />
  );
}

/** Panel lateral del editor de mapa (modo administrador). */
export function EditorPanel() {
  const { map, dirty, past, update, checkpoint, undo, reset } = useMapStore();
  const ed = useEditorStore();
  const change = (fn: Parameters<typeof update>[0]) => {
    checkpoint();
    update(fn);
  };

  // En desarrollo la foto se carga directo desde assets-src/; en producción no se publica (es arte del juego).
  useEffect(() => {
    if (ed.reference || !import.meta.env.DEV || !map.reference?.image) return;
    const img = new Image();
    img.onload = () => ed.setReference(img);
    img.src = import.meta.env.BASE_URL + map.reference.image;
  }, [map.reference?.image, ed.reference]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      ed.setReference(img);
      ed.setShowReference(true);
    };
    img.src = URL.createObjectURL(file);
  };

  const sel = ed.selection;
  const marker = sel?.type === 'marker' ? map.markers.find((m) => m.id === sel.id) : undefined;
  const plaza = sel?.type === 'plaza' ? map.geometry.plazas.find((p) => p.id === sel.id) : undefined;
  const poly = sel?.type === 'polygon' ? findPolygon(map.geometry, sel.list, sel.id) : undefined;
  const rings = sel?.type === 'polygon' ? ringsOf(map.geometry, sel.list, sel.id) : null;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
        <h2 className="font-semibold">Editor de mapa</h2>
        {dirty && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300">Copia local modificada</span>}
      </div>
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <button className={`${button} w-full bg-sky-600 text-white hover:bg-sky-500 dark:hover:bg-sky-500`} onClick={() => ed.setActive(false)}>Listo: volver al tablero</button>
        <p className="mb-2 mt-1 text-xs text-slate-500">Arrastra los pilares y marcadores a su lugar. Los cambios quedan como borrador en este navegador hasta que los publiques.</p>
        <PublishButton />
      </div>

      <Section title="Foto de referencia">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ed.showReference} disabled={!ed.reference} onChange={(e) => ed.setShowReference(e.target.checked)} />
          Mostrar la foto original debajo
        </label>
        <Field label="Opacidad">
          <input type="range" min={0} max={1} step={0.05} value={ed.mapOpacity} disabled={!ed.showReference} onChange={(e) => ed.setMapOpacity(e.target.valueAsNumber)} />
        </Field>
        <input type="file" accept="image/*" className="w-full text-xs" onChange={(e) => loadFile(e.target.files?.[0])} />
        <p className="text-xs text-slate-500">La opacidad es la del mapa propio. La foto solo sirve para calibrar y no se publica con el sitio.</p>
      </Section>

      <Section title="Herramienta">
        <div className="grid grid-cols-2 gap-1">
          {TOOLS.map((t) => (
            <button key={t.id} className={`${button} ${ed.tool === t.id ? 'border-sky-500 bg-sky-500/20' : ''}`} onClick={() => ed.setTool(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {ed.tool === 'add-marker' && (
          <Field label="Tipo">
            <select className={input} value={ed.markerKind} onChange={(e) => ed.setMarkerKind(e.target.value as MarkerKind)}>
              {Object.entries(MARKER_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </Field>
        )}
        <p className="text-xs text-slate-500">
          {ed.tool === 'select' && 'Clic para seleccionar; arrastra marcadores, vértices y líneas de la grilla. Doble clic en un borde agrega un vértice; clic derecho (o Alt+clic) lo elimina.'}
          {ed.tool === 'add-marker' && 'Haz clic en el mapa para colocar el marcador.'}
          {ed.tool === 'draw-polygon' && `Haz clic para agregar vértices (${ed.draft.length}). Enter o doble clic para cerrar, Esc para cancelar.`}
          {ed.tool === 'add-plaza' && 'Haz clic en el mapa para colocar una plaza circular.'}
          {ed.tool !== 'select' && ' Desplaza el mapa con la barra espaciadora o el botón central.'}
        </p>
      </Section>

      <Section title="Selección">
        {!sel && <p className="text-sm text-slate-500">Nada seleccionado.</p>}
        {marker && (
          <>
            <Field label="Etiqueta">
              <input className={input} value={marker.label} onFocus={checkpoint} onChange={(e) => update((m) => (m.markers.find((k) => k.id === marker.id)!.label = e.target.value))} />
            </Field>
            <Field label="Tipo">
              <select className={input} value={marker.kind} onChange={(e) => change((m) => (m.markers.find((k) => k.id === marker.id)!.kind = e.target.value as MarkerKind))}>
                {Object.entries(MARKER_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
            {marker.kind === 'respawn' && (
              <Field label="Guild">
                <select className={input} value={marker.side ?? 'green'} onChange={(e) => change((m) => (m.markers.find((k) => k.id === marker.id)!.side = e.target.value as Side))}>
                  <option value="green">Verde</option>
                  <option value="red">Roja</option>
                </select>
              </Field>
            )}
            {(marker.kind === 'central-pillar' || marker.kind === 'pillar-slot') && (
              <Field label="Tier">
                <select className={input} value={marker.tier ?? ''} onChange={(e) => change((m) => (m.markers.find((k) => k.id === marker.id)!.tier = e.target.value || undefined))}>
                  <option value="">Sin definir</option>
                  {(modeById(map.modeId)?.scoring?.tiers ?? []).map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                </select>
              </Field>
            )}
            <Field label="x">
              <NumberInput value={marker.pos.x} onChange={(v) => change((m) => (m.markers.find((k) => k.id === marker.id)!.pos.x = v))} />
            </Field>
            <Field label="y">
              <NumberInput value={marker.pos.y} onChange={(v) => change((m) => (m.markers.find((k) => k.id === marker.id)!.pos.y = v))} />
            </Field>
            <Field label="Zona"><span>{zoneOf(marker.pos, map.numpad)}</span></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={marker.confirmed} onChange={(e) => change((m) => (m.markers.find((k) => k.id === marker.id)!.confirmed = e.target.checked))} />
              Nombre y función confirmados
            </label>
            <button className={button} onClick={() => { change((m) => (m.markers = m.markers.filter((k) => k.id !== marker.id))); ed.select(null); }}>Eliminar marcador</button>
          </>
        )}
        {plaza && (
          <>
            <Field label="Tipo">
              <select className={input} value={plaza.kind} onChange={(e) => change((m) => (m.geometry.plazas.find((p) => p.id === plaza.id)!.kind = e.target.value as PlazaKind))}>
                {Object.entries(PLAZA_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
            <Field label="x"><NumberInput value={plaza.center.x} onChange={(v) => change((m) => (m.geometry.plazas.find((p) => p.id === plaza.id)!.center.x = v))} /></Field>
            <Field label="y"><NumberInput value={plaza.center.y} onChange={(v) => change((m) => (m.geometry.plazas.find((p) => p.id === plaza.id)!.center.y = v))} /></Field>
            <Field label="Radio"><NumberInput value={plaza.radius} step={0.002} min={0.004} max={0.3} onChange={(v) => change((m) => (m.geometry.plazas.find((p) => p.id === plaza.id)!.radius = v))} /></Field>
            <button className={button} onClick={() => { change((m) => (m.geometry.plazas = m.geometry.plazas.filter((p) => p.id !== plaza.id))); ed.select(null); }}>Eliminar plaza</button>
          </>
        )}
        {sel?.type === 'polygon' && rings && (
          <>
            {sel.list === 'bounds' ? (
              <p className="text-sm">Contorno del área jugable.</p>
            ) : (
              poly && (
                <>
                  <Field label="Tipo">
                    <select
                      className={input}
                      value={poly.kind}
                      onChange={(e) => {
                        const kind = e.target.value as EditableKind;
                        checkpoint();
                        if (kind === 'plaza') {
                          let id: string | null = null;
                          update((m) => (id = polygonToPlaza(m, sel.list, sel.id)));
                          ed.select(id ? { type: 'plaza', id } : null);
                        } else {
                          let list = sel.list;
                          update((m) => (list = setPolygonKind(m, sel.list, sel.id, kind as PolygonKind)));
                          ed.select({ type: 'polygon', list, id: sel.id });
                        }
                      }}
                    >
                      {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="Altura 3D">
                    <NumberInput value={poly.height} step={0.5} max={10} onChange={(v) => change((m) => (findPolygon(m.geometry, sel.list, sel.id)!.height = v))} />
                  </Field>
                </>
              )
            )}
            <Field label="Vértices"><span>{rings.reduce((a, r) => a + r.length, 0)}{rings.length > 1 ? ` (${rings.length - 1} agujeros)` : ''}</span></Field>
            {sel.list !== 'bounds' && (
              <button className={button} onClick={() => { change((m) => removePolygon(m, sel.list, sel.id)); ed.select(null); }}>Eliminar polígono</button>
            )}
          </>
        )}
      </Section>

      <Section title="Grilla numpad">
        <div className="grid grid-cols-2 gap-2">
          {(['cols', 'rows'] as const).flatMap((axis) =>
            ([0, 1] as const).map((i) => (
              <label key={`${axis}-${i}`} className="text-xs text-slate-500">
                {axis === 'cols' ? 'Vertical' : 'Horizontal'} {i + 1}
                <NumberInput value={map.numpad[axis][i]} onChange={(v) => change((m) => (m.numpad[axis][i] = v))} />
              </label>
            )),
          )}
        </div>
      </Section>

      <Section title="Exportar">
        <div className="grid grid-cols-2 gap-1">
          <button className={button} onClick={() => download(`${map.id}.geo.json`, exportGeoJson(map))}>{map.id}.geo.json</button>
          <button className={button} onClick={() => download(`${map.id}.markers.json`, JSON.stringify({ numpad: map.numpad, markers: map.markers }, null, 2) + '\n')}>{map.id}.markers.json</button>
          <button className={button} disabled={!past.length} onClick={undo}>Deshacer</button>
          <button className={button} disabled={!dirty} onClick={() => confirm('¿Descartar los cambios locales y volver a la config del proyecto?') && (reset(), ed.select(null))}>Restablecer</button>
        </div>
        <p className="text-xs text-slate-500">Respaldo manual: los mismos archivos que «Publicar para todos» guarda en <code>src/config/maps/</code>. «Restablecer» descarta tu borrador.</p>
      </Section>
    </aside>
  );
}
