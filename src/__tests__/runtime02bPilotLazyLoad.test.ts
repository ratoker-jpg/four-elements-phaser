/**
 * Tests for RUNTIME-02B: Pilot vehicle lazy-load lifecycle + diagnostics.
 *
 * Validates:
 * - Pilot vehicle request constants are correct
 * - loadPilotVehicleAssetSet uses preloadVehicleAssetSet correctly
 * - No broad preload (only pilot set loaded, not all 2560 turret PNGs)
 * - No duplicate texture queueing (hull keys already loaded are skipped)
 * - Diagnostics accurately report loaded/queued/fallback status
 * - isPilotVehicleSetFullyLoaded is correct
 * - Pilot scope limit (max 32 PNG)
 * - loadArenaVisualAssets now includes turret keys
 * - isArenaVisualAssetsLoaded checks pilot turret probe key
 * - Standard mode safety (no preload when not in Arena/dev mode)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PILOT_VEHICLE_REQUEST,
  loadPilotVehicleAssetSet,
  getPilotVehicleLoadDiagnostics,
  isPilotVehicleSetFullyLoaded,
  PILOT_VEHICLE_MAX_PNG,
} from '../assets/pilotVehicleLazyLoad';
import {
  resolveVehicleAssetSetSupport,
  MAX_VEHICLE_SET_PNG_COUNT,
} from '../assets/modularVehicleLoader';
import {
  loadArenaVisualAssets,
  isArenaVisualAssetsLoaded,
  PILOT_TURRET_PROBE_KEY,
} from '../assets/runtimeGeneratedAssets';
import {
  getGeneratedHullTextureKey,
  type GeneratedHullDir16Index,
} from '../assets/generatedHullAssets';
import {
  getGeneratedTurretTextureKey,
  type GeneratedTurretDir16Index,
} from '../assets/generatedTurretAssets';

// ─── Mock scene factory ──────────────────────────────────────────

/**
 * Create a mock Phaser.Scene with controllable texture state.
 *
 * @param preloadedKeys - Set of texture keys that already "exist" in TextureManager
 */
function createMockScene(preloadedKeys: Set<string> = new Set()) {
  const loadImageCalls: Array<{ key: string; path: string }> = [];

  const scene = {
    textures: {
      exists: vi.fn().mockImplementation((key: string) => preloadedKeys.has(key)),
    },
    load: {
      image: vi.fn().mockImplementation((key: string, path: string) => {
        loadImageCalls.push({ key, path });
      }),
    },
  } as unknown as Phaser.Scene;

  return { scene, loadImageCalls, preloadedKeys };
}

