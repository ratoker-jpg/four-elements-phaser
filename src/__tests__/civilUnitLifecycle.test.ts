import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import { addUnitBlockers, buildOccupancyMap, getFlags } from '../state/occupancy';
import { updateGameState } from '../state/updateGameState';
import {
  AI_MIN_HARVESTERS,
  applyCivilUnitDamage,
  CIVIL_WRECK_LIFETIME_MS,
  queueAiCivilReplacements,
  updateCivilUnitLifecycle,
} from '../state/civilUnitLifecycle';
import {
  HARVESTER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
} from '../state/types';

describe('SKIRMISH-P6C civil lifecycle and replacement', () => {
  it('spawns produced civil units with deterministic owner-scoped IDs', () => {
    const map = createGeneratedMapData('p6c-spawn-ids', 'standard', 'cyan');
    map.buildings.push({ tx: 20, ty: 20, type: 'units-factory', ownerTeamId: 'team-cyan' });
    const state = createInitialState(map, 'cyan');
    const factory = state.production.factories[0];
    factory.queue.push(
      {
        unitType: 'builder', request: { kind: 'civil', unitType: 'builder' },
        elapsedMs: 1, durationMs: 1, progress: 1, completed: true,
      },
      {
        unitType: 'harvester', request: { kind: 'civil', unitType: 'harvester' },
        elapsedMs: 1, durationMs: 1, progress: 1, completed: true,
      },
    );

    updateGameState(state, 1);

    expect(state.mapData.builders.some(unit => unit.id === 'civil-team-cyan-builder-0')).toBe(true);
    expect(state.harvesters.some(unit => unit.id === 'civil-team-cyan-harvester-1')).toBe(true);
    expect(state.nextCivilUnitId).toBe(2);
  });

  it('destroys a Harvester, releases occupancy immediately and removes the wreck later', () => {
    const state = createInitialState(
      createGeneratedMapData('p6c-harvester-destruction', 'standard', 'cyan'),
      'cyan',
    );
    const target = state.harvesters[0];
    const tx = Math.round(target.ftx);
    const ty = Math.round(target.fty);

    const result = applyCivilUnitDamage(state, target.id, 9999);
    expect(result).toEqual({ kind: 'harvester', finalDamage: 320, killed: true });
    expect(target.isDestroyed).toBe(true);
    expect(state.entities.some(entity => entity.id === target.id)).toBe(false);

    const occupancy = buildOccupancyMap(state);
    addUnitBlockers(state, occupancy);
    expect(getFlags(occupancy, tx, ty).has('soft-occupied')).toBe(false);
    expect(getFlags(occupancy, tx, ty).has('impassable')).toBe(false);

    updateCivilUnitLifecycle(state, CIVIL_WRECK_LIFETIME_MS);
    expect(state.harvesters.some(unit => unit.id === target.id)).toBe(false);
  });

  it('releases a destroyed Builder construction assignment and repairs indices on cleanup', () => {
    const state = createInitialState(
      createGeneratedMapData('p6c-builder-destruction', 'standard', 'cyan'),
      'cyan',
    );
    const builder = state.mapData.builders[0];
    builder.busy = true;
    builder.phase = 'building';
    builder.assignedSiteId = 77;
    state.mapData.constructionSites.push({
      tx: 18, ty: 18, type: 'separator', elapsed: 0, duration: 1000,
      progress: 0, builderIndex: 0, id: 77, pending: false, ownerTeamId: builder.ownerTeamId,
    });

    const result = applyCivilUnitDamage(state, builder.id, 9999);
    expect(result.killed).toBe(true);
    expect(state.mapData.constructionSites[0]).toEqual(expect.objectContaining({
      builderIndex: -1,
      pending: true,
    }));

    updateCivilUnitLifecycle(state, CIVIL_WRECK_LIFETIME_MS);
    expect(state.mapData.builders.some(unit => unit.id === builder.id)).toBe(false);
  });

  it('queues an affordable owner-paid Harvester replacement for an AI team', () => {
    const map = createGeneratedMapData('p6c-ai-replacement', 'standard', 'cyan');
    map.buildings.push({ tx: 16, ty: 16, type: 'units-factory', ownerTeamId: 'team-green' });
    const state = createInitialState(map, 'cyan');
    const green = state.match!.teams['team-green'];
    green.economy.matter = HARVESTER_PRODUCTION_MATTER_COST;
    green.economy.elements.green = HARVESTER_PRODUCTION_ELEMENT_COST;
    const target = state.harvesters.find(unit => unit.ownerTeamId === 'team-green')!;
    applyCivilUnitDamage(state, target.id, 9999);

    queueAiCivilReplacements(state);

    const factory = state.production.factories.find(item => item.ownerTeamId === 'team-green')!;
    expect(factory.queue).toHaveLength(AI_MIN_HARVESTERS - 1);
    expect(factory.queue[0].request).toEqual({ kind: 'civil', unitType: 'harvester' });
    expect(green.economy.matter).toBe(0);
    expect(green.economy.elements.green).toBe(0);
  });

  it('does not auto-replace human civil losses', () => {
    const map = createGeneratedMapData('p6c-human-no-auto', 'standard', 'cyan');
    map.buildings.push({ tx: 16, ty: 16, type: 'units-factory', ownerTeamId: 'team-cyan' });
    const state = createInitialState(map, 'cyan');
    const target = state.harvesters.find(unit => unit.ownerTeamId === 'team-cyan')!;
    applyCivilUnitDamage(state, target.id, 9999);
    queueAiCivilReplacements(state);
    expect(state.production.factories[0].queue).toEqual([]);
  });
});
