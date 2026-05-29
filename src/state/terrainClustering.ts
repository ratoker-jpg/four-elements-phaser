/**
 * Terrain clustering / smoothing helpers — pure TypeScript, no Phaser.
 *
 * TERRAIN-01: Deterministic terrain visual variation using cellular
 * automata smoothing and per-tile tint computation. Works with the
 * existing sand textures to reduce chessboard/random-tile feeling
 * and create natural-looking soft clusters.
 *
 * TERRAIN-02A: Extended to the 6-variant 256×128 sand tile family.
 * All six terrain types (sand, sand-dark, sand-light, sand-ripple,
 * sand-pebble, sand-cracked) are handled in tint computation and
 * brightness ordering. Per-tile tint variation expanded to ±8%
 * for stronger visual variety with the new tile family.
 *
 * Design decisions:
 * - Cellular automata smoothing merges isolated single-tile variants
 *   into larger clusters by majority-neighbor replacement.
 * - Deterministic: same input always produces same output.
 * - Preserves map data structure — smoothing is a visual-only
 *   operation applied to a copy of the terrain array.
 * - Per-tile tint uses a fast integer hash for stable color variation
 *   without Math.random() or external dependencies.
 */

import type { TerrainType } from './types';

// ─── Types ──────────────────────────────────────────────────────────

/** TERRAIN-02A: Ordered terrain types by visual brightness (light → dark).
 *  Ripple is slightly lighter than base sand; pebble and cracked are
 *  slightly darker, placing them naturally in the brightness gradient. */
const TERRAIN_BRIGHTNESS_ORDER: TerrainType[] = [
  'sand-light', 'sand-ripple', 'sand', 'sand-pebble', 'sand-cracked', 'sand-dark'
];

// ─── Cellular automata smoothing ────────────────────────────────────

/**
 * Apply one pass of cellular automata smoothing to terrain data.
 *
 * For each tile, count neighbor terrain types (including self) in a
 * 3×3 window. If the current tile's type is NOT the majority type
 * among its neighbors AND the majority is at least 5 out of 9,
 * replace the current tile with the majority type.
 *
 * This merges isolated single-tile variants into surrounding clusters,
 * creating larger, softer patches without changing the overall
 * terrain distribution significantly.
 *
 * Deterministic: same input always produces same output.
 * Pure function: does not mutate the input array.
 */
export function smoothTerrainPass(terrain: TerrainType[][]): TerrainType[][] {
  const H = terrain.length;
  if (H === 0) return [];
  const W = terrain[0].length;

  const result: TerrainType[][] = terrain.map(row => [...row]);

  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const counts = new Map<TerrainType, number>();

      // Count terrain types in 3×3 neighborhood
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = ty + dy;
          const nx = tx + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
            const t = terrain[ny][nx];
            counts.set(t, (counts.get(t) ?? 0) + 1);
          }
        }
      }

      // Find majority type
      let majorityType: TerrainType = terrain[ty][tx];
      let majorityCount = 0;
      counts.forEach((count, type) => {
        if (count > majorityCount) {
          majorityCount = count;
          majorityType = type;
        }
      });

      // Replace if current tile is NOT the majority and majority is strong (>= 5/9)
      if (terrain[ty][tx] !== majorityType && majorityCount >= 5) {
        result[ty][tx] = majorityType;
      }
    }
  }

  return result;
}

/**
 * Apply multiple passes of terrain smoothing.
 *
 * More passes = larger, softer clusters. 2–3 passes is typically
 * sufficient to merge scattered single-tile variants into natural
 * patches while preserving intentional cluster boundaries.
 *
 * Deterministic: same input + same pass count = same output.
 * Pure function: does not mutate the input array.
 */
export function applyTerrainSmoothing(terrain: TerrainType[][], passes: number = 2): TerrainType[][] {
  let current = terrain.map(row => [...row]);
  for (let i = 0; i < passes; i++) {
    current = smoothTerrainPass(current);
  }
  return current;
}

