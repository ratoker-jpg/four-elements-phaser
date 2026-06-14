/**
 * ModularVehicleVisual — MODULAR-RUNTIME-01 runtime visual descriptor.
 *
 * This is the single typed model for a hybrid modular vehicle visual.
 * Hull and turret are fully independent: hullId/turretId choose the
 * sprite families, hullMod/turretMod choose the mod tier per family.
 *
 *   - upgrading hullMod changes only the hull sprite;
 *   - upgrading turretMod changes only the turret sprite;
 *   - changing turretId never forces a hullId change (and vice-versa).
 *
 * Wasp + Smoky cyan m0 is a convenient DEFAULT demo selection, but it is
 * NOT hardcoded as architecture: any hull/turret/mod combination is valid.
 *
 * REJECTED: combined-pair encodings such as "wasp_smoky_cyan_m0". The
 * `isCombinedPairId` guard exists to catch accidental reintroduction.
 */

import {
  GENERATED_MODULAR_HULLS,
  GENERATED_MODULAR_TURRETS,
  GENERATED_MODULAR_FACTIONS,
  GENERATED_MODULAR_MODS,
  type GeneratedModularHullId,
  type GeneratedModularTurretId,
  type GeneratedModularFactionId,
  type GeneratedModularModId,
} from '../assets/generatedModularVehicleAssets.generated';

export type ModularHullId = GeneratedModularHullId;
export type ModularTurretId = GeneratedModularTurretId;
export type ModularFactionId = GeneratedModularFactionId;
export type ModularModId = GeneratedModularModId;

/**
 * A hybrid modular vehicle visual. Hull and turret identity and mod tier
 * are independent dimensions; nothing here couples them.
 */
export interface ModularVehicleVisual {
  hullId: ModularHullId;
  turretId: ModularTurretId;
  faction: ModularFactionId;
  hullMod: ModularModId;
  turretMod: ModularModId;
}

/** Default demo selection. A convenient starting point, not architecture. */
export const DEFAULT_MODULAR_VEHICLE_VISUAL: ModularVehicleVisual = {
  hullId: 'wasp',
  turretId: 'smoky',
  faction: 'cyan',
  hullMod: 'm0',
  turretMod: 'm0',
};

export const MODULAR_HULL_IDS = GENERATED_MODULAR_HULLS;
export const MODULAR_TURRET_IDS = GENERATED_MODULAR_TURRETS;
export const MODULAR_FACTION_IDS = GENERATED_MODULAR_FACTIONS;
export const MODULAR_MOD_IDS = GENERATED_MODULAR_MODS;

export function isModularHullId(value: string): value is ModularHullId {
  return (GENERATED_MODULAR_HULLS as readonly string[]).includes(value);
}

export function isModularTurretId(value: string): value is ModularTurretId {
  return (GENERATED_MODULAR_TURRETS as readonly string[]).includes(value);
}

export function isModularFactionId(value: string): value is ModularFactionId {
  return (GENERATED_MODULAR_FACTIONS as readonly string[]).includes(value);
}

export function isModularModId(value: string): value is ModularModId {
  return (GENERATED_MODULAR_MODS as readonly string[]).includes(value);
}

/** True if every field of the visual is a recognised modular id. */
export function isValidModularVehicleVisual(
  visual: ModularVehicleVisual,
): boolean {
  return (
    isModularHullId(visual.hullId) &&
    isModularTurretId(visual.turretId) &&
    isModularFactionId(visual.faction) &&
    isModularModId(visual.hullMod) &&
    isModularModId(visual.turretMod)
  );
}

/**
 * Guard against the rejected combined hull×turret production matrix
 * encoding. A combined-pair id glues a hull id and a turret id together
 * (e.g. "wasp_smoky_cyan_m0"). Returns true if `value` looks like one.
 */
export function isCombinedPairId(value: string): boolean {
  for (const hullId of MODULAR_HULL_IDS) {
    for (const turretId of MODULAR_TURRET_IDS) {
      if (value.startsWith(`${hullId}_${turretId}_`)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Clamp a numeric modification level (0..3) to a modular mod id.
 * Shared helper so hull and turret mods can be derived independently.
 */
export function modLevelToModularMod(level: number): ModularModId {
  const clamped = Math.max(0, Math.min(3, Math.round(level)));
  return (`m${clamped}`) as ModularModId;
}

/**
 * Produce a new visual with an upgraded hull mod ONLY. Turret is untouched.
 */
export function withHullMod(
  visual: ModularVehicleVisual,
  hullMod: ModularModId,
): ModularVehicleVisual {
  return { ...visual, hullMod };
}

/**
 * Produce a new visual with an upgraded turret mod ONLY. Hull is untouched.
 */
export function withTurretMod(
  visual: ModularVehicleVisual,
  turretMod: ModularModId,
): ModularVehicleVisual {
  return { ...visual, turretMod };
}

/**
 * A stable, human-readable id for diagnostics/cache-keying. This is NOT a
 * combined-pair asset id — it is a debug label only and is never used to
 * address a baked hull×turret texture.
 */
export function modularVisualDebugLabel(visual: ModularVehicleVisual): string {
  return `hull:${visual.hullId}/${visual.hullMod} turret:${visual.turretId}/${visual.turretMod} faction:${visual.faction}`;
}
