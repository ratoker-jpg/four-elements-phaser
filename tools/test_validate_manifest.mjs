#!/usr/bin/env node
/**
 * Tests for tools/validate_manifest.mjs
 *
 * ARCH-02B+C: Self-contained test runner using Node.js built-in assert.
 * No external dependencies required.
 *
 * Usage:
 *   node tools/test_validate_manifest.mjs
 */

import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

/** Build a minimal valid manifest with sensible defaults. */
function makeValidManifest(overrides = {}) {
  return {
    version: 1,
    generatedAt: '2026-05-26T12:00:00Z',
    families: {
      terrain: {
        keys: ['terrain_sand'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
    },
    ...overrides,
  };
}

/** Find an issue by code in a list. */
function findIssue(issues, code) {
  return issues.find((i) => i.code === code);
}

// ─── Test cases ───────────────────────────────────────────────────────

console.log('\nvalidate_manifest tests\n');

// ── Valid minimal manifest passes ────────────────────────────────────

test('valid minimal manifest passes', () => {
  const manifest = makeValidManifest();
  const { errors, warnings } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(errors)}`);
  assert.strictEqual(warnings.length, 0, `Expected 0 warnings, got: ${JSON.stringify(warnings)}`);
});

test('valid manifest with multiple families passes', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand', 'terrain_sand_dark'],
        loadType: 'image',
        enabled: true,
      },
      buildings: {
        keys: ['building_cyan_separator'],
        loadType: 'image',
        enabled: true,
      },
      resources: {
        keys: ['mineral_small', 'mineral_medium', 'mineral_large'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
      terrain_sand_dark: 'assets/tiles/sand_tile_dark.png',
      building_cyan_separator: 'assets/factions/cyan/buildings/separator.png',
      mineral_small: 'assets/environment/mineral_small_02.png',
      mineral_medium: 'assets/environment/mineral_medium_02.png',
      mineral_large: 'assets/environment/mineral_large_02.png',
    },
  });
  const { errors, warnings } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(errors)}`);
});

