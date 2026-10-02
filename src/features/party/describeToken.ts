import { jobById } from '../../config/jobs.ts';
import { roleById } from '../../config/roles.ts';
import type { Party, Player, Strategy, Token } from '../../types/index.ts';
import { partyMembers, raidOf, raidPlayerCount } from './groupActions.ts';
import { partyOfToken } from './partyActions.ts';

export interface TokenInfo {
  title: string;
  subtitle?: string;
  lines: string[];
}

const playerLine = (p: Player) => `${p.name} · ${jobById(p.jobId)?.name ?? '?'}${p.role ? ` (${roleById(p.role)?.short})` : ''}`;
const playersOf = (party: Party, roster: Player[]) => partyMembers(party).map((id) => roster.find((p) => p.id === id)).filter((p): p is Player => !!p);

/** Texto corto dentro de la ficha (P2, R1) o las siglas del job. */
export function tokenBadge(t: Token, s: Pick<Strategy, 'parties' | 'raids'>): string {
  if (t.group?.type === 'party') return `P${s.parties.find((p) => p.id === t.group!.id)?.number ?? '?'}`;
  if (t.group?.type === 'raid') return `R${s.raids.find((r) => r.id === t.group!.id)?.number ?? '?'}`;
  return jobById(t.jobId)?.abbr ?? '?';
}

/** Nombre de la party o raid que representa una ficha de grupo, con su cantidad de jugadores. */
export function groupLabel(t: Token, s: Pick<Strategy, 'parties' | 'raids'>): string {
  if (t.group?.type === 'party') {
    const party = s.parties.find((p) => p.id === t.group!.id);
    return party ? `${party.name} (${partyMembers(party).length})` : 'Party eliminada';
  }
  const raid = s.raids.find((r) => r.id === t.group?.id);
  return raid ? `${raid.name} (${raidPlayerCount(raid, s.parties)})` : 'Raid eliminada';
}

/** Contenido del mensaje emergente de un token: quiénes van en esa party o raid, con su job. */
export function describeToken(t: Token, s: Strategy): TokenInfo {
  if (t.group?.type === 'party') {
    const party = s.parties.find((p) => p.id === t.group!.id);
    if (!party) return { title: 'Party eliminada', lines: [] };
    const players = playersOf(party, s.roster);
    const raid = raidOf(s.raids, party.id);
    return {
      title: `${party.number} · ${party.name}`,
      subtitle: `${players.length}/${party.slots.length} jugadores${raid ? ` · ${raid.name}` : ''}`,
      lines: players.length ? players.map(playerLine) : ['Sin jugadores asignados'],
    };
  }
  if (t.group?.type === 'raid') {
    const raid = s.raids.find((r) => r.id === t.group!.id);
    if (!raid) return { title: 'Raid eliminada', lines: [] };
    const parties = raid.partyIds.map((id) => s.parties.find((p) => p.id === id)).filter((p): p is Party => !!p);
    return {
      title: raid.name,
      subtitle: `${parties.length} partys · ${raidPlayerCount(raid, s.parties)} jugadores`,
      lines: parties.length
        ? parties.map((p) => {
            const players = playersOf(p, s.roster);
            return `P${p.number} ${p.name}: ${players.length ? players.map((x) => `${x.name} (${jobById(x.jobId)?.abbr ?? '?'})`).join(', ') : 'sin jugadores'}`;
          })
        : ['Sin partys asignadas'],
    };
  }
  const job = jobById(t.jobId);
  const party = partyOfToken(s.parties, t);
  return {
    title: t.playerName ?? job?.name ?? 'Token',
    subtitle: [t.playerName ? job?.name : undefined, roleById(t.role)?.name, party ? `${party.number} · ${party.name}` : undefined].filter(Boolean).join(' · '),
    lines: [],
  };
}
