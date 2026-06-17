import { describe, it, expect, vi } from 'vitest';
import {
  GENERATED_ASSET_MANIFEST,
} from '../assets/generatedAssetManifest';
// FIXUP-5: generatedHullAssets imports removed — loadArenaVisualAssets
// is now a no-op, no hull keys to check.

// We test the loader helper without importing Phaser by mocking the scene.
// runtimeGeneratedAssets uses scene.load.image()/spritesheet() which are Phaser APIs.
// We create a lightweight mock that records calls.

interface MockLoadImageCall {
  key: string;
  path: string;
}

interface MockLoadSpritesheetCall {
  key: string;
  path: string;
  frameConfig: { frameWidth: number; frameHeight: number };
}

function createMockScene() {
  const loadImageCalls: MockLoadImageCall[] = [];
  const loadSpritesheetCalls: MockLoadSpritesheetCall[] = [];
  const warnings: string[] = [];

  // Suppress console.warn in tests by capturing it
  const originalWarn = console.warn;
  const mockWarn = vi.fn((...args: unknown[]) => {
    warnings.push(args.join(' '));
  });
  console.warn = mockWarn;

  const originalError = console.error;
  const mockError = vi.fn();
  console.error = mockError;

  const scene = {
    load: {
      image(key: string, path: string) {
        loadImageCalls.push({ key, path });
      },
      spritesheet(key: string, path: string, frameConfig: { frameWidth: number; frameHeight: number }) {
        loadSpritesheetCalls.push({ key, path, frameConfig });
      },
    },
    textures: {
      exists: (_key: string) => false,
    },
  };

  return {
    scene,
    loadImageCalls,
    loadSpritesheetCalls,
    warnings,
    mockWarn,
    mockError,
    restore() {
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

// ─── GENERATED_ASSET_MANIFEST structure ─────────────────────────────

describe('GENERATED_ASSET_MANIFEST', () => {
  it('has version 1', () => {
    expect(GENERATED_ASSET_MANIFEST.version).toBe(1);
  });

  it('has deterministic generatedAt timestamp', () => {
    expect(GENERATED_ASSET_MANIFEST.generatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('has hq, buildings, civilUnits, modularUnits, terrain, resources, and industrialFrame families', () => {
    expect(GENERATED_ASSET_MANIFEST.families.hq).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.buildings).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.modularUnits).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.terrain).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.resources).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.industrialFrame).toBeDefined();
  });

  it('has 126 total paths (4 HQ + 24 buildings + 8 civilUnits + 64 modularUnits + 6 terrain + 8 industrialTerrain + 3 resources + 6 industrialResources + 3 industrialFrame)', () => {
    const keys = Object.keys(GENERATED_ASSET_MANIFEST.paths);
    expect(keys).toHaveLength(126);
  });

  it('has 4 HQ keys', () => {
    expect(GENERATED_ASSET_MANIFEST.families.hq.keys).toHaveLength(4);
  });

  it('has 24 building keys', () => {
    expect(GENERATED_ASSET_MANIFEST.families.buildings.keys).toHaveLength(24);
  });

  it('has 8 civilUnits keys', () => {
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.keys).toHaveLength(8);
  });

  it('has 64 modularUnits keys', () => {
    expect(GENERATED_ASSET_MANIFEST.families.modularUnits.keys).toHaveLength(64);
  });

  it('has 6 terrain keys', () => {
    expect(GENERATED_ASSET_MANIFEST.families.terrain.keys).toHaveLength(6);
  });

  it('has 3 resources keys', () => {
    expect(GENERATED_ASSET_MANIFEST.families.resources.keys).toHaveLength(3);
  });

  it('has all 4 HQ faction keys', () => {
    const hqKeys = GENERATED_ASSET_MANIFEST.families.hq.keys;
    expect(hqKeys).toContain('hq_cyan');
    expect(hqKeys).toContain('hq_green');
    expect(hqKeys).toContain('hq_yellow');
    expect(hqKeys).toContain('hq_purple');
  });

  it('has harvester_cyan key matching ASSET_KEYS.HARVESTER_CYAN value', () => {
    // The generated manifest should produce the same key that the old
    // manual ASSET_KEYS.HARVESTER_CYAN used: 'harvester_cyan'
    expect(GENERATED_ASSET_MANIFEST.paths).toHaveProperty('harvester_cyan');
  });

  it('hq family has loadType image and enabled true', () => {
    expect(GENERATED_ASSET_MANIFEST.families.hq.loadType).toBe('image');
    expect(GENERATED_ASSET_MANIFEST.families.hq.enabled).toBe(true);
  });

  it('buildings family has loadType image and enabled true', () => {
    expect(GENERATED_ASSET_MANIFEST.families.buildings.loadType).toBe('image');
    expect(GENERATED_ASSET_MANIFEST.families.buildings.enabled).toBe(true);
  });

  it('civilUnits family has loadType spritesheet, frameConfig, and enabled true', () => {
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.loadType).toBe('spritesheet');
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.enabled).toBe(true);
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.frameConfig).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.frameConfig?.frameWidth).toBe(256);
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.frameConfig?.frameHeight).toBe(256);
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits.frameConfig?.endFrame).toBe(63);
  });

  it('modularUnits family has loadType image and is disabled (legacy PNGs removed)', () => {
    expect(GENERATED_ASSET_MANIFEST.families.modularUnits.loadType).toBe('image');
    expect(GENERATED_ASSET_MANIFEST.families.modularUnits.enabled).toBe(false);
  });

  it('terrain family has loadType image and enabled true', () => {
    expect(GENERATED_ASSET_MANIFEST.families.terrain.loadType).toBe('image');
    expect(GENERATED_ASSET_MANIFEST.families.terrain.enabled).toBe(true);
  });

  it('resources family has loadType image and enabled true', () => {
    expect(GENERATED_ASSET_MANIFEST.families.resources.loadType).toBe('image');
    expect(GENERATED_ASSET_MANIFEST.families.resources.enabled).toBe(true);
  });

  it('terrain keys match TERRAIN-02A 256×128 asset keys', () => {
    const terrainKeys = GENERATED_ASSET_MANIFEST.families.terrain.keys;
    // TERRAIN-02A: 6-variant 256×128 sand tile family
    expect(terrainKeys).toContain('terrain_sand_clean_256x128');
    expect(terrainKeys).toContain('terrain_sand_dark_256x128');
    expect(terrainKeys).toContain('terrain_sand_light_256x128');
    expect(terrainKeys).toContain('terrain_sand_ripple_256x128');
    expect(terrainKeys).toContain('terrain_sand_pebble_256x128');
    expect(terrainKeys).toContain('terrain_sand_cracked_256x128');
  });

  it('resources keys match legacy ASSET_KEYS values', () => {
    const resourceKeys = GENERATED_ASSET_MANIFEST.families.resources.keys;
    expect(resourceKeys).toContain('mineral_small');
    expect(resourceKeys).toContain('mineral_medium');
    expect(resourceKeys).toContain('mineral_large');
  });

  it('modularUnits keys match legacy getWaspHullKey/getSmokyTurretKey outputs', () => {
    const muKeys = GENERATED_ASSET_MANIFEST.families.modularUnits.keys;
    expect(muKeys).toContain('wasp_m0_hull_cyan_dir0');
    expect(muKeys).toContain('wasp_m0_hull_purple_dir7');
    expect(muKeys).toContain('smoky_m0_turret_cyan_dir0');
    expect(muKeys).toContain('smoky_m0_turret_purple_dir7');
  });

  it('terrain and resource paths match TERRAIN-02A 256×128 paths', () => {
    // TERRAIN-02A: 6-variant 256×128 sand tile family
    expect(GENERATED_ASSET_MANIFEST.paths['terrain_sand_clean_256x128']).toBe('assets/tiles/terrain_sand_clean_256x128.png');
    expect(GENERATED_ASSET_MANIFEST.paths['terrain_sand_dark_256x128']).toBe('assets/tiles/terrain_sand_dark_256x128.png');
    expect(GENERATED_ASSET_MANIFEST.paths['terrain_sand_light_256x128']).toBe('assets/tiles/terrain_sand_light_256x128.png');
    expect(GENERATED_ASSET_MANIFEST.paths['terrain_sand_ripple_256x128']).toBe('assets/tiles/terrain_sand_ripple_256x128.png');
    expect(GENERATED_ASSET_MANIFEST.paths['terrain_sand_pebble_256x128']).toBe('assets/tiles/terrain_sand_pebble_256x128.png');
    expect(GENERATED_ASSET_MANIFEST.paths['terrain_sand_cracked_256x128']).toBe('assets/tiles/terrain_sand_cracked_256x128.png');
    // Resources unchanged
    expect(GENERATED_ASSET_MANIFEST.paths['mineral_small']).toBe('assets/environment/mineral_small_02.png');
    expect(GENERATED_ASSET_MANIFEST.paths['mineral_medium']).toBe('assets/environment/mineral_medium_02.png');
    expect(GENERATED_ASSET_MANIFEST.paths['mineral_large']).toBe('assets/environment/mineral_large_02.png');
  });

  it('paths match the art/generated/manifest.generated.json keys', () => {
    // Verify the generated TS manifest matches what the processor produces.
    // Key sample checks:
    expect(GENERATED_ASSET_MANIFEST.paths['hq_cyan']).toBe('assets/factions/cyan/buildings/hq_t1.png');
    expect(GENERATED_ASSET_MANIFEST.paths['hq_green']).toBe('assets/factions/green/buildings/hq_t1.png');
    expect(GENERATED_ASSET_MANIFEST.paths['building_cyan_separator']).toBe('assets/factions/cyan/buildings/separator.png');
    expect(GENERATED_ASSET_MANIFEST.paths['building_green_power_plant']).toBe('assets/factions/green/buildings/power_plant.png');
    expect(GENERATED_ASSET_MANIFEST.paths['building_purple_units_factory']).toBe('assets/factions/purple/buildings/units_factory.png');
    expect(GENERATED_ASSET_MANIFEST.paths['builder_cyan']).toBe('assets/factions/cyan/units/builder_8x8_256.png');
    expect(GENERATED_ASSET_MANIFEST.paths['harvester_cyan']).toBe('assets/factions/cyan/units/harvester_8x8_256.png');
    expect(GENERATED_ASSET_MANIFEST.paths['harvester_purple']).toBe('assets/factions/purple/units/harvester_8x8_256.png');
    expect(GENERATED_ASSET_MANIFEST.paths['wasp_m0_hull_cyan_dir0']).toBe('assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir0_0.png');
    expect(GENERATED_ASSET_MANIFEST.paths['smoky_m0_turret_purple_dir7']).toBe('assets/units/weapons/smoky_m0/purple/smoky_m0_turret_idle_dir7_0.png');
  });

  it('has no duplicate keys across families', () => {
    const allKeys = [
      ...GENERATED_ASSET_MANIFEST.families.hq.keys,
      ...GENERATED_ASSET_MANIFEST.families.buildings.keys,
      ...GENERATED_ASSET_MANIFEST.families.civilUnits.keys,
      ...GENERATED_ASSET_MANIFEST.families.modularUnits.keys,
      ...GENERATED_ASSET_MANIFEST.families.terrain.keys,
      ...GENERATED_ASSET_MANIFEST.families.resources.keys,
      ...GENERATED_ASSET_MANIFEST.families.industrialFrame.keys,
    ];
    const uniqueKeys = new Set(allKeys);
    expect(uniqueKeys.size).toBe(allKeys.length);
  });
});

