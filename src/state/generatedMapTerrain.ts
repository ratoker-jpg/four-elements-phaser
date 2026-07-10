import type { TerrainType } from './types';

interface TerrainPatch {
  cx: number;
  cy: number;
  radius: number;
  type: TerrainType;
}

/** Generate deterministic clustered desert terrain. */
export function generateTerrain(rng: () => number, width: number, height: number): TerrainType[][] {
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < width; x++) row.push('sand');
    terrain.push(row);
  }

  const primaryPatchCount = Math.floor((width * height) / 200);
  const patches: TerrainPatch[] = [];

  for (let i = 0; i < primaryPatchCount; i++) {
    const cx = Math.floor(rng() * width);
    const cy = Math.floor(rng() * height);
    const radius = 3 + Math.floor(rng() * 5);
    const type: TerrainType = rng() < 0.55 ? 'sand-light' : 'sand-dark';
    patches.push({ cx, cy, radius, type });
  }

  const accentPatchCount = Math.floor((width * height) / 250);
  for (let i = 0; i < accentPatchCount; i++) {
    const cx = Math.floor(rng() * width);
    const cy = Math.floor(rng() * height);
    const radius = 1 + Math.floor(rng() * 3);
    const typeRoll = rng();
    const type: TerrainType = typeRoll < 0.4 ? 'sand-dark' : typeRoll < 0.8 ? 'sand-light' : 'sand';
    patches.push({ cx, cy, radius, type });
  }

  for (const patch of patches) {
    for (let dy = -patch.radius; dy <= patch.radius; dy++) {
      for (let dx = -patch.radius; dx <= patch.radius; dx++) {
        const chebyshevDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (chebyshevDist > patch.radius) continue;

        const tx = patch.cx + dx;
        const ty = patch.cy + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;

        const distRatio = chebyshevDist / patch.radius;
        const applyProbability = 1.0 - distRatio * distRatio * 0.8;
        if (rng() < applyProbability) terrain[ty][tx] = patch.type;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] !== 'sand') continue;
      const roll = rng();
      if (roll < 0.05) terrain[y][x] = 'sand-ripple';
      else if (roll < 0.07) terrain[y][x] = 'sand-pebble';
      else if (roll < 0.09) terrain[y][x] = 'sand-cracked';
    }
  }

  return terrain;
}

/** Generate a flat industrial state grid; visual variation remains renderer-owned. */
export function generateIndustrialTerrain(width: number, height: number): TerrainType[][] {
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < width; x++) row.push('industrial');
    terrain.push(row);
  }
  return terrain;
}
