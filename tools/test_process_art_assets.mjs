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

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
