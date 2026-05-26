/**
 * Runtime loader helpers for the generated asset manifest.
 *
 * ARCH-02F: Provides scene-level load functions that read from
 * GENERATED_ASSET_MANIFEST (a committed TS constant, no runtime fetch)
 * and queue the correct Phaser loader calls.
 *
 * ARCH-02G: Added spritesheet family loading for civilUnits.
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
