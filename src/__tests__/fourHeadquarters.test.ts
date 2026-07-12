import { describe, expect, it } from 'vitest';
import { createGeneratedMapData, createValidatedGeneratedMapData } from '../state/generatedMap';
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
  );

  it.each(['cyan', 'green', 'yellow', 'purple'] as Faction[])(
    'keeps starter resources in bounds and validates the selected %s corner',
    faction => {
      const result = createValidatedGeneratedMapData(`corner-validation-${faction}`, 'standard', faction);
      expect(result.valid).toBe(true);
      for (const resource of result.mapData.resources) {
        expect(resource.tx).toBeGreaterThanOrEqual(0);
        expect(resource.ty).toBeGreaterThanOrEqual(0);
        expect(resource.tx + resource.footprint).toBeLessThanOrEqual(result.mapData.width);
        expect(resource.ty + resource.footprint).toBeLessThanOrEqual(result.mapData.height);
      }
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
    expect(headquarters).toEqual([expect.objectContaining({
      tx: 2,
      ty: 14,
      faction: 'purple',
      ownerTeamId: 'team-purple',
      id: 'hq-team-purple',
      hp: 4000,
      isDestroyed: false,
    })]);
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
