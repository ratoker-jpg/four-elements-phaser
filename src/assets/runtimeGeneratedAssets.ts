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
import {
  DEFAULT_GENERATED_HULL,
  DEFAULT_GENERATED_HULL_MOD,
  GENERATED_HULL_FACTIONS,
  isGeneratedHullSetLoaded,
  preloadGeneratedHullSet,
  type GeneratedHullFaction,
} from './generatedHullAssets';
// FIXUP-4: loadPilotTurretSet import removed from pilotVehicleLazyLoad.
// The pilot Wasp/Smoky preload is no longer used by the live Arena path.
// Canonical on-demand loading via requestModularVehicleSet() replaces it.

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
 * FIXUP-4: The old pilot Wasp/Smoky preload was removed from the live
 * Arena path. The canonical on-demand loading (requestModularVehicleSet)
 * now auto-starts the Phaser loader, so vehicles load their own assets
 * when spawned — no pilot-era hardcoded preload needed.
 *
 * This function still preloads Wasp M0 hull sets for all 4 factions
 * (64 PNG total) as a devtools convenience so the Arena devtools overlay
 * has something to show immediately. The turret for the selected weapon
 * is loaded on-demand via requestModularVehicleSet() when a vehicle is
 * spawned.
 *
 * Legacy modularUnits family is disabled (PNGs removed).
 */
export function loadArenaVisualAssets(scene: Phaser.Scene): string[] {
  const loadedKeys: string[] = [];

  // FIXUP-4: Still preload Wasp M0 hull sets for all 4 factions as a
  // devtools convenience. This gives the Arena devtools overlay immediate
  // hull textures for quick preview. Turret textures are loaded on-demand
  // via requestModularVehicleSet() when a vehicle is spawned with a
  // specific weapon.
  //
  // The old pilot turret preload (loadPilotTurretSet → Smoky cyan m0 only)
  // was removed because it masked the canonical on-demand loading failure:
  // only Smoky cyan m0 turret was preloaded, so any other weapon/faction
  // combo had no turret until the (broken) on-demand loader was fixed.
  // With FIXUP-4, requestModularVehicleSet() now auto-starts the Phaser
  // loader, so all weapon/faction combos load correctly on demand.
  for (const faction of GENERATED_HULL_FACTIONS) {
    loadedKeys.push(
      ...preloadGeneratedHullSet(
        scene,
        DEFAULT_GENERATED_HULL,
        faction as GeneratedHullFaction,
        DEFAULT_GENERATED_HULL_MOD,
      ),
    );
  }

  // FIXUP-4: No pilot turret preload. Turret assets are loaded on-demand
  // via requestModularVehicleSet() when a vehicle is spawned.

  return loadedKeys;
}

/**
 * Representative pilot turret key used for checking whether the
 * RUNTIME-02B pilot turret set has been loaded.
 *
 * If this key exists in the TextureManager, we assume the pilot
 * Smoky cyan m0 turret set was loaded by loadArenaVisualAssets().
 */
export const PILOT_TURRET_PROBE_KEY = 'generated_turret_smoky_cyan_m0_dir00' as const;

/**
 * Check whether the Debug/Arena combat visual set is available.
 *
 * FIXUP-4: Only checks hull sets (Wasp M0 for all 4 factions). Turret
 * sets are loaded on-demand via requestModularVehicleSet() and are NOT
 * part of the preload check. The old pilot turret probe key check was
 * removed because the pilot preload was removed from the live path.
 */
export function isArenaVisualAssetsLoaded(scene: Phaser.Scene): boolean {
  const hullsLoaded = GENERATED_HULL_FACTIONS.every(faction => (
    isGeneratedHullSetLoaded(
      scene,
      DEFAULT_GENERATED_HULL,
      faction as GeneratedHullFaction,
      DEFAULT_GENERATED_HULL_MOD,
    )
  ));
  // FIXUP-4: No pilot turret probe check. Turret assets are loaded
  // on-demand per vehicle via requestModularVehicleSet().
  return hullsLoaded;
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
