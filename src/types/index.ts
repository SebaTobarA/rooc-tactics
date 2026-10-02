/** Punto en coordenadas normalizadas (0–1) respecto al área del mapa. */
export type Vec2 = { x: number; y: number };

export type Side = 'green' | 'red';
/** Lista abierta: los tiers válidos los define la config del modo. */
export type TierId = string;
export type RoleId = 'tank' | 'physical' | 'magical' | 'support' | 'control' | 'utility';

// ---------- Modo ----------

export interface TierScoring {
  id: TierId;
  /** null = TODO: falta cargar el valor desde las tablas del juego. */
  destroyPoints: number | null;
  capturePointsPerTick: number | null;
}

export interface ModeScoring {
  winScore: number;
  killPoints: number;
  tiers: TierScoring[];
  /** null = TODO */
  captureTickSeconds: number | null;
}

export interface ModeConfig {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  maps: string[];
  partySize: number;
  maxSameJobPerTeam?: number;
  scoring?: ModeScoring;
}

// ---------- Geometría del mapa ----------

export type PolygonKind = 'forest' | 'rock' | 'walkable' | 'water' | 'ruin';

export interface Polygon {
  id: string;
  kind: PolygonKind;
  points: Vec2[];
  holes?: Vec2[][];
  /** Altura relativa para la vista 2.5D (0 = suelo). */
  height: number;
}

export type PlazaKind = 'center' | 'pillar' | 'respawn';

export interface Plaza {
  id: string;
  kind: PlazaKind;
  center: Vec2;
  radius: number;
}

export interface MapGeometry {
  version: 1;
  bounds: Vec2[];
  walkable: Polygon[];
  obstacles: Polygon[];
  water: Polygon[];
  decor: Polygon[];
  plazas: Plaza[];
}

// ---------- Config del mapa ----------

export type MarkerKind = 'central-pillar' | 'respawn' | 'pillar-slot' | 'point-green' | 'point-purple';

export interface Marker {
  id: string;
  kind: MarkerKind;
  pos: Vec2;
  label: string;
  side?: Side;
  /** false = nombre/función "por confirmar". */
  confirmed: boolean;
}

export interface MapStyle {
  fog: string;
  ground: string;
  walkable: string;
  walkableStroke: string;
  forest: string;
  forestShade: string;
  rock: string;
  water: string;
  plaza: string;
  plazaStroke: string;
  grid: string;
  /** Opacidad de la textura de ruido (0 = sin textura). */
  textureOpacity: number;
}

/** Transformación afín sin rotación: destino = origen * s + t (en coordenadas normalizadas). */
export interface AxisTransform {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export interface MapReference {
  /** Foto usada solo para calibrar en el editor de mapa. */
  image: string;
  /** Recorte de la foto que corresponde al área 0–1 del mapa (normalizado a la foto). */
  crop: { x: number; y: number; w: number; h: number };
  /** Minimapa (área recortada) → área del mapa. */
  minimapToMap: AxisTransform;
}

export interface NumpadGrid {
  /** Posiciones x de las 2 líneas verticales. */
  cols: [number, number];
  /** Posiciones y de las 2 líneas horizontales. */
  rows: [number, number];
}

export interface MapConfig {
  id: string;
  name: string;
  modeId: string;
  enabled: boolean;
  /** ancho / alto del área del mapa. */
  aspect: number;
  geometry: MapGeometry;
  markers: Marker[];
  numpad: NumpadGrid;
  style: MapStyle;
  reference?: MapReference;
}

// ---------- Estrategia ----------

export interface Token {
  id: string;
  pos: Vec2;
  jobId: string;
  team: 'ally' | 'enemy';
  side?: Side;
  partyId?: string;
  playerId?: string;
  playerName?: string;
  role?: RoleId;
  locked?: boolean;
}

export type DrawingTool = 'pen' | 'line' | 'arrow' | 'curve-arrow' | 'rect' | 'circle' | 'text' | 'ping';

export interface Drawing {
  id: string;
  tool: DrawingTool;
  points: Vec2[];
  color: string;
  width: number;
  text?: string;
  locked?: boolean;
}

export type ObjectiveStatus = 'pending' | 'active' | 'destroyed' | 'captured-green' | 'captured-red';

export interface ObjectiveState {
  markerId: string;
  tier?: TierId;
  status: ObjectiveStatus;
  timerSeconds?: number;
}

export interface Step {
  id: string;
  name: string;
  note: string;
  tokens: Token[];
  drawings: Drawing[];
  objectives: ObjectiveState[];
}

export interface Player {
  id: string;
  name: string;
  jobId: string;
  role?: RoleId;
  note?: string;
}

export interface Party {
  id: string;
  name: string;
  number: number;
  /** Ids de Player; largo fijo = partySize del modo. */
  slots: (string | null)[];
  templateId?: string;
}

export interface Strategy {
  schema: 1;
  id: string;
  name: string;
  modeId: string;
  mapId: string;
  /** "Invertir lados": solo rota la vista 180°, no cambia los datos. */
  flipped: boolean;
  /** Lado de mi guild: los tokens aliados usan su color y los enemigos el del otro lado. */
  allySide: Side;
  roster: Player[];
  parties: Party[];
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}
