/**
 * normalCombatToModularVisual — MODULAR-RUNTIME-03B mapper.
 *
 * Translates normal-runtime RenderableEntity (kind='modular-combat')
 * fields into a ModularVehicleVisual + dir16 values for the clean
 * modular rendering pipeline.
 *
 * Normal runtime entity state differs from BlockoutVehicleState:
 *   - `dir` / `turretDir` are 8-direction integers (0–7), not radians
 *   - `chassis` / `weapon` / `mod` come from ModularCombatUnit config,
 *     not from bodyId/weaponId/modificationLevel
 *   - `faction` is shared (Faction type)
 *
 * Mapping rules:
 *   chassis → hullId           (identity: wasp→wasp)
 *   weapon  → turretId         (smoky→smoky, vulcan→vulcan_b, …)
 *   faction → faction          (identity)
 *   mod     → hullMod/turretMod (m0→m0, m1→m1, …)
 *   dir (0–7) → hullDir16      (via dir8ToDir16)
 *   turretDir (0–7) → turretDir16 (via dir8ToDir16)
 *
 * This module is engine-agnostic and unit-testable without Phaser.
 * Reuses the 03A weapon→turret mapping and faction mapping helpers.
 */

import type { Faction } from '../state/types';
import type {
  GeneratedModularDir16,
} from '../assets/generatedModularVehicleAssets.generated';
import {
  bodyIdToModularHullId,
  weaponIdToModularTurretId,
  factionToModularFactionId,
} from './blockoutToModularVisual';
import type {
  ModularVehicleVisual,
  ModularModId,
} from './modularVehicleVisual';
import { modLevelToModularMod } from './modularVehicleVisual';

// ─── dir8 → dir16 conversion ────────────────────────────────────

/**
 * Convert an 8-direction integer (0–7) to a 16-direction index.
 *
 * dir8 0 = E  → dir16 0
 * dir8 1 = SE → dir16 2
 * dir8 2 = S  → dir16 4
 * dir8 3 = SW → dir16 6
 * dir8 4 = W  → dir16 8
 * dir8 5 = NW → dir16 10
 * dir8 6 = N  → dir16 12
 * dir8 7 = NE → dir16 14
 *
 * This matches the existing `mapRuntimeDir8ToGeneratedDir16()` convention.
 */
export function dir8ToDir16(dir8: number): GeneratedModularDir16 {
  const clamped = Math.max(0, Math.min(7, Math.round(dir8)));
  return (clamped * 2) as GeneratedModularDir16;
}

// ─── mod string → ModularModId ──────────────────────────────────

/**
 * Maps a mod string like 'm0'..'m3' to a ModularModId.
 * Returns 'm0' as safe default for unknown/missing values.
 */
export function modStringToModularMod(mod: string): ModularModId {
  if (mod === 'm0' || mod === 'm1' || mod === 'm2' || mod === 'm3') {
    return mod as ModularModId;
  }
  // Try extracting numeric level
  const match = mod.match(/^m?(\d)$/);
  if (match) {
    return modLevelToModularMod(parseInt(match[1], 10));
  }
  return 'm0'; // safe default
}

// ─── Full mapper result ─────────────────────────────────────────

export interface NormalCombatToModularResult {
  /** The resolved ModularVehicleVisual, or null when unmappable. */
  visual: ModularVehicleVisual | null;
  /** Hull dir16 derived from entity.dir. */
  hullDir16: GeneratedModularDir16;
  /** Turret dir16 derived from entity.turretDir or entity.dir. */
  turretDir16: GeneratedModularDir16;
  /** Why the mapping failed (null on success). */
  failReason: string | null;
}

// ─── Full mapper ────────────────────────────────────────────────

/**
 * Maps a normal-runtime modular-combat entity to modular rendering parameters.
 *
 * Accepts the same field names found on RenderableEntity + ModularCombatUnit.
 * When any mapping fails, returns null visual with a failReason.
 *
 * Unknown/missing values fallback safely:
 *   - dir defaults to 2 (S) if absent
 *   - turretDir defaults to dir if absent
 *   - mod defaults to 'm0' if absent
 *   - faction defaults to 'cyan' if absent (but will fail faction mapping
 *     if the faction value is not a recognised modular faction)
 */
export function normalCombatToModularVisual(args: {
  chassis: string;
  weapon: string;
  faction: Faction | string;
  mod?: string;
  dir?: number;
  turretDir?: number;
}): NormalCombatToModularResult {
  const dir8 = args.dir ?? 2;
  const turretDir8 = args.turretDir ?? dir8;

  const hullDir16 = dir8ToDir16(dir8);
  const turretDir16 = dir8ToDir16(turretDir8);

  // chassis → hullId (reuse 03A bodyId→hullId mapping)
  const hullId = bodyIdToModularHullId(args.chassis as any);
  if (!hullId) {
    return {
      visual: null,
      hullDir16,
      turretDir16,
      failReason: `no modular hull for chassis=${args.chassis}`,
    };
  }

  // weapon → turretId (reuse 03A weaponId→turretId mapping)
  const turretId = weaponIdToModularTurretId(args.weapon as any);
  if (!turretId) {
    return {
      visual: null,
      hullDir16,
      turretDir16,
      failReason: `no modular turret for weapon=${args.weapon}`,
    };
  }

  // faction → modular faction (reuse 03A faction mapping)
  const factionId = factionToModularFactionId(args.faction as Faction);
  if (!factionId) {
    return {
      visual: null,
      hullDir16,
      turretDir16,
      failReason: `no modular faction for faction=${args.faction}`,
    };
  }

  // mod → ModularModId (safe m0 default)
  const hullMod = modStringToModularMod(args.mod ?? 'm0');
  const turretMod = modStringToModularMod(args.mod ?? 'm0');

  return {
    visual: {
      hullId,
      turretId,
      faction: factionId,
      hullMod,
      turretMod,
    },
    hullDir16,
    turretDir16,
    failReason: null,
  };
}
