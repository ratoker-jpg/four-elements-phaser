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
  formatSaveSlotSummary,
  formatSaveTimestamp,
  type SaveStorage,
  type SaveSummary,
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
    setItem(key: string, value: string): boolean {
      store[key] = value;
      return true;
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

  it('save preserves decor placements in map data', () => {
    const gs = makeGameState();
    gs.mapData.decor = [
      { tx: 9, ty: 9, type: 'env_rock_cluster_2x2', footprint: 2, category: 'prop' },
      { tx: 14, ty: 12, type: 'env_sand_crack_patch_3x3', footprint: 3, category: 'decal' },
    ];

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.mapData.decor).toEqual(gs.mapData.decor);
  });

  it('save preserves production state', () => {
    const gs = makeGameState();
    const factoryCount = gs.production.factories.length;

    const result = saveGame(gs, 'customMap1');
    const loadResult = loadGame(result.slotId!);

    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.production.factories.length).toBe(factoryCount);
  });

  // Fix 2: Storage write failure must be detectable
  it('saveGame returns success:false when storage write fails', () => {
    // Create a mock storage whose setItem always fails
    const failingStorage: SaveStorage = {
      getItem(): string | null {
        return null;
      },
      setItem(): boolean {
        return false; // Simulate localStorage quota/unavailable
      },
      removeItem(): void {},
    };
    setSaveStorage(failingStorage);

    const gs = makeGameState();
    const result = saveGame(gs, 'customMap1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Save failed');
  });

  it('saveGame returns success:false when updating slot and storage write fails', () => {
    // First, save successfully with a working storage
    const gs = makeGameState();
    const saveResult = saveGame(gs, 'customMap1');
    expect(saveResult.success).toBe(true);
    const slotId = saveResult.slotId!;

    // Now swap to a failing storage for the update
    const store = mockStorage; // capture the working store data
    const rawData = store.getItem('four-elements-save-slots');
    const failingStorage: SaveStorage = {
      getItem(): string | null {
        return rawData; // Still reads the existing data
      },
      setItem(): boolean {
        return false; // But writes fail
      },
      removeItem(): void {},
    };
    setSaveStorage(failingStorage);

    gs.economy.raw = 999;
    const updateResult = saveGame(gs, 'customMap1', slotId);

    expect(updateResult.success).toBe(false);
    expect(updateResult.message).toBe('Save failed');
  });
});

describe('formatSaveSlotSummary', () => {
  it('formats basic summary with raw and matter', () => {
    const summary: SaveSummary = {
      raw: 42,
      matter: 80,
      powerConsumed: 0,
      powerGenerated: 0,
      resourcesCount: 3,
      buildingsCount: 0,
      harvestersCount: 0,
    };
    const result = formatSaveSlotSummary(summary);
    expect(result).toContain('Raw: 42');
    expect(result).toContain('Matter: 80');
    expect(result).not.toContain('Power');
    expect(result).not.toContain('Bldgs');
    expect(result).not.toContain('Hrv');
  });

  it('includes power when generated > 0', () => {
    const summary: SaveSummary = {
      raw: 10,
      matter: 20,
      powerConsumed: 9,
      powerGenerated: 25,
      resourcesCount: 3,
      buildingsCount: 0,
      harvestersCount: 0,
    };
    const result = formatSaveSlotSummary(summary);
    expect(result).toContain('Power: 9/25');
  });

  it('includes buildings and harvesters counts', () => {
    const summary: SaveSummary = {
      raw: 5,
      matter: 10,
      powerConsumed: 5,
      powerGenerated: 15,
      resourcesCount: 2,
      buildingsCount: 5,
      harvestersCount: 3,
    };
    const result = formatSaveSlotSummary(summary);
    expect(result).toContain('Bldgs: 5');
    expect(result).toContain('Hrv: 3');
  });

  it('omits zero counts', () => {
    const summary: SaveSummary = {
      raw: 5,
      matter: 10,
      powerConsumed: 0,
      powerGenerated: 0,
      resourcesCount: 2,
      buildingsCount: 0,
      harvestersCount: 0,
    };
    const result = formatSaveSlotSummary(summary);
    expect(result).not.toContain('Bldgs');
    expect(result).not.toContain('Hrv');
  });
});

describe('formatSaveTimestamp', () => {
  it('formats an ISO timestamp as a readable date/time', () => {
    const iso = '2026-05-27T18:05:19.000Z';
    const result = formatSaveTimestamp(iso);
    // Should contain a date and a time, not the raw ISO string
    expect(result).not.toBe(iso);
    expect(result.length).toBeGreaterThan(5);
  });

  it('handles various ISO timestamps', () => {
    const result = formatSaveTimestamp('2026-01-15T08:30:00.000Z');
    expect(result).toContain('2026');
  });
});
