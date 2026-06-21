import type {
  GameState,
  MapData,
  RenderableEntity,
  Faction,
  HarvesterState,
  ResourceNodeState,
  EconomyState,
  SeparatorRuntimeState,
  ProductionState,
} from './types';
import {
  START_RAW,
  START_MATTER,
  HQ_RAW_CAP,
  HQ_MATTER_CAP,
  HQ_ELEMENT_CAP,
  RAW_STORAGE_RAW_BONUS,
  MATTER_STORAGE_MATTER_BONUS,
  ELEMENT_STORAGE_ELEMENT_BONUS,
  HQ_BASE_POWER,
  POWER_PLANT_GENERATION,
} from './types';
import { resolveResourceRawAmount } from '../config/resourceClassRuntime';
import { createHarvester } from './updateGameState';
import { customMap1 } from '../data/maps/customMap1';
import { createInitialVisionState, recomputeVisibility } from './visibility';

/** Options for createInitialState. */
export interface CreateInitialStateOptions {
  /**
   * Whether to include the starter modular-combat entity.
   * PHASER4-LOAD-02: Default false — standard mode does not create
   * modular-combat entities because modularUnits textures are not loaded.
   * Set to true when devtools/arena mode is active.
   */
  includeModularCombat?: boolean;

  /**
   * ARENA-01H+: Whether to create Arena-specific initial state.
   *
   * When true:
   * - No HQ entity in flattened entities (HQ data stays in MapData for type compat)
   * - No builder entities
   * - No resource entities
   * - No extra harvesters
   * - No extra modular combat units
   * - Empty harvester/runtime arrays
   * - Minimal economy (all zeros, no separators)
   * - Empty production state
   * - hqPosition set to map center instead of HQ tile
   *
   * Default false — Normal Game creates full state.
   */
  arenaMode?: boolean;
}

/**
 * Create the initial GameState from a saved MapData definition.
 *
 * This is the single source of truth for game state initialization.
 * The render layer reads from GameState but never mutates it directly.
 *
 * PR3: Extracts harvester and resource entities into dedicated runtime
 * state arrays (HarvesterState[], ResourceNodeState[]) for the civil
 * gather/deliver loop. Extra harvesters are also tracked as runtime
 * state units.
 *
 * PHASER4-LOAD-02: modular-combat starter entity is only created when
 * options.includeModularCombat is true (devtools/arena mode).
 */
export function createInitialState(mapData: MapData = customMap1, playerFaction?: Faction, mapNameOverride?: string, options?: CreateInitialStateOptions): GameState {
  // Resolve player faction: explicit override > map data default
  const faction = playerFaction ?? (mapData.hq.faction as Faction);

  // ARENA-01H+: Arena mode skips Normal Game entities
  const arenaMode = options?.arenaMode ?? false;

  // BUILDER-ID: Migrate any builders that lack an 'id' field (old saves / map data)
  // BEFORE flattening entities. This ensures builder IDs are available when
  // renderable entities are created, so entity IDs match builder IDs.
  ensureBuilderIds(mapData);

  // Flatten all map entities into a unified renderable entity list
  // ARENA-01H+: Arena mode flattens to empty (no HQ, no builders, no resources)
  const entities = flattenMapEntities(mapData, faction, arenaMode);

  // Add extra starter units not present in the original saved map
  // ARENA-01H+: Arena mode has no extra harvesters
  const extraHarvesters = arenaMode ? [] : createExtraHarvesters(mapData, faction);

  // PHASER4-LOAD-02: Only create modular-combat starter entity in devtools/arena mode.
  // Standard mode skips it because modularUnits textures are not loaded.
  const includeModularCombat = options?.includeModularCombat ?? false;
  // ARENA-01H+: Arena mode has no modular combat starter (blockout vehicles handle that)
  const extraModularCombat = (includeModularCombat && !arenaMode)
    ? createExtraModularCombat(mapData, extraHarvesters, faction)
    : [];

  // Add extra harvesters to the entity list
  for (const h of extraHarvesters) {
    entities.push({
      id: `extra-harvester-${h.tx}-${h.ty}`,
      kind: 'harvester',
      tx: h.tx,
      ty: h.ty,
      faction: h.faction,
    });
  }

  // Add the starter modular combat unit for the visual MVP.
  for (const mc of extraModularCombat) {
    entities.push({
      id: `extra-modular-${mc.tx}-${mc.ty}`,
      kind: 'modular-combat',
      tx: mc.tx,
      ty: mc.ty,
      faction: mc.faction,
      dir: 2, // default body facing: South
      turretDir: 2, // default turret facing: South (matches bodyDir)
    });
  }

  // ── PR3: Build runtime state ────────────────────────────────────
  const harvesters = arenaMode ? [] : buildHarvesterStates(extraHarvesters, mapData);
  const resourceNodes = arenaMode ? [] : buildResourceNodeStates(mapData);
  // ARENA-01H+: Arena uses map center instead of HQ position
  const hqPosition = arenaMode
    ? { tx: Math.floor(mapData.width / 2), ty: Math.floor(mapData.height / 2) }
    : { tx: mapData.hq.tx + 1, ty: mapData.hq.ty + 1 }; // HQ center (3×3 footprint)

  // ARCH-16B: Derive mapName from mapData or use override
  const mapName = mapNameOverride ?? `Map ${mapData.width}x${mapData.height}`;

  const state: GameState = {
    mapId: `map-${faction}-${mapData.width}x${mapData.height}`,
    mapName,
    mapWidth: mapData.width,
    mapHeight: mapData.height,
    mapData,
    entities,
    playerFaction: faction,
    extraHarvesters,
    extraModularCombat,

    // PR3 runtime state
    harvesters,
    resourceNodes,
    economy: arenaMode ? createArenaEconomy() : createInitialEconomy(faction, mapData),
    hqPosition,
    nextConstructionId: 0,
    production: arenaMode ? { factories: [] } : createInitialProduction(mapData),

    // FOG-VISION-08: Initialize vision state and compute initial visibility
    vision: createInitialVisionState(mapData.width, mapData.height),
  };

  // FOG-VISION-08: Compute initial visibility from HQ and starting units
  // Arena mode gets no fog (all tiles explored)
  if (!arenaMode) {
    recomputeVisibility(state);
  } else {
    // Arena: mark all tiles as explored so there is no fog
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        state.vision.explored[y][x] = true;
        state.vision.visible[y][x] = true;
      }
    }
    state.vision.dirty = false;
  }

  return state;
}

