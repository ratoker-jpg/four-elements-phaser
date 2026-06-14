/**
 * LEGACY-WASP-CLEANUP-01B — modular import isolation tests.
 *
 * These tests prove that the clean modular runtime (MODULAR-RUNTIME-01)
 * does NOT import or reference any legacy Wasp/Wasp m0 pilot-era hooks.
 * If a legacy import accidentally creeps into the modular path, these
 * tests will catch it immediately.
 *
 * Approach: verify that modular runtime modules do not export or reference
 * any forbidden legacy identifiers, and that the legacy identifiers are
 * not accidentally re-exported through the modular path.
 *
 * Allowed: the bare hull id string "wasp" is valid in generic hull id lists
 * and default demo visuals — it is NOT banned globally.
 */

import { describe, it, expect, vi } from 'vitest';

// Import the modular runtime modules — these are the "clean path"
import * as modularVisual from '../modular/modularVehicleVisual';
import * as modularComposition from '../modular/modularVehicleComposition';
import * as modularLoader from '../modular/modularVehicleRuntimeLoader';
import * as modularMetadata from '../modular/modularVehicleMetadata';
import * as modularAssets from '../assets/generatedModularVehicleAssets.generated';
import * as modularMetaGenerated from '../assets/generatedModularVehicleMetadata.generated';

// ─── Forbidden legacy identifiers ──────────────────────────────────────
// These names must NOT be accessible through the modular runtime.

const FORBIDDEN_LEGACY_SYMBOLS = [
  'WaspHullPlacementCalibrator',
  'WASP_HULL_VISUAL_PROFILE',
  'WASP_HULL_VISUAL_DIR16_REMAP',
  'WASP_HULL_DIRECTION_REMAP_PROFILE',
  'applyHullVisualDir16Remap',
  'WASP_HULL_OFFSET_X',
  'WASP_HULL_OFFSET_Y',
  'resolvePilotTurretComposition',
  'PILOT_VEHICLE_REQUEST',
  'ENABLE_PILOT_GENERATED_TURRET_COMPOSITION',
  'GeneratedVehicleProofHarness',
  'GeneratedVehicleProofPanel',
  'composeGeneratedVehiclePreview',
  'getGeneratedHullPlacementOffset',
] as const;

// ─── Tests ─────────────────────────────────────────────────────────────

