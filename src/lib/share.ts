import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { maps } from '../config/maps/index.ts';
import type { Strategy } from '../types/index.ts';

/** Sobre este largo, Discord y varios navegadores cortan o rechazan el enlace. */
export const URL_WARN_LENGTH = 2000;
export const URL_MAX_LENGTH = 8000;

/** Revisa lo mínimo para no abrir un archivo que no es una estrategia. */
export function parseStrategy(data: unknown): Strategy | null {
  const s = data as Partial<Strategy> | null;
  if (!s || s.schema !== 1 || !Array.isArray(s.steps) || !s.steps.length || !Array.isArray(s.parties) || !Array.isArray(s.roster)) return null;
  if (typeof s.mapId !== 'string' || !maps[s.mapId]) return null;
  if (!s.steps.every((st) => Array.isArray(st.tokens) && Array.isArray(st.drawings) && Array.isArray(st.objectives))) return null;
  return { ...(s as Strategy), allySide: s.allySide ?? 'green', flipped: !!s.flipped };
}

export const encodeStrategy = (s: Strategy): string => compressToEncodedURIComponent(JSON.stringify(s));

export function decodeStrategy(data: string): Strategy | null {
  try {
    return parseStrategy(JSON.parse(decompressFromEncodedURIComponent(data) ?? 'null'));
  } catch {
    return null;
  }
}

/** Enlace para compartir: todo el estado va comprimido en el hash, sin backend. */
export const shareUrl = (s: Strategy): string => `${location.origin}${location.pathname}#/s/${encodeStrategy(s)}`;
