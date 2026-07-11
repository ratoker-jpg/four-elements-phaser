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


# ── types.ts ─────────────────────────────────────────────────────────
path = 'src/state/types.ts'
text = read(path)
text = replace_once(
    text,
    "  hq: HqPlacement;\n  resources: ResourcePlacement[];",
    "  /** Human compatibility alias; canonical new maps may contain all four entries below. */\n"
    "  hq: HqPlacement;\n"
    "  /** Canonical map Headquarters placements. Missing on legacy maps/saves. */\n"
    "  headquarters?: HqPlacement[];\n"
    "  resources: ResourcePlacement[];",
    'MapData headquarters field',
)
write(path, text)


# ── generatedMap.ts ──────────────────────────────────────────────────
path = 'src/state/generatedMap.ts'
text = read(path)
text = replace_once(
    text,
    "import { validateGeneratedMap } from './generatedMapValidation';",
    "import { validateGeneratedMap } from './generatedMapValidation';\n"
    "import { createFourCornerHeadquarters, HQ_FOOTPRINT } from './mapHeadquarters';",
    'generated map headquarters import',
)
start = text.find('/** HQ X offset from left edge')
end = text.find('/**\n * Create a deterministic generated MapData', start)
if start < 0 or end < 0:
    raise RuntimeError('generated map legacy HQ constants boundary not found')
text = text[:start] + text[end:]
text = replace_once(
    text,
    " * - HQ at (4, mapHeight-7) with a 3×3 footprint (lower-left start zone)\n * - One idle builder NE of HQ at (hq.tx+1, hq.ty-1)",
    " * - Four mirrored 3×3 Headquarters in the map corners\n"
    " * - `hq` remains the selected human faction compatibility alias\n"
    " * - One idle human Builder placed toward the map center",
    'generated map doc HQ',
)
text = replace_once(
    text,
    "  // ── HQ: lower-left start zone ──\n  const hqTy = hqOffsetTy(H);\n  const hq = { tx: HQ_OFFSET_TX, ty: hqTy, faction };\n\n  // ── Builder: NE of HQ, toward map center ──\n  const builderTx = hq.tx + 1;\n  const builderTy = hq.ty - 1;",
    "  // ── Headquarters: create one south-west placement and mirror over X/Y ──\n"
    "  const headquarters = createFourCornerHeadquarters(W, H);\n"
    "  const hq = headquarters.find(candidate => candidate.faction === faction)!;\n\n"
    "  // ── Human Builder: one tile outside the HQ toward map center ──\n"
    "  const horizontalDirection = hq.tx < W / 2 ? 1 : -1;\n"
    "  const verticalDirection = hq.ty < H / 2 ? 1 : -1;\n"
    "  const builderTx = hq.tx + 1 + horizontalDirection * 2;\n"
    "  const builderTy = hq.ty + 1 + verticalDirection * 2;",
    'generated map four HQ creation',
)
text = replace_once(
    text,
    "      id: 'builder-0',\n      tx: builderTx,",
    "      id: 'builder-0',\n"
    "      ownerTeamId: hq.ownerTeamId,\n"
    "      tx: builderTx,",
    'generated builder owner',
)
text = replace_once(
    text,
    "  // Mark HQ area as occupied (3×3 footprint + 1 tile margin)\n  for (let dy = -1; dy <= 3; dy++) {\n    for (let dx = -1; dx <= 3; dx++) {\n      occupied.add(`${hq.tx + dx},${hq.ty + dy}`);\n    }\n  }",
    "  // Mark all HQ areas as occupied (3×3 footprint + 1 tile margin).\n"
    "  for (const headquartersPlacement of headquarters) {\n"
    "    for (let dy = -1; dy <= HQ_FOOTPRINT; dy++) {\n"
    "      for (let dx = -1; dx <= HQ_FOOTPRINT; dx++) {\n"
    "        occupied.add(`${headquartersPlacement.tx + dx},${headquartersPlacement.ty + dy}`);\n"
    "      }\n"
    "    }\n"
    "  }",
    'generated occupied HQs',
)
text = replace_once(
    text,
    "    hq,\n    resources,",
    "    hq: { ...hq },\n"
    "    headquarters,\n"
    "    resources,",
    'generated return headquarters',
)
write(path, text)


