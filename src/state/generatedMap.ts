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
 * - Obstacles: deferred (empty) — no visual blockers until obstacle visuals exist
 * - Decor: deterministic, non-blocking visual life with exclusion zones
 * - Validation: uses mapValidation helpers for starter reachability
 */

import { MAPLIFE_DECOR_CONFIG, type MaplifeDecorConfig } from '../assets/maplifeDecor';
import type { DecorPlacement, DecorType, MapData, TerrainType, ResourceType, Faction } from './types';

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

/** Baseline MAPLIFE decor targets for a standard 48×48 generated map. */
export const STANDARD_MAPLIFE_DECOR_COUNTS: Record<DecorType, number> = {
  env_rock_cluster_1x1: 7,
  env_rock_cluster_2x2: 3,
  env_rock_cluster_3x3: 1,
  env_bush_dry_cluster_1x1: 8,
  env_bush_dry_cluster_2x2: 3,
  env_bush_dry_cluster_3x3: 1,
  env_sand_crack_patch_1x1: 16,
  env_sand_crack_patch_2x2: 8,
  env_sand_crack_patch_3x3: 3,
  env_sand_bump_patch_1x1: 12,
  env_sand_bump_patch_2x2: 6,
  env_sand_bump_patch_3x3: 2,
};

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
 * - Obstacles remain deferred (empty) — invisible blockers are worse than none
 * - Decor placements are deterministic, non-blocking visual life (MAPLIFE-02A)
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
      id: 'builder-0',
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
  const decor = generateDecor(rng, terrain, W, H, hq, resources);

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
 * TERRAIN-01: Improved clustering for natural-looking desert terrain.
 * TERRAIN-02A: Extended to 6-variant 256×128 sand tile family.
 *
 * Strategy:
 * 1. Fill entire map with 'sand' (dominant base).
 * 2. Place large primary patches using PRNG — these form the main
 *    visual clusters (radius 3–7).
 * 3. Place smaller accent patches for subtle variation (radius 1–3).
 * 4. Tiles within radius of a patch center get that patch's terrain type
 *    with smooth distance-based falloff.
 * 5. Sand remains the clear majority (~60-70%); patches form soft clusters.
 * 6. TERRAIN-02A: Second pass sprinkles detail variants (sand-ripple,
 *    sand-pebble, sand-cracked) onto base 'sand' tiles using PRNG for
 *    texture variety and repetition reduction.
 *
 * Improvements over original:
 * - Larger primary patches (radius up to 7) for bigger visual clusters
 * - Two-tier patch system: large primary + small accent patches
 * - Softer edge falloff using quadratic curve instead of linear
 * - Balanced type distribution: ~35% sand-light, ~25% sand-dark primary,
 *   with accent patches adding variety
 * - Fewer but larger patches reduce the scattered noise appearance
 * - TERRAIN-02A: Detail variant sprinkling adds ripple/pebble/cracked
 *   accents for texture variety without rotation
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

  interface TerrainPatch {
    cx: number;
    cy: number;
    radius: number;
    type: TerrainType;
  }

  // Step 2: Generate large primary patches
  // Fewer patches but larger radius for natural-looking clusters
  const primaryPatchCount = Math.floor((W * H) / 200); // ~5 for small, ~11 for standard, ~20 for large

  const patches: TerrainPatch[] = [];
  for (let i = 0; i < primaryPatchCount; i++) {
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    // Larger radius: 3-7 tiles for substantial visual clusters
    const radius = 3 + Math.floor(rng() * 5);
    // Balanced distribution: slightly more sand-light for desert feel
    const typeRoll = rng();
    const type: TerrainType = typeRoll < 0.55 ? 'sand-light' : 'sand-dark';
    patches.push({ cx, cy, radius, type });
  }

  // Step 3: Generate smaller accent patches for subtle variation
  const accentPatchCount = Math.floor((W * H) / 250); // ~4 for small, ~9 for standard, ~16 for large
  for (let i = 0; i < accentPatchCount; i++) {
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    // Small accent patches: radius 1-3
    const radius = 1 + Math.floor(rng() * 3);
    // Accent patches are mostly the opposite type of nearby primary patches
    const typeRoll = rng();
    const type: TerrainType = typeRoll < 0.4 ? 'sand-dark' : typeRoll < 0.8 ? 'sand-light' : 'sand';
    patches.push({ cx, cy, radius, type });
  }

  // Step 4: Apply patches — tiles within radius get the patch type
  for (const patch of patches) {
    for (let dy = -patch.radius; dy <= patch.radius; dy++) {
      for (let dx = -patch.radius; dx <= patch.radius; dx++) {
        // Chebyshev distance for more organic, less circular shapes
        const chebyshevDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (chebyshevDist > patch.radius) continue;

        const tx = patch.cx + dx;
        const ty = patch.cy + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;

        // Quadratic falloff for softer edges
        // Near center: almost always applied. At edge: rarely applied.
        const distRatio = chebyshevDist / patch.radius;
        const applyProbability = 1.0 - distRatio * distRatio * 0.8;
        if (rng() < applyProbability) {
          terrain[ty][tx] = patch.type;
        }
      }
    }
  }

  // Step 5: TERRAIN-02A — Sprinkle detail variants onto base 'sand' tiles.
  // After patch application, some 'sand' tiles get assigned a detail variant
  // (ripple, pebble, cracked) for texture variety and repetition reduction.
  // This is deterministic: same seed + size = same variant assignment.
  // Distribution: ~10% ripple, ~4% pebble, ~4% cracked of remaining sand tiles.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== 'sand') continue;

      const roll = rng();
      if (roll < 0.10) {
        // ~10% of sand tiles become ripple
        terrain[y][x] = 'sand-ripple';
      } else if (roll < 0.14) {
        // ~4% of sand tiles become pebble
        terrain[y][x] = 'sand-pebble';
      } else if (roll < 0.18) {
        // ~4% of sand tiles become cracked
        terrain[y][x] = 'sand-cracked';
      }
      // Remaining ~82% stay as 'sand' — dominant base
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

