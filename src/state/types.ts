/**
 * Pure TypeScript state model for Four Elements.
 *
 * No Phaser dependencies. All game state lives here.
 * The render layer reads from GameState but never mutates it directly.
 */

// ─── Terrain ────────────────────────────────────────────────────────

/** Terrain types matching the 3 legacy sand tiles used by the active render path. */
export type TerrainType = 'sand' | 'sand-dark' | 'sand-light';

// ─── Factions ───────────────────────────────────────────────────────

export type Faction = 'cyan' | 'green' | 'yellow' | 'purple';

// ─── Entities ───────────────────────────────────────────────────────

export type EntityKind = 'hq' | 'builder' | 'harvester' | 'resource';

export type ResourceType = 'small' | 'medium' | 'large' | 'infinite';

/** Unique entity identifier. */
export type EntityId = string;

/** A single game entity on the map. */
export interface Entity {
  id: EntityId;
  kind: EntityKind;
  tx: number;
  ty: number;
  /** Faction owner — relevant for buildings and units, not for resources. */
  faction?: Faction;
  /** Resource type — only for kind='resource'. */
  resourceType?: ResourceType;
}

// ─── Map Data ───────────────────────────────────────────────────────

/** Saved map metadata and content. */
export interface MapData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  terrain: TerrainType[][];
  entities: Entity[];
  playerFaction: Faction;
}

// ─── Game State ─────────────────────────────────────────────────────

/** Resource counters placeholder — no economy loop yet. */
export interface ResourceCounters {
  small: number;
  medium: number;
  large: number;
  infinite: number;
}

/** Top-level game state. Pure data, no methods, no Phaser. */
export interface GameState {
  mapId: string;
  mapName: string;
  mapWidth: number;
  mapHeight: number;
  terrain: TerrainType[][];
  entities: Entity[];
  playerFaction: Faction;
  /** Resource counters — placeholder, not yet driven by economy loop. */
  resources: ResourceCounters;
}
