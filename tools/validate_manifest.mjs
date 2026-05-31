#!/usr/bin/env node
/**
 * Manifest validator for the Four Elements Phaser asset pipeline.
 *
 * ARCH-02B+C: Validates manifest JSON structure, keys, naming, load types,
 * paths, and spritesheet frame config. Optionally checks file existence.
 *
 * Usage:
 *   node tools/validate_manifest.mjs <manifest.json> [options]
 *
 * Options:
 *   --root <dir>     Root directory for file-existence checks (default: none)
 *   --strict         Warnings also cause non-zero exit
 *   --json           Output machine-readable JSON report instead of console
 *
 * Exit codes:
 *   0 — no errors (warnings are OK unless --strict)
 *   1 — validation errors found (or warnings in --strict mode)
 *   2 — invalid usage or file read error
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ─── Per-family key pattern validators ────────────────────────────────

/**
 * Each validator returns null if the key is valid, or an error message string.
 */
const KEY_VALIDATORS = {
  terrain(key) {
    return /^terrain_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `Terrain key "${key}" must match terrain_{variant} (lowercase snake_case)`;
  },
  buildings(key) {
    return /^building_(cyan|green|yellow|purple)_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `Building key "${key}" must match building_{faction}_{type_suffix}`;
  },
  hq(key) {
    return /^hq_(cyan|green|yellow|purple)$/.test(key)
      ? null
      : `HQ key "${key}" must match hq_{faction}`;
  },
  civilUnits(key) {
    return /^(builder|harvester)_(cyan|green|yellow|purple)$/.test(key)
      ? null
      : `Civil unit key "${key}" must match {unit_type}_{faction}`;
  },
  modularUnits(key) {
    return /^[a-z][a-z0-9]*_m[0-9]+_(hull|turret)_(cyan|green|yellow|purple)_dir[0-7]$/.test(key)
      ? null
      : `Modular unit key "${key}" must match {chassis}_{mark}_{part}_{faction}_dir{N}`;
  },
  resources(key) {
    return /^mineral_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `Resource key "${key}" must match mineral_{size} or mineral_{variant}`;
  },
  decor(key) {
    return /^decor_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `Decor key "${key}" must match decor_{name}`;
  },
  fx(key) {
    return /^fx_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `FX key "${key}" must match fx_{name}`;
  },
  ui(key) {
    return /^ui_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `UI key "${key}" must match ui_{name} (e.g. ui_icon_build_separator)`;
  },
  industrialTerrain(key) {
    return /^industrial_tile_[a-z0-9_]+$/.test(key)
      ? null
      : `Industrial terrain key "${key}" must match industrial_tile_{variant}`;
  },
  industrialFrame(key) {
    return /^(frame|background)_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `Industrial frame key "${key}" must match frame_{variant} or background_{variant}`;
  },
  industrialResources(key) {
    return /^resource_industrial_[a-z][a-z0-9_]*$/.test(key)
      ? null
      : `Industrial resource key "${key}" must match resource_industrial_{variant}`;
  },
};

const VALID_LOAD_TYPES = new Set(['image', 'spritesheet']);

const VALID_FAMILY_NAMES = new Set(Object.keys(KEY_VALIDATORS));

// ─── Validation result types ──────────────────────────────────────────

/** @typedef {{ family: string, key: string|null, code: string, message: string }} Issue */

// ─── Core validation logic ────────────────────────────────────────────

/**
 * Validate a parsed manifest object.
 *
 * @param {object} manifest - Parsed manifest JSON.
 * @param {object} [options] - Validation options.
 * @param {string|null} [options.root] - Root directory for file-existence checks.
 * @returns {{ errors: Issue[], warnings: Issue[] }}
 */
