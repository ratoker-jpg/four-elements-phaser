#!/usr/bin/env node
/**
 * Tests for tools/process_art_assets.mjs
 *
 * ARCH-02D: Self-contained test runner using Node.js built-in assert.
 * No external dependencies required.
 *
 * Usage:
 *   node tools/test_process_art_assets.mjs
 */

import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateBuildingKey,
  generateHqKey,
  generateBuildingPath,
  generateHqPath,
  processBuildingsFamily,
  processCivilUnitsFamily,
  generateCivilUnitKey,
  generateCivilUnitPath,
  processModularUnitsFamily,
  generateModularUnitKey,
  generateModularUnitPath,
  generateRuntimeManifestTS,
} from './process_art_assets.mjs';
import { validateManifest } from './validate_manifest.mjs';

// ─── Test helpers ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

/** Create a temp directory with building fixtures for testing. */
function createBuildingFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  const factions = ['cyan', 'green', 'yellow', 'purple'];
  const files = [
    'hq_t1.png',
    'separator.png',
    'raw_storage.png',
    'matter_storage.png',
    'power_plant.png',
    'command_relay.png',
    'units_factory.png',
  ];

  for (const faction of factions) {
    const dir = join(publicDir, 'assets', 'factions', faction, 'buildings');
    mkdirSync(dir, { recursive: true });
    for (const file of files) {
      writeFileSync(join(dir, file), 'fake-png');
    }
  }

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Create a temp directory with partial fixtures (missing some files). */
function createPartialFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  // Only create cyan with full set
  const dir = join(publicDir, 'assets', 'factions', 'cyan', 'buildings');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'hq_t1.png'), 'fake-png');
  writeFileSync(join(dir, 'separator.png'), 'fake-png');

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ─── Test cases ───────────────────────────────────────────────────────

console.log('\nprocess_art_assets tests\n');

// ── Building key generation ─────────────────────────────────────────

test('generateBuildingKey produces correct key for separator', () => {
  assert.strictEqual(generateBuildingKey('cyan', 'separator'), 'building_cyan_separator');
});

test('generateBuildingKey produces correct key for hyphenated type', () => {
  assert.strictEqual(generateBuildingKey('green', 'raw-storage'), 'building_green_raw_storage');
  assert.strictEqual(generateBuildingKey('yellow', 'power-plant'), 'building_yellow_power_plant');
  assert.strictEqual(generateBuildingKey('purple', 'units-factory'), 'building_purple_units_factory');
});

test('generateBuildingKey throws for unknown building type', () => {
  assert.throws(() => generateBuildingKey('cyan', 'nonexistent'), /Unknown building type/);
});

// ── HQ key generation ───────────────────────────────────────────────

test('generateHqKey produces correct key', () => {
  assert.strictEqual(generateHqKey('cyan'), 'hq_cyan');
  assert.strictEqual(generateHqKey('green'), 'hq_green');
  assert.strictEqual(generateHqKey('yellow'), 'hq_yellow');
  assert.strictEqual(generateHqKey('purple'), 'hq_purple');
});

// ── Building path generation ────────────────────────────────────────

test('generateBuildingPath produces correct path for separator', () => {
  assert.strictEqual(
    generateBuildingPath('cyan', 'separator'),
    'assets/factions/cyan/buildings/separator.png',
  );
});

test('generateBuildingPath produces correct path for hyphenated type', () => {
  assert.strictEqual(
    generateBuildingPath('green', 'raw-storage'),
    'assets/factions/green/buildings/raw_storage.png',
  );
  assert.strictEqual(
    generateBuildingPath('purple', 'units-factory'),
    'assets/factions/purple/buildings/units_factory.png',
  );
});

test('generateBuildingPath throws for unknown building type', () => {
  assert.throws(() => generateBuildingPath('cyan', 'bogus'), /Unknown building type/);
});

// ── HQ path generation ──────────────────────────────────────────────

test('generateHqPath produces correct path', () => {
  assert.strictEqual(
    generateHqPath('cyan'),
    'assets/factions/cyan/buildings/hq_t1.png',
  );
  assert.strictEqual(
    generateHqPath('purple'),
    'assets/factions/purple/buildings/hq_t1.png',
  );
});

// ── Manifest generation shape ───────────────────────────────────────

test('manifest generation produces correct shape with all fixtures', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });

    // Top-level fields
    assert.strictEqual(manifest.version, 1);
    assert.strictEqual(typeof manifest.generatedAt, 'string');
    assert.ok(manifest.generatedAt.length > 0);

    // Families
    assert.ok(manifest.families.hq);
    assert.ok(manifest.families.buildings);
    assert.strictEqual(manifest.families.hq.loadType, 'image');
    assert.strictEqual(manifest.families.buildings.loadType, 'image');
    assert.strictEqual(manifest.families.hq.enabled, true);
    assert.strictEqual(manifest.families.buildings.enabled, true);

    // Keys
    assert.strictEqual(manifest.families.hq.keys.length, 4); // 4 factions
    assert.strictEqual(manifest.families.buildings.keys.length, 24); // 6 types × 4 factions

    // Paths
    assert.strictEqual(Object.keys(manifest.paths).length, 28); // 4 HQ + 24 buildings

    // No non-building families
    assert.strictEqual(manifest.families.terrain, undefined);
    assert.strictEqual(manifest.families.civilUnits, undefined);
    assert.strictEqual(manifest.families.modularUnits, undefined);
  } finally {
    cleanup();
  }
});

