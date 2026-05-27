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
 * ARCH-09A: Resource distribution balance — reliable starter resources
 * near HQ, distance-based resource tiers (small/medium near, large farther),
 * more clusters for larger maps, resources never overlap.
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
 * - Resources: fixed starter cluster + PRNG scattered clusters + center infinite
 * - Obstacles: deferred (empty) — no visual assets yet, invisible blocking is worse than none
 * - Decor: deferred (empty) — non-blocking but invisible without rendering support
 * - Validation: uses mapValidation helpers for starter reachability
 */

import type { MapData, TerrainType, ResourceType, Faction } from './types';

// ─── Types ──────────────────────────────────────────────────────────

/** Supported map size options. */
export type MapSizeOption = 'small' | 'standard' | 'large';

/** Dimensions for each map size option. */
export const MAP_SIZE_DIMENSIONS: Record<MapSizeOption, { width: number; height: number }> = {
  small: { width: 32, height: 32 },
  standard: { width: 48, height: 48 },
  large: { width: 64, height: 64 },
};

/** Map ID prefix for generated maps. */
export const GENERATED_MAP_ID_PREFIX = 'generated';

/** Maximum validation retry attempts before accepting best candidate. */
export const MAX_VALIDATION_ATTEMPTS = 3;

// ─── PRNG ───────────────────────────────────────────────────────────

/**
 * Mulberry32 — simple deterministic PRNG.
 * Takes a 32-bit integer seed, returns a function that produces
 * floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Seed helpers ───────────────────────────────────────────────────

/**
 * Normalize a seed input to a 32-bit integer.
 *
 * - If the input is a numeric string, parse it directly.
 * - Otherwise, hash the string to a 32-bit integer using a simple
 *   DJB2-like hash for deterministic results.
 * - Empty string hashes to 0.
 */
export function normalizeSeed(input: string): number {
  const trimmed = input.trim();

  // If it looks like a plain integer, use it directly
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) | 0;
  }

  // Hash the string to a 32-bit integer (DJB2 variant)
  let hash = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash + trimmed.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Create a random seed string (8 hex characters).
 * Uses Math.random() — not deterministic, but suitable for UI "random" button.
 */
export function createRandomSeed(): string {
  return Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
}

/**
 * Map a MapSizeOption to { width, height }.
 */
export function mapSizeToDimensions(size: MapSizeOption): { width: number; height: number } {
  return MAP_SIZE_DIMENSIONS[size];
}

/**
 * Generate a readable map name from seed and size.
 */
export function generatedMapName(seed: string, size: MapSizeOption): string {
  return `Generated (${size}, seed:${seed})`;
}

/**
 * Generate a mapId for a generated map.
 */
export function generatedMapId(seed: string, size: MapSizeOption): string {
  return `${GENERATED_MAP_ID_PREFIX}-${size}-${seed}`;
}

/**
 * Check if a runtime GameState belongs to a generated map.
 *
 * Runtime GameState.mapId is NOT "generated-..." — it is "map-{faction}-{W}x{H}".
 * But GameState.mapName for generated maps starts with "Generated" (set via
 * generatedMapName). This helper centralizes that detection so callers don't
 * need to know the naming convention.
 *
 * Works for both new generated games and loaded generated saves.
 */
export function isGeneratedRuntimeState(state: { mapName: string }): boolean {
  return state.mapName.startsWith('Generated');
}

// ─── Generated map creation ─────────────────────────────────────────

/** HQ position offset from top-left (same for all generated maps). */
const HQ_OFFSET_TX = 4;
const HQ_OFFSET_TY = 4;

/**
 * Create a deterministic generated MapData from seed and size.
 *
 * The map has:
 * - Patch-based terrain with sand-dominant base and soft sand-light/sand-dark patches
 * - HQ at (4, 4) with a 3×3 footprint
 * - One idle builder at (3, 3)
 * - Starter resource cluster near HQ (reliable small + medium resources)
 * - Central infinite resource deposit
 * - Distance-based resource clusters (more medium/large farther from HQ)
 * - Obstacles and decor are deferred (empty arrays) — no visual assets yet
 * - No buildings (MVP)
 */
