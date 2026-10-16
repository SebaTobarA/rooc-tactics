import * as THREE from 'three';
import { hillshade } from '../../../lib/elevation.ts';
import { mulberry32, type Tree } from '../../../lib/forest.ts';
import type { MapConfig, Vec2 } from '../../../types/index.ts';

const WIDTH = 3072;

/**
 * Textura del suelo de la vista 3D, pintada desde la misma geometría que el mapa 2D:
 * tierra de bosque, senderos de arena con borde de pasto, agua y sombras horneadas de árboles y muros.
 * Hornear las sombras aquí evita los mapas de sombra en tiempo real (pensado para gráficas integradas).
 */
export function buildGroundTexture(map: MapConfig, trees: Tree[]): THREE.CanvasTexture {
  const { geometry: g, style } = map;
  const forest = (style.terrain ?? 'forest') === 'forest';
  /** Color de las sombras horneadas: verdoso en el bosque, pardo en el cañón y las ruinas. */
  const shade = (a: number) => (forest ? `rgba(8,24,14,${a})` : `rgba(28,16,8,${a})`);
  const W = WIDTH;
  const H = Math.round(WIDTH / map.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(3);
  /** Los tamaños en px están pensados para 2048 de ancho. */
  const k = W / 2048;
  const path = (rings: Vec2[][]) => {
    const p = new Path2D();
    for (const ring of rings) {
      ring.forEach((v, i) => (i ? p.lineTo(v.x * W, v.y * H) : p.moveTo(v.x * W, v.y * H)));
      p.closePath();
    }
    return p;
  };
  const speckle = (count: number, colors: string[], min: number, max: number) => {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, (min + rand() * (max - min)) * k, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Fuera del contorno la textura queda transparente.
  const bounds = path([g.bounds]);
  ctx.save();
  ctx.clip(bounds);
  ctx.fillStyle = forest ? '#1c452b' : style.forestShade;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5;
  speckle(5000, forest ? ['#173a24', '#24573a', '#2a6340', '#15331f'] : [style.forest, style.canopyShade, ...style.canopy], 3, 12);
  ctx.globalAlpha = 1;

  for (const p of g.water) {
    const shape = path([p.points]);
    ctx.fillStyle = style.water;
    ctx.fill(shape);
    ctx.save();
    ctx.clip(shape);
    ctx.strokeStyle = '#a9d6f7';
    ctx.lineWidth = 16 * k;
    ctx.shadowColor = '#a9d6f7';
    ctx.shadowBlur = 22 * k;
    ctx.stroke(shape);
    ctx.restore();
  }

  for (const p of g.walkable) {
    const shape = path([p.points, ...(p.holes ?? [])]);
    ctx.fillStyle = style.walkable;
    ctx.fill(shape, 'evenodd');
    ctx.save();
    ctx.clip(shape, 'evenodd');
    // Variación de la arena.
    ctx.globalAlpha = 0.35;
    speckle(2600, ['#cdb97a', '#e6d8a4', '#d2bf83', '#bfa96a'], 2, 9);
    // Huellas de viento en la arena del cañón.
    if (!forest) speckle(900, [style.grass], 6, 22);
    ctx.globalAlpha = 1;
    // Pasto: borde ancho y difuso hacia adentro; la arena queda al centro de los senderos.
    ctx.strokeStyle = style.grass;
    ctx.lineJoin = 'round';
    ctx.shadowColor = style.grass;
    ctx.shadowBlur = 34 * k;
    ctx.lineWidth = 40 * k;
    ctx.stroke(shape);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = forest ? '#5c9a3a' : style.walkableStroke;
    ctx.lineWidth = 16 * k;
    ctx.stroke(shape);
    ctx.globalAlpha = 1;
    // Sombra del muro de ruinas y del bosque sobre el claro.
    ctx.strokeStyle = shade(0.55);
    ctx.shadowColor = shade(0.9);
    ctx.shadowBlur = 12 * k;
    ctx.shadowOffsetX = 5 * k;
    ctx.shadowOffsetY = 7 * k;
    ctx.lineWidth = 5 * k;
    ctx.stroke(shape);
    // Rampas y mesetas: sombreado del relieve, recortado al sendero.
    const shade3d = hillshade(g, map.aspect);
    if (shade3d) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(shade3d, 0, 0, W, H);
    }
    ctx.restore();
  }

  // Sombras de los árboles, desplazadas hacia donde cae la luz.
  ctx.fillStyle = 'rgba(6,20,11,0.34)';
  for (const t of trees) {
    ctx.beginPath();
    ctx.ellipse(t.pos.x * W + 13 * t.size * k, t.pos.y * H + 17 * t.size * k, 21 * t.size * k, 15 * t.size * k, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
