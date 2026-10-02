import { modeById } from '../../config/modes/index.ts';
import { clamp01, round4 } from '../../lib/geometry.ts';
import { newId } from '../../lib/id.ts';
import { emptyParty, useStrategyStore } from '../../store/strategyStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { Party, Raid, Step, Strategy, Token, Vec2 } from '../../types/index.ts';
import { placePlayers } from './partyActions.ts';

const store = () => useStrategyStore.getState();
const change = (fn: (s: Strategy) => Strategy) => {
  store().checkpoint();
  store().set(fn);
};
const clampVec = (p: Vec2): Vec2 => ({ x: round4(clamp01(p.x)), y: round4(clamp01(p.y)) });
const centroidOf = (tokens: Token[]): Vec2 | null =>
  tokens.length ? { x: tokens.reduce((a, t) => a + t.pos.x, 0) / tokens.length, y: tokens.reduce((a, t) => a + t.pos.y, 0) / tokens.length } : null;

export const raidOf = (raids: Raid[], partyId: string) => raids.find((r) => r.partyIds.includes(partyId));
export const isGroup = (t: Token, type: 'party' | 'raid', id: string) => t.group?.type === type && t.group.id === id;
export const partyMembers = (party: Party) => party.slots.filter((x): x is string => !!x);
export const raidPlayerCount = (raid: Raid, parties: Party[]) =>
  raid.partyIds.reduce((a, id) => a + partyMembers(parties.find((p) => p.id === id) ?? ({ slots: [] } as unknown as Party)).length, 0);

// ---------- Raids ----------

export function addRaid(): void {
  change((s) => {
    const number = Math.max(0, ...s.raids.map((r) => r.number)) + 1;
    return { ...s, raids: [...s.raids, { id: newId('raid'), name: `Raid ${number}`, number, partyIds: [] }] };
  });
}

export function removeRaid(id: string): void {
  change((s) => ({
    ...s,
    raids: s.raids.filter((r) => r.id !== id),
    steps: s.steps.map((step) => ({ ...step, tokens: step.tokens.filter((t) => !isGroup(t, 'raid', id)) })),
  }));
}

export function renameRaid(id: string, name: string): void {
  store().set((s) => ({ ...s, raids: s.raids.map((r) => (r.id === id ? { ...r, name } : r)) }));
}

/** Mueve una party a una raid (o la deja suelta con `null`). Respeta el máximo de partys por raid del modo. */
export function setPartyRaid(partyId: string, raidId: string | null): string | null {
  const s = store().strategy;
  const max = modeById(s.modeId)?.raidMaxParties ?? 8;
  const target = s.raids.find((r) => r.id === raidId);
  if (target && !target.partyIds.includes(partyId) && target.partyIds.length >= max) return `${target.name} ya tiene ${max} partys.`;
  change((st) => ({
    ...st,
    raids: st.raids.map((r) => {
      const rest = r.partyIds.filter((id) => id !== partyId);
      return { ...r, partyIds: r.id === raidId ? [...rest, partyId] : rest };
    }),
  }));
  return null;
}

/**
 * Arma una formación: una raid por cada tamaño (en jugadores), repartiendo las partys en orden.
 * Crea las partys que falten; las que sobren quedan sueltas. No toca los jugadores.
 */
export function applyFormation(sizes: number[]): void {
  change((s) => {
    const mode = modeById(s.modeId);
    const partySize = mode?.partySize ?? 5;
    const max = mode?.raidMaxParties ?? 8;
    const counts = sizes.map((n) => Math.min(max, Math.ceil(n / partySize)));
    const needed = counts.reduce((a, b) => a + b, 0);
    const parties = [...s.parties];
    while (parties.length < needed) parties.push(emptyParty(Math.max(0, ...parties.map((p) => p.number)) + 1, partySize));
    let next = 0;
    const raids: Raid[] = counts.map((count, i) => {
      const partyIds = parties.slice(next, next + count).map((p) => p.id);
      next += count;
      return { id: newId('raid'), name: `Raid ${i + 1}`, number: i + 1, partyIds };
    });
    const kept = new Set(raids.map((r) => r.id));
    // Las fichas de raids anteriores ya no representan a nadie.
    const steps = s.steps.map((step) => ({ ...step, tokens: step.tokens.filter((t) => t.group?.type !== 'raid' || kept.has(t.group.id)) }));
    return { ...s, parties, raids, steps };
  });
}

// ---------- Fichas de grupo en el mapa (paso actual) ----------

function upsertGroupToken(step: Step, type: 'party' | 'raid', id: string, pos: Vec2): { step: Step; tokenId: string } {
  const existing = step.tokens.find((t) => isGroup(t, type, id));
  if (existing) return { step: { ...step, tokens: step.tokens.map((t) => (t.id === existing.id ? { ...t, pos: clampVec(pos) } : t)) }, tokenId: existing.id };
  const token: Token = { id: newId('token'), pos: clampVec(pos), jobId: '', team: 'ally', group: { type, id } };
  return { step: { ...step, tokens: [...step.tokens, token] }, tokenId: token.id };
}

