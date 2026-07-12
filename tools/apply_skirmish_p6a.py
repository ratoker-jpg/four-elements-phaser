from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


# ── generatedMap.ts: one deterministic Builder per canonical team ────
path = "src/state/generatedMap.ts"
text = read(path)
text = text.replace(
    " * - One idle human Builder placed toward the map center",
    " * - One idle Builder per canonical team placed toward the map center",
)
if "SKIRMISH-P6A: one deterministic Builder per canonical Headquarters" not in text:
    replacement = '''  // ── SKIRMISH-P6A: one deterministic Builder per canonical Headquarters ──
  // Spawn on the vertical HQ edge facing the map center. Canonical HQ order
  // keeps IDs and structure independent from the selected human faction.
  const builders = headquarters.map((headquartersPlacement, index) => {
    const builderTx = headquartersPlacement.tx + 1;
    const builderTy = headquartersPlacement.ty < H / 2
      ? headquartersPlacement.ty + HQ_FOOTPRINT
      : headquartersPlacement.ty - 1;
    return {
      id: `builder-${index}`,
      ownerTeamId: headquartersPlacement.ownerTeamId,
      tx: builderTx,
      ty: builderTy,
      busy: false,
      phase: 'idle' as const,
      path: [],
      pathIndex: 0,
      ftx: builderTx + 0.5,
      fty: builderTy + 0.5,
      targetTx: builderTx,
      targetTy: builderTy,
      assignedSiteId: -1,
    };
  });
'''
    text, count = re.subn(
        r"  // ── Human Builder:.*?\n  const builders = \[.*?\n  \];\n",
        replacement,
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError("generatedMap Builder block not found")
write(path, text)


# ── createInitialState.ts: two Harvesters per canonical team ─────────
path = "src/state/createInitialState.ts"
text = read(path)
text = text.replace(
    "  // Add extra starter units not present in the original saved map",
    "  // Add deterministic starter Harvesters for every canonical Headquarters",
)
text = text.replace(
    "      id: `extra-harvester-${h.tx}-${h.ty}`,",
    "      id: `extra-harvester-${h.ownerTeamId ?? h.faction}-${h.tx}-${h.ty}`,",
)
if "SKIRMISH-P6A: create two deterministic Harvesters per canonical Headquarters" not in text:
    harvesters_function = '''function createExtraHarvesters(
  mapData: MapData, _faction: Faction,
): Array<{ tx: number; ty: number; faction: Faction; ownerTeamId: import('./types').TeamId }> {
  // SKIRMISH-P6A: create two deterministic Harvesters per canonical Headquarters.
  // Legacy one-HQ maps therefore retain two human Harvesters and do not invent
  // civil units for teams that have no map Headquarters.
  const occupied = buildStarterOccupiedSet(mapData);
  const harvesters: Array<{
    tx: number;
    ty: number;
    faction: Faction;
    ownerTeamId: import('./types').TeamId;
  }> = [];

  for (const hq of getMapHeadquarters(mapData)) {
    const hqCx = hq.tx + 1;
    const hqCy = hq.ty + 1;
    const towardCenterX = hq.tx < mapData.width / 2 ? 1 : -1;
    const towardCenterY = hq.ty < mapData.height / 2 ? 1 : -1;
    const candidates = [
      { tx: hqCx + 2 * towardCenterX, ty: hqCy },
      { tx: hqCx + 2 * towardCenterX, ty: hqCy + towardCenterY },
      { tx: hqCx + towardCenterX, ty: hqCy + 2 * towardCenterY },
      { tx: hqCx, ty: hqCy + 2 * towardCenterY },
      { tx: hqCx - towardCenterX, ty: hqCy + 2 * towardCenterY },
    ];
    const ownerTeamId = hq.ownerTeamId ?? teamIdForFaction(hq.faction);
    let spawned = 0;

    for (const candidate of candidates) {
      if (spawned >= 2) break;
      if (!isFreeStarterTile(mapData, occupied, candidate.tx, candidate.ty)) continue;
      harvesters.push({
        ...candidate,
        faction: hq.faction,
        ownerTeamId,
      });
      occupied.add(`${candidate.tx},${candidate.ty}`);
      spawned++;
    }
  }

  return harvesters;
}'''
    text, count = re.subn(
        r"function createExtraHarvesters\(.*?\n\}\n\nfunction createExtraModularCombat",
        harvesters_function + "\n\nfunction createExtraModularCombat",
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError("createExtraHarvesters function not found")

# Stable owner-scoped runtime IDs, independent from player faction alias.
old_builder = '''  return extraHarvesters.map((h, i) =>
    createHarvester(`harvester-${i}`, h.tx, h.ty, h.faction, h.ownerTeamId),
  );'''
new_builder = '''  const perTeamIndex = new Map<string, number>();
  return extraHarvesters.map(h => {
    const ownerTeamId = h.ownerTeamId ?? teamIdForFaction(h.faction);
    const index = perTeamIndex.get(ownerTeamId) ?? 0;
    perTeamIndex.set(ownerTeamId, index + 1);
    return createHarvester(
      `harvester-${ownerTeamId}-${index}`,
      h.tx,
      h.ty,
      h.faction,
      ownerTeamId,
    );
  });'''
if old_builder in text:
    text = text.replace(old_builder, new_builder, 1)
write(path, text)


# ── update P5A assertion to the new canonical civil contract ─────────
path = "src/__tests__/fourHeadquarters.test.ts"
text = read(path)
old = '''  it.each(['cyan', 'green', 'yellow', 'purple'] as Faction[])(
    'binds the legacy hq alias and starter Builder to the selected %s team',
    faction => {
      const map = createGeneratedMapData('four-corners', 'standard', faction);
      expect(map.headquarters).toEqual(createFourCornerHeadquarters(48, 48));
      expect(map.hq).toEqual(map.headquarters!.find(hq => hq.faction === faction));
      expect(map.builders).toHaveLength(1);
      expect(map.builders[0].ownerTeamId).toBe(`team-${faction}`);
    },
  );'''
new = '''  it.each(['cyan', 'green', 'yellow', 'purple'] as Faction[])(
    'binds the legacy hq alias while keeping four canonical starter Builders for selected %s',
    faction => {
      const map = createGeneratedMapData('four-corners', 'standard', faction);
      expect(map.headquarters).toEqual(createFourCornerHeadquarters(48, 48));
      expect(map.hq).toEqual(map.headquarters!.find(hq => hq.faction === faction));
      expect(map.builders).toHaveLength(4);
      expect(new Set(map.builders.map(builder => builder.ownerTeamId))).toEqual(new Set([
        'team-cyan', 'team-green', 'team-yellow', 'team-purple',
      ]));
      expect(map.builders.some(builder => builder.ownerTeamId === `team-${faction}`)).toBe(true);
    },
  );'''
if old in text:
    text = text.replace(old, new, 1)
elif "keeping four canonical starter Builders" not in text:
    raise RuntimeError("fourHeadquarters starter Builder assertion not found")
write(path, text)


# ── focused P6A contract tests ───────────────────────────────────────
test = '''import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import { getMapHeadquarters } from '../state/mapHeadquarters';
import type { Faction, TeamId } from '../state/types';

const FACTIONS: readonly Faction[] = ['cyan', 'green', 'yellow', 'purple'];
const TEAM_IDS: readonly TeamId[] = [
  'team-cyan', 'team-green', 'team-yellow', 'team-purple',
];

function civilSignature(faction: Faction) {
  const map = createGeneratedMapData('p6a-human-independent', 'standard', faction);
  const state = createInitialState(map, faction);
  return {
    builders: state.mapData.builders.map(builder => ({
      id: builder.id,
      ownerTeamId: builder.ownerTeamId,
      tx: builder.tx,
      ty: builder.ty,
    })),
    harvesters: state.harvesters.map(harvester => ({
      id: harvester.id,
      ownerTeamId: harvester.ownerTeamId,
      faction: harvester.faction,
      tx: harvester.ftx,
      ty: harvester.fty,
    })),
  };
}

describe('SKIRMISH-P6A four-team civil bootstrap', () => {
  it.each(FACTIONS)('creates one Builder and two Harvesters per team when human is %s', faction => {
    const map = createGeneratedMapData(`p6a-${faction}`, 'standard', faction);
    const state = createInitialState(map, faction);

    expect(getMapHeadquarters(state.mapData)).toHaveLength(4);
    expect(state.mapData.builders).toHaveLength(4);
    expect(state.harvesters).toHaveLength(8);
    expect(state.entities.filter(entity => entity.kind === 'builder')).toHaveLength(4);
    expect(state.entities.filter(entity => entity.kind === 'harvester')).toHaveLength(8);

    for (const teamId of TEAM_IDS) {
      expect(state.mapData.builders.filter(builder => builder.ownerTeamId === teamId)).toHaveLength(1);
      const teamHarvesters = state.harvesters.filter(harvester => harvester.ownerTeamId === teamId);
      expect(teamHarvesters).toHaveLength(2);
      expect(teamHarvesters.every(harvester => harvester.faction === teamId.slice(5))).toBe(true);
    }
  });

  it('keeps canonical civil starts independent from the selected human faction', () => {
    const signatures = FACTIONS.map(civilSignature);
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  });

  it('uses stable unique owner-scoped civil IDs', () => {
    const state = createInitialState(
      createGeneratedMapData('p6a-stable-ids', 'large', 'yellow'),
      'yellow',
    );
    const ids = [
      ...state.mapData.builders.map(builder => builder.id),
      ...state.harvesters.map(harvester => harvester.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.harvesters.map(harvester => harvester.id)).toEqual([
      'harvester-team-cyan-0',
      'harvester-team-cyan-1',
      'harvester-team-green-0',
      'harvester-team-green-1',
      'harvester-team-yellow-0',
      'harvester-team-yellow-1',
      'harvester-team-purple-0',
      'harvester-team-purple-1',
    ]);
  });

  it('does not invent enemy civil units for a legacy one-HQ map', () => {
    const state = createInitialState();
    expect(getMapHeadquarters(state.mapData)).toHaveLength(1);
    expect(state.harvesters).toHaveLength(2);
    expect(state.harvesters.every(harvester => harvester.ownerTeamId === state.match!.humanTeamId))
      .toBe(true);
  });
});
'''
write("src/__tests__/fourTeamCivilBootstrap.test.ts", test)

print("SKIRMISH-P6A patch applied")
