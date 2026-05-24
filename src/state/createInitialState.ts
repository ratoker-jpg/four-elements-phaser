import type { GameState, MapData, ResourceCounters } from './types';
import { customMap1 } from '../data/maps/customMap1';

/**
 * Create the initial GameState from a saved MapData definition.
 *
 * This is the single source of truth for game state initialization.
 * The render layer reads from GameState but never mutates it directly.
 */
export function createInitialState(mapData: MapData = customMap1): GameState {
  // Count resources by type from entity list
  const resources = countResources(mapData.entities);

  return {
    mapId: mapData.id,
    mapName: mapData.name,
    mapWidth: mapData.width,
    mapHeight: mapData.height,
    terrain: mapData.terrain,
    entities: mapData.entities,
    playerFaction: mapData.playerFaction,
    resources,
  };
}

function countResources(entities: MapData['entities']): ResourceCounters {
  const counters: ResourceCounters = { small: 0, medium: 0, large: 0, infinite: 0 };
  for (const entity of entities) {
    if (entity.kind === 'resource' && entity.resourceType) {
      counters[entity.resourceType]++;
    }
  }
  return counters;
}
