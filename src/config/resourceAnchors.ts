/**
 * Resource anchor placement — deterministic anchor-based resource layout.
 *
 * CORE-STEP-03B: Provides pure helpers that compute deterministic anchor
 * positions for the accepted 6-class resource model on generated maps.
 *
 * Instead of random scatter, resource placement uses fixed anchor points
 * computed from map dimensions and HQ position. Small controlled variation
 * around anchors is allowed via PRNG, but variation is bounded so the same
 * seed + size always produces the same resource positions.
 *
 * Accepted resource classes: very_poor, poor, medium, rich, very_rich, infinite
 *
 * Placement model:
 * - Starter zone (near HQ): very_poor, poor, medium
 * - Side/intermediate zone: medium, rich
 * - Contested/far zone: rich, very_rich
 * - Center: infinite 2x2 deposit
 *
 * Legacy type compatibility:
 * - very_poor -> small
 * - poor -> small
 * - medium -> medium
 * - rich -> large
 * - very_rich -> large
 * - infinite -> infinite
 *
 * Design rules:
 * - All helpers are pure functions with no side effects
 * - Anchors are parameterized by map dimensions, not hardcoded for specific sizes
 * - Variation never moves starter resources outside the early zone
 * - Variation never moves center infinite away from center
 * - Variation never creates overlaps or out-of-bounds positions
 * - If variation candidate is blocked, fallback to exact anchor position
 */

import type { AcceptedResourceClassId } from './coreMechanicsTypes';
import type { ResourceType } from '../state/types';
import { RESOURCE_CLASS_CONFIGS } from './resourceClassData';

// ─── Types ──────────────────────────────────────────────────────────

/** A resource anchor — a fixed reference point for resource placement. */
export interface ResourceAnchor {
  /** Reference tile X position. */
  tx: number;
  /** Reference tile Y position. */
  ty: number;
  /** Resource class to place at this anchor. */
  resourceClass: AcceptedResourceClassId;
  /** Placement zone for validation. */
  zone: 'starter' | 'side' | 'contested' | 'center';
  /** Maximum variation radius in tiles (0 = no variation). */
  variationRadius: number;
  /** Whether this anchor is mandatory (always placed even if overlap). */
  mandatory: boolean;
}

/** A resolved resource placement after anchor + variation. */
export interface ResolvedAnchorPlacement {
  /** Final tile X position. */
  tx: number;
  /** Final tile Y position. */
  ty: number;
  /** Resource class ID. */
  resourceClass: AcceptedResourceClassId;
  /** Footprint size from resource class config. */
  footprint: number;
  /** Legacy ResourceType for harvester/render compatibility. */
  legacyType: ResourceType;
}

// ─── Legacy type mapping ────────────────────────────────────────────

/**
 * Map an AcceptedResourceClassId to the closest legacy ResourceType.
 *
 * This mapping is for harvester/render compatibility only.
 * The source of truth for the new model is resourceClass.
 *
 * Mapping rationale:
 * - very_poor -> small (smallest tier, minimal deposit)
 * - poor -> small (second smallest, still a starter-level deposit)
 * - medium -> medium (standard deposit, matches legacy medium)
 * - rich -> large (high-value, contested zone)
 * - very_rich -> large (premium contested, still uses large type)
 * - infinite -> infinite (center, never depletes)
 */
export const RESOURCE_CLASS_TO_LEGACY_TYPE: Record<AcceptedResourceClassId, ResourceType> = {
  very_poor: 'small',
  poor: 'small',
  medium: 'medium',
  rich: 'large',
  very_rich: 'large',
  infinite: 'infinite',
};

/**
 * Resolve an AcceptedResourceClassId to its legacy ResourceType.
 */
export function resolveAnchorResourceType(resourceClass: AcceptedResourceClassId): ResourceType {
  return RESOURCE_CLASS_TO_LEGACY_TYPE[resourceClass];
}

// ─── Anchor computation ─────────────────────────────────────────────

/**
 * Compute resource anchors for a map of given dimensions.
 *
 * Anchors are computed from W, H, and HQ position. They are NOT
 * hardcoded for specific map sizes. The algorithm uses proportional
 * offsets relative to map dimensions.
 *
 * Anchor layout strategy:
 * 1. Starter zone: resources placed NE of HQ (toward map center)
 *    - 2 very_poor + 2 poor + 1 medium for reliable early game
 * 2. Side zone: resources at ~30-50% of the way from HQ to center
 *    - medium and rich deposits
 * 3. Contested zone: resources at ~50-80% of the way from HQ to center
 *    - rich and very_rich deposits
 * 4. Center: exactly one infinite 2x2 deposit
 *
 * Number of anchors scales with map size.
 */
