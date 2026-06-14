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
 * Composition formula (pivot-on-socket):
 *   1. Resolve hull visual profile → hull texture scale, origin, sockets
 *   2. Resolve hull socket metadata → socket normalized position
 *   3. Resolve turret visual profile → turret texture scale, mountSocketId
 *   4. Resolve directional turret pivot for dir16 → pivot normalized position
 *   5. Compute hull socket screen point:
 *        hullSocketPx.x = (socket.nx - hullOrigin.x) * hullDisplayWidthPx
 *        hullSocketPx.y = (socket.ny - hullOrigin.y) * hullDisplayHeightPx
 *      This is the offset from the hull sprite's top-left corner to the
 *      socket point in screen pixels, using the hull origin as the reference.
 *   6. Compute turret center-to-pivot offset:
 *        turretPivotPx.x = (pivot.x - 0.5) * turretDisplayWidthPx
 *        turretPivotPx.y = (pivot.y - 0.5) * turretDisplayHeightPx
 *      This is the offset from the turret sprite's center to the pivot point,
 *      given that the Phaser sprite origin is always (0.5, 0.5).
 *   7. Place turret sprite center so turret pivot lands on hull socket:
 *        turretOffset.x = hullSocketPx.x - turretPivotPx.x
 *        turretOffset.y = hullSocketPx.y - turretPivotPx.y
 *      This offset is added to the hull sprite position to get the turret
 *      sprite position.
 *
 *   The Phaser sprite origin for the turret is always (0.5, 0.5).
 *   The attachment math produces a pixel offset — it does NOT re-originate
 *   the sprite. This follows the PR-E1/PR-B contract exactly.
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
  type DirectionalPoint2D,
} from '../config/directionalTurretProfiles';
import {
  type PixelOffset,
} from '../config/turretAttachmentMath';

import type { Faction } from '../state/types';

// ─── Source image size constant ──────────────────────────────────

/** Generated turret sprites are 512x512 RGBA (same as hulls). */
const TURRET_SOURCE_SIZE = 512;

/** Generated hull sprites are 512x512 RGBA. */
const HULL_SOURCE_SIZE = 512;

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
  /** The resolved turret dir16 index, for diagnostics. */
  dir16: GeneratedTurretDir16Index;
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

  // ── Step 4: Resolve turret direction ──
  const dir16 = turretAngleToDir16(turretAngle);

  // ── Step 5: Resolve directional turret pivot ──
  const pivotNorm: DirectionalPoint2D | null = resolveTurretPivotForDir(
    weaponId, modificationLevel, dir16,
  );
  if (!pivotNorm) {
    return makeFallbackResult(dir16);
  }

  // ── Step 6: Compute display sizes ──
  const hullTextureScale = hullProfile.textureScale;
  const hullDisplayWidthPx = HULL_SOURCE_SIZE * hullTextureScale;
  const hullDisplayHeightPx = HULL_SOURCE_SIZE * hullTextureScale;

  // Turret texture scale: from turret visual profile or fallback to GENERATED_TURRET_SCALE
  // The turret visual profile stores legacy MODULAR_RENDER_SCALE (0.24), but
  // generated turret sprites use GENERATED_TURRET_SCALE (0.12). Use the
  // generated scale since we're composing generated turret sprites.
  const turretTextureScale = turretProfile?.textureScale ?? 0.12;
  const turretDisplayWidthPx = TURRET_SOURCE_SIZE * turretTextureScale;
  const turretDisplayHeightPx = TURRET_SOURCE_SIZE * turretTextureScale;

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

  // ── Step 8: Check texture existence ──
  const turretFaction = resolveGeneratedTurretFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);
  const turretKey = getGeneratedTurretTextureKey(turretId, turretFaction, mod, dir16);

  // Single textureExists probe — no preloading
  if (!textureExists(turretKey)) {
    return {
      turretKey: null,
      scale: turretTextureScale,
      originX: 0.5,
      originY: 0.5,
      hasGeneratedTurret: false,
      dir16,
      turretOffsetPx,
    };
  }

  return {
    turretKey,
    scale: turretTextureScale,
    originX: 0.5,
    originY: 0.5,
    hasGeneratedTurret: true,
    dir16,
    turretOffsetPx,
  };
}

// ─── Fallback helper ─────────────────────────────────────────────

/** Create a fallback result when composition cannot be resolved. */
function makeFallbackResult(dir16: GeneratedTurretDir16Index): PilotTurretCompositionResult {
  return {
    turretKey: null,
    scale: 0.12,
    originX: 0.5,
    originY: 0.5,
    hasGeneratedTurret: false,
    dir16,
    turretOffsetPx: null,
  };
}
