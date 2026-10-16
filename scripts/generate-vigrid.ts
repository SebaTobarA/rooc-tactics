/**
 * Genera la geometría propia del mapa de Vigrid desde su minimapa cenital.
 *   npm run generate:vigrid
 * Arena = transitable; gris = cresta de roca o muro. Salidas:
 *   src/config/maps/<id>.geo.json, src/config/maps/<id>.markers.json
 *   scripts/out/<id>-preview.png (geometría y marcadores sobre la captura) y scripts/out/<id>-style.png
 * Ojo: sobrescribe lo que el superadministrador haya publicado para estos mapas.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import type { MapGeometry, Marker, Plaza, Polygon, Vec2 } from '../src/types/index.ts';
import { vigridFieldStyle } from '../src/config/maps/vigrid.style.ts';
import { fitAxisTransform } from './lib/align.ts';
import { maskToShapes } from './lib/contours.ts';
import { geometryToSvg } from './lib/preview.ts';
import { blur, loadRgb, maskFrom, nearestFill, UNKNOWN, type Mask } from './lib/raster.ts';
import { vigridField, type VigridSource } from './maps/vigrid.source.ts';

const VOID = 0;
const ROCK = 1;
const SAND = 2;
const W = 1000;

await generate(vigridField);

async function generate(source: VigridSource) {
  const img = await loadRgb(source.minimap);
  const { crop } = source;
  const H = Math.round((W * crop.h) / crop.w);
  const aspect = r4(crop.w / crop.h);

  // 1. Clasificar el minimapa dentro del recorte.
  const classes = new Uint8Array(crop.w * crop.h);
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const i = ((y + crop.y) * img.w + x + crop.x) * 3;
      const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      let c = UNKNOWN;
      if (r - b > 32 && r > 205 && g > 190) c = SAND;
      else if (spread < 18 && g >= 168 && g <= 210) c = ROCK;
      // Espirales de los altares y muros del centro: trazo gris parduzco más oscuro que la arena.
      else if (r >= 172 && r <= 206 && g >= 156 && g <= 196 && r - b >= 12 && r - b <= 70) c = ROCK;
      else if ((r + g + b) / 3 < 125 && spread < 30) c = VOID;
      if (source.inpaint.some((p) => Math.hypot(x + crop.x - p.x, y + crop.y - p.y) <= p.r)) c = UNKNOWN;
      if (source.clear.some((p) => Math.hypot(x + crop.x - p.x, y + crop.y - p.y) <= p.r)) c = SAND;
      classes[y * crop.w + x] = c;
    }
  }
  nearestFill(classes, crop.w, crop.h);

  // 2. Remuestrear a la grilla del mapa (0–1 = recorte).
  const sample = (X: number, Y: number) => classes[Math.min(crop.h - 1, Math.floor(((Y + 0.5) / H) * crop.h)) * crop.w + Math.min(crop.w - 1, Math.floor(((X + 0.5) / W) * crop.w))];
  const sand = maskFrom(W, H, (x, y) => sample(x, y) === SAND);
  // Afuera = lo no transitable conectado con el borde de la imagen; adentro queda el contorno jugable.
  const outside = floodOutside(sand);
  // En el juego los senderos son anchos: se adelgazan las crestas interiores, pero cada una conserva un núcleo
  // para que los muros finos de las espirales no desaparezcan.
  if (source.widen) widenPaths(sand, outside, source.widen);
  const walkMask = blur(sand, 2);
  // Bolsillos de arena encerrados por muros: no se llega a ellos, así que no cuentan como sendero.
  // Los objetivos (altares, entradas, jefes) tienen que quedar conectados: si el trazo de la espiral se cerró
  // al extraerlo, se abre un paso por donde menos roca hay que cruzar hasta el sendero.
  const toRaster = (p: Vec2) => ({ x: Math.round(((p.x - crop.x) / crop.w) * W), y: Math.round(((p.y - crop.y) / crop.h) * H) });
  const center = toRaster(source.plazas.find((p) => p.kind === 'center')!.at);
  let reach = floodFrom(walkMask, center.x, center.y);
  let carved = 0;
  for (const c of source.clear.map(toRaster)) {
    const i = c.y * W + c.x;
    if (reach[i]) continue;
    let best: { dx: number; dy: number; len: number } | null = null;
    for (let a = 0; a < 96; a++) {
      const dx = Math.cos((a / 96) * Math.PI * 2);
      const dy = Math.sin((a / 96) * Math.PI * 2);
      for (let len = 1; len < 220; len++) {
        const x = Math.round(c.x + dx * len);
        const y = Math.round(c.y + dy * len);
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        if (reach[y * W + x]) {
          if (!best || len < best.len) best = { dx, dy, len };
          break;
        }
      }
    }
    if (!best) continue;
    for (let t = 0; t <= best.len + 4; t++) {
      const px = c.x + best.dx * t;
      const py = c.y + best.dy * t;
      for (let oy = -7; oy <= 7; oy++) for (let ox = -7; ox <= 7; ox++) {
        const x = Math.round(px + ox);
        const y = Math.round(py + oy);
        if (ox * ox + oy * oy <= 49 && x >= 0 && y >= 0 && x < W && y < H) walkMask.data[y * W + x] = 1;
      }
    }
    carved++;
    reach = floodFrom(walkMask, center.x, center.y);
  }
  let dropped = 0;
  for (let i = 0; i < reach.length; i++) if (!reach[i] && walkMask.data[i] > 0.5) (walkMask.data[i] = 0), dropped++;
  const boundsMask = blur(maskFrom(W, H, (x, y) => !outside[y * W + x]), 3);
  const obstacleMask: Mask = { w: W, h: H, data: boundsMask.data.map((v, i) => Math.min(v, 1 - walkMask.data[i])) };

  const toPolys = (mask: Mask, kind: Polygon['kind'], height: number, prefix: string, minArea: number): Polygon[] =>
    maskToShapes(mask, { minArea, tolerance: 1.1 }).map((s, i) => ({ id: `${prefix}-${i + 1}`, kind, height, points: s.points, ...(s.holes.length ? { holes: s.holes } : {}) }));
  const walkable = toPolys(walkMask, 'walkable', 0, 'walk', 400);
  const obstacles = toPolys(obstacleMask, source.id === 'vigrid' ? 'rock' : 'ruin', source.obstacleHeight, 'ridge', 40);
  const bounds = maskToShapes(boundsMask, { minArea: 5000, tolerance: 2 }).sort((a, b) => b.points.length - a.points.length)[0]?.points ?? [];

  // 3. Plazas y marcadores en coordenadas del mapa.
  const norm = (p: Vec2): Vec2 => ({ x: r4((p.x - crop.x) / crop.w), y: r4((p.y - crop.y) / crop.h) });
  const frames = Object.fromEntries(Object.entries(source.frames ?? {}).map(([k, pairs]) => [k, fitAxisTransform(pairs)]));
  const toMinimap = (p: Vec2, from = 'minimap'): Vec2 => {
    const t = frames[from];
    return t ? { x: p.x * t.sx + t.tx, y: p.y * t.sy + t.ty } : p;
  };
  const walkAt = (p: Vec2) => walkMask.data[Math.min(H - 1, Math.max(0, Math.round(p.y * H))) * W + Math.min(W - 1, Math.max(0, Math.round(p.x * W)))] > 0.5;
  /** Lleva un punto al píxel transitable más cercano (si ya lo es, queda igual). */
  const snap = (p: Vec2): Vec2 => {
    if (walkAt(p)) return p;
    let best = p;
    let bestD = Infinity;
    const cx = Math.round(p.x * W);
    const cy = Math.round(p.y * H);
    for (let dy = -60; dy <= 60; dy++) {
      for (let dx = -60; dx <= 60; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H || walkMask.data[y * W + x] <= 0.8) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) (bestD = d), (best = { x: r4(x / W), y: r4(y / H) });
      }
    }
    return best;
  };
  const plazas: Plaza[] = source.plazas.map((p) => ({ id: p.id, kind: p.kind, center: norm(p.at), radius: r4(p.r / crop.w), ...(p.height ? { height: p.height } : {}) }));
  const markers: Marker[] = source.markers.map((m) => ({
    id: m.id,
    kind: m.kind,
    pos: snap(norm(toMinimap(m.at, m.from))),
    label: m.label,
    ...(m.element ? { element: m.element } : {}),
    confirmed: m.confirmed ?? true,
  }));

  const geometry: MapGeometry = { version: 1, bounds, walkable, obstacles, water: [], decor: [], plazas, ...(source.rampReach ? { rampReach: source.rampReach } : {}) };
  writeFileSync(`src/config/maps/${source.id}.geo.json`, JSON.stringify(geometry) + '\n');
  writeFileSync(`src/config/maps/${source.id}.markers.json`, JSON.stringify({ aspect, numpad: { cols: [0.3333, 0.6667], rows: [0.3333, 0.6667] }, markers }, null, 2) + '\n');

  // 4. Vistas previas para revisar.
  mkdirSync('scripts/out', { recursive: true });
  const style = vigridFieldStyle;
  const dots = markers.map((m) => `<circle cx="${m.pos.x * W}" cy="${m.pos.y * H}" r="7" fill="#ff2b2b" stroke="#fff" stroke-width="2"/><text x="${m.pos.x * W + 9}" y="${m.pos.y * H + 4}" font-size="13" fill="#000">${m.id}</text>`).join('');
  const overlay = geometryToSvg(geometry, style, W, H, { overlay: true }).replace('</svg>', `${dots}</svg>`);
  await sharp(source.minimap).extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h }).resize(W, H).composite([{ input: Buffer.from(overlay) }]).png().toFile(`scripts/out/${source.id}-preview.png`);
  await sharp(Buffer.from(geometryToSvg(geometry, style, W, H, { overlay: false }))).png().toFile(`scripts/out/${source.id}-style.png`);
  const verts = (ps: Polygon[]) => ps.reduce((a, p) => a + p.points.length + (p.holes ?? []).reduce((b, h) => b + h.length, 0), 0);
  console.log(`${source.id}: ${carved} pasos abiertos hacia objetivos encerrados; ${dropped} px de arena aislada descartados`);
  console.log(`${source.id}: aspecto ${aspect} | walkable ${walkable.length} (${verts(walkable)} v) | obstáculos ${obstacles.length} (${verts(obstacles)} v) | contorno ${bounds.length} v | ${markers.length} marcadores`);
  for (const m of markers) if (!walkAt(m.pos)) console.log(`  ¡${m.id} quedó fuera del sendero!`);
}