export function getResourceAnchors(
  W: number,
  H: number,
  hq: { tx: number; ty: number },
): ResourceAnchor[] {
  const anchors: ResourceAnchor[] = [];

  const hqCenterX = hq.tx + 1;
  const hqCenterY = hq.ty + 1;
  const centerX = Math.floor(W / 2);
  const centerY = Math.floor(H / 2);

  // Distance from HQ to map center
  const dxToCenter = centerX - hqCenterX;
  const dyToCenter = centerY - hqCenterY;

  // ── 1. Starter zone anchors (near HQ, toward center) ──
  // Placed NE of HQ at small offsets — these are mandatory
  // and have zero variation to guarantee starter resources exist.

  const starterOffsets: Array<{ dx: number; dy: number; cls: AcceptedResourceClassId }> = [
    // Row 1: closest to HQ (very_poor)
    { dx: 4, dy: -3, cls: 'very_poor' },
    { dx: 6, dy: -3, cls: 'very_poor' },
    // Row 2: second ring (poor)
    { dx: 5, dy: -5, cls: 'poor' },
    { dx: 7, dy: -5, cls: 'poor' },
    // Row 3: starter medium
    { dx: 6, dy: -7, cls: 'medium' },
  ];

  const starterDirectionX = Math.sign(dxToCenter) || 1;
  const starterDirectionY = Math.sign(dyToCenter) || -1;
  for (const off of starterOffsets) {
    // The accepted offsets were authored for the south-west start. Convert
    // them to center-relative magnitudes and orient them toward the map center
    // so every selected corner remains in bounds before P5B mirrors all zones.
    const relativeX = Math.abs(off.dx - 1) * starterDirectionX;
    const relativeY = Math.abs(off.dy - 1) * starterDirectionY;
    anchors.push({
      tx: hqCenterX + relativeX,
      ty: hqCenterY + relativeY,
      resourceClass: off.cls,
      zone: 'starter',
      variationRadius: 0, // No variation for starter — must be reliable
      mandatory: true,
    });
  }

  // ── 2. Side/intermediate zone anchors ──
  // At ~30-50% of the way from HQ to center.
  // These use proportional offsets from HQ toward center.

  // Number of side anchors scales with map size
  const sideAnchorCount = W <= 32 ? 3 : W <= 48 ? 5 : 7;

  // Proportional positions along the HQ→center axis
  const sideProportions = [0.30, 0.35, 0.40, 0.45, 0.50, 0.45, 0.40];

  const sideClasses: AcceptedResourceClassId[] = ['medium', 'rich', 'medium', 'rich', 'medium', 'rich', 'medium'];

  for (let i = 0; i < sideAnchorCount; i++) {
    const proportion = sideProportions[i % sideProportions.length];
    // Spread anchors laterally (perpendicular to HQ→center line)
    // Alternate between north and south of the HQ→center axis
    const lateralOffset = (i % 2 === 0 ? -1 : 1) * (2 + (i % 3));

    const baseX = Math.round(hqCenterX + dxToCenter * proportion);
    const baseY = Math.round(hqCenterY + dyToCenter * proportion);

    // Apply lateral offset: perpendicular direction to the HQ→center line
    // Since HQ is in lower-left and center is upper-right, the perpendicular
    // direction is roughly (dyToCenter, -dxToCenter) normalized.
    const perpLen = Math.sqrt(dxToCenter * dxToCenter + dyToCenter * dyToCenter) || 1;
    const perpX = dyToCenter / perpLen;
    const perpY = -dxToCenter / perpLen;

    const tx = Math.round(baseX + perpX * lateralOffset);
    const ty = Math.round(baseY + perpY * lateralOffset);

    anchors.push({
      tx,
      ty,
      resourceClass: sideClasses[i % sideClasses.length],
      zone: 'side',
      variationRadius: 2, // Small controlled variation
      mandatory: false,
    });
  }

  // ── 3. Contested/far zone anchors ──
  // At ~60-85% of the way from HQ to center.

  // Number of contested anchors scales with map size
  const contestedAnchorCount = W <= 32 ? 2 : W <= 48 ? 4 : 6;

  const contestedProportions = [0.60, 0.70, 0.75, 0.85, 0.80, 0.65];

  const contestedClasses: AcceptedResourceClassId[] = ['rich', 'very_rich', 'rich', 'very_rich', 'rich', 'very_rich'];

  for (let i = 0; i < contestedAnchorCount; i++) {
    const proportion = contestedProportions[i % contestedProportions.length];
    const lateralOffset = (i % 2 === 0 ? 1 : -1) * (3 + (i % 4));

    const baseX = Math.round(hqCenterX + dxToCenter * proportion);
    const baseY = Math.round(hqCenterY + dyToCenter * proportion);

    const perpLen = Math.sqrt(dxToCenter * dxToCenter + dyToCenter * dyToCenter) || 1;
    const perpX = dyToCenter / perpLen;
    const perpY = -dxToCenter / perpLen;

    const tx = Math.round(baseX + perpX * lateralOffset);
    const ty = Math.round(baseY + perpY * lateralOffset);

    anchors.push({
      tx,
      ty,
      resourceClass: contestedClasses[i % contestedClasses.length],
      zone: 'contested',
      variationRadius: 2,
      mandatory: false,
    });
  }

  // ── 4. Center infinite deposit ──
  // Placed at exact map center, no variation, mandatory.

  anchors.push({
    tx: Math.floor(W / 2) - 1,
    ty: Math.floor(H / 2) - 1,
    resourceClass: 'infinite',
    zone: 'center',
    variationRadius: 0, // No variation — must be exactly at center
    mandatory: true,
  });

  return anchors;
}

