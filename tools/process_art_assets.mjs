#!/usr/bin/env node
/**
 * Asset processor for the Four Elements Phaser asset pipeline.
 *
 * ARCH-02D: MVP processor for the buildings family.
 * ARCH-02F: Also generates src/assets/generatedAssetManifest.ts for runtime.
 * ARCH-02G: Also processes civilUnits family (builder/harvester spritesheets).
 *
 * Scans current approved runtime assets under
 *   public/assets/factions/{cyan,green,yellow,purple}/buildings/
 *   public/assets/factions/{cyan,green,yellow,purple}/units/
 * and generates:
 *   - art/generated/manifest.generated.json
 *   - art/generated/audit-report.json
 *   - src/assets/generatedAssetManifest.ts
 *
 * Does NOT copy or modify PNGs.
 * Does NOT change runtime loading.
 *
 * Usage:
 *   node tools/process_art_assets.mjs [options]
 *
 * Options:
 *   --family <name>   Asset family to process (default: "all")
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

// ─── Civil unit constants (must match src/assets/civilUnitAssets.ts) ──

const CIVIL_UNIT_TYPES = ['builder', 'harvester'];

const CIVIL_UNIT_FILE_NAMES = {
  builder: 'builder_8x8_256.png',
  harvester: 'harvester_8x8_256.png',
};

const CIVIL_UNIT_FRAME_CONFIG = {
  frameWidth: 256,
  frameHeight: 256,
  endFrame: 63,
};

// Deterministic timestamp for committed generated files.
// Using the epoch ensures rerunning the processor with unchanged inputs
// does not dirty the working tree.
const DETERMINISTIC_TIMESTAMP = '1970-01-01T00:00:00.000Z';

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
 * Process the civilUnits family and generate manifest + audit data.
 *
 * @param {object} options
 * @param {string} options.publicDir - Absolute path to public/ directory
 * @param {string[]} [options.factions] - Factions to process
 * @param {string[]} [options.civilUnitTypes] - Civil unit types to process
 * @returns {{ manifest: object, auditReport: object }}
 */