// ─── Loader helper tests ─────────────────────────────────────────────

// We import the loader dynamically to avoid Phaser import issues in vitest.
// Instead, we'll test the loader logic by importing the module with a mock.
describe('loadGeneratedImageAssetFamilies', () => {
  // These tests use dynamic import to get the module after setting up mocks
  async function importLoader() {
    const mod = await import('../assets/runtimeGeneratedAssets');
    return mod;
  }

  it('loads hq + buildings keys exactly once each', async () => {
    const { loadGeneratedBuildingAndHqAssets } = await importLoader();
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedBuildingAndHqAssets(mock.scene as any);

      // 4 HQ + 24 buildings = 28 total
      expect(loadedKeys).toHaveLength(28);
      expect(mock.loadImageCalls).toHaveLength(28);

      // Each key should appear exactly once
      const keyCounts = new Map<string, number>();
      for (const call of mock.loadImageCalls) {
        keyCounts.set(call.key, (keyCounts.get(call.key) ?? 0) + 1);
      }
      for (const [, count] of keyCounts) {
        expect(count).toBe(1);
      }
    } finally {
      mock.restore();
    }
  });

  it('does not load disabled families', async () => {
    const { loadGeneratedImageAssetFamilies } = await importLoader();
    const mock = createMockScene();

    // Temporarily modify the manifest to disable hq
    const originalEnabled = GENERATED_ASSET_MANIFEST.families.hq.enabled;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GENERATED_ASSET_MANIFEST.families.hq as any).enabled = false;

    try {
      const loadedKeys = loadGeneratedImageAssetFamilies(mock.scene as any, ['hq', 'buildings']);

      // Only buildings should load (24), no HQ (4 disabled)
      expect(loadedKeys).toHaveLength(24);
      expect(mock.loadImageCalls).toHaveLength(24);

      // No HQ keys should appear
      const hqKeys = loadedKeys.filter(k => k.startsWith('hq_'));
      expect(hqKeys).toHaveLength(0);
    } finally {
      // Restore original state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (GENERATED_ASSET_MANIFEST.families.hq as any).enabled = originalEnabled;
      mock.restore();
    }
  });

  it('warns and skips non-image loadType families', async () => {
    const { loadGeneratedImageAssetFamilies } = await importLoader();
    const mock = createMockScene();

    // Temporarily change buildings loadType to 'spritesheet'
    const originalLoadType = GENERATED_ASSET_MANIFEST.families.buildings.loadType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GENERATED_ASSET_MANIFEST.families.buildings as any).loadType = 'spritesheet';

    try {
      const loadedKeys = loadGeneratedImageAssetFamilies(mock.scene as any, ['hq', 'buildings']);

      // Only HQ should load (4), buildings skipped due to non-image loadType
      expect(loadedKeys).toHaveLength(4);

      // Should have warned about non-image loadType
      expect(mock.mockWarn).toHaveBeenCalled();
      const warnMessages = mock.mockWarn.mock.calls.map((args: unknown[]) => args.join(' '));
      expect(warnMessages.some(m => m.includes('buildings') && m.includes('loadType'))).toBe(true);
    } finally {
      // Restore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (GENERATED_ASSET_MANIFEST.families.buildings as any).loadType = originalLoadType;
      mock.restore();
    }
  });

  it('returns empty array for empty family list', async () => {
    const { loadGeneratedImageAssetFamilies } = await importLoader();
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedImageAssetFamilies(mock.scene as any, []);
      expect(loadedKeys).toHaveLength(0);
      expect(mock.loadImageCalls).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });
});

