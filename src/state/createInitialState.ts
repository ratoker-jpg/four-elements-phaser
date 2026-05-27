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
  RESOURCE_RAW_AMOUNTS,
  START_RAW,
  START_MATTER,
  HQ_RAW_CAP,
  HQ_MATTER_CAP,
  HQ_ELEMENT_CAP,
  RAW_STORAGE_RAW_BONUS,
  MATTER_STORAGE_MATTER_BONUS,
  MATTER_STORAGE_ELEMENT_BONUS,
  HQ_BASE_POWER,
  POWER_PLANT_GENERATION,
} from './types';
import { createHarvester } from './updateGameState';
import { customMap1 } from '../data/maps/customMap1';

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
 */
export function createInitialState(mapData: MapData = customMap1, playerFaction?: Faction, mapNameOverride?: string): GameState {
  // Resolve player faction: explicit override > map data default
  const faction = playerFaction ?? (mapData.hq.faction as Faction);

  // Flatten all map entities into a unified renderable entity list
  const entities = flattenMapEntities(mapData, faction);

  // Add extra starter units not present in the original saved map
  const extraHarvesters = createExtraHarvesters(mapData, faction);
  const extraModularCombat = createExtraModularCombat(mapData, extraHarvesters, faction);

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
  const harvesters = buildHarvesterStates(extraHarvesters, mapData);
  const resourceNodes = buildResourceNodeStates(mapData);
  const hqPosition = { tx: mapData.hq.tx + 1, ty: mapData.hq.ty + 1 }; // HQ center (3×3 footprint)

  // ARCH-16B: Derive mapName from mapData or use override
  const mapName = mapNameOverride ?? `Map ${mapData.width}x${mapData.height}`;

  return {
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
    economy: createInitialEconomy(faction, mapData),
    hqPosition,
    nextConstructionId: 0,
    production: createInitialProduction(mapData),
  };
}

// ─── PR3: Runtime state builders ────────────────────────────────────

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
      elementCap += MATTER_STORAGE_ELEMENT_BONUS;
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
    nodes.push({
      id: `resource-${nextId++}`,
      tx: r.tx,
      ty: r.ty,
      resourceType: r.type,
      footprint: r.footprint,
      remainingRaw: RESOURCE_RAW_AMOUNTS[r.type],
      depleted: false,
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

function flattenMapEntities(mapData: MapData, faction: Faction): RenderableEntity[] {
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

  // Builders from saved map
  for (const builder of mapData.builders) {
    entities.push({
      id: id('builder'),
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

  const candidates = [
    { tx: hqCx + 2, ty: hqCy },
    { tx: hqCx + 2, ty: hqCy + 1 },
    { tx: hqCx + 1, ty: hqCy + 2 },
    { tx: hqCx, ty: hqCy + 2 },
    { tx: hqCx - 1, ty: hqCy + 2 },
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

  const candidates = [
    { tx: hq.tx + 3, ty: hq.ty + 1 },
    { tx: hq.tx + 1, ty: hq.ty + 3 },
    { tx: hq.tx - 1, ty: hq.ty + 1 },
    { tx: hq.tx + 1, ty: hq.ty - 1 },
    { tx: hq.tx + 3, ty: hq.ty + 2 },
    { tx: hq.tx + 2, ty: hq.ty + 3 },
    { tx: hq.tx, ty: hq.ty + 3 },
    { tx: hq.tx - 1, ty: hq.ty + 2 },
    { tx: hq.tx - 1, ty: hq.ty },
    { tx: hq.tx, ty: hq.ty - 1 },
    { tx: hq.tx + 2, ty: hq.ty - 1 },
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
