import { describe, it, expect } from 'vitest';
import {
  buildMetaRegistryKey,
  getBuildingPlacementMeta,
  hasBuildingPlacementMeta,
  registerBuildingPlacementMeta,
  computeVisibleWidth,
  computeVisibleHeight,
  computeOriginX,
  computeOriginY,
  computeTargetDisplayWidth,
  computeScale,
  detectCategory,
} from '../assets/buildingPlacementMeta';
import type { BuildingPlacementMeta, AlphaBounds } from '../assets/buildingPlacementMeta';
import { GENERATED_BUILDING_META } from '../assets/generatedBuildingMeta';

/**
 * Helper to create a valid AlphaBounds object for testing.
 */
function makeTestAlphaBounds(
  overrides: Partial<AlphaBounds> = {},
): AlphaBounds {
  return {
    left: 10,
    top: 5,
    right: 190,
    bottom: 290,
    ...overrides,
  };
}

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
  it('returns true when generated metadata is loaded', () => {
    // After BUILD-ANCHOR-02, the registry is populated from generated data
    expect(hasBuildingPlacementMeta('cyan', 'separator')).toBe(true);
  });

  it('returns false for unregistered combos', () => {
    // These shouldn't exist since we only have 6 building types
    expect(hasBuildingPlacementMeta('cyan', 'nonexistent' as any)).toBe(false);
  });
});

describe('getBuildingPlacementMeta', () => {
  it('returns metadata for cyan separator', () => {
    const meta = getBuildingPlacementMeta('cyan', 'separator');
    expect(meta).toBeDefined();
    expect(meta!.assetKey).toBe('building_cyan_separator');
    expect(meta!.buildingType).toBe('separator');
    expect(meta!.faction).toBe('cyan');
  });

  it('returns metadata for all factions', () => {
    for (const faction of ['cyan', 'green', 'yellow', 'purple'] as const) {
      const meta = getBuildingPlacementMeta(faction, 'separator');
      expect(meta).toBeDefined();
      expect(meta!.faction).toBe(faction);
    }
  });

  it('returns different entries for different building types', () => {
    const sep = getBuildingPlacementMeta('cyan', 'separator');
    const storage = getBuildingPlacementMeta('cyan', 'raw-storage');
    expect(sep).toBeDefined();
    expect(storage).toBeDefined();
    expect(sep!.assetKey).not.toBe(storage!.assetKey);
  });
});

// ─── registerBuildingPlacementMeta ───────────────────────────────────

