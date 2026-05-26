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
  /** ARCH-05X hardening: true when moving to a manual-move target (not a construction site). */
  manualMove?: boolean;
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
  | 'unloading'
  | 'manual-move';

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

  // ── ARCH-05X hardening: explicit path fields (replaces `as any` casts) ──

  /** BFS path to approach tile adjacent to resource. Set during 'moving-to-resource'. */
  approachPath?: Array<{ tx: number; ty: number }>;
  /** Current waypoint index into approachPath. */
  approachPathIndex?: number;
  /** BFS path back to HQ. Set during 'returning-to-hq'. */
  returnPath?: Array<{ tx: number; ty: number }>;
  /** Current waypoint index into returnPath. */
  returnPathIndex?: number;
  /** BFS path for manual move command. Set during 'manual-move'. */
  manualPath?: Array<{ tx: number; ty: number }>;
  /** Current waypoint index into manualPath. */
  manualPathIndex?: number;
  /** Cooldown timer (ms) after manual move before auto-gather resumes. */
  manualCooldownMs?: number;
  /** Debug reason when harvester is blocked (no path to HQ). Cleared on phase change. */
  blockedReason?: string;
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

// ─── Separator Processing (ARCH-01C) ───────────────────────────────

/** Separator processing constants per ROADMAP.md ARCH-01 / four-elements-next. */
export const SEP_RAW_COST = 12;
export const SEP_MATTER_YIELD = 10;
export const SEP_ELEMENT_YIELD = 2;
export const SEP_CYCLE_MS = 5000;
/** How many elementUnits make one displayed element. */
export const ELEMENT_UNITS_PER_ELEMENT = 10;

/** Runtime state for a single completed separator building. */
export interface SeparatorRuntimeState {
  /** Tile X of the separator building (top-left of footprint). */
  tx: number;
  /** Tile Y of the separator building (top-left of footprint). */
  ty: number;
  /** Cycle progress 0..1 — fraction of current processing cycle completed. */
  progress: number;
  /** Whether the separator is actively processing (has enough raw). */
  active: boolean;
}

// ─── Power Constants (ARCH-01E) ──────────────────────────────────────

/** Base power provided by HQ. */
export const HQ_BASE_POWER = 10;
/** Power generated per completed power-plant building. */
export const POWER_PLANT_GENERATION = 15;
/** Power consumed by a separator while actively processing. */
export const SEPARATOR_ACTIVE_POWER_CONSUMPTION = 5;
/** Power consumed by a units-factory while actively producing. */
export const UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION = 4;

// ─── Production Constants (ARCH-01F) ────────────────────────────────────

/** Maximum number of items in a factory production queue. */
export const QUEUE_LIMIT = 2;

/** Builder production cost in matter. */
export const BUILDER_PRODUCTION_MATTER_COST = 40;
/** Builder production cost in elementUnits. */
export const BUILDER_PRODUCTION_ELEMENT_COST = 10;
/** Builder production duration in milliseconds. */
export const BUILDER_PRODUCTION_DURATION_MS = 15000;

/** Harvester production cost in matter. */
export const HARVESTER_PRODUCTION_MATTER_COST = 50;
/** Harvester production cost in elementUnits. */
export const HARVESTER_PRODUCTION_ELEMENT_COST = 10;
/** Harvester production duration in milliseconds. */
export const HARVESTER_PRODUCTION_DURATION_MS = 20000;

// ─── Reserved Modular Combat Constants (ARCH-01F, not implemented) ──────

