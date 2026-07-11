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


# ── symmetricResources.ts ────────────────────────────────────────────
path = 'src/state/symmetricResources.ts'
text = read(path)
text = replace_once(
    text,
    "import { mirrorPlacement, type MapSymmetry } from './mapSymmetry';",
    "import { mirrorPlacement, type MapSymmetry } from './mapSymmetry';\n"
    "import {\n"
    "  createCenterInfinityPlacement, getCenterProtectedTiles,\n"
    "} from './centerInfinity';",
    'symmetric center import',
)
text = replace_once(
    text,
    "  const finite = resolved.filter(placement => placement.resourceClass !== 'infinite');\n"
    "  const infinite = resolved.find(placement => placement.resourceClass === 'infinite');",
    "  const finite = resolved.filter(placement => placement.resourceClass !== 'infinite');",
    'remove anchor infinite',
)
old_center = """  // Reserve the center before accepting contested quartets so no mirrored finite
  // placement can occupy the shared Infinity footprint.
  let infinitePlacement: ResourcePlacement | null = null;
  if (infinite) {
    infinitePlacement = toResourcePlacement(infinite);
    if (placementIsInBounds(infinitePlacement, width, height)) {
      markPlacement(finalOccupied, infinitePlacement);
    } else {
      infinitePlacement = null;
    }
  }"""
new_center = """  // Reserve the full protected center zone before accepting contested quartets.
  // The exact 2x2 Infinity placement is canonical and no longer depends on anchors.
  const infinitePlacement = createCenterInfinityPlacement(width, height);
  for (const tile of getCenterProtectedTiles(width, height)) {
    finalOccupied.add(`${tile.tx},${tile.ty}`);
  }"""
text = replace_once(text, old_center, new_center, 'canonical center reservation')
text = replace_once(
    text,
    "  if (infinitePlacement) output.push(infinitePlacement);\n  return output;",
    "  output.push(infinitePlacement);\n  return output;",
    'always append center infinity',
)
write(path, text)


# ── occupancy.ts ─────────────────────────────────────────────────────
path = 'src/state/occupancy.ts'
text = read(path)
text = replace_once(
    text,
    "import { getMapHeadquarters, HQ_FOOTPRINT } from './mapHeadquarters';",
    "import { getMapHeadquarters, HQ_FOOTPRINT } from './mapHeadquarters';\n"
    "import { getCenterProtectedTiles, isExactCenterInfinity } from './centerInfinity';",
    'occupancy center import',
)
text = replace_once(
    text,
    "  // ── Resources — ARCH-05X: impassable for movement while non-depleted",
    "  // ── Protected center zone — construction-blocked, movement remains open ──\n"
    "  if (state.mapData.resources.some(resource =>\n"
    "    isExactCenterInfinity(resource, width, height),\n"
    "  )) {\n"
    "    for (const tile of getCenterProtectedTiles(width, height)) {\n"
    "      getOrMake(flags, key(tile.tx, tile.ty, width)).add('unbuildable');\n"
    "    }\n"
    "  }\n\n"
    "  // ── Resources — ARCH-05X: impassable for movement while non-depleted",
    'occupancy protected center',
)
write(path, text)


# ── generatedMapValidation.ts ────────────────────────────────────────
path = 'src/state/generatedMapValidation.ts'
text = read(path)
text = replace_once(
    text,
    "import { ACCEPTED_RESOURCE_CLASS_IDS } from '../config/coreMechanicsTypes';",
    "import { ACCEPTED_RESOURCE_CLASS_IDS } from '../config/coreMechanicsTypes';\n"
    "import { validateCenterInfinityContract } from './centerInfinity';",
    'validation center import',
)
text = replace_once(
    text,
    "  if (infiniteCount !== 1) {\n    issues.push(`Expected exactly 1 infinite resourceClass deposit, found ${infiniteCount}`);\n  }\n\n  return { valid: issues.length === 0, score, issues };",
    "  if (infiniteCount !== 1) {\n"
    "    issues.push(`Expected exactly 1 infinite resourceClass deposit, found ${infiniteCount}`);\n"
    "  }\n\n"
    "  for (const issue of validateCenterInfinityContract(mapData)) {\n"
    "    if (!issues.includes(issue)) issues.push(issue);\n"
    "  }\n\n"
    "  return { valid: issues.length === 0, score, issues };",
    'validation center issues',
)
write(path, text)