// ─── MAPLIFE decor generation ──────────────────────────────────────

type MaplifeDecorFamily = 'rock' | 'bush' | 'crack' | 'bump';

const MAPLIFE_CLUSTER_TYPES: Record<MaplifeDecorFamily, DecorType[]> = {
  rock: ['env_rock_cluster_3x3', 'env_rock_cluster_2x2', 'env_rock_cluster_1x1'],
  bush: ['env_bush_dry_cluster_3x3', 'env_bush_dry_cluster_2x2', 'env_bush_dry_cluster_1x1'],
  crack: ['env_sand_crack_patch_3x3', 'env_sand_crack_patch_2x2', 'env_sand_crack_patch_1x1'],
  bump: ['env_sand_bump_patch_3x3', 'env_sand_bump_patch_2x2', 'env_sand_bump_patch_1x1'],
};

const MAPLIFE_FAMILY_ORDER: readonly MaplifeDecorFamily[] = ['rock', 'bush', 'crack', 'bump'];
const MAPLIFE_STANDARD_AREA = MAP_SIZE_DIMENSIONS.standard.width * MAP_SIZE_DIMENSIONS.standard.height;

/**
 * Scale baseline MAPLIFE counts by map area while keeping rare variants present
 * on maps that are large enough to support them.
 */
export function getMaplifeDecorTargetCounts(width: number, height: number): Record<DecorType, number> {
  const areaScale = (width * height) / MAPLIFE_STANDARD_AREA;

  return Object.fromEntries(
    (Object.entries(STANDARD_MAPLIFE_DECOR_COUNTS) as Array<[DecorType, number]>).map(([type, baseCount]) => {
      const scaled = baseCount * areaScale;
      const rounded = Math.round(scaled);
      const minCount = areaScale >= 0.7 && baseCount > 0 ? 1 : 0;
      return [type, Math.max(minCount, rounded)];
    }),
  ) as Record<DecorType, number>;
}

