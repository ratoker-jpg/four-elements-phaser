import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customMap1 } from '../data/maps/customMap1';
import { canPlaceBuilding, placeConstructionSite, updateConstructionSiteProgress } from '../state/construction';
import { createInitialState } from '../state/createInitialState';
import { collectVisionSources } from '../state/visibility';
import { createHarvester, updateGameState } from '../state/updateGameState';
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

function findBuildableSeparatorTile(state: GameState): { tx: number; ty: number } {
  for (let ty = 0; ty < state.mapHeight; ty++) {
    for (let tx = 0; tx < state.mapWidth; tx++) {
      if (canPlaceBuilding(state, 'separator', tx, ty, 'team-green').valid) {
        return { tx, ty };
      }
    }
  }
  throw new Error('No buildable separator tile found');
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

  it('preserves normalized match and vision object identity during runtime updates', () => {
    const state = freshState();
    const match = state.match;
    const vision = state.vision;
    state.vision.dirty = false;
    updateGameState(state, 0);
    expect(state.match).toBe(match);
    expect(state.vision).toBe(vision);
    expect(state.vision.dirty).toBe(false);
  });

  it('does not expose foreign civil units as human fog vision sources', () => {
    const state = freshState();
    const foreign = createHarvester('green-scout', 20, 20, 'green', 'team-green');
    state.harvesters.push(foreign);
    const sources = collectVisionSources(state);
    expect(sources.some(source => source.sourceId === 'green-scout')).toBe(false);
  });

  it('blocks a foreign Harvester when its team has no Headquarters instead of using the human HQ', () => {
    const state = freshState();
    const foreign = createHarvester('green-returner', 20, 20, 'green', 'team-green');
    foreign.phase = 'returning-to-hq';
    foreign.cargoRaw = 10;
    state.harvesters.push(foreign);
    updateGameState(state, 16);
    expect(foreign.blockedReason).toBe('no-path-to-hq');
    expect(foreign.returnPath).toBeUndefined();
  });

  it('assigns the human owner to legacy initial entities', () => {
    const state = freshState();
    expect(state.mapData.hq.ownerTeamId).toBe('team-cyan');
    expect(state.mapData.builders.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.mapData.buildings.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.harvesters.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.production.factories.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(
      state.entities
        .filter(entity => entity.kind !== 'resource')
        .every(entity => entity.ownerTeamId === 'team-cyan'),
    ).toBe(true);
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

  it('deducts construction costs and registers the completed building for its owner team', () => {
    const state = freshState();
    const match = normalizeMatchState(state);
    const humanMatter = match.teams['team-cyan'].economy.matter;
    const green = match.teams['team-green'];
    green.economy.matter = 500;
    const target = findBuildableSeparatorTile(state);

    const placed = placeConstructionSite(
      state,
      'separator',
      target.tx,
      target.ty,
      'team-green',
    );
    expect(placed.ok).toBe(true);
    expect(green.economy.matter).toBe(440);
    expect(match.teams['team-cyan'].economy.matter).toBe(humanMatter);

    const site = state.mapData.constructionSites.find(item => item.ownerTeamId === 'team-green')!;
    site.pending = false;
    site.elapsed = site.duration;
    expect(updateConstructionSiteProgress(state, `site-${site.id}`, 0).completed).toBe(true);
    expect(
      state.mapData.buildings.some(building =>
        building.tx === target.tx
        && building.ty === target.ty
        && building.ownerTeamId === 'team-green',
      ),
    ).toBe(true);
    expect(
      green.economy.separators.some(separator =>
        separator.tx === target.tx
        && separator.ty === target.ty
        && separator.ownerTeamId === 'team-green',
      ),
    ).toBe(true);
  });

  it('spawns a completed factory order with the factory owner and faction', () => {
    const state = freshState();
    state.mapData.buildings.push({
      tx: 30,
      ty: 30,
      type: 'units-factory',
      ownerTeamId: 'team-green',
    });
    state.production.factories.push({
      tx: 30,
      ty: 30,
      ownerTeamId: 'team-green',
      active: false,
      queue: [{
        unitType: 'builder',
        request: { kind: 'civil', unitType: 'builder' },
        elapsedMs: 15_000,
        durationMs: 15_000,
        progress: 1,
        completed: true,
      }],
    });

    updateGameState(state, 0);
    const spawned = state.mapData.builders.find(builder => builder.ownerTeamId === 'team-green');
    expect(spawned).toBeDefined();
    expect(
      state.entities.some(entity =>
        entity.id === spawned!.id
        && entity.ownerTeamId === 'team-green'
        && entity.faction === 'green',
      ),
    ).toBe(true);
  });

  it('round-trips every team and restores human compatibility aliases', () => {
    const state = freshState();
    state.match!.teams['team-green'].economy.matter = 333;
    state.match!.activeTeamIds = state.match!.activeTeamIds.filter(id => id !== 'team-green');
    const saved = saveGame(state, state.mapId);
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.match!.teams['team-green'].economy.matter).toBe(333);
    expect(loaded.gameState!.match!.activeTeamIds).not.toContain('team-green');
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
      id: 'legacy-v4',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      faction: 'cyan',
      mapId: legacy.mapId,
      mapName: legacy.mapName,
      summary: {},
      version: 4,
      gameState: legacy,
    }]));

    const loaded = loadGame('legacy-v4');
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.match!.activeTeamIds).toEqual(TEAM_IDS);
    expect(loaded.gameState!.mapData.hq.ownerTeamId).toBe('team-cyan');
    expect(loaded.gameState!.harvesters.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
  });
});
