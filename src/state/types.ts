/**
 * Pure TypeScript state model for Four Elements.
 *
 * No Phaser dependencies. All game state lives here.
 * The render layer reads from GameState but never mutates it directly.
 *
 * PR3: Added runtime state for harvesters (HarvesterState) and resource
 * nodes (ResourceNodeState) to support the civil gather/deliver loop.
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

// ─── Renderable Entities (flattened for render layer) ───────────────

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
  /** Body facing direction for modular units (0–7). Defaults to 2 (S) if omitted. */
  dir?: number;
  /** Turret facing direction for modular units (0–7). Defaults to dir (bodyDir) if omitted. */
  turretDir?: number;
}

// ─── Harvester State (PR3) ─────────────────────────────────────────

/** Harvester behaviour phases in the civil gather/deliver loop. */
export type HarvesterPhase =
  | 'idle'
  | 'moving-to-resource'
  | 'gathering'
  | 'returning-to-hq'
  | 'unloading';

/** Runtime state for a single harvester unit. */
export interface HarvesterState {
  id: string;
  /** Fractional tile X — updated every frame during movement. */
  ftx: number;
  /** Fractional tile Y — updated every frame during movement. */
  fty: number;
  faction: Faction;
  phase: HarvesterPhase;
  /** ID of the targeted resource node, or null. */
  targetResourceId: string | null;
  /** Raw minerals currently carried. */
  cargoRaw: number;
  /** Maximum raw minerals this harvester can carry. */
  cargoCapacity: number;
  /** Countdown timer (ms) while in 'gathering' phase. */
  gatherTimer: number;
  /** Countdown timer (ms) while in 'unloading' phase. */
  unloadTimer: number;
  /** Movement speed in tiles per second. */
  speedTilesPerSecond: number;
}

// ─── Resource Node State (PR3) ─────────────────────────────────────

/** Raw mineral amounts per resource type. */
export const RESOURCE_RAW_AMOUNTS: Record<ResourceType, number> = {
  small: 20,
  medium: 60,
  large: 120,
  infinite: 999_999,
};

/** Runtime state for a single resource node on the map. */
export interface ResourceNodeState {
  id: string;
  tx: number;
  ty: number;
  resourceType: ResourceType;
  footprint: number;
  /** Remaining raw minerals. Decremented on each gather cycle unless infinite. */
  remainingRaw: number;
  /** True when remainingRaw reaches 0. Infinite resources are never depleted. */
  depleted: boolean;
}

// ─── Economy State (ARCH-01B) ──────────────────────────────────────

/** Player economy state — pure data, no methods, no Phaser. */
export interface EconomyState {
  /** Raw minerals gathered by harvesters from resource nodes. */
  raw: number;
  /** Processed matter — used for building construction costs. */
  matter: number;
  /** Element counts per faction. Zero until separator processing is implemented. */
  elements: Record<Faction, number>;
  /** Total power generated by power plants. Placeholder — always 0 until power-plant is implemented. */
  powerGenerated: number;
  /** Total power consumed by buildings. Placeholder — always 0 until power-plant is implemented. */
  powerConsumed: number;
}

/** Initial economy values per ROADMAP.md ARCH-01. */
export const START_RAW = 30;
export const START_MATTER = 120;

// ─── Game State ─────────────────────────────────────────────────────

/** Top-level game state. Pure data, no methods, no Phaser. */
export interface GameState {
  /** Source map metadata. */
  mapId: string;
  mapName: string;
  mapWidth: number;
  mapHeight: number;
  /** Raw saved map data (terrain + all placements). */
  mapData: MapData;
  /** Flattened renderable entities derived from mapData + extra starter units. */
  entities: RenderableEntity[];
  playerFaction: Faction;
  /** Extra starter units not present in the original saved map. */
  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>;
  extraModularCombat: ModularCombatUnit[];

  // ── PR3: Runtime state ──────────────────────────────────────────
  /** All harvester units with their current loop state. */
  harvesters: HarvesterState[];
  /** All resource nodes with depletion state. */
  resourceNodes: ResourceNodeState[];
  /** Player economy (raw, matter, elements, power). Replaces rawMinerals. */
  economy: EconomyState;
  /** HQ tile position for harvester return destination. */
  hqPosition: { tx: number; ty: number };

  // ── ARCH-13E1: Construction state ─────────────────────────────
  /** Auto-incrementing counter for deterministic construction site IDs. */
  nextConstructionId: number;
}