/** Wasp chassis matter cost (reserved for future modular combat). */
export const WASP_CHASSIS_MATTER_COST = 20;
/** Wasp chassis element cost in elementUnits (reserved for future modular combat). */
export const WASP_CHASSIS_ELEMENT_COST = 5;
/** Wasp chassis production duration in milliseconds (reserved for future modular combat). */
export const WASP_CHASSIS_PRODUCTION_DURATION_MS = 7000;
/** Smoky weapon matter cost (reserved for future modular combat). */
export const SMOKY_WEAPON_MATTER_COST = 25;
/** Smoky weapon element cost in elementUnits (reserved for future modular combat). */
export const SMOKY_WEAPON_ELEMENT_COST = 5;
/** Smoky weapon production duration in milliseconds (reserved for future modular combat). */
export const SMOKY_WEAPON_PRODUCTION_DURATION_MS = 18000;
/** Total wasp+smoky unit matter cost (reserved for future modular combat). */
export const WASP_SMOKY_TOTAL_MATTER_COST = 45;
/** Total wasp+smoky unit element cost in elementUnits (reserved for future modular combat). */
export const WASP_SMOKY_TOTAL_ELEMENT_COST = 10;
/** Total wasp+smoky unit production duration in milliseconds (reserved for future modular combat). */
export const WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS = 25000;

// ─── Storage Cap Constants (ARCH-01D) ────────────────────────────────

/** Base HQ raw storage cap. */
export const HQ_RAW_CAP = 200;
/** Base HQ matter storage cap. */
export const HQ_MATTER_CAP = 200;
/** Base HQ element storage cap (in elementUnits). */
export const HQ_ELEMENT_CAP = 200;
/** Raw storage bonus per raw-storage building. */
export const RAW_STORAGE_RAW_BONUS = 200;
/** Matter storage bonus per matter-storage building. */
export const MATTER_STORAGE_MATTER_BONUS = 200;
/** Element cap bonus per matter-storage building (in elementUnits). */
export const MATTER_STORAGE_ELEMENT_BONUS = 200;

// ─── Economy State (ARCH-01B) ──────────────────────────────────────

/** Player economy state — pure data, no methods, no Phaser. */
export interface EconomyState {
  /** Raw minerals gathered by harvesters from resource nodes. */
  raw: number;
  /** Processed matter — used for building construction costs. */
  matter: number;
  /** Element counts per faction in elementUnits (internal integer tracking). */
  elements: Record<Faction, number>;
  /** Total power generated (HQ base + power-plants). ARCH-01E. */
  powerGenerated: number;
  /** Total power consumed by active buildings this tick. ARCH-01E. */
  powerConsumed: number;
  /** Runtime state for each completed separator building. ARCH-01C. */
  separators: SeparatorRuntimeState[];
  /** Maximum raw storage capacity. ARCH-01D. */
  rawCap: number;
  /** Maximum matter storage capacity. ARCH-01D. */
  matterCap: number;
  /** Maximum element storage capacity per faction (in elementUnits). ARCH-01D. */
  elementCap: number;
}

/** Initial economy values per ROADMAP.md ARCH-01. */
export const START_RAW = 30;
export const START_MATTER = 120;

// ─── Production State (ARCH-01F) ────────────────────────────────────

/** Unit types that can be produced by a units-factory. */
export type ProducibleUnitType = 'builder' | 'harvester';

/** A single item in a factory production queue. */
export interface ProductionQueueItem {
  /** The type of unit being produced. */
  unitType: ProducibleUnitType;
  /** Milliseconds elapsed since production started. */
  elapsedMs: number;
  /** Total duration in milliseconds. */
  durationMs: number;
  /** Progress fraction 0..1. */
  progress: number;
  /** Whether the item has finished producing and is waiting to spawn. */
  completed: boolean;
}

/** Runtime state for a single completed units-factory building. */
export interface UnitFactoryRuntimeState {
  /** Tile X of the factory building (top-left of footprint). */
  tx: number;
  /** Tile Y of the factory building (top-left of footprint). */
  ty: number;
  /** Production queue. Maximum size QUEUE_LIMIT. */
  queue: ProductionQueueItem[];
  /** Whether the factory is actively producing (has power and an unfinished item). */
  active: boolean;
}

/** Production state for all units-factories. */
export interface ProductionState {
  /** Runtime state for each completed units-factory building. */
  factories: UnitFactoryRuntimeState[];
}

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

  // ── ARCH-01F: Production state ────────────────────────────────
  /** Production state for all units-factories. */
  production: ProductionState;
}