describe('registerBuildingPlacementMeta', () => {
  // Use test-only building types that do NOT collide with real generated
  // metadata entries. The registry is module-level (singleton), so writing
  // to a real key like ('cyan','separator') would overwrite committed data
  // and break other tests or make them order-dependent.
  const TEST_TYPE_A = '__test_type_a' as any;
  const TEST_TYPE_B = '__test_type_b' as any;

  it('registers and retrieves a metadata entry', () => {
    const meta = makeTestMeta({
      buildingType: TEST_TYPE_A,
      assetKey: 'test_building_cyan___test_type_a',
    });
    registerBuildingPlacementMeta(meta);

    const retrieved = getBuildingPlacementMeta('cyan', TEST_TYPE_A);
    expect(retrieved).toBeDefined();
    expect(retrieved!.assetKey).toBe('test_building_cyan___test_type_a');
  });

  it('overwrites existing entry (last-write-wins)', () => {
    const meta1 = makeTestMeta({
      buildingType: TEST_TYPE_B,
      targetDisplayWidth: 100,
      assetKey: 'test_first',
    });
    const meta2 = makeTestMeta({
      buildingType: TEST_TYPE_B,
      targetDisplayWidth: 150,
      assetKey: 'test_second',
    });
    registerBuildingPlacementMeta(meta1);
    registerBuildingPlacementMeta(meta2);

    const retrieved = getBuildingPlacementMeta('cyan', TEST_TYPE_B);
    expect(retrieved!.targetDisplayWidth).toBe(150);
    expect(retrieved!.assetKey).toBe('test_second');
  });

  it('stores different entries for different factions', () => {
    const cyanMeta = makeTestMeta({
      faction: 'cyan',
      buildingType: TEST_TYPE_A,
      assetKey: 'test_building_cyan___test_type_a',
    });
    const greenMeta = makeTestMeta({
      faction: 'green',
      buildingType: TEST_TYPE_A,
      assetKey: 'test_building_green___test_type_a',
    });
    registerBuildingPlacementMeta(cyanMeta);
    registerBuildingPlacementMeta(greenMeta);

    expect(hasBuildingPlacementMeta('cyan', TEST_TYPE_A)).toBe(true);
    expect(hasBuildingPlacementMeta('green', TEST_TYPE_A)).toBe(true);
    expect(getBuildingPlacementMeta('cyan', TEST_TYPE_A)!.assetKey).toBe('test_building_cyan___test_type_a');
    expect(getBuildingPlacementMeta('green', TEST_TYPE_A)!.assetKey).toBe('test_building_green___test_type_a');
  });

  it('stores different entries for different building types', () => {
    const metaA = makeTestMeta({
      buildingType: TEST_TYPE_A,
      assetKey: 'test_cyan_A',
    });
    const metaB = makeTestMeta({
      buildingType: TEST_TYPE_B,
      assetKey: 'test_cyan_B',
    });
    registerBuildingPlacementMeta(metaA);
    registerBuildingPlacementMeta(metaB);

    expect(hasBuildingPlacementMeta('cyan', TEST_TYPE_A)).toBe(true);
    expect(hasBuildingPlacementMeta('cyan', TEST_TYPE_B)).toBe(true);
  });

  it('does not overwrite real generated metadata', () => {
    // Verify real generated entry is intact before and after test registration
    const before = getBuildingPlacementMeta('cyan', 'separator');
    expect(before).toBeDefined();
    expect(before!.assetKey).toBe('building_cyan_separator');

    // Register a test-only entry (different key — must not affect real data)
    const testMeta = makeTestMeta({
      buildingType: TEST_TYPE_A,
      assetKey: 'test_only_entry',
    });
    registerBuildingPlacementMeta(testMeta);

    // Real entry is unchanged
    const after = getBuildingPlacementMeta('cyan', 'separator');
    expect(after!.assetKey).toBe('building_cyan_separator');
  });
});

// ─── computeVisibleWidth ─────────────────────────────────────────────

describe('computeVisibleWidth', () => {
  it('computes right minus left', () => {
    const ab = makeTestAlphaBounds({ left: 10, right: 190 });
    expect(computeVisibleWidth(ab)).toBe(180);
  });

  it('handles zero-width bounds', () => {
    const ab = makeTestAlphaBounds({ left: 50, right: 50 });
    expect(computeVisibleWidth(ab)).toBe(0);
  });
});

// ─── computeVisibleHeight ────────────────────────────────────────────

describe('computeVisibleHeight', () => {
  it('computes bottom minus top', () => {
    const ab = makeTestAlphaBounds({ top: 5, bottom: 290 });
    expect(computeVisibleHeight(ab)).toBe(285);
  });

  it('handles zero-height bounds', () => {
    const ab = makeTestAlphaBounds({ top: 50, bottom: 50 });
    expect(computeVisibleHeight(ab)).toBe(0);
  });
});

// ─── computeOriginX ──────────────────────────────────────────────────

describe('computeOriginX', () => {
  it('computes origin at visible horizontal center', () => {
    const ab = makeTestAlphaBounds({ left: 10, right: 190 });
    const sourceWidth = 200;
    // visible center = (10 + 190) / 2 = 100; originX = 100 / 200 = 0.5
    expect(computeOriginX(ab, sourceWidth)).toBe(0.5);
  });

  it('computes offset origin when content is not centered', () => {
    const ab = makeTestAlphaBounds({ left: 0, right: 100 });
    const sourceWidth = 200;
    // visible center = 50; originX = 50 / 200 = 0.25
    expect(computeOriginX(ab, sourceWidth)).toBe(0.25);
  });

  it('computes origin for content shifted right', () => {
    const ab = makeTestAlphaBounds({ left: 100, right: 200 });
    const sourceWidth = 200;
    // visible center = 150; originX = 150 / 200 = 0.75
    expect(computeOriginX(ab, sourceWidth)).toBe(0.75);
  });
});

