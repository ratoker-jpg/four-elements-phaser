#!/usr/bin/env node
/**
 * Asset processor for the Four Elements Phaser asset pipeline.
 *
 * ARCH-02D: MVP processor for the buildings family.
 *
 * Scans current approved runtime building assets under
 *   public/assets/factions/{cyan,green,yellow,purple}/buildings/
 * and generates:
 *   - art/generated/manifest.generated.json
 *   - art/generated/audit-report.json
 *
 * Does NOT copy or modify PNGs.
 * Does NOT change runtime loading.
 *
 * Usage:
 *   node tools/process_art_assets.mjs [options]
 *
 * Options:
 *   --family <name>   Asset family to process (default: "buildings")
 *   --root <dir>      Project root directory (default: auto-detected from script location)
 *   --json            Output machine-readable JSON instead of console report
 *   --dry-run         Process and validate but do not write output files
 *
 * Exit codes:
 *   0 — success (may have warnings)
 *   1 — processing errors found
 *   2 — invalid usage
 */

import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { validateManifest } from './validate_manifest.mjs';

// ─── Project paths ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function detectProjectRoot() {
  // Walk up from __dirname until we find package.json with our project name
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'four-elements-phaser') return dir;
      } catch { /* continue */ }
    }
    dir = dirname(dir);
  }
  // Fallback: assume tools/ is one level below root
  return dirname(__dirname);
}

// ESM-compatible readFileSync import
import { readFileSync } from 'node:fs';

// ─── Building constants (must match src/assets/buildingAssets.ts) ────

const FACTIONS = ['cyan', 'green', 'yellow', 'purple'];

const BUILDING_TYPES = [
  'separator',
  'raw-storage',
  'matter-storage',
  'power-plant',
  'command-relay',
  'units-factory',
];

const BUILDING_KEY_SUFFIXES = {
  'separator': 'separator',
  'raw-storage': 'raw_storage',
  'matter-storage': 'matter_storage',
  'power-plant': 'power_plant',
  'command-relay': 'command_relay',
  'units-factory': 'units_factory',
};

const BUILDING_FILE_NAMES = {
  'separator': 'separator.png',
  'raw-storage': 'raw_storage.png',
  'matter-storage': 'matter_storage.png',
  'power-plant': 'power_plant.png',
  'command-relay': 'command_relay.png',
  'units-factory': 'units_factory.png',
};

const HQ_FILE_NAME = 'hq_t1.png';

// ─── Core processing logic (exported for testing) ───────────────────

/**
 * Generate a building manifest key from faction and building type.
 *
 * @param {string} faction
 * @param {string} buildingType - Hyphenated building type (e.g. 'raw-storage')
 * @returns {string} Manifest key (e.g. 'building_cyan_raw_storage')
 */
export function generateBuildingKey(faction, buildingType) {
  const suffix = BUILDING_KEY_SUFFIXES[buildingType];
  if (!suffix) throw new Error(`Unknown building type: ${buildingType}`);
  return `building_${faction}_${suffix}`;
}

/**
 * Generate an HQ manifest key from faction.
 *
 * @param {string} faction
 * @returns {string} Manifest key (e.g. 'hq_cyan')
 */
export function generateHqKey(faction) {
  return `hq_${faction}`;
}

/**
 * Generate the runtime-relative path for a building PNG.
 *
 * @param {string} faction
 * @param {string} buildingType - Hyphenated building type
 * @returns {string} Path relative to public/ (e.g. 'assets/factions/cyan/buildings/separator.png')
 */
export function generateBuildingPath(faction, buildingType) {
  const filename = BUILDING_FILE_NAMES[buildingType];
  if (!filename) throw new Error(`Unknown building type: ${buildingType}`);
  return `assets/factions/${faction}/buildings/${filename}`;
}

/**
 * Generate the runtime-relative path for an HQ PNG.
 *
 * @param {string} faction
 * @returns {string} Path relative to public/ (e.g. 'assets/factions/cyan/buildings/hq_t1.png')
 */
export function generateHqPath(faction) {
  return `assets/factions/${faction}/buildings/${HQ_FILE_NAME}`;
}

/**
 * Process the buildings family and generate manifest + audit data.
 *
 * @param {object} options
 * @param {string} options.publicDir - Absolute path to public/ directory
 * @param {string[]} [options.factions] - Factions to process
 * @param {string[]} [options.buildingTypes] - Building types to process
 * @returns {{ manifest: object, auditReport: object }}
 */
