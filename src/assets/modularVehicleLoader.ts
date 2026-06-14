/**
 * Modular vehicle selected-set loader.
 *
 * RUNTIME-01: Combines the existing hull loader with the new turret
 * loader into a single "selected set" contract. The selected set
 * represents one vehicle configuration: body + weapon + faction + mods.
 *
 * Key contract:
 *   - Loads exactly 16 hull frames + 16 turret frames = 32 PNG maximum
 *   - No duplicate texture key queueing
 *   - Safe fallback if turret set is missing (hull still loads)
 *   - Does NOT modify generatedAssetManifest.ts
 *
 * The loader is designed for lazy/on-demand loading: a vehicle's
 * asset set is only loaded when needed, not at game startup.
 * This matches the existing preloadGeneratedHullSet pattern.
 *
 * Architecture: this module imports from generatedHullAssets.ts and
 * generatedTurretAssets.ts but does NOT import from
 * generatedAssetManifest.ts. It uses the per-family loaders which
 * manage their own key/path logic independently.
 */

import type { Faction } from '../state/types';
import {
  type GeneratedHullId,
  type GeneratedHullFaction,
  type GeneratedHullMod,
  bodyIdToGeneratedHullId,
  resolveGeneratedHullFaction,
  modificationLevelToMod,
  preloadGeneratedHullSet,
} from './generatedHullAssets';
import {
  type GeneratedTurretId,
  type GeneratedTurretFaction,
  type GeneratedTurretMod,
  weaponIdToTurretId,
  resolveGeneratedTurretFaction,
  preloadGeneratedTurretSet,
} from './generatedTurretAssets';

// ─── Selected-set contract ──────────────────────────────────────

/**
 * Identifies a specific vehicle configuration for asset loading.
 *
 * This is the "selected set" contract: one body, one weapon, one
 * faction, one hull mod, one turret mod. From this contract, the
 * loader determines which 32 (or fewer) PNGs to load.
 *
 * The contract is deliberately flat — no nested objects — to make
 * it easy to construct from any caller (blockout vehicle, arena
 * vehicle, save/load, etc.).
 */
export interface VehicleAssetSetRequest {
  /** Body/hull identifier (e.g. 'wasp', 'hornet'). */
  bodyId: string;
  /** Weapon/turret identifier (e.g. 'smoky', 'flamethrower'). */
  weaponId: string;
  /** Faction colour variant. */
  faction: Faction;
  /** Hull modification level (0–3). */
  hullModificationLevel: number;
  /** Turret modification level (0–3). */
  turretModificationLevel: number;
}

/**
 * Result of a selected-set load operation.
 *
 * Reports exactly which texture keys were queued for loading,
 * separated by family (hull vs turret). The caller can inspect
 * this to determine whether the turret set was available.
 *
 * If the turret has no generated assets (e.g. 'shaft'), the
 * turretKeys array will be empty — this is not an error, it
 * means the turret falls back to procedural/legacy rendering.
 */
export interface VehicleAssetSetResult {
  /** Texture keys queued for hull sprites (0–16). */
  hullKeys: string[];
  /** Texture keys queued for turret sprites (0–16). */
  turretKeys: string[];
  /** Whether the hull body has a generated asset set. */
  hullSupported: boolean;
  /** Whether the weapon has a generated turret asset set. */
  turretSupported: boolean;
  /** Total number of texture keys queued (max 32). */
  totalQueued: number;
}

// ─── Selected-set loader ────────────────────────────────────────

/**
 * Load the selected vehicle asset set (hull + turret).
 *
 * Loads up to 32 PNGs for the specified vehicle configuration:
 *   - 16 hull direction frames (if the body has generated assets)
 *   - 16 turret direction frames (if the weapon has generated assets)
 *
 * Duplicate-key protection: both hull and turret preloaders skip
 * texture keys that already exist in the TextureManager.
 *
 * If the body has no generated hull assets (bodyId not in
 * GENERATED_HULL_IDS), hullKeys will be empty and hullSupported
 * will be false — this is a safe fallback, not an error.
 *
 * If the weapon has no generated turret assets (weaponId not
 * mapped in WEAPON_ID_TO_TURRET_ID), turretKeys will be empty
 * and turretSupported will be false — also a safe fallback.
 *
 * The caller must ensure the Phaser loader pipeline is active
 * (e.g. called inside `preload()` or with `scene.load.start()`
 * afterwards for late-loading).
 */
export function preloadVehicleAssetSet(
  scene: Phaser.Scene,
  request: VehicleAssetSetRequest,
): VehicleAssetSetResult {
  const hullId: GeneratedHullId | null = bodyIdToGeneratedHullId(request.bodyId);
  const turretId: GeneratedTurretId | null = weaponIdToTurretId(request.weaponId);

  const hullFaction: GeneratedHullFaction = resolveGeneratedHullFaction(request.faction);
  const hullMod: GeneratedHullMod = modificationLevelToMod(request.hullModificationLevel);

  const turretFaction: GeneratedTurretFaction = resolveGeneratedTurretFaction(request.faction);
  const turretMod: GeneratedTurretMod = modificationLevelToMod(request.turretModificationLevel);

  // Load hull set if supported
  let hullKeys: string[] = [];
  let hullSupported = false;
  if (hullId) {
    hullSupported = true;
    hullKeys = preloadGeneratedHullSet(scene, hullId, hullFaction, hullMod);
  }

  // Load turret set if supported (safe no-op if not)
  let turretKeys: string[] = [];
  let turretSupported = false;
  if (turretId) {
    turretSupported = true;
    turretKeys = preloadGeneratedTurretSet(scene, turretId, turretFaction, turretMod);
  }

  return {
    hullKeys,
    turretKeys,
    hullSupported,
    turretSupported,
    totalQueued: hullKeys.length + turretKeys.length,
  };
}

/**
 * Determine which texture keys would be loaded for a vehicle set
 * without actually loading them.
 *
 * This is useful for pre-computing load lists, budgeting texture
 * memory, or checking whether a vehicle configuration is valid
 * before starting an async load.
 *
 * Returns the same VehicleAssetSetResult structure but with empty
 * key arrays (no actual loading occurs).
 */
export function resolveVehicleAssetSetSupport(
  request: VehicleAssetSetRequest,
): { hullSupported: boolean; turretSupported: boolean } {
  const hullId = bodyIdToGeneratedHullId(request.bodyId);
  const turretId = weaponIdToTurretId(request.weaponId);

  return {
    hullSupported: hullId !== null,
    turretSupported: turretId !== null,
  };
}

// ─── Max PNG budget constant ────────────────────────────────────

/**
 * Maximum number of PNGs a single vehicle selected-set can require.
 *
 * 16 hull directions + 16 turret directions = 32 PNGs maximum.
 * Actual count may be less if:
 *   - The hull body has no generated assets (−16)
 *   - The weapon has no generated turret assets (−16)
 *   - Some textures were already loaded (duplicate-key guard)
 */
export const MAX_VEHICLE_SET_PNG_COUNT = 32;
