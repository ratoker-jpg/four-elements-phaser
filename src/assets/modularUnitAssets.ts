import Phaser from 'phaser';
import type { Faction } from '../state/types';
import {
  bodyAngleToDir8,
  resolveGeneratedHullFaction,
  mapRuntimeDir8ToGeneratedDir16,
  applyHullVisualDir16Remap,
  type GeneratedHullDir16Index,
} from './generatedHullAssets';

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
 * FIX-OPUS-TURRET-VISUAL-01B: Reuse the already-calibrated generated-hull
 * visual direction convention to pick the turret sprite, instead of the raw
 * bodyAngleToDir8(turretAngle).
 *
 * The calibrated generated Wasp hull faces the iso-projected tile direction
 * (logical-East renders down-right, logical-South down-left, …) so it lines up
 * with the procedural barrel / aim line, which are computed in tile space. The
 * legacy Smoky turret 8-dir PNGs are authored in that same iso/legacy
 * convention. Selecting them with the raw direction (the first pass) renders
 * the turret a quarter-turn off: the barrel does not line up with the aim line
 * and is not parallel to the hull at rest.
 *
 * Applying the Wasp hull visual remap (applyHullVisualDir16Remap) maps the
 * logical direction to the visual direction the hull already uses. In the
 * 8-direction Smoky set this is the hull's +4 dir16 remap halved to a +2 dir8
 * offset — confirmed by the four exact cardinal sprite matches:
 *   logical NE → barrel points screen-right
 *   logical SE → barrel points screen-down
 *   logical SW → barrel points screen-left
 *   logical NW → barrel points screen-up
 * which are exactly the iso projections of those tile directions.
 *
 * The gameplay turretAngle stays the source of truth; only the visual sprite
 * key changes. Faction falls back to a valid sprite faction (cyan) when needed.
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

  // Logical 8-dir from the live turretAngle, then reuse the calibrated hull
  // visual remap so the turret matches the generated hull / iso aim line.
  const logicalDir8 = bodyAngleToDir8(turretAngle);
  const logicalDir16 = mapRuntimeDir8ToGeneratedDir16(logicalDir8) as GeneratedHullDir16Index;
  const visualDir16 = applyHullVisualDir16Remap('wasp', logicalDir16);
  // logicalDir16 is always even and the remap preserves parity, so the
  // halving back to the 8-dir Smoky set is exact.
  const visualDir8 = ((visualDir16 >> 1) % 8) as ModularDirection;

  const spriteFaction = resolveGeneratedHullFaction(faction);
  const key = getSmokyTurretKey(spriteFaction, visualDir8);
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
