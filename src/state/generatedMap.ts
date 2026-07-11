/**
 * Deterministic generated map — pure TypeScript, no Phaser.
 *
 * ARCH-16B: Provides a deterministic generated MapData from seed + size.
 * The same seed + size always produces the same map.
 *
 * ARCH-08B: Terrain readability — clustered/patch-based terrain
 * using seed-driven patch centers instead of per-cell random noise.
 * Clean sand remains the dominant base; sand-light and sand-dark
 * form soft patches, not single random pixels.
 *
 * TERRAIN-01: Improved terrain clustering — larger primary patches
 * (radius 3-7) with smaller accent patches (radius 1-3), quadratic
 * edge falloff, Chebyshev distance for organic shapes. Sand remains
 * the dominant base (~60-70%).
 *
 * ARCH-09A: Resource distribution balance — reliable starter resources
 * near HQ, distance-based resource tiers (small/medium near, large farther),
 * more clusters for larger maps, resources never overlap.
 *
 * CORE-STEP-03B: Anchor-based resource placement — deterministic
 * anchor positions using the accepted 6-class resource model.
 * Starter zone: very_poor/poor/medium. Side: medium/rich.
 * Contested: rich/very_rich. Center: infinite 2x2 deposit.
 * Each generated resource includes both resourceClass and legacy type.
 *
 * ARCH-08B/09A: Generated map validation/fallback — retry with
 * deterministic seed offset up to MAX_VALIDATION_ATTEMPTS if
 * generated map fails validation.
 *
 * ARCH-08B: Sparse deterministic obstacles and decor — DEFERRED until
 * visual asset/placeholder rendering exists. Generated maps currently
 * have empty obstacles[] and decor[] arrays. The generation functions
 * are preserved in git history for future re-enablement.
 *
 * Design decisions:
 * - PRNG: simple mulberry32 — fast, deterministic, well-distributed
 * - Terrain: patch-based using PRNG cluster centers, not per-cell noise
 * - Resources: anchor-based placement using 6-class model (CORE-STEP-03B)
 * - Obstacles: deferred (empty) — no visual assets yet, invisible blocking is worse than none
 * - Decor: deferred (empty) — non-blocking but invisible without rendering support
 * - Validation: uses mapValidation helpers for starter reachability
 */

import type { MapData, Faction } from './types';
import type { MapStyle } from './gameSetup';
import { createSymmetricGeneratedResources } from './symmetricResources';
import type { MapSizeOption, ValidatedGeneratedMapResult } from './generatedMapTypes';
import {
  createSeededRng,
  normalizeSeed,
  mapSizeToDimensions,
} from './generatedMapSeed';
import { generateIndustrialTerrain, generateTerrain } from './generatedMapTerrain';
import { validateGeneratedMap } from './generatedMapValidation';
import { createFourCornerHeadquarters, HQ_FOOTPRINT } from './mapHeadquarters';

export type { MapSizeOption, ValidatedGeneratedMapResult } from './generatedMapTypes';
export {
  GENERATED_MAP_ID_PREFIX,
  MAP_SIZE_DIMENSIONS,
  createRandomSeed,
  generatedMapId,
  generatedMapName,
  isGeneratedRuntimeState,
  mapSizeToDimensions,
  normalizeSeed,
} from './generatedMapSeed';
export {
  summarizeGeneratedMapQuality,
  type GeneratedMapQualitySummary,
} from './generatedMapValidation';

// ─── Shared configuration ────────────────────────────────────────────

/** Maximum validation retry attempts before accepting the best candidate. */
export const MAX_VALIDATION_ATTEMPTS = 3;

// ─── Generated map creation ─────────────────────────────────────────

/**
 * Create a deterministic generated MapData from seed and size.
 *
 * The map has:
 * - Patch-based terrain with sand-dominant base and soft sand-light/sand-dark patches
 * - Four mirrored 3×3 Headquarters in the map corners
 * - `hq` remains the selected human faction compatibility alias
 * - One idle human Builder placed toward the map center
 * - Anchor-based resource placement using 6-class model (CORE-STEP-03B)
 * - Mirrored finite starter/side/contested resources in all four quadrants
 * - Equal resource classes, footprints and deterministic raw value per quadrant
 * - Center: infinite 2x2 deposit
 * - Obstacles and decor are deferred (empty arrays) — no visual assets yet
 * - No buildings (MVP)
 */
