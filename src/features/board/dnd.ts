import { roundVec } from '../../lib/geometry.ts';
import { addToken } from '../../store/boardActions.ts';
import type { Vec2 } from '../../types/index.ts';
import { placeGroupToken } from '../party/groupActions.ts';
import { placePlayers } from '../party/partyActions.ts';

/** Tipos MIME de lo que se puede arrastrar al mapa. */
export const JOB_MIME = 'application/x-rooc-job';
export const PLAYER_MIME = 'application/x-rooc-player';
export const PARTY_MIME = 'application/x-rooc-party';
export const RAID_MIME = 'application/x-rooc-raid';

export const acceptsBoardDrop = (dt: DataTransfer) => [JOB_MIME, PLAYER_MIME, PARTY_MIME, RAID_MIME].some((m) => dt.types.includes(m));

/** Suelta un job, un jugador, una party o una raid sobre el mapa. Party y raid quedan como una sola ficha. */
export function dropOnBoard(dt: DataTransfer, raw: Vec2): string[] {
  if (raw.x < 0 || raw.x > 1 || raw.y < 0 || raw.y > 1) return [];
  const pos = roundVec(raw);
  const job = dt.getData(JOB_MIME);
  if (job) return [addToken(job, pos)];
  const player = dt.getData(PLAYER_MIME);
  if (player) return placePlayers([player], pos);
  const party = dt.getData(PARTY_MIME);
  if (party) return placeGroupToken('party', party, pos);
  const raid = dt.getData(RAID_MIME);
  if (raid) return placeGroupToken('raid', raid, pos);
  return [];
}
