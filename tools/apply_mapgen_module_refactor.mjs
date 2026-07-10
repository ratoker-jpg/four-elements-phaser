#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/state/generatedMap.ts';
let text = await readFile(path, 'utf8');

function replaceExact(from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  text = text.replace(from, to);
}

function replaceRange(startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Missing patch range: ${label}`);
  }
  text = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

replaceExact(
`import type { MapData, TerrainType, ResourceType, Faction } from './types';
import type { MapStyle } from './gameSetup';
import { resolveResourceAnchors } from '../config/resourceAnchors';
import type { AcceptedResourceClassId } from '../config/coreMechanicsTypes';
import { ACCEPTED_RESOURCE_CLASS_IDS } from '../config/coreMechanicsTypes';`,
`import type { MapData, Faction } from './types';
import type { MapStyle } from './gameSetup';
import { resolveResourceAnchors } from '../config/resourceAnchors';
import type { AcceptedResourceClassId } from '../config/coreMechanicsTypes';
import type { MapSizeOption, ValidatedGeneratedMapResult } from './generatedMapTypes';
import {
  createSeededRng,
  normalizeSeed,
  mapSizeToDimensions,
} from './generatedMapSeed';
import { generateIndustrialTerrain, generateTerrain } from './generatedMapTerrain';
import { validateGeneratedMap } from './generatedMapValidation';

export type { MapSizeOption } from './generatedMapTypes';
export {
  GENERATED_MAP_ID_PREFIX,
  MAP_SIZE_DIMENSIONS,
  createRandomSeed,
  generatedMapId,
  generatedMapName,
  isGeneratedRuntimeState,
  mapSizeToDimensions,
  normalizeSeed,
} from './generatedMapSeed';
export {
  summarizeGeneratedMapQuality,
  type GeneratedMapQualitySummary,
} from './generatedMapValidation';`,
  'imports and compatibility re-exports',
);

replaceRange(
  '// ─── Types ──────────────────────────────────────────────────────────',
  '// ─── Generated map creation ─────────────────────────────────────────',
  `// ─── Shared configuration ────────────────────────────────────────────\n\n/** Maximum validation retry attempts before accepting the best candidate. */\nexport const MAX_VALIDATION_ATTEMPTS = 3;\n\n`,
  'types, PRNG and seed helpers',
);

replaceExact('const rng = mulberry32(seedInt);', 'const rng = createSeededRng(seedInt);', 'PRNG call');

replaceRange(
  '// ─── Terrain generation (patch-based) ───────────────────────────────',
  '// ─── Resource generation (CORE-STEP-03B: anchor-based) ──────────────',
  '',
  'terrain generation implementation',
);

replaceRange(
  '/**\n * Result of validated generated map creation.',
  '/**\n * Create a validated generated map with retry fallback.',
  '',
  'validated result interface',
);

replaceExact(
  '): ValidatedGeneratedMapResult {',
  '): ValidatedGeneratedMapResult<MapData> {',
  'validated result generic',
);

const validationStart = text.indexOf('/**\n * Lightweight validation result for a generated MapData.');
if (validationStart < 0) throw new Error('Missing validation implementation start');
text = `${text.slice(0, validationStart).trimEnd()}\n`;

await writeFile(path, text);
console.log('[mapgen-refactor] generatedMap.ts split into focused modules');