# ── focused tests ────────────────────────────────────────────────────
test = r'''import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import {
  CENTER_INFINITY_FOOTPRINT,
  CENTER_PROTECTION_MARGIN,
  createCenterInfinityPlacement,
  getCenterApproachSectors,
  getCenterProtectedTiles,
  isExactCenterInfinity,
  validateCenterInfinityContract,
} from '../state/centerInfinity';
import { buildOccupancyMap, getFlags, isBuildable, isPassable } from '../state/occupancy';
import type { MapSizeOption } from '../state/generatedMapTypes';

const SIZES: MapSizeOption[] = ['small', 'standard', 'large'];

function tileKeys(tiles: Array<{ tx: number; ty: number }>): Set<string> {
  return new Set(tiles.map(tile => `${tile.tx},${tile.ty}`));
}

describe('SKIRMISH-P5C canonical center Infinity contract', () => {
  it.each(SIZES)('places exactly one canonical centered 2x2 Infinity on %s maps', size => {
    const map = createGeneratedMapData(`center-infinity-${size}`, size, 'cyan');
    const infinite = map.resources.filter(resource =>
      resource.type === 'infinite' || resource.resourceClass === 'infinite',
    );
    expect(infinite).toHaveLength(1);
    expect(infinite[0]).toEqual(createCenterInfinityPlacement(map.width, map.height));
    expect(infinite[0].footprint).toBe(CENTER_INFINITY_FOOTPRINT);
    expect(isExactCenterInfinity(infinite[0], map.width, map.height)).toBe(true);
  });

  it.each(SIZES)('keeps the protected center zone free of finite resources and Headquarters on %s maps', size => {
    const map = createGeneratedMapData(`center-protection-${size}`, size, 'purple');
    const protectedTiles = tileKeys(getCenterProtectedTiles(map.width, map.height));
    const infinity = createCenterInfinityPlacement(map.width, map.height);

    for (const resource of map.resources) {
      if (isExactCenterInfinity(resource, map.width, map.height)) continue;
      for (let dy = 0; dy < resource.footprint; dy++) {
        for (let dx = 0; dx < resource.footprint; dx++) {
          expect(protectedTiles.has(`${resource.tx + dx},${resource.ty + dy}`)).toBe(false);
        }
      }
    }
    for (const hq of map.headquarters!) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          expect(protectedTiles.has(`${hq.tx + dx},${hq.ty + dy}`)).toBe(false);
        }
      }
    }
    expect(protectedTiles.has(`${infinity.tx},${infinity.ty}`)).toBe(true);
  });

  it.each(SIZES)('provides four two-tile passable approach sectors on %s maps', size => {
    const map = createGeneratedMapData(`center-approaches-${size}`, size, 'green');
    const state = createInitialState(map, 'green');
    const occupancy = buildOccupancyMap(state);
    const sectors = getCenterApproachSectors(map.width, map.height);
    expect(sectors.map(sector => sector.direction)).toEqual(['north', 'east', 'south', 'west']);
    for (const sector of sectors) {
      expect(sector.tiles).toHaveLength(2);
      for (const tile of sector.tiles) {
        expect(isPassable(occupancy, tile.tx, tile.ty), `${sector.direction} approach`).toBe(true);
        expect(getFlags(occupancy, tile.tx, tile.ty).has('unbuildable')).toBe(true);
      }
    }
  });

  it('marks the whole protected zone unbuildable but only the Infinity footprint impassable', () => {
    const map = createGeneratedMapData('center-occupancy-flags', 'standard', 'cyan');
    const state = createInitialState(map, 'cyan');
    const occupancy = buildOccupancyMap(state);
    const infinity = createCenterInfinityPlacement(map.width, map.height);
    const protectedTiles = getCenterProtectedTiles(map.width, map.height);

    expect(protectedTiles).toHaveLength(
      (CENTER_INFINITY_FOOTPRINT + CENTER_PROTECTION_MARGIN * 2) ** 2,
    );
    for (const tile of protectedTiles) {
      expect(getFlags(occupancy, tile.tx, tile.ty).has('unbuildable')).toBe(true);
    }
    expect(getFlags(occupancy, infinity.tx, infinity.ty).has('impassable')).toBe(true);
    expect(isBuildable(
      occupancy,
      infinity.tx - CENTER_PROTECTION_MARGIN,
      infinity.ty - CENTER_PROTECTION_MARGIN,
      1,
      1,
    )).toBe(false);
  });

  it.each(SIZES)('passes the structural center validator on generated %s maps', size => {
    const map = createGeneratedMapData(`center-validator-${size}`, size, 'yellow');
    expect(validateCenterInfinityContract(map)).toEqual([]);
  });

  it('reports displaced Infinity, finite center intrusion and blocked approach sectors', () => {
    const displaced = createGeneratedMapData('displaced-center-contract', 'standard', 'cyan');
    const infinity = displaced.resources.find(resource => resource.type === 'infinite')!;
    infinity.tx += 1;
    expect(validateCenterInfinityContract(displaced)).toContain(
      'Infinity deposit is not the exact canonical centered 2x2 placement',
    );

    const intruded = createGeneratedMapData('finite-center-contract', 'standard', 'cyan');
    const center = createCenterInfinityPlacement(intruded.width, intruded.height);
    intruded.resources.push({
      tx: center.tx - 2,
      ty: center.ty,
      type: 'small',
      footprint: 1,
      resourceClass: 'very_poor',
    });
    expect(validateCenterInfinityContract(intruded)).toContain(
      'Finite resource intersects the protected center zone',
    );
    expect(validateCenterInfinityContract(intruded)).toContain(
      'Center west approach sector is blocked',
    );
  });

  it('is independent of the selected human faction', () => {
    const expected = createGeneratedMapData('center-faction-independent', 'large', 'cyan')
      .resources.find(resource => resource.type === 'infinite');
    for (const faction of ['green', 'yellow', 'purple'] as const) {
      expect(createGeneratedMapData('center-faction-independent', 'large', faction)
        .resources.find(resource => resource.type === 'infinite')).toEqual(expected);
    }
  });
});
'''
write('src/__tests__/centerInfinity.test.ts', test)

print('SKIRMISH-P5C patch applied')