test('valid manifest with spritesheet and frameConfig passes', () => {
  const manifest = makeValidManifest({
    families: {
      civilUnits: {
        keys: ['builder_cyan', 'harvester_cyan'],
        loadType: 'spritesheet',
        frameConfig: { frameWidth: 256, frameHeight: 256, endFrame: 63 },
        enabled: true,
      },
    },
    paths: {
      builder_cyan: 'assets/factions/cyan/units/builder_8x8_256.png',
      harvester_cyan: 'assets/factions/cyan/units/harvester_8x8_256.png',
    },
  });
  const { errors, warnings } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(errors)}`);
});

// ── Duplicate keys fail ──────────────────────────────────────────────

test('duplicate keys across families fail', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand'],
        loadType: 'image',
        enabled: true,
      },
      buildings: {
        // Intentional duplicate: terrain_sand in a different family
        keys: ['terrain_sand', 'building_cyan_separator'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
      building_cyan_separator: 'assets/factions/cyan/buildings/separator.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const dup = findIssue(errors, 'DUPLICATE_KEY');
  assert.ok(dup, 'Expected DUPLICATE_KEY error');
  assert.ok(dup.key.includes('terrain_sand'));
});

test('duplicate keys within same family fail', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand', 'terrain_sand'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const dup = findIssue(errors, 'DUPLICATE_KEY');
  assert.ok(dup, 'Expected DUPLICATE_KEY error');
});

// ── Invalid loadType fails ───────────────────────────────────────────

test('invalid loadType fails', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand'],
        loadType: 'atlas',
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const lt = findIssue(errors, 'INVALID_LOAD_TYPE');
  assert.ok(lt, 'Expected INVALID_LOAD_TYPE error');
  assert.ok(lt.message.includes('atlas'));
});

// ── Missing paths entry fails ────────────────────────────────────────

test('missing paths entry fails', () => {
  const manifest = {
    version: 1,
    generatedAt: '2026-05-26T12:00:00Z',
    families: {
      terrain: {
        keys: ['terrain_sand', 'terrain_sand_dark'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      // terrain_sand_dark is missing from paths
      terrain_sand: 'assets/tiles/sand_tile.png',
    },
  };
  const { errors } = validateManifest(manifest);
  const mp = findIssue(errors, 'MISSING_PATH');
  assert.ok(mp, 'Expected MISSING_PATH error');
  assert.ok(mp.key.includes('terrain_sand_dark'));
});

// ── Spritesheet without frameConfig fails ────────────────────────────

test('spritesheet without frameConfig fails', () => {
  const manifest = makeValidManifest({
    families: {
      civilUnits: {
        keys: ['builder_cyan'],
        loadType: 'spritesheet',
        // frameConfig missing
        enabled: true,
      },
    },
    paths: {
      builder_cyan: 'assets/factions/cyan/units/builder_8x8_256.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const fc = findIssue(errors, 'MISSING_FRAME_CONFIG');
  assert.ok(fc, 'Expected MISSING_FRAME_CONFIG error');
});

// ── Image with frameConfig is allowed but warned ─────────────────────

test('image with frameConfig produces warning (not error)', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand'],
        loadType: 'image',
        frameConfig: { frameWidth: 256, frameHeight: 256 },
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
    },
  });
  const { errors, warnings } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, 'Image with frameConfig should not produce errors');
  const uf = findIssue(warnings, 'UNEXPECTED_FRAME_CONFIG');
  assert.ok(uf, 'Expected UNEXPECTED_FRAME_CONFIG warning');
});

// ── Invalid key format fails for buildings ───────────────────────────

test('invalid building key format fails', () => {
  const manifest = makeValidManifest({
    families: {
      buildings: {
        keys: ['separator_cyan'],  // wrong order: should be building_{faction}_{suffix}
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      separator_cyan: 'assets/factions/cyan/buildings/separator.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ik = findIssue(errors, 'INVALID_KEY_FORMAT');
  assert.ok(ik, 'Expected INVALID_KEY_FORMAT error for building key');
});

// ── Invalid key format fails for civilUnits ──────────────────────────

test('invalid civil unit key format fails', () => {
  const manifest = makeValidManifest({
    families: {
      civilUnits: {
        keys: ['cyan_builder'],  // wrong: should be {unit_type}_{faction}
        loadType: 'spritesheet',
        frameConfig: { frameWidth: 256, frameHeight: 256, endFrame: 63 },
        enabled: true,
      },
    },
    paths: {
      cyan_builder: 'assets/factions/cyan/units/builder_8x8_256.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ik = findIssue(errors, 'INVALID_KEY_FORMAT');
  assert.ok(ik, 'Expected INVALID_KEY_FORMAT error for civil unit key');
});

// ── Invalid key format fails for modularUnits ────────────────────────

test('invalid modular unit key format fails', () => {
  const manifest = makeValidManifest({
    families: {
      modularUnits: {
        keys: ['hull_cyan_dir0'],  // missing chassis/mark pattern
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      hull_cyan_dir0: 'assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir0_0.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ik = findIssue(errors, 'INVALID_KEY_FORMAT');
  assert.ok(ik, 'Expected INVALID_KEY_FORMAT error for modular unit key');
});

// ── Invalid key format fails for resources ───────────────────────────

test('invalid resource key format fails', () => {
  const manifest = makeValidManifest({
    families: {
      resources: {
        keys: ['small_mineral'],  // wrong: should be mineral_{size}
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      small_mineral: 'assets/environment/mineral_small_02.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ik = findIssue(errors, 'INVALID_KEY_FORMAT');
  assert.ok(ik, 'Expected INVALID_KEY_FORMAT error for resource key');
});

// ── Disabled family still validates structure ────────────────────────

test('disabled family with invalid loadType still fails', () => {
  const manifest = makeValidManifest({
    families: {
      fx: {
        keys: ['fx_dust'],
        loadType: 'invalid_type',
        enabled: false,
      },
    },
    paths: {
      fx_dust: 'assets/fx/dust.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const lt = findIssue(errors, 'INVALID_LOAD_TYPE');
  assert.ok(lt, 'Disabled family should still validate structure');
});

// ── Disabled family with invalid key still fails ─────────────────────

test('disabled family with invalid key format still fails', () => {
  const manifest = makeValidManifest({
    families: {
      decor: {
        keys: ['BADKEY'],
        loadType: 'image',
        enabled: false,
      },
    },
    paths: {
      BADKEY: 'assets/decor/rock.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ik = findIssue(errors, 'INVALID_KEY_FORMAT');
  assert.ok(ik, 'Disabled family should still validate key format');
});

// ── Missing file creates error only when root is provided ────────────

test('missing file creates error only when root option is provided', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/NONEXISTENT_FILE.png',
    },
  });

  // Without root — no file-existence check, should pass
  const { errors: errorsNoRoot } = validateManifest(manifest);
  assert.strictEqual(errorsNoRoot.length, 0, 'Without root, no file-existence errors');

  // With root — should report missing file (using temp dir where file does not exist)
  const tempRoot = mkdtempSync(join(tmpdir(), 'manifest-test-'));
  try {
    const { errors: errorsWithRoot } = validateManifest(manifest, { root: tempRoot });
    const mf = findIssue(errorsWithRoot, 'MISSING_FILE');
    assert.ok(mf, 'With root, missing file should produce error');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

// ── Disabled family skipped from file-existence checks ───────────────

test('disabled family skipped from file-existence checks', () => {
  // Create a temp root with an existing file for the enabled family,
  // but no file for the disabled family — the disabled family should be skipped.
  const tempRoot = mkdtempSync(join(tmpdir(), 'manifest-test-'));
  try {
    mkdirSync(join(tempRoot, 'assets', 'tiles'), { recursive: true });
    writeFileSync(join(tempRoot, 'assets', 'tiles', 'sand_tile.png'), '');

    const manifest = makeValidManifest({
      families: {
        terrain: {
          keys: ['terrain_sand'],
          loadType: 'image',
          enabled: true,
        },
        fx: {
          keys: ['fx_nonexistent'],
          loadType: 'image',
          enabled: false,
        },
      },
      paths: {
        terrain_sand: 'assets/tiles/sand_tile.png',
        fx_nonexistent: 'assets/fx/DOES_NOT_EXIST.png',
      },
    });
    const { errors } = validateManifest(manifest, { root: tempRoot });
    const mf = findIssue(errors, 'MISSING_FILE');
    assert.strictEqual(mf, undefined, 'Disabled family should skip file-existence checks');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

// ── Warning-only manifest exits success unless strict ─────────────────

test('warning-only manifest has errors.length === 0', () => {
  const manifest = makeValidManifest({
    families: {
      terrain: {
        keys: ['terrain_sand'],
        loadType: 'image',
        frameConfig: { frameWidth: 76 },  // unexpected for image
        enabled: true,
      },
    },
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
    },
  });
  const { errors, warnings } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, 'Warnings should not produce errors');
  assert.ok(warnings.length > 0, 'Should have at least one warning');
});

// ── Invalid family name fails ────────────────────────────────────────

test('invalid family name fails', () => {
  const manifest = makeValidManifest({
    families: {
      unknownFamily: {
        keys: ['some_key'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      some_key: 'assets/unknown/some_key.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ifn = findIssue(errors, 'INVALID_FAMILY');
  assert.ok(ifn, 'Expected INVALID_FAMILY error');
});

// ── Missing top-level version fails ──────────────────────────────────

test('missing top-level version fails', () => {
  const manifest = makeValidManifest();
  delete manifest.version;
  const { errors } = validateManifest(manifest);
  const is = findIssue(errors, 'INVALID_SCHEMA');
  assert.ok(is, 'Expected INVALID_SCHEMA error for missing version');
});

// ── Missing top-level families fails ─────────────────────────────────

test('missing top-level families fails', () => {
  const manifest = makeValidManifest();
  delete manifest.families;
  const { errors } = validateManifest(manifest);
  const is = findIssue(errors, 'INVALID_SCHEMA');
  assert.ok(is, 'Expected INVALID_SCHEMA error for missing families');
});

// ── Missing top-level paths fails ────────────────────────────────────

test('missing top-level paths fails', () => {
  const manifest = makeValidManifest();
  delete manifest.paths;
  const { errors } = validateManifest(manifest);
  const is = findIssue(errors, 'INVALID_SCHEMA');
  assert.ok(is, 'Expected INVALID_SCHEMA error for missing paths');
});

// ── Orphan path entry produces warning ───────────────────────────────

test('orphan path entry produces warning', () => {
  const manifest = makeValidManifest({
    paths: {
      terrain_sand: 'assets/tiles/sand_tile.png',
      terrain_unused: 'assets/tiles/unused.png',  // not in any family keys
    },
  });
  const { warnings } = validateManifest(manifest);
  const op = findIssue(warnings, 'ORPHAN_PATH');
  assert.ok(op, 'Expected ORPHAN_PATH warning');
  assert.ok(op.key.includes('terrain_unused'));
});

// ── Valid HQ keys ────────────────────────────────────────────────────

test('valid HQ keys pass', () => {
  const manifest = makeValidManifest({
    families: {
      hq: {
        keys: ['hq_cyan', 'hq_green', 'hq_yellow', 'hq_purple'],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      hq_cyan: 'assets/factions/cyan/buildings/hq_t1.png',
      hq_green: 'assets/factions/green/buildings/hq_t1.png',
      hq_yellow: 'assets/factions/yellow/buildings/hq_t1.png',
      hq_purple: 'assets/factions/purple/buildings/hq_t1.png',
    },
  });
  const { errors } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(errors)}`);
});

