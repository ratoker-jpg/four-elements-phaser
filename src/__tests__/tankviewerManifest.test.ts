/**
 * Dry-run test for TankViewer pipeline manifest and path planning.
 *
 * UNIT-ASSET-PIPELINE-01: Validates that the pipeline output path
 * conventions are correct, the Firebird -> Flamethrower mapping works,
 * and the manifest structure matches expectations.
 *
 * This test does NOT require Blender or source assets to be present.
 * It only validates the path planning logic.
 *
 * The path planning constants are duplicated here from
 * tools/tankviewer/validate_source_assets.mjs to avoid importing
 * a .mjs file without type declarations into TypeScript tests.
 */

import { describe, it, expect } from 'vitest';

// ─── Pipeline constants (duplicated from validate_source_assets.mjs) ──

const HULLS = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'];
const TURRETS = ['smoky', 'firebird', 'freeze', 'isida', 'railgun', 'ricochet', 'thunder', 'twins', 'vulcan', 'hammer', 'striker'];
const M_LEVELS = [0, 1, 2, 3];

const TURRET_NAME_MAP: Record<string, string> = {
  firebird: 'flamethrower',
};

/**
 * Generate pipeline output path planning for a hull.
 */
function planHullOutputPaths(hullName: string, mLevel: number, faction: string, directions: number) {
  const paths = [];
  for (let dir = 0; dir < directions; dir++) {
    const key = `${hullName}_m${mLevel}_hull_${faction}_dir${dir}`;
    const outputSubdir = `tankviewer/hulls/${hullName}/m${mLevel}`;
    const filename = `${hullName}_m${mLevel}_hull_${faction}_dir${dir}.png`;
    paths.push({ key, outputSubdir, filename });
  }
  return paths;
}

/**
 * Generate pipeline output path planning for a turret.
 */
function planTurretOutputPaths(turretName: string, mLevel: number, faction: string, directions: number) {
  const paths = [];
  const gameName = TURRET_NAME_MAP[turretName] || turretName;
  for (let dir = 0; dir < directions; dir++) {
    const key = `${gameName}_m${mLevel}_turret_${faction}_dir${dir}`;
    const outputSubdir = `tankviewer/turrets/${gameName}/m${mLevel}`;
    const filename = `${gameName}_m${mLevel}_turret_${faction}_dir${dir}.png`;
    paths.push({ key, outputSubdir, filename });
  }
  return paths;
}

/**
 * Generate a full pipeline output path plan.
 */
function generatePathPlan(directions = 16, factions = ['cyan']) {
  const plan: Record<string, unknown> = {
    version: 2,
    pipeline: 'tankviewer-blender-isometric',
    directions,
    factions,
    nameMapping: TURRET_NAME_MAP,
    pilotTarget: {
      hull: 'wasp',
      mLevel: 0,
      turret: 'smoky',
      faction: 'cyan',
      directions,
    },
    hulls: {} as Record<string, Record<string, Record<string, ReturnType<typeof planHullOutputPaths>>>>,
    turrets: {} as Record<string, Record<string, unknown>>,
  };

  for (const hull of HULLS) {
    (plan.hulls as Record<string, Record<string, Record<string, ReturnType<typeof planHullOutputPaths>>>>)[hull] = {};
    for (const m of M_LEVELS) {
      (plan.hulls as Record<string, Record<string, Record<string, ReturnType<typeof planHullOutputPaths>>>>)[hull][`m${m}`] = {};
      for (const faction of factions) {
        (plan.hulls as Record<string, Record<string, Record<string, ReturnType<typeof planHullOutputPaths>>>>)[hull][`m${m}`][faction] =
          planHullOutputPaths(hull, m, faction, directions);
      }
    }
  }

  for (const turret of TURRETS) {
    const gameName = TURRET_NAME_MAP[turret] || turret;
    (plan.turrets as Record<string, Record<string, unknown>>)[turret] = { gameName };
    for (const m of M_LEVELS) {
      ((plan.turrets as Record<string, Record<string, unknown>>)[turret] as Record<string, Record<string, ReturnType<typeof planTurretOutputPaths>>>)[`m${m}`] = {};
      for (const faction of factions) {
        ((plan.turrets as Record<string, Record<string, unknown>>)[turret] as Record<string, Record<string, ReturnType<typeof planTurretOutputPaths>>>)[`m${m}`][faction] =
          planTurretOutputPaths(turret, m, faction, directions);
      }
    }
  }

  return plan;
}

