import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, ensureBuilderIds } from '../state/createInitialState';
import { selectBuilder, isBuilderSelected } from '../state/unitSelection';
import { updateGameState } from '../state/updateGameState';
import {
  setSaveStorage,
  saveGame,
  loadGame,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState, MapData } from '../state/types';

/**
 * BUILDER-ID: Focused tests proving builder IDs are stable, unique,
 * and correctly integrated across the state, selection, and rendering layers.
 */

// ─── Helper: minimal test state ─────────────────────────────────────

function makeStateWithBuilders(count: number): GameState {
  const builders = Array.from({ length: count }, (_, i) => ({
    id: `builder-${i}`,
    tx: 10 + i,
    ty: 10 + i,
    busy: false,
    phase: 'idle' as const,
    path: [],
    pathIndex: 0,
    ftx: 10 + i,
    fty: 10 + i,
    targetTx: 10 + i,
    targetTy: 10 + i,
    assignedSiteId: -1,
  }));

  const mapData: MapData = {
    width: 48,
    height: 48,
    terrain: Array.from({ length: 48 }, () => Array(48).fill('sand')),
    hq: { tx: 4, ty: 4, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [],
    builders,
    constructionSites: [],
  };

  return createInitialState(mapData, 'cyan');
}

// ─── Builder ID Stability ────────────────────────────────────────────

describe('BUILDER-ID: builder IDs are stable', () => {
  it('each builder has a non-empty string id', () => {
    const state = createInitialState();
    for (const builder of state.mapData.builders) {
      expect(typeof builder.id).toBe('string');
      expect(builder.id.length).toBeGreaterThan(0);
    }
  });

  it('builder IDs remain stable across state updates', () => {
    const state = createInitialState();
    const idsBefore = state.mapData.builders.map(b => b.id);

    // Simulate some state mutations (advance game time)
    for (let i = 0; i < 10; i++) {
      updateGameState(state, 16);
    }

    const idsAfter = state.mapData.builders.map(b => b.id);
    expect(idsAfter).toEqual(idsBefore);
  });

  it('builder IDs from createInitialState match mapData.builders', () => {
    const state = createInitialState();
    // The builders in mapData should have the IDs that were assigned
    // during map data creation or migration
    for (const builder of state.mapData.builders) {
      expect(builder.id).toBeDefined();
      expect(typeof builder.id).toBe('string');
    }
  });
});

// ─── Builder ID Uniqueness ──────────────────────────────────────────

describe('BUILDER-ID: builder IDs are unique', () => {
  it('no two builders share the same id within a state', () => {
    const state = makeStateWithBuilders(5);
    const ids = state.mapData.builders.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('spawned builders get unique IDs', () => {
    const state = createInitialState();

    // Trigger factory production to spawn builders
    state.economy.matter = 500;
    state.economy.elements.cyan = 100;

    // After state updates, any new builders should have unique IDs
    for (let i = 0; i < 5; i++) {
      updateGameState(state, 16);
    }

    const idsAfter = state.mapData.builders.map(b => b.id);
    const uniqueAfter = new Set(idsAfter);
    expect(uniqueAfter.size).toBe(idsAfter.length);
  });
});

// ─── Builder ID in Selection ────────────────────────────────────────

describe('BUILDER-ID: selection uses builder ID', () => {
  it('selectBuilder creates a selection with builder id', () => {
    const sel = selectBuilder('builder-0');
    expect(sel.kind).toBe('builder');
    if (sel.kind === 'builder') {
      expect(sel.id).toBe('builder-0');
    }
  });

  it('isBuilderSelected narrows type with id', () => {
    const sel = selectBuilder('builder-42');
    expect(isBuilderSelected(sel)).toBe(true);
    if (isBuilderSelected(sel)) {
      expect(sel.id).toBe('builder-42');
    }
  });

  it('builder selection id matches state builder id', () => {
    const state = makeStateWithBuilders(3);
    const builder = state.mapData.builders[1];
    const sel = selectBuilder(builder.id);
    expect(sel.kind).toBe('builder');
    if (sel.kind === 'builder') {
      expect(sel.id).toBe(builder.id);
    }
  });
});

// ─── Builder ID Migration (save/load compatibility) ─────────────────

describe('BUILDER-ID: migration for old saves without builder.id', () => {
  it('builders without id get assigned deterministic IDs by createInitialState', () => {
    // Simulate an old map data where builders lack 'id'
    const oldMapData: any = {
      width: 10,
      height: 10,
      terrain: Array.from({ length: 10 }, () => Array(10).fill('sand')),
      hq: { tx: 0, ty: 0, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      // Old-style builders without 'id' field
      builders: [
        {
          tx: 3, ty: 3, busy: false, phase: 'idle',
          path: [], pathIndex: 0, ftx: 3, fty: 3,
          targetTx: 3, targetTy: 3, assignedSiteId: -1,
        },
        {
          tx: 5, ty: 5, busy: false, phase: 'idle',
          path: [], pathIndex: 0, ftx: 5, fty: 5,
          targetTx: 5, targetTy: 5, assignedSiteId: -1,
        },
      ],
      constructionSites: [],
    };

    const state = createInitialState(oldMapData, 'cyan');

    // Migration should have assigned IDs
    expect(state.mapData.builders[0].id).toBe('builder-0');
    expect(state.mapData.builders[1].id).toBe('builder-1');
  });

  it('migrated builder IDs match their renderable entity IDs', () => {
    // Simulate an old map data where builders lack 'id'
    const oldMapData: any = {
      width: 10,
      height: 10,
      terrain: Array.from({ length: 10 }, () => Array(10).fill('sand')),
      hq: { tx: 0, ty: 0, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [
        {
          tx: 3, ty: 3, busy: false, phase: 'idle',
          path: [], pathIndex: 0, ftx: 3, fty: 3,
          targetTx: 3, targetTy: 3, assignedSiteId: -1,
        },
        {
          tx: 5, ty: 5, busy: false, phase: 'idle',
          path: [], pathIndex: 0, ftx: 5, fty: 5,
          targetTx: 5, targetTy: 5, assignedSiteId: -1,
        },
      ],
      constructionSites: [],
    };

    const state = createInitialState(oldMapData, 'cyan');

    // Each builder in mapData should have a matching entity in the entities list
    for (const builder of state.mapData.builders) {
      const entity = state.entities.find(e => e.kind === 'builder' && e.id === builder.id);
      expect(entity).toBeDefined();
      expect(entity!.id).toBe(builder.id);
    }
  });

  it('builders with existing id are not overwritten by migration', () => {
    const mapData: MapData = {
      width: 10,
      height: 10,
      terrain: Array.from({ length: 10 }, () => Array(10).fill('sand')),
      hq: { tx: 0, ty: 0, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [
        {
          id: 'my-custom-builder-id',
          tx: 3, ty: 3, busy: false, phase: 'idle',
          path: [], pathIndex: 0, ftx: 3, fty: 3,
          targetTx: 3, targetTy: 3, assignedSiteId: -1,
        },
      ],
      constructionSites: [],
    };

    const state = createInitialState(mapData, 'cyan');

    // Existing ID should be preserved
    expect(state.mapData.builders[0].id).toBe('my-custom-builder-id');

    // Entity should also use the custom ID
    const entity = state.entities.find(e => e.kind === 'builder' && e.id === 'my-custom-builder-id');
    expect(entity).toBeDefined();
  });
});

// ─── Builder ID in Renderable Entities ───────────────────────────────

describe('BUILDER-ID: renderable entities use builder id', () => {
  it('builder entities in the entities list have matching IDs', () => {
    const state = createInitialState();
    const builderEntities = state.entities.filter(e => e.kind === 'builder');

    // Each builder entity should have an id
    for (const entity of builderEntities) {
      expect(entity.id).toBeDefined();
      expect(typeof entity.id).toBe('string');
    }
  });

  it('builder entity IDs match their corresponding builder IDs in mapData', () => {
    const state = createInitialState();
    const builderEntities = state.entities.filter(e => e.kind === 'builder');

    for (const builder of state.mapData.builders) {
      const entity = builderEntities.find(e => e.id === builder.id);
      expect(entity).toBeDefined();
    }
  });
});

// ─── ensureBuilderIds helper ─────────────────────────────────────────

describe('BUILDER-ID: ensureBuilderIds helper', () => {
  it('assigns builder-{index} to builders without id', () => {
    const mapData: any = {
      width: 10,
      height: 10,
      terrain: [],
      hq: { tx: 0, ty: 0, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [
        { tx: 1, ty: 2 },
        { tx: 3, ty: 4 },
      ],
      constructionSites: [],
    };

    ensureBuilderIds(mapData);

    expect(mapData.builders[0].id).toBe('builder-0');
    expect(mapData.builders[1].id).toBe('builder-1');
  });

  it('preserves existing builder IDs', () => {
    const mapData: any = {
      width: 10,
      height: 10,
      terrain: [],
      hq: { tx: 0, ty: 0, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [
        { id: 'custom-1', tx: 1, ty: 2 },
        { tx: 3, ty: 4 }, // no id — should get builder-1
      ],
      constructionSites: [],
    };

    ensureBuilderIds(mapData);

    expect(mapData.builders[0].id).toBe('custom-1'); // preserved
    expect(mapData.builders[1].id).toBe('builder-1'); // assigned
  });

  it('is idempotent — calling twice produces same result', () => {
    const mapData: any = {
      width: 10,
      height: 10,
      terrain: [],
      hq: { tx: 0, ty: 0, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [
        { tx: 1, ty: 2 },
        { tx: 3, ty: 4 },
      ],
      constructionSites: [],
    };

    ensureBuilderIds(mapData);
    const idsAfterFirst = mapData.builders.map((b: any) => b.id);

    ensureBuilderIds(mapData);
    const idsAfterSecond = mapData.builders.map((b: any) => b.id);

    expect(idsAfterFirst).toEqual(idsAfterSecond);
  });
});

// ─── Builder ID save/load migration ──────────────────────────────────

describe('BUILDER-ID: loadGame migrates old saves without builder.id', () => {
  let mockStorage: SaveStorage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
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
    setSaveStorage(mockStorage);
  });

  it('loadGame applies ensureBuilderIds to old saves missing builder.id', () => {
    // Create a valid state, save it, then corrupt builders to remove 'id'
    const state = createInitialState();
    const saveResult = saveGame(state, 'test');
    expect(saveResult.success).toBe(true);

    // Manually remove builder.id from the saved data to simulate old save
    const raw = mockStorage.getItem('four-elements-save-slots')!;
    const slots = JSON.parse(raw);
    for (const builder of slots[0].gameState.mapData.builders) {
      delete builder.id;
    }
    mockStorage.setItem('four-elements-save-slots', JSON.stringify(slots));

    // Load — should migrate builder IDs
    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState).toBeDefined();

    const loadedBuilders = loadResult.gameState!.mapData.builders;
    for (let i = 0; i < loadedBuilders.length; i++) {
      expect(loadedBuilders[i].id).toBe(`builder-${i}`);
    }
  });

  it('loadGame preserves existing builder IDs in current saves', () => {
    const state = createInitialState();
    const originalIds = state.mapData.builders.map(b => b.id);

    const saveResult = saveGame(state, 'test');
    const loadResult = loadGame(saveResult.slotId!);

    expect(loadResult.success).toBe(true);
    const loadedIds = loadResult.gameState!.mapData.builders.map(b => b.id);
    expect(loadedIds).toEqual(originalIds);
  });
});