/**
 * Ensancha lo transitable comiéndose el borde de cada cresta interior hasta `px` píxeles, sin dejarla más
 * delgada que un núcleo de ~4 px de radio (los muros finos se afinan, no se borran).
 */
function widenPaths(sand: Mask, outside: Uint8Array, px: number): void {
  const { w, h, data } = sand;
  const n = w * h;
  // Distancia (en píxeles, 4 vecinos) de cada píxel de roca a la arena más cercana.
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) if (data[i] > 0.5) (dist[i] = 0), (queue[tail++] = i);
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1]) {
      if (j >= 0 && dist[j] < 0) (dist[j] = dist[i] + 1), (queue[tail++] = j);
    }
  }
  // Grosor local: la mayor distancia a la arena en una ventana alrededor de cada píxel. Así un muro fino que nace
  // de una cresta gruesa se mide por sí mismo y no desaparece.
  const R = 7;
  const rowMax = new Int32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, x - R); k <= Math.min(w - 1, x + R); k++) m = Math.max(m, dist[y * w + k]);
    rowMax[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (data[i] > 0.5 || outside[i]) continue;
    let local = 0;
    for (let k = Math.max(0, y - R); k <= Math.min(h - 1, y + R); k++) local = Math.max(local, rowMax[k * w + x]);
    // Cada cresta conserva un núcleo de ~4 px de radio.
    if (dist[i] <= Math.min(px, Math.max(0, local - 4))) data[i] = 1;
  }
}

/** Píxeles transitables (> 0.5) conectados con el punto de partida. */
function floodFrom(mask: Mask, sx: number, sy: number): Uint8Array {
  const { w, h, data } = mask;
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < (h - 1) * w ? i + w : -1]) {
      if (j >= 0 && !seen[j] && data[j] > 0.5) (seen[j] = 1), stack.push(j);
    }
  }
  return seen;
}

/** Píxeles no transitables conectados con el borde de la grilla. */
function floodOutside(sand: Mask): Uint8Array {
  const { w, h, data } = sand;
  const out = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!out[i] && data[i] <= 0.5) (out[i] = 1), stack.push(i);
  };
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < (h - 1) * w) push(i + w);
  }
  return out;
}

function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