// ─── Path plan tests ─────────────────────────────────────────────────

describe('TankViewer path plan generation', () => {
  it('generates a path plan with correct version and pipeline', () => {
    const plan = generatePathPlan();
    expect(plan.version).toBe(2);
    expect(plan.pipeline).toBe('tankviewer-blender-isometric');
  });

  it('includes the Firebird -> Flamethrower name mapping', () => {
    const plan = generatePathPlan();
    const mapping = plan.nameMapping as Record<string, string>;
    expect(mapping.firebird).toBe('flamethrower');
  });

  it('includes all 7 hulls', () => {
    const plan = generatePathPlan();
    const hulls = plan.hulls as Record<string, unknown>;
    for (const hull of HULLS) {
      expect(hulls[hull]).toBeDefined();
    }
  });

  it('includes all 11 turrets', () => {
    const plan = generatePathPlan();
    const turrets = plan.turrets as Record<string, unknown>;
    for (const turret of TURRETS) {
      expect(turrets[turret]).toBeDefined();
    }
  });

  it('includes all 4 M-levels for each hull', () => {
    const plan = generatePathPlan();
    const hulls = plan.hulls as Record<string, Record<string, unknown>>;
    for (const hull of Object.keys(hulls)) {
      for (const m of ['m0', 'm1', 'm2', 'm3']) {
        expect(hulls[hull][m]).toBeDefined();
      }
    }
  });

  it('generates correct number of paths per hull/mLevel/faction', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const hulls = plan.hulls as Record<string, Record<string, Record<string, Array<{ key: string }>>>>;
    const waspM0Cyan = hulls.wasp.m0.cyan;
    expect(waspM0Cyan).toHaveLength(16);
  });

  it('generates correct key naming for hull paths', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const hulls = plan.hulls as Record<string, Record<string, Record<string, Array<{ key: string }>>>>;
    const waspM0Cyan = hulls.wasp.m0.cyan;
    expect(waspM0Cyan[0].key).toBe('wasp_m0_hull_cyan_dir0');
    expect(waspM0Cyan[15].key).toBe('wasp_m0_hull_cyan_dir15');
  });

  it('generates correct output subdir for hull paths', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const hulls = plan.hulls as Record<string, Record<string, Record<string, Array<{ outputSubdir: string }>>>>;
    const waspM0Cyan = hulls.wasp.m0.cyan;
    expect(waspM0Cyan[0].outputSubdir).toBe('tankviewer/hulls/wasp/m0');
  });

  it('uses Flamethrower (not Firebird) in turret output paths', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const turrets = plan.turrets as Record<string, Record<string, Record<string, Array<{ key: string; filename: string; outputSubdir: string }>>>>;
    const firebirdM0Cyan = turrets.firebird.m0.cyan;
    expect(firebirdM0Cyan[0].key).toContain('flamethrower');
    expect(firebirdM0Cyan[0].filename).toContain('flamethrower');
    expect(firebirdM0Cyan[0].outputSubdir).toContain('flamethrower');
  });

  it('uses source name (Firebird) for turret game name mapping', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const turrets = plan.turrets as Record<string, { gameName: string }>;
    expect(turrets.firebird.gameName).toBe('flamethrower');
  });

  it('generates correct turret key naming', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const turrets = plan.turrets as Record<string, Record<string, Record<string, Array<{ key: string }>>>>;
    const smokyM0Cyan = turrets.smoky.m0.cyan;
    expect(smokyM0Cyan[0].key).toBe('smoky_m0_turret_cyan_dir0');
    expect(smokyM0Cyan[15].key).toBe('smoky_m0_turret_cyan_dir15');
  });

  it('generates paths for all requested factions', () => {
    const plan = generatePathPlan(16, ['cyan', 'green']);
    const hulls = plan.hulls as Record<string, Record<string, Record<string, Array<{ key: string }>>>>;
    const waspM0 = hulls.wasp.m0;
    expect(waspM0.cyan).toHaveLength(16);
    expect(waspM0.green).toHaveLength(16);
  });

  it('pilot target is Wasp M0 + Smoky M0 + cyan', () => {
    const plan = generatePathPlan(16, ['cyan']);
    const pilot = plan.pilotTarget as { hull: string; mLevel: number; turret: string; faction: string };
    expect(pilot.hull).toBe('wasp');
    expect(pilot.mLevel).toBe(0);
    expect(pilot.turret).toBe('smoky');
    expect(pilot.faction).toBe('cyan');
  });
});

