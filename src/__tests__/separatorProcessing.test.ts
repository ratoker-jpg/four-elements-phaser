import { describe, it, expect } from 'vitest';
import { updateGameState } from '../state/updateGameState';
import { updateConstructionSiteProgress, placeConstructionSite } from '../state/construction';
import { createInitialState } from '../state/createInitialState';
import type { GameState, MapData, EconomyState } from '../state/types';
import {
  SEP_RAW_COST,
  SEP_MATTER_YIELD,
  SEP_ELEMENT_YIELD,
  SEP_CYCLE_MS,
  ELEMENT_UNITS_PER_ELEMENT,
} from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

/**
 * Build a minimal GameState with a separator already in economy.separators.
 * Uses a hand-crafted state to avoid harvester interference in tests.
 */
function makeStateWithSeparator(overrides?: {
  raw?: number;
  matter?: number;
  separatorProgress?: number;
  separatorActive?: boolean;
}): GameState {
  const mapData: MapData = {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array(20).fill('sand')),
    hq: { tx: 0, ty: 0, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [{ tx: 10, ty: 10, type: 'separator' }],
    builders: [],
    constructionSites: [],
  };

  const economy: EconomyState = {
    raw: overrides?.raw ?? 100,
    matter: overrides?.matter ?? 120,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
    powerGenerated: 0,
    powerConsumed: 0,
    separators: [{
      tx: 10,
      ty: 10,
      progress: overrides?.separatorProgress ?? 0,
      active: overrides?.separatorActive ?? false,
    }],
  };

  return {
    mapId: 'test',
    mapName: 'Test',
    mapWidth: 20,
    mapHeight: 20,
    mapData,
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy,
    hqPosition: { tx: 1, ty: 1 },
    nextConstructionId: 0,
  };
}

// ─── Constants ──────────────────────────────────────────────────────

describe('ARCH-01C: separator processing constants', () => {
  it('SEP_RAW_COST is 12', () => {
    expect(SEP_RAW_COST).toBe(12);
  });

  it('SEP_MATTER_YIELD is 10', () => {
    expect(SEP_MATTER_YIELD).toBe(10);
  });

  it('SEP_ELEMENT_YIELD is 2 elementUnits', () => {
    expect(SEP_ELEMENT_YIELD).toBe(2);
  });

  it('SEP_CYCLE_MS is 5000 (5 seconds)', () => {
    expect(SEP_CYCLE_MS).toBe(5000);
  });

  it('ELEMENT_UNITS_PER_ELEMENT is 10', () => {
    expect(ELEMENT_UNITS_PER_ELEMENT).toBe(10);
  });
});

// ─── Separator starts inactive with 0 progress ─────────────────────

describe('ARCH-01C: separator initial state', () => {
  it('separator starts inactive with 0 progress', () => {
    const state = makeStateWithSeparator();
    const sep = state.economy.separators[0];
    expect(sep.progress).toBe(0);
    expect(sep.active).toBe(false);
  });

  it('initial economy from createInitialState has empty separators array', () => {
    const state = createInitialState();
    // No completed separators on a fresh default map
    expect(state.economy.separators).toEqual([]);
  });
});

// ─── Separator progresses when raw is enough ────────────────────────

describe('ARCH-01C: separator progress with sufficient raw', () => {
  it('separator becomes active when raw >= SEP_RAW_COST', () => {
    const state = makeStateWithSeparator({ raw: 100 });
    updateGameState(state, 100);
    const sep = state.economy.separators[0];
    expect(sep.active).toBe(true);
    expect(sep.progress).toBeGreaterThan(0);
  });

  it('separator progresses over multiple frames', () => {
    const state = makeStateWithSeparator({ raw: 100 });
    // 25 frames of 200ms each = 5000ms = 1 full cycle
    for (let i = 0; i < 25; i++) {
      updateGameState(state, 200);
    }
    const sep = state.economy.separators[0];
    // Progress should have cycled back near 0 after completing one cycle
    expect(sep.progress).toBeCloseTo(0, 1);
  });
});