export function validateManifest(manifest, options = {}) {
  const { root = null } = options;
  const errors = [];
  const warnings = [];

  // ── Top-level structure ─────────────────────────────────────────────

  if (typeof manifest.version !== 'number') {
    errors.push({ family: '', key: null, code: 'INVALID_SCHEMA', message: 'Missing or invalid top-level "version" (expected number)' });
  }

  if (typeof manifest.generatedAt !== 'string') {
    errors.push({ family: '', key: null, code: 'INVALID_SCHEMA', message: 'Missing or invalid top-level "generatedAt" (expected ISO string)' });
  }

  if (typeof manifest.families !== 'object' || manifest.families === null) {
    errors.push({ family: '', key: null, code: 'INVALID_SCHEMA', message: 'Missing or invalid top-level "families" (expected object)' });
    return { errors, warnings }; // can't continue without families
  }

  if (typeof manifest.paths !== 'object' || manifest.paths === null) {
    errors.push({ family: '', key: null, code: 'INVALID_SCHEMA', message: 'Missing or invalid top-level "paths" (expected object)' });
    return { errors, warnings }; // can't continue without paths
  }

  // ── Family validation ───────────────────────────────────────────────

  const allKeys = [];
  const keySet = new Set();

  for (const [familyName, family] of Object.entries(manifest.families)) {
    // Family name
    if (!VALID_FAMILY_NAMES.has(familyName)) {
      errors.push({ family: familyName, key: null, code: 'INVALID_FAMILY', message: `Unknown family name "${familyName}". Valid: ${[...VALID_FAMILY_NAMES].join(', ')}` });
    }

    // Family structure
    if (!Array.isArray(family.keys)) {
      errors.push({ family: familyName, key: null, code: 'INVALID_SCHEMA', message: `Family "${familyName}" missing or invalid "keys" (expected array)` });
      continue;
    }

    if (!VALID_LOAD_TYPES.has(family.loadType)) {
      errors.push({ family: familyName, key: null, code: 'INVALID_LOAD_TYPE', message: `Family "${familyName}" has invalid loadType "${family.loadType}". Valid: ${[...VALID_LOAD_TYPES].join(', ')}` });
    }

    // Spritesheet frameConfig
    if (family.loadType === 'spritesheet') {
      if (typeof family.frameConfig !== 'object' || family.frameConfig === null) {
        errors.push({ family: familyName, key: null, code: 'MISSING_FRAME_CONFIG', message: `Family "${familyName}" has loadType "spritesheet" but no frameConfig` });
      } else {
        if (typeof family.frameConfig.frameWidth !== 'number' || family.frameConfig.frameWidth <= 0) {
          errors.push({ family: familyName, key: null, code: 'INVALID_FRAME_CONFIG', message: `Family "${familyName}" frameConfig.frameWidth must be a positive number` });
        }
        if (typeof family.frameConfig.frameHeight !== 'number' || family.frameConfig.frameHeight <= 0) {
          errors.push({ family: familyName, key: null, code: 'INVALID_FRAME_CONFIG', message: `Family "${familyName}" frameConfig.frameHeight must be a positive number` });
        }
      }
    }

    // Image with frameConfig — warn (not error)
    if (family.loadType === 'image' && family.frameConfig != null) {
      warnings.push({ family: familyName, key: null, code: 'UNEXPECTED_FRAME_CONFIG', message: `Family "${familyName}" has loadType "image" but includes frameConfig (ignored for images)` });
    }

    // enabled default
    if (family.enabled === undefined) {
      // Not an error — default is true. Just note it.
    }

    // Per-key validation
    for (const key of family.keys) {
      if (typeof key !== 'string') {
        errors.push({ family: familyName, key: String(key), code: 'INVALID_KEY_TYPE', message: `Key must be a string, got ${typeof key}` });
        continue;
      }

      // Duplicate check
      if (keySet.has(key)) {
        errors.push({ family: familyName, key, code: 'DUPLICATE_KEY', message: `Duplicate key "${key}"` });
      }
      keySet.add(key);
      allKeys.push({ family: familyName, key });

      // Key naming pattern
      if (KEY_VALIDATORS[familyName]) {
        const patternError = KEY_VALIDATORS[familyName](key);
        if (patternError) {
          errors.push({ family: familyName, key, code: 'INVALID_KEY_FORMAT', message: patternError });
        }
      }

      // Path entry exists
      if (!(key in manifest.paths)) {
        errors.push({ family: familyName, key, code: 'MISSING_PATH', message: `Key "${key}" has no entry in "paths"` });
      } else if (typeof manifest.paths[key] !== 'string') {
        errors.push({ family: familyName, key, code: 'INVALID_PATH', message: `Path for key "${key}" must be a string` });
      }
    }
  }

  // ── Paths validation ────────────────────────────────────────────────

  // Check that every path entry has a corresponding key in some family
  for (const pathKey of Object.keys(manifest.paths)) {
    if (!keySet.has(pathKey)) {
      warnings.push({ family: '', key: pathKey, code: 'ORPHAN_PATH', message: `Path entry "${pathKey}" not referenced by any family key` });
    }
  }

  // ── File existence checks (optional) ────────────────────────────────

  if (root) {
    const rootDir = resolve(root);

    for (const { family: familyName, key } of allKeys) {
      // Skip disabled families from file-existence checks
      const family = manifest.families[familyName];
      if (family && family.enabled === false) continue;

      const relativePath = manifest.paths[key];
      if (typeof relativePath !== 'string') continue;

      const absolutePath = join(rootDir, relativePath);
      if (!existsSync(absolutePath)) {
        errors.push({ family: familyName, key, code: 'MISSING_FILE', message: `Referenced file not found: ${relativePath}` });
      }
    }
  }

  return { errors, warnings };
}