test('manifest contains all expected HQ keys', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const hqKeys = manifest.families.hq.keys;
    assert.ok(hqKeys.includes('hq_cyan'));
    assert.ok(hqKeys.includes('hq_green'));
    assert.ok(hqKeys.includes('hq_yellow'));
    assert.ok(hqKeys.includes('hq_purple'));
  } finally {
    cleanup();
  }
});

test('manifest contains all expected building keys for one faction', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const buildingKeys = manifest.families.buildings.keys;
    assert.ok(buildingKeys.includes('building_cyan_separator'));
    assert.ok(buildingKeys.includes('building_cyan_raw_storage'));
    assert.ok(buildingKeys.includes('building_cyan_matter_storage'));
    assert.ok(buildingKeys.includes('building_cyan_power_plant'));
    assert.ok(buildingKeys.includes('building_cyan_command_relay'));
    assert.ok(buildingKeys.includes('building_cyan_units_factory'));
  } finally {
    cleanup();
  }
});

// ── Audit report shape ──────────────────────────────────────────────

test('audit report has correct shape with all fixtures', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { auditReport } = processBuildingsFamily({ publicDir });

    // Top-level fields
    assert.strictEqual(auditReport.version, 1);
    assert.strictEqual(typeof auditReport.generatedAt, 'string');

    // Summary
    assert.strictEqual(auditReport.summary.totalAssets, 28); // 4 HQ + 24 buildings
    assert.strictEqual(auditReport.summary.validAssets, 28);
    assert.strictEqual(auditReport.summary.warningAssets, 0);
    assert.strictEqual(auditReport.summary.errorAssets, 0);

    // Lists
    assert.ok(Array.isArray(auditReport.warnings));
    assert.ok(Array.isArray(auditReport.errors));
    assert.ok(Array.isArray(auditReport.missingSource));
    assert.ok(Array.isArray(auditReport.orphanFiles));
    assert.strictEqual(auditReport.warnings.length, 0);
    assert.strictEqual(auditReport.errors.length, 0);
  } finally {
    cleanup();
  }
});

// ── Missing expected file becomes error ─────────────────────────────

test('missing expected building file creates MISSING_FILE error', () => {
  const { publicDir, cleanup } = createPartialFixtures();
  try {
    const { auditReport } = processBuildingsFamily({ publicDir });

    // Should have many errors for missing files
    assert.ok(auditReport.errors.length > 0, 'Should have errors for missing files');

    const missingFileErrors = auditReport.errors.filter(e => e.code === 'MISSING_FILE');
    assert.ok(missingFileErrors.length > 0, 'Should have MISSING_FILE errors');

    // cyan has only hq_t1 + separator; other 5 building types are missing
    assert.ok(
      missingFileErrors.some(e => e.key.includes('raw_storage')),
      'Should report missing raw_storage',
    );
  } finally {
    cleanup();
  }
});

test('missing HQ file creates MISSING_FILE error', () => {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  try {
    const publicDir = join(root, 'public');
    // Create only green buildings dir with only separator — no HQ
    const dir = join(publicDir, 'assets', 'factions', 'green', 'buildings');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'separator.png'), 'fake-png');

    const { auditReport } = processBuildingsFamily({
      publicDir,
      factions: ['green'],
      buildingTypes: ['separator'],
    });

    const missingHq = auditReport.errors.find(e => e.key === 'hq_green');
    assert.ok(missingHq, 'Should report missing HQ file');
    assert.strictEqual(missingHq.code, 'MISSING_FILE');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Unexpected extra file becomes warning ───────────────────────────

test('unexpected extra file in buildings dir creates ORPHAN_FILE warning', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    // Add an extra file to cyan buildings
    const extraFile = join(publicDir, 'assets', 'factions', 'cyan', 'buildings', 'mystery_building.png');
    writeFileSync(extraFile, 'fake-png');

    const { auditReport } = processBuildingsFamily({ publicDir });

    const orphanWarning = auditReport.warnings.find(w => w.code === 'ORPHAN_FILE');
    assert.ok(orphanWarning, 'Should warn about orphan file');
    assert.ok(orphanWarning.message.includes('mystery_building.png'));

    // Check orphanFiles list
    assert.ok(auditReport.orphanFiles.length > 0, 'Should list orphan files');
    assert.ok(auditReport.orphanFiles[0].includes('mystery_building.png'));
  } finally {
    cleanup();
  }
});

// ── Generated manifest passes validateManifest ──────────────────────

test('generated manifest passes validateManifest with all fixtures', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const { errors } = validateManifest(manifest, { root: publicDir });
    assert.strictEqual(errors.length, 0, `Expected 0 validation errors, got: ${JSON.stringify(errors)}`);
  } finally {
    cleanup();
  }
});

test('generated manifest passes validateManifest without root (no file checks)', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const { errors } = validateManifest(manifest);
    assert.strictEqual(errors.length, 0, `Expected 0 validation errors, got: ${JSON.stringify(errors)}`);
  } finally {
    cleanup();
  }
});

// ── Disabled/non-building families not introduced ───────────────────

test('processor does not introduce terrain family', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    assert.strictEqual(manifest.families.terrain, undefined);
    assert.strictEqual(manifest.families.civilUnits, undefined);
    assert.strictEqual(manifest.families.modularUnits, undefined);
    assert.strictEqual(manifest.families.resources, undefined);
    assert.strictEqual(manifest.families.decor, undefined);
    assert.strictEqual(manifest.families.fx, undefined);
    assert.strictEqual(manifest.families.ui, undefined);
  } finally {
    cleanup();
  }
});