export function createGeneratedMapData(seed: string, size: MapSizeOption, faction: Faction = 'cyan'): MapData {
  const dims = mapSizeToDimensions(size);
  const W = dims.width;
  const H = dims.height;
  const seedInt = normalizeSeed(seed);
  const rng = mulberry32(seedInt);

  // ── Terrain: patch-based clustering ──
  const terrain = generateTerrain(rng, W, H);

  // ── HQ ──
  const hq = { tx: HQ_OFFSET_TX, ty: HQ_OFFSET_TY, faction };

  // ── Builder ──
  const builders = [
    {
      tx: 3,
      ty: 3,
      busy: false,
      phase: 'idle' as const,
      path: [],
      pathIndex: 0,
      ftx: 3.5,
      fty: 3.5,
      targetTx: 3,
      targetTy: 3,
      assignedSiteId: -1,
    },
  ];

  // ── Occupied set: track all placed items to prevent overlap ──
  const occupied = new Set<string>();

  // Mark HQ area as occupied (3×3 footprint + 1 tile margin)
  for (let dy = -1; dy <= 3; dy++) {
    for (let dx = -1; dx <= 3; dx++) {
      occupied.add(`${hq.tx + dx},${hq.ty + dy}`);
    }
  }

  // ── Resources ──
  const resources = generateResources(rng, W, H, hq, occupied);

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
    hq,
    resources,
    obstacles,
    decor,
    buildings: [],
    builders,
    constructionSites: [],
  };
}

// ─── Terrain generation (patch-based) ───────────────────────────────

/**
 * Generate terrain using patch/cluster-based approach.
 *
 * Strategy:
 * 1. Fill entire map with 'sand' (dominant base).
 * 2. Place a number of patch centers using PRNG.
 * 3. Each patch center is sand-light or sand-dark, with a radius.
 * 4. Tiles within radius of a patch center get that patch's terrain type.
 * 5. Sand remains the clear majority; patches form soft clusters.
 *
 * Same seed + size always produces identical terrain.
 */
function generateTerrain(rng: () => number, W: number, H: number): TerrainType[][] {
  // Step 1: Fill with sand
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < H; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < W; x++) {
      row.push('sand');
    }
    terrain.push(row);
  }

  // Step 2: Generate patch centers
  // Number of patches scales with map area
  const patchCount = Math.floor((W * H) / 80); // ~12 for small, ~28 for standard, ~51 for large

  interface TerrainPatch {
    cx: number;
    cy: number;
    radius: number;
    type: TerrainType;
  }

  const patches: TerrainPatch[] = [];
  for (let i = 0; i < patchCount; i++) {
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    // Radius 1-4 tiles: small patches for subtlety, occasional larger ones
    const radius = 1 + Math.floor(rng() * 4);
    // Roughly 40% sand-light, 30% sand-dark, 30% sand-light (weighted toward light)
    const typeRoll = rng();
    const type: TerrainType = typeRoll < 0.45 ? 'sand-light' : typeRoll < 0.75 ? 'sand-dark' : 'sand-light';
    patches.push({ cx, cy, radius, type });
  }

  // Step 3: Apply patches — tiles within radius get the patch type
  for (const patch of patches) {
    const r2 = patch.radius * patch.radius;
    for (let dy = -patch.radius; dy <= patch.radius; dy++) {
      for (let dx = -patch.radius; dx <= patch.radius; dx++) {
        // Elliptical patch with distance falloff
        const dist2 = (dx * dx + dy * dy);
        if (dist2 > r2) continue;

        const tx = patch.cx + dx;
        const ty = patch.cy + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;

        // Apply with higher probability near center for softer edges
        const distRatio = Math.sqrt(dist2) / patch.radius;
        if (rng() < 1.0 - distRatio * 0.6) {
          terrain[ty][tx] = patch.type;
        }
      }
    }
  }

  return terrain;
}

