import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import {
  applyHeadquartersDamage,
  getHeadquartersById,
  normalizeHeadquartersCombatState,
} from '../state/headquartersCombat';
import {
  HEADQUARTERS_ARMOR,
  HEADQUARTERS_MAX_HP,
  getMapHeadquarters,
} from '../state/mapHeadquarters';
import { startUnitProduction } from '../state/production';
import {
  loadGame,
  resetSaveStorage,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState } from '../state/types';

class MemoryStorage implements SaveStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): boolean { this.values.set(key, value); return true; }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('SKIRMISH-P8A Headquarters durability and elimination', () => {
  beforeEach(() => setSaveStorage(new MemoryStorage()));
  afterEach(() => resetSaveStorage());

  function state(humanFaction: 'cyan' | 'green' | 'yellow' | 'purple' = 'cyan'): GameState {
    return createInitialState(
      createGeneratedMapData('p8a-headquarters', 'standard', humanFaction),
      humanFaction,
    );
  }

  it('normalizes four stable target IDs and full durability independent of human faction', () => {
    for (const faction of ['cyan', 'green', 'yellow', 'purple'] as const) {
      const current = state(faction);
      const headquarters = normalizeHeadquartersCombatState(current);
      expect(headquarters.map(hq => hq.id)).toEqual([
        'hq-team-cyan',
        'hq-team-green',
        'hq-team-yellow',
        'hq-team-purple',
      ]);
      for (const hq of headquarters) {
        expect(hq.hp).toBe(HEADQUARTERS_MAX_HP);
        expect(hq.maxHp).toBe(HEADQUARTERS_MAX_HP);
        expect(hq.armor).toBe(HEADQUARTERS_ARMOR);
        expect(hq.isDestroyed).toBe(false);
        expect(hq.destroyedAt).toBeNull();
      }
      expect(current.mapData.hq.id).toBe(`hq-team-${faction}`);
      expect(current.entities.filter(entity => entity.kind === 'hq').map(entity => entity.id))
        .toEqual(headquarters.map(hq => hq.id));
    }
  });

  it('applies armor-reduced enemy damage and rejects friendly damage', () => {
    const current = state();
    expect(applyHeadquartersDamage(current, 'team-green', 'hq-team-green', 100))
      .toEqual({ ok: false, reason: 'friendly-target' });

    const result = applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 100);
    expect(result).toEqual({
      ok: true,
      rawDamage: 100,
      finalDamage: 80,
      killed: false,
      eliminatedTeamId: null,
    });
    expect(getHeadquartersById(current, 'hq-team-green')!.hp)
      .toBe(HEADQUARTERS_MAX_HP - 80);
    expect(current.match!.teams['team-green'].eliminated).toBe(false);
  });

  it('eliminates exactly one owner team and disables only its processing/production', () => {
    const current = state();
    current.mapData.buildings.push(
      { tx: 12, ty: 12, type: 'units-factory', ownerTeamId: 'team-green' },
      { tx: 16, ty: 12, type: 'units-factory', ownerTeamId: 'team-yellow' },
    );
    current.production.factories.push(
      { tx: 12, ty: 12, ownerTeamId: 'team-green', active: true, queue: [] },
      { tx: 16, ty: 12, ownerTeamId: 'team-yellow', active: true, queue: [] },
    );
    current.match!.teams['team-green'].economy.separators.push({
      tx: 10, ty: 10, ownerTeamId: 'team-green', progress: 0.5, active: true,
    });
    current.match!.teams['team-green'].economy.matter = 500;
    current.match!.teams['team-green'].economy.elements.green = 500;

    const result = applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 99999);
    expect(result.ok && result.killed).toBe(true);
    expect(current.match!.teams['team-green']).toEqual(expect.objectContaining({
      eliminated: true,
      hqPosition: null,
    }));
    expect(current.match!.activeTeamIds).not.toContain('team-green');
    expect(current.match!.activeTeamIds).toContain('team-yellow');
    expect(current.production.factories.find(factory => factory.ownerTeamId === 'team-green')!.active).toBe(false);
    expect(current.production.factories.find(factory => factory.ownerTeamId === 'team-yellow')!.active).toBe(true);
    expect(current.match!.teams['team-green'].economy.separators[0].active).toBe(false);
    expect(startUnitProduction(current, 12, 12, 'builder'))
      .toEqual({ ok: false, reason: 'team-eliminated' });

    expect(applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 10))
      .toEqual({ ok: false, reason: 'target-destroyed' });
  });

  it('keeps the human compatibility alias synchronized after damage and destruction', () => {
    const current = state('purple');
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-purple', 100);
    const canonical = getHeadquartersById(current, 'hq-team-purple')!;
    expect(current.mapData.hq).toEqual(canonical);
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-purple', 99999);
    expect(current.mapData.hq.isDestroyed).toBe(true);
    expect(current.mapData.hq.hp).toBe(0);
  });

  it('round-trips damaged and eliminated Headquarters through save v7', () => {
    const current = state('yellow');
    applyHeadquartersDamage(current, 'team-yellow', 'hq-team-green', 250);
    applyHeadquartersDamage(current, 'team-yellow', 'hq-team-purple', 99999);
    const saved = saveGame(current, current.mapId);
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    const restored = loaded.gameState!;

    expect(getHeadquartersById(restored, 'hq-team-green')!.hp)
      .toBe(HEADQUARTERS_MAX_HP - 200);
    expect(getHeadquartersById(restored, 'hq-team-purple')).toEqual(expect.objectContaining({
      hp: 0,
      isDestroyed: true,
    }));
    expect(restored.match!.teams['team-purple'].eliminated).toBe(true);
    expect(restored.match!.activeTeamIds).not.toContain('team-purple');
  });

  it('migrates legacy Headquarters without combat fields and preserves one-HQ maps', () => {
    const current = state();
    for (const hq of getMapHeadquarters(current.mapData)) {
      delete hq.id;
      delete hq.hp;
      delete hq.maxHp;
      delete hq.armor;
      delete hq.isDestroyed;
      delete hq.destroyedAt;
    }
    current.mapData.headquarters = undefined;
    current.mapData.hq = { tx: 3, ty: 20, faction: 'cyan' };
    delete current.match;

    const headquarters = normalizeHeadquartersCombatState(current);
    expect(headquarters).toHaveLength(1);
    expect(headquarters[0]).toEqual(expect.objectContaining({
      id: 'hq-team-cyan',
      ownerTeamId: 'team-cyan',
      hp: HEADQUARTERS_MAX_HP,
      isDestroyed: false,
    }));
    expect(current.match!.teams['team-green'].eliminated).toBe(false);
    expect(current.match!.teams['team-green'].hqPosition).toBeNull();
  });
});