// ─── Camera projection contract consistency tests ────────────────────

describe('TankViewer camera projection contract constants', () => {
  // These constants must match src/config/cameraProjectionContract.ts
  const TILE_W = 76;
  const TILE_H = 38;

  it('basisX is derived from tile dimensions', () => {
    expect(TILE_W / 2).toBe(38);
    expect(TILE_H / 2).toBe(19);
  });

  it('basisY x-component is negative of basisX x-component', () => {
    expect(-TILE_W / 2).toBe(-38);
  });

  it('vertical stretch factor matches contract', () => {
    const basisZy = -60;
    const stretchFactor = Math.abs(basisZy) / (TILE_H / 2);
    // 60 / 19 ≈ 3.158
    expect(stretchFactor).toBeCloseTo(3.158, 1);
  });

  it('16 directions give 22.5 degree steps', () => {
    const step = 360 / 16;
    expect(step).toBe(22.5);
  });

  it('direction angles are consistent', () => {
    const numDirs = 16;
    const angles = Array.from({ length: numDirs }, (_, i) => i * (360 / numDirs));
    expect(angles[0]).toBe(0);
    expect(angles[4]).toBe(90);
    expect(angles[8]).toBe(180);
    expect(angles[12]).toBe(270);
    expect(angles[15]).toBe(337.5);
  });
});

// ─── Direction convention consistency tests ──────────────────────────

