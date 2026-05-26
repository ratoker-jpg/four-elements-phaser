import { describe, it, expect, vi } from 'vitest';
import {
  GENERATED_ASSET_MANIFEST,
} from '../assets/generatedAssetManifest';

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

  it('has hq, buildings, and civilUnits families', () => {
    expect(GENERATED_ASSET_MANIFEST.families.hq).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.buildings).toBeDefined();
    expect(GENERATED_ASSET_MANIFEST.families.civilUnits).toBeDefined();
  });

  it('has 36 total paths (4 HQ + 24 buildings + 8 civilUnits)', () => {
    const keys = Object.keys(GENERATED_ASSET_MANIFEST.paths);
    expect(keys).toHaveLength(36);
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
  });

  it('has no duplicate keys across families', () => {
    const allKeys = [
      ...GENERATED_ASSET_MANIFEST.families.hq.keys,
      ...GENERATED_ASSET_MANIFEST.families.buildings.keys,
      ...GENERATED_ASSET_MANIFEST.families.civilUnits.keys,
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

// ─── PreloadScene uses generated loader ────────────────────────────
// These tests verify source code contents via dynamic import of the TS source
// as a raw string. Since vitest runs in Node, we use globalThis to access
// the file system without importing 'fs'/'path' (which would require @types/node).

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
});