# ── createInitialState.ts ────────────────────────────────────────────
path = 'src/state/createInitialState.ts'
text = read(path)
text = replace_once(
    text,
    "import { createInitialMatchState, normalizeMatchState } from './matchState';",
    "import {\n"
    "  createInitialMatchState, factionForTeamId, normalizeMatchState, teamIdForFaction,\n"
    "} from './matchState';\n"
    "import { getMapHeadquarters, normalizeMapHeadquarters } from './mapHeadquarters';",
    'initial state headquarters imports',
)
text = replace_once(
    text,
    "  const faction = playerFaction ?? (mapData.hq.faction as Faction);\n\n  // ARENA-01H+:",
    "  const faction = playerFaction ?? (mapData.hq.faction as Faction);\n"
    "  normalizeMapHeadquarters(mapData, faction);\n\n"
    "  // ARENA-01H+:",
    'initial map HQ normalization',
)
text = replace_once(
    text,
    "      faction: h.faction,\n    });",
    "      faction: h.faction,\n"
    "      ownerTeamId: h.ownerTeamId,\n"
    "    });",
    'extra harvester entity owner',
)
text = replace_once(
    text,
    "      faction: mc.faction,\n      dir: 2,",
    "      faction: mc.faction,\n"
    "      ownerTeamId: mc.ownerTeamId,\n"
    "      dir: 2,",
    'extra combat entity owner',
)
# Runtime harvester builder type and owner propagation.
text = replace_once(
    text,
    "function buildHarvesterStates(\n  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>,",
    "function buildHarvesterStates(\n"
    "  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction; ownerTeamId?: import('./types').TeamId }>,",
    'harvester state input owner',
)
text = replace_once(
    text,
    "    createHarvester(`harvester-${i}`, h.tx, h.ty, h.faction),",
    "    createHarvester(`harvester-${i}`, h.tx, h.ty, h.faction, h.ownerTeamId),",
    'harvester runtime owner',
)
text = replace_once(
    text,
    "      queue: [],\n      active: false,\n    }));",
    "      queue: [],\n"
    "      active: false,\n"
    "      ownerTeamId: b.ownerTeamId,\n"
    "    }));",
    'initial factory owner',
)
# Replace flatten HQ and builder/building ownership.
old_hq = """  // HQ
  entities.push({
    id: id('hq'),
    kind: 'hq',
    tx: mapData.hq.tx,
    ty: mapData.hq.ty,
    faction,
  });"""
new_hq = """  // Canonical Headquarters. Legacy maps normalize to one human entry.
  for (const hq of getMapHeadquarters(mapData)) {
    const ownerTeamId = hq.ownerTeamId ?? teamIdForFaction(hq.faction);
    entities.push({
      id: `hq-${ownerTeamId}`,
      kind: 'hq',
      tx: hq.tx,
      ty: hq.ty,
      faction: hq.faction,
      ownerTeamId,
    });
  }"""
text = replace_once(text, old_hq, new_hq, 'flatten all HQs')
old_builder = """  for (const builder of mapData.builders) {
    entities.push({
      id: builder.id,
      kind: 'builder',
      tx: builder.tx,
      ty: builder.ty,
      faction,
    });
  }"""
new_builder = """  for (const builder of mapData.builders) {
    const ownerTeamId = builder.ownerTeamId ?? teamIdForFaction(faction);
    entities.push({
      id: builder.id,
      kind: 'builder',
      tx: builder.tx,
      ty: builder.ty,
      faction: factionForTeamId(ownerTeamId),
      ownerTeamId,
    });
  }"""
text = replace_once(text, old_builder, new_builder, 'flatten builder owner')
old_building = """  for (const building of mapData.buildings) {
    entities.push({
      id: id('building'),
      kind: 'hq',
      tx: building.tx,
      ty: building.ty,
      faction,
      stateOnly: true,
    });
  }"""
new_building = """  for (const building of mapData.buildings) {
    const ownerTeamId = building.ownerTeamId ?? teamIdForFaction(faction);
    entities.push({
      id: id('building'),
      kind: 'hq',
      tx: building.tx,
      ty: building.ty,
      faction: factionForTeamId(ownerTeamId),
      ownerTeamId,
      stateOnly: true,
    });
  }"""