// ── Processor works with temp fixture directory ─────────────────────

test('processor works with minimal single-faction single-type fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  try {
    const publicDir = join(root, 'public');
    const dir = join(publicDir, 'assets', 'factions', 'cyan', 'buildings');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'hq_t1.png'), 'fake-png');
    writeFileSync(join(dir, 'separator.png'), 'fake-png');

    const { manifest, auditReport } = processBuildingsFamily({
      publicDir,
      factions: ['cyan'],
      buildingTypes: ['separator'],
    });

    assert.strictEqual(manifest.families.hq.keys.length, 1);
    assert.strictEqual(manifest.families.buildings.keys.length, 1);
    assert.strictEqual(manifest.families.hq.keys[0], 'hq_cyan');
    assert.strictEqual(manifest.families.buildings.keys[0], 'building_cyan_separator');
    assert.strictEqual(auditReport.summary.totalAssets, 2);
    assert.strictEqual(auditReport.summary.errorAssets, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('processor detects no orphans when all files are expected', () => {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  try {
    const publicDir = join(root, 'public');
    const dir = join(publicDir, 'assets', 'factions', 'cyan', 'buildings');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'hq_t1.png'), 'fake-png');
    writeFileSync(join(dir, 'separator.png'), 'fake-png');

    const { auditReport } = processBuildingsFamily({
      publicDir,
      factions: ['cyan'],
      buildingTypes: ['separator'],
    });

    assert.strictEqual(auditReport.orphanFiles.length, 0, 'Should have no orphan files');
    assert.strictEqual(auditReport.warnings.length, 0, 'Should have no warnings');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Path mapping correctness ────────────────────────────────────────

test('manifest paths map keys to correct relative paths', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });

    assert.strictEqual(manifest.paths['hq_cyan'], 'assets/factions/cyan/buildings/hq_t1.png');
    assert.strictEqual(manifest.paths['building_cyan_separator'], 'assets/factions/cyan/buildings/separator.png');
    assert.strictEqual(manifest.paths['building_green_power_plant'], 'assets/factions/green/buildings/power_plant.png');
    assert.strictEqual(manifest.paths['building_purple_units_factory'], 'assets/factions/purple/buildings/units_factory.png');
  } finally {
    cleanup();
  }
});

// ── Deterministic output: repeated generation produces identical results ──

test('repeated generation with same fixtures produces identical manifest', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest: first } = processBuildingsFamily({ publicDir });
    const { manifest: second } = processBuildingsFamily({ publicDir });
    assert.deepStrictEqual(first, second, 'Two runs with same input must produce identical manifests');
  } finally {
    cleanup();
  }
});

test('repeated generation with same fixtures produces identical audit report', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { auditReport: first } = processBuildingsFamily({ publicDir });
    const { auditReport: second } = processBuildingsFamily({ publicDir });
    assert.deepStrictEqual(first, second, 'Two runs with same input must produce identical audit reports');
  } finally {
    cleanup();
  }
});

test('generated manifest uses deterministic generatedAt timestamp', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest, auditReport } = processBuildingsFamily({ publicDir });
    assert.strictEqual(manifest.generatedAt, '1970-01-01T00:00:00.000Z',
      'Manifest generatedAt must be the deterministic epoch value');
    assert.strictEqual(auditReport.generatedAt, '1970-01-01T00:00:00.000Z',
      'Audit report generatedAt must be the deterministic epoch value');
  } finally {
    cleanup();
  }
});

test('repeated generation with partial fixtures produces identical output', () => {
  const { publicDir, cleanup } = createPartialFixtures();
  try {
    const first = processBuildingsFamily({ publicDir });
    const second = processBuildingsFamily({ publicDir });
    assert.deepStrictEqual(first.manifest, second.manifest,
      'Partial fixture manifests must be identical across runs');
    assert.deepStrictEqual(first.auditReport, second.auditReport,
      'Partial fixture audit reports must be identical across runs');
  } finally {
    cleanup();
  }
});

test('serialized manifest is byte-identical across runs', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const serialized1 = JSON.stringify(manifest, null, 2);
    const serialized2 = JSON.stringify(processBuildingsFamily({ publicDir }).manifest, null, 2);
    assert.strictEqual(serialized1, serialized2,
      'Serialized manifest output must be byte-identical across runs');
  } finally {
    cleanup();
  }
});

// ── Runtime TypeScript manifest generation (ARCH-02F) ──────────────

test('generateRuntimeManifestTS produces valid TypeScript with hq + buildings families', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const ts = generateRuntimeManifestTS(manifest);

    // Must contain key structural elements
    assert.ok(ts.includes('export const GENERATED_ASSET_MANIFEST'), 'Must export const');
    assert.ok(ts.includes('as const;'), 'Must use as const');
    assert.ok(ts.includes('version: 1,'), 'Must have version');
    assert.ok(ts.includes("generatedAt: '1970-01-01T00:00:00.000Z',"), 'Must have deterministic timestamp');
    assert.ok(ts.includes('families:'), 'Must have families');
    assert.ok(ts.includes('hq:'), 'Must have hq family');
    assert.ok(ts.includes('buildings:'), 'Must have buildings family');
    assert.ok(ts.includes("loadType: 'image',"), 'Must have image loadType');
    assert.ok(ts.includes('enabled: true,'), 'Must have enabled flag');
    assert.ok(ts.includes('paths:'), 'Must have paths');
  } finally {
    cleanup();
  }
});

