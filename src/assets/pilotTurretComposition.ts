/**
 * Pilot turret composition resolver.
 *
 * RUNTIME-03: Pure composition resolver for placing a generated turret
 * sprite on top of a generated hull sprite. This module has NO Phaser
 * imports and NO asset loading side effects.
 *
 * Architecture:
 *   - Pure function: takes vehicle params + textureExists callback,
 *     returns placement result or null
 *   - Renderer owns Phaser.Image creation/destruction
 *   - Resolver uses textureExists callback only (no scene reference)
 *   - No asset load side effects
 *   - No manual per-dir pixel offset table
 *   - Fallback to procedural turret if texture/metadata/hull is missing
 *
 * Composition formula:
 *   The turret sprite is placed at the same screen position as the hull
 *   sprite center (vehicle world position + offset). This works because
 *   both hull and turret are 512x512 sprites rendered at the same scale,
 *   and the turret's visual center within the sprite aligns with the
 *   mount point at the default scale.
 *
 *   Turret direction is independent of hull direction: turrets use the
 *   full 16-direction set quantized from turretAngle, while hulls use
 *   8 directions doubled to 16 with per-hull visual remap.
 *
 *   socket.zHeight: NOT used. The turret sprite is placed at the same
 *   screen Y as the hull sprite, which is a flat ground-plane placement.
 *   This is explicitly deferred as visual QA risk — the turret may
 *   appear to sit at ground level rather than on top of the hull body.
 *   When zHeight-based turret placement is validated, this can be
 *   upgraded to use projectWorldPoint with BLOCKOUT_VEHICLE_BODY_Z.
 */

import {
  weaponIdToTurretId,
  turretAngleToDir16,
  getGeneratedTurretTextureKey,
  resolveGeneratedTurretFaction,
  GENERATED_TURRET_SCALE,
  GENERATED_TURRET_ORIGIN_X,
  GENERATED_TURRET_ORIGIN_Y,
  type GeneratedTurretDir16Index,
  type GeneratedTurretId,
} from './generatedTurretAssets';
import {
  bodyIdToGeneratedHullId,
  modificationLevelToMod,
} from './generatedHullAssets';
import type { Faction } from '../state/types';

// ─── Composition result ─────────────────────────────────────────

/**
 * Result of a pilot turret composition resolution.
 *
 * Contains the texture key and render parameters for the turret sprite,
 * or null fields if no generated turret is available.
 */
export interface PilotTurretCompositionResult {
  /** Generated turret texture key, or null if not available. */
  turretKey: string | null;
  /** Turret render scale (matches GENERATED_TURRET_SCALE). */
  scale: number;
  /** Turret sprite origin X. */
  originX: number;
  /** Turret sprite origin Y. */
  originY: number;
  /** Whether a generated turret sprite is available for this vehicle. */
  hasGeneratedTurret: boolean;
  /** The resolved turret dir16 index, for diagnostics. */
  dir16: GeneratedTurretDir16Index;
}

// ─── Composition resolver ───────────────────────────────────────

/**
 * Resolve the pilot turret composition for a vehicle.
 *
 * This is a pure function: given the vehicle's weapon/body/faction/mod
 * parameters, the current turret angle, and a textureExists callback,
 * it returns the texture key and render parameters for the turret sprite.
 *
 * Returns null turretKey and hasGeneratedTurret=false when:
 *   - The weapon has no generated turret assets (e.g. 'shaft')
 *   - The body is not a supported hull (e.g. unknown bodyId)
 *   - The turret texture for the resolved direction does not exist
 *
 * The textureExists callback is the ONLY way this function checks for
 * texture availability. It does NOT load assets, does NOT reference the
 * Phaser scene, and does NOT probe the TextureManager directly.
 *
 * @param weaponId - Runtime weapon ID (e.g. 'smoky', 'flamethrower')
 * @param bodyId - Runtime body ID (e.g. 'wasp', 'hornet')
 * @param faction - Faction colour variant
 * @param modificationLevel - Turret modification level (0-3)
 * @param turretAngle - Current turret angle in radians (screen-space)
 * @param textureExists - Callback: (key: string) => boolean
 * @returns Composition result with turretKey and render params
 */
export function resolvePilotTurretComposition(
  weaponId: string,
  bodyId: string,
  faction: Faction,
  modificationLevel: number,
  turretAngle: number,
  textureExists: (key: string) => boolean,
): PilotTurretCompositionResult {
  // Check weapon support
  const turretId: GeneratedTurretId | null = weaponIdToTurretId(weaponId);
  if (!turretId) {
    return {
      turretKey: null,
      scale: GENERATED_TURRET_SCALE,
      originX: GENERATED_TURRET_ORIGIN_X,
      originY: GENERATED_TURRET_ORIGIN_Y,
      hasGeneratedTurret: false,
      dir16: 0,
    };
  }

  // Check body support — turret composition requires a generated hull
  const hullId = bodyIdToGeneratedHullId(bodyId);
  if (!hullId) {
    return {
      turretKey: null,
      scale: GENERATED_TURRET_SCALE,
      originX: GENERATED_TURRET_ORIGIN_X,
      originY: GENERATED_TURRET_ORIGIN_Y,
      hasGeneratedTurret: false,
      dir16: 0,
    };
  }

  // Resolve turret direction
  const dir16 = turretAngleToDir16(turretAngle);

  // Resolve turret faction and mod
  const turretFaction = resolveGeneratedTurretFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);

  // Build texture key
  const turretKey = getGeneratedTurretTextureKey(turretId, turretFaction, mod, dir16);

  // Single textureExists probe — no preloading
  if (!textureExists(turretKey)) {
    return {
      turretKey: null,
      scale: GENERATED_TURRET_SCALE,
      originX: GENERATED_TURRET_ORIGIN_X,
      originY: GENERATED_TURRET_ORIGIN_Y,
      hasGeneratedTurret: false,
      dir16,
    };
  }

  return {
    turretKey,
    scale: GENERATED_TURRET_SCALE,
    originX: GENERATED_TURRET_ORIGIN_X,
    originY: GENERATED_TURRET_ORIGIN_Y,
    hasGeneratedTurret: true,
    dir16,
  };
}
