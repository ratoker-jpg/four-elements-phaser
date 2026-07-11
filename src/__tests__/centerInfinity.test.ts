import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import {
  CENTER_INFINITY_FOOTPRINT,
  CENTER_PROTECTION_MARGIN,
  createCenterInfinityPlacement,
  getCenterApproachSectors,
  getCenterProtectedTiles,
  isExactCenterInfinity,
  validateCenterInfinityContract,
} from '../state/centerInfinity';
import { buildOccupancyMap, getFlags, isBuildable, isPassable } from '../state/occupancy';
import type { MapSizeOption } from '../state/generatedMapTypes';

const SIZES: MapSizeOption[] = ['small', 'standard', 'large'];

function tileKeys(tiles: Array<{ tx: number; ty: number }>): Set<string> {
  return new Set(tiles.map(tile => `${tile.tx},${tile.ty}`));
}

describe('SKIRMISH-P5C canonical center Infinity contract', () => {
  it.each(SIZES)('places exactly one canonical centered 2x2 Infinity on %s maps', size => {
    const map = createGeneratedMapData(`center-infinity-${size}`, size, 'cyan');
    const infinite = map.resources.filter(resource =>
      resource.type === 'infinite' || resource.resourceClass === 'infinite',
    );
    expect(infinite).toHaveLength(1);
    expect(infinite[0]).toEqual(createCenterInfinityPlacement(map.width, map.height));
    expect(infinite[0].footprint).toBe(CENTER_INFINITY_FOOTPRINT);
    expect(isExactCenterInfinity(infinite[0], map.width, map.height)).toBe(true);
  });

  it.each(SIZES)('keeps the protected center zone free of finite resources and Headquarters on %s maps', size => {
    const map = createGeneratedMapData(`center-protection-${size}`, size, 'purple');
    const protectedTiles = tileKeys(getCenterProtectedTiles(map.width, map.height));
    const infinity = createCenterInfinityPlacement(map.width, map.height);

    for (const resource of map.resources) {
      if (isExactCenterInfinity(resource, map.width, map.height)) continue;
      for (let dy = 0; dy < resource.footprint; dy++) {
        for (let dx = 0; dx < resource.footprint; dx++) {
          expect(protectedTiles.has(`${resource.tx + dx},${resource.ty + dy}`)).toBe(false);
        }
      }
    }
    for (const hq of map.headquarters!) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          expect(protectedTiles.has(`${hq.tx + dx},${hq.ty + dy}`)).toBe(false);
        }
      }
    }
    expect(protectedTiles.has(`${infinity.tx},${infinity.ty}`)).toBe(true);
  });

  it.each(SIZES)('provides four two-tile passable approach sectors on %s maps', size => {
    const map = createGeneratedMapData(`center-approaches-${size}`, size, 'green');
    const state = createInitialState(map, 'green');
    const occupancy = buildOccupancyMap(state);
    const sectors = getCenterApproachSectors(map.width, map.height);
    expect(sectors.map(sector => sector.direction)).toEqual(['north', 'east', 'south', 'west']);
    for (const sector of sectors) {
      expect(sector.tiles).toHaveLength(2);
      for (const tile of sector.tiles) {
        expect(isPassable(occupancy, tile.tx, tile.ty), `${sector.direction} approach`).toBe(true);
        expect(getFlags(occupancy, tile.tx, tile.ty).has('unbuildable')).toBe(true);
      }
    }
  });

  it('marks the whole protected zone unbuildable but only the Infinity footprint impassable', () => {
    const map = createGeneratedMapData('center-occupancy-flags', 'standard', 'cyan');
    const state = createInitialState(map, 'cyan');
    const occupancy = buildOccupancyMap(state);
    const infinity = createCenterInfinityPlacement(map.width, map.height);
    const protectedTiles = getCenterProtectedTiles(map.width, map.height);

    expect(protectedTiles).toHaveLength(
      (CENTER_INFINITY_FOOTPRINT + CENTER_PROTECTION_MARGIN * 2) ** 2,
    );
    for (const tile of protectedTiles) {
      expect(getFlags(occupancy, tile.tx, tile.ty).has('unbuildable')).toBe(true);
    }
    expect(getFlags(occupancy, infinity.tx, infinity.ty).has('impassable')).toBe(true);
    expect(isBuildable(
      occupancy,
      infinity.tx - CENTER_PROTECTION_MARGIN,
      infinity.ty - CENTER_PROTECTION_MARGIN,
      1,
      1,
    )).toBe(false);
  });

  it.each(SIZES)('passes the structural center validator on generated %s maps', size => {
    const map = createGeneratedMapData(`center-validator-${size}`, size, 'yellow');
    expect(validateCenterInfinityContract(map)).toEqual([]);
  });

  it('reports displaced Infinity, finite center intrusion and blocked approach sectors', () => {
    const displaced = createGeneratedMapData('displaced-center-contract', 'standard', 'cyan');
    const infinity = displaced.resources.find(resource => resource.type === 'infinite')!;
    infinity.tx += 1;
    expect(validateCenterInfinityContract(displaced)).toContain(
      'Infinity deposit is not the exact canonical centered 2x2 placement',
    );

    const intruded = createGeneratedMapData('finite-center-contract', 'standard', 'cyan');
    const center = createCenterInfinityPlacement(intruded.width, intruded.height);
    intruded.resources.push({
      tx: center.tx - 1,
      ty: center.ty,
      type: 'small',
      footprint: 1,
      resourceClass: 'very_poor',
    });
    expect(validateCenterInfinityContract(intruded)).toContain(
      'Finite resource intersects the protected center zone',
    );
    expect(validateCenterInfinityContract(intruded)).toContain(
      'Center west approach sector is blocked',
    );
  });

  it('is independent of the selected human faction', () => {
    const expected = createGeneratedMapData('center-faction-independent', 'large', 'cyan')
      .resources.find(resource => resource.type === 'infinite');
    for (const faction of ['green', 'yellow', 'purple'] as const) {
      expect(createGeneratedMapData('center-faction-independent', 'large', faction)
        .resources.find(resource => resource.type === 'infinite')).toEqual(expected);
    }
  });
});