/**
 * Density range used by tests and QA. Actual placement may land slightly lower
 * when the start/resource exclusion zones eat available space.
 */
export function getMaplifeDecorCountRange(width: number, height: number): { min: number; max: number } {
  const total = Object.values(getMaplifeDecorTargetCounts(width, height))
    .reduce((sum, count) => sum + count, 0);
  return {
    min: Math.max(8, Math.floor(total * 0.7)),
    max: Math.max(8, Math.ceil(total * 1.05)),
  };
}

/**
 * Public helper reused by generated maps and the dev arena map.
 * Decor never mutates occupancy, blockers, or economy.
 */
export function generateMaplifeDecor(
  seed: string,
  terrain: TerrainType[][],
  width: number,
  height: number,
  hq: { tx: number; ty: number },
  resources: MapData['resources'],
): DecorPlacement[] {
  return generateDecor(mulberry32(normalizeSeed(seed)), terrain, width, height, hq, resources);
}

function generateDecor(
  rng: () => number,
  terrain: TerrainType[][],
  width: number,
  height: number,
  hq: { tx: number; ty: number },
  resources: MapData['resources'],
): DecorPlacement[] {
  const targets = getMaplifeDecorTargetCounts(width, height);
  const blockedTiles = buildDecorBlockedTiles(width, height, hq, resources);
  const occupiedProps = new Set<string>();
  const occupiedDecals = new Set<string>();
  const occupiedLarge = new Set<string>();
  const decor: DecorPlacement[] = [];

  for (const family of MAPLIFE_FAMILY_ORDER) {
    const familyTypes = MAPLIFE_CLUSTER_TYPES[family];
    const totalForFamily = familyTypes.reduce((sum, type) => sum + targets[type], 0);
    if (totalForFamily <= 0) continue;

    const centers = generateClusterCenters(rng, width, height, family, totalForFamily, blockedTiles);
    if (centers.length === 0) continue;

    let centerIndex = 0;
    for (const type of familyTypes) {
      const config = MAPLIFE_DECOR_CONFIG[type];
      for (let i = 0; i < targets[type]; i++) {
        const center = centers[centerIndex % centers.length];
        centerIndex++;
        const placement = findDecorPlacement(
          rng,
          terrain,
          width,
          height,
          config,
          center,
          blockedTiles,
          occupiedProps,
          occupiedDecals,
          occupiedLarge,
        );

        if (!placement) continue;

        decor.push(placement);
        markDecorTiles(placement, occupiedProps, occupiedDecals, occupiedLarge);
      }
    }
  }

  return decor;
}

function buildDecorBlockedTiles(
  width: number,
  height: number,
  hq: { tx: number; ty: number },
  resources: MapData['resources'],
): Set<string> {
  const blocked = new Set<string>();

  const markRect = (fromX: number, fromY: number, toX: number, toY: number): void => {
    for (let ty = fromY; ty <= toY; ty++) {
      for (let tx = fromX; tx <= toX; tx++) {
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        blocked.add(`${tx},${ty}`);
      }
    }
  };

  // Keep a small edge margin so large assets do not touch image/map borders.
  markRect(0, 0, width - 1, 1);
  markRect(0, height - 2, width - 1, height - 1);
  markRect(0, 0, 1, height - 1);
  markRect(width - 2, 0, width - 1, height - 1);

  // HQ + starter area + builders' launch space.
  markRect(hq.tx - 3, hq.ty - 3, hq.tx + 8, hq.ty + 8);

  for (const resource of resources) {
    const margin = resource.type === 'infinite' ? 2 : 1;
    markRect(
      resource.tx - margin,
      resource.ty - margin,
      resource.tx + resource.footprint - 1 + margin,
      resource.ty + resource.footprint - 1 + margin,
    );
  }

  return blocked;
}

