/**
 * Pure TypeScript state model for Four Elements.
 *
 * No Phaser dependencies. All game state lives here.
 * The render layer reads from GameState but never mutates it directly.
 *
 * PR3: Added runtime state for harvesters (HarvesterState) and resource
 * nodes (ResourceNodeState) to support the civil gather/deliver loop.
 */

import type { BlockoutObstacleState } from './blockoutObstacleState';
import type { AcceptedResourceClassId } from '../config/coreMechanicsTypes';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import type { VisionState } from './visibility';
import { T1_ASSEMBLY_OFFSET_MS, T1_BODY_COMPONENTS, T1_WEAPON_COMPONENTS } from '../config/t1ProductionComponents';

// ─── Terrain ────────────────────────────────────────────────────────

/** Terrain types for the 6-variant 256×128 sand tile family (TERRAIN-02A).
 *  Legacy types 'sand', 'sand-dark', 'sand-light' are kept for backward compatibility
 *  with saved maps. New detail variants 'sand-ripple', 'sand-pebble', 'sand-cracked'
 *  add texture variety for repetition reduction. */
export type TerrainType =
  | 'sand' | 'sand-dark' | 'sand-light'
  | 'sand-ripple' | 'sand-pebble' | 'sand-cracked'
  | 'industrial';

// ─── Factions ───────────────────────────────────────────────────────

export type Faction = 'cyan' | 'green' | 'yellow' | 'purple';

export type TeamId = 'team-cyan' | 'team-green' | 'team-yellow' | 'team-purple';
export type TeamController = 'human' | 'ai';
export type AiDifficulty = 'recruit' | 'lieutenant' | 'veteran';
export type TechTier = 1 | 2 | 3;

// ─── Resources ──────────────────────────────────────────────────────

export type ResourceType = 'small' | 'medium' | 'large' | 'infinite';

export interface ResourcePlacement {
  tx: number;
  ty: number;
  type: ResourceType;
  /** Footprint size (footprint x footprint tiles occupied). Default 1; infinite = 3. */
  footprint: number;
  /**
   * Optional accepted resource class ID from the 6-class production model.
   * CORE-STEP-03A: Added for backward-compatible runtime support.
   * When present, this overrides the legacy `type` for asset key, amount range,
   * and display name resolution. When absent, legacy `type` is used.
   * Map generation does NOT populate this yet (Step 03B will).
   */
  resourceClass?: AcceptedResourceClassId;
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
  ownerTeamId?: TeamId;
  /** Stable combat target ID. Optional only on old maps/saves. */
  id?: string;
  /** Canonical Headquarters durability. Optional only on old maps/saves. */
  hp?: number;
  maxHp?: number;
  /** Fractional damage reduction in the inclusive range 0..0.95. */
  armor?: number;
  isDestroyed?: boolean;
  destroyedAt?: number | null;
  damageFlashUntilMs?: number;
  lastDamageAmount?: number;
}

// ─── Buildings ──────────────────────────────────────────────────────

export type BuildingType =
  | 'separator'
  | 'raw-storage'
  | 'matter-storage'
  | 'element-storage'
  | 'power-plant'
  | 'energy-plant'
  | 'command-relay'
  | 'units-factory';

export interface BuildingPlacement {
  tx: number;
  ty: number;
  type: BuildingType;
  ownerTeamId?: TeamId;
}

// ─── Builders ───────────────────────────────────────────────────────

export type BuilderPhase = 'idle' | 'moving-to-site' | 'building';

export interface BuilderPlacement {
  /** BUILDER-ID: Stable string ID for this builder (e.g., 'builder-0', 'builder-spawn-...'). */
  id: string;
  ownerTeamId?: TeamId;
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
  /** Civil durability fields are optional only for old saves and fixtures. */
  hp?: number;
  maxHp?: number;
  isDestroyed?: boolean;
  destroyedAt?: number | null;
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
  ownerTeamId?: TeamId;
}

// ─── Extra Starter Units (not from saved map) ──────────────────────

/** Modification level for modular combat units. */
export type ModLevel = 'm0' | 'm1' | 'm2' | 'm3';

export type CombatUnitOrder =
  | { kind: 'idle' }
  | { kind: 'move'; targetTx: number; targetTy: number }
  | { kind: 'attack'; targetId: string };

export interface CombatUnitRuntimeState {
  ftx: number;
  fty: number;
  hp: number;
  maxHp: number;
  speedTilesPerSecond: number;
  order: CombatUnitOrder;
  path: Array<{ tx: number; ty: number }>;
  pathIndex: number;
  targetId: string | null;
  weaponCooldownMs: number;
  turretAngleDeg: number;
  isWindingUp: boolean;
  windUpRemainingMs: number;
  windUpTargetId: string | null;
  repathCooldownMs: number;
  muzzleFlashUntilMs: number;
  damageFlashUntilMs: number;
  lastFiredAtMs: number | null;
  lastDamageAmount: number;
  isDestroyed: boolean;
  destroyedAt: number | null;
}