test('generateRuntimeManifestTS contains all 28 keys', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const ts = generateRuntimeManifestTS(manifest);

    // Check all 4 HQ keys
    assert.ok(ts.includes("'hq_cyan'"), 'Must have hq_cyan');
    assert.ok(ts.includes("'hq_green'"), 'Must have hq_green');
    assert.ok(ts.includes("'hq_yellow'"), 'Must have hq_yellow');
    assert.ok(ts.includes("'hq_purple'"), 'Must have hq_purple');

    // Check a sample of building keys
    assert.ok(ts.includes("'building_cyan_separator'"), 'Must have building_cyan_separator');
    assert.ok(ts.includes("'building_green_power_plant'"), 'Must have building_green_power_plant');
    assert.ok(ts.includes("'building_purple_units_factory'"), 'Must have building_purple_units_factory');

    // Check paths section has the right keys
    assert.ok(ts.includes("'hq_cyan': 'assets/factions/cyan/buildings/hq_t1.png',"), 'Must have hq_cyan path');
    assert.ok(ts.includes("'building_cyan_separator': 'assets/factions/cyan/buildings/separator.png',"), 'Must have building path');
  } finally {
    cleanup();
  }
});

test('generateRuntimeManifestTS exports type definitions', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const ts = generateRuntimeManifestTS(manifest);

    assert.ok(ts.includes('export type GeneratedAssetKey'), 'Must export GeneratedAssetKey type');
    assert.ok(ts.includes('export type GeneratedAssetFamilyName'), 'Must export GeneratedAssetFamilyName type');
  } finally {
    cleanup();
  }
});

test('generateRuntimeManifestTS is deterministic', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const ts1 = generateRuntimeManifestTS(manifest);
    const ts2 = generateRuntimeManifestTS(manifest);
    assert.strictEqual(ts1, ts2, 'Two calls with same manifest must produce identical TS output');
  } finally {
    cleanup();
  }
});

test('generateRuntimeManifestTS does not contain double commas', () => {
  const { publicDir, cleanup } = createBuildingFixtures();
  try {
    const { manifest } = processBuildingsFamily({ publicDir });
    const ts = generateRuntimeManifestTS(manifest);
    assert.ok(!ts.includes(',,',), 'Generated TS must not contain double commas');
  } finally {
    cleanup();
  }
});

/** Create a temp directory with civil unit fixtures for testing. */
function createCivilUnitFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  const factions = ['cyan', 'green', 'yellow', 'purple'];
  const files = [
    'builder_8x8_256.png',
    'harvester_8x8_256.png',
  ];

  for (const faction of factions) {
    const dir = join(publicDir, 'assets', 'factions', faction, 'units');
    mkdirSync(dir, { recursive: true });
    for (const file of files) {
      writeFileSync(join(dir, file), 'fake-png');
    }
  }

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Create a temp directory with partial civil unit fixtures (missing some files). */
function createPartialCivilUnitFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  // Only create cyan with builder
  const dir = join(publicDir, 'assets', 'factions', 'cyan', 'units');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'builder_8x8_256.png'), 'fake-png');

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ─── Civil unit key/path generation tests (ARCH-02G) ──────────────

test('generateCivilUnitKey produces correct key', () => {
  assert.strictEqual(generateCivilUnitKey('cyan', 'builder'), 'builder_cyan');
  assert.strictEqual(generateCivilUnitKey('green', 'harvester'), 'harvester_green');
});

test('generateCivilUnitPath produces correct path', () => {
  assert.strictEqual(
    generateCivilUnitPath('cyan', 'builder'),
    'assets/factions/cyan/units/builder_8x8_256.png',
  );
  assert.strictEqual(
    generateCivilUnitPath('purple', 'harvester'),
    'assets/factions/purple/units/harvester_8x8_256.png',
  );
});

test('generateCivilUnitPath throws for unknown unit type', () => {
  assert.throws(() => generateCivilUnitPath('cyan', 'tank'), /Unknown civil unit type/);
});

// ─── CivilUnits manifest generation tests (ARCH-02G) ──────────────

test('civilUnits manifest generation produces correct shape with all fixtures', () => {
  const { publicDir, cleanup } = createCivilUnitFixtures();
  try {
    const { manifest, auditReport } = processCivilUnitsFamily({ publicDir });

    // Top-level fields
    assert.strictEqual(manifest.version, 1);
    assert.strictEqual(manifest.generatedAt, '1970-01-01T00:00:00.000Z');

    // Families
    assert.ok(manifest.families.civilUnits);
    assert.strictEqual(manifest.families.civilUnits.loadType, 'spritesheet');
    assert.strictEqual(manifest.families.civilUnits.enabled, true);

    // Keys: 4 factions × 2 unit types = 8
    assert.strictEqual(manifest.families.civilUnits.keys.length, 8);

    // frameConfig
    assert.strictEqual(manifest.families.civilUnits.frameConfig.frameWidth, 256);
    assert.strictEqual(manifest.families.civilUnits.frameConfig.frameHeight, 256);
    assert.strictEqual(manifest.families.civilUnits.frameConfig.endFrame, 63);

    // Paths: 8 entries
    assert.strictEqual(Object.keys(manifest.paths).length, 8);

    // No other families
    assert.strictEqual(manifest.families.hq, undefined);
    assert.strictEqual(manifest.families.buildings, undefined);
  } finally {
    cleanup();
  }
});