export function processBuildingsFamily(options) {
  const {
    publicDir,
    factions = FACTIONS,
    buildingTypes = BUILDING_TYPES,
  } = options;

  const buildingKeys = [];
  const hqKeys = [];
  const paths = {};
  const auditWarnings = [];
  const auditErrors = [];
  const missingSource = [];
  const orphanFiles = [];

  let totalAssets = 0;
  let validAssets = 0;
  let warningAssets = 0;
  let errorAssets = 0;

  // ── Process HQ entries ────────────────────────────────────────────
  for (const faction of factions) {
    const key = generateHqKey(faction);
    const relativePath = generateHqPath(faction);
    const absolutePath = join(publicDir, relativePath);

    hqKeys.push(key);
    paths[key] = relativePath;
    totalAssets++;

    if (existsSync(absolutePath)) {
      validAssets++;
    } else {
      auditErrors.push({
        family: 'hq',
        key,
        code: 'MISSING_FILE',
        message: `Referenced file not found: ${relativePath}`,
      });
      missingSource.push(relativePath);
      errorAssets++;
    }
  }

  // ── Process building entries ──────────────────────────────────────
  for (const faction of factions) {
    for (const buildingType of buildingTypes) {
      const key = generateBuildingKey(faction, buildingType);
      const relativePath = generateBuildingPath(faction, buildingType);
      const absolutePath = join(publicDir, relativePath);

      buildingKeys.push(key);
      paths[key] = relativePath;
      totalAssets++;

      if (existsSync(absolutePath)) {
        validAssets++;
      } else {
        auditErrors.push({
          family: 'buildings',
          key,
          code: 'MISSING_FILE',
          message: `Referenced file not found: ${relativePath}`,
        });
        missingSource.push(relativePath);
        errorAssets++;
      }
    }
  }

  // ── Check for orphan files (files on disk not referenced by manifest) ──
  for (const faction of factions) {
    const buildingsDir = join(publicDir, 'assets', 'factions', faction, 'buildings');
    if (!existsSync(buildingsDir)) continue;

    const filesOnDisk = readdirSync(buildingsDir).filter(f => f.endsWith('.png'));

    // Build set of expected filenames for this faction
    const expectedFiles = new Set();
    expectedFiles.add(HQ_FILE_NAME);
    for (const buildingType of buildingTypes) {
      expectedFiles.add(BUILDING_FILE_NAMES[buildingType]);
    }

    for (const file of filesOnDisk) {
      if (!expectedFiles.has(file)) {
        const relativePath = `assets/factions/${faction}/buildings/${file}`;
        const key = `${faction}_${file.replace('.png', '')}`;
        auditWarnings.push({
          family: 'buildings',
          key,
          code: 'ORPHAN_FILE',
          message: `File on disk not referenced by manifest: ${relativePath}`,
        });
        orphanFiles.push(relativePath);
        warningAssets++;
      }
    }
  }

  // ── Build manifest ────────────────────────────────────────────────
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    families: {
      hq: {
        keys: hqKeys,
        loadType: 'image',
        enabled: true,
      },
      buildings: {
        keys: buildingKeys,
        loadType: 'image',
        enabled: true,
      },
    },
    paths,
  };

  // ── Build audit report ────────────────────────────────────────────
  const auditReport = {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAssets,
      validAssets,
      warningAssets,
      errorAssets,
    },
    warnings: auditWarnings,
    errors: auditErrors,
    missingSource,
    orphanFiles,
  };

  return { manifest, auditReport };
}

// ─── CLI entry point ────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage: node tools/process_art_assets.mjs [options]

Options:
  --family <name>   Asset family to process (default: "buildings")
  --root <dir>      Project root directory (default: auto-detected)
  --json            Output machine-readable JSON instead of console report
  --dry-run         Process and validate but do not write output files

