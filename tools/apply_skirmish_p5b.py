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


path = 'src/state/generatedMap.ts'
text = read(path)
text = replace_once(
    text,
    "import { resolveResourceAnchors } from '../config/resourceAnchors';\n"
    "import type { AcceptedResourceClassId } from '../config/coreMechanicsTypes';",
    "import { createSymmetricGeneratedResources } from './symmetricResources';",
    'generated resource import',
)
text = replace_once(
    text,
    " * - Starter zone: very_poor/poor/medium near HQ\n"
    " * - Side zone: medium/rich at intermediate distance\n"
    " * - Contested zone: rich/very_rich farther from HQ",
    " * - Mirrored finite starter/side/contested resources in all four quadrants\n"
    " * - Equal resource classes, footprints and deterministic raw value per quadrant",
    'generated map resource docs',
)
text = replace_once(
    text,
    "  // ── Resources: anchor-based placement using 6-class model (CORE-STEP-03B) ──\n"
    "  const resources = generateResources(rng, W, H, hq, occupied);",
    "  // ── Resources: generate once from cyan SW and mirror accepted quartets ──\n"
    "  const resources = createSymmetricGeneratedResources(\n"
    "    rng, W, H, headquarters, occupied,\n"
    "  );",
    'generated symmetric resource call',
)
start = text.find('// ─── Resource generation (CORE-STEP-03B: anchor-based)')
end = text.find('// ─── Obstacle/Decor generation (DEFERRED)', start)
if start < 0 or end < 0:
    raise RuntimeError('legacy generated resource function boundary not found')
text = text[:start] + '// ─── Symmetric resource generation lives in symmetricResources.ts ──\n\n' + text[end:]
write(path, text)


test = r'''import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { mirrorPlacement } from '../state/mapSymmetry';
import {
  getFiniteResourceValueByQuadrant,
  getResourceQuadrant,
} from '../state/symmetricResources';
import type { Faction, ResourcePlacement } from '../state/types';
import type { MapSizeOption } from '../state/generatedMapTypes';

const FACTIONS: Faction[] = ['cyan', 'green', 'yellow', 'purple'];

function finiteResources(resources: readonly ResourcePlacement[]): ResourcePlacement[] {
  return resources.filter(resource =>
    resource.resourceClass !== 'infinite' && resource.type !== 'infinite',
  );
}

function classCountsByQuadrant(
  resources: readonly ResourcePlacement[],
  width: number,
  height: number,
): Record<Faction, Record<string, number>> {
  const result = Object.fromEntries(FACTIONS.map(faction => [faction, {}])) as Record<
    Faction,
    Record<string, number>
  >;
  for (const resource of finiteResources(resources)) {
    const quadrant = getResourceQuadrant(resource, width, height);
    expect(quadrant).not.toBeNull();
    const key = resource.resourceClass ?? resource.type;
    result[quadrant!][key] = (result[quadrant!][key] ?? 0) + 1;
  }
  return result;
}

function expectNoResourceOverlap(resources: readonly ResourcePlacement[]): void {
  const occupied = new Set<string>();
  for (const resource of resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        const key = `${resource.tx + dx},${resource.ty + dy}`;
        expect(occupied.has(key), `resource overlap at ${key}`).toBe(false);
        occupied.add(key);
      }
    }
  }
}

describe('SKIRMISH-P5B symmetric finite resources', () => {
  it.each(['small', 'standard', 'large'] as MapSizeOption[])(
    'creates complete mirrored finite quartets on %s maps',
    size => {
      const map = createGeneratedMapData(`symmetric-quartets-${size}`, size, 'cyan');
      const finite = finiteResources(map.resources);
      expect(finite.length).toBeGreaterThan(0);
      expect(finite.length % 4).toBe(0);

      for (let index = 0; index < finite.length; index += 4) {
        const [cyan, green, yellow, purple] = finite.slice(index, index + 4);
        expect(green).toEqual(expect.objectContaining({
          ...cyan,
          ...mirrorPlacement(cyan, map.width, map.height, 'horizontal'),
        }));
        expect(yellow).toEqual(expect.objectContaining({
          ...cyan,
          ...mirrorPlacement(cyan, map.width, map.height, 'rotational'),
        }));
        expect(purple).toEqual(expect.objectContaining({
          ...cyan,
          ...mirrorPlacement(cyan, map.width, map.height, 'vertical'),
        }));
        expect(new Set([cyan.resourceClass, green.resourceClass, yellow.resourceClass, purple.resourceClass]).size).toBe(1);
        expect(new Set([cyan.footprint, green.footprint, yellow.footprint, purple.footprint]).size).toBe(1);
      }
    },
  );

  it.each(['small', 'standard', 'large'] as MapSizeOption[])(
    'has identical finite class counts and deterministic raw value in every %s quadrant',
    size => {
      const map = createGeneratedMapData(`symmetric-value-${size}`, size, 'green');
      const counts = classCountsByQuadrant(map.resources, map.width, map.height);
      expect(counts.green).toEqual(counts.cyan);
      expect(counts.yellow).toEqual(counts.cyan);
      expect(counts.purple).toEqual(counts.cyan);

      const values = getFiniteResourceValueByQuadrant(map.resources, map.width, map.height);
      expect(values.cyan).toBeGreaterThan(0);
      expect(values.green).toBe(values.cyan);
      expect(values.yellow).toBe(values.cyan);
      expect(values.purple).toBe(values.cyan);
    },
  );

  it('uses the same structural resource map regardless of selected human faction', () => {
    const baseline = createGeneratedMapData('faction-independent-resources', 'standard', 'cyan').resources;
    for (const faction of FACTIONS.slice(1)) {
      expect(createGeneratedMapData('faction-independent-resources', 'standard', faction).resources)
        .toEqual(baseline);
    }
  });

  it('keeps exactly one shared Infinity deposit and no resource overlaps', () => {
    const map = createGeneratedMapData('one-infinity-after-mirroring', 'standard', 'purple');
    expect(map.resources.filter(resource => resource.type === 'infinite')).toHaveLength(1);
    expectNoResourceOverlap(map.resources);
  });

  it('does not overlap any Headquarters footprint', () => {
    const map = createGeneratedMapData('resource-hq-separation', 'large', 'yellow');
    const hqTiles = new Set<string>();
    for (const hq of map.headquarters!) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) hqTiles.add(`${hq.tx + dx},${hq.ty + dy}`);
      }
    }
    for (const resource of map.resources) {
      for (let dy = 0; dy < resource.footprint; dy++) {
        for (let dx = 0; dx < resource.footprint; dx++) {
          expect(hqTiles.has(`${resource.tx + dx},${resource.ty + dy}`)).toBe(false);
        }
      }
    }
  });

  it('is byte-structurally deterministic for the same seed and size', () => {
    const first = createGeneratedMapData('symmetric-resource-determinism', 'large', 'cyan');
    const second = createGeneratedMapData('symmetric-resource-determinism', 'large', 'cyan');
    expect(JSON.stringify(first.resources)).toBe(JSON.stringify(second.resources));
  });
});
'''
write('src/__tests__/symmetricResources.test.ts', test)

print('SKIRMISH-P5B patch applied')
