import { jobById } from '../config/jobs.ts';
import { clamp01, round4 } from '../lib/geometry.ts';
import { newId } from '../lib/id.ts';
import type { Drawing, ObjectiveState, Token, Vec2 } from '../types/index.ts';
import { useStrategyStore } from './strategyStore.ts';
import { useUiStore } from './uiStore.ts';

const store = () => useStrategyStore.getState();
const shift = (p: Vec2, d: Vec2): Vec2 => ({ x: round4(clamp01(p.x + d.x)), y: round4(clamp01(p.y + d.y)) });

export function addToken(jobId: string, pos: Vec2, extra: Partial<Token> = {}): string {
  const id = newId('token');
  const token: Token = { id, pos, jobId, team: useUiStore.getState().newTokenTeam, role: jobById(jobId)?.role, ...extra };
  store().checkpoint();
  store().setStep((s) => ({ ...s, tokens: [...s.tokens, token] }));
  return id;
}

export function addDrawing(drawing: Omit<Drawing, 'id'>): string {
  const id = newId('draw');
  store().checkpoint();
  store().setStep((s) => ({ ...s, drawings: [...s.drawings, { ...drawing, id }] }));
  return id;
}

/** Mueve tokens y dibujos (sin punto de deshacer: llamar a checkpoint al empezar el arrastre). */
export function moveItems(ids: string[], delta: Vec2): void {
  const set = new Set(ids);
  store().setStep((s) => ({
    ...s,
    tokens: s.tokens.map((t) => (set.has(t.id) && !t.locked ? { ...t, pos: shift(t.pos, delta) } : t)),
    drawings: s.drawings.map((d) => (set.has(d.id) && !d.locked ? { ...d, points: d.points.map((p) => shift(p, delta)) } : d)),
  }));
}

export function removeItems(ids: string[]): void {
  if (!ids.length) return;
  const set = new Set(ids);
  store().checkpoint();
  store().setStep((s) => ({ ...s, tokens: s.tokens.filter((t) => !set.has(t.id)), drawings: s.drawings.filter((d) => !set.has(d.id)) }));
  useUiStore.getState().setSelection([]);
}

export function duplicateItems(ids: string[]): void {
  if (!ids.length) return;
  const set = new Set(ids);
  const offset = { x: 0.02, y: 0.02 };
  const created: string[] = [];
  store().checkpoint();
  store().setStep((s) => {
    const tokens = s.tokens.filter((t) => set.has(t.id)).map((t) => ({ ...t, id: newId('token'), pos: shift(t.pos, offset), locked: false }));
    const drawings = s.drawings.filter((d) => set.has(d.id)).map((d) => ({ ...d, id: newId('draw'), points: d.points.map((p) => shift(p, offset)), locked: false }));
    created.push(...tokens.map((t) => t.id), ...drawings.map((d) => d.id));
    return { ...s, tokens: [...s.tokens, ...tokens], drawings: [...s.drawings, ...drawings] };
  });
  useUiStore.getState().setSelection(created);
}

export function patchToken(id: string, patch: Partial<Token>): void {
  store().setStep((s) => ({ ...s, tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
}

export function patchDrawing(id: string, patch: Partial<Drawing>): void {
  store().setStep((s) => ({ ...s, drawings: s.drawings.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

export function toggleLock(ids: string[]): void {
  const set = new Set(ids);
  store().checkpoint();
  store().setStep((s) => {
    const lock = !([...s.tokens, ...s.drawings].filter((x) => set.has(x.id)).every((x) => x.locked));
    return {
      ...s,
      tokens: s.tokens.map((t) => (set.has(t.id) ? { ...t, locked: lock } : t)),
      drawings: s.drawings.map((d) => (set.has(d.id) ? { ...d, locked: lock } : d)),
    };
  });
}

export function setObjective(markerId: string, patch: Partial<ObjectiveState>): void {
  store().checkpoint();
  store().setStep((s) => {
    const current = s.objectives.find((o) => o.markerId === markerId) ?? { markerId, status: 'pending' as const };
    return { ...s, objectives: [...s.objectives.filter((o) => o.markerId !== markerId), { ...current, ...patch }] };
  });
}
