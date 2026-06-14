/**
 * @legacy Wasp/Smoky pilot-era vehicle lazy-load lifecycle.
 * Do not import into MODULAR-RUNTIME-* code paths.
 * The clean modular runtime must use src/modular/* + generated modular manifests.
 *
 * Pilot vehicle lazy-load lifecycle + diagnostics.
 *
 * RUNTIME-02B: Wires the existing selected-set loader (preloadVehicleAssetSet)
 * into Arena/dev lifecycle for the pilot combo: Wasp cyan m0 hull + Smoky
 * cyan m0 turret.
 *
 * Key design decisions:
 *   - Only loads the pilot selected set (max 32 PNG), never all assets
 *   - Uses preloadVehicleAssetSet() from modularVehicleLoader.ts
 *   - Duplicate-key protection is handled by the underlying loaders
 *   - Hull textures may already be loaded (from loadArenaVisualAssets
 *     which loads wasp/<all factions>/m0) — the duplicate guard skips them
 *   - Turret textures are loaded fresh (first time in Arena lifecycle)
 *   - Diagnostics report loaded/queued/fallback status for the pilot set
 *   - Does NOT modify renderer composition
 *   - Does NOT touch generatedAssetManifest.ts
 *
 * Lifecycle hook:
 *   This module is called from loadArenaVisualAssets() in
 *   runtimeGeneratedAssets.ts, which is itself guarded by
 *   isDevtoolsEnabled() in PreloadScene and by arena/debug mode
 *   in NewGameSetupScene. Standard (non-Arena) mode never triggers
 *   the pilot load.
 *
 * Duplicate-key in same preload batch:
 *   loadPilotVehicleAssetSet() loads both hull and turret. However,
 *   when called from loadArenaVisualAssets() during a Phaser preload()
 *   batch, the hull keys for cyan wasp m0 are already queued but not
 *   yet loaded in TextureManager. Phaser's TextureManager.exists()
 *   only detects already-loaded textures, not queued ones. So calling
 *   preloadVehicleAssetSet() would double-queue the hull keys.
 *
 *   To avoid this, loadArenaVisualAssets() calls loadPilotTurretSet()
 *   instead, which only loads the turret. The full vehicle set loader
 *   (loadPilotVehicleAssetSet) is available for on-demand loading
 *   outside the Arena preload batch.
 */

import type { Faction } from '../state/types';
import {
  preloadVehicleAssetSet,
  resolveVehicleAssetSetSupport,
  type VehicleAssetSetRequest,
  type VehicleAssetSetResult,
  MAX_VEHICLE_SET_PNG_COUNT,
} from './modularVehicleLoader';
import {
  getGeneratedHullTextureKey,
  isGeneratedHullSetLoaded,
  type GeneratedHullDir16Index,
} from './generatedHullAssets';
import {
  getGeneratedTurretTextureKey,
  isGeneratedTurretSetLoaded,
  preloadGeneratedTurretSet,
  type GeneratedTurretDir16Index,
} from './generatedTurretAssets';

// ─── Pilot vehicle request ────────────────────────────────────────

/**
 * The pilot vehicle configuration for RUNTIME-02B.
 *
 * Wasp cyan m0 hull + Smoky cyan m0 turret.
 * This is the first modular vehicle set to be wired into the Arena
 * lifecycle, validating that preloadVehicleAssetSet() works correctly
 * in a real scene context.
 */
export const PILOT_VEHICLE_REQUEST: VehicleAssetSetRequest = {
  bodyId: 'wasp',
  weaponId: 'smoky',
  faction: 'cyan' as Faction,
  hullModificationLevel: 0,
  turretModificationLevel: 0,
};

// ─── Pilot lazy-load ──────────────────────────────────────────────

/**
 * Load the pilot vehicle asset set (Wasp cyan m0 hull + Smoky cyan m0 turret).
 *
 * Uses preloadVehicleAssetSet() from modularVehicleLoader.ts which:
 *   - Calls preloadGeneratedHullSet() for the hull (16 PNG)
 *   - Calls preloadGeneratedTurretSet() for the turret (16 PNG)
 *   - Skips textures already present in TextureManager (duplicate-key guard)
 *   - Returns a VehicleAssetSetResult with queued key counts
 *
 * The caller must ensure the Phaser loader pipeline is active
 * (e.g. called inside `preload()` or with `scene.load.start()` afterwards).
 *
 * IMPORTANT: If the hull set for cyan wasp m0 is already queued in the
 * same preload batch (e.g. by loadArenaVisualAssets), use
 * loadPilotTurretSet() instead to avoid duplicate key queueing.
 * Phaser's TextureManager.exists() only detects already-loaded textures,
 * not keys queued in the current batch.
 */