// ─── PHASER4-LOAD-02: Loaded-save sanitization ─────────────────────

/**
 * Strip modular-combat entities from a loaded GameState when running
 * in standard mode (devtools disabled).
 *
 * PHASER4-LOAD-02: Older saves created before this PR may contain
 * `extraModularCombat` entries and `modular-combat` entities. In
 * standard mode, PreloadScene skips modularUnits textures, so
 * rendering those entities would hit missing textures. This helper
 * removes them so the loaded state is safe for the current runtime mode.
 *
 * When `includeModularCombat` is true (devtools/arena mode), the
 * state is returned unchanged — modular-combat entities are preserved
 * because their textures were loaded.
 *
 * This is a **pure function** — it does not mutate the input.
 */
export function stripModularCombatFromState(
  state: GameState,
  { includeModularCombat }: { includeModularCombat: boolean },
): GameState {
  if (includeModularCombat) return state;

  // Nothing to strip if state already has no modular-combat
  const hasModularEntities = state.entities.some(e => e.kind === 'modular-combat');
  const hasExtraModular = state.extraModularCombat && state.extraModularCombat.length > 0;
  const hasBlockoutVehicles = (state.blockoutVehicles?.length ?? 0) > 0;
  if (!hasModularEntities && !hasExtraModular && !hasBlockoutVehicles) return state;

  const result: GameState = {
    ...state,
    entities: state.entities.filter(e => e.kind !== 'modular-combat'),
    extraModularCombat: [],
  };

  // BLOCKOUT-02H: Strip blockout vehicles from saves in standard mode
  if (hasBlockoutVehicles) {
    result.blockoutVehicles = [];
  }

  return result;
}

// ─── BUILDER-ID: Migration helper ──────────────────────────────────

/**
 * Ensure every builder in mapData has a stable string ID.
 *
 * For old map data / saves without builder.id, assigns `builder-{index}`.
 * Existing IDs are preserved. Must run before flattenMapEntities so
 * that renderable entity IDs are derived from the same stable IDs.
 *
 * This helper is also applied at the save/load boundary so that
 * old saves loaded via loadGame() (which bypasses createInitialState)
 * also get builder IDs migrated.
 */
export function ensureBuilderIds(mapData: MapData): void {
  for (let i = 0; i < mapData.builders.length; i++) {
    const b = mapData.builders[i];
    if (!(b as any).id) {
      (b as any).id = `builder-${i}`;
    }
  }
}

// ─── PR3: Runtime state builders ────────────────────────────────────

/**
 * ARENA-01H+: Create minimal Arena economy (all zeros, no separators).
 * Arena mode does not run the civil loop, so economy is dormant.
 */
function createArenaEconomy(): EconomyState {
  return {
    raw: 0,
    matter: 0,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
    powerGenerated: 0,
    powerConsumed: 0,
    separators: [],
    rawCap: 0,
    matterCap: 0,
    elementCap: 0,
  };
}

