import type { Element, Marker, MarkerKind, ObjectiveStatus } from '../types/index.ts';

/**
 * Cómo se ven y qué estados tienen los marcadores de Vigrid. Íconos propios (emoji y formas simples), sin arte del juego.
 * En los jefes, "captured-green/red" se lee como "último golpe de Verde/Roja"; en el cuerno, como "lo tiene Verde/Roja".
 */
export interface KindLook {
  label: string;
  icon: string;
  color: string;
  /** Estados que tienen sentido en este marcador, con su texto. Sin estados = no es objetivo. */
  statuses?: Partial<Record<ObjectiveStatus, string>>;
}

const BOSS: Partial<Record<ObjectiveStatus, string>> = {
  pending: 'Por aparecer',
  active: 'Vivo',
  'captured-green': 'Último golpe: Verde',
  'captured-red': 'Último golpe: Roja',
  destroyed: 'Muerto (otro)',
};

export const KIND_LOOKS: Partial<Record<MarkerKind, KindLook>> = {
  entry: { label: 'Entrada', icon: '⛩', color: '#4caf50' },
  'respawn-point': { label: 'Respawn', icon: '✚', color: '#38bdf8' },
  horn: { label: 'Cuerno · Fallen Valkyrie', icon: '📯', color: '#f5b82e', statuses: BOSS },
  fenrir: { label: 'Fenrir', icon: '🐺', color: '#64748b', statuses: BOSS },
  'element-lord': { label: 'Señor Elemental', icon: '✦', color: '#a78bfa', statuses: BOSS },
  altar: {
    label: 'Altar',
    icon: '🏛',
    color: '#c08a3e',
    statuses: { active: 'Activo', destroyed: 'Corrompido' },
  },
  dracula: { label: 'Undead Spirit (Dracula)', icon: '🧛', color: '#b0306b', statuses: BOSS },
};

export const ELEMENT_LOOKS: Record<Element, { name: string; icon: string; color: string; buff: string }> = {
  water: { name: 'Agua', icon: '💧', color: '#38bdf8', buff: 'restaura SP' },
  wind: { name: 'Viento', icon: '🌪', color: '#4ade80', buff: 'reduce la curación que reciben los enemigos' },
  earth: { name: 'Tierra', icon: '⛰', color: '#b7791f', buff: 'repara equipo y da escudo fuera de combate' },
  fire: { name: 'Fuego', icon: '🔥', color: '#f97316', buff: 'al golpear rompe una pieza aleatoria del equipo enemigo' },
};

/** Ícono y color del marcador (los Señores Elementales usan los de su elemento). */
export function lookOf(m: Pick<Marker, 'kind' | 'element'>): KindLook | undefined {
  const base = KIND_LOOKS[m.kind];
  if (!base) return undefined;
  if (m.kind === 'element-lord' && m.element) return { ...base, icon: ELEMENT_LOOKS[m.element].icon, color: ELEMENT_LOOKS[m.element].color };
  return base;
}