function generateClusterCenters(
  rng: () => number,
  width: number,
  height: number,
  family: MaplifeDecorFamily,
  totalForFamily: number,
  blockedTiles: Set<string>,
): Array<{ tx: number; ty: number }> {
  const targetCenters = Math.max(1, Math.round(totalForFamily / (family === 'crack' || family === 'bump' ? 5 : 3)));
  const centers: Array<{ tx: number; ty: number }> = [];
  const maxAttempts = targetCenters * 20;

  for (let attempt = 0; attempt < maxAttempts && centers.length < targetCenters; attempt++) {
    const tx = 2 + Math.floor(rng() * Math.max(1, width - 4));
    const ty = 2 + Math.floor(rng() * Math.max(1, height - 4));
    const key = `${tx},${ty}`;

    if (blockedTiles.has(key)) continue;

    let tooClose = false;
    for (const center of centers) {
      const dx = center.tx - tx;
      const dy = center.ty - ty;
      const minDist = family === 'crack' || family === 'bump' ? 4 : 6;
      if (dx * dx + dy * dy < minDist * minDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    centers.push({ tx, ty });
  }

  return centers;
}

function findDecorPlacement(
  rng: () => number,
  terrain: TerrainType[][],
  width: number,
  height: number,
  config: MaplifeDecorConfig,
  center: { tx: number; ty: number },
  blockedTiles: Set<string>,
  occupiedProps: Set<string>,
  occupiedDecals: Set<string>,
  occupiedLarge: Set<string>,
): DecorPlacement | null {
  const radius = config.category === 'prop' ? 4 : 5;
  const maxAttempts = config.category === 'prop' ? 28 : 36;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = center.tx + Math.floor(rng() * (radius * 2 + 1)) - radius;
    const ty = center.ty + Math.floor(rng() * (radius * 2 + 1)) - radius;

    if (!isDecorPlacementValid(
      terrain,
      width,
      height,
      tx,
      ty,
      config,
      blockedTiles,
      occupiedProps,
      occupiedDecals,
      occupiedLarge,
    )) {
      continue;
    }

    return {
      tx,
      ty,
      type: config.type,
      footprint: config.footprint,
      category: config.category,
    };
  }

  return null;
}

function isDecorPlacementValid(
  terrain: TerrainType[][],
  width: number,
  height: number,
  tx: number,
  ty: number,
  config: MaplifeDecorConfig,
  blockedTiles: Set<string>,
  occupiedProps: Set<string>,
  occupiedDecals: Set<string>,
  occupiedLarge: Set<string>,
): boolean {
  const footprint = config.footprint;
  if (tx < 0 || ty < 0 || tx + footprint > width || ty + footprint > height) return false;

  const occupancySet = config.category === 'prop' ? occupiedProps : occupiedDecals;

  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      const tileX = tx + dx;
      const tileY = ty + dy;
      const key = `${tileX},${tileY}`;
      if (blockedTiles.has(key) || occupancySet.has(key)) return false;
      if (footprint > 1 && occupiedLarge.has(key)) return false;
      if (config.category === 'prop' && terrain[tileY][tileX] === 'sand-cracked') return false;
    }
  }

  return true;
}

function markDecorTiles(
  placement: DecorPlacement,
  occupiedProps: Set<string>,
  occupiedDecals: Set<string>,
  occupiedLarge: Set<string>,
): void {
  const occupancySet = placement.category === 'prop' ? occupiedProps : occupiedDecals;

  for (let dy = 0; dy < placement.footprint; dy++) {
    for (let dx = 0; dx < placement.footprint; dx++) {
      const tileX = placement.tx + dx;
      const tileY = placement.ty + dy;
      occupancySet.add(`${tileX},${tileY}`);
    }
  }

  if (placement.footprint <= 1) return;

  for (let dy = -1; dy <= placement.footprint; dy++) {
    for (let dx = -1; dx <= placement.footprint; dx++) {
      occupiedLarge.add(`${placement.tx + dx},${placement.ty + dy}`);
    }
  }
}

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
