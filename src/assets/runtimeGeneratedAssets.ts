/**
 * Runtime loader helpers for the generated asset manifest.
 *
 * ARCH-02F: Provides scene-level load functions that read from
 * GENERATED_ASSET_MANIFEST (a committed TS constant, no runtime fetch)
 * and queue the correct Phaser loader calls.
 *
 * ARCH-02G: Added spritesheet family loading for civilUnits.
 * ARCH-02H: Added modularUnits image family loading.
 * ARCH-02I: Added terrain + resources image family loading.
 * VISUAL-06D: Added industrialResources image family loading.
 *
 * Duplicate-key protection: each helper tracks loaded keys within a single
 * call to prevent loading the same texture key twice. This replaces the
 * previous convention of skipping hq_cyan in buildingAssets.ts.
 */

import Phaser from 'phaser';
import {
  GENERATED_ASSET_MANIFEST,
  type GeneratedAssetFamilyName,
} from './generatedAssetManifest';
// FIXUP-5: generatedHullAssets imports removed — no Wasp M0 hull preload
// in loadArenaVisualAssets() anymore. All modular vehicle assets are loaded
// on-demand via requestModularVehicleSet().

// ─── Internal helpers ──────────────────────────────────────────────

/**
 * Load all image-type assets from the specified enabled families.
 *
 * - Skips families that are not enabled.
 * - Skips families whose loadType is not 'image'.
 * - Tracks loaded keys within this call to prevent duplicate loads.
 * - Returns the list of keys that were actually loaded.
 */
export function loadGeneratedImageAssetFamilies(
  scene: Phaser.Scene,
  families: GeneratedAssetFamilyName[],
): string[] {
  const loadedKeys: string[] = [];
  const seen = new Set<string>();

  for (const familyName of families) {
    const family = GENERATED_ASSET_MANIFEST.families[familyName];

    // Skip disabled families
    if (!family || !family.enabled) continue;

    // Only handle image families in this loader
    if (family.loadType !== 'image') {
      console.warn(
        `[runtimeGeneratedAssets] Skipping family "${familyName}": ` +
        `loadType "${family.loadType}" is not supported by loadGeneratedImageAssetFamilies. ` +
        `Only "image" families can be loaded here.`,
      );
      continue;
    }

    for (const key of family.keys) {
      // Duplicate key guard within this call
      if (seen.has(key)) {
        console.warn(
          `[runtimeGeneratedAssets] Duplicate key "${key}" in family "${familyName}" — skipping.`,
        );
        continue;
      }
      seen.add(key);

      const path = GENERATED_ASSET_MANIFEST.paths[key];
      if (!path) {
        console.error(
          `[runtimeGeneratedAssets] Key "${key}" has no path in manifest — skipping.`,
        );
        continue;
      }

      scene.load.image(key, path);
      loadedKeys.push(key);
    }
  }

  return loadedKeys;
}

/**
 * Load all spritesheet-type assets from the specified enabled families.
 *
 * - Skips families that are not enabled.
 * - Skips families whose loadType is not 'spritesheet'.
 * - Requires frameConfig on the family definition.
 * - Tracks loaded keys within this call to prevent duplicate loads.
 * - Returns the list of keys that were actually loaded.
 */
export function loadGeneratedSpritesheetAssetFamilies(
  scene: Phaser.Scene,
  families: GeneratedAssetFamilyName[],
): string[] {
  const loadedKeys: string[] = [];
  const seen = new Set<string>();

  for (const familyName of families) {
    const family = GENERATED_ASSET_MANIFEST.families[familyName];

    // Skip disabled families
    if (!family || !family.enabled) continue;

    // Only handle spritesheet families in this loader
    if (family.loadType !== 'spritesheet') {
      console.warn(
        `[runtimeGeneratedAssets] Skipping family "${familyName}": ` +
        `loadType "${family.loadType}" is not supported by loadGeneratedSpritesheetAssetFamilies. ` +
        `Only "spritesheet" families can be loaded here.`,
      );
      continue;
    }

    // Require frameConfig
    if (!family.frameConfig) {
      console.error(
        `[runtimeGeneratedAssets] Family "${familyName}" has loadType "spritesheet" but no frameConfig — skipping.`,
      );
      continue;
    }

    for (const key of family.keys) {
      // Duplicate key guard within this call
      if (seen.has(key)) {
        console.warn(
          `[runtimeGeneratedAssets] Duplicate key "${key}" in family "${familyName}" — skipping.`,
        );
        continue;
      }
      seen.add(key);

      const path = GENERATED_ASSET_MANIFEST.paths[key];
      if (!path) {
        console.error(
          `[runtimeGeneratedAssets] Key "${key}" has no path in manifest — skipping.`,
        );
        continue;
      }

      scene.load.spritesheet(key, path, {
        frameWidth: family.frameConfig.frameWidth,
        frameHeight: family.frameConfig.frameHeight,
      });
      loadedKeys.push(key);
    }
  }

  return loadedKeys;
}

/**
 * Convenience: load hq + buildings families from the generated manifest.
 *
 * This replaces both the manual hq_cyan load from assetManifest.ts
 * and the loadBuildingAssets() call from buildingAssets.ts.
 */
export function loadGeneratedBuildingAndHqAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedImageAssetFamilies(scene, ['hq', 'buildings']);
}

/**
 * Convenience: load civilUnits family from the generated manifest.
 *
 * This replaces the manual harvester_cyan load from assetManifest.ts
 * and the loadCivilUnitAssets() call from civilUnitAssets.ts.
 */
export function loadGeneratedCivilUnitAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedSpritesheetAssetFamilies(scene, ['civilUnits']);
}

