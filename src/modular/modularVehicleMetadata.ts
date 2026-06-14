/**
 * modularVehicleMetadata — MODULAR-RUNTIME-01.
 *
 * Typed accessor over the generated socket/pivot metadata. Runtime never
 * reads JSON; it reads the committed generated constants. This module is
 * the single point where the composition layer asks "where is the hull
 * socket / turret pivot?" — answered from the export-derived metadata,
 * never from a hand-tuned offset table.
 */

import {
  MODULAR_HULL_SOCKET_META,
  MODULAR_TURRET_PIVOT_META,
  type ModularVehicleFamilyMeta,
  type ModularVehicleNormalizedAnchor,
} from '../assets/generatedModularVehicleMetadata.generated';
import type {
  ModularHullId,
  ModularTurretId,
  ModularModId,
} from './modularVehicleVisual';

export type { ModularVehicleNormalizedAnchor, ModularVehicleFamilyMeta };

/** Default fallback anchor when metadata is missing: frame centre. */
export const FALLBACK_FRAME_CENTER: ModularVehicleNormalizedAnchor = {
  nx: 0.5,
  ny: 0.5,
};

function resolveAnchor(
  meta: ModularVehicleFamilyMeta | undefined,
  dir16: number,
): ModularVehicleNormalizedAnchor | null {
  if (!meta) return null;
  const override = meta.perDir?.[String(dir16)];
  return override ?? meta.normalized;
}

/** Hull socket metadata for a hull+mod, or undefined if not exported. */
export function getHullSocketMeta(
  hullId: ModularHullId,
  hullMod: ModularModId,
): ModularVehicleFamilyMeta | undefined {
  return MODULAR_HULL_SOCKET_META[`${hullId}_${hullMod}`];
}

/** Turret pivot metadata for a turret+mod, or undefined if not exported. */
export function getTurretPivotMeta(
  turretId: ModularTurretId,
  turretMod: ModularModId,
): ModularVehicleFamilyMeta | undefined {
  return MODULAR_TURRET_PIVOT_META[`${turretId}_${turretMod}`];
}

/**
 * Hull socket normalized anchor for a given direction, or null if the
 * metadata is missing. Callers decide how to fall back (see composition).
 */
export function getHullSocketAnchor(
  hullId: ModularHullId,
  hullMod: ModularModId,
  dir16: number,
): ModularVehicleNormalizedAnchor | null {
  return resolveAnchor(getHullSocketMeta(hullId, hullMod), dir16);
}

/**
 * Turret pivot normalized anchor for a given direction, or null if the
 * metadata is missing.
 */
export function getTurretPivotAnchor(
  turretId: ModularTurretId,
  turretMod: ModularModId,
  dir16: number,
): ModularVehicleNormalizedAnchor | null {
  return resolveAnchor(getTurretPivotMeta(turretId, turretMod), dir16);
}
