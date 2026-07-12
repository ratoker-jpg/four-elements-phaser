from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"{label}: marker not found")
    return text.replace(old, new, 1)


# ── matchState.ts: accept pre-derived economy for every canonical team ──
path = "src/state/matchState.ts"
text = read(path)
text = replace_once(
    text,
    "  humanEconomy: EconomyState;\n  humanVision: VisionState;",
    "  humanEconomy: EconomyState;\n"
    "  teamEconomies?: Partial<Record<TeamId, EconomyState>>;\n"
    "  humanVision: VisionState;",
    "team economy input",
)
text = replace_once(
    text,
    "      economy: isHuman ? input.humanEconomy : createBaselineTeamEconomy(),",
    "      economy: input.teamEconomies?.[teamId]\n"
    "        ?? (isHuman ? input.humanEconomy : createBaselineTeamEconomy()),",
    "team economy assignment",
)
write(path, text)


# ── createInitialState.ts: derive caps, separators and power per owner ──
path = "src/state/createInitialState.ts"
text = read(path)
text = replace_once(
    text,
    "  ModularCombatUnit,\n} from './types';",
    "  ModularCombatUnit,\n  TeamId,\n} from './types';",
    "TeamId type import",
)
text = replace_once(
    text,
    "  createInitialMatchState, factionForTeamId, normalizeMatchState, teamIdForFaction,\n} from './matchState';",
    "  createInitialMatchState, factionForTeamId, normalizeMatchState, teamIdForFaction, TEAM_IDS,\n} from './matchState';",
    "TEAM_IDS import",
)
text = replace_once(
    text,
    "  const economy = arenaMode ? createArenaEconomy() : createInitialEconomy(faction, mapData);\n"
    "  const vision = createInitialVisionState(mapData.width, mapData.height);",
    "  const humanTeamId = teamIdForFaction(faction);\n"
    "  const teamEconomies = arenaMode\n"
    "    ? undefined\n"
    "    : createInitialTeamEconomies(mapData, humanTeamId);\n"
    "  const economy = arenaMode ? createArenaEconomy() : teamEconomies![humanTeamId];\n"
    "  const vision = createInitialVisionState(mapData.width, mapData.height);",
    "initial team economies",
)
text = replace_once(
    text,
    "      humanEconomy: economy,\n      humanVision: vision,",
    "      humanEconomy: economy,\n      teamEconomies,\n      humanVision: vision,",
    "match team economies",
)
old_function = '''/** Create initial EconomyState with ROADMAP starting values. */
function createInitialEconomy(_playerFaction: Faction, mapData: MapData): EconomyState {
  // ARCH-01C: Initialize separator runtime state from existing completed separator buildings.
  const separators: SeparatorRuntimeState[] = mapData.buildings
    .filter(b => b.type === 'separator')
    .map(b => ({
      tx: b.tx,
      ty: b.ty,
      progress: 0,
      active: false,
    }));

  // ARCH-01D: Initialize caps from existing completed buildings.
  // Base HQ caps + bonuses from raw-storage and matter-storage buildings.
  let rawCap = HQ_RAW_CAP;
  let matterCap = HQ_MATTER_CAP;
  let elementCap = HQ_ELEMENT_CAP;

  for (const building of mapData.buildings) {
    if (building.type === 'raw-storage') {
      rawCap += RAW_STORAGE_RAW_BONUS;
    } else if (building.type === 'matter-storage') {
      matterCap += MATTER_STORAGE_MATTER_BONUS;
    } else if (building.type === 'element-storage') {
      elementCap += ELEMENT_STORAGE_ELEMENT_BONUS;
    }
  }

  // ARCH-01E: Compute powerGenerated from HQ base + power-plant buildings.
  const powerPlantCount = mapData.buildings.filter(b => b.type === 'power-plant').length;
  const powerGenerated = HQ_BASE_POWER + powerPlantCount * POWER_PLANT_GENERATION;

  return {
    raw: START_RAW,
    matter: START_MATTER,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
    powerGenerated,
    powerConsumed: 0,
    separators,
    rawCap,
    matterCap,
    elementCap,
  };
}'''
new_function = '''/** Create one isolated initial economy for every canonical team. */
function createInitialTeamEconomies(
  mapData: MapData,
  humanTeamId: TeamId,
): Record<TeamId, EconomyState> {
  const economies = {} as Record<TeamId, EconomyState>;
  for (const teamId of TEAM_IDS) {
    economies[teamId] = createInitialEconomyForTeam(mapData, teamId, humanTeamId);
  }
  return economies;
}

function buildingOwnerTeamId(
  building: MapData['buildings'][number],
  humanTeamId: TeamId,
): TeamId {
  // Legacy buildings without ownership remain human-owned during migration.
  return building.ownerTeamId ?? humanTeamId;
}

/** Derive storage, separators and power from buildings owned by exactly one team. */
function createInitialEconomyForTeam(
  mapData: MapData,
  teamId: TeamId,
  humanTeamId: TeamId,
): EconomyState {
  const ownedBuildings = mapData.buildings.filter(
    building => buildingOwnerTeamId(building, humanTeamId) === teamId,
  );
  const separators: SeparatorRuntimeState[] = ownedBuildings
    .filter(building => building.type === 'separator')
    .map(building => ({
      tx: building.tx,
      ty: building.ty,
      progress: 0,
      active: false,
      ownerTeamId: teamId,
    }));

  let rawCap = HQ_RAW_CAP;
  let matterCap = HQ_MATTER_CAP;
  let elementCap = HQ_ELEMENT_CAP;
  for (const building of ownedBuildings) {
    if (building.type === 'raw-storage') {
      rawCap += RAW_STORAGE_RAW_BONUS;
    } else if (building.type === 'matter-storage') {
      matterCap += MATTER_STORAGE_MATTER_BONUS;
    } else if (building.type === 'element-storage') {
      elementCap += ELEMENT_STORAGE_ELEMENT_BONUS;
    }
  }

  const hasHeadquarters = getMapHeadquarters(mapData).some(hq =>
    (hq.ownerTeamId ?? teamIdForFaction(hq.faction)) === teamId,
  );
  const powerPlantCount = ownedBuildings.filter(
    building => building.type === 'power-plant',
  ).length;

  return {
    raw: START_RAW,
    matter: START_MATTER,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
    powerGenerated: (hasHeadquarters ? HQ_BASE_POWER : 0)
      + powerPlantCount * POWER_PLANT_GENERATION,
    powerConsumed: 0,
    separators,
    rawCap,
    matterCap,
    elementCap,
  };
}'''
text = replace_once(text, old_function, new_function, "owner-aware initial economy")
write(path, text)


