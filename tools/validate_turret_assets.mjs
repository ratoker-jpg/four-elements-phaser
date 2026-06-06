#!/usr/bin/env node
/**
 * Filesystem validation script for generated turret sprite assets.
 *
 * RUNTIME-TURRET-01: Verifies that all 2560 expected PNG files exist
 * under public/assets/units/turrets/.
 *
 * Usage:
 *   node tools/validate_turret_assets.mjs
 *
 * This is intentionally a standalone script (not a vitest test)
 * because iterating 2560 filesystem checks is too slow for the
 * normal test suite.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const TURRETS = ['smoky', 'thunder', 'railgun', 'firebird', 'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer'];
const FACTIONS = ['cyan', 'green', 'yellow', 'purple'];
const MODS = ['m0', 'm1', 'm2', 'm3'];
const DIRS = [
  { index: 0, suffix: 'E' }, { index: 1, suffix: 'ESE' },
  { index: 2, suffix: 'SE' }, { index: 3, suffix: 'SSE' },
  { index: 4, suffix: 'S' }, { index: 5, suffix: 'SSW' },
  { index: 6, suffix: 'SW' }, { index: 7, suffix: 'WSW' },
  { index: 8, suffix: 'W' }, { index: 9, suffix: 'WNW' },
  { index: 10, suffix: 'NW' }, { index: 11, suffix: 'NNW' },
  { index: 12, suffix: 'N' }, { index: 13, suffix: 'NNE' },
  { index: 14, suffix: 'NE' }, { index: 15, suffix: 'ENE' },
];

const ROOT = join(import.meta.dirname, '..', 'public', 'assets', 'units', 'turrets');

let expected = 0;
let found = 0;
let missing = 0;
let extra = 0;
const missingPaths = [];
const extraPaths = [];

// ─── Check expected files ────────────────────────────────────────

for (const turret of TURRETS) {
  for (const faction of FACTIONS) {
    for (const mod of MODS) {
      for (const dir of DIRS) {
        expected++;
        const dirPadded = String(dir.index).padStart(2, '0');
        const filename = `${turret}_${faction}_${mod}_turret_dir${dirPadded}_${dir.suffix}.png`;
        const fullPath = join(ROOT, turret, faction, mod, filename);
        if (existsSync(fullPath)) {
          found++;
        } else {
          missing++;
          if (missingPaths.length < 20) {
            missingPaths.push(fullPath);
          }
        }
      }
    }
  }
}

// ─── Check for extra/unexpected files ────────────────────────────

const expectedFilenames = new Set();
for (const turret of TURRETS) {
  for (const faction of FACTIONS) {
    for (const mod of MODS) {
      for (const dir of DIRS) {
        const dirPadded = String(dir.index).padStart(2, '0');
        expectedFilenames.add(`${turret}_${faction}_${mod}_turret_dir${dirPadded}_${dir.suffix}.png`);
      }
    }
  }
}

// Scan for actual files that don't match expected names
for (const turret of TURRETS) {
  const turretDir = join(ROOT, turret);
  if (!existsSync(turretDir)) continue;

  for (const faction of FACTIONS) {
    const factionDir = join(turretDir, faction);
    if (!existsSync(factionDir)) continue;

    for (const mod of MODS) {
      const modDir = join(factionDir, mod);
      if (!existsSync(modDir)) continue;

      try {
        const files = readdirSync(modDir);
        for (const file of files) {
          if (file.endsWith('.png') && !expectedFilenames.has(file)) {
            extra++;
            if (extraPaths.length < 20) {
              extraPaths.push(join(modDir, file));
            }
          }
        }
      } catch {
        // Directory might not be readable — skip
      }
    }
  }
}

// ─── Verify directory structure ──────────────────────────────────

let turretsFound = 0;
let factionsFound = 0;
let modsFound = 0;
let dirsPerSet = 0;

for (const turret of TURRETS) {
  const turretDir = join(ROOT, turret);
  if (existsSync(turretDir)) {
    turretsFound++;

    for (const faction of FACTIONS) {
      const factionDir = join(turretDir, faction);
      if (existsSync(factionDir)) {
        factionsFound++;

        for (const mod of MODS) {
          const modDir = join(factionDir, mod);
          if (existsSync(modDir)) {
            modsFound++;

            // Count PNGs in this mod dir
            try {
              const files = readdirSync(modDir).filter(f => f.endsWith('.png'));
              if (turret === TURRETS[0] && faction === FACTIONS[0] && mod === MODS[0]) {
                dirsPerSet = files.length;
              }
            } catch {
              // skip
            }
          }
        }
      }
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────

console.log(`[validate_turret_assets] Turret folders:    ${turretsFound} / ${TURRETS.length}`);
console.log(`[validate_turret_assets] Faction folders:   ${factionsFound} / ${TURRETS.length * FACTIONS.length}`);
console.log(`[validate_turret_assets] Mod folders:       ${modsFound} / ${TURRETS.length * FACTIONS.length * MODS.length}`);
console.log(`[validate_turret_assets] PNGs per set:      ${dirsPerSet} (expected 16)`);
console.log(`[validate_turret_assets] Expected PNGs:     ${expected}`);
console.log(`[validate_turret_assets] Found PNGs:        ${found}`);
console.log(`[validate_turret_assets] Missing PNGs:      ${missing}`);
console.log(`[validate_turret_assets] Extra PNGs:        ${extra}`);

let hasErrors = false;

if (missing > 0) {
  hasErrors = true;
  console.log(`[validate_turret_assets] First missing paths:`);
  missingPaths.forEach(p => console.log(`  ${p}`));
}

if (extra > 0) {
  hasErrors = true;
  console.log(`[validate_turret_assets] First extra paths:`);
  extraPaths.forEach(p => console.log(`  ${p}`));
}

if (turretsFound !== TURRETS.length) {
  hasErrors = true;
  console.log(`[validate_turret_assets] ERROR: Expected ${TURRETS.length} turret folders, found ${turretsFound}`);
}

if (factionsFound !== TURRETS.length * FACTIONS.length) {
  hasErrors = true;
  console.log(`[validate_turret_assets] ERROR: Expected ${TURRETS.length * FACTIONS.length} faction folders, found ${factionsFound}`);
}

if (modsFound !== TURRETS.length * FACTIONS.length * MODS.length) {
  hasErrors = true;
  console.log(`[validate_turret_assets] ERROR: Expected ${TURRETS.length * FACTIONS.length * MODS.length} mod folders, found ${modsFound}`);
}

if (dirsPerSet !== 16) {
  hasErrors = true;
  console.log(`[validate_turret_assets] ERROR: Expected 16 PNGs per turret/faction/mod set, found ${dirsPerSet}`);
}

if (hasErrors) {
  console.log(`[validate_turret_assets] VALIDATION FAILED`);
  process.exit(1);
} else {
  console.log(`[validate_turret_assets] All ${expected} turret PNGs present. VALIDATION PASSED.`);
  process.exit(0);
}