/**
 * Convenience: load modularUnits family from the generated manifest.
 *
 * @deprecated Legacy modularUnits family is now disabled (legacy PNGs removed).
 * Use `preloadGeneratedHullSet()` from `generatedHullAssets.ts` instead.
 * This function returns an empty array because the family is disabled.
 */
export function loadGeneratedModularUnitAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedImageAssetFamilies(scene, ['modularUnits']);
}

/**
 * Representative generated hull key used for checking whether combat
 * hull assets have been loaded. Updated from legacy `wasp_m0_hull_cyan_dir0`
 * because the legacy modularUnits family is now disabled.
 *
 * MENU-02: This avoids importing the full key list at call sites that
 * just need a boolean check.
 */
export const MODULAR_UNIT_PROBE_KEY = 'generated_hull_wasp_cyan_m0_dir00' as const;

/**
 * Check whether modularUnit combat assets have been loaded.
 *
 * Now checks for the generated hull probe key instead of the legacy
 * modularUnits family key. If the generated hull probe key exists in
 * the TextureManager, we assume generated hull assets were loaded
 * (by PreloadScene via URL params or by late-loading via NewGameSetupScene).
 */
export function isModularUnitsLoaded(scene: Phaser.Scene): boolean {
  return scene.textures.exists(MODULAR_UNIT_PROBE_KEY);
}

/**
 * Load the small combat visual set needed by Debug/Arena.
 *
 * FIXUP-5: ALL pilot-era Wasp/Smoky preloads removed from the live Arena
 * path. This function is now a no-op — it queues zero PNG keys. Modular
 * vehicle assets (hull + turret for any hull/weapon/faction/mod combo)
 * are loaded exclusively on-demand via requestModularVehicleSet() when a
 * vehicle is spawned in Arena or normal runtime.
 *
 * This was the last piece masking the canonical on-demand loading. With
 * FIXUP-4 (loader auto-start) + FIXUP-5 (no Wasp M0 preload), all
 * vehicle visual combos load correctly via the canonical path.
 *
 * The function is kept as a no-op for PreloadScene call-site
 * compatibility — PreloadScene.preload() calls it when devtools is
 * enabled. Stage 4 may remove the call entirely.
 *
 * Legacy modularUnits family is disabled (PNGs removed).
 */
export function loadArenaVisualAssets(_scene: Phaser.Scene): string[] {
  // FIXUP-5: No Wasp M0 hull preload. No pilot turret preload.
  // All modular vehicle assets are loaded on-demand via
  // requestModularVehicleSet() when a vehicle is spawned.
  //
  // Previously, this function preloaded Wasp M0 hull sets for all 4
  // factions (64 PNG) + Smoky cyan m0 turret (16 PNG). That masked
  // the canonical on-demand loading failure (FIXUP-4) and made Arena
  // show old tuned Wasp M0 even when other vehicles were broken.
  return [];
}

/**
 * FIXUP-5: isArenaVisualAssetsLoaded is now always true.
 *
 * Previously, this checked whether Wasp M0 hull sets for all 4 factions
 * were preloaded. With FIXUP-5, no modular vehicle assets are preloaded
 * — they are all loaded on-demand. This function is kept for
 * PreloadScene call-site compatibility but always returns true because
 * there is nothing to preload.
 *
 * Vehicle asset availability is checked per-vehicle by the adapter's
 * composeModularVehicle() plan.available flag, not by this function.
 */
export function isArenaVisualAssetsLoaded(_scene: Phaser.Scene): boolean {
  // FIXUP-5: no modular vehicle preload → always "loaded" (nothing to check).
  // Per-vehicle availability is checked by composeModularVehicle().
  return true;
}

/**
 * Convenience: load terrain + resources families from the generated manifest.
 *
 * This replaces the manual terrain_sand / mineral_small etc. loads
 * that previously used ASSET_KEYS / ASSET_PATHS from assetManifest.ts.
 */
export function loadGeneratedTerrainAndResourceAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedImageAssetFamilies(scene, ['terrain', 'resources']);
}

/**
 * Convenience: load industrialTerrain family from the generated manifest.
 * VISUAL-05A-PR2: Industrial platform tiles are always loaded (small set)
 * so they are available when a user selects industrial mapStyle.
 */
export function loadGeneratedIndustrialTerrainAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedImageAssetFamilies(scene, ['industrialTerrain']);
}

/**
 * Convenience: load industrialFrame family from the generated manifest.
 * VISUAL-05A-PR3: Frame top block, wall face block, and background world
 * image are always loaded (3 images, small) so they are available when
 * a user selects industrial mapStyle.
 */
export function loadGeneratedIndustrialFrameAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedImageAssetFamilies(scene, ['industrialFrame']);
}

/**
 * Convenience: load industrialResources family from the generated manifest.
 * VISUAL-06D: Approved industrial resource assets (richness-tier crystals
 * and infinite center deposit). Always loaded (small set, 6 images) so they
 * are available for VISUAL-06E renderer wiring behind resourceStyle.
 */
export function loadGeneratedIndustrialResourceAssets(
  scene: Phaser.Scene,
): string[] {
  return loadGeneratedImageAssetFamilies(scene, ['industrialResources']);
}

/**
 * Representative industrialResource key used for checking whether
 * industrial resource assets have been loaded. VISUAL-06D: This avoids
 * importing the full manifest key list at call sites that just need a
 * boolean check.
 */
export const INDUSTRIAL_RESOURCE_PROBE_KEY = 'resource_industrial_medium_01' as const;

/**
 * Check whether industrial resource assets have been loaded.
 * VISUAL-06D: If the probe key exists in the TextureManager, we assume
 * the full industrialResources family was loaded by PreloadScene.
 */
export function isIndustrialResourcesLoaded(scene: Phaser.Scene): boolean {
  return scene.textures.exists(INDUSTRIAL_RESOURCE_PROBE_KEY);
}
