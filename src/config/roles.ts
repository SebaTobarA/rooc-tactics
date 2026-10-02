import type { RoleId } from '../types/index.ts';

export interface RoleConfig {
  id: RoleId;
  name: string;
  short: string;
  color: string;
}

export const roles: RoleConfig[] = [
  { id: 'tank', name: 'Tanque', short: 'TNQ', color: '#60a5fa' },
  { id: 'physical', name: 'Daño físico', short: 'FIS', color: '#f87171' },
  { id: 'magical', name: 'Daño mágico', short: 'MAG', color: '#c084fc' },
  { id: 'support', name: 'Soporte/Curación', short: 'SOP', color: '#4ade80' },
  { id: 'control', name: 'Control', short: 'CTL', color: '#facc15' },
  { id: 'utility', name: 'Utilidad', short: 'UTL', color: '#22d3ee' },
];

export const roleById = (id: RoleId | undefined) => roles.find((r) => r.id === id);