/** Canonical dynamic combat-unit state. Render entities are derived from this object. */
export interface ModularCombatUnit {
  id: string;
  ownerTeamId?: TeamId;
  tx: number;
  ty: number;
  bodyId: BodyId;
  weaponId: WeaponId;
  /** Canonical split fields; optional only for old saves/test fixtures before normalization. */
  hullMod?: ModLevel;
  turretMod?: ModLevel;
  faction: Faction;
  /** Runtime 8-direction facing. */
  dir?: number;
  /** Runtime 8-direction turret facing; defaults to dir. */
  turretDir?: number;
  /** Canonical production runtime. Optional only for old saves/test fixtures before normalization. */
  runtime?: CombatUnitRuntimeState;
  /** Legacy save field, migrated to hullMod/turretMod on load. */
  mod?: ModLevel;
}

// ─── Map Data ───────────────────────────────────────────────────────

/** Saved map data — mirrors the donor repo's MapData structure exactly. */
export interface MapData {
  width: number;
  height: number;
  terrain: TerrainType[][];
  /** Human compatibility alias; canonical new maps may contain all four entries below. */
  hq: HqPlacement;
  /** Canonical map Headquarters placements. Missing on legacy maps/saves. */
  headquarters?: HqPlacement[];
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
  ownerTeamId?: TeamId;
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

/** Reason a harvester is blocked and cannot make progress. */
export type HarvesterBlockedReason =
  | 'no-resources'        // No non-depleted resources available
  | 'no-approach-path'    // Cannot reach resource (no BFS path to approach tile)
  | 'no-path-to-hq'       // Cannot reach HQ for dropoff (no BFS path)
  | 'raw-storage-full';   // Raw storage at capacity, cannot unload cargo

/** Runtime state for a single harvester unit. */
export interface HarvesterState {
  id: string;
  ownerTeamId?: TeamId;
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
  /** Reason when harvester is blocked and cannot make progress. Cleared when progress resumes. */
  blockedReason?: HarvesterBlockedReason;
  /** Civil durability fields are optional only for old saves and fixtures. */
  hp?: number;
  maxHp?: number;
  isDestroyed?: boolean;
  destroyedAt?: number | null;
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
  /**
   * Optional accepted resource class ID from the 6-class production model.
   * CORE-STEP-03A: Added for backward-compatible runtime support.
   * When present, runtime helpers can resolve asset key and amount range
   * from the production config. When absent, legacy resourceType is used.
   * This field is NOT populated by current map generation (Step 03B will).
   */
  resourceClass?: AcceptedResourceClassId;
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
  ownerTeamId?: TeamId;
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

// ─── Legacy modular production aliases ────────────────────────────────

/** @deprecated Use T1_BODY_COMPONENTS.wasp.matterCost. */
export const WASP_CHASSIS_MATTER_COST = T1_BODY_COMPONENTS.wasp.matterCost;
/** @deprecated Use T1_BODY_COMPONENTS.wasp.elementCost. */
export const WASP_CHASSIS_ELEMENT_COST = T1_BODY_COMPONENTS.wasp.elementCost;
/** @deprecated Use T1_BODY_COMPONENTS.wasp.productionDurationMs. */
export const WASP_CHASSIS_PRODUCTION_DURATION_MS = T1_BODY_COMPONENTS.wasp.productionDurationMs;
/** @deprecated Use T1_WEAPON_COMPONENTS.smoky.matterCost. */
export const SMOKY_WEAPON_MATTER_COST = T1_WEAPON_COMPONENTS.smoky.matterCost;
/** @deprecated Use T1_WEAPON_COMPONENTS.smoky.elementCost. */
export const SMOKY_WEAPON_ELEMENT_COST = T1_WEAPON_COMPONENTS.smoky.elementCost;
/** @deprecated Use T1_WEAPON_COMPONENTS.smoky.productionDurationMs. */
export const SMOKY_WEAPON_PRODUCTION_DURATION_MS = T1_WEAPON_COMPONENTS.smoky.productionDurationMs;
/** @deprecated Use getT1CombatProductionQuote(). */
export const WASP_SMOKY_TOTAL_MATTER_COST = T1_BODY_COMPONENTS.wasp.matterCost + T1_WEAPON_COMPONENTS.smoky.matterCost;
/** @deprecated Use getT1CombatProductionQuote(). */
export const WASP_SMOKY_TOTAL_ELEMENT_COST = T1_BODY_COMPONENTS.wasp.elementCost + T1_WEAPON_COMPONENTS.smoky.elementCost;
/** @deprecated Use getT1CombatProductionQuote(). */
export const WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS = Math.max(
  T1_BODY_COMPONENTS.wasp.productionDurationMs,
  T1_WEAPON_COMPONENTS.smoky.productionDurationMs,
) + T1_ASSEMBLY_OFFSET_MS;

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
/** Element cap bonus per element-storage building (in elementUnits). */
export const ELEMENT_STORAGE_ELEMENT_BONUS = 200;

// ─── Unit Cap Constants (FIX-03) ──────────────────────────────────────

/** Default maximum number of player civil units (builders + harvesters). */
export const DEFAULT_UNIT_CAP = 10;

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

export type CivilUnitType = 'builder' | 'harvester';

/** Backward-compatible command/UI identifiers. */
export type ProducibleUnitType = CivilUnitType | 'wasp-smoky';

export interface CombatProductionConfig {
  bodyId: BodyId;
  weaponId: WeaponId;
  hullMod: ModLevel;
  turretMod: ModLevel;
}

/** Structured queue request; Phase 3 can supply arbitrary legal combinations. */
export type UnitProductionRequest =
  | { kind: 'civil'; unitType: CivilUnitType }
  | ({ kind: 'combat' } & CombatProductionConfig);

/** A single item in a factory production queue. */
export interface ProductionQueueItem {
  /** Backward-compatible label used by the current HUD and old saves. */
  unitType: ProducibleUnitType;
  /** Canonical structured request. Optional only for old-save migration. */
  request?: UnitProductionRequest;
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
  ownerTeamId?: TeamId;
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

export interface TeamState {
  id: TeamId;
  faction: Faction;
  controller: TeamController;
  difficulty: AiDifficulty | null;
  economy: EconomyState;
  vision: VisionState;
  unitCap: number;
  techTier: TechTier;
  hqPosition: { tx: number; ty: number } | null;
  eliminated: boolean;
}

export interface MatchState {
  humanTeamId: TeamId;
  activeTeamIds: TeamId[];
  teams: Record<TeamId, TeamState>;
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
  /** Canonical four-team state. Optional only for old saves and legacy fixtures. */
  match?: MatchState;
  /** Extra starter units not present in the original saved map. */
  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction; ownerTeamId?: TeamId }>;
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
  /** Auto-incrementing counter for deterministic produced combat-unit IDs. Missing only in old saves/fixtures. */
  nextCombatUnitId?: number;
  /** Auto-incrementing counter for deterministic produced civil-unit IDs. */
  nextCivilUnitId?: number;
  /** Deterministic civil destruction/replacement timeline. */
  civilClockMs?: number;