// ─── After 5 seconds, raw decreases, matter increases, elements increase ─

describe('ARCH-01C: separator cycle completion', () => {
  it('after 5 seconds: raw -12, matter +10, faction elementUnits +2', () => {
    const state = makeStateWithSeparator({ raw: 100, matter: 50 });
    const rawBefore = state.economy.raw;
    const matterBefore = state.economy.matter;
    const elementsBefore = state.economy.elements.cyan;

    // 25 frames of 200ms each = 5000ms = 1 full cycle
    for (let i = 0; i < 25; i++) {
      updateGameState(state, 200);
    }

    expect(state.economy.raw).toBe(rawBefore - SEP_RAW_COST);
    expect(state.economy.matter).toBe(matterBefore + SEP_MATTER_YIELD);
    expect(state.economy.elements.cyan).toBe(elementsBefore + SEP_ELEMENT_YIELD);
  });

  it('cycle completion resets progress to near 0', () => {
    const state = makeStateWithSeparator({ raw: 100 });
    for (let i = 0; i < 25; i++) {
      updateGameState(state, 200);
    }
    const sep = state.economy.separators[0];
    // After exactly one cycle, progress should be ~0
    expect(sep.progress).toBeCloseTo(0, 1);
  });
});

// ─── 5 cycles produce exactly +1.0 displayed element ────────────────

describe('ARCH-01C: 5 cycles produce +1.0 displayed element', () => {
  it('5 cycles add 10 elementUnits = 1.0 displayed element', () => {
    const state = makeStateWithSeparator({ raw: 100, matter: 50 });
    const elementsBefore = state.economy.elements.cyan;

    // 5 cycles * 25 frames * 200ms = 250 frames = 25000ms
    for (let i = 0; i < 125; i++) {
      updateGameState(state, 200);
    }

    // 5 cycles * 2 elementUnits = 10 elementUnits
    expect(state.economy.elements.cyan).toBe(elementsBefore + 10);

    // Displayed: 10 / 10 = 1.0
    const displayed = state.economy.elements.cyan / ELEMENT_UNITS_PER_ELEMENT;
    expect(displayed).toBe(1.0);
  });
});

// ─── Separator pauses when raw < 12 and keeps progress ─────────────

describe('ARCH-01C: separator pauses when raw insufficient', () => {
  it('separator pauses when raw < SEP_RAW_COST', () => {
    const state = makeStateWithSeparator({ raw: 5 });
    updateGameState(state, 100);
    const sep = state.economy.separators[0];
    expect(sep.active).toBe(false);
    expect(sep.progress).toBe(0); // No progress because not enough raw
  });

  it('separator keeps progress when paused', () => {
    const state = makeStateWithSeparator({ raw: 100 });
    // Advance partway through a cycle
    for (let i = 0; i < 10; i++) {
      updateGameState(state, 200);
    }
    const sep = state.economy.separators[0];
    const savedProgress = sep.progress;
    expect(savedProgress).toBeGreaterThan(0);
    expect(savedProgress).toBeLessThan(1);

    // Now drain raw to pause
    state.economy.raw = 0;
    updateGameState(state, 200);

    // Progress should be preserved
    expect(sep.progress).toBeCloseTo(savedProgress, 6);
    expect(sep.active).toBe(false);
  });

  it('paused separator resumes when raw becomes sufficient again', () => {
    const state = makeStateWithSeparator({ raw: 100 });
    // Advance partway
    for (let i = 0; i < 10; i++) {
      updateGameState(state, 200);
    }
    const sep = state.economy.separators[0];
    const savedProgress = sep.progress;

    // Drain raw
    state.economy.raw = 0;
    updateGameState(state, 200);
    expect(sep.active).toBe(false);

    // Restore raw
    state.economy.raw = 100;
    updateGameState(state, 200);
    expect(sep.active).toBe(true);
    // Progress should have advanced from where it was
    expect(sep.progress).toBeGreaterThan(savedProgress);
  });
});

// ─── Newly completed Separator is registered into economy separator state ─

