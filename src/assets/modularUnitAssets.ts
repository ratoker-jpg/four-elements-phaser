import Phaser from 'phaser';
import type { Faction } from '../state/types';
import { bodyAngleToDir8 } from './generatedHullAssets';
import { resolveTurretVisualDir } from '../config/hullTurretVisualProfiles';

export const MODULAR_FACTIONS = ['cyan', 'green', 'yellow', 'purple'] as const;
export const MODULAR_DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export type ModularDirection = (typeof MODULAR_DIRECTIONS)[number];

export function getWaspHullKey(faction: Faction, dir: ModularDirection): string {
  return `wasp_m0_hull_${faction}_dir${dir}`;
}

export function getSmokyTurretKey(faction: Faction, dir: ModularDirection): string {
  return `smoky_m0_turret_${faction}_dir${dir}`;
}

export function getWaspHullPath(faction: Faction, dir: ModularDirection): string {
  return `assets/units/chassis/wasp_m0/${faction}/wasp_m0_hull_idle_dir${dir}_0.png`;
}

export function getSmokyTurretPath(faction: Faction, dir: ModularDirection): string {
  return `assets/units/weapons/smoky_m0/${faction}/smoky_m0_turret_idle_dir${dir}_0.png`;
}

/**
 * Load all modular unit assets (wasp hull + smoky turret for all factions).
 *
 * @deprecated Legacy loader. Use `loadGeneratedModularUnitAssets(scene)` from
 * `runtimeGeneratedAssets.ts` instead. This function is kept for backwards
 * compatibility but is no longer called by PreloadScene.
 */
export function loadModularUnitAssets(scene: Phaser.Scene): void {
  for (const faction of MODULAR_FACTIONS) {
    for (const dir of MODULAR_DIRECTIONS) {
      scene.load.image(getWaspHullKey(faction, dir), getWaspHullPath(faction, dir));
      scene.load.image(getSmokyTurretKey(faction, dir), getSmokyTurretPath(faction, dir));
    }
  }
}

// ── PR-D: Profile-based turret sprite key resolver ──────────────────

/**
 * Weapons that have a profile-based turret sprite resolver.
 * Used for fast-path rejection before looking up the profile.
 */
export const MODULAR_TURRET_SPRITE_WEAPONS: ReadonlySet<string> = new Set(['smoky']);

/**
 * Resolve a modular turret sprite key using the weapon's visual profile.
 *
 * Pipeline:
 * 1. Reject unsupported weapons (no profile) → null
 * 2. Quantize turretAngle to logical dir8 via bodyAngleToDir8
 * 3. Apply turret visual direction remap via resolveTurretVisualDir
 *    (uses the weapon's own DirectionRemapProfile, NOT the hull's)
 * 4. Build the texture key via getSmokyTurretKey
 * 5. Return the key only if the texture is loaded in the scene
 *
 * Graceful fallback:
 * - Unsupported weapon → null
 * - Missing/unloaded texture → null
 * - Invalid profile → null (resolveTurretVisualDir returns null)
 *
 * PR-D: This does NOT use applyHullVisualDir16Remap or any hull-specific
 * remap for turret direction. The turret's visual direction comes from
 * its own profile (SMOKY_TURRET_VISUAL_PROFILE.direction), closing
 * audit root cause RC-3.
 *
 * Not wired into the renderer yet — for future renderer integration.
 */
export function resolveModularTurretSpriteKey(
  scene: Phaser.Scene,
  weaponId: string,
  faction: Faction,
  turretAngle: number,
): string | null {
  // Fast-path: reject weapons without profile support
  if (!MODULAR_TURRET_SPRITE_WEAPONS.has(weaponId)) return null;

  // Quantize angle to logical dir8
  const logicalDir8 = bodyAngleToDir8(turretAngle);

  // Apply turret-specific visual direction remap via profile
  const visualDir8 = resolveTurretVisualDir(weaponId, logicalDir8);
  if (visualDir8 === null) return null;

  // Clamp to valid range for ModularDirection (0–7)
  const clampedDir = Math.min(Math.max(visualDir8, 0), 7) as ModularDirection;

  // Build texture key (currently Smoky only; future weapons get their own key builder)
  let key: string;
  if (weaponId === 'smoky') {
    key = getSmokyTurretKey(faction, clampedDir);
  } else {
    return null;
  }

  // Return only if the texture exists in the scene
  if (scene.textures.exists(key)) {
    return key;
  }
  return null;
}