text = replace_once(text, old_building, new_building, 'flatten building owner')
text = replace_once(
    text,
    "function createExtraHarvesters(mapData: MapData, faction: Faction): Array<{ tx: number; ty: number; faction: Faction }> {",
    "function createExtraHarvesters(\n"
    "  mapData: MapData, faction: Faction,\n"
    "): Array<{ tx: number; ty: number; faction: Faction; ownerTeamId: import('./types').TeamId }> {",
    'extra harvester return type',
)
text = replace_once(
    text,
    "  return positions.map(p => ({ ...p, faction }));",
    "  const ownerTeamId = teamIdForFaction(faction);\n"
    "  return positions.map(p => ({ ...p, faction, ownerTeamId }));",
    'extra harvester owner data',
)
text = replace_once(
    text,
    "  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>,",
    "  extraHarvesters: Array<{\n"
    "    tx: number; ty: number; faction: Faction; ownerTeamId?: import('./types').TeamId;\n"
    "  }>,",
    'extra combat harvester input',
)
text = replace_once(
    text,
    "      faction,\n      id: `legacy-starter-combat-${candidate.tx}-${candidate.ty}`,",
    "      faction,\n"
    "      ownerTeamId: teamIdForFaction(faction),\n"
    "      id: `legacy-starter-combat-${candidate.tx}-${candidate.ty}`,",
    'extra combat owner data',
)
text = replace_once(
    text,
    "  for (let dy = 0; dy < 3; dy++) {\n    for (let dx = 0; dx < 3; dx++) {\n      occupied.add(`${mapData.hq.tx + dx},${mapData.hq.ty + dy}`);\n    }\n  }",
    "  for (const hq of getMapHeadquarters(mapData)) {\n"
    "    for (let dy = 0; dy < 3; dy++) {\n"
    "      for (let dx = 0; dx < 3; dx++) {\n"
    "        occupied.add(`${hq.tx + dx},${hq.ty + dy}`);\n"
    "      }\n"
    "    }\n"
    "  }",
    'starter occupied all HQs',
)
write(path, text)


# ── matchState.ts ────────────────────────────────────────────────────
path = 'src/state/matchState.ts'
text = read(path)
text = replace_once(
    text,
    "} from './visibility';",
    "} from './visibility';\n"
    "import { getHeadquartersCenter, normalizeMapHeadquarters } from './mapHeadquarters';",
    'match HQ helper import',
)
text = replace_once(
    text,
    "  const humanFaction = resolveHumanFaction(state);\n  state.playerFaction = humanFaction;\n  const humanTeamId = teamIdForFaction(humanFaction);\n  const legacyHumanHqPosition = state.hqPosition ?? (state.mapData?.hq\n    ? { tx: state.mapData.hq.tx + 1, ty: state.mapData.hq.ty + 1 }\n    : null);",
    "  const humanFaction = resolveHumanFaction(state);\n"
    "  state.playerFaction = humanFaction;\n"
    "  const headquarters = normalizeMapHeadquarters(state.mapData, humanFaction);\n"
    "  const humanTeamId = teamIdForFaction(humanFaction);\n"
    "  const hqPositionByTeam = new Map<TeamId, { tx: number; ty: number }>();\n"
    "  for (const hq of headquarters) {\n"
    "    hqPositionByTeam.set(hq.ownerTeamId ?? teamIdForFaction(hq.faction), getHeadquartersCenter(hq));\n"
    "  }\n"
    "  const legacyHumanHqPosition = hqPositionByTeam.get(humanTeamId)\n"
    "    ?? state.hqPosition\n"
    "    ?? null;",
    'match canonical HQ normalization',
)
text = replace_once(
    text,
    "      hqPosition: isHuman\n        ? (current?.hqPosition ?? legacyHumanHqPosition)\n        : (current?.hqPosition ?? null),",
    "      hqPosition: current?.hqPosition\n"
    "        ?? hqPositionByTeam.get(teamId)\n"
    "        ?? (isHuman ? legacyHumanHqPosition : null),",
    'match team HQ positions',
)
text = replace_once(
    text,
    "  if (state.mapData?.hq) {\n    state.mapData.hq.ownerTeamId ??= teamIdForFaction(\n      isFaction(state.mapData.hq.faction) ? state.mapData.hq.faction : state.playerFaction,\n    );\n  }",
    "  for (const hq of state.mapData?.headquarters ?? (state.mapData?.hq ? [state.mapData.hq] : [])) {\n"
    "    hq.ownerTeamId ??= teamIdForFaction(\n"
    "      isFaction(hq.faction) ? hq.faction : state.playerFaction,\n"
    "    );\n"
    "  }",
    'match all HQ ownership',
)
write(path, text)


