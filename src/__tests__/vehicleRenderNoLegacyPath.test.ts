/**
 * VEHICLE-RENDER-UNIFY-03-VH Stage 3 — contract tests for legacy renderer retirement.
 *
 * These tests verify that the legacy modular vehicle render paths are no
 * longer referenced from production code. They read the raw source text
 * of each production file (via Vite's ?raw import) and assert that
 * forbidden legacy identifiers and import paths are not present.
 *
 * This is the grep/contract test layer that protects Stage 4 (and all
 * future PRs) from accidentally re-introducing legacy render paths.
 */

import { describe, it, expect } from 'vitest';

// ─── Raw source text of production files that must not reference legacy paths ──

import modularTankRendererSrc from '../phaser/render/ModularTankRenderer?raw';
import blockoutVehicleRendererSrc from '../phaser/render/BlockoutVehicleRenderer?raw';
import gameInputControllerSrc from '../phaser/input/GameInputController?raw';
import worldConfigSrc from '../config/worldConfig?raw';

// ─── Forbidden legacy identifiers (Stage 3 retirement) ──────────────
//
// These identifiers were removed from production code in Stage 3.
// They may appear in comments explaining what was removed, but must
// NOT appear in active import statements or runtime code.

const FORBIDDEN_LEGACY_IMPORTS_IN_MODULAR_TANK_RENDERER: readonly string[] = [
  'getWaspHullKey',
  'getSmokyTurretKey',
  'MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR',
  'MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR',
  'tunerState',
  'pilotTurretComposition',
  'PilotTurretCompositionResult',
  'resolvePilotTurretComposition',
  'ModularTankDebugOverlay',
  'getGeneratedHullTextureKey',
  'mapRuntimeDir8ToGeneratedDir16',
  'isGeneratedHullSetLoaded',
  'DEFAULT_GENERATED_HULL',
  'DEFAULT_GENERATED_HULL_MOD',
  'resolveGeneratedHullFaction',
  'GENERATED_HULL_SCALE',
  'GENERATED_HULL_ORIGIN_X',
  'GENERATED_HULL_ORIGIN_Y',
  'getGeneratedHullPlacementOffset',
];

const FORBIDDEN_LEGACY_IMPORTS_IN_BLOCKOUT_VEHICLE_RENDERER: readonly string[] = [
  'pilotTurretComposition',
  'PilotTurretCompositionResult',
  'resolvePilotTurretComposition',
  'ENABLE_PILOT_GENERATED_TURRET_COMPOSITION',
];

const FORBIDDEN_LEGACY_IMPORTS_IN_GAME_INPUT_CONTROLLER: readonly string[] = [
  'MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR',
  'MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR',
  'tunerState',
];

const FORBIDDEN_LEGACY_IDENTIFIERS_IN_WORLD_CONFIG: readonly string[] = [
  'MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR',
  'MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR',
  'DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR',
  'DEFAULT_MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR',
  'tunerState',
  'TunerLayer',
  'cloneOffsetRecord',
];

// ─── Helper: check if a forbidden identifier appears in an active import ──
//
// We scan for `import ... from ...` statements that contain the forbidden
// identifier. Comments and string literals are skipped.

function findForbiddenImports(
  source: string,
  forbidden: readonly string[],
): string[] {
  const violations: string[] = [];
  const lines = source.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    // Only check import statements
    if (!trimmed.startsWith('import ') && !trimmed.includes('from ')) {
      continue;
    }
    for (const id of forbidden) {
      // Check if the forbidden identifier appears as a named import
      // (e.g. `import { getWaspHullKey }` or `import { getWaspHullKey, ... }`)
      if (line.includes(id)) {
        violations.push(`${id} in: ${trimmed}`);
      }
    }
  }

  return violations;
}

// ─── Helper: check if a forbidden identifier appears anywhere in
//     non-comment, non-string code (for worldConfig which should not
//     even mention these names in active code) ──

