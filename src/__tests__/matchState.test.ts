import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customMap1 } from '../data/maps/customMap1';
import { createInitialState } from '../state/createInitialState';
import { TEAM_IDS, normalizeMatchState } from '../state/matchState';
import { startUnitProduction } from '../state/production';
import {
  loadGame,
  resetSaveStorage,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState } from '../state/types';

function freshState(): GameState {
  const map = JSON.parse(JSON.stringify(customMap1));
  return createInitialState(map, 'cyan');
}

class MemoryStorage implements SaveStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): boolean { this.values.set(key, value); return true; }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('SKIRMISH-P4A multi-team match state', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
  });

  afterEach(() => resetSaveStorage());

  it('creates four independent teams and binds root aliases to the human team', () => {
    const state = freshState();
    const match = state.match!;
    expect(match.activeTeamIds).toEqual(TEAM_IDS);
    expect(match.humanTeamId).toBe('team-cyan');
    expect(match.teams['team-cyan'].controller).toBe('human');
    expect(match.teams['team-green'].controller).toBe('ai');
    expect(new Set(TEAM_IDS.map(id => match.teams[id].economy)).size).toBe(4);
    expect(new Set(TEAM_IDS.map(id => match.teams[id].vision)).size).toBe(4);
    expect(state.economy).toBe(match.teams['team-cyan'].economy);
    expect(state.vision).toBe(match.teams['team-cyan'].vision);
  });

  it('assigns the human owner to legacy initial entities', () => {
    const state = freshState();
    expect(state.mapData.hq.ownerTeamId).toBe('team-cyan');
    expect(state.mapData.builders.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.mapData.buildings.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.harvesters.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.production.factories.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.entities.filter(entity => entity.kind !== 'resource').every(entity => entity.ownerTeamId === 'team-cyan')).toBe(true);
  });

  it('deducts production costs only from the factory owner team', () => {
    const state = freshState();
    const match = normalizeMatchState(state);
    const humanMatter = match.teams['team-cyan'].economy.matter;
    const green = match.teams['team-green'];
    green.economy.matter = 500;
    green.economy.elements.green = 500;
    state.production.factories.push({
      tx: 30,
      ty: 30,
      ownerTeamId: 'team-green',
      queue: [],
      active: false,
    });

    expect(startUnitProduction(state, 30, 30, 'builder')).toEqual({ ok: true });
    expect(green.economy.matter).toBe(460);
    expect(green.economy.elements.green).toBe(490);
    expect(match.teams['team-cyan'].economy.matter).toBe(humanMatter);
  });

  it('round-trips the match state and restores human compatibility aliases', () => {
    const state = freshState();
    state.match!.teams['team-green'].economy.matter = 333;
    const saved = saveGame(state, state.mapId);
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.match!.teams['team-green'].economy.matter).toBe(333);
    expect(loaded.gameState!.economy).toBe(loaded.gameState!.match!.teams['team-cyan'].economy);
    expect(loaded.gameState!.vision).toBe(loaded.gameState!.match!.teams['team-cyan'].vision);
  });

  it('migrates a version 4 single-team save into four owned teams', () => {
    const state = freshState();
    const legacy = JSON.parse(JSON.stringify(state)) as GameState;
    delete legacy.match;
    delete legacy.mapData.hq.ownerTeamId;
    for (const builder of legacy.mapData.builders) delete builder.ownerTeamId;
    for (const building of legacy.mapData.buildings) delete building.ownerTeamId;
    for (const harvester of legacy.harvesters) delete harvester.ownerTeamId;
    for (const factory of legacy.production.factories) delete factory.ownerTeamId;
    storage.setItem('four-elements-save-slots', JSON.stringify([{
      id: 'legacy-v4', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      faction: 'cyan', mapId: legacy.mapId, mapName: legacy.mapName, summary: {}, version: 4, gameState: legacy,
    }]));

    const loaded = loadGame('legacy-v4');
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.match!.activeTeamIds).toEqual(TEAM_IDS);
    expect(loaded.gameState!.mapData.hq.ownerTeamId).toBe('team-cyan');
    expect(loaded.gameState!.harvesters.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
  });
});
