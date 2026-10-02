import { jobById, jobs } from '../../config/jobs.ts';
import { modeById } from '../../config/modes/index.ts';
import { roles } from '../../config/roles.ts';
import { clamp01, round4 } from '../../lib/geometry.ts';
import { newId } from '../../lib/id.ts';
import { emptyParty, useStrategyStore } from '../../store/strategyStore.ts';
import type { Party, Player, RoleId, Strategy, Token, Vec2 } from '../../types/index.ts';

const store = () => useStrategyStore.getState();
const change = (fn: (s: Strategy) => Strategy) => {
  store().checkpoint();
  store().set(fn);
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Busca un job por id, nombre o siglas, sin distinguir mayúsculas, tildes ni espacios. */
export function findJob(text: string) {
  const key = norm(text);
  if (!key) return undefined;
  return jobs.find((j) => norm(j.id) === key || norm(j.name) === key || norm(j.abbr) === key) ?? jobs.find((j) => norm(j.name).startsWith(key));
}

function findRole(text: unknown): RoleId | undefined {
  if (typeof text !== 'string') return undefined;
  const key = norm(text);
  return roles.find((r) => norm(r.id) === key || norm(r.name) === key || norm(r.short) === key)?.id;
}

export const partyOf = (parties: Party[], playerId: string | undefined) => (playerId ? parties.find((p) => p.slots.includes(playerId)) : undefined);
/** Party de un token: la de su jugador si tiene, o la asignada a mano. */
export const partyOfToken = (parties: Party[], t: Token) => partyOf(parties, t.playerId) ?? parties.find((p) => p.id === t.partyId);

// ---------- Banca ----------

export function addPlayer(name: string, jobId: string, extra: Partial<Player> = {}): void {
  const player: Player = { id: newId('player'), name: name.trim(), jobId, role: jobById(jobId)?.role, ...extra };
  change((s) => ({ ...s, roster: [...s.roster, player] }));
}

export function patchPlayer(id: string, patch: Partial<Player>): void {
  // Los tokens del jugador siguen sus datos en todos los pasos.
  store().set((s) => ({
    ...s,
    roster: s.roster.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    steps: s.steps.map((step) => ({
      ...step,
      tokens: step.tokens.map((t) =>
        t.playerId === id ? { ...t, playerName: patch.name ?? t.playerName, jobId: patch.jobId ?? t.jobId, role: 'role' in patch ? patch.role : t.role } : t,
      ),
    })),
  }));
}

export function removePlayer(id: string): void {
  change((s) => ({
    ...s,
    roster: s.roster.filter((p) => p.id !== id),
    parties: s.parties.map((p) => ({ ...p, slots: p.slots.map((x) => (x === id ? null : x)) })),
    steps: s.steps.map((step) => ({ ...step, tokens: step.tokens.filter((t) => t.playerId !== id) })),
  }));
}

export interface ImportResult {
  added: number;
  errors: string[];
}

/**
 * Importa jugadores desde texto pegado.
 * - Texto: una línea por jugador, `Nombre;Job` (también acepta coma o tabulador, y un tercer campo de rol).
 * - JSON: arreglo de objetos (o `{ players: [...] }`) con `name`/`nombre` y `job`/`jobId`/`class`/`clase`; opcionales `role`/`rol` y `note`/`nota`.
 */
export function importPlayers(text: string): ImportResult {
  const errors: string[] = [];
  const players: Player[] = [];
  const push = (name: unknown, job: unknown, role: unknown, note: unknown, where: string) => {
    if (typeof name !== 'string' || !name.trim()) return void errors.push(`${where}: falta el nombre`);
    const found = typeof job === 'string' ? findJob(job) : undefined;
    if (!found) return void errors.push(`${where}: job desconocido "${String(job ?? '')}"`);
    players.push({ id: newId('player'), name: name.trim(), jobId: found.id, role: findRole(role) ?? found.role, ...(typeof note === 'string' && note ? { note } : {}) });
  };

  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data: unknown = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : (data as { players?: unknown }).players;
      if (!Array.isArray(list)) return { added: 0, errors: ['El JSON debe ser un arreglo de jugadores o { "players": [...] }'] };
      list.forEach((raw: Record<string, unknown>, i) => push(raw.name ?? raw.nombre ?? raw.player, raw.job ?? raw.jobId ?? raw.class ?? raw.clase, raw.role ?? raw.rol, raw.note ?? raw.nota, `Jugador ${i + 1}`));
    } catch {
      return { added: 0, errors: ['JSON inválido'] };
    }
  } else {
    trimmed.split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      const [name, job, role] = line.split(/[;,\t]/).map((x) => x.trim());
      push(name, job, role, undefined, `Línea ${i + 1}`);
    });
  }
  if (players.length) change((s) => ({ ...s, roster: [...s.roster, ...players] }));
  return { added: players.length, errors };
}