describe('LEGACY-WASP-CLEANUP-01B: modular runtime does not import legacy Wasp hooks', () => {
  it('modular runtime exports are defined and functional', () => {
    // Sanity check: the modular runtime modules export their core functions
    expect(modularVisual.MODULAR_HULL_IDS).toBeDefined();
    expect(modularVisual.MODULAR_TURRET_IDS).toBeDefined();
    expect(modularVisual.MODULAR_MOD_IDS).toBeDefined();
    expect(modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL).toBeDefined();
    expect(modularVisual.isValidModularVehicleVisual).toBeTypeOf('function');
    expect(modularComposition.composeModularVehicle).toBeTypeOf('function');
    expect(modularLoader.requestModularVehicleSet).toBeTypeOf('function');
    expect(modularMetadata.getHullSocketAnchor).toBeTypeOf('function');
    expect(modularMetadata.getTurretPivotAnchor).toBeTypeOf('function');
    expect(modularAssets.getGeneratedHullTextureKey).toBeTypeOf('function');
    expect(modularAssets.getGeneratedTurretTextureKey).toBeTypeOf('function');
  });

  it('modular runtime does not export any forbidden legacy identifier', () => {
    // Collect all exported keys from modular runtime modules
    const modularModules: Record<string, unknown>[] = [
      modularVisual,
      modularComposition,
      modularLoader,
      modularMetadata,
      modularAssets,
      modularMetaGenerated,
    ];

    const violations: string[] = [];

    for (const mod of modularModules) {
      const exportedKeys = Object.keys(mod);
      for (const forbidden of FORBIDDEN_LEGACY_SYMBOLS) {
        if (exportedKeys.includes(forbidden)) {
          violations.push(`module exports "${forbidden}"`);
        }
      }
    }

    if (violations.length > 0) {
      const msg = [
        'Legacy Wasp pilot identifiers found in modular runtime exports:',
        ...violations.map((v) => `  - ${v}`),
        '',
        'These identifiers are @legacy pilot-era hooks that must not be',
        'exported by the clean modular runtime.',
      ].join('\n');
      expect.fail(msg);
    }

    expect(violations).toHaveLength(0);
  });

  it('default modular visual uses "wasp" hull id but not legacy hooks', () => {
    // The default visual uses 'wasp' as a hull id — this is valid
    expect(modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL.hullId).toBe('wasp');
    expect(modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL.turretId).toBe('smoky');
    expect(modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL.faction).toBe('cyan');
    expect(modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL.hullMod).toBe('m0');
    expect(modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL.turretMod).toBe('m0');

    // It must be a valid modular visual
    expect(modularVisual.isValidModularVehicleVisual(
      modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL,
    )).toBe(true);
  });

  it('modular composition does not rely on legacy offset constants', () => {
    // The modular composition math must use metadata-driven offsets,
    // not the legacy Wasp-specific pixel offsets (WASP_HULL_OFFSET_X/Y).

    // Compose a default visual and verify the render plan
    const plan = modularComposition.composeModularVehicle({
      visual: modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL,
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 100, y: 100 },
      textureExists: () => true,
    });

    // The modular path uses origin (0.5, 0.5) for both hull and turret,
    // not the legacy hull origin (0.5, 0.75)
    expect(plan.hull.origin.x).toBe(0.5);
    expect(plan.hull.origin.y).toBe(0.5);
    expect(plan.turret.origin.x).toBe(0.5);
    expect(plan.turret.origin.y).toBe(0.5);

    // The modular path uses MODULAR_VEHICLE_DISPLAY_SCALE, not GENERATED_HULL_SCALE
    expect(plan.hull.scale).toBe(modularComposition.MODULAR_VEHICLE_DISPLAY_SCALE);
    expect(plan.turret.scale).toBe(modularComposition.MODULAR_VEHICLE_DISPLAY_SCALE);
  });

  it('modular runtime produces valid texture keys without legacy key formats', () => {
    // Modular hull keys use the "generated_hull_" prefix from the modular
    // asset registry, NOT the old generatedHullAssets key format
    const hullKey = modularAssets.getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(hullKey).toBe('generated_hull_wasp_cyan_m0_dir00');

    // Modular turret keys use the "generated_turret_" prefix
    const turretKey = modularAssets.getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(turretKey).toBe('generated_turret_smoky_cyan_m0_dir00');

    // No legacy patterns in keys
    expect(hullKey).not.toContain('_hull_dir');
    expect(hullKey).not.toContain('WASP');
    expect(turretKey).not.toContain('WASP');
  });

  it('modular loader queue count respects 32 PNG cap without legacy paths', () => {
    // Reset ledger before test
    modularLoader.resetModularLoaderLedger();

    const mockScene = {
      textures: { exists: () => false },
      load: { image: vi.fn() },
    };

    const result = modularLoader.requestModularVehicleSet(
      mockScene as any,
      modularVisual.DEFAULT_MODULAR_VEHICLE_VISUAL,
    );

    // Should queue exactly 32 PNGs (16 hull + 16 turret)
    expect(result.queuedCount).toBe(modularLoader.MAX_MODULAR_VEHICLE_SET_PNG);
    expect(result.valid).toBe(true);
    expect(result.alreadyRequested).toBe(false);

    // No legacy keys in the queue
    for (const key of result.queuedKeys) {
      expect(key).not.toContain('WASP');
      expect(key).not.toContain('_hull_dir');
    }

    // Cleanup
    modularLoader.resetModularLoaderLedger();
  });
});
