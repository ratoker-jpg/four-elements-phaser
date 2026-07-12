import { beforeEach, describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import {
  loadGame,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import {
  applyCivilUnitDamage,
  CIVIL_WRECK_LIFETIME_MS,
  updateCivilUnitLifecycle,
} from '../state/civilUnitLifecycle';
import { updateGameState } from '../state/updateGameState';
import type { GameState, TeamId } from '../state/types';

const STORAGE_KEY = 'four-elements-save-slots';
const TEAM_IDS: readonly TeamId[] = [
  'team-cyan', 'team-green', 'team-yellow', 'team-purple',
];

function createMemoryStorage(): SaveStorage & { raw: Record<string, string> } {
  const raw: Record<string, string> = {};
  return {
    raw,
    getItem: key => raw[key] ?? null,
    setItem: (key, value) => {
      raw[key] = value;
      return true;
    },
    removeItem: key => {
      delete raw[key];
    },
  };
}

let storage: ReturnType<typeof createMemoryStorage>;

beforeEach(() => {
  storage = createMemoryStorage();
  setSaveStorage(storage);
});

function saveAndLoad(state: GameState): GameState {
  const saved = saveGame(state, state.mapId);
  expect(saved.success).toBe(true);
  const loaded = loadGame(saved.slotId!);
  expect(loaded.success).toBe(true);
  return loaded.gameState!;
}

function continuationSnapshot(state: GameState) {
  return {
    teams: TEAM_IDS.map(teamId => ({
      teamId,
      economy: state.match!.teams[teamId].economy,
    })),
    harvesters: state.harvesters.map(unit => ({
      id: unit.id,
      ownerTeamId: unit.ownerTeamId,
      phase: unit.phase,
      cargoRaw: unit.cargoRaw,
      targetResourceId: unit.targetResourceId,
      ftx: unit.ftx,
      fty: unit.fty,
      hp: unit.hp,
      isDestroyed: unit.isDestroyed,
    })),
    resources: state.resourceNodes.map(node => ({
      id: node.id,
      remainingRaw: node.remainingRaw,
      depleted: node.depleted,
    })),
    nextCivilUnitId: state.nextCivilUnitId,
    civilClockMs: state.civilClockMs,
  };
}

describe('SKIRMISH-P6D four-team civil save/load', () => {
  it('preserves four independent economies and the human compatibility alias', () => {
    const state = createInitialState(
      createGeneratedMapData('p6d-four-economies', 'standard', 'purple'),
      'purple',
    );
    for (let index = 0; index < TEAM_IDS.length; index++) {
      const team = state.match!.teams[TEAM_IDS[index]];
      team.economy.raw = 31 + index;
      team.economy.matter = 81 + index;
      team.economy.elements[team.faction] = 11 + index;
      team.economy.powerGenerated = 20 + index;
      team.economy.powerConsumed = index;
    }
    state.nextCivilUnitId = 17;
    state.civilClockMs = 4321;

    const loaded = saveAndLoad(state);

    for (const teamId of TEAM_IDS) {
      expect(loaded.match!.teams[teamId].economy)
        .toEqual(state.match!.teams[teamId].economy);
    }
    expect(loaded.economy).toBe(loaded.match!.teams['team-purple'].economy);
    expect(loaded.nextCivilUnitId).toBe(17);
    expect(loaded.civilClockMs).toBe(4321);
  });

  it('preserves civil owner, cargo, target, path, durability and AI queues', () => {
    const map = createGeneratedMapData('p6d-civil-runtime', 'standard', 'cyan');
    map.buildings.push({ tx: 16, ty: 16, type: 'units-factory', ownerTeamId: 'team-green' });
    const state = createInitialState(map, 'cyan');
    const harvester = state.harvesters.find(unit => unit.ownerTeamId === 'team-green')!;
    harvester.phase = 'returning-to-hq';
    harvester.cargoRaw = 17;
    harvester.targetResourceId = state.resourceNodes[0].id;
    harvester.returnPath = [{ tx: 8, ty: 8 }, { tx: 9, ty: 8 }];
    harvester.returnPathIndex = 1;
    harvester.hp = 211;
    state.production.factories[0].queue.push({
      unitType: 'harvester',
      request: { kind: 'civil', unitType: 'harvester' },
      elapsedMs: 450,
      durationMs: 20000,
      progress: 0.0225,
      completed: false,
    });

    const loaded = saveAndLoad(state);
    const restored = loaded.harvesters.find(unit => unit.id === harvester.id)!;

    expect(restored).toEqual(expect.objectContaining({
      ownerTeamId: 'team-green',
      phase: 'returning-to-hq',
      cargoRaw: 17,
      targetResourceId: state.resourceNodes[0].id,
      returnPath: [{ tx: 8, ty: 8 }, { tx: 9, ty: 8 }],
      returnPathIndex: 1,
      hp: 211,
      isDestroyed: false,
    }));
    expect(loaded.production.factories[0]).toEqual(expect.objectContaining({
      ownerTeamId: 'team-green',
      queue: [expect.objectContaining({
        request: { kind: 'civil', unitType: 'harvester' },
        elapsedMs: 450,
      })],
    }));
  });

  it('migrates a v5 save with duplicate IDs, missing durability and stale render entities', () => {
    const state = createInitialState(
      createGeneratedMapData('p6d-v5-migration', 'standard', 'cyan'),
      'cyan',
    );
    state.mapData.builders[0].id = 'civil-team-cyan-builder-7';
    for (const unit of state.mapData.builders) {
      delete unit.hp;
      delete unit.maxHp;
      delete unit.isDestroyed;
      delete unit.destroyedAt;
    }
    for (const [index, unit] of state.harvesters.entries()) {
      unit.id = index < 2 ? 'legacy-duplicate' : '';
      delete unit.hp;
      delete unit.maxHp;
      delete unit.isDestroyed;
      delete unit.destroyedAt;
    }
    delete state.nextCivilUnitId;
    delete state.civilClockMs;
    state.entities = state.entities.map(entity =>
      entity.kind === 'harvester' ? { ...entity, id: 'stale-render-id' } : entity,
    );

    const slotId = 'legacy-v5';
    storage.setItem(STORAGE_KEY, JSON.stringify([{
      id: slotId,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      faction: 'cyan',
      mapId: state.mapId,
      mapName: state.mapName,
      summary: {
        raw: 0, matter: 0, powerConsumed: 0, powerGenerated: 0,
        resourcesCount: 0, buildingsCount: 0, harvestersCount: 0, combatUnitsCount: 0,
      },
      version: 5,
      gameState: state,
    }]));

    const result = loadGame(slotId);
    expect(result.success).toBe(true);
    const loaded = result.gameState!;
    const civilIds = [
      ...loaded.mapData.builders.map(unit => unit.id),
      ...loaded.harvesters.map(unit => unit.id),
    ];
    expect(civilIds.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(civilIds).size).toBe(civilIds.length);
    expect(loaded.nextCivilUnitId).toBeGreaterThanOrEqual(8);
    expect(loaded.civilClockMs).toBe(0);
    expect(loaded.mapData.builders.every(unit => unit.hp! > 0 && unit.maxHp! > 0)).toBe(true);
    expect(loaded.harvesters.every(unit => unit.hp! > 0 && unit.maxHp! > 0)).toBe(true);

    const renderedCivilIds = loaded.entities
      .filter(entity => entity.kind === 'builder' || entity.kind === 'harvester')
      .map(entity => entity.id);
    expect(new Set(renderedCivilIds)).toEqual(new Set(civilIds));
    expect(renderedCivilIds).not.toContain('stale-render-id');
  });

  it('preserves destroyed civil wreck state and resumes bounded cleanup', () => {
    const state = createInitialState(
      createGeneratedMapData('p6d-wreck-resume', 'standard', 'cyan'),
      'cyan',
    );
    const target = state.harvesters[0];
    applyCivilUnitDamage(state, target.id, 9999);
    state.civilClockMs = CIVIL_WRECK_LIFETIME_MS - 200;

    const loaded = saveAndLoad(state);
    const restored = loaded.harvesters.find(unit => unit.id === target.id)!;
    expect(restored.isDestroyed).toBe(true);
    expect(loaded.entities.some(entity => entity.id === target.id)).toBe(false);

    updateCivilUnitLifecycle(loaded, 199);
    expect(loaded.harvesters.some(unit => unit.id === target.id)).toBe(true);
    updateCivilUnitLifecycle(loaded, 1);
    expect(loaded.harvesters.some(unit => unit.id === target.id)).toBe(false);
  });

  it('continues deterministic owner-specific unloading after save/load', () => {
    const makeConfiguredState = () => {
      const state = createInitialState(
        createGeneratedMapData('p6d-deterministic-continuation', 'standard', 'yellow'),
        'yellow',
      );
      for (const teamId of TEAM_IDS) state.match!.teams[teamId].economy.raw = 0;
      for (const harvester of state.harvesters) {
        harvester.phase = 'unloading';
        harvester.unloadTimer = 10000;
        harvester.cargoRaw = 0;
      }
      TEAM_IDS.forEach((teamId, index) => {
        const unit = state.harvesters.find(candidate => candidate.ownerTeamId === teamId)!;
        unit.cargoRaw = 10 + index;
        unit.unloadTimer = 0;
      });
      return state;
    };

    const direct = makeConfiguredState();
    const loaded = saveAndLoad(makeConfiguredState());
    updateGameState(direct, 1);
    updateGameState(loaded, 1);

    expect(continuationSnapshot(loaded)).toEqual(continuationSnapshot(direct));
  });
});
