import type { MapGeometry, MapStyle, Polygon, Vec2 } from '../../src/types/index.ts';

const path = (rings: Vec2[][], w: number, h: number) =>
  rings.map((r) => 'M' + r.map((p) => `${(p.x * w).toFixed(1)},${(p.y * h).toFixed(1)}`).join('L') + 'Z').join('');

const poly = (p: Polygon, w: number, h: number, attrs: string) =>
  `<path fill-rule="evenodd" d="${path([p.points, ...(p.holes ?? [])], w, h)}" ${attrs}/>`;

interface Options {
  /** true: colores de depuración semitransparentes para superponer sobre la foto. */
  overlay: boolean;
  landmarks?: Vec2[];
}

/** SVG del mapa propio. Los radios de las plazas están en unidades del ancho del mapa. */
export function geometryToSvg(geo: MapGeometry, style: MapStyle, w: number, h: number, { overlay, landmarks }: Options): string {
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
  if (overlay) {
    parts.push(`<path d="${path([geo.bounds], w, h)}" fill="none" stroke="#ff2bd6" stroke-width="2.5"/>`);
    for (const p of geo.obstacles) parts.push(poly(p, w, h, 'fill="#00e5ff" fill-opacity="0.12" stroke="#00e5ff" stroke-width="1"'));
    for (const p of geo.walkable) parts.push(poly(p, w, h, 'fill="#ffe14d" fill-opacity="0.38" stroke="#fff3a0" stroke-width="2"'));
    for (const p of geo.water) parts.push(poly(p, w, h, 'fill="#2f7bff" fill-opacity="0.45" stroke="#9cc4ff" stroke-width="2"'));
    for (const c of geo.plazas)
      parts.push(`<circle cx="${c.center.x * w}" cy="${c.center.y * h}" r="${c.radius * w}" fill="#ffffff" fill-opacity="0.2" stroke="#ffffff" stroke-width="2.5"/>`);
    for (const l of landmarks ?? [])
      parts.push(`<path d="M${l.x * w - 12},${l.y * h}h24M${l.x * w},${l.y * h - 12}v24" stroke="#ff2b2b" stroke-width="3"/>`);
  } else {
    parts.push(
      `<defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${style.textureOpacity} 0"/></filter>` +
        `<filter id="soft"><feGaussianBlur stdDeviation="6"/></filter><clipPath id="b"><path d="${path([geo.bounds], w, h)}"/></clipPath></defs>`,
      `<rect width="${w}" height="${h}" fill="${style.fog}"/>`,
      `<path d="${path([geo.bounds], w, h)}" fill="${style.forestShade}" filter="url(#soft)"/>`,
      `<path d="${path([geo.bounds], w, h)}" fill="${style.forest}" stroke="${style.forestShade}" stroke-width="3" stroke-linejoin="round"/>`,
      '<g clip-path="url(#b)">',
    );
    for (const p of geo.water) parts.push(poly(p, w, h, `fill="${style.water}" stroke="${style.water}" stroke-width="6" stroke-linejoin="round" stroke-opacity="0.4"`));
    for (const p of geo.walkable)
      parts.push(poly(p, w, h, `fill="${style.walkable}" stroke="${style.walkableStroke}" stroke-width="4" stroke-linejoin="round"`));
    for (const c of geo.plazas)
      parts.push(`<circle cx="${c.center.x * w}" cy="${c.center.y * h}" r="${c.radius * w}" fill="${style.plaza}" stroke="${style.plazaStroke}" stroke-width="3"/>`);
    parts.push('</g>', `<rect width="${w}" height="${h}" filter="url(#n)"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
