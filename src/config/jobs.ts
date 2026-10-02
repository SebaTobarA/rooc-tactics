import type { RoleId } from '../types/index.ts';

export interface JobConfig {
  id: string;
  /** Nombre editable, por si el cliente LATAM usa otra traducción. */
  name: string;
  /** Siglas del ícono genérico (no se usa arte del juego). */
  abbr: string;
  baseClass: string;
  transcended: boolean;
  role: RoleId;
  color: string;
}

const CLASS_COLORS: Record<string, string> = {
  Swordsman: '#b91c1c',
  Mage: '#7c3aed',
  Archer: '#15803d',
  Acolyte: '#b45309',
  Thief: '#be185d',
  Merchant: '#c2410c',
  Doram: '#0e7490',
};

const job = (id: string, name: string, abbr: string, baseClass: string, transcended: boolean, role: RoleId): JobConfig => ({
  id, name, abbr, baseClass, transcended, role, color: CLASS_COLORS[baseClass],
});

// Los roles son valores por defecto; cada jugador o token puede cambiar el suyo.
export const jobs: JobConfig[] = [
  job('knight', 'Knight', 'KN', 'Swordsman', false, 'physical'),
  job('lord-knight', 'Lord Knight', 'LK', 'Swordsman', true, 'physical'),
  job('crusader', 'Crusader', 'CR', 'Swordsman', false, 'tank'),
  job('paladin', 'Paladin', 'PA', 'Swordsman', true, 'tank'),
  job('wizard', 'Wizard', 'WZ', 'Mage', false, 'magical'),
  job('high-wizard', 'High Wizard', 'HW', 'Mage', true, 'magical'),
  job('sage', 'Sage', 'SA', 'Mage', false, 'control'),
  job('professor', 'Professor', 'PF', 'Mage', true, 'control'),
  job('hunter', 'Hunter', 'HT', 'Archer', false, 'physical'),
  job('sniper', 'Sniper', 'SN', 'Archer', true, 'physical'),
  job('bard', 'Bard', 'BA', 'Archer', false, 'utility'),
  job('minstrel', 'Minstrel (Clown)', 'MI', 'Archer', true, 'utility'),
  job('dancer', 'Dancer', 'DA', 'Archer', false, 'utility'),
  job('gypsy', 'Gypsy', 'GY', 'Archer', true, 'utility'),
  job('priest', 'Priest', 'PR', 'Acolyte', false, 'support'),
  job('high-priest', 'High Priest', 'HP', 'Acolyte', true, 'support'),
  job('monk', 'Monk', 'MO', 'Acolyte', false, 'physical'),
  job('champion', 'Champion', 'CH', 'Acolyte', true, 'physical'),
  job('assassin', 'Assassin', 'AS', 'Thief', false, 'physical'),
  job('assassin-cross', 'Assassin Cross', 'SX', 'Thief', true, 'physical'),
  job('rogue', 'Rogue', 'RG', 'Thief', false, 'control'),
  job('stalker', 'Stalker', 'ST', 'Thief', true, 'control'),
  job('blacksmith', 'Blacksmith', 'BS', 'Merchant', false, 'physical'),
  job('whitesmith', 'Whitesmith', 'WS', 'Merchant', true, 'physical'),
  job('alchemist', 'Alchemist', 'AL', 'Merchant', false, 'utility'),
  job('creator', 'Creator', 'CT', 'Merchant', true, 'utility'),
  job('doram', 'Doram (Summoner)', 'DO', 'Doram', false, 'support'),
];

export const jobById = (id: string) => jobs.find((j) => j.id === id);
export const baseClasses = [...new Set(jobs.map((j) => j.baseClass))];
