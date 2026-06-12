import Phaser from 'phaser';
import type { Faction } from '../state/types';
import { bodyAngleToDir8, resolveGeneratedHullFaction } from './generatedHullAssets';

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
 * FIX-OPUS-TURRET-VISUAL-01: Weapon IDs that have a real modular turret
 * sprite available in the small Arena visual set.
 *
 * The Arena visual set (loadArenaVisualAssets) only loads the Smoky turret
 * sprite matrix (4 factions × 8 directions). Other weapons fall back to the
 * procedural blockout turret. Do NOT add entries here without also loading
 * the corresponding turret sprites in the Arena visual set — that would
 * resolve a key whose texture was never loaded.
 */
const MODULAR_TURRET_SPRITE_WEAPONS = new Set<string>(['smoky']);

/**
 * Resolve the modular turret sprite texture key for a vehicle, or null when
 * no real turret sprite is available (so the caller keeps the procedural
 * blockout turret as a graceful fallback).
 *
 * FIX-OPUS-TURRET-VISUAL-01: Arena vehicles render a tiny procedural turret
 * box that is unreadable on generated hull bodies. When a real turret sprite
 * exists in the loaded Arena visual set (currently Smoky only), prefer it.
 *
 * The turret direction is quantized from the continuous turretAngle using the
 * same screen-space 8-direction convention the legacy Smoky/Wasp sprites were
 * authored for, so the sprite tracks the PR #254 turretAngle / target-lock
 * state. Faction falls back to a valid sprite faction (cyan) when needed.
 *
 * Returns null if the weapon has no sprite or the texture is not loaded.
 */
export function resolveModularTurretSpriteKey(
  scene: Phaser.Scene,
  weaponId: string,
  faction: Faction,
  turretAngle: number,
): string | null {
  if (!MODULAR_TURRET_SPRITE_WEAPONS.has(weaponId)) return null;

  const dir = bodyAngleToDir8(turretAngle) as ModularDirection;
  const spriteFaction = resolveGeneratedHullFaction(faction);
  const key = getSmokyTurretKey(spriteFaction, dir);
  return scene.textures.exists(key) ? key : null;
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
