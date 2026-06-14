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
 * Composition formula (pivot-on-socket with visual direction remap):
 *   1. Resolve hull visual profile → hull texture scale, origin, sockets
 *   2. Resolve hull socket metadata → socket normalized position
 *   3. Resolve turret visual profile → turret direction metadata, mountSocketId
 *   4. Compute visual direction remap:
 *        logicalDir16 = turretAngleToDir16(turretAngle)
 *        dir16Offset = turretProfile.direction.facingOffset * (16 / turretProfile.direction.dirCount)
 *        visualDir16 = (logicalDir16 + dir16Offset) mod 16
 *      For Smoky: dir8/facingOffset=2 → dir16Offset=4
 *      So logical dir16 0 (E) → visual dir16 4 (S)
 *   5. Resolve directional turret pivot for visualDir16 → pivot normalized position
 *   6. Compute hull socket screen point:
 *        hullSocketPx.x = (socket.nx - hullOrigin.x) * hullDisplayWidthPx
 *        hullSocketPx.y = (socket.ny - hullOrigin.y) * hullDisplayHeightPx
 *   7. Compute turret center-to-pivot offset:
 *        turretPivotPx.x = (pivot.x - 0.5) * turretDisplayWidthPx
 *        turretPivotPx.y = (pivot.y - 0.5) * turretDisplayHeightPx
 *   8. Place turret sprite center so turret pivot lands on hull socket:
 *        turretOffset.x = hullSocketPx.x - turretPivotPx.x
 *        turretOffset.y = hullSocketPx.y - turretPivotPx.y
 *
 *   The Phaser sprite origin for the turret is always (0.5, 0.5).
 *   The attachment math produces a pixel offset — it does NOT re-originate
 *   the sprite. This follows the PR-E1/PR-B contract exactly.
 *
 *   visualDir16 is used for BOTH the texture key lookup and the pivot
 *   resolution, ensuring the sprite and its attachment data correspond
 *   to the same authored direction.
 *
 *   socket.zHeight: NOT used for sprite Y placement. The turret sprite
 *   is placed at ground-plane screen Y (same as hull center). This is
 *   explicitly deferred as visual QA risk — the turret may appear to
 *   sit at ground level rather than on top of the hull body.
 */

import {
  weaponIdToTurretId,
  turretAngleToDir16,
  getGeneratedTurretTextureKey,
  resolveGeneratedTurretFaction,
  GENERATED_TURRET_SCALE,
  type GeneratedTurretDir16Index,
  type GeneratedTurretId,
} from './generatedTurretAssets';
import {
  bodyIdToGeneratedHullId,
  modificationLevelToMod,
} from './generatedHullAssets';
import {
  resolveHullVisualProfile,
  resolveSocketMetadata,
  resolveTurretVisualProfile,
} from '../config/hullTurretVisualProfiles';
import {
  resolveTurretPivotForDir,
  normalizeDir16,
  type DirectionalPoint2D,
} from '../config/directionalTurretProfiles';
import {
  type PixelOffset,
} from '../config/turretAttachmentMath';
import {
  HULL_IMAGE_SIZE,
  TURRET_IMAGE_SIZE,
} from './generatedVehicleMetadata';

import type { Faction } from '../state/types';

// ─── Composition result ─────────────────────────────────────────

/**
 * Result of a pilot turret composition resolution.
 *
 * Contains the texture key, render parameters, and the computed
 * turret-to-hull offset for placing the turret sprite so its pivot
 * lands on the hull socket.
 */
export interface PilotTurretCompositionResult {
  /** Generated turret texture key, or null if not available. */
  turretKey: string | null;
  /** Turret render scale (from turret visual profile or GENERATED_TURRET_SCALE fallback). */
  scale: number;
  /** Turret sprite origin X — always 0.5 (centered). */
  originX: number;
  /** Turret sprite origin Y — always 0.5 (centered). */
  originY: number;
  /** Whether a generated turret sprite is available for this vehicle. */
  hasGeneratedTurret: boolean;
  /** The resolved logical dir16 index (from turretAngleToDir16), for diagnostics. */
  logicalDir16: GeneratedTurretDir16Index;
  /** The visual dir16 index (after applying turret profile direction remap). */
  visualDir16: GeneratedTurretDir16Index;
  /**
   * Pixel offset from hull sprite center to turret sprite center,
   * computed so that the turret pivot lands on the hull socket.
   * null if the composition could not be computed (missing socket/pivot).
   */
  turretOffsetPx: PixelOffset | null;
}