export function processCivilUnitsFamily(options) {
  const {
    publicDir,
    factions = FACTIONS,
    civilUnitTypes = CIVIL_UNIT_TYPES,
  } = options;

  const civilUnitKeys = [];
  const paths = {};
  const auditWarnings = [];
  const auditErrors = [];
  const missingSource = [];
  const orphanFiles = [];

  let totalAssets = 0;
  let validAssets = 0;
  let warningAssets = 0;
  let errorAssets = 0;

  // ── Process civil unit entries ────────────────────────────────────
  for (const faction of factions) {
    for (const unitType of civilUnitTypes) {
      const key = generateCivilUnitKey(faction, unitType);
      const relativePath = generateCivilUnitPath(faction, unitType);
      const absolutePath = join(publicDir, relativePath);

      civilUnitKeys.push(key);
      paths[key] = relativePath;
      totalAssets++;

      if (existsSync(absolutePath)) {
        validAssets++;
      } else {
        auditErrors.push({
          family: 'civilUnits',
          key,
          code: 'MISSING_FILE',
          message: `Referenced file not found: ${relativePath}`,
        });
        missingSource.push(relativePath);
        errorAssets++;
      }
    }
  }

  // ── Check for orphan files in units dirs ─────────────────────────
  for (const faction of factions) {
    const unitsDir = join(publicDir, 'assets', 'factions', faction, 'units');
    if (!existsSync(unitsDir)) continue;

    const filesOnDisk = readdirSync(unitsDir).filter(f => f.endsWith('.png'));

    // Build set of expected filenames for this faction
    const expectedFiles = new Set();
    for (const unitType of civilUnitTypes) {
      expectedFiles.add(CIVIL_UNIT_FILE_NAMES[unitType]);
    }

    for (const file of filesOnDisk) {
      if (!expectedFiles.has(file)) {
        const relativePath = `assets/factions/${faction}/units/${file}`;
        auditWarnings.push({
          family: 'civilUnits',
          key: `${faction}_${file.replace('.png', '')}`,
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
    generatedAt: DETERMINISTIC_TIMESTAMP,
    families: {
      civilUnits: {
        keys: civilUnitKeys,
        loadType: 'spritesheet',
        frameConfig: { ...CIVIL_UNIT_FRAME_CONFIG },
        enabled: true,
      },
    },
    paths,
  };

  // ── Build audit report ────────────────────────────────────────────
  const auditReport = {
    version: 1,
    generatedAt: DETERMINISTIC_TIMESTAMP,
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

/**
 * Generate a civil unit manifest key from faction and unit type.
 *
 * @param {string} faction
 * @param {string} unitType - e.g. 'builder', 'harvester'
 * @returns {string} Manifest key (e.g. 'builder_cyan')
 */
export function generateCivilUnitKey(faction, unitType) {
  return `${unitType}_${faction}`;
}

/**
 * Generate the runtime-relative path for a civil unit spritesheet.
 *
 * @param {string} faction
 * @param {string} unitType - e.g. 'builder', 'harvester'
 * @returns {string} Path relative to public/ (e.g. 'assets/factions/cyan/units/builder_8x8_256.png')
 */
export function generateCivilUnitPath(faction, unitType) {
  const filename = CIVIL_UNIT_FILE_NAMES[unitType];
  if (!filename) throw new Error(`Unknown civil unit type: ${unitType}`);
  return `assets/factions/${faction}/units/${filename}`;
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
    generatedAt: DETERMINISTIC_TIMESTAMP,
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
    generatedAt: DETERMINISTIC_TIMESTAMP,
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

// ─── Runtime TypeScript manifest generator ──────────────────────────

/**
 * Generate the TypeScript source for the runtime generated asset manifest.
 *
 * Produces a deterministic .ts file that can be imported by runtime code
 * without needing runtime JSON fetch or dynamic import.
 *
 * @param {object} manifest - The generated manifest object
 * @returns {string} TypeScript source code
 */
export function generateRuntimeManifestTS(manifest) {
  const lines = [];
  lines.push('/**');
  lines.push(' * Auto-generated runtime asset manifest.');
  lines.push(' *');
  lines.push(' * DO NOT EDIT — this file is generated by tools/process_art_assets.mjs.');
  lines.push(' * Any manual changes will be overwritten on the next processor run.');
  lines.push(' */');
  lines.push('');

  // Build the object literal
  lines.push('export const GENERATED_ASSET_MANIFEST = {');
  lines.push(`  version: ${manifest.version},`);
  lines.push(`  generatedAt: '${manifest.generatedAt}',`);
  lines.push('  families: {');

  const familyNames = Object.keys(manifest.families);
  for (let fi = 0; fi < familyNames.length; fi++) {
    const familyName = familyNames[fi];
    const family = manifest.families[familyName];
    lines.push(`    ${familyName}: {`);
    lines.push(`      keys: [${family.keys.map(k => `'${k}'`).join(', ')}],`);
    lines.push(`      loadType: '${family.loadType}',`);
    if (family.frameConfig) {
      lines.push(`      frameConfig: { frameWidth: ${family.frameConfig.frameWidth}, frameHeight: ${family.frameConfig.frameHeight}, endFrame: ${family.frameConfig.endFrame} },`);
    }
    lines.push(`      enabled: ${family.enabled},`);
    lines.push('    },');
  }

  lines.push('  },');
  lines.push('  paths: {');

  const pathKeys = Object.keys(manifest.paths);
  for (let pi = 0; pi < pathKeys.length; pi++) {
    const key = pathKeys[pi];
    const path = manifest.paths[key];
    lines.push(`    '${key}': '${path}',`);
  }

  lines.push('  },');
  lines.push('} as const;');
  lines.push('');

  // Type exports
  lines.push('export type GeneratedAssetKey = keyof typeof GENERATED_ASSET_MANIFEST.paths;');
  lines.push('export type GeneratedAssetFamilyName = keyof typeof GENERATED_ASSET_MANIFEST.families;');
  lines.push('');

  return lines.join('\n');
}

// ─── CLI entry point ────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage: node tools/process_art_assets.mjs [options]

Options:
  --family <name>   Asset family to process: "buildings", "civilUnits", or "all" (default: "all")
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

  let family = 'all';
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

  const VALID_FAMILIES = new Set(['buildings', 'civilUnits', 'all']);
  if (!VALID_FAMILIES.has(family)) {
    console.error(`Error: Unknown family "${family}". Valid: buildings, civilUnits, all`);
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
  const processBuildings = family === 'buildings' || family === 'all';
  const processCivilUnits = family === 'civilUnits' || family === 'all';

  // Collect results from each family
  let combinedManifest = {
    version: 1,
    generatedAt: DETERMINISTIC_TIMESTAMP,
    families: {},
    paths: {},
  };
  let combinedAudit = {
    version: 1,
    generatedAt: DETERMINISTIC_TIMESTAMP,
    summary: { totalAssets: 0, validAssets: 0, warningAssets: 0, errorAssets: 0 },
    warnings: [],
    errors: [],
    missingSource: [],
    orphanFiles: [],
  };

  function mergeResult(manifest, auditReport) {
    Object.assign(combinedManifest.families, manifest.families);
    Object.assign(combinedManifest.paths, manifest.paths);
    combinedAudit.summary.totalAssets += auditReport.summary.totalAssets;
    combinedAudit.summary.validAssets += auditReport.summary.validAssets;
    combinedAudit.summary.warningAssets += auditReport.summary.warningAssets;
    combinedAudit.summary.errorAssets += auditReport.summary.errorAssets;
    combinedAudit.warnings.push(...auditReport.warnings);
    combinedAudit.errors.push(...auditReport.errors);
    combinedAudit.missingSource.push(...auditReport.missingSource);
    combinedAudit.orphanFiles.push(...auditReport.orphanFiles);
  }

  if (processBuildings) {
    const { manifest, auditReport } = processBuildingsFamily({ publicDir });
    mergeResult(manifest, auditReport);
  }

  if (processCivilUnits) {
    const { manifest, auditReport } = processCivilUnitsFamily({ publicDir });
    mergeResult(manifest, auditReport);
  }

  const { manifest, auditReport } = { manifest: combinedManifest, auditReport: combinedAudit };

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
    if (manifest.families.hq) console.log(`  HQ keys: ${manifest.families.hq.keys.length}`);
    if (manifest.families.buildings) console.log(`  Building keys: ${manifest.families.buildings.keys.length}`);
    if (manifest.families.civilUnits) console.log(`  Civil unit keys: ${manifest.families.civilUnits.keys.length}`);
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
    const runtimeTsPath = join(projectRoot, 'src', 'assets', 'generatedAssetManifest.ts');

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    writeFileSync(auditPath, JSON.stringify(auditReport, null, 2) + '\n', 'utf-8');

    // Generate runtime TypeScript manifest
    const runtimeTsSource = generateRuntimeManifestTS(manifest);
    writeFileSync(runtimeTsPath, runtimeTsSource, 'utf-8');

    if (!jsonOutput) {
      console.log(`\nOutput written:`);
      console.log(`  ${manifestPath}`);
      console.log(`  ${auditPath}`);
      console.log(`  ${runtimeTsPath}`);
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