// ── Valid modular unit keys ──────────────────────────────────────────

test('valid modular unit keys pass', () => {
  const manifest = makeValidManifest({
    families: {
      modularUnits: {
        keys: [
          'wasp_m0_hull_cyan_dir0',
          'wasp_m0_hull_cyan_dir7',
          'smoky_m0_turret_green_dir3',
        ],
        loadType: 'image',
        enabled: true,
      },
    },
    paths: {
      wasp_m0_hull_cyan_dir0: 'assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir0_0.png',
      wasp_m0_hull_cyan_dir7: 'assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir7_0.png',
      smoky_m0_turret_green_dir3: 'assets/units/weapons/smoky_m0/green/smoky_m0_turret_idle_dir3_0.png',
    },
  });
  const { errors } = validateManifest(manifest);
  assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(errors)}`);
});

// ── Spritesheet frameConfig validation ───────────────────────────────

test('spritesheet frameConfig with zero frameWidth fails', () => {
  const manifest = makeValidManifest({
    families: {
      civilUnits: {
        keys: ['builder_cyan'],
        loadType: 'spritesheet',
        frameConfig: { frameWidth: 0, frameHeight: 256 },
        enabled: true,
      },
    },
    paths: {
      builder_cyan: 'assets/factions/cyan/units/builder_8x8_256.png',
    },
  });
  const { errors } = validateManifest(manifest);
  const ifc = findIssue(errors, 'INVALID_FRAME_CONFIG');
  assert.ok(ifc, 'Expected INVALID_FRAME_CONFIG for zero frameWidth');
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
