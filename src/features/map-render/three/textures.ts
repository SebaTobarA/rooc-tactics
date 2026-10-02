import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

/** Textura de canvas con caché por clave, para sprites e íconos (sin arte del juego). */
export function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  cache.set(key, tex);
  return tex;
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export interface TokenLook {
  abbr: string;
  color: string;
  ring: string;
  party?: number;
  roleColor?: string;
  label: string;
  selected: boolean;
  locked: boolean;
}

/** Token: círculo del job con anillo de equipo, número de party, punto de rol y etiqueta. 256×256. */
export function tokenTexture(t: TokenLook): THREE.CanvasTexture {
  return canvasTexture(`token:${JSON.stringify(t)}`, 256, 256, (ctx) => {
    const cx = 128;
    const cy = 104;
    if (t.selected) {
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = t.locked ? 0.8 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = t.ring;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(t.abbr, cx, cy + 3);
    if (t.party != null) {
      ctx.beginPath();
      ctx.arc(cx + 52, cy - 52, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(t.party), cx + 52, cy - 50);
    }
    if (t.roleColor) {
      ctx.beginPath();
      ctx.arc(cx - 52, cy + 52, 20, 0, Math.PI * 2);
      ctx.fillStyle = t.roleColor;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }
    ctx.font = 'bold 30px system-ui, sans-serif';
    outlined(ctx, t.label, cx, 220, '#fff');
  });
}

/** Etiqueta de texto con borde. El ancho se ajusta al texto; devuelve también la relación de aspecto. */
export function labelTexture(text: string, color = '#fff', size = 44): { texture: THREE.CanvasTexture; aspect: number } {
  const w = Math.max(64, Math.ceil(text.length * size * 0.62) + 24);
  const h = size + 24;
  const texture = canvasTexture(`label:${text}:${color}:${size}`, w, h, (ctx) => {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlined(ctx, text, w / 2, h / 2, color);
  });
  return { texture, aspect: w / h };
}

export function pingTexture(color: string, selected: boolean): THREE.CanvasTexture {
  return canvasTexture(`ping:${color}:${selected}`, 128, 128, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(64, 14);
    ctx.lineTo(116, 106);
    ctx.lineTo(12, 106);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = selected ? '#38bdf8' : '#111827';
    ctx.stroke();
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111827';
    ctx.fillText('!', 64, 72);
  });
}
