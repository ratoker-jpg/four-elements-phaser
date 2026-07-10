#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, replacements) {
  let text = await readFile(path, 'utf8');
  for (const [from, to, label] of replacements) {
    if (!text.includes(from)) throw new Error(`${path}: missing target: ${label}`);
    text = text.replace(from, to);
  }
  await writeFile(path, text);
  console.log(`[phase2-compat-fixup] patched ${path}`);
}

await patch('src/state/types.ts', [
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
]);

await patch('src/__tests__/production.test.ts', [
  [
`  it('processFactorySpawns creates a ModularCombatUnit with correct bodyId/weaponId/mod', () => {`,
`  it('processFactorySpawns creates a ModularCombatUnit with independent hull/turret mods', () => {`,
    'combat production test name',
  ],
  [
`    expect(combatUnit.mod).toBe('m0');`,
`    expect(combatUnit.hullMod).toBe('m0');
    expect(combatUnit.turretMod).toBe('m0');
    expect(combatUnit.mod).toBeUndefined();`,
    'split combat modification assertions',
  ],
]);
