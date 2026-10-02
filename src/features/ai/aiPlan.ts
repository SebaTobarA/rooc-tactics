import { jobById, jobs } from '../../config/jobs.ts';
import { modeById } from '../../config/modes/index.ts';
import { roles } from '../../config/roles.ts';
import { clamp01, round4 } from '../../lib/geometry.ts';
import { newId } from '../../lib/id.ts';
import { zoneCenters, zoneOf } from '../../lib/numpad.ts';
import { route, snapToWalkable } from '../../lib/walk.ts';
import { tierPoints, useScoringStore } from '../../store/scoringStore.ts';
import { emptyParty, emptyStep } from '../../store/strategyStore.ts';
import type { Drawing, MapConfig, ObjectiveStatus, Party, Player, Raid, Step, Strategy, Token, Vec2 } from '../../types/index.ts';
import { findJob } from '../party/partyActions.ts';

/**
 * Puente con Claude sin API ni costo extra: la web arma las instrucciones, el estratega las pega
 * en su chat de Claude, y pega de vuelta el bloque JSON de la respuesta. Aquí se arma el texto,
 * se lee la respuesta y se convierte en pasos del tablero.
 */

type Place = string | { zone: number } | { x: number; y: number };

interface AiPlan {
  name?: string;
  parties?: { number: number; name?: string; jobs?: string[] }[];
  raids?: { number: number; name?: string; parties: number[] }[];
  steps: {
    name: string;
    note?: string;
    groups?: { type: 'raid' | 'party'; number: number; at: Place }[];
    arrows?: { from: Place; to: Place; color?: string; curved?: boolean }[];
    texts?: { at: Place; text: string; color?: string }[];
    zones?: { at: Place; radius?: number; color?: string }[];
    pings?: { at: Place; color?: string }[];
    objectives?: { marker: string; status?: ObjectiveStatus; tier?: string; timerSeconds?: number; ticks?: number }[];
  }[];
}

const STATUSES: ObjectiveStatus[] = ['pending', 'active', 'destroyed', 'captured-green', 'captured-red'];
const COLORS = { blanco: '#f8fafc', rojo: '#ef4444', naranja: '#f97316', amarillo: '#facc15', verde: '#34c759', celeste: '#38bdf8', morado: '#a78bfa', rosa: '#f472b6' };

const EXAMPLE = `{
  "name": "Apertura a S y reparto",
  "raids": [{ "number": 1, "name": "Raid 1", "parties": [1, 2, 3, 4] }, { "number": 2, "name": "Raid 2", "parties": [5, 6, 7, 8] }],
  "parties": [{ "number": 1, "name": "Choque", "jobs": ["paladin", "lord-knight", "champion", "high-priest", "professor"] }],
  "steps": [
    {
      "name": "0:00 Todos a S",
      "note": "Las dos raids entran juntas al pilar central.",
      "groups": [{ "type": "raid", "number": 1, "at": "central-pillar" }, { "type": "raid", "number": 2, "at": "central-pillar" }],
      "arrows": [{ "from": "respawn-green-1", "to": "central-pillar", "color": "#34c759" }],
      "texts": [{ "at": { "zone": 8 }, "text": "Entrar por el norte", "color": "#f8fafc" }],
      "zones": [{ "at": "central-pillar", "radius": 0.07, "color": "#facc15" }],
      "pings": [{ "at": { "zone": 2 } }],
      "objectives": [{ "marker": "central-pillar", "status": "active", "tier": "S" }]
    }
  ]
}`;