// ─── Per-tile deterministic tint ────────────────────────────────────

/**
 * Compute a subtle deterministic tint for a terrain tile based on
 * its coordinates. This reduces visual repetition of identical
 * textures without requiring new asset files.
 *
 * Returns a Phaser-compatible tint value (0xRRGGBB).
 *
 * TERRAIN-02A: The tint is within ±8% of neutral white so that
 * the base texture colors are preserved while adding visual variety.
 * A fast integer hash ensures stability: the same (tx, ty) always
 * produces the same tint.
 *
 * All six terrain types have appropriate tint bases:
 * - sand: slightly warm base
 * - sand-dark: slightly cool base (darkest)
 * - sand-light: neutral-warm base (brightest)
 * - sand-ripple: slightly warm-cool (lighter variant)
 * - sand-pebble: slightly warm (mid-dark variant)
 * - sand-cracked: slightly cool (dark variant)
 *
 * @param tx - Tile X coordinate
 * @param ty - Tile Y coordinate
 * @param terrainType - The terrain type at this position (affects tint range)
 * @returns A Phaser tint integer (0xRRGGBB)
 */
export function computeTerrainTint(tx: number, ty: number, terrainType: TerrainType): number {
  // Fast deterministic hash from coordinates
  const hash = terrainTileHash(tx, ty);

  // Map hash to a color shift
  // TERRAIN-02A: Range: ±8% per channel (±20 out of 255)
  const shift = ((hash & 0xFF) - 128) / 128; // -1 to +1 (roughly)
  const shiftR = Math.round(shift * 20);
  const shiftG = Math.round(shift * 14);
  const shiftB = Math.round(shift * 17);

  // Base tint depends on terrain type for natural variation
  let baseR = 255, baseG = 255, baseB = 255;

  if (terrainType === 'sand-dark') {
    // Dark sand: subtle cool/warm variation
    baseR = 248 + shiftR;
    baseG = 245 + shiftG;
    baseB = 235 + shiftB;
  } else if (terrainType === 'sand-light') {
    // Light sand: subtle warm variation
    baseR = 255;
    baseG = 252 + shiftG;
    baseB = 240 + shiftB;
  } else if (terrainType === 'sand-ripple') {
    // Ripple: lighter variant, slightly warm-cool
    baseR = 254 + shiftR;
    baseG = 250 + shiftG;
    baseB = 242 + shiftB;
  } else if (terrainType === 'sand-pebble') {
    // Pebble: mid-dark variant, slightly warm
    baseR = 250 + shiftR;
    baseG = 247 + shiftG;
    baseB = 237 + shiftB;
  } else if (terrainType === 'sand-cracked') {
    // Cracked: dark variant, slightly cool
    baseR = 249 + shiftR;
    baseG = 244 + shiftG;
    baseB = 236 + shiftB;
  } else {
    // Base sand: subtle warm/cool variation
    baseR = 252 + shiftR;
    baseG = 248 + shiftG;
    baseB = 238 + shiftB;
  }

  // Clamp to valid range
  baseR = Math.max(0, Math.min(255, baseR));
  baseG = Math.max(0, Math.min(255, baseG));
  baseB = Math.max(0, Math.min(255, baseB));

  return (baseR << 16) | (baseG << 8) | baseB;
}

/**
 * Fast deterministic integer hash for terrain tile coordinates.
 *
 * Uses a variant of the xxHash32 mixing function for good distribution
 * with minimal computation. Returns a 32-bit unsigned integer.
 */
export function terrainTileHash(tx: number, ty: number): number {
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

/**
 * Get the terrain brightness index for ordering.
 *
 * TERRAIN-02A: Returns 0 for sand-light (brightest) through 5 for sand-dark (darkest).
 * Order: sand-light(0), sand-ripple(1), sand(2), sand-pebble(3), sand-cracked(4), sand-dark(5).
 */
export function terrainBrightnessIndex(type: TerrainType): number {
  return TERRAIN_BRIGHTNESS_ORDER.indexOf(type);
}