// ─── Spritesheet loader tests (ARCH-02G) ──────────────────────────

describe('loadGeneratedSpritesheetAssetFamilies', () => {
  async function importLoader() {
    const mod = await import('../assets/runtimeGeneratedAssets');
    return mod;
  }

  it('loads civilUnits spritesheet keys exactly once each', async () => {
    const { loadGeneratedCivilUnitAssets } = await importLoader();
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedCivilUnitAssets(mock.scene as any);

      // 4 factions × 2 unit types = 8
      expect(loadedKeys).toHaveLength(8);
      expect(mock.loadSpritesheetCalls).toHaveLength(8);

      // Each key should appear exactly once
      const keyCounts = new Map<string, number>();
      for (const call of mock.loadSpritesheetCalls) {
        keyCounts.set(call.key, (keyCounts.get(call.key) ?? 0) + 1);
      }
      for (const [, count] of keyCounts) {
        expect(count).toBe(1);
      }
    } finally {
      mock.restore();
    }
  });

  it('uses frameWidth and frameHeight from frameConfig', async () => {
    const { loadGeneratedCivilUnitAssets } = await importLoader();
    const mock = createMockScene();

    try {
      loadGeneratedCivilUnitAssets(mock.scene as any);

      // All calls should use frameWidth=256 and frameHeight=256
      for (const call of mock.loadSpritesheetCalls) {
        expect(call.frameConfig.frameWidth).toBe(256);
        expect(call.frameConfig.frameHeight).toBe(256);
      }
    } finally {
      mock.restore();
    }
  });

  it('includes harvester_cyan key (previously loaded manually)', async () => {
    const { loadGeneratedCivilUnitAssets } = await importLoader();
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedCivilUnitAssets(mock.scene as any);
      expect(loadedKeys).toContain('harvester_cyan');
    } finally {
      mock.restore();
    }
  });

  it('warns and skips non-spritesheet loadType families', async () => {
    const { loadGeneratedSpritesheetAssetFamilies } = await importLoader();
    const mock = createMockScene();

    try {
      // Pass image families to spritesheet loader — should warn and skip
      const loadedKeys = loadGeneratedSpritesheetAssetFamilies(mock.scene as any, ['hq', 'buildings']);

      expect(loadedKeys).toHaveLength(0);
      expect(mock.loadSpritesheetCalls).toHaveLength(0);

      // Should have warned
      expect(mock.mockWarn).toHaveBeenCalled();
    } finally {
      mock.restore();
    }
  });

  it('returns empty array for empty family list', async () => {
    const { loadGeneratedSpritesheetAssetFamilies } = await importLoader();
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedSpritesheetAssetFamilies(mock.scene as any, []);
      expect(loadedKeys).toHaveLength(0);
      expect(mock.loadSpritesheetCalls).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });
});

