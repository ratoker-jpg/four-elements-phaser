import { describe, expect, it } from 'vitest';
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
