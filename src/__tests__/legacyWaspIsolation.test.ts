/**
 * LEGACY-WASP-CLEANUP-01B — modular import isolation tests.
 *
 * These tests prove that the clean modular runtime (MODULAR-RUNTIME-01)
 * does NOT import or reference any legacy Wasp/Wasp m0 pilot-era hooks.
 * If a legacy import accidentally creeps into the modular path, these
 * tests will catch it immediately.
 *
 * Approach: read the raw source text of each modular runtime file (via
 * Vite's ?raw import) and assert that forbidden legacy identifiers and
 * import paths are not present. This is robust against formatting changes
 * and catches both re-exports AND internal references.
 *
 * Allowed: the bare hull id string "wasp" is valid in generic hull id lists
 * and default demo visuals — it is NOT banned globally.
 */

import { describe, it, expect, vi } from 'vitest';

// Runtime imports for functional checks (last 2 tests)
import { getGeneratedHullTextureKey, getGeneratedTurretTextureKey } from '../assets/generatedModularVehicleAssets.generated';
// Legacy hull key builder — imported ONLY to prove the two namespaces diverge.
import { getGeneratedHullTextureKey as getLegacyHullTextureKey } from '../assets/generatedHullAssets';
import { requestModularVehicleSet, resetModularLoaderLedger, MAX_MODULAR_VEHICLE_SET_PNG } from '../modular/modularVehicleRuntimeLoader';
import { DEFAULT_MODULAR_VEHICLE_VISUAL } from '../modular/modularVehicleVisual';

// ─── Raw source text of every modular runtime file ─────────────────────
// Vite's ?raw import returns the file's source as a string.
// This lets us scan for forbidden identifiers AND import-from paths.

import modularVehicleVisualSrc from '../modular/modularVehicleVisual?raw';
import modularVehicleCompositionSrc from '../modular/modularVehicleComposition?raw';
import modularVehicleRuntimeLoaderSrc from '../modular/modularVehicleRuntimeLoader?raw';
import modularVehicleMetadataSrc from '../modular/modularVehicleMetadata?raw';
import generatedModularVehicleRendererSrc from '../phaser/render/GeneratedModularVehicleRenderer?raw';
import modularVehicleDevtoolsPanelSrc from '../phaser/dev/ModularVehicleDevtoolsPanel?raw';
import generatedModularVehicleAssetsSrc from '../assets/generatedModularVehicleAssets.generated?raw';
import generatedModularVehicleMetadataSrc from '../assets/generatedModularVehicleMetadata.generated?raw';

// ─── Modular runtime source map (label → source text) ─────────────────

const MODULAR_SOURCES: ReadonlyMap<string, string> = new Map([
  ['src/modular/modularVehicleVisual.ts', modularVehicleVisualSrc],
  ['src/modular/modularVehicleComposition.ts', modularVehicleCompositionSrc],
  ['src/modular/modularVehicleRuntimeLoader.ts', modularVehicleRuntimeLoaderSrc],
  ['src/modular/modularVehicleMetadata.ts', modularVehicleMetadataSrc],
  ['src/phaser/render/GeneratedModularVehicleRenderer.ts', generatedModularVehicleRendererSrc],
  ['src/phaser/dev/ModularVehicleDevtoolsPanel.ts', modularVehicleDevtoolsPanelSrc],
  ['src/assets/generatedModularVehicleAssets.generated.ts', generatedModularVehicleAssetsSrc],
  ['src/assets/generatedModularVehicleMetadata.generated.ts', generatedModularVehicleMetadataSrc],
]);

// ─── Forbidden legacy identifiers ──────────────────────────────────────
// These names must NOT appear in any modular runtime source file —
// neither as imports, nor as references, nor as re-exports.

const FORBIDDEN_LEGACY_IDENTIFIERS: readonly string[] = [
  'WaspHullPlacementCalibrator',
  'WASP_HULL_VISUAL_PROFILE',
  'WASP_HULL_VISUAL_DIR16_REMAP',
  'applyHullVisualDir16Remap',
  'WASP_HULL_OFFSET_X',
  'WASP_HULL_OFFSET_Y',
  'pilotTurretComposition',
  'pilotVehicleLazyLoad',
  'generatedVehicleMetadata',
  'ENABLE_PILOT_GENERATED_TURRET_COMPOSITION',
  'GeneratedVehicleProofHarness',
  'GeneratedVehicleProofPanel',
  'generatedVehiclePreviewComposition',
  'composeGeneratedVehiclePreview',
  'getGeneratedHullPlacementOffset',
  '_hull_dir',
];

// ─── Forbidden legacy import path fragments ────────────────────────────
// These path fragments must NOT appear in any import-from statement
// inside a modular runtime source file.

const FORBIDDEN_LEGACY_IMPORT_PATHS: readonly string[] = [
  'pilotTurretComposition',
  'pilotVehicleLazyLoad',
  'generatedVehicleMetadata',
  'generatedVehiclePreviewComposition',
  'WaspHullPlacementCalibrator',
  'WaspPlacementCalibrationPanel',
  'GeneratedVehicleProofHarness',
  'GeneratedVehicleProofPanel',
];

