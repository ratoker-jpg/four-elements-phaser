#!/usr/bin/env node
/**
 * TankViewer source asset path validator.
 *
 * UNIT-ASSET-PIPELINE-01: Dry-run validation for the TankViewer pipeline.
 *
 * Checks that the expected source asset directory structure exists
 * under art/source/tankviewer/data/ and reports any missing files.
 * Does NOT require Blender or source assets to be present for CI success.
 *
 * Usage:
 *   node tools/tankviewer/validate_source_assets.mjs [options]
 *
 * Options:
 *   --root <dir>      Project root directory (default: auto-detected)
 *   --json            Output machine-readable JSON
 *   --dry-run         Check paths but do not report errors as failures
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Expected structure ──────────────────────────────────────────────

const HULLS = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'];
const TURRETS = ['smoky', 'firebird', 'freeze', 'isida', 'railgun', 'ricochet', 'thunder', 'twins', 'vulcan', 'hammer', 'striker'];
const M_LEVELS = [0, 1, 2, 3];

// Firebird = Flamethrower mapping
const TURRET_NAME_MAP = {
  'firebird': 'flamethrower',
};

/**
 * Generate expected file paths for a hull.
 */
function expectedHullFiles(hullName) {
  const files = [];
  // Try common .3ds naming patterns
  files.push({ path: `${hullName}.3ds`, required: true, type: 'model' });
  files.push({ path: `${hullName}_hull.3ds`, required: false, type: 'model-alt' });

  for (const m of M_LEVELS) {
    files.push({ path: `${hullName}_${m}_details.png`, required: true, type: 'diffuse', mLevel: m });
    files.push({ path: `${hullName}_${m}_lightmap.jpg`, required: true, type: 'lightmap', mLevel: m });
  }

  return files;
}

/**
 * Generate expected file paths for a turret.
 */
function expectedTurretFiles(turretName) {
  const files = [];
  files.push({ path: `${turretName}.3ds`, required: true, type: 'model' });

  for (const m of M_LEVELS) {
    files.push({ path: `${turretName}_${m}_details.png`, required: true, type: 'diffuse', mLevel: m });
    files.push({ path: `${turretName}_${m}_lightmap.jpg`, required: true, type: 'lightmap', mLevel: m });
  }

  return files;
}

/**
 * Generate pipeline output path planning for a hull.
 * This is the path naming convention that the Blender renderer will use.
 */
function planHullOutputPaths(hullName, mLevel, faction, directions) {
  const paths = [];
  const gameName = hullName; // hulls use same name

  for (let dir = 0; dir < directions; dir++) {
    const key = `${gameName}_m${mLevel}_hull_${faction}_dir${dir}`;
    const outputSubdir = `tankviewer/hulls/${gameName}/m${mLevel}`;
    const filename = `${gameName}_m${mLevel}_hull_${faction}_dir${dir}.png`;
    paths.push({ key, outputSubdir, filename });
  }

  return paths;
}

/**
 * Generate pipeline output path planning for a turret.
 */
