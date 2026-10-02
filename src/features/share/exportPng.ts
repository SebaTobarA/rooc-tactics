import { jobById } from '../../config/jobs.ts';
import { roleById } from '../../config/roles.ts';
import type { Step, Strategy } from '../../types/index.ts';
import { stageHandle } from '../board/stageHandle.ts';

const LEGEND_W = 300;
const PAD = 16;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Imagen del lienzo activo (2D o 3D) tal como se ve ahora. */
function captureView(view3d: boolean): string | null {
  try {
    if (view3d) return stageHandle.canvas3d?.()?.toDataURL('image/png') ?? null;
    const stage = stageHandle.current;
    return stage && stage.width() > 0 && stage.height() > 0 ? stage.toDataURL({ pixelRatio: 2 }) : null;
  } catch {
    return null;
  }
}

/** Exporta el paso actual a PNG, con título, nota y leyenda de partys, listo para Discord. */
export async function exportPng(strategy: Strategy, step: Step, stepIndex: number, view3d: boolean, background: string): Promise<boolean> {
  const shot = captureView(view3d);
  if (!shot) return false;
  const img = await loadImage(shot);
  const scale = img.height / 800 > 1 ? img.height / 800 : 1;
  const legendW = LEGEND_W * scale;
  const canvas = document.createElement('canvas');
  canvas.width = img.width + legendW;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(img.width, 0, legendW, canvas.height);

  ctx.scale(scale, scale);
  const x = img.width / scale + PAD;
  const w = LEGEND_W - PAD * 2;
  let y = PAD + 16;
  const text = (t: string, font: string, color: string, gap: number) => {
    ctx.font = font;
    ctx.fillStyle = color;
    for (const line of wrap(ctx, t, w)) {
      ctx.fillText(line, x, y);
      y += gap;
    }
  };
  text(strategy.name, 'bold 18px system-ui, sans-serif', '#f8fafc', 22);
  text(`Paso ${stepIndex + 1}/${strategy.steps.length}: ${step.name}`, 'bold 14px system-ui, sans-serif', '#7dd3fc', 18);
  if (step.note) text(step.note, '12px system-ui, sans-serif', '#cbd5e1', 16);
  y += 8;

  for (const party of strategy.parties) {
    const members = party.slots.map((id) => strategy.roster.find((p) => p.id === id)).filter((p) => !!p);
    if (!members.length) continue;
    const raid = strategy.raids.find((r) => r.partyIds.includes(party.id));
    text(`${raid ? raid.name + ' · ' : ''}P${party.number} · ${party.name}`, 'bold 13px system-ui, sans-serif', '#f8fafc', 18);
    for (const m of members) {
      const job = jobById(m.jobId);
      ctx.beginPath();
      ctx.arc(x + 7, y - 4, 7, 0, Math.PI * 2);
      ctx.fillStyle = job?.color ?? '#475569';
      ctx.fill();
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`${m.name} · ${job?.name ?? '?'}${m.role ? ' · ' + roleById(m.role)?.short : ''}`, x + 20, y);
      y += 16;
    }
    y += 6;
  }

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${strategy.name || 'estrategia'} - paso ${stepIndex + 1}.png`;
  a.click();
  return true;
}