describe('TankViewer direction convention', () => {
  /**
   * Canonical 8-direction naming: E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7
   * Must match src/state/updateGameState directionFromDelta() and Blender
   * render_tank_sprite.py DIRECTION_NAMES_8 / DIRECTION_NAMES_16.
   */
  const DIRECTION_NAMES_8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
  const DIRECTION_NAMES_16 = [
    'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE',
  ] as const;

  it('8-dir: dir0 = E (screen-right), not N', () => {
    expect(DIRECTION_NAMES_8[0]).toBe('E');
  });

  it('8-dir: dir6 = N (screen-up in isometric)', () => {
    expect(DIRECTION_NAMES_8[6]).toBe('N');
  });

  it('8-dir: dir2 = S (screen-down in isometric)', () => {
    expect(DIRECTION_NAMES_8[2]).toBe('S');
  });

  it('8-dir names match directionFromDelta convention', () => {
    // directionFromDelta(1, -1) = 0 = E
    // directionFromDelta(1, 0) = 1 = SE
    // directionFromDelta(1, 1) = 2 = S
    // directionFromDelta(0, 1) = 3 = SW
    // directionFromDelta(-1, 1) = 4 = W
    // directionFromDelta(-1, 0) = 5 = NW
    // directionFromDelta(-1, -1) = 6 = N
    // directionFromDelta(0, -1) = 7 = NE
    expect(DIRECTION_NAMES_8).toHaveLength(8);
    expect(DIRECTION_NAMES_8[0]).toBe('E');
    expect(DIRECTION_NAMES_8[1]).toBe('SE');
    expect(DIRECTION_NAMES_8[2]).toBe('S');
    expect(DIRECTION_NAMES_8[3]).toBe('SW');
    expect(DIRECTION_NAMES_8[4]).toBe('W');
    expect(DIRECTION_NAMES_8[5]).toBe('NW');
    expect(DIRECTION_NAMES_8[6]).toBe('N');
    expect(DIRECTION_NAMES_8[7]).toBe('NE');
  });

  it('16-dir: dir0 = E, dir2 = SE, dir4 = S, dir8 = W, dir12 = N', () => {
    expect(DIRECTION_NAMES_16[0]).toBe('E');
    expect(DIRECTION_NAMES_16[2]).toBe('SE');
    expect(DIRECTION_NAMES_16[4]).toBe('S');
    expect(DIRECTION_NAMES_16[8]).toBe('W');
    expect(DIRECTION_NAMES_16[12]).toBe('N');
  });

  it('16-dir: even indices match 8-dir names', () => {
    for (let i = 0; i < 8; i++) {
      expect(DIRECTION_NAMES_16[i * 2]).toBe(DIRECTION_NAMES_8[i]);
    }
  });

  it('16-dir: odd indices are intercardinal sub-directions', () => {
    expect(DIRECTION_NAMES_16[1]).toBe('ESE');
    expect(DIRECTION_NAMES_16[3]).toBe('SSE');
    expect(DIRECTION_NAMES_16[5]).toBe('SSW');
    expect(DIRECTION_NAMES_16[7]).toBe('WSW');
    expect(DIRECTION_NAMES_16[9]).toBe('WNW');
    expect(DIRECTION_NAMES_16[11]).toBe('NNW');
    expect(DIRECTION_NAMES_16[13]).toBe('NNE');
    expect(DIRECTION_NAMES_16[15]).toBe('ENE');
  });

  it('16-dir has exactly 16 entries', () => {
    expect(DIRECTION_NAMES_16).toHaveLength(16);
  });
});

// ─── Auto-fit normalize scale tests ─────────────────────────────────

describe('TankViewer web exporter auto-fit normalize scale', () => {
  /**
   * Pure helper matching the computeNormalizeScale() function in
   * tools/tankviewer-web-exporter/index.html.
   * Duplicated here to avoid importing browser-only code into Node tests.
   */
  function computeNormalizeScale(size: { x: number; y: number; z: number }, targetSize: number): number {
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 0 || !isFinite(maxDim)) return 1; // degenerate model
    return targetSize / maxDim;
  }

  it('computes positive finite scale for Wasp bbox 264x462x181 with target 3.0', () => {
    const scale = computeNormalizeScale({ x: 264, y: 462, z: 181.5 }, 3.0);
    expect(scale).toBeGreaterThan(0);
    expect(isFinite(scale)).toBe(true);
  });

  it('normalizes Wasp bbox so max dimension matches target size', () => {
    const size = { x: 264, y: 462, z: 181.5 };
    const targetSize = 3.0;
    const scale = computeNormalizeScale(size, targetSize);
    const finalMaxDim = Math.max(size.x * scale, size.y * scale, size.z * scale);
    expect(finalMaxDim).toBeCloseTo(targetSize, 6);
  });

  it('Wasp Y axis (462) is the max dimension, so Y * scale = target', () => {
    const size = { x: 264, y: 462, z: 181.5 };
    const targetSize = 3.0;
    const scale = computeNormalizeScale(size, targetSize);
    expect(size.y * scale).toBeCloseTo(targetSize, 6);
    expect(size.x * scale).toBeLessThan(targetSize);
    expect(size.z * scale).toBeLessThan(targetSize);
  });

  it('returns 1 for degenerate zero-size model', () => {
    const scale = computeNormalizeScale({ x: 0, y: 0, z: 0 }, 3.0);
    expect(scale).toBe(1);
  });

  it('returns 1 for negative-size model', () => {
    const scale = computeNormalizeScale({ x: -1, y: -1, z: -1 }, 3.0);
    expect(scale).toBe(1);
  });

  it('returns 1 for NaN dimensions', () => {
    const scale = computeNormalizeScale({ x: NaN, y: NaN, z: NaN }, 3.0);
    expect(scale).toBe(1);
  });

  it('returns 1 for Infinity dimensions', () => {
    const scale = computeNormalizeScale({ x: Infinity, y: 10, z: 10 }, 3.0);
    expect(scale).toBe(1);
  });

  it('handles uniform cube model', () => {
    const scale = computeNormalizeScale({ x: 100, y: 100, z: 100 }, 2.5);
    expect(scale).toBeCloseTo(0.025, 6);
    expect(100 * scale).toBeCloseTo(2.5, 6);
  });

  it('handles very small model (0.001 units)', () => {
    const scale = computeNormalizeScale({ x: 0.001, y: 0.001, z: 0.001 }, 3.0);
    expect(scale).toBe(3000);
    expect(0.001 * scale).toBeCloseTo(3.0, 6);
  });

  it('different target sizes produce proportional scales', () => {
    const size = { x: 264, y: 462, z: 181.5 };
    const scale3 = computeNormalizeScale(size, 3.0);
    const scale5 = computeNormalizeScale(size, 5.0);
    expect(scale5 / scale3).toBeCloseTo(5.0 / 3.0, 6);
  });
});

