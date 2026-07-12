import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import { applyHeadquartersDamage } from '../state/headquartersCombat';
import {
  createOngoingMatchResult,
  evaluateMatchResult,
  isMatchFinished,
  resolveRestartSetup,
} from '../state/matchResult';
import { updateGameState } from '../state/updateGameState';
import {
  loadGame,
  resetSaveStorage,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState, MatchSetupSnapshot } from '../state/types';

class MemoryStorage implements SaveStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): boolean { this.values.set(key, value); return true; }
  removeItem(key: string): void { this.values.delete(key); }
}

function state(): GameState {
  return createInitialState(
    createGeneratedMapData('p8c-result-seed', 'standard', 'cyan'),
    'cyan',
  );
}

const SETUP: MatchSetupSnapshot = {
  faction: 'cyan',
  mapId: 'generated-standard-p8c-result-seed',
  mapMode: 'generated',
  mapSize: 'standard',
  seed: 'p8c-result-seed',
  gameMode: 'standard',
  mapStyle: 'industrial',
  resourceStyle: 'industrial',
};

describe('SKIRMISH-P8C persistent match result', () => {
  beforeEach(() => setSaveStorage(new MemoryStorage()));
  afterEach(() => resetSaveStorage());

  it('starts ongoing and does not resolve after only one enemy elimination', () => {
    const current = state();
    expect(current.matchResult).toEqual(createOngoingMatchResult());
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 99999);
    expect(evaluateMatchResult(current).outcome).toBe('ongoing');
    expect(isMatchFinished(current)).toBe(false);
  });

  it('resolves Defeat exactly once when the human Headquarters is destroyed', () => {
    const current = state();
    current.combatClockMs = 1200;
    applyHeadquartersDamage(current, 'team-green', 'hq-team-cyan', 99999);
    const first = evaluateMatchResult(current);
    expect(first).toEqual(expect.objectContaining({
      outcome: 'defeat',
      winnerTeamId: null,
      resolvedAtMs: 1200,
    }));
    current.combatClockMs = 9000;
    const second = evaluateMatchResult(current);
    expect(second).toBe(first);
    expect(second.resolvedAtMs).toBe(1200);
  });

  it('resolves Victory only after all three enemy Headquarters are destroyed', () => {
    const current = state();
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 99999);
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-yellow', 99999);
    expect(evaluateMatchResult(current).outcome).toBe('ongoing');
    current.combatClockMs = 5000;
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-purple', 99999);
    expect(evaluateMatchResult(current)).toEqual(expect.objectContaining({
      outcome: 'victory',
      winnerTeamId: 'team-cyan',
      defeatedTeamIds: ['team-green', 'team-yellow', 'team-purple'],
      resolvedAtMs: 5000,
    }));
  });

  it('freezes pure game-state advancement after a result', () => {
    const current = state();
    applyHeadquartersDamage(current, 'team-green', 'hq-team-cyan', 99999);
    evaluateMatchResult(current);
    const civilClock = current.civilClockMs;
    const combatClock = current.combatClockMs;
    updateGameState(current, 1000);
    expect(current.civilClockMs).toBe(civilClock);
    expect(current.combatClockMs).toBe(combatClock);
  });

  it('round-trips result and same-seed restart setup through save v8', () => {
    const current = state();
    current.matchSetup = { ...SETUP };
    applyHeadquartersDamage(current, 'team-green', 'hq-team-cyan', 99999);
    evaluateMatchResult(current);
    const saved = saveGame(current, current.mapId);
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.matchResult).toEqual(current.matchResult);
    expect(resolveRestartSetup(loaded.gameState!, { ...SETUP, seed: 'fallback' }))
      .toEqual(SETUP);
  });

  it('uses a safe fallback setup for legacy saves without a snapshot', () => {
    const current = state();
    delete current.matchSetup;
    expect(resolveRestartSetup(current, SETUP)).toEqual(SETUP);
  });
});