/** Pone (o mueve) la ficha única de una party o raid en el paso actual. */
export function placeGroupToken(type: 'party' | 'raid', id: string, pos: Vec2): string[] {
  let tokenId = '';
  store().checkpoint();
  store().setStep((step) => {
    const r = upsertGroupToken(step, type, id, pos);
    tokenId = r.tokenId;
    return r.step;
  });
  return [tokenId];
}

/** Posición por defecto: junto al respawn de mi guild, hacia el centro y en abanico según el índice. */
export function spawnPosition(respawn: Vec2 | undefined, index: number): Vec2 {
  const base = respawn ?? { x: 0.5, y: 0.5 };
  const toward = { x: Math.sign(0.5 - base.x) || 1, y: Math.sign(0.5 - base.y) || 1 };
  return { x: base.x + toward.x * (0.05 + (index % 4) * 0.06), y: base.y + toward.y * (0.09 + Math.floor(index / 4) * 0.11) };
}

/** La raid deja de moverse unida en este paso: su ficha se reemplaza por una ficha por party, en abanico. */
export function splitRaid(raidId: string, fallback: Vec2): string[] {
  const raid = store().strategy.raids.find((r) => r.id === raidId);
  if (!raid?.partyIds.length) {
    useUiStore.getState().notify('Esa raid no tiene partys.');
    return [];
  }
  const ids: string[] = [];
  store().checkpoint();
  store().setStep((step) => {
    const origin = step.tokens.find((t) => isGroup(t, 'raid', raidId))?.pos ?? fallback;
    let next: Step = { ...step, tokens: step.tokens.filter((t) => !isGroup(t, 'raid', raidId)) };
    raid.partyIds.forEach((partyId, i) => {
      const angle = (i / raid.partyIds.length) * Math.PI * 2 - Math.PI / 2;
      const r = raid.partyIds.length > 1 ? 0.045 : 0;
      const res = upsertGroupToken(next, 'party', partyId, { x: origin.x + Math.cos(angle) * r, y: origin.y + Math.sin(angle) * r * 1.7 });
      next = res.step;
      ids.push(res.tokenId);
    });
    return next;
  });
  return ids;
}

/** La raid vuelve a moverse unida en este paso: se quitan las fichas de sus partys y queda una sola, en su centro. */
export function mergeRaid(raidId: string, fallback: Vec2): string[] {
  const raid = store().strategy.raids.find((r) => r.id === raidId);
  if (!raid) return [];
  let tokenId = '';
  store().checkpoint();
  store().setStep((step) => {
    const mine = step.tokens.filter((t) => t.group?.type === 'party' && raid.partyIds.includes(t.group.id));
    const pos = centroidOf(mine) ?? step.tokens.find((t) => isGroup(t, 'raid', raidId))?.pos ?? fallback;
    const res = upsertGroupToken({ ...step, tokens: step.tokens.filter((t) => !mine.includes(t)) }, 'raid', raidId, pos);
    tokenId = res.tokenId;
    return res.step;
  });
  return [tokenId];
}

/** La party se despliega en este paso: su ficha se reemplaza por un token por jugador. */
export function splitParty(partyId: string, fallback: Vec2): string[] {
  const { strategy, stepIndex } = store();
  const party = strategy.parties.find((p) => p.id === partyId);
  const members = party ? partyMembers(party) : [];
  if (!party || !members.length) {
    useUiStore.getState().notify(`${party?.name ?? 'La party'} no tiene jugadores: agrégale jobs en la pestaña Partys.`);
    return [];
  }
  const origin = strategy.steps[stepIndex].tokens.find((t) => isGroup(t, 'party', partyId))?.pos ?? fallback;
  // placePlayers guarda el punto de deshacer; quitar la ficha va en el mismo cambio.
  const ids = placePlayers(members, origin);
  store().setStep((step) => ({ ...step, tokens: step.tokens.filter((t) => !isGroup(t, 'party', partyId)) }));
  return ids;
}

/** La party vuelve a ser una sola ficha en este paso: se quitan los tokens de sus jugadores. */
export function mergeParty(partyId: string, fallback: Vec2): string[] {
  const party = store().strategy.parties.find((p) => p.id === partyId);
  if (!party) return [];
  const members = new Set(partyMembers(party));
  let tokenId = '';
  store().checkpoint();
  store().setStep((step) => {
    const mine = step.tokens.filter((t) => t.playerId && members.has(t.playerId));
    const pos = centroidOf(mine) ?? step.tokens.find((t) => isGroup(t, 'party', partyId))?.pos ?? fallback;
    const res = upsertGroupToken({ ...step, tokens: step.tokens.filter((t) => !mine.includes(t)) }, 'party', partyId, pos);
    tokenId = res.tokenId;
    return res.step;
  });
  return [tokenId];
}