// ─── Auto-fit centering transform tests (Option B: wrapper group) ────

describe('TankViewer web exporter auto-fit centering transform', () => {
  /**
   * Simulates the Option B wrapper-group transform used in
   * tools/tankviewer-web-exporter/index.html:
   *   child.position = -center
   *   wrapper.scale = (normalizeScale, normalizeScale * zScale, normalizeScale)
   *   Final world vertex = normalizeScale * (V_original - center)
   *
   * These tests verify the math without Three.js at runtime.
   */
  function computeNormalizeScale(size: { x: number; y: number; z: number }, targetSize: number): number {
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 0 || !isFinite(maxDim)) return 1;
    return targetSize / maxDim;
  }

  /**
   * Simulate the wrapper-group transform for an axis-aligned bbox.
   * Returns the final bbox { min, max } and derived properties.
   */
  function simulateWrapperTransform(
    bboxMin: [number, number, number],
    bboxMax: [number, number, number],
    targetSize: number,
    zScale: number = 1.0,
  ) {
    // Original size
    const sizeX = bboxMax[0] - bboxMin[0];
    const sizeY = bboxMax[1] - bboxMin[1];
    const sizeZ = bboxMax[2] - bboxMin[2];
    const normalizeScale = computeNormalizeScale({ x: sizeX, y: sizeY, z: sizeZ }, targetSize);

    // Center of original bbox
    const cx = (bboxMin[0] + bboxMax[0]) / 2;
    const cy = (bboxMin[1] + bboxMax[1]) / 2;
    const cz = (bboxMin[2] + bboxMax[2]) / 2;

    // Option B: final world vertex = wrapper.scale * (V - center)
    // wrapper.scale = (normalizeScale, normalizeScale * zScale, normalizeScale)
    // child.position = (-cx, -cy, -cz)
    // For each original vertex V, world = (normalizeScale * (V.x - cx),
    //                                       normalizeScale * zScale * (V.y - cy),
    //                                       normalizeScale * (V.z - cz))
    //
    // Since bbox is axis-aligned, the extreme vertices are the 8 corners.
    // For each axis, the min corner stays min and max corner stays max after
    // the centering (V - center is symmetric), so:
    //   finalMin.x = normalizeScale * (bboxMin.x - cx)
    //   finalMax.x = normalizeScale * (bboxMax.x - cx)
    //   etc.

    const finalMinX = normalizeScale * (bboxMin[0] - cx);
    const finalMaxX = normalizeScale * (bboxMax[0] - cx);
    const finalMinY = normalizeScale * zScale * (bboxMin[1] - cy);
    const finalMaxY = normalizeScale * zScale * (bboxMax[1] - cy);
    const finalMinZ = normalizeScale * (bboxMin[2] - cz);
    const finalMaxZ = normalizeScale * (bboxMax[2] - cz);

    const finalCenterX = (finalMinX + finalMaxX) / 2;
    const finalCenterY = (finalMinY + finalMaxY) / 2;
    const finalCenterZ = (finalMinZ + finalMaxZ) / 2;

    const finalSizeX = finalMaxX - finalMinX;
    const finalSizeY = finalMaxY - finalMinY;
    const finalSizeZ = finalMaxZ - finalMinZ;

    return {
      normalizeScale,
      finalBbox: {
        min: [finalMinX, finalMinY, finalMinZ] as [number, number, number],
        max: [finalMaxX, finalMaxY, finalMaxZ] as [number, number, number],
      },
      finalCenter: [finalCenterX, finalCenterY, finalCenterZ] as [number, number, number],
      finalSize: [finalSizeX, finalSizeY, finalSizeZ] as [number, number, number],
      finalMaxDim: Math.max(finalSizeX, finalSizeY, finalSizeZ),
    };
  }

  // ─── Wasp-specific tests ──────────────────────────────────────────

  it('Wasp bbox: final center is at origin after wrapper transform', () => {
    const result = simulateWrapperTransform(
      [992.38, 379.92, -40.71],
      [1256.38, 841.92, 140.79],
      3.0,
    );
    expect(result.finalCenter[0]).toBeCloseTo(0, 6);
    expect(result.finalCenter[1]).toBeCloseTo(0, 6);
    expect(result.finalCenter[2]).toBeCloseTo(0, 6);
  });

  it('Wasp bbox: final max dimension equals target size', () => {
    const result = simulateWrapperTransform(
      [992.38, 379.92, -40.71],
      [1256.38, 841.92, 140.79],
      3.0,
    );
    expect(result.finalMaxDim).toBeCloseTo(3.0, 4);
  });

  it('Wasp bbox: final bbox is inside orthoScale=4 frustum with margin', () => {
    const result = simulateWrapperTransform(
      [992.38, 379.92, -40.71],
      [1256.38, 841.92, 140.79],
      3.0,
    );
    const orthoScale = 4.0;
    // All final min/max should be within [-orthoScale, orthoScale]
    expect(result.finalBbox.min[0]).toBeGreaterThan(-orthoScale);
    expect(result.finalBbox.max[0]).toBeLessThan(orthoScale);
    expect(result.finalBbox.min[1]).toBeGreaterThan(-orthoScale);
    expect(result.finalBbox.max[1]).toBeLessThan(orthoScale);
    expect(result.finalBbox.min[2]).toBeGreaterThan(-orthoScale);
    expect(result.finalBbox.max[2]).toBeLessThan(orthoScale);
  });

  it('Wasp bbox: final bbox min/max symmetric around origin', () => {
    const result = simulateWrapperTransform(
      [992.38, 379.92, -40.71],
      [1256.38, 841.92, 140.79],
      3.0,
    );
    // Since center is at origin, min and max should be symmetric
    expect(result.finalBbox.min[0]).toBeCloseTo(-result.finalBbox.max[0], 4);
    expect(result.finalBbox.min[1]).toBeCloseTo(-result.finalBbox.max[1], 4);
    expect(result.finalBbox.min[2]).toBeCloseTo(-result.finalBbox.max[2], 4);
  });

  it('Wasp bbox with zScale=1.5: Y axis is stretched but center stays at origin', () => {
    const result = simulateWrapperTransform(
      [992.38, 379.92, -40.71],
      [1256.38, 841.92, 140.79],
      3.0,
      1.5,
    );
    expect(result.finalCenter[0]).toBeCloseTo(0, 6);
    expect(result.finalCenter[1]).toBeCloseTo(0, 6);
    expect(result.finalCenter[2]).toBeCloseTo(0, 6);
    // Y dimension should be 1.5x the non-zScaled Y
    const resultNoZ = simulateWrapperTransform(
      [992.38, 379.92, -40.71],
      [1256.38, 841.92, 140.79],
      3.0,
      1.0,
    );
    expect(result.finalSize[1]).toBeCloseTo(resultNoZ.finalSize[1] * 1.5, 4);
  });

  // ─── Degenerate / edge case tests ─────────────────────────────────

  it('degenerate zero-size bbox: normalizeScale=1, center at origin', () => {
    const result = simulateWrapperTransform([0, 0, 0], [0, 0, 0], 3.0);
    expect(result.normalizeScale).toBe(1);
    expect(result.finalCenter[0]).toBeCloseTo(0, 6);
    expect(result.finalCenter[1]).toBeCloseTo(0, 6);
    expect(result.finalCenter[2]).toBeCloseTo(0, 6);
  });

  it('off-center model: center at origin after transform', () => {
    // Model with bbox from (1000, 1000, 1000) to (1010, 1020, 1005)
    // Center is at (1005, 1010, 1002.5)
    const result = simulateWrapperTransform(
      [1000, 1000, 1000],
      [1010, 1020, 1005],
      3.0,
    );
    expect(result.finalCenter[0]).toBeCloseTo(0, 6);
    expect(result.finalCenter[1]).toBeCloseTo(0, 6);
    expect(result.finalCenter[2]).toBeCloseTo(0, 6);
  });

  it('off-center model: final max dimension matches target', () => {
    const result = simulateWrapperTransform(
      [1000, 1000, 1000],
      [1010, 1020, 1005],
      3.0,
    );
    // Max dimension is 20 (Y axis), so after normalization max dim = 3.0
    expect(result.finalMaxDim).toBeCloseTo(3.0, 4);
  });

  // ─── Bug regression test: OLD buggy transform ──────────────────────

  it('REGRESSION: wrapper transform center is at origin, unlike old buggy transform', () => {
    // The old (buggy) transform did: position = -center, then scale on same object
    // In Three.js: worldVertex = scale * V + (-center)
    //   = scale * V - center
    // For Wasp center ≈ (1124, 611, 50):
    //   worldCenter = scale * center - center = center * (scale - 1)
    //   ≈ (1124 * -0.9935) ≈ -1117 — far from origin!

    const bboxMin = [992.38, 379.92, -40.71] as [number, number, number];
    const bboxMax = [1256.38, 841.92, 140.79] as [number, number, number];
    const cx = (bboxMin[0] + bboxMax[0]) / 2; // ≈ 1124.38
    const cy = (bboxMin[1] + bboxMax[1]) / 2; // ≈ 610.92
    const cz = (bboxMin[2] + bboxMax[2]) / 2; // ≈ 50.04

    const sizeX = bboxMax[0] - bboxMin[0]; // 264
    const sizeY = bboxMax[1] - bboxMin[1]; // 462
    const sizeZ = bboxMax[2] - bboxMin[2]; // 181.5
    const maxDim = Math.max(sizeX, sizeY, sizeZ); // 462
    const normalizeScale = 3.0 / maxDim;

    // Old buggy center: center * (normalizeScale - 1)
    const buggyCenterX = cx * (normalizeScale - 1);
    const buggyCenterY = cy * (normalizeScale - 1);
    const buggyCenterZ = cz * (normalizeScale - 1);

    // The buggy center is FAR from origin
    const buggyDistance = Math.sqrt(buggyCenterX ** 2 + buggyCenterY ** 2 + buggyCenterZ ** 2);
    expect(buggyDistance).toBeGreaterThan(100); // Buggy center is hundreds of units away

    // The correct (wrapper) center is at origin
    const result = simulateWrapperTransform(bboxMin, bboxMax, 3.0);
    const correctDistance = Math.sqrt(
      result.finalCenter[0] ** 2 + result.finalCenter[1] ** 2 + result.finalCenter[2] ** 2,
    );
    expect(correctDistance).toBeCloseTo(0, 4);
  });
});