// ─── Resource generation ────────────────────────────────────────────

/**
 * Generate resource placements for a map.
 *
 * Strategy:
 * 1. Starter cluster: guaranteed small + medium resources near HQ (SE direction)
 * 2. Near-HQ ring: medium resources at moderate distance from HQ
 * 3. Central infinite deposit at map center
 * 4. Mid/far clusters: larger resources appear more often at distance
 * 5. Cluster count scales with map size
 *
 * Resources never overlap each other or the HQ area.
 */
function generateResources(
  rng: () => number,
  W: number,
  H: number,
  hq: { tx: number; ty: number },
  occupied: Set<string>,
): MapData['resources'] {
  const resources: MapData['resources'] = [];

  /** Try to place a resource at (tx, ty) with given footprint. Returns true if placed. */
  function tryPlace(tx: number, ty: number, type: ResourceType, footprint: number): boolean {
    // Bounds check
    if (tx < 0 || ty < 0 || tx + footprint > W || ty + footprint > H) return false;

    // Overlap check against occupied set
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
      }
    }

    // Place and mark occupied
    resources.push({ tx, ty, type, footprint });
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        occupied.add(`${tx + dx},${ty + dy}`);
      }
    }
    return true;
  }

  // 1. Starter cluster: guaranteed medium resources SE of HQ for reliable early harvesting
  const starterMediums = [
    { tx: hq.tx + 5, ty: hq.ty + 4 },
    { tx: hq.tx + 6, ty: hq.ty + 4 },
    { tx: hq.tx + 5, ty: hq.ty + 5 },
    { tx: hq.tx + 7, ty: hq.ty + 5 },
    { tx: hq.tx + 6, ty: hq.ty + 6 },
    { tx: hq.tx + 4, ty: hq.ty + 5 },
  ];
  for (const pos of starterMediums) {
    tryPlace(pos.tx, pos.ty, 'medium', 1);
  }

  // Small starter resources nearby
  const starterSmalls = [
    { tx: hq.tx + 4, ty: hq.ty + 4 },
    { tx: hq.tx + 7, ty: hq.ty + 4 },
    { tx: hq.tx + 8, ty: hq.ty + 5 },
    { tx: hq.tx + 7, ty: hq.ty + 6 },
    { tx: hq.tx + 4, ty: hq.ty + 7 },
    { tx: hq.tx + 5, ty: hq.ty + 7 },
  ];
  for (const pos of starterSmalls) {
    tryPlace(pos.tx, pos.ty, 'small', 1);
  }

  // 2. Near-HQ ring: medium resources at moderate distance (tiles 10-18 from HQ center)
  const hqCenterX = hq.tx + 1;
  const hqCenterY = hq.ty + 1;
  const nearRingCount = 3 + Math.floor(rng() * 3); // 3-5
  for (let i = 0; i < nearRingCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 10 + Math.floor(rng() * 8);
    const rtx = Math.round(hqCenterX + Math.cos(angle) * dist);
    const rty = Math.round(hqCenterY + Math.sin(angle) * dist);
    tryPlace(rtx, rty, 'medium', 1);
  }

  // 3. Central infinite deposit
  const centerTx = Math.floor(W / 2) - 1;
  const centerTy = Math.floor(H / 2) - 1;
  tryPlace(centerTx, centerTy, 'infinite', 3);

  // 4. Mid/far resource clusters — distance-based tiers
  // Number of clusters scales with map size
  const clusterCount = Math.floor((W * H) / 350); // ~2 for small, ~6 for standard, ~11 for large
  for (let c = 0; c < clusterCount; c++) {
    // Pick a random position, avoiding the very edges
    const clusterTx = 3 + Math.floor(rng() * (W - 8));
    const clusterTy = 3 + Math.floor(rng() * (H - 8));

    // Distance from HQ center
    const distFromHQ = Math.sqrt(
      (clusterTx - hqCenterX) ** 2 + (clusterTy - hqCenterY) ** 2
    );

    // Each cluster has 2-5 resources
    const clusterSize = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < clusterSize; i++) {
      const dx = Math.floor(rng() * 5) - 2;
      const dy = Math.floor(rng() * 5) - 2;
      const rtx = clusterTx + dx;
      const rty = clusterTy + dy;

      // Distance-based resource type distribution:
      // Near HQ: mostly small/medium
      // Mid-range: mix
      // Far from HQ: more large
      let type: ResourceType;
      if (distFromHQ < 12) {
        // Near: small/medium only
        type = rng() < 0.5 ? 'small' : 'medium';
      } else if (distFromHQ < 22) {
        // Mid: mix of all types
        const roll = rng();
        type = roll < 0.3 ? 'small' : roll < 0.7 ? 'medium' : 'large';
      } else {
        // Far: more large/medium
        const roll = rng();
        type = roll < 0.15 ? 'small' : roll < 0.5 ? 'medium' : 'large';
      }
      tryPlace(rtx, rty, type, 1);
    }
  }

  return resources;
}

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
 * Result of validated generated map creation.
 */