/** Instrucciones completas para pegar en el chat de Claude. */
export function buildPrompt(request: string, strategy: Strategy, map: MapConfig): string {
  const mode = modeById(strategy.modeId);
  const scoring = mode?.scoring;
  const side = strategy.allySide === 'green' ? 'Verde' : 'Roja';
  const markers = map.markers
    .map((m) => `- "${m.id}": ${m.label}${m.tier ? ` (tier ${m.tier})` : ''}${m.side ? ` (guild ${m.side === 'green' ? 'Verde' : 'Roja'})` : ''}${m.confirmed ? '' : ' [función por confirmar]'} — zona ${zoneOf(m.pos, map.numpad)}, x ${m.pos.x.toFixed(2)}, y ${m.pos.y.toFixed(2)}`)
    .join('\n');
  const points = tierPoints(strategy.modeId, useScoringStore.getState().overrides);
  const tiers = points.tiers.map((t) => `${t.id}: romper el sello ${t.destroy ?? 'sin dato'}, captura ${t.capturePerTick ?? 'sin dato'} por tick hasta ${t.maxTicks ?? '?'} ticks`).join('; ') + (points.tickSeconds ? ` (un tick cada ${points.tickSeconds} s)` : '');
  const pending = mode?.scoring?.pendingRules?.length ? `\n- Sin confirmar (no lo des por hecho): ${mode.scoring.pendingRules.join(' ')}` : '';
  const player = (id: string | null) => {
    const p = strategy.roster.find((x) => x.id === id);
    return p ? `${p.name} (${jobById(p.jobId)?.name ?? '?'})` : null;
  };
  const parties = strategy.parties
    .map((p) => {
      const raid = strategy.raids.find((r) => r.partyIds.includes(p.id));
      const members = p.slots.map(player).filter(Boolean);
      return `- Party ${p.number} "${p.name}"${raid ? ` [${raid.name}]` : ' [suelta]'}: ${members.length ? members.join(', ') : 'vacía'}`;
    })
    .join('\n');
  const raids = strategy.raids.length ? strategy.raids.map((r) => `- Raid ${r.number} "${r.name}": partys ${r.partyIds.map((id) => strategy.parties.find((p) => p.id === id)?.number).join(', ') || 'ninguna'}`).join('\n') : 'No hay raids definidas todavía.';

  return `Eres el estratega asistente de una guild de Ragnarok Origin Classic (ROOC). Ayúdame a planificar una partida de ${mode?.name ?? 'GvG'} en el mapa ${map.name} usando el planificador web ROOC Tactics.

## Lo que quiero
${request.trim() || '(Propón una estrategia de apertura razonable y pregúntame lo que necesites.)'}

## Reglas del modo
- Gana la primera guild que llega a ${scoring?.winScore ?? '?'} puntos. Cada kill vale ${scoring?.killPoints ?? '?'} punto.
- Los pilares aparecen durante la partida y tienen tier. Su sello se rompe con daño puro; al romperlo queda una zona de captura que suma puntos por tick a la guild con más jugadores dentro, hasta un máximo de ticks; luego el pilar se agota.
- Puntos por tier: ${tiers ?? 'sin datos'}. Si un valor dice "sin dato", no lo inventes.${pending}
- Una party tiene máximo ${mode?.partySize ?? 5} jugadores; una raid, máximo ${mode?.raidMaxParties ?? 8} partys.

## Mapa
Coordenadas normalizadas: x de 0 (izquierda) a 1 (derecha), y de 0 (arriba) a 1 (abajo). El mapa se divide en 9 zonas como un pad numérico: 7 8 9 arriba, 4 5 6 al medio, 1 2 3 abajo. La zona 5 contiene el pilar central.
Mi guild es la ${side}. Marcadores (usa su id entre comillas para ubicar cosas):
${markers}

## Mi guild ahora
Raids:
${raids}
Partys:
${parties}

Jobs disponibles (usa estos ids): ${jobs.map((j) => j.id).join(', ')}.
Roles: ${roles.map((r) => r.name).join(', ')}.

## Cómo responder
1. Primero explícame la estrategia en español, breve y por pasos, y justifica la composición si la sugieres. Si te falta información clave, pregúntame antes de proponer.
2. Después entrega UN solo bloque de código \`\`\`json con el plan, para pegarlo en ROOC Tactics. Formato:

\`\`\`json
${EXAMPLE}
\`\`\`

Reglas del JSON:
- Un lugar ("at", "from", "to") puede ser el id de un marcador, una zona {"zone": 1-9} o coordenadas {"x": 0-1, "y": 0-1}.
- "groups" ubica raids o partys por su número. Usa {"type": "raid"} cuando la raid se mueve unida y {"type": "party"} cuando sus partys actúan por separado. No pongas la raid y sus partys en el mismo paso.
- Cada paso debe traer la posición de todos los grupos que siguen en juego; así la web anima el movimiento entre pasos.
- "raids" y "parties" son opcionales: inclúyelos solo si propones cambiar la formación o la composición. "jobs" rellena los slots vacíos de esa party; no reemplaza jugadores que ya están.
- Estados de un objetivo: pending (por aparecer), active (sello intacto), captured-green / captured-red (en captura), destroyed (agotado). Puedes agregar "ticks" al objetivo si la captura no es completa. Tiers: ${scoring?.tiers.map((t) => t.id).join(', ') ?? 'B, A, S'}.
- Colores sugeridos: ${Object.entries(COLORS).map(([k, v]) => `${k} ${v}`).join(', ')}.
- Notas cortas, pensadas para leerse en voz durante la partida.`;
}

/** Saca el plan JSON de la respuesta de Claude (acepta el texto completo con el bloque ```json dentro). */
export function parsePlan(text: string): AiPlan | string {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const start = text.indexOf('{');
  const candidates = [...fenced.reverse(), start >= 0 ? text.slice(start, text.lastIndexOf('}') + 1) : ''];
  for (const raw of candidates) {
    try {
      const plan = JSON.parse(raw) as AiPlan;
      if (plan && Array.isArray(plan.steps) && plan.steps.length) return plan;
    } catch {
      // probar con el siguiente candidato
    }
  }
  return 'No encontré un plan válido. Pega la respuesta completa de Claude, incluido el bloque ```json con "steps".';
}

