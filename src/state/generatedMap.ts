/**
 * Deterministic generated map — pure TypeScript, no Phaser.
 *
 * ARCH-16B: Provides a deterministic generated MapData from seed + size.
 * The same seed + size always produces the same map.
 *
 * Generated map MVP:
 * - deterministic from seed + size
 * - includes HQ/start area
 * - includes builder at start
 * - includes resource nodes near start
 * - includes more resources farther away
 * - map dimensions based on size option
 * - enough open space around HQ
 * - passes existing map validation or documents known limitation
 *
 * Design decisions:
 * - PRNG: simple mulberry32 — fast, deterministic, well-distributed
 * - No decorative assets, no advanced terrain, no obstacles (MVP)
 * - Resource placement uses concentric rings from HQ center
 * - Terrain is uniformly 'sand' with simple variation from PRNG
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

// ─── Generated map creation ─────────────────────────────────────────

/** HQ position offset from top-left (same for all generated maps). */
const HQ_OFFSET_TX = 4;
const HQ_OFFSET_TY = 4;

/**
 * Create a deterministic generated MapData from seed and size.
 *
 * The map has:
 * - All-sand terrain with subtle variation from PRNG
 * - HQ at (4, 4) with a 3×3 footprint
 * - One idle builder at (3, 3)
 * - Starter resource cluster near HQ (small + medium resources)
 * - Central infinite resource deposit
 * - Additional resource clusters scattered by PRNG
 * - No obstacles, no decor, no buildings (MVP)
 */
export function createGeneratedMapData(seed: string, size: MapSizeOption, faction: Faction = 'cyan'): MapData {
  const dims = mapSizeToDimensions(size);
  const W = dims.width;
  const H = dims.height;
  const seedInt = normalizeSeed(seed);
  const rng = mulberry32(seedInt);

  // ── Terrain: all sand with subtle variation ──
  const terrain: TerrainType[][] = [];
  const terrainVariants: TerrainType[] = ['sand', 'sand', 'sand', 'sand-light', 'sand-dark'];
  for (let y = 0; y < H; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < W; x++) {
      const idx = Math.floor(rng() * terrainVariants.length);
      row.push(terrainVariants[idx]);
    }
    terrain.push(row);
  }

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

  // ── Resources ──
  const resources = generateResources(rng, W, H, hq);

  // Ensure HQ area is clear of resources (3×3 HQ + 1 tile margin)
  const hqMinTx = hq.tx - 1;
  const hqMaxTx = hq.tx + 3;
  const hqMinTy = hq.ty - 1;
  const hqMaxTy = hq.ty + 3;

  const filteredResources = resources.filter(r => {
    // Check no overlap between resource footprint and HQ area
    for (let dy = 0; dy < r.footprint; dy++) {
      for (let dx = 0; dx < r.footprint; dx++) {
        const rtx = r.tx + dx;
        const rty = r.ty + dy;
        if (rtx >= hqMinTx && rtx <= hqMaxTx && rty >= hqMinTy && rty <= hqMaxTy) {
          return false;
        }
      }
    }
    return true;
  });

  return {
    width: W,
    height: H,
    terrain,
    hq,
    resources: filteredResources,
    obstacles: [],
    decor: [],
    buildings: [],
    builders,
    constructionSites: [],
  };
}

// ─── Resource generation ────────────────────────────────────────────

/**
 * Generate resource placements for a map.
 *
 * Strategy:
 * 1. Starter cluster: medium resources near HQ (SE direction)
 * 2. Central infinite deposit at map center
 * 3. Scattered clusters across the map via PRNG
 */
function generateResources(
  rng: () => number,
  W: number,
  H: number,
  hq: { tx: number; ty: number },
): Array<{ tx: number; ty: number; type: ResourceType; footprint: number }> {
  const resources: Array<{ tx: number; ty: number; type: ResourceType; footprint: number }> = [];
  const occupied = new Set<string>();

  // Mark HQ area as occupied (3×3 footprint + 1 tile margin)
  for (let dy = -1; dy <= 3; dy++) {
    for (let dx = -1; dx <= 3; dx++) {
      occupied.add(`${hq.tx + dx},${hq.ty + dy}`);
    }
  }

  /** Try to place a resource at (tx, ty) with given footprint. Returns true if placed. */
  function tryPlace(tx: number, ty: number, type: ResourceType, footprint: number): boolean {
    // Bounds check
    if (tx < 0 || ty < 0 || tx + footprint > W || ty + footprint > H) return false;

    // Overlap check
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

  // 1. Starter cluster: medium resources SE of HQ for reliable early harvesting
  const starterPositions = [
    { tx: hq.tx + 5, ty: hq.ty + 4 },
    { tx: hq.tx + 6, ty: hq.ty + 4 },
    { tx: hq.tx + 5, ty: hq.ty + 5 },
    { tx: hq.tx + 7, ty: hq.ty + 5 },
    { tx: hq.tx + 6, ty: hq.ty + 6 },
    { tx: hq.tx + 4, ty: hq.ty + 5 },
  ];
  for (const pos of starterPositions) {
    tryPlace(pos.tx, pos.ty, 'medium', 1);
  }

  // Small starter resources
  const smallStarterPositions = [
    { tx: hq.tx + 4, ty: hq.ty + 4 },
    { tx: hq.tx + 7, ty: hq.ty + 4 },
    { tx: hq.tx + 8, ty: hq.ty + 5 },
    { tx: hq.tx + 7, ty: hq.ty + 6 },
  ];
  for (const pos of smallStarterPositions) {
    tryPlace(pos.tx, pos.ty, 'small', 1);
  }

  // 2. Central infinite deposit
  const centerTx = Math.floor(W / 2) - 1;
  const centerTy = Math.floor(H / 2) - 1;
  tryPlace(centerTx, centerTy, 'infinite', 3);

  // 3. Scattered resource clusters
  // Number of clusters scales with map size
  const clusterCount = Math.floor((W * H) / 400); // ~2 for small, ~5 for standard, ~10 for large
  for (let c = 0; c < clusterCount; c++) {
    // Pick a random position, avoiding the very edges
    const clusterTx = 2 + Math.floor(rng() * (W - 8));
    const clusterTy = 2 + Math.floor(rng() * (H - 8));

    // Each cluster has 3-6 resources
    const clusterSize = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < clusterSize; i++) {
      const dx = Math.floor(rng() * 5) - 2;
      const dy = Math.floor(rng() * 5) - 2;
      const rtx = clusterTx + dx;
      const rty = clusterTy + dy;

      // Mix of small, medium, and large
      const typeRoll = rng();
      const type: ResourceType = typeRoll < 0.4 ? 'small' : typeRoll < 0.8 ? 'medium' : 'large';
      tryPlace(rtx, rty, type, 1);
    }
  }

  return resources;
}
