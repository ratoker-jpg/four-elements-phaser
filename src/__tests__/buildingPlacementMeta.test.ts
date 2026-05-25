import { describe, it, expect } from 'vitest';
import {
  buildMetaRegistryKey,
  getBuildingPlacementMeta,
  hasBuildingPlacementMeta,
  registerBuildingPlacementMeta,
} from '../assets/buildingPlacementMeta';
import type { BuildingPlacementMeta } from '../assets/buildingPlacementMeta';

/**
 * Helper to create a valid BuildingPlacementMeta object for testing.
 * Uses reasonable defaults; callers override what they need.
 */
function makeTestMeta(
  overrides: Partial<BuildingPlacementMeta> = {},
): BuildingPlacementMeta {
  return {
    buildingType: 'separator',
    faction: 'cyan',
    assetKey: 'building_cyan_separator',
    sourceWidth: 200,
    sourceHeight: 300,
    alphaBounds: { left: 10, top: 5, right: 190, bottom: 290 },
    visibleWidth: 180,
    visibleHeight: 285,
    footprintW: 2,
    footprintH: 2,
    anchorMode: 'south-vertex',
    category: 'structure',
    groundLineRatio: 0.92,
    originX: 0.5,
    originY: 0.92,
    targetDisplayWidth: 120,
    computedScale: 0.6,
    ...overrides,
  };
}

// ─── buildMetaRegistryKey ────────────────────────────────────────────

describe('buildMetaRegistryKey', () => {
  it('combines faction and building type with underscore', () => {
    expect(buildMetaRegistryKey('cyan', 'separator')).toBe('cyan_separator');
  });

  it('handles hyphenated building types', () => {
    expect(buildMetaRegistryKey('green', 'raw-storage')).toBe('green_raw-storage');
  });

  it('handles all four factions', () => {
    expect(buildMetaRegistryKey('cyan', 'separator')).toBe('cyan_separator');
    expect(buildMetaRegistryKey('green', 'separator')).toBe('green_separator');
    expect(buildMetaRegistryKey('yellow', 'separator')).toBe('yellow_separator');
    expect(buildMetaRegistryKey('purple', 'separator')).toBe('purple_separator');
  });
});

// ─── hasBuildingPlacementMeta / getBuildingPlacementMeta ─────────────

describe('hasBuildingPlacementMeta', () => {
  it('returns false when registry is empty', () => {
    expect(hasBuildingPlacementMeta('cyan', 'separator')).toBe(false);
  });
});

describe('getBuildingPlacementMeta', () => {
  it('returns undefined when no entry exists', () => {
    expect(getBuildingPlacementMeta('cyan', 'separator')).toBeUndefined();
  });
});

// ─── registerBuildingPlacementMeta ───────────────────────────────────

describe('registerBuildingPlacementMeta', () => {
  it('registers and retrieves a metadata entry', () => {
    const meta = makeTestMeta();
    registerBuildingPlacementMeta(meta);

    expect(hasBuildingPlacementMeta('cyan', 'separator')).toBe(true);
    const retrieved = getBuildingPlacementMeta('cyan', 'separator');
    expect(retrieved).toBeDefined();
    expect(retrieved!.assetKey).toBe('building_cyan_separator');
    expect(retrieved!.groundLineRatio).toBe(0.92);
  });

  it('overwrites existing entry (last-write-wins)', () => {
    const meta1 = makeTestMeta({ targetDisplayWidth: 100 });
    const meta2 = makeTestMeta({ targetDisplayWidth: 150 });
    registerBuildingPlacementMeta(meta1);
    registerBuildingPlacementMeta(meta2);

    const retrieved = getBuildingPlacementMeta('cyan', 'separator');
    expect(retrieved!.targetDisplayWidth).toBe(150);
  });

  it('stores different entries for different factions', () => {
    const cyanMeta = makeTestMeta({ faction: 'cyan', assetKey: 'building_cyan_separator' });
    const greenMeta = makeTestMeta({ faction: 'green', assetKey: 'building_green_separator' });
    registerBuildingPlacementMeta(cyanMeta);
    registerBuildingPlacementMeta(greenMeta);

    expect(hasBuildingPlacementMeta('cyan', 'separator')).toBe(true);
    expect(hasBuildingPlacementMeta('green', 'separator')).toBe(true);
    expect(getBuildingPlacementMeta('cyan', 'separator')!.assetKey).toBe('building_cyan_separator');
    expect(getBuildingPlacementMeta('green', 'separator')!.assetKey).toBe('building_green_separator');
  });

  it('stores different entries for different building types', () => {
    const separatorMeta = makeTestMeta({
      buildingType: 'separator',
      assetKey: 'building_cyan_separator',
    });
    const storageMeta = makeTestMeta({
      buildingType: 'raw-storage',
      assetKey: 'building_cyan_raw_storage',
      footprintW: 2,
      footprintH: 2,
    });
    registerBuildingPlacementMeta(separatorMeta);
    registerBuildingPlacementMeta(storageMeta);

    expect(hasBuildingPlacementMeta('cyan', 'separator')).toBe(true);
    expect(hasBuildingPlacementMeta('cyan', 'raw-storage')).toBe(true);
  });
});