// ─── Composition resolver ───────────────────────────────────────

/**
 * Resolve the pilot turret composition for a vehicle.
 *
 * This is a pure function: given the vehicle's weapon/body/faction/mod
 * parameters, the current turret angle, and a textureExists callback,
 * it returns the texture key, render parameters, and pixel offset for
 * the turret sprite placement.
 *
 * Composition formula:
 *   1. Resolve hull profile → socket → socket screen point
 *   2. Resolve turret profile → directional pivot for dir16
 *   3. Compute offset: turret center = hull center + (socket - pivot)
 *
 * Returns null turretKey and hasGeneratedTurret=false when:
 *   - The weapon has no generated turret assets (e.g. 'shaft')
 *   - The body is not a supported hull (e.g. unknown bodyId)
 *   - The hull has no socket metadata (e.g. no turret_main socket)
 *   - The turret has no directional pivot metadata
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
 * @returns Composition result with turretKey, render params, and offset
 */
export function resolvePilotTurretComposition(
  weaponId: string,
  bodyId: string,
  faction: Faction,
  modificationLevel: number,
  turretAngle: number,
  textureExists: (key: string) => boolean,
): PilotTurretCompositionResult {
  // ── Step 1: Check weapon support ──
  const turretId: GeneratedTurretId | null = weaponIdToTurretId(weaponId);
  if (!turretId) {
    return makeFallbackResult(0);
  }

  // ── Step 2: Check body support — turret composition requires a generated hull ──
  const hullId = bodyIdToGeneratedHullId(bodyId);
  if (!hullId) {
    return makeFallbackResult(0);
  }

  // ── Step 3: Resolve hull visual profile and socket metadata ──
  const hullProfile = resolveHullVisualProfile(hullId);
  if (!hullProfile) {
    return makeFallbackResult(0);
  }

  // Find the socket this turret mounts to
  const turretProfile = resolveTurretVisualProfile(weaponId);
  const socketId = turretProfile?.mountSocketId ?? 'turret_main';
  const socket = resolveSocketMetadata(hullProfile, socketId);
  if (!socket) {
    return makeFallbackResult(0);
  }

  // ── Step 4: Resolve turret direction with visual direction remap ──
  // Logical dir16 from the turret angle (raw quantization)
  const logicalDir16 = turretAngleToDir16(turretAngle);

  // Apply turret visual profile direction remap:
  //   The turret profile declares { dirCount, facingOffset } which describes
  //   how the authored sprite directions map to logical directions.
  //   Convert the profile offset to dir16 space:
  //     dir16Offset = facingOffset * (16 / dirCount)
  //   For Smoky: dir8/facingOffset=2 → dir16Offset = 2 * (16/8) = 4
  //   So logical dir16 0 (E) → visual dir16 4 (S)
  //
  //   visualDir16 is used for BOTH the texture key lookup AND the pivot
  //   resolution, ensuring the sprite and attachment data correspond to
  //   the same authored direction.
  let visualDir16: GeneratedTurretDir16Index = logicalDir16;
  if (turretProfile) {
    const { dirCount, facingOffset } = turretProfile.direction;
    const dir16Offset = facingOffset * (16 / dirCount);
    visualDir16 = normalizeDir16(logicalDir16 + dir16Offset) as GeneratedTurretDir16Index;
  }

  // ── Step 5: Resolve directional turret pivot for visual dir16 ──
  const pivotNorm: DirectionalPoint2D | null = resolveTurretPivotForDir(
    weaponId, modificationLevel, visualDir16,
  );
  if (!pivotNorm) {
    return makeFallbackResult(logicalDir16, visualDir16);
  }

  // ── Step 6: Compute display sizes ──
  const hullTextureScale = hullProfile.textureScale;
  const hullDisplayWidthPx = HULL_IMAGE_SIZE.width * hullTextureScale;
  const hullDisplayHeightPx = HULL_IMAGE_SIZE.height * hullTextureScale;

  // Generated turret sprites use GENERATED_TURRET_SCALE (0.12), NOT the
  // legacy turretProfile.textureScale (0.24 = MODULAR_RENDER_SCALE).
  // The legacy scale is for old-style procedural/texture-atlas turrets.
  // Generated sprites are 512×512 at 0.12, same scale regime as hulls.
  const turretDisplayWidthPx = TURRET_IMAGE_SIZE.width * GENERATED_TURRET_SCALE;
  const turretDisplayHeightPx = TURRET_IMAGE_SIZE.height * GENERATED_TURRET_SCALE;

  // ── Step 7: Compute hull socket screen point ──
  // The socket is in normalized hull coordinates where (0.5, 0.5) = hull center.
  // The hull sprite origin is at (originX, originY) — typically (0.5, 0.75).
  // The offset from hull sprite position to the socket is:
  //   socketOffsetFromSprite.x = (socket.nx - hullOrigin.x) * hullDisplayWidthPx
  //   socketOffsetFromSprite.y = (socket.ny - hullOrigin.y) * hullDisplayHeightPx
  // But since the Phaser sprite position IS the origin point, and the turret
  // sprite origin is (0.5, 0.5), we need the offset from hull sprite center
  // (not from the hull origin position) to the socket.
  //
  // Hull sprite center is at: hullSpritePos + (0.5 - hullOrigin) * hullDisplaySize
  // Socket in screen space relative to hull sprite pos:
  //   socketFromHullSpritePos.x = (socket.nx - hullOrigin.x) * hullDisplayWidthPx
  //   socketFromHullSpritePos.y = (socket.ny - hullOrigin.y) * hullDisplayHeightPx
  //
  // Turret sprite center is at: turretSpritePos + 0 (since origin is 0.5, 0.5)
  // Turret pivot in screen space relative to turret sprite center:
  //   pivotFromTurretCenter.x = (pivot.x - 0.5) * turretDisplayWidthPx
  //   pivotFromTurretCenter.y = (pivot.y - 0.5) * turretDisplayHeightPx
  //
  // We want: turretSpritePos + pivotFromTurretCenter = hullSpritePos + socketFromHullSpritePos
  // Therefore: turretSpritePos = hullSpritePos + socketFromHullSpritePos - pivotFromTurretCenter
  //   turretOffsetPx = socketFromHullSpritePos - pivotFromTurretCenter

  // Socket offset from hull sprite position (where hull sprite pos = origin anchor)
  const socketFromHullSpritePos: PixelOffset = {
    x: (socket.normalized.nx - hullProfile.origin.x) * hullDisplayWidthPx,
    y: (socket.normalized.ny - hullProfile.origin.y) * hullDisplayHeightPx,
  };

  // Pivot offset from turret sprite center
  const pivotFromTurretCenter: PixelOffset = {
    x: (pivotNorm.x - 0.5) * turretDisplayWidthPx,
    y: (pivotNorm.y - 0.5) * turretDisplayHeightPx,
  };

  // Final offset: place turret center so pivot lands on socket
  const turretOffsetPx: PixelOffset = {
    x: socketFromHullSpritePos.x - pivotFromTurretCenter.x,
    y: socketFromHullSpritePos.y - pivotFromTurretCenter.y,
  };

  // ── Step 8: Check texture existence (using visualDir16) ──
  const turretFaction = resolveGeneratedTurretFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);
  const turretKey = getGeneratedTurretTextureKey(turretId, turretFaction, mod, visualDir16);

  // Single textureExists probe — no preloading
  if (!textureExists(turretKey)) {
    return {
      turretKey: null,
      scale: GENERATED_TURRET_SCALE,
      originX: 0.5,
      originY: 0.5,
      hasGeneratedTurret: false,
      logicalDir16,
      visualDir16,
      turretOffsetPx,
    };
  }

  return {
    turretKey,
    scale: GENERATED_TURRET_SCALE,
    originX: 0.5,
    originY: 0.5,
    hasGeneratedTurret: true,
    logicalDir16,
    visualDir16,
    turretOffsetPx,
  };
}

// ─── Fallback helper ─────────────────────────────────────────────

/** Create a fallback result when composition cannot be resolved. */
function makeFallbackResult(
  logicalDir16: GeneratedTurretDir16Index,
  visualDir16?: GeneratedTurretDir16Index,
): PilotTurretCompositionResult {
  return {
    turretKey: null,
    scale: GENERATED_TURRET_SCALE,
    originX: 0.5,
    originY: 0.5,
    hasGeneratedTurret: false,
    logicalDir16,
    visualDir16: visualDir16 ?? logicalDir16,
    turretOffsetPx: null,
  };
}
