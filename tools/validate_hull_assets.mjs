#!/usr/bin/env node
/**
 * Filesystem validation script for generated hull sprite assets.
 *
 * HULL-ASSET-01: Verifies that all 1792 expected PNG files exist
 * under public/assets/units/hulls/.
 *
 * Usage:
 *   node tools/validate_hull_assets.mjs
 *
 * This is intentionally a standalone script (not a vitest test)
 * because iterating 1792 filesystem checks is too slow for the
 * normal test suite.
 */

import { existsSync } from 'fs';
import { join } from 'path';

const HULLS = ['wasp', 'hornet', 'hunter', 'viking', 'titan', 'mammoth', 'dictator'];
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

const ROOT = join(import.meta.dirname, '..', 'public', 'assets', 'units', 'hulls');

let expected = 0;
let found = 0;
let missing = 0;
const missingPaths = [];

for (const hull of HULLS) {
  for (const faction of FACTIONS) {
    for (const mod of MODS) {
      for (const dir of DIRS) {
        expected++;
        const dirPadded = String(dir.index).padStart(2, '0');
        const filename = `${hull}_${faction}_${mod}_hull_dir${dirPadded}_${dir.suffix}.png`;
        const fullPath = join(ROOT, hull, faction, mod, filename);
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

console.log(`[validate_hull_assets] Expected: ${expected}`);
console.log(`[validate_hull_assets] Found:    ${found}`);
console.log(`[validate_hull_assets] Missing:  ${missing}`);

if (missing > 0) {
  console.log(`[validate_hull_assets] First missing paths:`);
  missingPaths.forEach(p => console.log(`  ${p}`));
  process.exit(1);
} else {
  console.log(`[validate_hull_assets] All ${expected} hull PNGs present.`);
  process.exit(0);
}