/** Create initial EconomyState with ROADMAP starting values. */
function createInitialEconomy(_playerFaction: Faction, mapData: MapData): EconomyState {
  // ARCH-01C: Initialize separator runtime state from existing completed separator buildings.
  const separators: SeparatorRuntimeState[] = mapData.buildings
    .filter(b => b.type === 'separator')
    .map(b => ({
      tx: b.tx,
      ty: b.ty,
      progress: 0,
      active: false,
    }));

  // ARCH-01D: Initialize caps from existing completed buildings.
  // Base HQ caps + bonuses from raw-storage and matter-storage buildings.
  let rawCap = HQ_RAW_CAP;
  let matterCap = HQ_MATTER_CAP;
  let elementCap = HQ_ELEMENT_CAP;

  for (const building of mapData.buildings) {
    if (building.type === 'raw-storage') {
      rawCap += RAW_STORAGE_RAW_BONUS;
    } else if (building.type === 'matter-storage') {
      matterCap += MATTER_STORAGE_MATTER_BONUS;
    } else if (building.type === 'element-storage') {
      elementCap += ELEMENT_STORAGE_ELEMENT_BONUS;
    }
  }

  // ARCH-01E: Compute powerGenerated from HQ base + power-plant buildings.
  const powerPlantCount = mapData.buildings.filter(b => b.type === 'power-plant').length;
  const powerGenerated = HQ_BASE_POWER + powerPlantCount * POWER_PLANT_GENERATION;

  return {
    raw: START_RAW,
    matter: START_MATTER,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
    powerGenerated,
    powerConsumed: 0,
    separators,
    rawCap,
    matterCap,
    elementCap,
  };
}

/** Build HarvesterState[] from extra harvester positions. */
function buildHarvesterStates(
  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>,
  _mapData: MapData,
): HarvesterState[] {
  // Currently the only harvesters are the extra ones
  // (no harvesters in the saved map data schema)
  return extraHarvesters.map((h, i) =>
    createHarvester(`harvester-${i}`, h.tx, h.ty, h.faction),
  );
}

/** Build ResourceNodeState[] from map data resource placements. */
function buildResourceNodeStates(mapData: MapData): ResourceNodeState[] {
  const nodes: ResourceNodeState[] = [];
  let nextId = 0;
  for (const r of mapData.resources) {
    // CORE-STEP-03C: Use resourceClass-aware amount resolution.
    // When resourceClass is present and valid, amounts come from the
    // 6-class config (midpoint of [amountMin, amountMax] for finite,
    // legacy infinite amount for infinite). When missing/invalid,
    // falls back to RESOURCE_RAW_AMOUNTS[legacyType].
    const rawAmount = resolveResourceRawAmount(r);
    nodes.push({
      id: `resource-${nextId++}`,
      tx: r.tx,
      ty: r.ty,
      resourceType: r.type,
      footprint: r.footprint,
      remainingRaw: rawAmount,
      depleted: false,
      // CORE-STEP-03B: Propagate resourceClass from map data if present
      ...(r.resourceClass ? { resourceClass: r.resourceClass } : {}),
    });
  }
  return nodes;
}

/** Create initial ProductionState from existing completed units-factory buildings. */
function createInitialProduction(mapData: MapData): ProductionState {
  const factories = mapData.buildings
    .filter(b => b.type === 'units-factory')
    .map(b => ({
      tx: b.tx,
      ty: b.ty,
      queue: [],
      active: false,
    }));

  return { factories };
}

// ─── Flatten helpers (PR2 unchanged) ────────────────────────────────

/**
 * Flatten all map entities into a unified renderable entity list.
 *
 * ARENA-01H+: When arenaMode is true, no HQ/builder/resource/obstacle/decor/building
 * entities are created — the arena is a clean sandbox.
 */
function flattenMapEntities(mapData: MapData, faction: Faction, arenaMode: boolean): RenderableEntity[] {
  // ARENA-01H+: Arena mode has no Normal Game entities
  if (arenaMode) {
    return [];
  }

  const entities: RenderableEntity[] = [];
  let nextId = 1;
  const id = (prefix: string) => `${prefix}-${nextId++}`;

  // HQ
  entities.push({
    id: id('hq'),
    kind: 'hq',
    tx: mapData.hq.tx,
    ty: mapData.hq.ty,
    faction,
  });

  // Builders from saved map — use builder.id (stable ID from ensureBuilderIds)
  for (const builder of mapData.builders) {
    entities.push({
      id: builder.id,
      kind: 'builder',
      tx: builder.tx,
      ty: builder.ty,
      faction,
    });
  }

  // Resources
  for (const resource of mapData.resources) {
    entities.push({
      id: id('resource'),
      kind: 'resource',
      tx: resource.tx,
      ty: resource.ty,
      resourceType: resource.type,
      footprint: resource.footprint,
    });
  }

  // Obstacles — state-only, no visual assets yet
  for (const obstacle of mapData.obstacles) {
    entities.push({
      id: id('obstacle'),
      kind: 'resource',
      tx: obstacle.tx,
      ty: obstacle.ty,
      stateOnly: true,
      footprint: obstacle.footprint,
    });
  }

  // Decor — state-only, no visual assets yet
  for (const decor of mapData.decor) {
    entities.push({
      id: id('decor'),
      kind: 'resource',
      tx: decor.tx,
      ty: decor.ty,
      stateOnly: true,
    });
  }

  // Buildings — state-only, no visual assets yet
  for (const building of mapData.buildings) {
    entities.push({
      id: id('building'),
      kind: 'hq',
      tx: building.tx,
      ty: building.ty,
      faction,
      stateOnly: true,
    });
  }

  return entities;
}

