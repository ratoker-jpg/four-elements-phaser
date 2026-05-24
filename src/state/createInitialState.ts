import type {
  GameState,
  MapData,
  ResourceCounters,
  RenderableEntity,
  Faction,
} from './types';
import { customMap1 } from '../data/maps/customMap1';

/**
 * Create the initial GameState from a saved MapData definition.
 *
 * This is the single source of truth for game state initialization.
 * The render layer reads from GameState but never mutates it directly.
 *
 * Entities are flattened from the donor MapData schema into a unified
 * RenderableEntity list for the render layer. Extra starter units
 * (harvesters, modular combat) that are NOT in the saved map are
 * added separately and clearly marked.
 */
export function createInitialState(mapData: MapData = customMap1): GameState {
  // Flatten all map entities into a unified renderable entity list
  const entities = flattenMapEntities(mapData);

  // Add extra starter units not present in the original saved map
  const extraHarvesters = createExtraHarvesters(mapData);
  const extraModularCombat = createExtraModularCombat(mapData);

  // Add harvesters to the entity list
  for (const h of extraHarvesters) {
    entities.push({
      id: `extra-harvester-${h.tx}-${h.ty}`,
      kind: 'harvester',
      tx: h.tx,
      ty: h.ty,
      faction: h.faction,
    });
  }

  // Add modular combat unit (state-only, no visual asset yet)
  for (const mc of extraModularCombat) {
    entities.push({
      id: `extra-modular-${mc.tx}-${mc.ty}`,
      kind: 'modular-combat',
      tx: mc.tx,
      ty: mc.ty,
      faction: mc.faction,
      stateOnly: true,
    });
  }

  // Count resources by type from map data
  const resources = countResources(mapData.resources);

  return {
    mapId: `map-${mapData.hq.faction}-${mapData.width}x${mapData.height}`,
    mapName: 'Карта 1',
    mapWidth: mapData.width,
    mapHeight: mapData.height,
    mapData,
    entities,
    playerFaction: mapData.hq.faction as Faction,
    extraHarvesters,
    extraModularCombat,
    resources,
  };
}

/**
 * Flatten the donor MapData's separate arrays (hq, resources, obstacles,
 * decor, builders) into a single RenderableEntity list for the render layer.
 *
 * Buildings and construction sites are included but have no visual assets yet.
 * Decor is included but has no visual assets yet.
 * Obstacles are included but have no visual assets yet.
 */
function flattenMapEntities(mapData: MapData): RenderableEntity[] {
  const entities: RenderableEntity[] = [];
  let nextId = 1;
  const id = (prefix: string) => `${prefix}-${nextId++}`;

  // HQ
  entities.push({
    id: id('hq'),
    kind: 'hq',
    tx: mapData.hq.tx,
    ty: mapData.hq.ty,
    faction: mapData.hq.faction as Faction,
  });

  // Builders from saved map
  for (const builder of mapData.builders) {
    entities.push({
      id: id('builder'),
      kind: 'builder',
      tx: builder.tx,
      ty: builder.ty,
      faction: mapData.hq.faction as Faction,
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
      kind: 'resource', // Reuse resource rendering pipeline for now
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
      kind: 'resource', // Reuse resource rendering pipeline for now
      tx: decor.tx,
      ty: decor.ty,
      stateOnly: true,
    });
  }

  // Buildings — state-only, no visual assets yet
  for (const building of mapData.buildings) {
    entities.push({
      id: id('building'),
      kind: 'hq', // Reuse HQ rendering pipeline type for now
      tx: building.tx,
      ty: building.ty,
      faction: mapData.hq.faction as Faction,
      stateOnly: true,
    });
  }

  return entities;
}

/**
 * Create extra harvester units not present in the original saved map.
 * Placed adjacent to HQ on the side opposite the builder.
 */
function createExtraHarvesters(mapData: MapData): Array<{ tx: number; ty: number; faction: Faction }> {
  const faction = mapData.hq.faction as Faction;
  const hqCx = mapData.hq.tx + 1; // HQ footprint center x (approx)
  const hqCy = mapData.hq.ty + 1;

  // Place 2 harvesters on the ring around HQ, away from the builder
  // Builder is at (3,3) which is NW of HQ at (4,4)
  // Place harvesters on SE/E side of HQ
  const positions: Array<{ tx: number; ty: number }> = [];

  // Try positions on the east/south-east ring of HQ
  const candidates = [
    { tx: hqCx + 2, ty: hqCy },     // East
    { tx: hqCx + 2, ty: hqCy + 1 }, // SE
    { tx: hqCx + 1, ty: hqCy + 2 }, // South
    { tx: hqCx, ty: hqCy + 2 },     // SW
    { tx: hqCx - 1, ty: hqCy + 2 }, // S-SW
  ];

  // Check occupied tiles from map data
  const occupied = new Set<string>();
  // Mark HQ footprint
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      occupied.add(`${mapData.hq.tx + dx},${mapData.hq.ty + dy}`);
    }
  }
  // Mark builder positions
  for (const b of mapData.builders) {
    occupied.add(`${b.tx},${b.ty}`);
  }
  // Mark resource footprints
  for (const r of mapData.resources) {
    for (let dy = 0; dy < r.footprint; dy++) {
      for (let dx = 0; dx < r.footprint; dx++) {
        occupied.add(`${r.tx + dx},${r.ty + dy}`);
      }
    }
  }

  for (const c of candidates) {
    if (positions.length >= 2) break;
    if (c.tx < 0 || c.ty < 0 || c.tx >= mapData.width || c.ty >= mapData.height) continue;
    if (!occupied.has(`${c.tx},${c.ty}`)) {
      positions.push(c);
      occupied.add(`${c.tx},${c.ty}`);
    }
  }

  return positions.map(p => ({ ...p, faction }));
}

/**
 * Create an extra modular combat unit not present in the original saved map.
 * State-only: chassis=wasp, weapon=smoky, mod=m0.
 * No visual asset exists yet.
 */
function createExtraModularCombat(mapData: MapData): Array<{
  tx: number;
  ty: number;
  chassis: 'wasp';
  weapon: 'smoky';
  mod: 'm0';
  faction: Faction;
}> {
  const faction = mapData.hq.faction as Faction;
  // Place near HQ, east side
  return [{
    tx: mapData.hq.tx + 3,
    ty: mapData.hq.ty + 1,
    chassis: 'wasp',
    weapon: 'smoky',
    mod: 'm0',
    faction,
  }];
}

function countResources(resources: MapData['resources']): ResourceCounters {
  const counters: ResourceCounters = { small: 0, medium: 0, large: 0, infinite: 0 };
  for (const resource of resources) {
    counters[resource.type]++;
  }
  return counters;
}