function planTurretOutputPaths(turretName, mLevel, faction, directions) {
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
 * Validate source asset directory structure.
 */
export function validateSourceAssets(projectRoot) {
  const sourceBase = join(projectRoot, 'art', 'source', 'tankviewer', 'data');
  const result = {
    sourceBase,
    exists: existsSync(sourceBase),
    hulls: {},
    turrets: {},
    summary: {
      totalExpected: 0,
      found: 0,
      missing: 0,
      warnings: [],
    },
  };

  if (!result.exists) {
    result.summary.warnings.push(
      'Source directory does not exist. This is expected in CI — source assets are local/uncommitted.',
    );
    return result;
  }

  // Check hulls
  for (const hull of HULLS) {
    const hullDir = join(sourceBase, 'hulls', hull);
    const hullResult = {
      directory: hullDir,
      exists: existsSync(hullDir),
      files: {},
    };

    if (hullResult.exists) {
      const expected = expectedHullFiles(hull);
      for (const file of expected) {
        const filePath = join(hullDir, file.path);
        const fileExists = existsSync(filePath);
        hullResult.files[file.path] = {
          exists: fileExists,
          required: file.required,
          type: file.type,
          mLevel: file.mLevel,
        };
        result.summary.totalExpected++;
        if (fileExists) {
          result.summary.found++;
        } else if (file.required) {
          result.summary.missing++;
        }
      }

      // Check for unexpected files
      const diskFiles = readdirSync(hullDir).filter(f => !f.startsWith('.'));
      const expectedNames = new Set(expected.map(f => f.path));
      for (const f of diskFiles) {
        if (!expectedNames.has(f)) {
          hullResult.files[f] = { exists: true, required: false, type: 'unexpected' };
        }
      }
    }

    result.hulls[hull] = hullResult;
  }

  // Check turrets
  for (const turret of TURRETS) {
    const turretDir = join(sourceBase, 'turrets', turret);
    const turretResult = {
      directory: turretDir,
      exists: existsSync(turretDir),
      files: {},
      gameName: TURRET_NAME_MAP[turret] || turret,
    };

    if (turretResult.exists) {
      const expected = expectedTurretFiles(turret);
      for (const file of expected) {
        const filePath = join(turretDir, file.path);
        const fileExists = existsSync(filePath);
        turretResult.files[file.path] = {
          exists: fileExists,
          required: file.required,
          type: file.type,
          mLevel: file.mLevel,
        };
        result.summary.totalExpected++;
        if (fileExists) {
          result.summary.found++;
        } else if (file.required) {
          result.summary.missing++;
        }
      }
    }

    result.turrets[turret] = turretResult;
  }

  return result;
}

/**
 * Generate pipeline output path planning (dry-run manifest).
 */
export function generatePathPlan(projectRoot, directions = 16, factions = ['cyan']) {
  const plan = {
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
    hulls: {},
    turrets: {},
  };

  for (const hull of HULLS) {
    plan.hulls[hull] = {};
    for (const m of M_LEVELS) {
      plan.hulls[hull][`m${m}`] = {};
      for (const faction of factions) {
        plan.hulls[hull][`m${m}`][faction] = planHullOutputPaths(hull, m, faction, directions);
      }
    }
  }

  for (const turret of TURRETS) {
    const gameName = TURRET_NAME_MAP[turret] || turret;
    plan.turrets[turret] = { gameName };
    for (const m of M_LEVELS) {
      plan.turrets[turret][`m${m}`] = {};
      for (const faction of factions) {
        plan.turrets[turret][`m${m}`][faction] = planTurretOutputPaths(turret, m, faction, directions);
      }
    }
  }

  return plan;
}

// ─── CLI ─────────────────────────────────────────────────────────────

function detectProjectRoot() {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(
          await import('fs').then(fs => fs.readFileSync(join(dir, 'package.json'), 'utf-8')),
        );
        if (pkg.name === 'four-elements-phaser') return dir;
      } catch { /* continue */ }
    }
    dir = dirname(dir);
  }
  return dirname(dirname(__dirname));
}

function main() {
  const args = process.argv.slice(2);
  let projectRoot = null;
  let jsonOutput = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && i + 1 < args.length) {
      projectRoot = args[++i];
    } else if (args[i] === '--json') {
      jsonOutput = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (!projectRoot) {
    projectRoot = dirname(dirname(__dirname));
  }
  projectRoot = resolve(projectRoot);

  console.log('[validate_source_assets] Validating TankViewer source assets...');
  console.log(`  Project root: ${projectRoot}`);

  const validation = validateSourceAssets(projectRoot);

  if (jsonOutput) {
    console.log(JSON.stringify(validation, null, 2));
  } else {
    if (!validation.exists) {
      console.log('  Source directory not found (expected in CI).');
      console.log('  Place source assets under: art/source/tankviewer/data/');
    } else {
      console.log(`  Total expected files: ${validation.summary.totalExpected}`);
      console.log(`  Found: ${validation.summary.found}`);
      console.log(`  Missing: ${validation.summary.missing}`);
    }
  }

  // Generate path plan
  const pathPlan = generatePathPlan(projectRoot);
  const pilotPaths = pathPlan.hulls.wasp.m0.cyan;
  console.log(`\n[validate_source_assets] Pilot path plan (Wasp M0, cyan, ${pathPlan.directions} dirs):`);
  console.log(`  Output paths: ${pilotPaths.length}`);

  if (!dryRun && validation.summary.missing > 0 && validation.exists) {
    process.exit(1);
  }

  console.log('[validate_source_assets] Validation complete.');
}

main();