function createExtraHarvesters(mapData: MapData, faction: Faction): Array<{ tx: number; ty: number; faction: Faction }> {
  const hqCx = mapData.hq.tx + 1; // HQ footprint center x (approx)
  const hqCy = mapData.hq.ty + 1;

  const positions: Array<{ tx: number; ty: number }> = [];

  // VISUAL-05A-PR4: Place harvesters NE of HQ (toward map center) since HQ
  // is now in the lower-left. Prefer north and east spawn tiles.
  const candidates = [
    { tx: hqCx + 2, ty: hqCy },        // east
    { tx: hqCx + 2, ty: hqCy - 1 },    // east-north
    { tx: hqCx + 1, ty: hqCy - 2 },    // north-east
    { tx: hqCx, ty: hqCy - 2 },         // north
    { tx: hqCx - 1, ty: hqCy - 2 },     // west-north
  ];

  const occupied = buildStarterOccupiedSet(mapData);

  for (const c of candidates) {
    if (positions.length >= 2) break;
    if (isFreeStarterTile(mapData, occupied, c.tx, c.ty)) {
      positions.push(c);
      occupied.add(`${c.tx},${c.ty}`);
    }
  }

  return positions.map(p => ({ ...p, faction }));
}

function createExtraModularCombat(
  mapData: MapData,
  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>,
  faction: Faction,
): Array<{
  tx: number;
  ty: number;
  chassis: 'wasp';
  weapon: 'smoky';
  mod: 'm0';
  faction: Faction;
}> {
  const occupied = buildStarterOccupiedSet(mapData, extraHarvesters);
  const hq = mapData.hq;

  // VISUAL-05A-PR4: Modular combat candidates biased NE of HQ (toward center)
  const candidates = [
    { tx: hq.tx + 3, ty: hq.ty - 1 },
    { tx: hq.tx + 1, ty: hq.ty - 3 },
    { tx: hq.tx - 1, ty: hq.ty - 1 },
    { tx: hq.tx + 1, ty: hq.ty + 1 },
    { tx: hq.tx + 3, ty: hq.ty - 2 },
    { tx: hq.tx + 2, ty: hq.ty - 3 },
    { tx: hq.tx, ty: hq.ty - 3 },
    { tx: hq.tx - 1, ty: hq.ty - 2 },
    { tx: hq.tx - 1, ty: hq.ty },
    { tx: hq.tx, ty: hq.ty + 1 },
    { tx: hq.tx + 2, ty: hq.ty + 1 },
    { tx: hq.tx + 3, ty: hq.ty },
  ];

  for (const candidate of candidates) {
    if (!isFreeStarterTile(mapData, occupied, candidate.tx, candidate.ty)) continue;
    return [{
      tx: candidate.tx,
      ty: candidate.ty,
      chassis: 'wasp',
      weapon: 'smoky',
      mod: 'm0',
      faction,
    }];
  }

  return [];
}

function buildStarterOccupiedSet(
  mapData: MapData,
  extraHarvesters: Array<{ tx: number; ty: number }> = [],
): Set<string> {
  const occupied = new Set<string>();

  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      occupied.add(`${mapData.hq.tx + dx},${mapData.hq.ty + dy}`);
    }
  }

  for (const builder of mapData.builders) {
    occupied.add(`${builder.tx},${builder.ty}`);
  }

  for (const resource of mapData.resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        occupied.add(`${resource.tx + dx},${resource.ty + dy}`);
      }
    }
  }

  for (const harvester of extraHarvesters) {
    occupied.add(`${harvester.tx},${harvester.ty}`);
  }

  return occupied;
}

function isFreeStarterTile(
  mapData: MapData,
  occupied: Set<string>,
  tx: number,
  ty: number,
): boolean {
  if (tx < 0 || ty < 0 || tx >= mapData.width || ty >= mapData.height) return false;
  return !occupied.has(`${tx},${ty}`);
}