test('civilUnits manifest contains all expected keys', () => {
  const { publicDir, cleanup } = createCivilUnitFixtures();
  try {
    const { manifest } = processCivilUnitsFamily({ publicDir });
    const keys = manifest.families.civilUnits.keys;
    assert.ok(keys.includes('builder_cyan'));
    assert.ok(keys.includes('harvester_cyan'));
    assert.ok(keys.includes('builder_green'));
    assert.ok(keys.includes('harvester_green'));
    assert.ok(keys.includes('builder_yellow'));
    assert.ok(keys.includes('harvester_yellow'));
    assert.ok(keys.includes('builder_purple'));
    assert.ok(keys.includes('harvester_purple'));
  } finally {
    cleanup();
  }
});

test('civilUnits audit report has no errors with all fixtures', () => {
  const { publicDir, cleanup } = createCivilUnitFixtures();
  try {
    const { auditReport } = processCivilUnitsFamily({ publicDir });
    assert.strictEqual(auditReport.summary.totalAssets, 8);
    assert.strictEqual(auditReport.summary.validAssets, 8);
    assert.strictEqual(auditReport.summary.errorAssets, 0);
    assert.strictEqual(auditReport.summary.warningAssets, 0);
  } finally {
    cleanup();
  }
});

test('missing expected civil unit spritesheet creates MISSING_FILE error', () => {
  const { publicDir, cleanup } = createPartialCivilUnitFixtures();
  try {
    const { auditReport } = processCivilUnitsFamily({ publicDir });
    assert.ok(auditReport.errors.length > 0, 'Should have errors for missing files');
    const missingFileErrors = auditReport.errors.filter(e => e.code === 'MISSING_FILE');
    assert.ok(missingFileErrors.length > 0, 'Should have MISSING_FILE errors');
    // Missing: harvester_cyan + all green/yellow/purple sheets = 7
    assert.ok(
      missingFileErrors.some(e => e.key === 'harvester_cyan'),
      'Should report missing harvester_cyan',
    );
  } finally {
    cleanup();
  }
});

test('unexpected extra file in units dir creates ORPHAN_FILE warning', () => {
  const { publicDir, cleanup } = createCivilUnitFixtures();
  try {
    // Add an extra file
    const extraFile = join(publicDir, 'assets', 'factions', 'cyan', 'units', 'mystery_unit.png');
    writeFileSync(extraFile, 'fake-png');

    const { auditReport } = processCivilUnitsFamily({ publicDir });
    const orphanWarning = auditReport.warnings.find(w => w.code === 'ORPHAN_FILE');
    assert.ok(orphanWarning, 'Should warn about orphan file');
    assert.ok(orphanWarning.message.includes('mystery_unit.png'));
  } finally {
    cleanup();
  }
});

test('civilUnits manifest passes validateManifest with all fixtures', () => {
  const { publicDir, cleanup } = createCivilUnitFixtures();
  try {
    const { manifest } = processCivilUnitsFamily({ publicDir });
    const { errors } = validateManifest(manifest, { root: publicDir });
    assert.strictEqual(errors.length, 0, `Expected 0 validation errors, got: ${JSON.stringify(errors)}`);
  } finally {
    cleanup();
  }
});

test('civilUnits manifest generation is deterministic', () => {
  const { publicDir, cleanup } = createCivilUnitFixtures();
  try {
    const first = processCivilUnitsFamily({ publicDir });
    const second = processCivilUnitsFamily({ publicDir });
    assert.deepStrictEqual(first.manifest, second.manifest, 'Two runs must produce identical manifests');
    assert.deepStrictEqual(first.auditReport, second.auditReport, 'Two runs must produce identical audit reports');
  } finally {
    cleanup();
  }
});

test('generateRuntimeManifestTS includes civilUnits with frameConfig', () => {
  const { publicDir: bPublicDir, cleanup: bCleanup } = createBuildingFixtures();
  const { publicDir: cuPublicDir, cleanup: cuCleanup } = createCivilUnitFixtures();
  try {
    const { manifest: bManifest } = processBuildingsFamily({ publicDir: bPublicDir });
    const { manifest: cuManifest } = processCivilUnitsFamily({ publicDir: cuPublicDir });

    // Merge manifests like the CLI does
    const merged = {
      version: 1,
      generatedAt: '1970-01-01T00:00:00.000Z',
      families: { ...bManifest.families, ...cuManifest.families },
      paths: { ...bManifest.paths, ...cuManifest.paths },
    };

    const ts = generateRuntimeManifestTS(merged);
    assert.ok(ts.includes('civilUnits:'), 'Must have civilUnits family');
    assert.ok(ts.includes("loadType: 'spritesheet',"), 'Must have spritesheet loadType');
    assert.ok(ts.includes('frameConfig: { frameWidth: 256, frameHeight: 256, endFrame: 63 }'), 'Must have frameConfig');
    assert.ok(ts.includes("'builder_cyan'"), 'Must have builder_cyan key');
    assert.ok(ts.includes("'harvester_cyan'"), 'Must have harvester_cyan key');
    assert.ok(ts.includes("'builder_cyan': 'assets/factions/cyan/units/builder_8x8_256.png',"), 'Must have builder_cyan path');
  } finally {
    bCleanup();
    cuCleanup();
  }
});

// ── Modular unit key/path generation tests (ARCH-02H) ──────────────

test('generateModularUnitKey produces correct hull key', () => {
  assert.strictEqual(generateModularUnitKey('cyan', 'wasp_m0_hull', 0), 'wasp_m0_hull_cyan_dir0');
  assert.strictEqual(generateModularUnitKey('purple', 'wasp_m0_hull', 7), 'wasp_m0_hull_purple_dir7');
});