// ─── computeOriginY ──────────────────────────────────────────────────

describe('computeOriginY', () => {
  it('returns groundLineRatio directly', () => {
    expect(computeOriginY(0.75)).toBe(0.75);
    expect(computeOriginY(0.5)).toBe(0.5);
    expect(computeOriginY(1.0)).toBe(1.0);
  });

  it('returns alpha-bottom ratio for isometric buildings', () => {
    // BUILD-ANCHOR-03 fixup: originY = groundLineRatio = alphaBounds.bottom / sourceHeight
    // For a building with alphaBounds.bottom=757 and sourceHeight=760:
    const originY = computeOriginY(757 / 760);
    expect(originY).toBeCloseTo(0.9961, 3);
  });
});

// ─── computeTargetDisplayWidth ───────────────────────────────────────

describe('computeTargetDisplayWidth', () => {
  it('returns 65 for 1x1 footprint', () => {
    expect(computeTargetDisplayWidth(1, 1)).toBe(65);
  });

  it('returns 128 for 2x2 footprint', () => {
    expect(computeTargetDisplayWidth(2, 2)).toBe(128);
  });

  it('returns 200 for 3x3 footprint', () => {
    expect(computeTargetDisplayWidth(3, 3)).toBe(200);
  });

  it('uses larger dimension for non-square footprints (2x3 => 200)', () => {
    expect(computeTargetDisplayWidth(2, 3)).toBe(200);
    expect(computeTargetDisplayWidth(3, 2)).toBe(200);
  });

  it('uses larger dimension for non-square footprints (1x2 => 128)', () => {
    expect(computeTargetDisplayWidth(1, 2)).toBe(128);
    expect(computeTargetDisplayWidth(2, 1)).toBe(128);
  });

  it('extrapolates for footprints larger than 3x3', () => {
    // 4x4: baseWidth=200, extraTiles=1, 200 + 72 = 272
    expect(computeTargetDisplayWidth(4, 4)).toBe(272);
    // 5x5: baseWidth=200, extraTiles=2, 200 + 144 = 344
    expect(computeTargetDisplayWidth(5, 5)).toBe(344);
  });
});

// ─── computeScale ────────────────────────────────────────────────────

describe('computeScale', () => {
  it('computes targetDisplayWidth / sourceWidth', () => {
    expect(computeScale(128, 1008)).toBeCloseTo(0.12698, 4);
  });

  it('returns 1 for matching widths', () => {
    expect(computeScale(200, 200)).toBe(1);
  });

  it('returns > 1 if target is larger than source', () => {
    expect(computeScale(400, 200)).toBe(2);
  });
});

// ─── detectCategory ──────────────────────────────────────────────────

describe('detectCategory', () => {
  it('returns structure for balanced proportions', () => {
    expect(detectCategory(200, 200)).toBe('structure');
    expect(detectCategory(200, 280)).toBe('structure');
  });

  it('returns tower for tall/narrow content', () => {
    expect(detectCategory(100, 200)).toBe('tower');
    expect(detectCategory(50, 100)).toBe('tower');
  });

  it('returns flat for wide/short content', () => {
    expect(detectCategory(200, 100)).toBe('flat');
    expect(detectCategory(300, 100)).toBe('flat');
  });

  it('returns structure for zero width', () => {
    expect(detectCategory(0, 100)).toBe('structure');
  });
});

// ─── Generated data integrity ────────────────────────────────────────