// ═══════════════════════════════════════════════════════════════════
// Pilot vehicle request constants
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: pilot vehicle request constants', () => {
  it('PILOT_VEHICLE_REQUEST has correct bodyId', () => {
    expect(PILOT_VEHICLE_REQUEST.bodyId).toBe('wasp');
  });

  it('PILOT_VEHICLE_REQUEST has correct weaponId', () => {
    expect(PILOT_VEHICLE_REQUEST.weaponId).toBe('smoky');
  });

  it('PILOT_VEHICLE_REQUEST has correct faction', () => {
    expect(PILOT_VEHICLE_REQUEST.faction).toBe('cyan');
  });

  it('PILOT_VEHICLE_REQUEST has correct hullModificationLevel', () => {
    expect(PILOT_VEHICLE_REQUEST.hullModificationLevel).toBe(0);
  });

  it('PILOT_VEHICLE_REQUEST has correct turretModificationLevel', () => {
    expect(PILOT_VEHICLE_REQUEST.turretModificationLevel).toBe(0);
  });

  it('PILOT_VEHICLE_MAX_PNG is 32', () => {
    expect(PILOT_VEHICLE_MAX_PNG).toBe(32);
  });

  it('PILOT_VEHICLE_MAX_PNG matches MAX_VEHICLE_SET_PNG_COUNT', () => {
    expect(PILOT_VEHICLE_MAX_PNG).toBe(MAX_VEHICLE_SET_PNG_COUNT);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Pilot vehicle support check
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: pilot vehicle support', () => {
  it('wasp hull is supported', () => {
    const support = resolveVehicleAssetSetSupport(PILOT_VEHICLE_REQUEST);
    expect(support.hullSupported).toBe(true);
  });

  it('smoky turret is supported', () => {
    const support = resolveVehicleAssetSetSupport(PILOT_VEHICLE_REQUEST);
    expect(support.turretSupported).toBe(true);
  });

  it('both hull and turret are supported for pilot combo', () => {
    const support = resolveVehicleAssetSetSupport(PILOT_VEHICLE_REQUEST);
    expect(support.hullSupported).toBe(true);
    expect(support.turretSupported).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Pilot lazy-load behavior
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: loadPilotVehicleAssetSet', () => {
  it('queues 16 hull + 16 turret = 32 PNG when nothing is loaded', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);

    expect(result.hullKeys.length).toBe(16);
    expect(result.turretKeys.length).toBe(16);
    expect(result.totalQueued).toBe(32);
  });

  it('hull keys follow generated_hull_ prefix', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);

    for (const key of result.hullKeys) {
      expect(key).toMatch(/^generated_hull_wasp_cyan_m0_dir\d{2}$/);
    }
  });

  it('turret keys follow generated_turret_ prefix', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);

    for (const key of result.turretKeys) {
      expect(key).toMatch(/^generated_turret_smoky_cyan_m0_dir\d{2}$/);
    }
  });

  it('reports hullSupported=true and turretSupported=true', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);

    expect(result.hullSupported).toBe(true);
    expect(result.turretSupported).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// No broad preload
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: no broad preload', () => {
  it('pilot load never queues more than 32 PNG', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);

    expect(result.totalQueued).toBeLessThanOrEqual(MAX_VEHICLE_SET_PNG_COUNT);
  });

  it('pilot load does not queue all 2560 turret PNGs', () => {
    const { scene, loadImageCalls } = createMockScene();
    loadPilotVehicleAssetSet(scene);

    // Should only queue turret PNGs for smoky/cyan/m0, not for all turrets
    const turretKeys = loadImageCalls.filter(c => c.key.startsWith('generated_turret_'));
    expect(turretKeys.length).toBe(16);
    for (const call of turretKeys) {
      expect(call.key).toContain('smoky_cyan_m0');
      expect(call.path).toContain('smoky/cyan/m0');
    }
  });

  it('pilot load does not queue hull PNGs for non-cyan factions', () => {
    const { scene, loadImageCalls } = createMockScene();
    loadPilotVehicleAssetSet(scene);

    const hullKeys = loadImageCalls.filter(c => c.key.startsWith('generated_hull_'));
    for (const call of hullKeys) {
      expect(call.key).toContain('wasp_cyan_m0');
    }
  });

  it('pilot load does not queue hull PNGs for non-m0 mods', () => {
    const { scene, loadImageCalls } = createMockScene();
    loadPilotVehicleAssetSet(scene);

    const hullKeys = loadImageCalls.filter(c => c.key.startsWith('generated_hull_'));
    for (const call of hullKeys) {
      expect(call.key).not.toContain('_m1_');
      expect(call.key).not.toContain('_m2_');
      expect(call.key).not.toContain('_m3_');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// No duplicate texture queueing
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: no duplicate texture queueing', () => {
  it('skips hull textures that are already loaded', () => {
    // Pre-populate TextureManager with all wasp cyan m0 hull keys
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    const result = loadPilotVehicleAssetSet(scene);

    // Hull keys should be empty (all skipped by duplicate guard)
    expect(result.hullKeys.length).toBe(0);
    // Turret keys should still be 16
    expect(result.turretKeys.length).toBe(16);
    expect(result.totalQueued).toBe(16);
  });

  it('skips turret textures that are already loaded', () => {
    // Pre-populate TextureManager with all smoky cyan m0 turret keys
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir as GeneratedTurretDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    const result = loadPilotVehicleAssetSet(scene);

    // Hull keys should be 16 (not pre-loaded)
    expect(result.hullKeys.length).toBe(16);
    // Turret keys should be empty (all skipped by duplicate guard)
    expect(result.turretKeys.length).toBe(0);
    expect(result.totalQueued).toBe(16);
  });

  it('skips both hull and turret textures when all are already loaded', () => {
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
      preloaded.add(
        getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir as GeneratedTurretDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    const result = loadPilotVehicleAssetSet(scene);

    expect(result.hullKeys.length).toBe(0);
    expect(result.turretKeys.length).toBe(0);
    expect(result.totalQueued).toBe(0);
  });

  it('loadArenaVisualAssets does not duplicate hull keys when pilot set loads', () => {
    // Simulate the exact Arena lifecycle:
    // 1. loadArenaVisualAssets loads hulls for all 4 factions
    // 2. Then calls loadPilotVehicleAssetSet which re-checks cyan hull
    const { scene, loadImageCalls } = createMockScene();

    loadArenaVisualAssets(scene as unknown as Phaser.Scene);

    // Count hull keys for wasp_cyan_m0 — should appear exactly once
    const cyanHullKeys = loadImageCalls.filter(
      c => c.key.startsWith('generated_hull_wasp_cyan_m0'),
    );
    // 16 keys for cyan hull (loaded once by the hull faction loop)
    expect(cyanHullKeys.length).toBe(16);

    // Count turret keys for smoky_cyan_m0 — should appear exactly once
    const smokyTurretKeys = loadImageCalls.filter(
      c => c.key.startsWith('generated_turret_smoky_cyan_m0'),
    );
    expect(smokyTurretKeys.length).toBe(16);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Diagnostics
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: diagnostics', () => {
  it('reports hullSupported=true and turretSupported=true for pilot', () => {
    const { scene } = createMockScene();
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.hullSupported).toBe(true);
    expect(diag.turretSupported).toBe(true);
  });

  it('reports 0 keys present when nothing is loaded', () => {
    const { scene } = createMockScene();
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.hullKeysPresent).toBe(0);
    expect(diag.turretKeysPresent).toBe(0);
  });

  it('reports fullyLoaded=false when nothing is loaded', () => {
    const { scene } = createMockScene();
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.hullLoaded).toBe(false);
    expect(diag.turretLoaded).toBe(false);
    expect(diag.fullyLoaded).toBe(false);
  });

  it('reports maxPngBudget=32', () => {
    const { scene } = createMockScene();
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.maxPngBudget).toBe(32);
  });

  it('counts hull keys correctly when partially loaded', () => {
    const preloaded = new Set<string>();
    // Load only 8 out of 16 hull keys (dirs 8-15, not including the probe key dir00)
    // This ensures isGeneratedHullSetLoaded (which probes dir00) returns false
    for (let dir = 8; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.hullKeysPresent).toBe(8);
    expect(diag.hullLoaded).toBe(false);
  });

  it('reports fullyLoaded=true when both hull and turret are fully loaded', () => {
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
      preloaded.add(
        getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir as GeneratedTurretDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.hullKeysPresent).toBe(16);
    expect(diag.turretKeysPresent).toBe(16);
    expect(diag.hullLoaded).toBe(true);
    expect(diag.turretLoaded).toBe(true);
    expect(diag.fullyLoaded).toBe(true);
  });

  it('reports fullyLoaded=false when only hull is loaded (turret missing)', () => {
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    const diag = getPilotVehicleLoadDiagnostics(scene);

    expect(diag.hullLoaded).toBe(true);
    expect(diag.turretLoaded).toBe(false);
    expect(diag.fullyLoaded).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// isPilotVehicleSetFullyLoaded
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: isPilotVehicleSetFullyLoaded', () => {
  it('returns false when nothing is loaded', () => {
    const { scene } = createMockScene();
    expect(isPilotVehicleSetFullyLoaded(scene)).toBe(false);
  });

  it('returns true when both hull and turret are fully loaded', () => {
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
      preloaded.add(
        getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir as GeneratedTurretDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    expect(isPilotVehicleSetFullyLoaded(scene)).toBe(true);
  });

  it('returns false when hull is loaded but turret is not', () => {
    const preloaded = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      preloaded.add(
        getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir as GeneratedHullDir16Index),
      );
    }

    const { scene } = createMockScene(preloaded);
    expect(isPilotVehicleSetFullyLoaded(scene)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// loadArenaVisualAssets integration
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: loadArenaVisualAssets integration', () => {
  it('loadArenaVisualAssets queues pilot turret keys', () => {
    const { scene, loadImageCalls } = createMockScene();

    loadArenaVisualAssets(scene as unknown as Phaser.Scene);

    const turretKeys = loadImageCalls.filter(c => c.key.startsWith('generated_turret_smoky_cyan_m0'));
    expect(turretKeys.length).toBe(16);
  });

  it('loadArenaVisualAssets queues hull keys for all 4 factions', () => {
    const { scene, loadImageCalls } = createMockScene();

    loadArenaVisualAssets(scene as unknown as Phaser.Scene);

    const hullKeys = loadImageCalls.filter(c => c.key.startsWith('generated_hull_'));
    // 4 factions × 16 dirs = 64 hull keys
    expect(hullKeys.length).toBe(64);
  });

  it('PILOT_TURRET_PROBE_KEY matches the expected turret key', () => {
    expect(PILOT_TURRET_PROBE_KEY).toBe('generated_turret_smoky_cyan_m0_dir00');
  });

  it('isArenaVisualAssetsLoaded checks pilot turret probe key', () => {
    // Preload all hull keys but NOT the turret probe key
    const preloaded = new Set<string>();
    for (const faction of ['cyan', 'green', 'yellow', 'purple']) {
      for (let dir = 0; dir < 16; dir++) {
        preloaded.add(
          getGeneratedHullTextureKey('wasp', faction as any, 'm0', dir as GeneratedHullDir16Index),
        );
      }
    }

    const { scene } = createMockScene(preloaded);
    // Hulls loaded but turret not loaded → should return false
    expect(isArenaVisualAssetsLoaded(scene as unknown as Phaser.Scene)).toBe(false);
  });

  it('isArenaVisualAssetsLoaded returns true when hulls and turret are loaded', () => {
    const preloaded = new Set<string>();
    for (const faction of ['cyan', 'green', 'yellow', 'purple']) {
      for (let dir = 0; dir < 16; dir++) {
        preloaded.add(
          getGeneratedHullTextureKey('wasp', faction as any, 'm0', dir as GeneratedHullDir16Index),
        );
      }
    }
    // Add turret probe key
    preloaded.add(PILOT_TURRET_PROBE_KEY);

    const { scene } = createMockScene(preloaded);
    expect(isArenaVisualAssetsLoaded(scene as unknown as Phaser.Scene)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Standard mode safety
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: standard mode safety', () => {
  it('pilot request does not reference unsupported weapons', () => {
    // shaft has no generated turret assets
    const support = resolveVehicleAssetSetSupport({
      bodyId: 'wasp',
      weaponId: 'shaft',
      faction: 'cyan' as any,
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });
    expect(support.turretSupported).toBe(false);
  });

  it('pilot request only loads wasp + smoky, not other combos', () => {
    const { scene, loadImageCalls } = createMockScene();
    loadPilotVehicleAssetSet(scene);

    // No non-smoky turret keys
    const nonSmokyTurret = loadImageCalls.filter(
      c => c.key.startsWith('generated_turret_') && !c.key.includes('smoky_cyan_m0'),
    );
    expect(nonSmokyTurret.length).toBe(0);

    // No non-wasp hull keys
    const nonWaspHull = loadImageCalls.filter(
      c => c.key.startsWith('generated_hull_') && !c.key.includes('wasp_cyan_m0'),
    );
    expect(nonWaspHull.length).toBe(0);
  });

  it('diagnostics is a read-only check that does not load assets', () => {
    const { scene, loadImageCalls } = createMockScene();

    getPilotVehicleLoadDiagnostics(scene);

    // No load.image calls should be made
    expect(loadImageCalls.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Pilot scope limit
// ═══════════════════════════════════════════════════════════════════

describe('RUNTIME-02B: pilot scope limit', () => {
  it('pilot set queues at most 32 PNG total', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);
    expect(result.totalQueued).toBeLessThanOrEqual(PILOT_VEHICLE_MAX_PNG);
  });

  it('pilot set queues at most 16 hull PNG', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);
    expect(result.hullKeys.length).toBeLessThanOrEqual(16);
  });

  it('pilot set queues at most 16 turret PNG', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);
    expect(result.turretKeys.length).toBeLessThanOrEqual(16);
  });

  it('pilot set total never exceeds max vehicle set PNG count', () => {
    const { scene } = createMockScene();
    const result = loadPilotVehicleAssetSet(scene);
    expect(result.totalQueued).toBeLessThanOrEqual(MAX_VEHICLE_SET_PNG_COUNT);
  });
});