// ---------- Partys ----------

export function addParty(): void {
  change((s) => {
    const number = Math.max(0, ...s.parties.map((p) => p.number)) + 1;
    return { ...s, parties: [...s.parties, emptyParty(number, modeById(s.modeId)?.partySize ?? 5)] };
  });
}

export function removeParty(id: string): void {
  change((s) => ({
    ...s,
    parties: s.parties.filter((p) => p.id !== id),
    raids: s.raids.map((r) => ({ ...r, partyIds: r.partyIds.filter((x) => x !== id) })),
    steps: s.steps.map((step) => ({ ...step, tokens: step.tokens.filter((t) => !(t.group?.type === 'party' && t.group.id === id)) })),
  }));
}

export function renameParty(id: string, name: string): void {
  store().set((s) => ({ ...s, parties: s.parties.map((p) => (p.id === id ? { ...p, name } : p)) }));
}

/**
 * Asigna un jugador a una party. Validación estricta: nunca más jugadores que `partySize`,
 * y respeta `maxSameJobPerTeam` del modo. Devuelve el motivo si no se puede.
 */
export function assignPlayer(playerId: string, partyId: string, slot?: number): string | null {
  const s = store().strategy;
  const mode = modeById(s.modeId);
  const party = s.parties.find((p) => p.id === partyId);
  const player = s.roster.find((p) => p.id === playerId);
  if (!party || !player) return 'No existe la party o el jugador.';
  const current = partyOf(s.parties, playerId);
  if (current?.id === partyId && slot == null) return null;
  const from = current ? { partyId: current.id, slot: current.slots.indexOf(playerId) } : null;
  const free = party.slots.indexOf(null);
  // Sobre un slot ocupado: si el jugador ya está en una party se intercambian; si viene de la banca, va al primer slot libre.
  const target = slot != null && (!party.slots[slot] || party.slots[slot] === playerId || from) ? slot : free;
  if (target < 0 || target >= party.slots.length) return `${party.name} ya tiene ${party.slots.length} jugadores.`;
  if (mode?.maxSameJobPerTeam && !current) {
    const assigned = s.parties.flatMap((p) => p.slots).filter((id): id is string => !!id);
    const same = assigned.filter((id) => s.roster.find((p) => p.id === id)?.jobId === player.jobId).length;
    if (same >= mode.maxSameJobPerTeam) return `${mode.name}: máximo ${mode.maxSameJobPerTeam} jugadores del mismo job por equipo.`;
  }
  const occupant = party.slots[target];
  change((st) => ({
    ...st,
    parties: st.parties.map((p) => {
      const slots = p.slots.map((x) => (x === playerId ? null : x));
      if (p.id === partyId) slots[target] = playerId;
      if (occupant && occupant !== playerId && from && p.id === from.partyId) slots[from.slot] = occupant;
      return { ...p, slots };
    }),
  }));
  return null;
}

/** Crea un jugador de relleno con ese job directamente en un slot libre, sin pasar por la banca. */
export function addJobToParty(partyId: string, slot: number, jobId: string): string | null {
  const s = store().strategy;
  const mode = modeById(s.modeId);
  const party = s.parties.find((p) => p.id === partyId);
  const job = jobById(jobId);
  if (!party || !job || party.slots[slot]) return 'Ese slot no está libre.';
  if (mode?.maxSameJobPerTeam) {
    const same = s.parties.flatMap((p) => p.slots).filter((id) => id && s.roster.find((p) => p.id === id)?.jobId === jobId).length;
    if (same >= mode.maxSameJobPerTeam) return `${mode.name}: máximo ${mode.maxSameJobPerTeam} jugadores del mismo job por equipo.`;
  }
  const player: Player = { id: newId('player'), name: `${job.abbr} ${party.number}.${slot + 1}`, jobId, role: job.role };
  change((st) => ({
    ...st,
    roster: [...st.roster, player],
    parties: st.parties.map((p) => (p.id === partyId ? { ...p, slots: p.slots.map((x, i) => (i === slot ? player.id : x)) } : p)),
  }));
  return null;
}

export function unassignPlayer(playerId: string): void {
  change((s) => ({ ...s, parties: s.parties.map((p) => ({ ...p, slots: p.slots.map((x) => (x === playerId ? null : x)) })) }));
}

// ---------- Al mapa ----------

