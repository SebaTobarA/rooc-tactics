/**
 * Genera la geometría vectorial propia de un mapa a partir de las imágenes de referencia.
 *   npm run generate:map
 * Salidas:
 *   src/config/maps/<id>.geo.json        geometría normalizada 0–1
 *   src/config/maps/<id>.align.json      transformación minimapa → mapa (reutilizable)
 *   scripts/out/<id>-preview.png         geometría superpuesta sobre la foto base
 *   scripts/out/<id>-style.png           el mapa propio con su estilo
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import type { MapGeometry, Plaza, Polygon, Vec2 } from '../src/types/index.ts';
import { valeOfClashStyle } from '../src/config/maps/vale-of-clash.style.ts';
import { fitAxisTransform, refineLandmark } from './lib/align.ts';
import { maskToShapes } from './lib/contours.ts';
import { geometryToSvg } from './lib/preview.ts';
import { blur, components, loadRgb, maskFrom, nearestFill, UNKNOWN, type Mask, type Rgb } from './lib/raster.ts';
import { source } from './maps/vale-of-clash.source.ts';

const VOID = 0;
const BOUNDS = 1;
const WALKABLE = 2;

const base = await loadRgb(source.base);
const mini = await loadRgb(source.minimap);

// 1. Alinear minimapa → foto base usando los 4 respawns.
const crop = source.minimapCrop;
const isRespawnIcon = (r: number, g: number, b: number) =>
  (g > 165 && r > 100 && r < 185 && b < 120) || (r > 215 && g > 105 && g < 185 && b < 120);
const isPinkCross = (r: number, g: number, b: number) => r > 200 && g < 160 && b > 150;
const miniMarks = source.minimapLandmarks.map((p) => refineLandmark(mini, p, 16, isRespawnIcon));
const baseMarks = source.baseLandmarks.map((p) => refineLandmark(base, p, 22, isPinkCross));
const pairs = miniMarks.map((m, i) => ({
  from: { x: (m.x - crop.x) / crop.w, y: (m.y - crop.y) / crop.h },
  to: { x: baseMarks[i].x / base.w, y: baseMarks[i].y / base.h },
}));
const align = fitAxisTransform(pairs);
const residual = Math.max(
  ...pairs.map((p) => Math.hypot((p.from.x * align.sx + align.tx - p.to.x) * base.w, (p.from.y * align.sy + align.ty - p.to.y) * base.h)),
);
console.log('Puntos de referencia (minimapa):', miniMarks.map(fmt).join(' '));
console.log('Puntos de referencia (foto):    ', baseMarks.map(fmt).join(' '));
console.log('Transformación minimapa → mapa:', align, `| error máx. ${residual.toFixed(1)} px de la foto`);

// 2. Clasificar el minimapa: beige = transitable, gris claro = dentro del mapa, gris oscuro = fuera.
const classes = new Uint8Array(crop.w * crop.h);
for (let y = 0; y < crop.h; y++) {
  for (let x = 0; x < crop.w; x++) {
    const [r, g, b] = px(mini, x + crop.x, y + crop.y);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    let c = UNKNOWN; // íconos, círculos dibujados, jugadores: se rellenan con el vecino más cercano
    if (r - b > 40 && r > 190 && g > 180) c = WALKABLE;
    else if (spread < 14 && g >= 197 && g < 214) c = BOUNDS;
    else if (spread < 18 && g >= 160 && g < 192) c = VOID;
    if (source.inpaint.some((p) => Math.hypot(x + crop.x - p.x, y + crop.y - p.y) <= p.r)) c = UNKNOWN;
    classes[y * crop.w + x] = c;
  }
}
nearestFill(classes, crop.w, crop.h);

// 3. Remuestrear al espacio del mapa (área 0–1 = foto base) y sacar contornos.
const W = source.rasterWidth;
const H = Math.round((W * base.h) / base.w);
const sample = (X: number, Y: number): number => {
  const mx = Math.floor((((X + 0.5) / W - align.tx) / align.sx) * crop.w);
  const my = Math.floor((((Y + 0.5) / H - align.ty) / align.sy) * crop.h);
  return mx < 0 || my < 0 || mx >= crop.w || my >= crop.h ? VOID : classes[my * crop.w + mx];
};
const walkMask = blur(maskFrom(W, H, (x, y) => sample(x, y) === WALKABLE), 2);
const boundsMask = blur(maskFrom(W, H, (x, y) => sample(x, y) !== VOID), 4);
const obstacleMask: Mask = { w: W, h: H, data: boundsMask.data.map((v, i) => Math.min(v, 1 - walkMask.data[i])) };

const opts = { minArea: 90, tolerance: 1.3 };
const toPolys = (mask: Mask, kind: Polygon['kind'], height: number, prefix: string): Polygon[] =>
  maskToShapes(mask, opts).map((s, i) => ({ id: `${prefix}-${i + 1}`, kind, height, points: s.points, ...(s.holes.length ? { holes: s.holes } : {}) }));

const walkable = toPolys(walkMask, 'walkable', 0, 'walk');
const obstacles = toPolys(obstacleMask, 'forest', 2, 'forest');
const boundsShapes = maskToShapes(boundsMask, { minArea: 2000, tolerance: 2.5 }).sort((a, b) => b.points.length - a.points.length);

// 4. Foto base: agua (azul) y claros de pilares (círculos de piedra gris).
const scale = W / base.w;
const baseAt = (x: number, y: number) => px(base, Math.min(base.w - 1, Math.floor(x / scale)), Math.min(base.h - 1, Math.floor(y / scale)));
const waterMask = blur(
  maskFrom(W, H, (x, y) => {
    const [r, g, b] = baseAt(x, y);
    return b > r + 45 && b > g + 15 && Math.max(r, g, b) < 215;
  }),
  5,
);
const water = maskToShapes(waterMask, { minArea: 1500, tolerance: 2.5 }).map<Polygon>((s, i) => ({ id: `water-${i + 1}`, kind: 'water', height: 0, points: s.points }));

const stoneMask = blur(
  maskFrom(W, H, (x, y) => {
    const [r, g, b] = baseAt(x, y);
    const mean = (r + g + b) / 3;
    return Math.max(r, g, b) - Math.min(r, g, b) < 26 && mean > 100 && mean < 200;
  }),
  3,
);
const pillarPlazas: Plaza[] = components(stoneMask)
  .filter((c) => {
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    const fill = c.area / ((Math.PI * bw * bh) / 4);
    return c.area > 350 && c.area < 6000 && bw / bh > 0.6 && bw / bh < 1.7 && fill > 0.6;
  })
  .map((c) => ({ kind: 'pillar' as const, center: { x: r4(c.cx / W), y: r4(c.cy / H) }, radius: r4(Math.max(0.016, Math.sqrt(c.area / Math.PI) / W)) }))
  // Descarta la plaza central, lo que pisa un respawn y la piedra que no toca terreno transitable.
  .filter((p) => Math.hypot((p.center.x - source.centerPlaza.x / base.w) * base.w, (p.center.y - source.centerPlaza.y / base.h) * base.h) > source.centerPlaza.r)
  .filter((p) => baseMarks.every((m) => Math.hypot(p.center.x * W - m.x * scale, p.center.y * H - m.y * scale) > (p.radius + source.respawnRadius) * W))
  .filter((p) => walkMask.data[Math.round(p.center.y * H) * W + Math.round(p.center.x * W)] > 0.5)
  .sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x)
  .map((p, i) => ({ id: `pillar-${i + 1}`, ...p }));

const plazas: Plaza[] = [
  { id: 'center', kind: 'center', center: { x: r4(source.centerPlaza.x / base.w), y: r4(source.centerPlaza.y / base.h) }, radius: r4(source.centerPlaza.r / base.w) },
  ...baseMarks.map<Plaza>((m, i) => ({ id: `respawn-${i < 2 ? 'green' : 'red'}-${(i % 2) + 1}`, kind: 'respawn', center: { x: r4(m.x / base.w), y: r4(m.y / base.h) }, radius: source.respawnRadius })),
  ...pillarPlazas,
  ...source.manual.plazas,
];

const geometry: MapGeometry = {
  version: 1,
  bounds: boundsShapes[0]?.points ?? [],
  walkable,
  obstacles,
  water: [...water, ...source.manual.water],
  decor: source.manual.decor,
  plazas,
};

// 5. Exportar geometría, transformación y vistas previas.
mkdirSync('scripts/out', { recursive: true });
writeFileSync(`src/config/maps/${source.id}.geo.json`, JSON.stringify(geometry) + '\n');
writeFileSync(
  `src/config/maps/${source.id}.align.json`,
  JSON.stringify({ aspect: r4(base.w / base.h), minimapCrop: crop, minimapToMap: align, landmarks: pairs.map((p) => p.to) }, null, 2) + '\n',
);
const overlay = geometryToSvg(geometry, valeOfClashStyle, W, H, { overlay: true, landmarks: pairs.map((p) => p.to) });
await sharp(source.base).resize(W, H).composite([{ input: Buffer.from(overlay) }]).png().toFile(`scripts/out/${source.id}-preview.png`);
await sharp(Buffer.from(geometryToSvg(geometry, valeOfClashStyle, W, H, { overlay: false }))).png().toFile(`scripts/out/${source.id}-style.png`);

const verts = (ps: Polygon[]) => ps.reduce((a, p) => a + p.points.length + (p.holes ?? []).reduce((b, h) => b + h.length, 0), 0);
console.log(`bounds: ${geometry.bounds.length} vértices`);
console.log(`walkable: ${walkable.length} polígonos, ${verts(walkable)} vértices`);
console.log(`obstacles: ${obstacles.length} polígonos, ${verts(obstacles)} vértices`);
console.log(`water: ${geometry.water.length} | plazas: ${plazas.length} (${pillarPlazas.length} claros de pilar detectados)`);
console.log(`→ src/config/maps/${source.id}.geo.json, scripts/out/${source.id}-preview.png, scripts/out/${source.id}-style.png`);

function px(img: Rgb, x: number, y: number): [number, number, number] {
  const i = (y * img.w + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
function fmt(p: Vec2 & { refined: boolean }): string {
  return `(${p.x.toFixed(0)},${p.y.toFixed(0)}${p.refined ? '' : ' sin refinar'})`;
}
function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