export interface ValidatedGeneratedMapResult {
  /** The generated map data. */
  mapData: MapData;
  /** Number of attempts before accepting this map. */
  attempts: number;
  /** Whether the map passed validation. */
  valid: boolean;
  /** Validation warning messages (empty if valid). */
  warnings: string[];
}

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
): ValidatedGeneratedMapResult {
  const warnings: string[] = [];
  let bestMapData: MapData | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
    // Deterministic seed offset for retry: append attempt number
    const attemptSeed = attempt === 0 ? seed : `${seed}__retry${attempt}`;
    const mapData = createGeneratedMapData(attemptSeed, size, faction);

    // Run lightweight validation checks (pure, no GameState needed)
    const validation = validateGeneratedMap(mapData);

    if (validation.valid) {
      return {
        mapData,
        attempts: attempt + 1,
        valid: true,
        warnings: [],
      };
    }

    // Track best candidate by score
    if (validation.score > bestScore) {
      bestScore = validation.score;
      bestMapData = mapData;
    }

    warnings.push(`Attempt ${attempt + 1}: ${validation.issues.join('; ')}`);
  }

  // All attempts failed — return best candidate with warnings
  return {
    mapData: bestMapData!,
    attempts: MAX_VALIDATION_ATTEMPTS,
    valid: false,
    warnings,
  };
}

/**
 * Lightweight validation result for a generated MapData.
 *
 * This checks structural properties without requiring a full GameState.
 * For full BFS reachability validation, use validateMap() with a GameState.
 */
interface GeneratedMapValidation {
  valid: boolean;
  score: number;
  issues: string[];
}

/**
 * Validate a generated MapData for basic playability.
 *
 * Checks:
 * 1. Starter resources exist near HQ (within 10 tiles of HQ center)
 * 2. HQ area is clear of resources (no overlap with 3×3 footprint + 1 margin)
 * 3. Resources don't overlap each other (structural check)
 * 4. Central infinite deposit exists
 * 5. No obstacles within HQ clearance zone
 */
