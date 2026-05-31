import { describe, it, expect } from 'vitest';
import { createInitialState, stripModularCombatFromState } from '../state/createInitialState';
import { RESOURCE_RAW_AMOUNTS, START_RAW, START_MATTER, HQ_RAW_CAP, HQ_MATTER_CAP, HQ_ELEMENT_CAP, HQ_BASE_POWER } from '../state/types';

describe('createInitialState', () => {
  it('returns a valid GameState with expected map dimensions', () => {
    const state = createInitialState();
    expect(state.mapWidth).toBe(48);
    expect(state.mapHeight).toBe(48);
  });

  it('has at least one entity', () => {
    const state = createInitialState();
    expect(state.entities.length).toBeGreaterThan(0);
  });

  it('includes an HQ entity at lower-left position', () => {
    const state = createInitialState();
    const hq = state.entities.find(e => e.kind === 'hq');
    expect(hq).toBeDefined();
    // VISUAL-05A-PR4: customMap1 HQ now at (4, 41) for 48×48 map
    expect(hq!.tx).toBe(4);
    expect(hq!.ty).toBe(41);
    expect(hq!.faction).toBe('cyan');
  });

  it('has harvesters with idle phase and zero cargo', () => {
    const state = createInitialState();
    expect(state.harvesters.length).toBeGreaterThan(0);
    for (const h of state.harvesters) {
      expect(h.phase).toBe('idle');
      expect(h.cargoRaw).toBe(0);
      expect(h.cargoCapacity).toBeGreaterThan(0);
    }
  });

  it('has resource nodes with correct initial raw amounts', () => {
    const state = createInitialState();
    expect(state.resourceNodes.length).toBeGreaterThan(0);

    const infinite = state.resourceNodes.find(r => r.resourceType === 'infinite');
    expect(infinite).toBeDefined();
    expect(infinite!.depleted).toBe(false);
    expect(infinite!.remainingRaw).toBe(RESOURCE_RAW_AMOUNTS.infinite);

    const small = state.resourceNodes.find(r => r.resourceType === 'small');
    if (small) {
      expect(small.remainingRaw).toBe(RESOURCE_RAW_AMOUNTS.small);
      expect(small.depleted).toBe(false);
    }
  });

  it('starts with correct initial economy values', () => {
    const state = createInitialState();
    expect(state.economy.raw).toBe(START_RAW);
    expect(state.economy.matter).toBe(START_MATTER);
    expect(state.economy.elements.cyan).toBe(0);
    expect(state.economy.elements.green).toBe(0);
    expect(state.economy.elements.yellow).toBe(0);
    expect(state.economy.elements.purple).toBe(0);
    expect(state.economy.powerGenerated).toBe(HQ_BASE_POWER);
    expect(state.economy.powerConsumed).toBe(0);
  });

  it('sets HQ position to center of 3x3 footprint', () => {
    const state = createInitialState();
    // VISUAL-05A-PR4: HQ at (4,41), center = (5,42)
    expect(state.hqPosition).toEqual({ tx: 5, ty: 42 });
  });

  it('player faction matches map HQ faction', () => {
    const state = createInitialState();
    expect(state.playerFaction).toBe('cyan');
  });

  it('starts with base HQ storage caps', () => {
    const state = createInitialState();
    expect(state.economy.rawCap).toBe(HQ_RAW_CAP);
    expect(state.economy.matterCap).toBe(HQ_MATTER_CAP);
    expect(state.economy.elementCap).toBe(HQ_ELEMENT_CAP);
  });

  // ── PHASER4-LOAD-02: modular-combat entity gating ──────────────────

  it('does not include modular-combat entities by default (standard mode)', () => {
    const state = createInitialState();
    expect(state.extraModularCombat).toEqual([]);
    expect(state.entities.find(e => e.kind === 'modular-combat')).toBeUndefined();
  });

  it('includes modular-combat entity when includeModularCombat is true (devtools/arena mode)', () => {
    const state = createInitialState(undefined, undefined, undefined, { includeModularCombat: true });
    expect(state.extraModularCombat.length).toBeGreaterThan(0);
    expect(state.entities.find(e => e.kind === 'modular-combat')).toBeDefined();
  });

  it('still includes civil units when modular-combat is disabled', () => {
    const state = createInitialState();
    // Harvesters and builders should still be present
    expect(state.harvesters.length).toBeGreaterThan(0);
    expect(state.entities.find(e => e.kind === 'harvester')).toBeDefined();
    // HQ should still be present
    expect(state.entities.find(e => e.kind === 'hq')).toBeDefined();
  });
});

// ─── PHASER4-LOAD-02: stripModularCombatFromState tests ────────────

describe('stripModularCombatFromState', () => {
  /** Create a state with a modular-combat entity (simulating an old save). */
  function makeStateWithModularCombat() {
    return createInitialState(undefined, undefined, undefined, { includeModularCombat: true });
  }

  it('standard-mode cleanup removes modular-combat entities and clears extraModularCombat', () => {
    const original = makeStateWithModularCombat();

    // Sanity: original has modular-combat
    expect(original.extraModularCombat.length).toBeGreaterThan(0);
    expect(original.entities.find(e => e.kind === 'modular-combat')).toBeDefined();

    const cleaned = stripModularCombatFromState(original, { includeModularCombat: false });

    // modular-combat entities removed
    expect(cleaned.entities.find(e => e.kind === 'modular-combat')).toBeUndefined();
    expect(cleaned.extraModularCombat).toEqual([]);

    // Does not mutate original
    expect(original.entities.find(e => e.kind === 'modular-combat')).toBeDefined();
    expect(original.extraModularCombat.length).toBeGreaterThan(0);
  });

  it('devtools-mode preserves modular-combat entities', () => {
    const original = makeStateWithModularCombat();

    const preserved = stripModularCombatFromState(original, { includeModularCombat: true });

    // Nothing stripped
    expect(preserved.entities.find(e => e.kind === 'modular-combat')).toBeDefined();
    expect(preserved.extraModularCombat.length).toBeGreaterThan(0);

    // Same reference (no copy needed)
    expect(preserved).toBe(original);
  });

  it('cleanup does not remove HQ, harvesters, builders, or resources', () => {
    const original = makeStateWithModularCombat();

    // Count non-modular entities before cleanup
    const hqBefore = original.entities.filter(e => e.kind === 'hq').length;
    const harvesterBefore = original.entities.filter(e => e.kind === 'harvester').length;
    const builderBefore = original.entities.filter(e => e.kind === 'builder').length;
    const resourceBefore = original.entities.filter(e => e.kind === 'resource').length;

    const cleaned = stripModularCombatFromState(original, { includeModularCombat: false });

    // All non-modular entities preserved
    expect(cleaned.entities.filter(e => e.kind === 'hq').length).toBe(hqBefore);
    expect(cleaned.entities.filter(e => e.kind === 'harvester').length).toBe(harvesterBefore);
    expect(cleaned.entities.filter(e => e.kind === 'builder').length).toBe(builderBefore);
    expect(cleaned.entities.filter(e => e.kind === 'resource').length).toBe(resourceBefore);

    // Runtime state also preserved
    expect(cleaned.harvesters.length).toBe(original.harvesters.length);
    expect(cleaned.resourceNodes.length).toBe(original.resourceNodes.length);
    expect(cleaned.economy).toEqual(original.economy);
  });

  it('returns same reference when state already has no modular-combat', () => {
    const original = createInitialState(); // standard mode — no modular-combat

    const cleaned = stripModularCombatFromState(original, { includeModularCombat: false });

    // No copy needed — same reference
    expect(cleaned).toBe(original);
  });
});
