import type { MapConfig } from '../../types/index.ts';

export const exportGeoJson = (map: MapConfig): string => JSON.stringify(map.geometry) + '\n';

/** Genera `src/config/maps/<id>.ts` con los marcadores y la grilla actuales. */
export function exportConfigTs(map: MapConfig): string {
  const constName = map.id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  const markers = map.markers
    .map((m) => {
      const side = m.side ? ` side: '${m.side}',` : '';
      return `    { id: '${m.id}', kind: '${m.kind}',${side} pos: { x: ${m.pos.x}, y: ${m.pos.y} }, label: ${JSON.stringify(m.label)}, confirmed: ${m.confirmed} },`;
    })
    .join('\n');
  return `import type { MapConfig, MapGeometry } from '../../types/index.ts';
import align from './${map.id}.align.json';
import geometry from './${map.id}.geo.json';
import { ${constName}Style } from './${map.id}.style.ts';

// Generado con el editor de mapa.
export const ${constName}: MapConfig = {
  id: '${map.id}',
  name: ${JSON.stringify(map.name)},
  modeId: '${map.modeId}',
  enabled: ${map.enabled},
  aspect: align.aspect,
  geometry: geometry as MapGeometry,
  style: ${constName}Style,
  reference: {
    image: ${JSON.stringify(map.reference?.image ?? '')},
    crop: { x: 0, y: 0, w: 1, h: 1 },
    minimapToMap: align.minimapToMap,
  },
  numpad: { cols: [${map.numpad.cols.join(', ')}], rows: [${map.numpad.rows.join(', ')}] },
  markers: [
${markers}
  ],
};
`;
}

export function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