// ─── Variation ──────────────────────────────────────────────────────

/**
 * Apply controlled variation to an anchor position.
 *
 * The variation shifts the anchor by a small random offset within the
 * allowed radius. The offset is deterministic given the same PRNG state.
 *
 * Rules:
 * - Same seed + same size = same positions
 * - Variation never moves starter resources outside the early zone
 * - Variation never moves center infinite away from center
 * - Variation never creates overlaps or out-of-bounds positions
 * - If variation candidate is blocked/invalid, fallback to exact anchor
 *
 * @param anchor The anchor to vary
 * @param rng Deterministic PRNG function
 * @param W Map width
 * @param H Map height
 * @param occupied Set of occupied tile keys "tx,ty"
 * @param footprint Resource footprint size
 * @returns Final placement position
 */
export function applyControlledAnchorVariation(
  anchor: ResourceAnchor,
  rng: () => number,
  W: number,
  H: number,
  occupied: Set<string>,
  footprint: number,
): { tx: number; ty: number } {
  // No variation for zero-radius anchors (starter, center)
  if (anchor.variationRadius === 0) {
    return { tx: anchor.tx, ty: anchor.ty };
  }

  // Try variation candidates
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const dx = Math.round((rng() * 2 - 1) * anchor.variationRadius);
    const dy = Math.round((rng() * 2 - 1) * anchor.variationRadius);

    // Skip zero variation (would be same as anchor)
    if (dx === 0 && dy === 0 && attempt < maxAttempts - 1) continue;

    const candidateTx = anchor.tx + dx;
    const candidateTy = anchor.ty + dy;

    // Bounds check
    if (candidateTx < 0 || candidateTy < 0 ||
        candidateTx + footprint > W || candidateTy + footprint > H) {
      continue;
    }

    // Overlap check
    let hasOverlap = false;
    for (let ddy = 0; ddy < footprint; ddy++) {
      for (let ddx = 0; ddx < footprint; ddx++) {
        if (occupied.has(`${candidateTx + ddx},${candidateTy + ddy}`)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (!hasOverlap) {
      return { tx: candidateTx, ty: candidateTy };
    }
  }

  // Fallback to exact anchor position
  return { tx: anchor.tx, ty: anchor.ty };
}

// ─── Full resolution ───────────────────────────────────────────────

/**
 * Resolve all resource anchors into final placements.
 *
 * This is the main entry point for anchor-based resource generation.
 * It computes anchors, applies variation, and produces the final
 * list of resolved placements with both resourceClass and legacyType.
 *
 * @param W Map width
 * @param H Map height
 * @param hq HQ placement
 * @param rng Deterministic PRNG
 * @param occupied Set of occupied tile keys (HQ area, etc.)
 * @returns Array of resolved resource placements
 */
export function resolveResourceAnchors(
  W: number,
  H: number,
  hq: { tx: number; ty: number },
  rng: () => number,
  occupied: Set<string>,
): ResolvedAnchorPlacement[] {
  const anchors = getResourceAnchors(W, H, hq);
  const placements: ResolvedAnchorPlacement[] = [];

  for (const anchor of anchors) {
    const config = RESOURCE_CLASS_CONFIGS[anchor.resourceClass];
    const footprint = config.footprint;

    // Apply variation
    const pos = applyControlledAnchorVariation(anchor, rng, W, H, occupied, footprint);

    // Final bounds check (even for mandatory anchors)
    if (pos.tx < 0 || pos.ty < 0 || pos.tx + footprint > W || pos.ty + footprint > H) {
      // Skip this anchor — out of bounds even after variation
      if (!anchor.mandatory) continue;
      // For mandatory anchors, clamp to bounds as last resort
      pos.tx = Math.max(0, Math.min(pos.tx, W - footprint));
      pos.ty = Math.max(0, Math.min(pos.ty, H - footprint));
    }

    // Final overlap check
    let hasOverlap = false;
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        if (occupied.has(`${pos.tx + dx},${pos.ty + dy}`)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (hasOverlap && !anchor.mandatory) {
      // Skip non-mandatory anchors that would overlap
      continue;
    }

    // Mark tiles as occupied
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        occupied.add(`${pos.tx + dx},${pos.ty + dy}`);
      }
    }

    placements.push({
      tx: pos.tx,
      ty: pos.ty,
      resourceClass: anchor.resourceClass,
      footprint,
      legacyType: resolveAnchorResourceType(anchor.resourceClass),
    });
  }

  return placements;
}