test('generateModularUnitKey produces correct turret key', () => {
  assert.strictEqual(generateModularUnitKey('cyan', 'smoky_m0_turret', 0), 'smoky_m0_turret_cyan_dir0');
  assert.strictEqual(generateModularUnitKey('purple', 'smoky_m0_turret', 7), 'smoky_m0_turret_purple_dir7');
});

test('generateModularUnitPath produces correct hull path', () => {
  assert.strictEqual(
    generateModularUnitPath('cyan', 'chassis/wasp_m0', 'wasp_m0_hull_idle', 0),
    'assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir0_0.png',
  );
  assert.strictEqual(
    generateModularUnitPath('purple', 'chassis/wasp_m0', 'wasp_m0_hull_idle', 7),
    'assets/units/chassis/wasp_m0/purple/wasp_m0_hull_idle_dir7_0.png',
  );
});

test('generateModularUnitPath produces correct turret path', () => {
  assert.strictEqual(
    generateModularUnitPath('cyan', 'weapons/smoky_m0', 'smoky_m0_turret_idle', 0),
    'assets/units/weapons/smoky_m0/cyan/smoky_m0_turret_idle_dir0_0.png',
  );
  assert.strictEqual(
    generateModularUnitPath('purple', 'weapons/smoky_m0', 'smoky_m0_turret_idle', 7),
    'assets/units/weapons/smoky_m0/purple/smoky_m0_turret_idle_dir7_0.png',
  );
});

// ─── ModularUnits manifest generation tests (ARCH-02H) ────────────

/** Create a temp directory with modular unit fixtures for testing. */
function createModularUnitFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  const factions = ['cyan', 'green', 'yellow', 'purple'];
  const dirs = [0, 1, 2, 3, 4, 5, 6, 7];

  for (const faction of factions) {
    const hullDir = join(publicDir, 'assets', 'units', 'chassis', 'wasp_m0', faction);
    mkdirSync(hullDir, { recursive: true });
    for (const dir of dirs) {
      writeFileSync(join(hullDir, `wasp_m0_hull_idle_dir${dir}_0.png`), 'fake-png');
    }

    const turretDir = join(publicDir, 'assets', 'units', 'weapons', 'smoky_m0', faction);
    mkdirSync(turretDir, { recursive: true });
    for (const dir of dirs) {
      writeFileSync(join(turretDir, `smoky_m0_turret_idle_dir${dir}_0.png`), 'fake-png');
    }
  }

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Create a temp directory with partial modular unit fixtures (missing some files). */
function createPartialModularUnitFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  // Only create cyan hull dir0
  const hullDir = join(publicDir, 'assets', 'units', 'chassis', 'wasp_m0', 'cyan');
  mkdirSync(hullDir, { recursive: true });
  writeFileSync(join(hullDir, 'wasp_m0_hull_idle_dir0_0.png'), 'fake-png');

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('modularUnits manifest generation produces correct shape with all fixtures', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const { manifest, auditReport } = processModularUnitsFamily({ publicDir });

    // Top-level fields
    assert.strictEqual(manifest.version, 1);
    assert.strictEqual(manifest.generatedAt, '1970-01-01T00:00:00.000Z');

    // Families
    assert.ok(manifest.families.modularUnits);
    assert.strictEqual(manifest.families.modularUnits.loadType, 'image');
    assert.strictEqual(manifest.families.modularUnits.enabled, true);

    // Keys: 4 factions × 8 dirs × 2 parts = 64
    assert.strictEqual(manifest.families.modularUnits.keys.length, 64);

    // No frameConfig for image type
    assert.strictEqual(manifest.families.modularUnits.frameConfig, undefined);

    // Paths: 64 entries
    assert.strictEqual(Object.keys(manifest.paths).length, 64);

    // No other families
    assert.strictEqual(manifest.families.hq, undefined);
    assert.strictEqual(manifest.families.buildings, undefined);
    assert.strictEqual(manifest.families.civilUnits, undefined);
  } finally {
    cleanup();
  }
});

test('modularUnits manifest contains all expected sample keys', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const { manifest } = processModularUnitsFamily({ publicDir });
    const keys = manifest.families.modularUnits.keys;
    assert.ok(keys.includes('wasp_m0_hull_cyan_dir0'));
    assert.ok(keys.includes('wasp_m0_hull_purple_dir7'));
    assert.ok(keys.includes('smoky_m0_turret_cyan_dir0'));
    assert.ok(keys.includes('smoky_m0_turret_purple_dir7'));
  } finally {
    cleanup();
  }
});

test('modularUnits manifest paths match legacy helper outputs', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const { manifest } = processModularUnitsFamily({ publicDir });

    // Verify paths match what getWaspHullKey/getSmokyTurretKey would produce
    assert.strictEqual(
      manifest.paths['wasp_m0_hull_cyan_dir0'],
      'assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir0_0.png',
    );
    assert.strictEqual(
      manifest.paths['smoky_m0_turret_cyan_dir0'],
      'assets/units/weapons/smoky_m0/cyan/smoky_m0_turret_idle_dir0_0.png',
    );
    assert.strictEqual(
      manifest.paths['wasp_m0_hull_purple_dir7'],
      'assets/units/chassis/wasp_m0/purple/wasp_m0_hull_idle_dir7_0.png',
    );
    assert.strictEqual(
      manifest.paths['smoky_m0_turret_purple_dir7'],
      'assets/units/weapons/smoky_m0/purple/smoky_m0_turret_idle_dir7_0.png',
    );
  } finally {
    cleanup();
  }
});