export function createGeneratedMapData(seed: string, size: MapSizeOption, faction: Faction = 'cyan', mapStyle: MapStyle = 'sand'): MapData {
  const dims = mapSizeToDimensions(size);
  const W = dims.width;
  const H = dims.height;
  const seedInt = normalizeSeed(seed);
  const rng = createSeededRng(seedInt);

  // ── Terrain: patch-based clustering or industrial flat fill ──
  const terrain = mapStyle === 'industrial'
    ? generateIndustrialTerrain(W, H)
    : generateTerrain(rng, W, H);

  // ── Headquarters: create one south-west placement and mirror over X/Y ──
  const headquarters = createFourCornerHeadquarters(W, H);
  const hq = headquarters.find(candidate => candidate.faction === faction)!;

  // ── Human Builder: immediately outside the HQ toward map center ──
  // Preserve the legacy lower-left spawn contract (within two tiles of hq top-left).
  const builderTx = hq.tx + 1;
  const builderTy = hq.ty < H / 2
    ? hq.ty + HQ_FOOTPRINT
    : hq.ty - 1;
  const builders = [
    {
      id: 'builder-0',
      ownerTeamId: hq.ownerTeamId,
      tx: builderTx,
      ty: builderTy,
      busy: false,
      phase: 'idle' as const,
      path: [],
      pathIndex: 0,
      ftx: builderTx + 0.5,
      fty: builderTy + 0.5,
      targetTx: builderTx,
      targetTy: builderTy,
      assignedSiteId: -1,
    },
  ];

  // ── Occupied set: track all placed items to prevent overlap ──
  const occupied = new Set<string>();

  // Mark all HQ areas as occupied (3×3 footprint + 1 tile margin).
  for (const headquartersPlacement of headquarters) {
    for (let dy = -1; dy <= HQ_FOOTPRINT; dy++) {
      for (let dx = -1; dx <= HQ_FOOTPRINT; dx++) {
        occupied.add(`${headquartersPlacement.tx + dx},${headquartersPlacement.ty + dy}`);
      }
    }
  }

  // ── Resources: generate once from cyan SW and mirror accepted quartets ──
  const resources = createSymmetricGeneratedResources(
    rng, W, H, headquarters, occupied,
  );

  // ── Obstacles ──
  // Obstacles are NOT placed in player-facing generated maps because they
  // affect passability (blocking) but have no visual assets yet (renderer
  // skips stateOnly entities). Re-enable after visual asset/placeholder
  // rendering exists. See follow-up in PR body.
  const obstacles: MapData['obstacles'] = [];

  // ── Decor ──
  // Decor is non-blocking but also invisible (stateOnly rendering).
  // Omitted from player-facing maps to avoid invisible clutter.
  // Re-enable after visual rendering support exists.
  const decor: MapData['decor'] = [];

  return {
    width: W,
    height: H,
    terrain,
    hq: { ...hq },
    headquarters,
    resources,
    obstacles,
    decor,
    buildings: [],
    builders,
    constructionSites: [],
  };
}

// ─── Symmetric resource generation lives in symmetricResources.ts ──

// ─── Obstacle/Decor generation (DEFERRED) ──────────────────────────
//
// Obstacle and decor placement is intentionally removed from player-facing
// generated maps in this PR because:
// - Obstacles affect passability (blocking) but have no visual assets yet.
//   The renderer treats them as stateOnly and skips them, creating invisible
//   blocking tiles — worse than no obstacles.
// - Decor is non-blocking but also invisible (stateOnly rendering), creating
//   invisible clutter on the map.
//
// To re-enable after visual asset/placeholder rendering support exists:
// 1. Uncomment/restore generateObstacles() and generateDecor() from git history.
// 2. Call them in createGeneratedMapData() and wire their results into the
//    MapData return value.
// 3. Update tests and QA checklist accordingly.

// ─── Validation / fallback ──────────────────────────────────────────

/**
 * Create a validated generated map with retry fallback.
 *
 * Generates a candidate map, runs lightweight validation checks,
 * and retries with deterministic seed offsets if validation fails.
 * Up to MAX_VALIDATION_ATTEMPTS attempts are made.
 *
 * If all attempts fail validation, returns the best candidate
 * with warning metadata. Does not throw.
 */
export function createValidatedGeneratedMapData(
  seed: string,
  size: MapSizeOption,
  faction: Faction = 'cyan',
  mapStyle: MapStyle = 'sand',
): ValidatedGeneratedMapResult<MapData> {
  const warnings: string[] = [];
  let bestMapData: MapData | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
    const attemptSeed = attempt === 0 ? seed : `${seed}__retry${attempt}`;
    const mapData = createGeneratedMapData(attemptSeed, size, faction, mapStyle);
    const validation = validateGeneratedMap(mapData);

    if (validation.valid) {
      return {
        mapData,
        attempts: attempt + 1,
        valid: true,
        warnings: [],
      };
    }

    if (validation.score > bestScore) {
      bestScore = validation.score;
      bestMapData = mapData;
    }

    warnings.push(`Attempt ${attempt + 1}: ${validation.issues.join('; ')}`);
  }

  return {
    mapData: bestMapData!,
    attempts: MAX_VALIDATION_ATTEMPTS,
    valid: false,
    warnings,
  };
}