export function loadPilotVehicleAssetSet(
  scene: Phaser.Scene,
): VehicleAssetSetResult {
  return preloadVehicleAssetSet(scene, PILOT_VEHICLE_REQUEST);
}

/**
 * Load ONLY the pilot turret set (Smoky cyan m0, 16 PNG).
 *
 * This is the Arena-safe variant of loadPilotVehicleAssetSet().
 * It loads only the turret, because in the Arena lifecycle the hull
 * sets (wasp/<all factions>/m0) are already queued by
 * loadArenaVisualAssets() before this function is called.
 *
 * Using this instead of loadPilotVehicleAssetSet() avoids the Phaser
 * duplicate-key issue where textures queued in the same preload batch
 * are not yet in TextureManager, so the duplicate-key guard cannot
 * detect them.
 *
 * Returns the list of turret texture keys that were actually queued.
 */
export function loadPilotTurretSet(
  scene: Phaser.Scene,
): string[] {
  return preloadGeneratedTurretSet(scene, 'smoky', 'cyan', 'm0');
}

// ─── Diagnostics ──────────────────────────────────────────────────

/**
 * Diagnostic snapshot for the pilot vehicle asset set.
 *
 * Reports the loaded/queued/fallback status for both hull and turret
 * families, the number of texture keys present in the TextureManager,
 * and whether the full pilot set is available for rendering.
 */
export interface PilotVehicleLoadDiagnostics {
  /** Whether the pilot hull (wasp cyan m0) is supported by generated assets. */
  hullSupported: boolean;
  /** Whether the pilot turret (smoky cyan m0) is supported by generated assets. */
  turretSupported: boolean;
  /** Whether all 16 hull texture keys for the pilot set exist in TextureManager. */
  hullLoaded: boolean;
  /** Whether all 16 turret texture keys for the pilot set exist in TextureManager. */
  turretLoaded: boolean;
  /** Number of hull texture keys currently present in TextureManager (0–16). */
  hullKeysPresent: number;
  /** Number of turret texture keys currently present in TextureManager (0–16). */
  turretKeysPresent: number;
  /** Max PNG budget for any single vehicle set (32). */
  maxPngBudget: number;
  /** Whether the full pilot set (both hull and turret) is loaded and ready. */
  fullyLoaded: boolean;
}

/**
 * Get a diagnostic snapshot for the pilot vehicle asset set.
 *
 * Checks the scene's TextureManager to determine how many of the
 * pilot set's texture keys are present, and whether the full set
 * is loaded and ready for use.
 *
 * Does NOT load any assets — purely diagnostic.
 */
export function getPilotVehicleLoadDiagnostics(
  scene: Phaser.Scene,
): PilotVehicleLoadDiagnostics {
  const support = resolveVehicleAssetSetSupport(PILOT_VEHICLE_REQUEST);

  // Count hull keys present
  let hullKeysPresent = 0;
  for (let dir = 0; dir < 16; dir++) {
    const key = getGeneratedHullTextureKey(
      'wasp', 'cyan', 'm0',
      dir as GeneratedHullDir16Index,
    );
    if (scene.textures.exists(key)) {
      hullKeysPresent++;
    }
  }

  // Count turret keys present
  let turretKeysPresent = 0;
  for (let dir = 0; dir < 16; dir++) {
    const key = getGeneratedTurretTextureKey(
      'smoky', 'cyan', 'm0',
      dir as GeneratedTurretDir16Index,
    );
    if (scene.textures.exists(key)) {
      turretKeysPresent++;
    }
  }

  const hullLoaded = isGeneratedHullSetLoaded(scene, 'wasp', 'cyan', 'm0');
  const turretLoaded = isGeneratedTurretSetLoaded(scene, 'smoky', 'cyan', 'm0');

  return {
    hullSupported: support.hullSupported,
    turretSupported: support.turretSupported,
    hullLoaded,
    turretLoaded,
    hullKeysPresent,
    turretKeysPresent,
    maxPngBudget: MAX_VEHICLE_SET_PNG_COUNT,
    fullyLoaded: hullLoaded && turretLoaded,
  };
}

/**
 * Check whether the pilot vehicle set (Wasp cyan m0 hull + Smoky cyan m0 turret)
 * is fully loaded and ready for use.
 */
export function isPilotVehicleSetFullyLoaded(
  scene: Phaser.Scene,
): boolean {
  const diag = getPilotVehicleLoadDiagnostics(scene);
  return diag.fullyLoaded;
}

// ─── Pilot scope guard ────────────────────────────────────────────

/**
 * The maximum number of PNGs the pilot vehicle set can require.
 * 16 hull + 16 turret = 32 PNG.
 */
export const PILOT_VEHICLE_MAX_PNG = 32;