describe('ARCH-01C: separator registration on construction completion', () => {
  it('newly completed Separator is registered into economy separator state', () => {
    // Create a controlled state with a builder
    const state = makeStateWithSeparator({ matter: 500 });
    // Remove the existing separator for clean testing
    state.economy.separators = [];
    // Add a builder
    state.mapData.builders.push({
      tx: 9, ty: 14,
      busy: false, phase: 'idle',
      path: [], pathIndex: 0,
      ftx: 9, fty: 14,
      targetTx: 9, targetTy: 14,
      assignedSiteId: -1,
    });

    const separatorsBefore = state.economy.separators.length;

    // Place a construction site at a valid location
    const result = placeConstructionSite(state, 'separator', 14, 14);
    expect(result.ok).toBe(true);

    // The separator should NOT be registered yet (still under construction)
    expect(state.economy.separators.length).toBe(separatorsBefore);

    // Manually set up builder for construction progress
    const builder = state.mapData.builders[0];
    builder.busy = true;
    builder.phase = 'building';
    builder.assignedSiteId = 0;
    const site = state.mapData.constructionSites[0];
    site.builderIndex = 0;
    site.pending = false;

    // Complete construction
    for (let i = 0; i < 100; i++) {
      updateConstructionSiteProgress(state, `site-0`, 200);
    }

    // Now the separator should be registered
    expect(state.economy.separators.length).toBe(separatorsBefore + 1);
    const newSep = state.economy.separators[state.economy.separators.length - 1];
    expect(newSep.tx).toBe(14);
    expect(newSep.ty).toBe(14);
    expect(newSep.progress).toBe(0);
    expect(newSep.active).toBe(false);
  });
});

// ─── Separator initialized from existing buildings in mapData ────────

describe('ARCH-01C: separator initialization from existing buildings', () => {
  it('createInitialState registers existing separator buildings', () => {
    // Build a custom mapData with a separator building
    const mapData: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand')),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [{ tx: 20, ty: 20, type: 'separator' }],
      builders: [{ tx: 5, ty: 5, busy: false, phase: 'idle', path: [], pathIndex: 0, ftx: 5, fty: 5, targetTx: 5, targetTy: 5, assignedSiteId: -1 }],
      constructionSites: [],
    };

    const state = createInitialState(mapData);

    expect(state.economy.separators.length).toBe(1);
    expect(state.economy.separators[0].tx).toBe(20);
    expect(state.economy.separators[0].ty).toBe(20);
    expect(state.economy.separators[0].progress).toBe(0);
    expect(state.economy.separators[0].active).toBe(false);
  });

  it('non-separator buildings are not added to separator runtime state', () => {
    const mapData: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand')),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [{ tx: 20, ty: 20, type: 'raw-storage' }],
      builders: [{ tx: 5, ty: 5, busy: false, phase: 'idle', path: [], pathIndex: 0, ftx: 5, fty: 5, targetTx: 5, targetTy: 5, assignedSiteId: -1 }],
      constructionSites: [],
    };

    const state = createInitialState(mapData);
    expect(state.economy.separators.length).toBe(0);
  });
});

// ─── Multiple separators ─────────────────────────────────────────────

describe('ARCH-01C: multiple separators', () => {
  it('multiple separators each process independently', () => {
    const state = makeStateWithSeparator({ raw: 200 });
    // Add a second separator
    state.economy.separators.push({
      tx: 14,
      ty: 14,
      progress: 0,
      active: false,
    });

    // Complete one cycle (25 frames of 200ms = 5000ms)
    for (let i = 0; i < 25; i++) {
      updateGameState(state, 200);
    }

    // Both separators should have completed one cycle
    // Raw: 200 - 2*12 = 176, Matter: 120 + 2*10 = 140, Elements: 0 + 2*2 = 4
    expect(state.economy.raw).toBe(200 - 2 * SEP_RAW_COST);
    expect(state.economy.matter).toBe(120 + 2 * SEP_MATTER_YIELD);
    expect(state.economy.elements.cyan).toBe(2 * SEP_ELEMENT_YIELD);
  });
});
