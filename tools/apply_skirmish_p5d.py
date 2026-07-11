from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    return text.replace(old, new, 1)


# ── generatedMapValidation.ts ────────────────────────────────────────
path = 'src/state/generatedMapValidation.ts'
text = read(path)
text = replace_once(
    text,
    "import { validateCenterInfinityContract } from './centerInfinity';",
    "import { validateCenterInfinityContract } from './centerInfinity';\n"
    "import { validateFourCornerMapFairness } from './fourCornerFairness';",
    'fairness validation import',
)
text = replace_once(
    text,
    "  for (const issue of validateCenterInfinityContract(mapData)) {\n"
    "    if (!issues.includes(issue)) issues.push(issue);\n"
    "  }\n\n"
    "  return { valid: issues.length === 0, score, issues };",
    "  for (const issue of validateCenterInfinityContract(mapData)) {\n"
    "    if (!issues.includes(issue)) issues.push(issue);\n"
    "  }\n"
    "  if (mapData.headquarters?.length === 4) {\n"
    "    for (const issue of validateFourCornerMapFairness(mapData).issues) {\n"
    "      if (!issues.includes(issue)) issues.push(issue);\n"
    "    }\n"
    "  }\n\n"
    "  return { valid: issues.length === 0, score, issues };",
    'fairness validation integration',
)
write(path, text)


