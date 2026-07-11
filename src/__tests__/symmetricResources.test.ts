import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { mirrorPlacement } from '../state/mapSymmetry';
import {
  getFiniteResourceValueByQuadrant,
  getResourceQuadrant,
} from '../state/symmetricResources';
import type { Faction, ResourcePlacement } from '../state/types';
import type { MapSizeOption } from '../state/generatedMapTypes';

const FACTIONS: Faction[] = ['cyan', 'green', 'yellow', 'purple'];

function finiteResources(resources: readonly ResourcePlacement[]): ResourcePlacement[] {
  return resources.filter(resource =>
    resource.resourceClass !== 'infinite' && resource.type !== 'infinite',
  );
}

function classCountsByQuadrant(
  resources: readonly ResourcePlacement[],
  width: number,
  height: number,
): Record<Faction, Record<string, number>> {
  const result = Object.fromEntries(FACTIONS.map(faction => [faction, {}])) as Record<
    Faction,
    Record<string, number>
  >;
  for (const resource of finiteResources(resources)) {
    const quadrant = getResourceQuadrant(resource, width, height);
    expect(quadrant).not.toBeNull();
    const key = resource.resourceClass ?? resource.type;
    result[quadrant!][key] = (result[quadrant!][key] ?? 0) + 1;
  }
  return result;
}

function expectNoResourceOverlap(resources: readonly ResourcePlacement[]): void {
  const occupied = new Set<string>();
  for (const resource of resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        const key = `${resource.tx + dx},${resource.ty + dy}`;
        expect(occupied.has(key), `resource overlap at ${key}`).toBe(false);
        occupied.add(key);
      }
    }
  }
}

describe('SKIRMISH-P5B symmetric finite resources', () => {
  it.each(['small', 'standard', 'large'] as MapSizeOption[])(
    'creates complete mirrored finite quartets on %s maps',
    size => {
      const map = createGeneratedMapData(`symmetric-quartets-${size}`, size, 'cyan');
      const finite = finiteResources(map.resources);
      expect(finite.length).toBeGreaterThan(0);
      expect(finite.length % 4).toBe(0);

      for (let index = 0; index < finite.length; index += 4) {
        const [cyan, green, yellow, purple] = finite.slice(index, index + 4);
        expect(green).toEqual(expect.objectContaining({
          ...cyan,
          ...mirrorPlacement(cyan, map.width, map.height, 'horizontal'),
        }));
        expect(yellow).toEqual(expect.objectContaining({
          ...cyan,
          ...mirrorPlacement(cyan, map.width, map.height, 'rotational'),
        }));
        expect(purple).toEqual(expect.objectContaining({
          ...cyan,
          ...mirrorPlacement(cyan, map.width, map.height, 'vertical'),
        }));
        expect(new Set([cyan.resourceClass, green.resourceClass, yellow.resourceClass, purple.resourceClass]).size).toBe(1);
        expect(new Set([cyan.footprint, green.footprint, yellow.footprint, purple.footprint]).size).toBe(1);
      }
    },
  );

  it.each(['small', 'standard', 'large'] as MapSizeOption[])(
    'has identical finite class counts and deterministic raw value in every %s quadrant',
    size => {
      const map = createGeneratedMapData(`symmetric-value-${size}`, size, 'green');
      const counts = classCountsByQuadrant(map.resources, map.width, map.height);
      expect(counts.green).toEqual(counts.cyan);
      expect(counts.yellow).toEqual(counts.cyan);
      expect(counts.purple).toEqual(counts.cyan);

      const values = getFiniteResourceValueByQuadrant(map.resources, map.width, map.height);
      expect(values.cyan).toBeGreaterThan(0);
      expect(values.green).toBe(values.cyan);
      expect(values.yellow).toBe(values.cyan);
      expect(values.purple).toBe(values.cyan);
    },
  );

  it('uses the same structural resource map regardless of selected human faction', () => {
    const baseline = createGeneratedMapData('faction-independent-resources', 'standard', 'cyan').resources;
    for (const faction of FACTIONS.slice(1)) {
      expect(createGeneratedMapData('faction-independent-resources', 'standard', faction).resources)
        .toEqual(baseline);
    }
  });

  it('keeps exactly one shared Infinity deposit and no resource overlaps', () => {
    const map = createGeneratedMapData('one-infinity-after-mirroring', 'standard', 'purple');
    expect(map.resources.filter(resource => resource.type === 'infinite')).toHaveLength(1);
    expectNoResourceOverlap(map.resources);
  });

  it('does not overlap any Headquarters footprint', () => {
    const map = createGeneratedMapData('resource-hq-separation', 'large', 'yellow');
    const hqTiles = new Set<string>();
    for (const hq of map.headquarters!) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) hqTiles.add(`${hq.tx + dx},${hq.ty + dy}`);
      }
    }
    for (const resource of map.resources) {
      for (let dy = 0; dy < resource.footprint; dy++) {
        for (let dx = 0; dx < resource.footprint; dx++) {
          expect(hqTiles.has(`${resource.tx + dx},${resource.ty + dy}`)).toBe(false);
        }
      }
    }
  });

  it('is byte-structurally deterministic for the same seed and size', () => {
    const first = createGeneratedMapData('symmetric-resource-determinism', 'large', 'cyan');
    const second = createGeneratedMapData('symmetric-resource-determinism', 'large', 'cyan');
    expect(JSON.stringify(first.resources)).toBe(JSON.stringify(second.resources));
  });
});
