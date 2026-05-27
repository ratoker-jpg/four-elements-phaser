/**
 * Tests for save/load helpers — pure TypeScript, no Phaser.
 *
 * ARCH-15A: Tests for the saveGame module using an in-memory storage mock.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setSaveStorage,
  getSaveSlotMetas,
  hasSaves,
  getLatestSaveMeta,
  saveGame,
  loadGame,
  deleteSave,
  clearAllSaves,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState, Faction } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import { customMap1 } from '../data/maps/customMap1';

// ─── In-memory storage mock ─────────────────────────────────────────

function createMockStorage(): SaveStorage {
  const store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return store[key] ?? null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      delete store[key];
    },
  };
}

let mockStorage: ReturnType<typeof createMockStorage>;

beforeEach(() => {
  mockStorage = createMockStorage();
  setSaveStorage(mockStorage);
});

// ─── Helper: create a real GameState ────────────────────────────────

function makeGameState(faction: Faction = 'cyan'): GameState {
  return createInitialState(customMap1, faction);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('saveGame', () => {
  it('empty storage => no saves', () => {
    expect(hasSaves()).toBe(false);
    expect(getSaveSlotMetas()).toEqual([]);
    expect(getLatestSaveMeta()).toBeNull();
  });

  it('save creates a slot', () => {
    const gs = makeGameState();
    const result = saveGame(gs, 'customMap1');

    expect(result.success).toBe(true);
    expect(result.slotId).toBeDefined();
    expect(hasSaves()).toBe(true);

    const metas = getSaveSlotMetas();
    expect(metas.length).toBe(1);
    expect(metas[0].faction).toBe('cyan');
    expect(metas[0].mapId).toBe('customMap1');
    expect(metas[0].summary.raw).toBe(gs.economy.raw);
    expect(metas[0].summary.matter).toBe(gs.economy.matter);
  });

  it('save updates existing slot', () => {
    const gs = makeGameState();
    const result1 = saveGame(gs, 'customMap1');
    const slotId = result1.slotId!;

    // Modify state and save again
    gs.economy.raw = 100;
    const result2 = saveGame(gs, 'customMap1', slotId);

    expect(result2.success).toBe(true);
    expect(result2.slotId).toBe(slotId);

    const metas = getSaveSlotMetas();
    expect(metas.length).toBe(1);
    expect(metas[0].summary.raw).toBe(100);
  });

  it('latest save selection works', async () => {
    const gs1 = makeGameState('cyan');
    saveGame(gs1, 'customMap1');

    // Wait to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));

    const gs2 = makeGameState('green');
    gs2.economy.raw = 42;
    saveGame(gs2, 'customMap1');

    const latest = getLatestSaveMeta();
    expect(latest).not.toBeNull();
    expect(latest!.faction).toBe('green');
    expect(latest!.summary.raw).toBe(42);
  });

  it('load returns valid payload', () => {
    const gs = makeGameState();
    gs.economy.raw = 77;
    const result = saveGame(gs, 'customMap1');
    const slotId = result.slotId!;

    const loadResult = loadGame(slotId);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState).toBeDefined();
    expect(loadResult.gameState!.economy.raw).toBe(77);
    expect(loadResult.gameState!.playerFaction).toBe('cyan');
  });

  it('corrupted save is ignored safely', () => {
    // Directly inject corrupted data into storage
    mockStorage.setItem('four-elements-save-slots', 'not-json');
    expect(hasSaves()).toBe(false);
    expect(getSaveSlotMetas()).toEqual([]);

    // Inject corrupted array
    mockStorage.setItem('four-elements-save-slots', JSON.stringify([
      { id: 123, version: 'bad' },
      'not an object',
      null,
    ]));
    expect(hasSaves()).toBe(false);
  });

  it('version mismatch is handled safely', () => {
    const gs = makeGameState();
    const result = saveGame(gs, 'customMap1');
    const slotId = result.slotId!;

    // Manually corrupt the version
    const raw = mockStorage.getItem('four-elements-save-slots')!;
    const slots = JSON.parse(raw);
    slots[0].version = 999;
    mockStorage.setItem('four-elements-save-slots', JSON.stringify(slots));

    // Slot should be filtered out from metas
    expect(hasSaves()).toBe(false);
    expect(getSaveSlotMetas()).toEqual([]);

    // Loading should fail
    const loadResult = loadGame(slotId);
    expect(loadResult.success).toBe(false);
  });

  it('delete removes a save slot', () => {
    const gs = makeGameState();
    saveGame(gs, 'customMap1');

    const metas = getSaveSlotMetas();
    expect(metas.length).toBe(1);

    const deleted = deleteSave(metas[0].id);
    expect(deleted).toBe(true);
    expect(hasSaves()).toBe(false);
  });

  it('delete non-existent slot returns false', () => {
    expect(deleteSave('nonexistent')).toBe(false);
  });

  it('clearAllSaves removes everything', () => {
    saveGame(makeGameState(), 'customMap1');
    saveGame(makeGameState('green'), 'customMap1');
    expect(hasSaves()).toBe(true);

    clearAllSaves();
    expect(hasSaves()).toBe(false);
  });

  it('max save slots enforced', () => {
    // Create MAX + 1 saves
    for (let i = 0; i < 5; i++) {
      const gs = makeGameState();
      gs.economy.raw = i * 10;
      saveGame(gs, 'customMap1');
    }

    // 6th save should fail
    const gs = makeGameState();
    const result = saveGame(gs, 'customMap1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Max');
  });

  it('load non-existent slot fails', () => {
    const result = loadGame('does-not-exist');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('save preserves economy state', () => {
    const gs = makeGameState();
    gs.economy.raw = 150;
    gs.economy.matter = 80;
    gs.economy.powerConsumed = 9;
    gs.economy.powerGenerated = 25;

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.economy.raw).toBe(150);
    expect(loadResult.gameState!.economy.matter).toBe(80);
    expect(loadResult.gameState!.economy.powerConsumed).toBe(9);
    expect(loadResult.gameState!.economy.powerGenerated).toBe(25);
  });

  it('save preserves harvester positions', () => {
    const gs = makeGameState();
    gs.harvesters[0].ftx = 12.5;
    gs.harvesters[0].fty = 8.3;

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.harvesters[0].ftx).toBeCloseTo(12.5);
    expect(loadResult.gameState!.harvesters[0].fty).toBeCloseTo(8.3);
  });

  it('save preserves resource depletion', () => {
    const gs = makeGameState();
    gs.resourceNodes[0].depleted = true;
    gs.resourceNodes[0].remainingRaw = 0;

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.resourceNodes[0].depleted).toBe(true);
    expect(loadResult.gameState!.resourceNodes[0].remainingRaw).toBe(0);
  });

  it('save preserves buildings and construction sites', () => {
    const gs = makeGameState();

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.mapData.buildings.length).toBe(gs.mapData.buildings.length);
    expect(loadResult.gameState!.mapData.constructionSites.length).toBe(gs.mapData.constructionSites.length);
  });

  it('save preserves production state', () => {
    const gs = makeGameState();
    const factoryCount = gs.production.factories.length;

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.production.factories.length).toBe(factoryCount);
  });
});
