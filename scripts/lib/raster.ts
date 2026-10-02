import sharp from 'sharp';

export interface Rgb {
  data: Buffer;
  w: number;
  h: number;
}

export interface Mask {
  data: Float32Array;
  w: number;
  h: number;
}

export async function loadRgb(path: string): Promise<Rgb> {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export function maskFrom(w: number, h: number, fn: (x: number, y: number) => boolean): Mask {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fn(x, y) ? 1 : 0;
  return { data, w, h };
}

/** Desenfoque de caja separable; dos pasadas se aproximan a un gaussiano. */
export function blur(mask: Mask, radius: number, passes = 2): Mask {
  const { w, h } = mask;
  let src = mask.data;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const n = radius * 2 + 1;
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += src[y * w + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / n;
        acc += src[y * w + clamp(x + radius + 1, 0, w - 1)] - src[y * w + clamp(x - radius, 0, w - 1)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        acc += tmp[clamp(y + radius + 1, 0, h - 1) * w + x] - tmp[clamp(y - radius, 0, h - 1) * w + x];
      }
    }
    src = out;
  }
  return { data: src, w, h };
}

export const UNKNOWN = 255;

/** Rellena los píxeles UNKNOWN con la clase del píxel clasificado más cercano (BFS multi-origen). */
export function nearestFill(classes: Uint8Array, w: number, h: number): void {
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < classes.length; i++) if (classes[i] !== UNKNOWN) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    const c = classes[i];
    if (x > 0 && classes[i - 1] === UNKNOWN) (classes[i - 1] = c), (queue[tail++] = i - 1);
    if (x < w - 1 && classes[i + 1] === UNKNOWN) (classes[i + 1] = c), (queue[tail++] = i + 1);
    if (y > 0 && classes[i - w] === UNKNOWN) (classes[i - w] = c), (queue[tail++] = i - w);
    if (y < h - 1 && classes[i + w] === UNKNOWN) (classes[i + w] = c), (queue[tail++] = i + w);
  }
}

export interface Component {
  area: number;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Componentes conexas (4-vecinos) de los píxeles con valor > 0.5. */
export function components(mask: Mask): Component[] {
  const { w, h, data } = mask;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const out: Component[] = [];
  for (let start = 0; start < data.length; start++) {
    if (seen[start] || data[start] <= 0.5) continue;
    const c: Component = { area: 0, cx: 0, cy: 0, minX: w, maxX: 0, minY: h, maxY: 0 };
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      c.area++;
      c.cx += x;
      c.cy += y;
      c.minX = Math.min(c.minX, x);
      c.maxX = Math.max(c.maxX, x);
      c.minY = Math.min(c.minY, y);
      c.maxY = Math.max(c.maxY, y);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && data[j] > 0.5) (seen[j] = 1), stack.push(j);
      }
    }
    c.cx /= c.area;
    c.cy /= c.area;
    out.push(c);
  }
  return out;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