// ─── CLI entry point ──────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage: node tools/validate_manifest.mjs <manifest.json> [options]

Options:
  --root <dir>     Root directory for file-existence checks
  --strict         Warnings also cause non-zero exit
  --json           Output machine-readable JSON report

Exit codes:
  0 — no errors (warnings OK unless --strict)
  1 — validation errors found
  2 — usage / file error`);
}

function main() {
  const args = process.argv.slice(2);

  let manifestPath = null;
  let root = null;
  let strict = false;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && i + 1 < args.length) {
      root = args[++i];
    } else if (args[i] === '--strict') {
      strict = true;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else if (!manifestPath) {
      manifestPath = args[i];
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      printUsage();
      process.exit(2);
    }
  }

  if (!manifestPath) {
    printUsage();
    process.exit(2);
  }

  // Read and parse manifest
  let manifest;
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading manifest: ${err.message}`);
    process.exit(2);
  }

  const { errors, warnings } = validateManifest(manifest, { root });

  if (jsonOutput) {
    const report = {
      valid: errors.length === 0 && (!strict || warnings.length === 0),
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
      },
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Console output
    console.log('=== Manifest Validation Report ===\n');

    if (errors.length > 0) {
      console.log(`ERRORS (${errors.length}):`);
      for (const e of errors) {
        const loc = e.family ? `[${e.family}]` : '';
        const key = e.key ? ` ${e.key}:` : '';
        console.log(`  ${e.code}${loc}${key} ${e.message}`);
      }
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`WARNINGS (${warnings.length}):`);
      for (const w of warnings) {
        const loc = w.family ? `[${w.family}]` : '';
        const key = w.key ? ` ${w.key}:` : '';
        console.log(`  ${w.code}${loc}${key} ${w.message}`);
      }
      console.log();
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('Manifest is valid. No errors or warnings.\n');
    } else {
      console.log(`Summary: ${errors.length} error(s), ${warnings.length} warning(s)`);
    }
  }

  // Exit code
  if (errors.length > 0) {
    process.exit(1);
  }
  if (strict && warnings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

// Run CLI if executed directly (not imported)
const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMainModule) {
  main();
}
