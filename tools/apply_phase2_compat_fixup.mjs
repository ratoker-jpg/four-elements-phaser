#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/state/types.ts';
let text = await readFile(path, 'utf8');

const replacements = [
  [
`  hullMod: ModLevel;
  turretMod: ModLevel;
  faction: Faction;
  /** Runtime 8-direction facing. */`,
`  /** Canonical split fields; optional only for old saves/test fixtures before normalization. */
  hullMod?: ModLevel;
  turretMod?: ModLevel;
  faction: Faction;
  /** Runtime 8-direction facing. */`,
    'legacy modular modification compatibility',
  ],
  [
`  /** Auto-incrementing counter for deterministic produced combat-unit IDs. */
  nextCombatUnitId: number;`,
`  /** Auto-incrementing counter for deterministic produced combat-unit IDs. Missing only in old saves/fixtures. */
  nextCombatUnitId?: number;`,
    'legacy GameState counter compatibility',
  ],
];

for (const [from, to, label] of replacements) {
  if (!text.includes(from)) throw new Error(`missing target: ${label}`);
  text = text.replace(from, to);
}

await writeFile(path, text);
console.log('[phase2-compat-fixup] patched src/state/types.ts');