test('modularUnits audit report has no errors with all fixtures', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const { auditReport } = processModularUnitsFamily({ publicDir });
    assert.strictEqual(auditReport.summary.totalAssets, 64);
    assert.strictEqual(auditReport.summary.validAssets, 64);
    assert.strictEqual(auditReport.summary.errorAssets, 0);
    assert.strictEqual(auditReport.summary.warningAssets, 0);
  } finally {
    cleanup();
  }
});

test('missing expected modular unit image creates MISSING_FILE error', () => {
  const { publicDir, cleanup } = createPartialModularUnitFixtures();
  try {
    const { auditReport } = processModularUnitsFamily({ publicDir });
    assert.ok(auditReport.errors.length > 0, 'Should have errors for missing files');
    const missingFileErrors = auditReport.errors.filter(e => e.code === 'MISSING_FILE');
    assert.ok(missingFileErrors.length > 0, 'Should have MISSING_FILE errors');
    // Only wasp_m0_hull_cyan_dir0 exists, everything else is missing
    assert.ok(
      missingFileErrors.some(e => e.key === 'smoky_m0_turret_cyan_dir0'),
      'Should report missing smoky_m0_turret_cyan_dir0',
    );
  } finally {
    cleanup();
  }
});

test('unexpected extra file in modular dir creates ORPHAN_FILE warning', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    // Add an extra file
    const extraFile = join(publicDir, 'assets', 'units', 'chassis', 'wasp_m0', 'cyan', 'mystery_hull.png');
    writeFileSync(extraFile, 'fake-png');

    const { auditReport } = processModularUnitsFamily({ publicDir });
    const orphanWarning = auditReport.warnings.find(w => w.code === 'ORPHAN_FILE');
    assert.ok(orphanWarning, 'Should warn about orphan file');
    assert.ok(orphanWarning.message.includes('mystery_hull.png'));
  } finally {
    cleanup();
  }
});

test('modularUnits manifest passes validateManifest with all fixtures', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const { manifest } = processModularUnitsFamily({ publicDir });
    const { errors } = validateManifest(manifest, { root: publicDir });
    assert.strictEqual(errors.length, 0, `Expected 0 validation errors, got: ${JSON.stringify(errors)}`);
  } finally {
    cleanup();
  }
});

test('modularUnits manifest generation is deterministic', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const first = processModularUnitsFamily({ publicDir });
    const second = processModularUnitsFamily({ publicDir });
    assert.deepStrictEqual(first.manifest, second.manifest, 'Two runs must produce identical manifests');
    assert.deepStrictEqual(first.auditReport, second.auditReport, 'Two runs must produce identical audit reports');
  } finally {
    cleanup();
  }
});

