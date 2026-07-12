import { describe, expect, it } from 'vitest';
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