# ── occupancy.ts ─────────────────────────────────────────────────────
path = 'src/state/occupancy.ts'
text = read(path)
text = replace_once(
    text,
    "import { getOccupiedTiles } from './bodyFootprint';",
    "import { getOccupiedTiles } from './bodyFootprint';\n"
    "import { getMapHeadquarters, HQ_FOOTPRINT } from './mapHeadquarters';",
    'occupancy HQ import',
)
text = replace_once(
    text,
    "  // ── HQ — 3×3 footprint ────────────────────────────────────────\n  markFootprint(flags, width, state.mapData.hq.tx, state.mapData.hq.ty, 3, 3,\n    'impassable', 'unbuildable');",
    "  // ── Headquarters — canonical 3×3 footprints ──────────────────\n"
    "  for (const hq of getMapHeadquarters(state.mapData)) {\n"
    "    markFootprint(\n"
    "      flags, width, hq.tx, hq.ty, HQ_FOOTPRINT, HQ_FOOTPRINT,\n"
    "      'impassable', 'unbuildable',\n"
    "    );\n"
    "  }",
    'occupancy all HQs',
)
write(path, text)


# ── buildSiteSelection.ts ────────────────────────────────────────────
path = 'src/state/buildSiteSelection.ts'
text = read(path)
text = replace_once(
    text,
    "import { canPlaceBuilding, BUILDING_CONFIG } from './construction';",
    "import { canPlaceBuilding, BUILDING_CONFIG } from './construction';\n"
    "import { getHeadquartersCenter, getMapHeadquarters, HQ_FOOTPRINT } from './mapHeadquarters';",
    'build site HQ import',
)
text = replace_once(
    text,
    "  // HQ — 3x3 footprint\n  footprints.push({\n    tx: state.mapData.hq.tx,\n    ty: state.mapData.hq.ty,\n    fpW: 3,\n    fpH: 3,\n  });",
    "  // All canonical Headquarters — 3x3 footprints.\n"
    "  for (const hq of getMapHeadquarters(state.mapData)) {\n"
    "    footprints.push({\n"
    "      tx: hq.tx,\n"
    "      ty: hq.ty,\n"
    "      fpW: HQ_FOOTPRINT,\n"
    "      fpH: HQ_FOOTPRINT,\n"
    "    });\n"
    "  }",
    'build site all HQ footprints',
)
text = replace_once(
    text,
    "  // HQ center — only the requesting team's HQ is an anchor.\n  if ((state.mapData.hq.ownerTeamId ?? ownerTeamId) === ownerTeamId) {\n    anchors.push({\n      tx: state.mapData.hq.tx + 1,\n      ty: state.mapData.hq.ty + 1,\n    });\n  }",
    "  // Only the requesting team's canonical Headquarters is an anchor.\n"
    "  for (const hq of getMapHeadquarters(state.mapData)) {\n"
    "    if (hq.ownerTeamId !== ownerTeamId) continue;\n"
    "    anchors.push(getHeadquartersCenter(hq));\n"
    "  }",
    'build site owner HQ anchor',
)
write(path, text)