// ─── ModularUnits image loader tests (ARCH-02H) ─────────────────────

describe('loadGeneratedModularUnitAssets', () => {
  async function importLoader() {
    const mod = await import('../assets/runtimeGeneratedAssets');
    return mod;
  }

  it('returns empty array because modularUnits family is disabled', async () => {
    const { loadGeneratedModularUnitAssets } = await importLoader();
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedModularUnitAssets(mock.scene as any);

      // Family is disabled — no keys loaded
      expect(loadedKeys).toHaveLength(0);
      expect(mock.loadImageCalls).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });

  it('was a 64-key family before disabling (legacy compatibility)', async () => {
    // Verify the family still has its 64 keys in the manifest, just disabled
    expect(GENERATED_ASSET_MANIFEST.families.modularUnits.keys).toHaveLength(64);
    expect(GENERATED_ASSET_MANIFEST.families.modularUnits.enabled).toBe(false);
  });
});

// ─── MENU-02: isModularUnitsLoaded tests ────────────────────────────

describe('MENU-02: isModularUnitsLoaded', () => {
  it('MODULAR_UNIT_PROBE_KEY is a generated hull key (not legacy modular key)', async () => {
    const { MODULAR_UNIT_PROBE_KEY } = await import('../assets/runtimeGeneratedAssets');

    // Probe key is now a generated hull key (legacy family is disabled)
    expect(MODULAR_UNIT_PROBE_KEY).toBe('generated_hull_wasp_cyan_m0_dir00');
  });

  it('returns true when generated hull probe key texture exists', async () => {
    const { isModularUnitsLoaded, MODULAR_UNIT_PROBE_KEY } = await import('../assets/runtimeGeneratedAssets');

    const mockScene = {
      textures: {
        exists: (key: string) => key === MODULAR_UNIT_PROBE_KEY,
      },
    };

    expect(isModularUnitsLoaded(mockScene as any)).toBe(true);
  });

  it('returns false when probe key texture does not exist', async () => {
    const { isModularUnitsLoaded } = await import('../assets/runtimeGeneratedAssets');

    const mockScene = {
      textures: {
        exists: (_key: string) => false,
      },
    };

    expect(isModularUnitsLoaded(mockScene as any)).toBe(false);
  });

  it('returns false when other keys exist but probe key does not', async () => {
    const { isModularUnitsLoaded } = await import('../assets/runtimeGeneratedAssets');

    const mockScene = {
      textures: {
        exists: (key: string) => key === 'hq_cyan' || key === 'terrain_sand',
      },
    };

    expect(isModularUnitsLoaded(mockScene as any)).toBe(false);
  });
});