function findForbiddenIdentifiers(
  source: string,
  forbidden: readonly string[],
): string[] {
  const violations: string[] = [];
  const lines = source.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    for (const id of forbidden) {
      if (line.includes(id)) {
        violations.push(`${id} in: ${trimmed}`);
      }
    }
  }

  return violations;
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('VEHICLE-RENDER-UNIFY-03-VH Stage 3: legacy renderer retirement', () => {
  describe('ModularTankRenderer does not import legacy paths', () => {
    it('no forbidden legacy imports in ModularTankRenderer.ts', () => {
      const violations = findForbiddenImports(
        modularTankRendererSrc,
        FORBIDDEN_LEGACY_IMPORTS_IN_MODULAR_TANK_RENDERER,
      );
      expect(violations, violations.join('\n')).toEqual([]);
    });

    it('ModularTankRenderer is now a thin delegate (< 400 lines)', () => {
      // Stage 3 retirement: the file was 733 lines, should now be ~350.
      // This is a soft upper bound to catch accidental re-growth.
      const lineCount = modularTankRendererSrc.split('\n').length;
      expect(lineCount).toBeLessThan(400);
    });
  });

  describe('BlockoutVehicleRenderer does not import pilotTurretComposition', () => {
    it('no forbidden pilot turret composition imports in BlockoutVehicleRenderer.ts', () => {
      const violations = findForbiddenImports(
        blockoutVehicleRendererSrc,
        FORBIDDEN_LEGACY_IMPORTS_IN_BLOCKOUT_VEHICLE_RENDERER,
      );
      expect(violations, violations.join('\n')).toEqual([]);
    });

    it('ENABLE_PILOT_GENERATED_TURRET_COMPOSITION is not defined as a constant', () => {
      // The flag was removed; it must not be re-declared.
      const lines = blockoutVehicleRendererSrc.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        // The flag should not appear as a const declaration
        if (/const\s+ENABLE_PILOT_GENERATED_TURRET_COMPOSITION/.test(line)) {
          throw new Error(`Forbidden flag re-declared: ${trimmed}`);
        }
      }
    });
  });

  describe('GameInputController does not import legacy offset tables', () => {
    it('no forbidden legacy imports in GameInputController.ts', () => {
      const violations = findForbiddenImports(
        gameInputControllerSrc,
        FORBIDDEN_LEGACY_IMPORTS_IN_GAME_INPUT_CONTROLLER,
      );
      expect(violations, violations.join('\n')).toEqual([]);
    });

    it('no tuner hotkey handlers (Q/E/Z/X/T/H/J/C/Arrow) wiring offset tables', () => {
      // The tuner hotkeys were removed. We check that the keyboard
      // handler does not reference the removed offset tables or tunerState.
      const lines = gameInputControllerSrc.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        if (line.includes('tunerState') || line.includes('MODULAR_TANK_HULL_OFFSETS') || line.includes('MODULAR_TANK_TURRET_MOUNT')) {
          throw new Error(`Forbidden legacy tuner reference: ${trimmed}`);
        }
      }
    });
  });

  describe('worldConfig does not contain legacy offset tables', () => {
    it('no forbidden legacy identifiers in worldConfig.ts', () => {
      const violations = findForbiddenIdentifiers(
        worldConfigSrc,
        FORBIDDEN_LEGACY_IDENTIFIERS_IN_WORLD_CONFIG,
      );
      expect(violations, violations.join('\n')).toEqual([]);
    });

    it('worldConfig retains TILE_W, TILE_H, MAP_W, MAP_H, Offset2D, ModularTankDirection', () => {
      // These are the kept types/constants. They must still be present.
      expect(worldConfigSrc).toMatch(/export const TILE_W = 76/);
      expect(worldConfigSrc).toMatch(/export const TILE_H = 38/);
      expect(worldConfigSrc).toMatch(/export const MAP_W = 48/);
      expect(worldConfigSrc).toMatch(/export const MAP_H = 48/);
      expect(worldConfigSrc).toMatch(/export type Offset2D/);
      expect(worldConfigSrc).toMatch(/export type ModularTankDirection/);
    });
  });

  describe('legacy files are removed from the repo', () => {
    it('pilotTurretComposition.ts is deleted', async () => {
      // Attempting to import the raw source should fail (file not found).
      // We use a try/catch because Vite's ?raw import of a missing file
      // throws at module resolution time.
      let importFailed = false;
      try {
        await import('../assets/pilotTurretComposition?raw');
      } catch {
        importFailed = true;
      }
      expect(importFailed).toBe(true);
    });

    it('ModularTankDebugOverlay.ts is deleted', async () => {
      let importFailed = false;
      try {
        await import('../debug/ModularTankDebugOverlay?raw');
      } catch {
        importFailed = true;
      }
      expect(importFailed).toBe(true);
    });

    it('runtime03PilotTurretComposition.test.ts is deleted', async () => {
      let importFailed = false;
      try {
        await import('./runtime03PilotTurretComposition.test?raw');
      } catch {
        importFailed = true;
      }
      expect(importFailed).toBe(true);
    });
  });
});

// ─── Behavior preservation tests (Stage 2 contracts still hold) ────

describe('VEHICLE-RENDER-UNIFY-03-VH Stage 3: Stage 2 contracts preserved', () => {
  it('factionResolver still exports resolveFactionOrDiagnosticFallback', async () => {
    const mod = await import('../modular/factionResolver');
    expect(typeof mod.resolveFactionOrDiagnosticFallback).toBe('function');
    expect(typeof mod.isCanonicalFaction).toBe('function');
    expect(mod.CANONICAL_FACTIONS).toEqual(['cyan', 'green', 'yellow', 'purple']);
  });

  it('debugRenderFlags still exports 4 flags (all default false)', async () => {
    const mod = await import('../config/debugRenderFlags');
    expect(mod.debugRenderFlags.directionArrow).toBe(false);
    expect(mod.debugRenderFlags.aimLine).toBe(false);
    expect(mod.debugRenderFlags.mountPoints).toBe(false);
    expect(mod.debugRenderFlags.debugLabels).toBe(false);
  });

  it('ModularVehicleLiveAdapter still exports ENABLE_MODULAR_VEHICLE_RENDER (default true)', async () => {
    const mod = await import('../phaser/render/ModularVehicleLiveAdapter');
    expect(mod.ENABLE_MODULAR_VEHICLE_RENDER).toBe(true);
  });

  it('composeModularVehicle still exports MODULAR_VEHICLE_BASE_SCALE = 0.16', async () => {
    const mod = await import('../modular/modularVehicleComposition');
    expect(mod.MODULAR_VEHICLE_BASE_SCALE).toBe(0.16);
  });

  it('HULL_VISUAL_SCALE_MULTIPLIERS.dictator still = 1.09 (Dictator +9% hull-only)', async () => {
    const mod = await import('../modular/modularVehicleComposition');
    expect(mod.HULL_VISUAL_SCALE_MULTIPLIERS.dictator).toBe(1.09);
    expect(mod.getHullVisualScaleMultiplier('dictator')).toBe(1.09);
    expect(mod.getHullVisualScaleMultiplier('wasp')).toBe(1);
  });

  it('MAX_MODULAR_VEHICLE_SET_PNG still = 32 (lazy-load cap preserved)', async () => {
    const mod = await import('../modular/modularVehicleRuntimeLoader');
    expect(mod.MAX_MODULAR_VEHICLE_SET_PNG).toBe(32);
  });
});