# ── focused tests ────────────────────────────────────────────────────
test = r'''import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import {
  createFourCornerHeadquarters,
  getHeadquartersCenter,
  getMapHeadquarters,
  headquartersDoNotOverlap,
  normalizeMapHeadquarters,
} from '../state/mapHeadquarters';
import { buildOccupancyMap, getFlags } from '../state/occupancy';
import type { Faction, MapData, TeamId } from '../state/types';

const EXPECTED_STANDARD = {
  cyan: { tx: 4, ty: 41, ownerTeamId: 'team-cyan' },
  green: { tx: 4, ty: 4, ownerTeamId: 'team-green' },
  yellow: { tx: 41, ty: 4, ownerTeamId: 'team-yellow' },
  purple: { tx: 41, ty: 41, ownerTeamId: 'team-purple' },
} as const;

function legacyMap(): MapData {
  return {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
    hq: { tx: 2, ty: 14, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], buildings: [], builders: [], constructionSites: [],
  };
}

describe('SKIRMISH-P5A four-corner Headquarters', () => {
  it('mirrors one south-west placement into the accepted four faction corners', () => {
    const headquarters = createFourCornerHeadquarters(48, 48);
    expect(headquarters).toHaveLength(4);
    expect(headquartersDoNotOverlap(headquarters)).toBe(true);
    expect(Object.fromEntries(headquarters.map(hq => [hq.faction, {
      tx: hq.tx, ty: hq.ty, ownerTeamId: hq.ownerTeamId,
    }]))).toEqual(EXPECTED_STANDARD);
  });

  it.each(['cyan', 'green', 'yellow', 'purple'] as Faction[])(
    'binds the legacy hq alias and starter Builder to the selected %s team',
    faction => {
      const map = createGeneratedMapData('four-corners', 'standard', faction);
      expect(map.headquarters).toEqual(createFourCornerHeadquarters(48, 48));
      expect(map.hq).toEqual(map.headquarters!.find(hq => hq.faction === faction));
      expect(map.builders).toHaveLength(1);
      expect(map.builders[0].ownerTeamId).toBe(`team-${faction}`);
    },
  );

  it('creates four rendered HQ entities and binds every TeamState to its map HQ center', () => {
    const state = createInitialState(createGeneratedMapData('state-four-hq', 'standard', 'purple'), 'purple');
    const headquarters = getMapHeadquarters(state.mapData);
    expect(state.entities.filter(entity => entity.kind === 'hq' && !entity.stateOnly)).toHaveLength(4);
    for (const hq of headquarters) {
      const teamId = hq.ownerTeamId as TeamId;
      expect(state.match!.teams[teamId].hqPosition).toEqual(getHeadquartersCenter(hq));
      expect(state.entities).toContainEqual(expect.objectContaining({
        id: `hq-${teamId}`,
        ownerTeamId: teamId,
        faction: hq.faction,
        tx: hq.tx,
        ty: hq.ty,
      }));
    }
    expect(state.hqPosition).toEqual(getHeadquartersCenter(state.mapData.hq));
  });

  it('marks every 3x3 Headquarters footprint impassable and unbuildable', () => {
    const state = createInitialState(createGeneratedMapData('occupancy-four-hq', 'small', 'cyan'));
    const occupancy = buildOccupancyMap(state);
    for (const hq of getMapHeadquarters(state.mapData)) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const flags = getFlags(occupancy, hq.tx + dx, hq.ty + dy);
          expect(flags.has('impassable')).toBe(true);
          expect(flags.has('unbuildable')).toBe(true);
        }
      }
    }
  });

  it('migrates a legacy map to one human-owned HQ without inventing three map entities', () => {
    const map = legacyMap();
    const headquarters = normalizeMapHeadquarters(map, 'purple');
    expect(headquarters).toEqual([{
      tx: 2,
      ty: 14,
      faction: 'purple',
      ownerTeamId: 'team-purple',
    }]);
    expect(map.hq).toEqual(headquarters[0]);
    const state = createInitialState(map, 'purple');
    expect(state.entities.filter(entity => entity.kind === 'hq' && !entity.stateOnly)).toHaveLength(1);
    expect(state.match!.teams['team-purple'].hqPosition).toEqual({ tx: 3, ty: 15 });
    expect(state.match!.teams['team-cyan'].hqPosition).toBeNull();
  });

  it('is structurally deterministic for the same seed, size and faction', () => {
    const first = createGeneratedMapData('headquarters-determinism', 'large', 'yellow');
    const second = createGeneratedMapData('headquarters-determinism', 'large', 'yellow');
    expect(first.headquarters).toEqual(second.headquarters);
    expect(first.hq).toEqual(second.hq);
    expect(first.builders).toEqual(second.builders);
  });
});
'''
write('src/__tests__/fourHeadquarters.test.ts', test)

print('SKIRMISH-P5A patch applied')
