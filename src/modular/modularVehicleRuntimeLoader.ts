/**
 * modularVehicleRuntimeLoader — MODULAR-RUNTIME-01 lazy loader.
 *
 * Loads EXACTLY the assets one selected modular vehicle visual needs:
 *   - 16 hull frames (selected hull/faction/hullMod);
 *   - 16 turret frames (selected turret/faction/turretMod);
 *   = 32 PNG maximum per selected visual.
 *
 * It NEVER preloads the whole modular matrix. A module-level ledger of
 * already-requested set ids prevents re-queue churn across callers.
 *
 * Diagnostics are first-class: every request returns what was asked for,
 * how many images were queued, which keys are already available, what is
 * missing, and the fallback reason (if any). The renderer/devtools panel
 * surface these instead of guessing.
 */

import {
  getGeneratedHullTextureKey,
  getGeneratedTurretTextureKey,
  getGeneratedHullAssetPath,
  getGeneratedTurretAssetPath,
  type GeneratedModularDir16,
} from '../assets/generatedModularVehicleAssets.generated';
import {
  isValidModularVehicleVisual,
  modularVisualDebugLabel,
  type ModularVehicleVisual,
} from './modularVehicleVisual';

/** Hard cap: a single selected visual may queue at most this many PNGs. */
export const MAX_MODULAR_VEHICLE_SET_PNG = 32;

/** Frames per family (16 directions). */
export const MODULAR_FRAMES_PER_FAMILY = 16;

export interface ModularLoadDiagnostics {
  /** Echo of the requested visual fields. */
  requested: {
    hullId: string;
    turretId: string;
    faction: string;
    hullMod: string;
    turretMod: string;
  };
  /** Stable set id used for caching/ledger. */
  setId: string;
  /** Whether the requested visual is valid. */
  valid: boolean;
  /** Texture keys queued for loading this call. */
  queuedKeys: string[];
  /** Number of images queued this call (0..32). */
  queuedCount: number;
  /** Keys already present in the texture manager (skipped). */
  alreadyAvailableKeys: string[];
  /** True when the full hull+turret set is available after this call's queue. */
  fullSetRequested: boolean;
  /** True when this exact set was previously requested and was not re-queued. */
  alreadyRequested: boolean;
  /** A fallback reason if loading could not proceed. */
  fallbackReason: string | null;
}

/** Minimal Phaser scene surface this loader needs (keeps it testable). */
export interface ModularLoaderScene {
  textures: { exists: (key: string) => boolean };
  load: { image: (key: string, path: string) => unknown };
}

/** Stable id for one selected visual's asset set. */
export function modularVehicleSetId(visual: ModularVehicleVisual): string {
  return [
    visual.hullId,
    visual.hullMod,
    visual.turretId,
    visual.turretMod,
    visual.faction,
  ].join('|');
}

// Module-level ledger of set ids whose load has already been requested.
const requestedSets = new Set<string>();

/** Reset the requested-set ledger (test/teardown helper). */
export function resetModularLoaderLedger(): void {
  requestedSets.clear();
}

/** All 16 hull texture keys for a visual. */
export function hullSetKeys(visual: ModularVehicleVisual): string[] {
  const keys: string[] = [];
  for (let d = 0; d < MODULAR_FRAMES_PER_FAMILY; d++) {
    keys.push(
      getGeneratedHullTextureKey(
        visual.hullId,
        visual.faction,
        visual.hullMod,
        d as GeneratedModularDir16,
      ),
    );
  }
  return keys;
}

/** All 16 turret texture keys for a visual. */
export function turretSetKeys(visual: ModularVehicleVisual): string[] {
  const keys: string[] = [];
  for (let d = 0; d < MODULAR_FRAMES_PER_FAMILY; d++) {
    keys.push(
      getGeneratedTurretTextureKey(
        visual.turretId,
        visual.faction,
        visual.turretMod,
        d as GeneratedModularDir16,
      ),
    );
  }
  return keys;
}

/**
 * Queue the (up to) 32 PNGs for one selected modular vehicle visual.
 *
 * Skips keys already present in the texture manager. Never queues more
 * than MAX_MODULAR_VEHICLE_SET_PNG images. Caller is responsible for
 * starting the loader (`scene.load.start()`), matching the existing
 * on-demand loading pattern.
 */
export function requestModularVehicleSet(
  scene: ModularLoaderScene,
  visual: ModularVehicleVisual,
): ModularLoadDiagnostics {
  const setId = modularVehicleSetId(visual);
  const requested = {
    hullId: visual.hullId,
    turretId: visual.turretId,
    faction: visual.faction,
    hullMod: visual.hullMod,
    turretMod: visual.turretMod,
  };

  if (!isValidModularVehicleVisual(visual)) {
    return {
      requested,
      setId,
      valid: false,
      queuedKeys: [],
      queuedCount: 0,
      alreadyAvailableKeys: [],
      fullSetRequested: false,
      alreadyRequested: false,
      fallbackReason: `invalid-visual (${modularVisualDebugLabel(visual)})`,
    };
  }

  const alreadyRequested = requestedSets.has(setId);
  const queuedKeys: string[] = [];
  const alreadyAvailableKeys: string[] = [];

  for (let d = 0; d < MODULAR_FRAMES_PER_FAMILY; d++) {
    const dir = d as GeneratedModularDir16;

    const hullKey = getGeneratedHullTextureKey(
      visual.hullId,
      visual.faction,
      visual.hullMod,
      dir,
    );
    if (scene.textures.exists(hullKey)) {
      alreadyAvailableKeys.push(hullKey);
    } else if (!alreadyRequested) {
      scene.load.image(
        hullKey,
        getGeneratedHullAssetPath(visual.hullId, visual.faction, visual.hullMod, dir),
      );
      queuedKeys.push(hullKey);
    }

    const turretKey = getGeneratedTurretTextureKey(
      visual.turretId,
      visual.faction,
      visual.turretMod,
      dir,
    );
    if (scene.textures.exists(turretKey)) {
      alreadyAvailableKeys.push(turretKey);
    } else if (!alreadyRequested) {
      scene.load.image(
        turretKey,
        getGeneratedTurretAssetPath(
          visual.turretId,
          visual.faction,
          visual.turretMod,
          dir,
        ),
      );
      queuedKeys.push(turretKey);
    }
  }

  // Defensive cap — the loop can never exceed 32, but the invariant is
  // load-bearing, so make it explicit.
  if (queuedKeys.length > MAX_MODULAR_VEHICLE_SET_PNG) {
    queuedKeys.length = MAX_MODULAR_VEHICLE_SET_PNG;
  }

  if (!alreadyRequested) {
    requestedSets.add(setId);
  }

  return {
    requested,
    setId,
    valid: true,
    queuedKeys,
    queuedCount: queuedKeys.length,
    alreadyAvailableKeys,
    fullSetRequested: true,
    alreadyRequested,
    fallbackReason: null,
  };
}

/** True when all 32 keys for a visual are present in the texture manager. */
export function isModularVehicleSetLoaded(
  scene: ModularLoaderScene,
  visual: ModularVehicleVisual,
): boolean {
  if (!isValidModularVehicleVisual(visual)) return false;
  const keys = [...hullSetKeys(visual), ...turretSetKeys(visual)];
  return keys.every((k) => scene.textures.exists(k));
}

/** Whether a set's load has previously been requested via the ledger. */
export function wasModularVehicleSetRequested(
  visual: ModularVehicleVisual,
): boolean {
  return requestedSets.has(modularVehicleSetId(visual));
}