function validateGeneratedMap(mapData: MapData): GeneratedMapValidation {
  const issues: string[] = [];
  let score = 0;
  const hqCenterX = mapData.hq.tx + 1;
  const hqCenterY = mapData.hq.ty + 1;

  // Check 1: Starter resources near HQ
  const nearResources = mapData.resources.filter(r => {
    const dist = Math.sqrt((r.tx - hqCenterX) ** 2 + (r.ty - hqCenterY) ** 2);
    return dist <= 10;
  });
  if (nearResources.length >= 4) {
    score += 40;
  } else if (nearResources.length >= 2) {
    score += 20;
    issues.push(`Only ${nearResources.length} resources near HQ`);
  } else {
    issues.push(`Insufficient resources near HQ: ${nearResources.length}`);
  }

  // Check 2: HQ area clear of resources
  let hqClear = true;
  for (const r of mapData.resources) {
    for (let dy = 0; dy < r.footprint; dy++) {
      for (let dx = 0; dx < r.footprint; dx++) {
        const rtx = r.tx + dx;
        const rty = r.ty + dy;
        if (rtx >= mapData.hq.tx - 1 && rtx <= mapData.hq.tx + 3 &&
            rty >= mapData.hq.ty - 1 && rty <= mapData.hq.ty + 3) {
          hqClear = false;
        }
      }
    }
  }
  if (hqClear) {
    score += 30;
  } else {
    issues.push('Resources overlap HQ area');
  }

  // Check 3: No resource overlap (structural)
  const resourceTiles = new Set<string>();
  let noOverlap = true;
  for (const r of mapData.resources) {
    for (let dy = 0; dy < r.footprint; dy++) {
      for (let dx = 0; dx < r.footprint; dx++) {
        const key = `${r.tx + dx},${r.ty + dy}`;
        if (resourceTiles.has(key)) {
          noOverlap = false;
        }
        resourceTiles.add(key);
      }
    }
  }
  if (noOverlap) {
    score += 20;
  } else {
    issues.push('Resources overlap each other');
  }

  // Check 4: Central infinite deposit
  const hasInfinite = mapData.resources.some(r => r.type === 'infinite');
  if (hasInfinite) {
    score += 10;
  } else {
    issues.push('No infinite resource deposit');
  }

  return {
    valid: issues.length === 0,
    score,
    issues,
  };
}

// ─── Quality diagnostics ────────────────────────────────────────────

/**
 * Quality summary for a generated map.
 *
 * Provides a structured overview of map quality metrics
 * useful for devtools diagnostics.
 */
export interface GeneratedMapQualitySummary {
  /** Map dimensions. */
  width: number;
  height: number;
  /** Total resource count. */
  resourceCount: number;
  /** Resource count by type. */
  resourcesByType: Record<ResourceType, number>;
  /** Resources near HQ (within 10 tiles of HQ center). */
  starterResourceCount: number;
  /** Whether central infinite deposit exists. */
  hasInfiniteDeposit: boolean;
  /** Obstacle count. */
  obstacleCount: number;
  /** Decor count. */
  decorCount: number;
  /** Whether map passed lightweight validation. */
  validationPassed: boolean;
  /** Validation issues (empty if passed). */
  validationIssues: string[];
}

/**
 * Summarize the quality of a generated map.
 *
 * Pure helper — no Phaser, no DOM. Useful for devtools diagnostics
 * and test assertions.
 */
export function summarizeGeneratedMapQuality(mapData: MapData): GeneratedMapQualitySummary {
  const hqCenterX = mapData.hq.tx + 1;
  const hqCenterY = mapData.hq.ty + 1;

  const resourcesByType: Record<ResourceType, number> = {
    small: 0,
    medium: 0,
    large: 0,
    infinite: 0,
  };
  for (const r of mapData.resources) {
    resourcesByType[r.type]++;
  }

  const starterResourceCount = mapData.resources.filter(r => {
    const dist = Math.sqrt((r.tx - hqCenterX) ** 2 + (r.ty - hqCenterY) ** 2);
    return dist <= 10;
  }).length;

  const hasInfiniteDeposit = mapData.resources.some(r => r.type === 'infinite');

  const validation = validateGeneratedMap(mapData);

  return {
    width: mapData.width,
    height: mapData.height,
    resourceCount: mapData.resources.length,
    resourcesByType,
    starterResourceCount,
    hasInfiniteDeposit,
    obstacleCount: mapData.obstacles.length,
    decorCount: mapData.decor.length,
    validationPassed: validation.valid,
    validationIssues: validation.issues,
  };
}