test('modularUnits works with minimal single-faction single-dir fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  try {
    const publicDir = join(root, 'public');
    const hullDir = join(publicDir, 'assets', 'units', 'chassis', 'wasp_m0', 'cyan');
    mkdirSync(hullDir, { recursive: true });
    writeFileSync(join(hullDir, 'wasp_m0_hull_idle_dir0_0.png'), 'fake-png');

    const turretDir = join(publicDir, 'assets', 'units', 'weapons', 'smoky_m0', 'cyan');
    mkdirSync(turretDir, { recursive: true });
    writeFileSync(join(turretDir, 'smoky_m0_turret_idle_dir0_0.png'), 'fake-png');

    const { manifest, auditReport } = processModularUnitsFamily({
      publicDir,
      factions: ['cyan'],
      directions: [0],
      modularParts: [
        { keyPrefix: 'wasp_m0_hull', pathDir: 'chassis/wasp_m0', filePrefix: 'wasp_m0_hull_idle' },
        { keyPrefix: 'smoky_m0_turret', pathDir: 'weapons/smoky_m0', filePrefix: 'smoky_m0_turret_idle' },
      ],
    });

    assert.strictEqual(manifest.families.modularUnits.keys.length, 2);
    assert.strictEqual(manifest.families.modularUnits.keys[0], 'wasp_m0_hull_cyan_dir0');
    assert.strictEqual(manifest.families.modularUnits.keys[1], 'smoky_m0_turret_cyan_dir0');
    assert.strictEqual(auditReport.summary.totalAssets, 2);
    assert.strictEqual(auditReport.summary.errorAssets, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('generateRuntimeManifestTS includes modularUnits with image loadType', () => {
  const { publicDir, cleanup } = createModularUnitFixtures();
  try {
    const { manifest } = processModularUnitsFamily({ publicDir });
    const ts = generateRuntimeManifestTS(manifest);
    assert.ok(ts.includes('modularUnits:'), 'Must have modularUnits family');
    assert.ok(ts.includes("'wasp_m0_hull_cyan_dir0'"), 'Must have hull key');
    assert.ok(ts.includes("'smoky_m0_turret_cyan_dir0'"), 'Must have turret key');
    // Should NOT have frameConfig (image type)
    assert.ok(!ts.includes('frameConfig'), 'Image type should not have frameConfig in TS');
  } finally {
    cleanup();
  }
});

// ── Combined default (--family all) output includes all families (ARCH-02G+02H) ──

/** Create a temp directory with building, civil unit, and modular unit fixtures. */
function createCombinedFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'process-art-test-'));
  const publicDir = join(root, 'public');

  const factions = ['cyan', 'green', 'yellow', 'purple'];

  // Buildings
  const buildingFiles = [
    'hq_t1.png', 'separator.png', 'raw_storage.png', 'matter_storage.png',
    'power_plant.png', 'command_relay.png', 'units_factory.png',
  ];
  for (const faction of factions) {
    const dir = join(publicDir, 'assets', 'factions', faction, 'buildings');
    mkdirSync(dir, { recursive: true });
    for (const file of buildingFiles) {
      writeFileSync(join(dir, file), 'fake-png');
    }
  }

  // Civil units
  const unitFiles = ['builder_8x8_256.png', 'harvester_8x8_256.png'];
  for (const faction of factions) {
    const dir = join(publicDir, 'assets', 'factions', faction, 'units');
    mkdirSync(dir, { recursive: true });
    for (const file of unitFiles) {
      writeFileSync(join(dir, file), 'fake-png');
    }
  }

  // Modular units
  const dirs = [0, 1, 2, 3, 4, 5, 6, 7];
  for (const faction of factions) {
    const hullDir = join(publicDir, 'assets', 'units', 'chassis', 'wasp_m0', faction);
    mkdirSync(hullDir, { recursive: true });
    for (const dir of dirs) {
      writeFileSync(join(hullDir, `wasp_m0_hull_idle_dir${dir}_0.png`), 'fake-png');
    }

    const turretDir = join(publicDir, 'assets', 'units', 'weapons', 'smoky_m0', faction);
    mkdirSync(turretDir, { recursive: true });
    for (const dir of dirs) {
      writeFileSync(join(turretDir, `smoky_m0_turret_idle_dir${dir}_0.png`), 'fake-png');
    }
  }

  return { root, publicDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('combined default output includes all families', () => {
  const { publicDir, cleanup } = createCombinedFixtures();
  try {
    // Simulate --family all (the default): process all families and merge
    const { manifest: bManifest } = processBuildingsFamily({ publicDir });
    const { manifest: cuManifest } = processCivilUnitsFamily({ publicDir });
    const { manifest: muManifest } = processModularUnitsFamily({ publicDir });

    const merged = {
      version: 1,
      generatedAt: '1970-01-01T00:00:00.000Z',
      families: { ...bManifest.families, ...cuManifest.families, ...muManifest.families },
      paths: { ...bManifest.paths, ...cuManifest.paths, ...muManifest.paths },
    };

    // Must have all four families
    assert.ok(merged.families.hq, 'Merged manifest must have hq family');
    assert.ok(merged.families.buildings, 'Merged manifest must have buildings family');
    assert.ok(merged.families.civilUnits, 'Merged manifest must have civilUnits family');
    assert.ok(merged.families.modularUnits, 'Merged manifest must have modularUnits family');

    // civilUnits must have spritesheet loadType
    assert.strictEqual(merged.families.civilUnits.loadType, 'spritesheet');
    assert.strictEqual(merged.families.civilUnits.keys.length, 8);

    // modularUnits must have image loadType
    assert.strictEqual(merged.families.modularUnits.loadType, 'image');
    assert.strictEqual(merged.families.modularUnits.keys.length, 64);

    // Total keys: 4 HQ + 24 buildings + 8 civilUnits + 64 modularUnits = 100
    const totalKeys = Object.keys(merged.paths).length;
    assert.strictEqual(totalKeys, 100, `Expected 100 total paths, got ${totalKeys}`);

    // Validate the merged manifest
    const { errors } = validateManifest(merged, { root: publicDir });
    assert.strictEqual(errors.length, 0, `Merged manifest must pass validation, got: ${JSON.stringify(errors)}`);
  } finally {
    cleanup();
  }
});

test('generateRuntimeManifestTS for combined output includes all families', () => {
  const { publicDir, cleanup } = createCombinedFixtures();
  try {
    const { manifest: bManifest } = processBuildingsFamily({ publicDir });
    const { manifest: cuManifest } = processCivilUnitsFamily({ publicDir });
    const { manifest: muManifest } = processModularUnitsFamily({ publicDir });

    const merged = {
      version: 1,
      generatedAt: '1970-01-01T00:00:00.000Z',
      families: { ...bManifest.families, ...cuManifest.families, ...muManifest.families },
      paths: { ...bManifest.paths, ...cuManifest.paths, ...muManifest.paths },
    };

    const ts = generateRuntimeManifestTS(merged);

    // Must have all four families
    assert.ok(ts.includes('hq:'), 'TS must have hq family');
    assert.ok(ts.includes('buildings:'), 'TS must have buildings family');
    assert.ok(ts.includes('civilUnits:'), 'TS must have civilUnits family');
    assert.ok(ts.includes('modularUnits:'), 'TS must have modularUnits family');

    // Must have spritesheet loadType and frameConfig for civilUnits
    assert.ok(ts.includes("loadType: 'spritesheet',"), 'TS must have spritesheet loadType');
    assert.ok(ts.includes('frameConfig:'), 'TS must have frameConfig');

    // Must have civil unit keys in paths
    assert.ok(ts.includes("'builder_cyan':"), 'TS must have builder_cyan path');
    assert.ok(ts.includes("'harvester_cyan':"), 'TS must have harvester_cyan path');

    // Must have modular unit keys in paths
    assert.ok(ts.includes("'wasp_m0_hull_cyan_dir0':"), 'TS must have hull path');
    assert.ok(ts.includes("'smoky_m0_turret_cyan_dir0':"), 'TS must have turret path');
  } finally {
    cleanup();
  }
});

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
