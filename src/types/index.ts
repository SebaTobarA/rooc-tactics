/** Punto en coordenadas normalizadas (0–1) respecto al área del mapa. */
export type Vec2 = { x: number; y: number };

export type Side = 'green' | 'red';
/** Lista abierta: los tiers válidos los define la config del modo. */
export type TierId = string;
export type RoleId = 'tank' | 'physical' | 'magical' | 'support' | 'control' | 'utility';

// ---------- Modo ----------

export interface TierScoring {
  id: TierId;
  /** Puntos por romper el sello del pilar (Break Crystal Pillar's Seal). null = sin dato. */
  destroyPoints: number | null;
  /** Puntos por tick mientras la zona de captura está controlada. */
  capturePointsPerTick: number | null;
  /** Ticks máximos que suma un pilar capturado antes de agotarse. */
  maxTicks: number | null;
}

/** Guild League se juega en dos campos: el Principal da puntos de victoria; el Secundario da moral. */
export type FieldId = 'main' | 'sub';

export interface CommanderSkill {
  id: string;
  name: string;
  radiusMeters: number;
  effect: string;
}

/** Reglas de puntuación de un campo, ya en forma común para el simulador, el tablero y el asistente. */
export interface FieldScoring {
  field: FieldId;
  label: string;
  /** Lo que se acumula: "puntos" o "moral". */
  unit: string;
  /** Meta que gana la partida; null si el campo no gana (el Secundario). */
  goal: number | null;
  /** Umbrales con recompensa (moral del Secundario). */
  thresholds?: { at: number; reward: string }[];
  /** Valor de una kill; null = sin confirmar. */
  killPoints: number | null;
  tiers: TierScoring[];
  captureTickSeconds: number | null;
  pendingRules?: string[];
  /** Habilidades de Comandante que se ganan al romper el sello de un pilar de este tier. */
  commander?: { trigger: TierId; target: FieldId; skills: CommanderSkill[] };
}

/** Evento de los últimos minutos: multiplica lo ganado por captura. */
export interface FiestaTempo {
  triggerSecondsLeft: number;
  captureMultiplier: number;
  sealMultiplier: number;
  /** Campos donde está confirmado. */
  appliesTo: FieldId[];
  pendingRules: string[];
}

export interface ModeScoring {
  winScore: number;
  killPoints: number;
  tiers: TierScoring[];
  /** Segundos entre ticks de captura. */
  captureTickSeconds: number | null;
  /** Mecánicas sin confirmar: se muestran como pendientes en la interfaz y no se usan en los cálculos. */
  pendingRules?: string[];
  /** Campo Secundario (moral). Los campos de arriba son los del Campo Principal. */
  sub?: Omit<FieldScoring, 'field'>;
  fiestaTempo?: FiestaTempo;
  /** Duración de la partida en segundos; null = sin confirmar. */
  matchDurationSeconds?: number | null;
}

export interface ModeConfig {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  maps: string[];
  partySize: number;
  maxSameJobPerTeam?: number;
  /** Máximo de partys por raid. */
  raidMaxParties?: number;
  /** Formaciones sugeridas: jugadores por raid (ej.: [20, 20] = 2 raids de 20). */
  raidPresets?: { name: string; raids: number[] }[];
  scoring?: ModeScoring;
}

// ---------- Geometría del mapa ----------

export type PolygonKind = 'forest' | 'rock' | 'walkable' | 'water' | 'ruin';

export interface Polygon {
  id: string;
  kind: PolygonKind;
  points: Vec2[];
  holes?: Vec2[][];
  /** Altura relativa para la vista 3D (0 = suelo). */
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
  /** Tier del pilar en esta ubicación (solo pilares). */
  tier?: TierId;
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
  /** Pasto del borde de los senderos (la arena queda al centro). */
  grass: string;
  /** Muros de piedra de las ruinas. */
  wall: string;
  /** Nubes del borde del mapa. */
  cloud: string;
  /** Tonos de las copas de los árboles. */
  canopy: string[];
  canopyShade: string;
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
  /** Ficha de grupo: representa a una party o a una raid completa con un solo token (jobId queda vacío). */
  group?: { type: 'party' | 'raid'; id: string };
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
  /** Ticks de captura logrados en este paso (si se omite, se asume la captura completa). */
  ticks?: number;
}

export interface Step {
  id: string;
  name: string;
  note: string;
  tokens: Token[];
  drawings: Drawing[];
  objectives: ObjectiveState[];
  /** Fiesta Tempo activa en este paso (duplica la captura donde aplica). */
  fiestaTempo?: boolean;
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

/** Raid: agrupa partys que se mueven juntas. Una party pertenece a lo más a una raid. */
export interface Raid {
  id: string;
  name: string;
  number: number;
  partyIds: string[];
}

export interface Strategy {
  schema: 1;
  id: string;
  name: string;
  modeId: string;
  mapId: string;
  /** Campo en el que se concentra la estrategia; sin definir hasta que se elige. */
  field?: FieldId;
  /** "Invertir lados": solo rota la vista 180°, no cambia los datos. */
  flipped: boolean;
  /** Lado de mi guild: los tokens aliados usan su color y los enemigos el del otro lado. */
  allySide: Side;
  roster: Player[];
  parties: Party[];
  raids: Raid[];
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}