describe('GENERATED_BUILDING_META', () => {
  it('has 24 entries (6 types × 4 factions)', () => {
    expect(GENERATED_BUILDING_META).toHaveLength(24);
  });

  it('has all expected building types for each faction', () => {
    const expectedTypes = [
      'separator',
      'raw-storage',
      'matter-storage',
      'power-plant',
      'command-relay',
      'units-factory',
    ];

    for (const faction of ['cyan', 'green', 'yellow', 'purple'] as const) {
      for (const buildingType of expectedTypes) {
        const entry = GENERATED_BUILDING_META.find(
          (m) => m.faction === faction && m.buildingType === buildingType,
        );
        expect(entry).toBeDefined();
        expect(entry!.assetKey).toContain(faction);
      }
    }
  });

  it('has consistent visible dimensions matching alpha bounds', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.visibleWidth).toBe(computeVisibleWidth(meta.alphaBounds));
      expect(meta.visibleHeight).toBe(computeVisibleHeight(meta.alphaBounds));
    }
  });

  it('has positive source dimensions for all entries', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.sourceWidth).toBeGreaterThan(0);
      expect(meta.sourceHeight).toBeGreaterThan(0);
    }
  });

  it('has valid alpha bounds within source dimensions', () => {
    for (const meta of GENERATED_BUILDING_META) {
      const ab = meta.alphaBounds;
      expect(ab.left).toBeGreaterThanOrEqual(0);
      expect(ab.top).toBeGreaterThanOrEqual(0);
      expect(ab.right).toBeLessThanOrEqual(meta.sourceWidth);
      expect(ab.bottom).toBeLessThanOrEqual(meta.sourceHeight);
      expect(ab.right).toBeGreaterThan(ab.left);
      expect(ab.bottom).toBeGreaterThan(ab.top);
    }
  });

  it('has groundLineRatio between 0 and 1', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.groundLineRatio).toBeGreaterThan(0);
      expect(meta.groundLineRatio).toBeLessThanOrEqual(1);
    }
  });

  it('has groundLineRatio derived from alpha-bottom (not widest-row)', () => {
    // BUILD-ANCHOR-03 fixup: groundLineRatio = alphaBounds.bottom / sourceHeight
    // The widest-row heuristic was wrong for isometric buildings.
    // With alpha-bottom, groundLineRatio should be close to 1.0
    // (typically > 0.99 because the building base extends near the bottom).
    for (const meta of GENERATED_BUILDING_META) {
      const expectedRatio = meta.alphaBounds.bottom / meta.sourceHeight;
      expect(meta.groundLineRatio).toBeCloseTo(expectedRatio, 4);
      // Sanity: isometric building bases should be near the image bottom
      expect(meta.groundLineRatio).toBeGreaterThan(0.95);
    }
  });

  it('has originY equal to groundLineRatio', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.originY).toBe(meta.groundLineRatio);
    }
  });

  it('has positive computedScale for all entries', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.computedScale).toBeGreaterThan(0);
    }
  });

  it('uses south-vertex anchor mode for all entries', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.anchorMode).toBe('south-vertex');
    }
  });

  it('has no exception offsets by default', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.exceptionOffsetX).toBeUndefined();
      expect(meta.exceptionOffsetY).toBeUndefined();
    }
  });

  it('has consistent targetDisplayWidth across same footprint buildings', () => {
    // All current buildings have 2x2 footprint, so targetDisplayWidth should be 128
    const widths = new Set(GENERATED_BUILDING_META.map((m) => m.targetDisplayWidth));
    expect(widths.size).toBe(1);
    expect([...widths][0]).toBe(128);
  });

  it('has targetDisplayWidth derived from footprint-size mapping', () => {
    // BUILD-ANCHOR-03 scale fixup: explicit footprint-to-width mapping
    // All current buildings are 2x2 => 128px
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.targetDisplayWidth).toBe(
        computeTargetDisplayWidth(meta.footprintW, meta.footprintH),
      );
    }
  });

  it('has computedScale = targetDisplayWidth / sourceWidth', () => {
    for (const meta of GENERATED_BUILDING_META) {
      expect(meta.computedScale).toBeCloseTo(
        meta.targetDisplayWidth / meta.sourceWidth, 4,
      );
    }
  });
});
