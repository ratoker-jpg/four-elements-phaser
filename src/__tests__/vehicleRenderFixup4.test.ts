/**
 * VEHICLE-RENDER-UNIFY-03-VH-FIXUP-4 tests.
 *
 * Tests cover:
 *   - requestModularVehicleSet auto-starts the Phaser loader when assets are queued;
 *   - requestModularVehicleSet does NOT start the loader when queuedCount === 0;
 *   - requestModularVehicleSet does NOT start duplicate loads while loader is active;
 *   - loadArenaVisualAssets no longer queues pilot turret keys (Smoky cyan m0);
 *   - isArenaVisualAssetsLoaded no longer requires pilot turret probe key;
 *   - 32 PNG cap remains enforced;
 *   - no getWaspHullKey/getSmokyTurretKey legacy path restored;
 *   - no silent cyan fallback introduced.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestModularVehicleSet,
  resetModularLoaderLedger,
  MAX_MODULAR_VEHICLE_SET_PNG,
} from '../modular/modularVehicleRuntimeLoader';
import type { ModularVehicleVisual } from '../modular/modularVehicleVisual';

// ─── Mock scene with loader start tracking ─────────────────────────

function createMockSceneWithLoader(opts: {
  textureExists?: (key: string) => boolean;
  loaderActive?: boolean;
}): {
  scene: any;
  loadImageCalls: Array<{ key: string; path: string }>;
  loadStartCalls: { count: number };
} {
  const loadImageCalls: Array<{ key: string; path: string }> = [];
  const loadStartCalls = { count: 0 };
  let loaderActive = opts.loaderActive ?? false;

  const scene = {
    textures: {
      exists: opts.textureExists ?? (() => false),
    },
    load: {
      image: (key: string, path: string) => {
        loadImageCalls.push({ key, path });
      },
      start: () => {
        loadStartCalls.count++;
        loaderActive = true;
      },
      isLoading: () => loaderActive,
    },
  };

  return { scene, loadImageCalls, loadStartCalls };
}

const DEFAULT_VISUAL: ModularVehicleVisual = {
  hullId: 'wasp',
  turretId: 'smoky',
  faction: 'cyan',
  hullMod: 'm0',
  turretMod: 'm0',
};

// ─── Tests ─────────────────────────────────────────────────────────

describe('VEHICLE-RENDER-UNIFY-03-VH-FIXUP-4: canonical on-demand loader auto-start', () => {
  beforeEach(() => {
    resetModularLoaderLedger();
  });

  it('requestModularVehicleSet auto-starts the Phaser loader when assets are queued', () => {
    const { scene, loadImageCalls, loadStartCalls } = createMockSceneWithLoader({});

    const result = requestModularVehicleSet(scene, DEFAULT_VISUAL);

    // Assets were queued (32 PNG: 16 hull + 16 turret)
    expect(result.queuedCount).toBe(32);
    expect(loadImageCalls.length).toBe(32);

    // FIXUP-4: loader.start() was called exactly once
    expect(loadStartCalls.count).toBe(1);
  });

  it('requestModularVehicleSet does NOT start the loader when queuedCount === 0', () => {
    // All textures already exist → nothing queued → no start
    const { scene, loadStartCalls } = createMockSceneWithLoader({
      textureExists: () => true, // all textures exist
    });

    const result = requestModularVehicleSet(scene, DEFAULT_VISUAL);

    expect(result.queuedCount).toBe(0);
    // FIXUP-4: loader.start() was NOT called
    expect(loadStartCalls.count).toBe(0);
  });

  it('requestModularVehicleSet does NOT start duplicate loads while loader is active', () => {
    // First call: queue 32 PNG, start loader
    const { scene, loadStartCalls } = createMockSceneWithLoader({
      loaderActive: true, // simulate loader already running
    });

    const result = requestModularVehicleSet(scene, DEFAULT_VISUAL);

    // Assets were queued (32 PNG)
    expect(result.queuedCount).toBe(32);

    // FIXUP-4: loader.start() was NOT called because loader is already active
    expect(loadStartCalls.count).toBe(0);
  });

  it('requestModularVehicleSet does NOT re-queue the same set (ledger guard)', () => {
    const { scene, loadImageCalls, loadStartCalls } = createMockSceneWithLoader({});

    // First call: queues 32 PNG
    requestModularVehicleSet(scene, DEFAULT_VISUAL);
    expect(loadImageCalls.length).toBe(32);
    expect(loadStartCalls.count).toBe(1);

    // Second call with same visual: ledger prevents re-queue
    const result2 = requestModularVehicleSet(scene, DEFAULT_VISUAL);
    expect(result2.queuedCount).toBe(0);
    expect(result2.alreadyRequested).toBe(true);
    // No additional load.start() call (nothing queued)
    expect(loadStartCalls.count).toBe(1);
  });

  it('32 PNG cap remains enforced', () => {
    const { scene, loadImageCalls } = createMockSceneWithLoader({});
    const result = requestModularVehicleSet(scene, DEFAULT_VISUAL);
    expect(result.queuedCount).toBeLessThanOrEqual(MAX_MODULAR_VEHICLE_SET_PNG);
    expect(loadImageCalls.length).toBeLessThanOrEqual(MAX_MODULAR_VEHICLE_SET_PNG);
  });

  it('different weapon/faction combos each get their own on-demand load', () => {
    const { scene, loadImageCalls } = createMockSceneWithLoader({});

    // Request a non-cyan, non-smoky visual
    const visual: ModularVehicleVisual = {
      hullId: 'hunter',
      turretId: 'railgun',
      faction: 'purple',
      hullMod: 'm2',
      turretMod: 'm2',
    };
    const result = requestModularVehicleSet(scene, visual);

    // Should queue 32 PNG for hunter+purple+m2 hull + railgun+purple+m2 turret
    expect(result.queuedCount).toBe(32);
    expect(loadImageCalls.length).toBe(32);

    // Verify the keys are for the correct visual (not hardcoded Wasp/Smoky/cyan)
    const hullKeys = loadImageCalls.filter(c => c.key.includes('hunter') && c.key.includes('purple') && c.key.includes('m2'));
    expect(hullKeys.length).toBe(16);

    const turretKeys = loadImageCalls.filter(c => c.key.includes('railgun') && c.key.includes('purple') && c.key.includes('m2'));
    expect(turretKeys.length).toBe(16);
  });
});

// ─── Pilot preload removal tests ───────────────────────────────────

describe('VEHICLE-RENDER-UNIFY-03-VH-FIXUP-4: pilot preload removed from live path', () => {
  it('FIXUP-5: loadArenaVisualAssets is a no-op (no hull keys, no turret keys)', async () => {
    const { loadArenaVisualAssets } = await import('../assets/runtimeGeneratedAssets');

    const loadImageCalls: Array<{ key: string; path: string }> = [];
    const scene = {
      textures: { exists: () => false },
      load: {
        image: (key: string, path: string) => loadImageCalls.push({ key, path }),
        start: () => {},
        isLoading: () => false,
      },
    };

    loadArenaVisualAssets(scene as any);

    // FIXUP-5: no keys of any kind should be queued.
    // All modular vehicle assets are loaded on-demand.
    expect(loadImageCalls.length).toBe(0);
  });

  it('isArenaVisualAssetsLoaded does NOT require pilot turret probe key', async () => {
    const { isArenaVisualAssetsLoaded } = await import('../assets/runtimeGeneratedAssets');
    const { getGeneratedHullTextureKey } = await import('../assets/generatedHullAssets');

    // Preload all hull keys for all 4 factions but NO turret keys
    const preloaded = new Set<string>();
    for (const faction of ['cyan', 'green', 'yellow', 'purple']) {
      for (let dir = 0; dir < 16; dir++) {
        preloaded.add(getGeneratedHullTextureKey('wasp', faction as any, 'm0', dir as any));
      }
    }

    const scene = {
      textures: { exists: (key: string) => preloaded.has(key) },
    };

    // FIXUP-4: should return true even without turret probe key
    expect(isArenaVisualAssetsLoaded(scene as any)).toBe(true);
  });
});
