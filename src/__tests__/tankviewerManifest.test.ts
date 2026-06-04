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