# ── focused tests ────────────────────────────────────────────────────
test = r'''import { describe, expect, it } from 'vitest';
import {
  createGeneratedMapData,
  createValidatedGeneratedMapData,
} from '../state/generatedMap';
import {
  createGeneratedMapStructuralFingerprint,
  MIN_REACHABLE_STARTER_RESOURCES,
  MIN_START_EXITS,
  validateFourCornerMapFairness,
} from '../state/fourCornerFairness';
import { getCenterApproachSectors } from '../state/centerInfinity';
import { getResourceQuadrant } from '../state/symmetricResources';
import type { Faction, MapData } from '../state/types';
import type { MapSizeOption } from '../state/generatedMapTypes';

const FACTIONS: Faction[] = ['cyan', 'green', 'yellow', 'purple'];
const SIZES: MapSizeOption[] = ['small', 'standard', 'large'];

function cloneMap(map: MapData): MapData {
  return JSON.parse(JSON.stringify(map)) as MapData;
}

function blockTiles(map: MapData, tiles: Array<{ tx: number; ty: number }>): void {
  for (const tile of tiles) {
    map.obstacles.push({
      tx: tile.tx,
      ty: tile.ty,
      type: 'rock-cluster',
      footprint: 1,
    });
  }
}

function allAdjacentHqTiles(map: MapData, faction: Faction): Array<{ tx: number; ty: number }> {
  const hq = map.headquarters!.find(candidate => candidate.faction === faction)!;
  const tiles: Array<{ tx: number; ty: number }> = [];
  for (let offset = 0; offset < 3; offset++) {
    tiles.push({ tx: hq.tx + offset, ty: hq.ty - 1 });
    tiles.push({ tx: hq.tx + offset, ty: hq.ty + 3 });
    tiles.push({ tx: hq.tx - 1, ty: hq.ty + offset });
    tiles.push({ tx: hq.tx + 3, ty: hq.ty + offset });
  }
  return tiles;
}

describe('SKIRMISH-P5D four-team fairness validation', () => {
  it.each(SIZES)('accepts every team start on deterministic %s maps', size => {
    const map = createGeneratedMapData(`p5d-fair-${size}`, size, 'cyan');
    const result = validateFourCornerMapFairness(map);
    expect(result.valid, result.issues.join('; ')).toBe(true);
    expect(Object.keys(result.teams)).toEqual(FACTIONS);
    for (const faction of FACTIONS) {
      expect(result.teams[faction].exitCount).toBeGreaterThanOrEqual(MIN_START_EXITS);
      expect(result.teams[faction].reachableStarterResources)
        .toBeGreaterThanOrEqual(MIN_REACHABLE_STARTER_RESOURCES);
      expect(result.teams[faction].centerReachable).toBe(true);
      expect(result.teams[faction].issues).toEqual([]);
    }
    expect(result.finiteResourceValue.cyan).toBeGreaterThan(0);
    expect(new Set(Object.values(result.finiteResourceValue)).size).toBe(1);
  });

  it.each(SIZES)('passes retry validation for all selected factions on %s maps', size => {
    for (const faction of FACTIONS) {
      const result = createValidatedGeneratedMapData(
        `p5d-validated-${size}-${faction}`,
        size,
        faction,
      );
      expect(result.valid, result.validation.issues.join('; ')).toBe(true);
      expect(validateFourCornerMapFairness(result.mapData).valid).toBe(true);
    }
  });

  it('has the same structural fingerprint for every selected human faction', () => {
    const fingerprints = FACTIONS.map(faction =>
      createGeneratedMapStructuralFingerprint(
        createGeneratedMapData('p5d-human-alias-independent', 'standard', faction),
      ),
    );
    expect(new Set(fingerprints).size).toBe(1);
  });

  it('is byte-deterministic for the same seed and size', () => {
    const first = createGeneratedMapData('p5d-byte-determinism', 'large', 'cyan');
    const second = createGeneratedMapData('p5d-byte-determinism', 'large', 'cyan');
    expect(createGeneratedMapStructuralFingerprint(first))
      .toBe(createGeneratedMapStructuralFingerprint(second));
  });

  it('reports duplicate/canonical Headquarters violations', () => {
    const map = cloneMap(createGeneratedMapData('p5d-bad-hq', 'standard', 'cyan'));
    map.headquarters![1].faction = 'cyan';
    map.headquarters![1].ownerTeamId = 'team-cyan';
    map.headquarters![2].tx += 1;
    const result = validateFourCornerMapFairness(map);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Headquarters factions are not unique');
    expect(result.issues).toContain('Headquarters ownerTeamId values are not four unique teams');
    expect(result.issues.some(issue => issue.includes('is not at its canonical corner'))).toBe(true);
  });

  it('reports a fully blocked start and zero viable exits', () => {
    const map = cloneMap(createGeneratedMapData('p5d-blocked-start', 'standard', 'cyan'));
    blockTiles(map, allAdjacentHqTiles(map, 'cyan'));
    const result = validateFourCornerMapFairness(map);
    expect(result.valid).toBe(false);
    expect(result.teams.cyan.exitCount).toBe(0);
    expect(result.teams.cyan.centerReachable).toBe(false);
    expect(result.issues).toContain(
      `cyan start has 0 viable exit sector(s); need ${MIN_START_EXITS}`,
    );
    expect(result.issues).toContain('cyan cannot reach the center approaches');
  });

  it('reports missing starter resources and quadrant value mismatch', () => {
    const map = cloneMap(createGeneratedMapData('p5d-missing-starters', 'standard', 'cyan'));
    map.resources = map.resources.filter(resource =>
      resource.type === 'infinite'
      || getResourceQuadrant(resource, map.width, map.height) !== 'cyan',
    );
    const result = validateFourCornerMapFairness(map);
    expect(result.valid).toBe(false);
    expect(result.teams.cyan.reachableStarterResources).toBe(0);
    expect(result.issues).toContain(
      `cyan can reach 0 starter resource(s); need ${MIN_REACHABLE_STARTER_RESOURCES}`,
    );
    expect(result.issues.some(issue => issue.startsWith('Finite resource value mismatch'))).toBe(true);
  });

  it('reports blocked center approaches for all teams', () => {
    const map = cloneMap(createGeneratedMapData('p5d-blocked-center', 'standard', 'cyan'));
    blockTiles(
      map,
      getCenterApproachSectors(map.width, map.height).flatMap(sector => sector.tiles),
    );
    const result = validateFourCornerMapFairness(map);
    expect(result.valid).toBe(false);
    for (const faction of FACTIONS) {
      expect(result.teams[faction].centerReachable).toBe(false);
      expect(result.issues).toContain(`${faction} cannot reach the center approaches`);
    }
    expect(result.issues.some(issue => issue.includes('approach sector is blocked'))).toBe(true);
  });

  it('keeps fingerprint independent from legacy hq alias and starter Builder', () => {
    const cyan = createGeneratedMapData('p5d-fingerprint-alias', 'standard', 'cyan');
    const purple = createGeneratedMapData('p5d-fingerprint-alias', 'standard', 'purple');
    purple.hq = { ...purple.headquarters!.find(hq => hq.faction === 'purple')! };
    purple.builders.push({ ...purple.builders[0], id: 'extra-human-only-builder' });
    expect(createGeneratedMapStructuralFingerprint(purple))
      .toBe(createGeneratedMapStructuralFingerprint(cyan));
  });
});
'''
write('src/__tests__/fourCornerFairness.test.ts', test)

print('SKIRMISH-P5D patch applied')