  // ── ARCH-01F: Production state ────────────────────────────────
  /** Production state for all units-factories. */
  production: ProductionState;

  // ── Phase 2: Combat units ──────────────────────────────────────
  /** Deterministic production-combat timeline used for cooldowns, flashes and wreck cleanup. */
  combatClockMs?: number;
  /** All combat units produced by factories. Phase 2: wasp-smoky and future presets. */
  combatUnits: ModularCombatUnit[];

  // ── FOG-VISION-08: Vision/fog state ────────────────────────────
  /** Vision state for fog of war. Explored grid persists in saves; visible grid is recomputed. */
  vision: VisionState;

  // ── BLOCKOUT-02H: Blockout vehicle state (dev-only, not persisted) ──
  /** Blockout vehicles — only populated in dev/arena mode.
   *  Optional: old saves and standard mode games have this as undefined/empty.
   *  Blockout vehicles are stripped from saves and never serialized.
   *  BLOCKOUT-03H: Added turretTargetAngle and turretTurnSpeedDeg for independent turret aiming.
   *  BLOCKOUT-04H+: Added movement fields (worldX/worldY, velocity, move target).
   *  BLOCKOUT-05H+: Added recoil/firing fields.
   *  BLOCKOUT-06H+: Added continuous fire fields (fireHeld, isFiring, lastStreamTickAt, visualOverheat).
   *  BLOCKOUT-07H+: Added HP/damage fields (hp, maxHp, isDestroyed, destroyedAt, lastDamagedAt, damageFlashUntil, activeStatusTags).
   *  ARENA-05H+: Added AI mode fields (aiMode, aiHoldX, aiHoldY, aiHoldRadius). */
  blockoutVehicles?: import('./blockoutVehicleState').BlockoutVehicleState[]

  // ── BLOCKOUT-08H: Blockout obstacle state (dev-only, not persisted) ──
  /** Blockout obstacles — only populated in dev/arena mode.
   *  Optional: old saves and standard mode games have this as undefined/empty.
   *  Blockout obstacles are stripped from saves and never serialized.
   *  BLOCKOUT-08H: Dev/arena-only blockout obstacles for combat sandbox. */
  blockoutObstacles?: BlockoutObstacleState[]
}