export interface ApplyResult {
  strategy: Strategy;
  /** Índice del primer paso creado. */
  firstStep: number;
  warnings: string[];
}

/** Convierte el plan en raids, partys y pasos del tablero. `replace` reemplaza los pasos actuales; si no, los agrega al final. */
export function applyPlan(plan: AiPlan, base: Strategy, map: MapConfig, replace: boolean): ApplyResult {
  const warnings: string[] = [];
  const mode = modeById(base.modeId);
  const partySize = mode?.partySize ?? 5;
  const maxParties = mode?.raidMaxParties ?? 8;
  let parties: Party[] = [...base.parties];
  let raids: Raid[] = [...base.raids];
  const roster: Player[] = [...base.roster];
  const color = (c: string | undefined, fallback: string) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

  const partyByNumber = (n: number): Party => {
    let party = parties.find((p) => p.number === n);
    if (!party) {
      party = emptyParty(n, partySize);
      parties = [...parties, party].sort((a, b) => a.number - b.number);
    }
    return party;
  };

  for (const p of plan.parties ?? []) {
    if (!Number.isFinite(p.number)) continue;
    const party = partyByNumber(p.number);
    const slots = [...party.slots];
    for (const jobText of p.jobs ?? []) {
      const job = findJob(String(jobText));
      const free = slots.indexOf(null);
      if (!job) warnings.push(`Party ${p.number}: job desconocido "${jobText}".`);
      else if (free < 0) warnings.push(`Party ${p.number}: no quedan slots libres para ${job.name}.`);
      else {
        const player: Player = { id: newId('player'), name: `${job.abbr} ${p.number}.${free + 1}`, jobId: job.id, role: job.role };
        roster.push(player);
        slots[free] = player.id;
      }
    }
    parties = parties.map((x) => (x.id === party.id ? { ...x, slots, name: typeof p.name === 'string' && p.name ? p.name : x.name } : x));
  }

  if (plan.raids?.length) {
    raids = plan.raids.filter((r) => Number.isFinite(r.number)).map((r) => {
      const existing = base.raids.find((x) => x.number === r.number);
      const ids = (r.parties ?? []).filter(Number.isFinite).map((n) => partyByNumber(n).id);
      if (ids.length > maxParties) warnings.push(`Raid ${r.number}: tiene ${ids.length} partys y el máximo es ${maxParties}; se usan las primeras.`);
      return { id: existing?.id ?? newId('raid'), number: r.number, name: (typeof r.name === 'string' && r.name) || existing?.name || `Raid ${r.number}`, partyIds: ids.slice(0, maxParties) };
    });
    // Una party va en una sola raid: gana la primera que la nombra.
    const taken = new Set<string>();
    raids = raids.map((r) => ({ ...r, partyIds: r.partyIds.filter((id) => !taken.has(id) && taken.add(id)) }));
  }

  const zones = zoneCenters(map.numpad);
  const place = (p: Place | undefined, where: string): Vec2 | null => {
    if (typeof p === 'string') {
      const key = p.trim().toLowerCase();
      const marker = map.markers.find((m) => m.id.toLowerCase() === key || m.label.toLowerCase() === key);
      if (marker) return marker.pos;
      warnings.push(`${where}: marcador desconocido "${p}".`);
      return null;
    }
    if (p && 'zone' in p) {
      const z = zones.find((x) => x.zone === Number(p.zone));
      if (z) {
        // El centro geométrico de una zona suele caer en el bosque: se usa el marcador de esa zona más cercano al centro.
        const inZone = map.markers.filter((m) => zoneOf(m.pos, map.numpad) === z.zone);
        const nearest = inZone.sort((a, b) => Math.hypot(a.pos.x - z.center.x, a.pos.y - z.center.y) - Math.hypot(b.pos.x - z.center.x, b.pos.y - z.center.y))[0];
        return nearest?.pos ?? z.center;
      }
      warnings.push(`${where}: zona inválida "${String(p.zone)}".`);
      return null;
    }
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: round4(clamp01(p.x)), y: round4(clamp01(p.y)) };
    warnings.push(`${where}: falta el lugar.`);
    return null;
  };

  // Un mismo grupo conserva el id de su ficha entre pasos, para que la reproducción lo anime.
  const tokenIds = new Map<string, string>();
  if (!replace) for (const t of base.steps[base.steps.length - 1].tokens) if (t.group) tokenIds.set(`${t.group.type}:${t.group.id}`, t.id);

  const steps: Step[] = plan.steps.map((s, i) => {
    const where = `Paso ${i + 1}`;
    const step = emptyStep(typeof s.name === 'string' && s.name ? s.name : `Paso ${i + 1}`);
    step.note = typeof s.note === 'string' ? s.note : '';

    const placed: { key: string; group: NonNullable<Token['group']>; pos: Vec2 }[] = [];
    for (const g of s.groups ?? []) {
      const pos = place(g.at, where);
      if (!pos) continue;
      const id = g.type === 'raid' ? raids.find((r) => r.number === g.number)?.id : parties.find((p) => p.number === g.number)?.id;
      if (!id) {
        warnings.push(`${where}: no existe la ${g.type === 'raid' ? 'raid' : 'party'} ${g.number}.`);
        continue;
      }
      placed.push({ key: `${g.type}:${id}`, group: { type: g.type === 'raid' ? 'raid' : 'party', id }, pos });
    }
    // Varios grupos en el mismo lugar se abren en círculo para que no queden uno encima del otro.
    step.tokens = placed.map((g) => {
      const same = placed.filter((x) => Math.hypot(x.pos.x - g.pos.x, x.pos.y - g.pos.y) < 0.01);
      const k = same.indexOf(g);
      const r = same.length > 1 ? 0.045 : 0;
      const angle = (k / same.length) * Math.PI * 2 - Math.PI / 2;
      if (!tokenIds.has(g.key)) tokenIds.set(g.key, newId('token'));
      const pos = snapToWalkable({ x: round4(clamp01(g.pos.x + Math.cos(angle) * r)), y: round4(clamp01(g.pos.y + Math.sin(angle) * r * map.aspect)) }, map.geometry, map.aspect);
      return { id: tokenIds.get(g.key)!, jobId: '', team: 'ally' as const, group: g.group, pos };
    });

    const drawings: Drawing[] = [];
    for (const a of s.arrows ?? []) {
      const from = place(a.from, where);
      const to = place(a.to, where);
      if (!from || !to || (from.x === to.x && from.y === to.y)) continue;
      const mid = { x: (from.x + to.x) / 2 - (to.y - from.y) * 0.25, y: (from.y + to.y) / 2 + (to.x - from.x) * 0.25 };
      // Las flechas siguen los senderos: si la recta cruza el bosque, se traza la ruta transitable.
      const path = route(from, to, map.geometry, map.aspect);
      const curved = a.curved && path.length === 2;
      drawings.push({ id: newId('draw'), tool: curved ? 'curve-arrow' : 'arrow', points: curved ? [from, { x: round4(clamp01(mid.x)), y: round4(clamp01(mid.y)) }, to] : path, color: color(a.color, '#f8fafc'), width: 4 });
    }
    for (const z of s.zones ?? []) {
      const at = place(z.at, where);
      const radius = Math.min(0.3, Math.max(0.02, Number(z.radius) || 0.06));
      if (at) drawings.push({ id: newId('draw'), tool: 'circle', points: [at, { x: round4(clamp01(at.x + radius)), y: at.y }], color: color(z.color, '#facc15'), width: 4 });
    }
    for (const t of s.texts ?? []) {
      const at = place(t.at, where);
      if (at && typeof t.text === 'string' && t.text) drawings.push({ id: newId('draw'), tool: 'text', points: [at], color: color(t.color, '#f8fafc'), width: 4, text: t.text });
    }
    for (const p of s.pings ?? []) {
      const at = place(p.at, where);
      if (at) drawings.push({ id: newId('draw'), tool: 'ping', points: [at], color: color(p.color, '#ef4444'), width: 4 });
    }
    step.drawings = drawings;

    for (const o of s.objectives ?? []) {
      const marker = map.markers.find((m) => m.id === o.marker && (m.kind === 'central-pillar' || m.kind === 'pillar-slot'));
      if (!marker) {
        warnings.push(`${where}: "${o.marker}" no es un pilar del mapa.`);
        continue;
      }
      step.objectives.push({
        markerId: marker.id,
        status: STATUSES.includes(o.status as ObjectiveStatus) ? (o.status as ObjectiveStatus) : 'pending',
        ...(mode?.scoring?.tiers.some((t) => t.id === o.tier) ? { tier: o.tier } : {}),
        ...(Number.isFinite(o.timerSeconds) ? { timerSeconds: Math.max(0, Math.round(o.timerSeconds!)) } : {}),
        ...(Number.isFinite(o.ticks) ? { ticks: Math.max(0, Math.round(o.ticks!)) } : {}),
      });
    }
    return step;
  });

  return {
    strategy: {
      ...base,
      name: replace && typeof plan.name === 'string' && plan.name ? plan.name : base.name,
      roster,
      parties,
      raids,
      steps: replace ? steps : [...base.steps, ...steps],
    },
    firstStep: replace ? 0 : base.steps.length,
    warnings,
  };
}