# ── focused isolation tests ───────────────────────────────────────────
test = '''import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import type { MapData, TeamId } from '../state/types';
import {
  ELEMENT_STORAGE_ELEMENT_BONUS,
  HQ_BASE_POWER,
  HQ_ELEMENT_CAP,
  HQ_MATTER_CAP,
  HQ_RAW_CAP,
  MATTER_STORAGE_MATTER_BONUS,
  POWER_PLANT_GENERATION,
  RAW_STORAGE_RAW_BONUS,
  SEP_CYCLE_MS,
  SEP_ELEMENT_YIELD,
  SEP_MATTER_YIELD,
  SEP_RAW_COST,
} from '../state/types';

const TEAM_IDS: readonly TeamId[] = [
  'team-cyan', 'team-green', 'team-yellow', 'team-purple',
];

function addOwnedEconomyBuildings(map: MapData): void {
  map.buildings.push(
    { tx: 10, ty: 10, type: 'separator', ownerTeamId: 'team-cyan' },
    { tx: 12, ty: 10, type: 'raw-storage', ownerTeamId: 'team-cyan' },
    { tx: 14, ty: 10, type: 'power-plant', ownerTeamId: 'team-cyan' },
    { tx: 10, ty: 14, type: 'separator', ownerTeamId: 'team-green' },
    { tx: 12, ty: 14, type: 'matter-storage', ownerTeamId: 'team-green' },
    { tx: 14, ty: 14, type: 'element-storage', ownerTeamId: 'team-yellow' },
  );
}

describe('SKIRMISH-P6B four-team economy isolation', () => {
  it('derives separators, storage caps and power from owner buildings only', () => {
    const map = createGeneratedMapData('p6b-owned-buildings', 'standard', 'purple');
    addOwnedEconomyBuildings(map);
    const state = createInitialState(map, 'purple');
    const teams = state.match!.teams;

    expect(teams['team-cyan'].economy.separators).toEqual([
      expect.objectContaining({ tx: 10, ty: 10, ownerTeamId: 'team-cyan' }),
    ]);
    expect(teams['team-cyan'].economy.rawCap).toBe(HQ_RAW_CAP + RAW_STORAGE_RAW_BONUS);
    expect(teams['team-cyan'].economy.matterCap).toBe(HQ_MATTER_CAP);
    expect(teams['team-cyan'].economy.powerGenerated)
      .toBe(HQ_BASE_POWER + POWER_PLANT_GENERATION);

    expect(teams['team-green'].economy.separators).toEqual([
      expect.objectContaining({ tx: 10, ty: 14, ownerTeamId: 'team-green' }),
    ]);
    expect(teams['team-green'].economy.matterCap)
      .toBe(HQ_MATTER_CAP + MATTER_STORAGE_MATTER_BONUS);
    expect(teams['team-green'].economy.rawCap).toBe(HQ_RAW_CAP);

    expect(teams['team-yellow'].economy.separators).toEqual([]);
    expect(teams['team-yellow'].economy.elementCap)
      .toBe(HQ_ELEMENT_CAP + ELEMENT_STORAGE_ELEMENT_BONUS);

    expect(teams['team-purple'].economy.separators).toEqual([]);
    expect(teams['team-purple'].economy.rawCap).toBe(HQ_RAW_CAP);
    expect(teams['team-purple'].economy.matterCap).toBe(HQ_MATTER_CAP);
    expect(state.economy).toBe(teams['team-purple'].economy);
  });

  it('unloads simultaneous Harvester cargo into owner economies only', () => {
    const state = createInitialState(
      createGeneratedMapData('p6b-owner-unload', 'standard', 'purple'),
      'purple',
    );
    for (const teamId of TEAM_IDS) state.match!.teams[teamId].economy.raw = 0;
    for (const harvester of state.harvesters) {
      harvester.phase = 'unloading';
      harvester.unloadTimer = 10000;
      harvester.cargoRaw = 0;
    }

    const cargoByTeam: Record<TeamId, number> = {
      'team-cyan': 11,
      'team-green': 12,
      'team-yellow': 13,
      'team-purple': 14,
    };
    for (const teamId of TEAM_IDS) {
      const harvester = state.harvesters.find(unit => unit.ownerTeamId === teamId)!;
      harvester.cargoRaw = cargoByTeam[teamId];
      harvester.unloadTimer = 0;
    }

    updateGameState(state, 1);

    for (const teamId of TEAM_IDS) {
      expect(state.match!.teams[teamId].economy.raw).toBe(cargoByTeam[teamId]);
    }
    expect(state.economy.raw).toBe(14);
  });

  it('processes one separator cycle independently for all four teams', () => {
    const map = createGeneratedMapData('p6b-four-separators', 'standard', 'cyan');
    map.buildings.push(
      { tx: 9, ty: 9, type: 'separator', ownerTeamId: 'team-cyan' },
      { tx: 12, ty: 9, type: 'separator', ownerTeamId: 'team-green' },
      { tx: 15, ty: 9, type: 'separator', ownerTeamId: 'team-yellow' },
      { tx: 18, ty: 9, type: 'separator', ownerTeamId: 'team-purple' },
    );
    const state = createInitialState(map, 'cyan');

    for (const teamId of TEAM_IDS) {
      const economy = state.match!.teams[teamId].economy;
      economy.raw = SEP_RAW_COST;
      economy.matter = 0;
      economy.elements = { cyan: 0, green: 0, yellow: 0, purple: 0 };
    }

    updateGameState(state, SEP_CYCLE_MS);

    for (const teamId of TEAM_IDS) {
      const team = state.match!.teams[teamId];
      expect(team.economy.raw).toBe(0);
      expect(team.economy.matter).toBe(SEP_MATTER_YIELD);
      expect(team.economy.elements[team.faction]).toBe(SEP_ELEMENT_YIELD);
      for (const otherTeamId of TEAM_IDS) {
        if (otherTeamId === teamId) continue;
        const otherFaction = state.match!.teams[otherTeamId].faction;
        expect(team.economy.elements[otherFaction]).toBe(0);
      }
    }
  });

  it('assigns legacy unowned economy buildings to the human team only', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
      hq: { tx: 2, ty: 14, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [
        { tx: 7, ty: 14, type: 'separator' },
        { tx: 9, ty: 14, type: 'raw-storage' },
        { tx: 11, ty: 14, type: 'power-plant' },
      ],
      builders: [{
        id: 'builder-0', tx: 5, ty: 14, busy: false, phase: 'idle', path: [],
        pathIndex: 0, ftx: 5, fty: 14, targetTx: 5, targetTy: 14, assignedSiteId: -1,
      }],
      constructionSites: [],
    };
    const state = createInitialState(map, 'cyan');

    expect(state.match!.teams['team-cyan'].economy.separators).toHaveLength(1);
    expect(state.match!.teams['team-cyan'].economy.rawCap)
      .toBe(HQ_RAW_CAP + RAW_STORAGE_RAW_BONUS);
    expect(state.match!.teams['team-cyan'].economy.powerGenerated)
      .toBe(HQ_BASE_POWER + POWER_PLANT_GENERATION);

    for (const teamId of ['team-green', 'team-yellow', 'team-purple'] as TeamId[]) {
      expect(state.match!.teams[teamId].economy.separators).toEqual([]);
      expect(state.match!.teams[teamId].economy.rawCap).toBe(HQ_RAW_CAP);
      expect(state.match!.teams[teamId].economy.powerGenerated).toBe(0);
    }
  });
});
'''
write("src/__tests__/fourTeamEconomyIsolation.test.ts", test)

print("SKIRMISH-P6B patch applied")