Exit codes:
  0 — success (may have warnings)
  1 — processing errors found
  2 — invalid usage`);
}

async function main() {
  const args = process.argv.slice(2);

  let family = 'buildings';
  let projectRoot = null;
  let jsonOutput = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--family' && i + 1 < args.length) {
      family = args[++i];
    } else if (args[i] === '--root' && i + 1 < args.length) {
      projectRoot = args[++i];
    } else if (args[i] === '--json') {
      jsonOutput = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      printUsage();
      process.exit(2);
    }
  }

  // For this MVP, only buildings family is supported
  if (family !== 'buildings') {
    console.error(`Error: Only "buildings" family is supported in this MVP. Got: "${family}"`);
    process.exit(2);
  }

  // Detect project root
  if (!projectRoot) {
    projectRoot = detectProjectRoot();
  }
  projectRoot = resolve(projectRoot);

  const publicDir = join(projectRoot, 'public');
  const generatedDir = join(projectRoot, 'art', 'generated');

  if (!existsSync(publicDir)) {
    console.error(`Error: public/ directory not found at ${publicDir}`);
    process.exit(2);
  }

  // ── Process ───────────────────────────────────────────────────────
  const { manifest, auditReport } = processBuildingsFamily({ publicDir });

  // ── Validate manifest with validate_manifest.mjs ──────────────────
  const validation = validateManifest(manifest, { root: publicDir });

  // Merge validation errors into audit report
  if (validation.errors.length > 0) {
    for (const err of validation.errors) {
      // Avoid duplicates — only add if not already in auditErrors
      const alreadyExists = auditReport.errors.some(
        e => e.code === err.code && e.key === err.key && e.message === err.message
      );
      if (!alreadyExists) {
        auditReport.errors.push(err);
        auditReport.summary.errorAssets++;
      }
    }
  }

  // ── Run building metadata generator ───────────────────────────────
  let metaGeneratorResult = 'skipped';
  if (!dryRun) {
    try {
      const mjsPath = join(__dirname, 'generate_building_meta.mjs');
      if (existsSync(mjsPath)) {
        execSync(`node "${mjsPath}"`, {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 30000,
        });
        metaGeneratorResult = 'success';
      } else {
        metaGeneratorResult = 'not-found';
      }
    } catch (err) {
      metaGeneratorResult = `error: ${err.message}`;
      auditReport.warnings.push({
        family: 'buildings',
        key: null,
        code: 'META_GENERATOR_FAILED',
        message: `Building metadata generator failed: ${err.message}`,
      });
      auditReport.summary.warningAssets++;
    }
  }

  // ── Output ────────────────────────────────────────────────────────
  if (jsonOutput) {
    const output = {
      manifest,
      auditReport,
      validation: {
        valid: validation.errors.length === 0,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      metaGenerator: metaGeneratorResult,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('=== Asset Processor Report ===\n');
    console.log(`Family: ${family}`);
    console.log(`Project root: ${projectRoot}`);
    console.log(`Public dir: ${publicDir}`);
    console.log();

    console.log('Manifest summary:');
    console.log(`  HQ keys: ${manifest.families.hq.keys.length}`);
    console.log(`  Building keys: ${manifest.families.buildings.keys.length}`);
    console.log(`  Total paths: ${Object.keys(manifest.paths).length}`);
    console.log();

    console.log('Audit report:');
    console.log(`  Total assets: ${auditReport.summary.totalAssets}`);
    console.log(`  Valid: ${auditReport.summary.validAssets}`);
    console.log(`  Warnings: ${auditReport.summary.warningAssets}`);
    console.log(`  Errors: ${auditReport.summary.errorAssets}`);
    console.log();

    if (auditReport.errors.length > 0) {
      console.log(`ERRORS (${auditReport.errors.length}):`);
      for (const e of auditReport.errors) {
        const loc = e.family ? `[${e.family}]` : '';
        const key = e.key ? ` ${e.key}:` : '';
        console.log(`  ${e.code}${loc}${key} ${e.message}`);
      }
      console.log();
    }

    if (auditReport.warnings.length > 0) {
      console.log(`WARNINGS (${auditReport.warnings.length}):`);
      for (const w of auditReport.warnings) {
        const loc = w.family ? `[${w.family}]` : '';
        const key = w.key ? ` ${w.key}:` : '';
        console.log(`  ${w.code}${loc}${key} ${w.message}`);
      }
      console.log();
    }

    if (auditReport.orphanFiles.length > 0) {
      console.log(`ORPHAN FILES (${auditReport.orphanFiles.length}):`);
      for (const f of auditReport.orphanFiles) {
        console.log(`  ${f}`);
      }
      console.log();
    }

    if (auditReport.missingSource.length > 0) {
      console.log(`MISSING FILES (${auditReport.missingSource.length}):`);
      for (const f of auditReport.missingSource) {
        console.log(`  ${f}`);
      }
      console.log();
    }

    console.log(`Building metadata generator: ${metaGeneratorResult}`);
  }

  // ── Write output files ────────────────────────────────────────────
  if (!dryRun) {
    // Ensure generated dir exists
    mkdirSync(generatedDir, { recursive: true });

    const manifestPath = join(generatedDir, 'manifest.generated.json');
    const auditPath = join(generatedDir, 'audit-report.json');

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    writeFileSync(auditPath, JSON.stringify(auditReport, null, 2) + '\n', 'utf-8');

    if (!jsonOutput) {
      console.log(`\nOutput written:`);
      console.log(`  ${manifestPath}`);
      console.log(`  ${auditPath}`);
    }
  }

  // ── Exit code ─────────────────────────────────────────────────────
  if (auditReport.errors.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

// Run CLI if executed directly (not imported)
const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMainModule) {
  main();
}