// ─── PreloadScene uses generated loader ────────────────────────────
// These tests verify source code contents via dynamic import of the TS source
// as a raw string. Since vitest runs in Node, we use globalThis to access
// the file system without importing 'fs'/'path' (which would require @types/node).

describe('MENU-02: Arena visual asset loading', () => {
  it('FIXUP-5: loadArenaVisualAssets is a no-op (returns empty array)', async () => {
    const { loadArenaVisualAssets } = await import('../assets/runtimeGeneratedAssets');
    const mock = createMockScene();

    try {
      const loadedKeys = loadArenaVisualAssets(mock.scene as any);

      // FIXUP-5: no Wasp M0 hull preload, no pilot turret preload.
      // All modular vehicle assets are loaded on-demand.
      expect(loadedKeys).toHaveLength(0);
      expect(mock.loadImageCalls).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });

  it('FIXUP-5: loadArenaVisualAssets returns empty even when textures exist', async () => {
    const { loadArenaVisualAssets } = await import('../assets/runtimeGeneratedAssets');
    const mock = createMockScene();
    // Simulate some textures already loaded
    mock.scene.textures.exists = (_key: string) => true;

    try {
      const loadedKeys = loadArenaVisualAssets(mock.scene as any);

      // FIXUP-5: always returns [] regardless of texture state.
      expect(loadedKeys).toHaveLength(0);
      expect(mock.loadImageCalls).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });

  it('FIXUP-5: isArenaVisualAssetsLoaded always returns true (no preload to check)', async () => {
    const { isArenaVisualAssetsLoaded } = await import('../assets/runtimeGeneratedAssets');

    const mockScene = {
      textures: {
        exists: (_key: string) => false,
      },
    };

    // FIXUP-5: always true — no modular vehicle preload, nothing to check.
    // Per-vehicle availability is checked by composeModularVehicle().
    expect(isArenaVisualAssetsLoaded(mockScene as any)).toBe(true);
  });

  it('FIXUP-5: isArenaVisualAssetsLoaded returns true even when no textures exist', async () => {
    const { isArenaVisualAssetsLoaded } = await import('../assets/runtimeGeneratedAssets');

    const mockScene = {
      textures: {
        exists: (_key: string) => false,
      },
    };

    // FIXUP-5: always true regardless of texture state.
    expect(isArenaVisualAssetsLoaded(mockScene as any)).toBe(true);
  });
});

describe('PreloadScene integration', () => {
  it('exports all generated loader functions', async () => {
    const runtimeMod = await import('../assets/runtimeGeneratedAssets');

    // The runtime module should export the new loaders
    expect(runtimeMod.loadGeneratedBuildingAndHqAssets).toBeDefined();
    expect(typeof runtimeMod.loadGeneratedBuildingAndHqAssets).toBe('function');
    expect(runtimeMod.loadGeneratedImageAssetFamilies).toBeDefined();
    expect(typeof runtimeMod.loadGeneratedImageAssetFamilies).toBe('function');
    expect(runtimeMod.loadGeneratedSpritesheetAssetFamilies).toBeDefined();
    expect(typeof runtimeMod.loadGeneratedSpritesheetAssetFamilies).toBe('function');
    expect(runtimeMod.loadGeneratedCivilUnitAssets).toBeDefined();
    expect(typeof runtimeMod.loadGeneratedCivilUnitAssets).toBe('function');
    expect(runtimeMod.loadGeneratedModularUnitAssets).toBeDefined();
    expect(typeof runtimeMod.loadGeneratedModularUnitAssets).toBe('function');
    expect(runtimeMod.loadGeneratedTerrainAndResourceAssets).toBeDefined();
    expect(typeof runtimeMod.loadGeneratedTerrainAndResourceAssets).toBe('function');

    // MENU-02: modularUnits loaded-check helpers
    expect(runtimeMod.MODULAR_UNIT_PROBE_KEY).toBeDefined();
    expect(typeof runtimeMod.MODULAR_UNIT_PROBE_KEY).toBe('string');
    expect(runtimeMod.isModularUnitsLoaded).toBeDefined();
    expect(typeof runtimeMod.isModularUnitsLoaded).toBe('function');
    expect(runtimeMod.loadArenaVisualAssets).toBeDefined();
    expect(typeof runtimeMod.loadArenaVisualAssets).toBe('function');
    expect(runtimeMod.isArenaVisualAssetsLoaded).toBeDefined();
    expect(typeof runtimeMod.isArenaVisualAssetsLoaded).toBe('function');
  });

  it('PreloadScene uses generated loader instead of manual building loading', async () => {
    // Verify the runtime loader loads exactly the same keys that the old
    // manual loading path would have loaded (4 HQ + 24 buildings = 28)
    const { loadGeneratedBuildingAndHqAssets } = await import('../assets/runtimeGeneratedAssets');
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedBuildingAndHqAssets(mock.scene as any);

      // Must load all 28 building/HQ keys
      expect(loadedKeys).toHaveLength(28);

      // Must include hq_cyan (previously loaded manually via ASSET_KEYS.HQ_CYAN)
      expect(loadedKeys).toContain('hq_cyan');

      // Must include all other HQ keys (previously loaded by loadBuildingAssets)
      expect(loadedKeys).toContain('hq_green');
      expect(loadedKeys).toContain('hq_yellow');
      expect(loadedKeys).toContain('hq_purple');

      // Must include a sample of building keys
      expect(loadedKeys).toContain('building_cyan_separator');
      expect(loadedKeys).toContain('building_green_power_plant');
    } finally {
      mock.restore();
    }
  });

  it('PreloadScene uses generated civilUnits loader for all spritesheets', async () => {
    const { loadGeneratedCivilUnitAssets } = await import('../assets/runtimeGeneratedAssets');
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedCivilUnitAssets(mock.scene as any);

      // Must load all 8 civil unit spritesheets
      expect(loadedKeys).toHaveLength(8);

      // Must include harvester_cyan (previously loaded manually via ASSET_KEYS.HARVESTER_CYAN)
      expect(loadedKeys).toContain('harvester_cyan');

      // Must include builder and harvester for all factions
      expect(loadedKeys).toContain('builder_cyan');
      expect(loadedKeys).toContain('builder_green');
      expect(loadedKeys).toContain('harvester_purple');
    } finally {
      mock.restore();
    }
  });

  it('PreloadScene uses generated terrain/resource loader for terrain and mineral images', async () => {
    const { loadGeneratedTerrainAndResourceAssets } = await import('../assets/runtimeGeneratedAssets');
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedTerrainAndResourceAssets(mock.scene as any);

      // TERRAIN-02A: 6 terrain + 3 resources = 9
      expect(loadedKeys).toHaveLength(9);
      expect(mock.loadImageCalls).toHaveLength(9);

      // Must include all terrain keys matching TERRAIN-02A 256×128 family
      expect(loadedKeys).toContain('terrain_sand_clean_256x128');
      expect(loadedKeys).toContain('terrain_sand_dark_256x128');
      expect(loadedKeys).toContain('terrain_sand_light_256x128');
      expect(loadedKeys).toContain('terrain_sand_ripple_256x128');
      expect(loadedKeys).toContain('terrain_sand_pebble_256x128');
      expect(loadedKeys).toContain('terrain_sand_cracked_256x128');

      // Must include all resource keys matching legacy ASSET_KEYS
      expect(loadedKeys).toContain('mineral_small');
      expect(loadedKeys).toContain('mineral_medium');
      expect(loadedKeys).toContain('mineral_large');
    } finally {
      mock.restore();
    }
  });

  it('PreloadScene uses generated modularUnits loader (disabled family, returns empty)', async () => {
    const { loadGeneratedModularUnitAssets } = await import('../assets/runtimeGeneratedAssets');
    const mock = createMockScene();

    try {
      const loadedKeys = loadGeneratedModularUnitAssets(mock.scene as any);

      // Family is disabled — no keys loaded (legacy PNGs removed)
      expect(loadedKeys).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });
});
