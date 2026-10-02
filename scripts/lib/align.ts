import type { AxisTransform, Vec2 } from '../../src/types/index.ts';
import type { Rgb } from './raster.ts';

/** Ajusta por mínimos cuadrados destino = origen * s + t, con escala independiente por eje. */
export function fitAxisTransform(pairs: { from: Vec2; to: Vec2 }[]): AxisTransform {
  const fit = (axis: 'x' | 'y') => {
    const n = pairs.length;
    const mf = pairs.reduce((a, p) => a + p.from[axis], 0) / n;
    const mt = pairs.reduce((a, p) => a + p.to[axis], 0) / n;
    let num = 0;
    let den = 0;
    for (const p of pairs) {
      num += (p.from[axis] - mf) * (p.to[axis] - mt);
      den += (p.from[axis] - mf) ** 2;
    }
    const s = num / den;
    return { s, t: mt - s * mf };
  };
  const x = fit('x');
  const y = fit('y');
  return { sx: x.s, sy: y.s, tx: x.t, ty: y.t };
}

type ColorTest = (r: number, g: number, b: number) => boolean;

/**
 * Refina un punto de referencia estimado a mano: centroide de los píxeles que cumplen
 * `test` dentro de una ventana alrededor de la estimación. Si hay muy pocos, se queda con la estimación.
 */
export function refineLandmark(img: Rgb, guess: Vec2, radius: number, test: ColorTest): Vec2 & { refined: boolean } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = Math.max(0, guess.y - radius); y <= Math.min(img.h - 1, guess.y + radius); y++) {
    for (let x = Math.max(0, guess.x - radius); x <= Math.min(img.w - 1, guess.x + radius); x++) {
      const i = (y * img.w + x) * 3;
      if (test(img.data[i], img.data[i + 1], img.data[i + 2])) (sx += x), (sy += y), n++;
    }
  }
  return n >= 20 ? { x: sx / n, y: sy / n, refined: true } : { ...guess, refined: false };
}