// ─── Tests ─────────────────────────────────────────────────────────────

describe('LEGACY-WASP-CLEANUP-01B: modular runtime does not import legacy Wasp hooks', () => {
  it('all 8 modular runtime source files are loaded as non-empty text', () => {
    expect(MODULAR_SOURCES.size).toBe(8);
    for (const [label, src] of MODULAR_SOURCES) {
      expect(typeof src).toBe('string');
      expect(src.length, `${label} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('no modular runtime source file contains forbidden legacy identifiers', () => {
    const violations: string[] = [];

    for (const [label, src] of MODULAR_SOURCES) {
      for (const forbidden of FORBIDDEN_LEGACY_IDENTIFIERS) {
        // These are PascalCase, UPPER_SNAKE, or camelCase identifiers —
        // substring false positives are essentially impossible.
        if (src.includes(forbidden)) {
          violations.push(`${label}: contains "${forbidden}"`);
        }
      }
    }

    if (violations.length > 0) {
      const msg = [
        'Legacy Wasp pilot identifiers found in modular runtime source files:',
        ...violations.map((v) => `  - ${v}`),
        '',
        'These identifiers are @legacy pilot-era hooks that must not appear',
        'in the clean modular runtime (neither as imports, references, nor re-exports).',
      ].join('\n');
      expect.fail(msg);
    }

    expect(violations).toHaveLength(0);
  });

  it('no modular runtime source file imports from legacy pilot modules', () => {
    const violations: string[] = [];

    for (const [label, src] of MODULAR_SOURCES) {
      for (const legacyPath of FORBIDDEN_LEGACY_IMPORT_PATHS) {
        // Match: from '...legacyPath...' or from "...legacyPath..."
        const importRegex = new RegExp(
          `from\\s+['"][^'"]*${legacyPath}[^'"]*['"]`,
        );
        if (importRegex.test(src)) {
          violations.push(`${label}: imports from "${legacyPath}"`);
        }
      }
    }

    if (violations.length > 0) {
      const msg = [
        'Modular runtime files import from legacy Wasp pilot modules:',
        ...violations.map((v) => `  - ${v}`),
        '',
        'The clean modular runtime must use src/modular/* + generated',
        'modular manifests, not old pilot-era modules.',
      ].join('\n');
      expect.fail(msg);
    }

    expect(violations).toHaveLength(0);
  });

  it('"wasp" hull id string is allowed in modular runtime', () => {
    // The bare string "wasp" appears in hull id lists and default demo
    // visuals — this is valid and must NOT be banned globally.
    const visualSrc = MODULAR_SOURCES.get('src/modular/modularVehicleVisual.ts');
    expect(visualSrc).toBeDefined();
    expect(visualSrc!.includes("'wasp'")).toBe(true);

    // But the legacy WASP_HULL_VISUAL_PROFILE identifier must NOT appear
    expect(visualSrc!.includes('WASP_HULL_VISUAL_PROFILE')).toBe(false);
  });

  it('modular runtime produces valid texture keys without legacy key formats', () => {
    const hullKey = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(hullKey).toBe('modular_hull_wasp_cyan_m0_dir00');

    const turretKey = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(turretKey).toBe('generated_turret_smoky_cyan_m0_dir00');

    // No legacy patterns
    expect(hullKey).not.toContain('_hull_dir');
    expect(hullKey).not.toContain('WASP');
    expect(turretKey).not.toContain('WASP');
  });

  it('MODULAR-RUNTIME-02A: modular hull key namespace is disjoint from the legacy generated_hull_ namespace', () => {
    // The legacy arena preload (generatedHullAssets.ts) loads the oversized
    // `_hull_dir` crops under the `generated_hull_*` key namespace. The modular
    // loader must own a DISTINCT namespace so the shared Phaser TextureManager
    // never lets one loader's texture satisfy the other's `exists()` guard.
    const modularKey = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    const legacyKey = getLegacyHullTextureKey('wasp', 'cyan', 'm0', 0);

    expect(legacyKey).toBe('generated_hull_wasp_cyan_m0_dir00');
    expect(modularKey).toBe('modular_hull_wasp_cyan_m0_dir00');
    expect(modularKey).not.toBe(legacyKey);
    // The modular prefix must not start with the legacy prefix.
    expect(modularKey.startsWith('generated_hull_')).toBe(false);
  });

  it('modular loader queue respects 32 PNG cap without legacy paths', () => {
    resetModularLoaderLedger();

    const mockScene = {
      textures: { exists: () => false },
      load: { image: vi.fn() },
    };

    const result = requestModularVehicleSet(mockScene as any, DEFAULT_MODULAR_VEHICLE_VISUAL);

    expect(result.queuedCount).toBe(MAX_MODULAR_VEHICLE_SET_PNG);
    expect(result.valid).toBe(true);
    expect(result.alreadyRequested).toBe(false);

    for (const key of result.queuedKeys) {
      expect(key).not.toContain('WASP');
      expect(key).not.toContain('_hull_dir');
    }

    resetModularLoaderLedger();
  });
});
