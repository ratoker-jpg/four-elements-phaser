/**
 * Pure TypeScript state model for Four Elements.
 *
 * No Phaser dependencies. All game state lives here.
 * The render layer reads from GameState but never mutates it directly.
 *
 * Schema mirrors the donor repo's MapData structure exactly,
 * preserving the full saved map data without simplification.
 */

// ─── Terrain ────────────────────────────────────────────────────────

/** Terrain types matching the 3 legacy sand tiles used by the active render path. */
export type TerrainType = 'sand' | 'sand-dark' | 'sand-light';

// ─── Factions ───────────────────────────────────────────────────────

export type Faction = 'cyan' | 'green' | 'yellow' | 'purple';

// ─── Resources ──────────────────────────────────────────────────────

export type ResourceType = 'small' | 'medium' | 'large' | 'infinite';

export interface ResourcePlacement {
  tx: number;
  ty: number;
  type: ResourceType;
  /** Footprint size (footprint x footprint tiles occupied). Default 1; infinite = 3. */
  footprint: number;
}

// ─── Obstacles ──────────────────────────────────────────────────────

/** Blocking obstacle types that impede movement and construction. */
export type ObstacleType =
  | 'mountain-small'
  | 'mountain-medium'
  | 'mountain-large'
  | 'volcano-small'
  | 'volcano-medium'
  | 'rock-cluster';

export interface ObstaclePlacement {
  tx: number;
  ty: number;
  type: ObstacleType;
  /** Footprint size (footprint x footprint tiles occupied). */
  footprint: number;
}

// ─── Decor ──────────────────────────────────────────────────────────

/** Non-blocking decor types — visual life, no gameplay blocking. */
export type DecorType = 'bush' | 'sand-bump';

export interface DecorPlacement {
  tx: number;
  ty: number;
  type: DecorType;
}

// ─── HQ ─────────────────────────────────────────────────────────────

export interface HqPlacement {
  tx: number;
  ty: number;
  faction: Faction;
}

// ─── Buildings ──────────────────────────────────────────────────────

export type BuildingType =
  | 'separator'
  | 'raw-storage'
  | 'matter-storage'
  | 'power-plant'
  | 'command-relay'
  | 'units-factory';

export interface BuildingPlacement {
  tx: number;
  ty: number;
  type: BuildingType;
}

// ─── Builders ───────────────────────────────────────────────────────

export type BuilderPhase = 'idle' | 'moving-to-site' | 'building';

export interface BuilderPlacement {
  tx: number;
  ty: number;
  busy: boolean;
  phase: BuilderPhase;
  path: Array<{ tx: number; ty: number }>;
  pathIndex: number;
  ftx: number;
  fty: number;
  targetTx: number;
  targetTy: number;
  assignedSiteId: number;
}

// ─── Construction Sites ─────────────────────────────────────────────

export interface ConstructionSitePlacement {
  tx: number;
  ty: number;
  type: BuildingType;
  elapsed: number;
  duration: number;
  progress: number;
  builderIndex: number;
  id: number;
  pending: boolean;
}

// ─── Extra Starter Units (not from saved map) ──────────────────────

/** Modular combat unit configuration. State-only until visual assets exist. */
export interface ModularCombatUnit {
  tx: number;
  ty: number;
  chassis: 'wasp';
  weapon: 'smoky';
  mod: 'm0';
  faction: Faction;
}

// ─── Map Data ───────────────────────────────────────────────────────

/** Saved map data — mirrors the donor repo's MapData structure exactly. */
export interface MapData {
  width: number;
  height: number;
  terrain: TerrainType[][];
  hq: HqPlacement;
  resources: ResourcePlacement[];
  obstacles: ObstaclePlacement[];
  decor: DecorPlacement[];
  buildings: BuildingPlacement[];
  builders: BuilderPlacement[];
  constructionSites: ConstructionSitePlacement[];
}

// ─── Game State ─────────────────────────────────────────────────────

/** Resource counters placeholder — no economy loop yet. */
export interface ResourceCounters {
  small: number;
  medium: number;
  large: number;
  infinite: number;
}

/** Renderable entity kinds derived from GameState for the render layer. */
export type EntityKind = 'hq' | 'builder' | 'harvester' | 'resource' | 'modular-combat';

/** A flattened renderable entity for the render layer convenience. */
export interface RenderableEntity {
  id: string;
  kind: EntityKind;
  tx: number;
  ty: number;
  faction?: Faction;
  resourceType?: ResourceType;
  footprint?: number;
  /** If true, no visual asset exists yet — render is skipped with a console warning. */
  stateOnly?: boolean;
}

/** Top-level game state. Pure data, no methods, no Phaser. */
export interface GameState {
  /** Source map metadata. */
  mapId: string;
  mapName: string;
  mapWidth: number;
  mapHeight: number;
  /** Raw saved map data (terrain + all placements from donor mapgen). */
  mapData: MapData;
  /** Flattened renderable entities derived from mapData + extra starter units. */
  entities: RenderableEntity[];
  playerFaction: Faction;
  /** Extra starter units not present in the original saved map. */
  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>;
  extraModularCombat: ModularCombatUnit[];
  /** Resource counters — placeholder, not yet driven by economy loop. */
  resources: ResourceCounters;
}