/** Coloca (o mueve) en el paso actual los tokens de los jugadores, agrupados alrededor de `pos`. */
export function placePlayers(playerIds: string[], pos: Vec2): string[] {
  const { strategy } = store();
  const players = playerIds.map((id) => strategy.roster.find((p) => p.id === id)).filter((p): p is Player => !!p);
  if (!players.length) return [];
  const ids: string[] = [];
  store().checkpoint();
  store().setStep((step) => {
    let tokens = step.tokens;
    players.forEach((player, i) => {
      // Uno solo va en el punto; varios se reparten en círculo.
      const angle = (i / players.length) * Math.PI * 2 - Math.PI / 2;
      const r = players.length > 1 ? 0.028 : 0;
      const p = { x: round4(clamp01(pos.x + Math.cos(angle) * r)), y: round4(clamp01(pos.y + Math.sin(angle) * r * 1.7)) };
      const existing = tokens.find((t) => t.playerId === player.id);
      if (existing) {
        tokens = tokens.map((t) => (t.id === existing.id ? { ...t, pos: p } : t));
        ids.push(existing.id);
      } else {
        const token: Token = { id: newId('token'), pos: p, jobId: player.jobId, team: 'ally', playerId: player.id, playerName: player.name, role: player.role };
        tokens = [...tokens, token];
        ids.push(token.id);
      }
    });
    return { ...step, tokens };
  });
  return ids;
}

// ---------- Resumen y plantillas ----------

export interface PartySummary {
  counts: Record<RoleId, number>;
  size: number;
  warnings: string[];
}

export function summarize(party: Party, roster: Player[]): PartySummary {
  const members = party.slots.map((id) => roster.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const counts = Object.fromEntries(roles.map((r) => [r.id, 0])) as Record<RoleId, number>;
  for (const m of members) if (m.role) counts[m.role]++;
  const warnings: string[] = [];
  if (members.length) {
    if (!counts.support) warnings.push('sin curación');
    if (!counts.tank) warnings.push('sin tanque');
    if (members.length < party.slots.length) warnings.push(`${party.slots.length - members.length} slot(s) libre(s)`);
  }
  return { counts, size: members.length, warnings };
}

export interface PartyTemplate {
  id: string;
  name: string;
  slots: ({ jobId: string; role?: RoleId } | null)[];
  builtin?: boolean;
}

const TEMPLATES_KEY = 'rooc-tactics:party-templates';
const t = (jobId: string) => ({ jobId, role: jobById(jobId)?.role });

// Ejemplos de partida; se pueden pisar guardando plantillas propias.
const BUILTIN: PartyTemplate[] = [
  { id: 'builtin-choque', name: 'Party de choque', builtin: true, slots: [t('paladin'), t('lord-knight'), t('champion'), t('high-priest'), t('professor')] },
  { id: 'builtin-captura', name: 'Party de captura', builtin: true, slots: [t('paladin'), t('high-priest'), t('high-wizard'), t('minstrel'), t('stalker')] },
  { id: 'builtin-pilar', name: 'Party de pilar', builtin: true, slots: [t('sniper'), t('assassin-cross'), t('whitesmith'), t('creator'), t('high-priest')] },
];

export function listTemplates(): PartyTemplate[] {
  try {
    return [...BUILTIN, ...(JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? '[]') as PartyTemplate[])];
  } catch {
    return BUILTIN;
  }
}

export function saveTemplate(name: string, party: Party, roster: Player[]): void {
  const slots = party.slots.map((id) => {
    const p = roster.find((x) => x.id === id);
    return p ? { jobId: p.jobId, role: p.role } : null;
  });
  const own = listTemplates().filter((x) => !x.builtin && x.name !== name);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify([...own, { id: newId('tpl'), name, slots }]));
}

export function deleteTemplate(id: string): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(listTemplates().filter((x) => !x.builtin && x.id !== id)));
}

/** Rellena los slots libres de la party con jugadores de relleno según la plantilla. */
export function applyTemplate(partyId: string, template: PartyTemplate): void {
  change((s) => {
    const party = s.parties.find((p) => p.id === partyId);
    if (!party) return s;
    const added: Player[] = [];
    const slots = party.slots.map((current, i) => {
      const slot = template.slots[i];
      if (current || !slot) return current;
      const player: Player = { id: newId('player'), name: `${jobById(slot.jobId)?.abbr ?? '?'} ${party.number}.${i + 1}`, jobId: slot.jobId, role: slot.role };
      added.push(player);
      return player.id;
    });
    return { ...s, roster: [...s.roster, ...added], parties: s.parties.map((p) => (p.id === partyId ? { ...p, slots, templateId: template.id } : p)) };
  });
}
