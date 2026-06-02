/**
 * Tests for dev arena — pure TypeScript, no Phaser.
 *
 * ARCH-12A: Tests for the devArena module.
 * ARENA-01H+: Updated for clean standalone Arena mode.
 * ARENA-02H+: Added arenaSpawnVehicle tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isArenaEnabled,
  createArenaMapData,
  devResetArena,
  ARENA_MAP_ID,
  arenaSpawnVehicle,
} from '../state/devArena';
import { createInitialState } from '../state/createInitialState';
import { resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';

describe('devArena', () => {
  describe('isArenaEnabled', () => {
    it('returns boolean without throwing', () => {
      const result = isArenaEnabled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('createArenaMapData', () => {
    it('returns a valid MapData with correct dimensions', () => {
      const mapData = createArenaMapData();
      expect(mapData.width).toBe(20);
      expect(mapData.height).toBe(20);
      expect(mapData.terrain.length).toBe(20);
      expect(mapData.terrain[0].length).toBe(20);
    });

    // ARENA-01H+: Arena has a dummy HQ for MapData type compatibility
    it('has a dummy HQ for type compatibility', () => {
      const mapData = createArenaMapData();
      expect(mapData.hq).toBeDefined();
      expect(mapData.hq.faction).toBe('cyan');
    });

    // ARENA-01H+: Arena has NO resource nodes (clean sandbox)
    it('has no resource nodes (clean arena)', () => {
      const mapData = createArenaMapData();
      expect(mapData.resources.length).toBe(0);
    });

    // ARENA-01H+: Arena has NO builders (clean sandbox)
    it('has no builders (clean arena)', () => {
      const mapData = createArenaMapData();
      expect(mapData.builders.length).toBe(0);
    });

    // ARENA-01H+: Arena has NO obstacles (clean sandbox)
    it('has no obstacles (clean arena)', () => {
      const mapData = createArenaMapData();
      expect(mapData.obstacles.length).toBe(0);
    });

    // ARENA-01H+: Arena creates empty GameState in arenaMode
    it('creates a valid GameState from arena map in arenaMode', () => {
      const mapData = createArenaMapData();
      const state = createInitialState(mapData, 'cyan', 'QA Arena', { includeModularCombat: true, arenaMode: true });
      expect(state.mapWidth).toBe(20);
      expect(state.mapHeight).toBe(20);
      // Arena mode: no harvesters, no resources
      expect(state.harvesters.length).toBe(0);
      expect(state.resourceNodes.length).toBe(0);
      // Arena mode: no Normal Game entities
      expect(state.entities.length).toBe(0);
    });

    // ARENA-01H+: Normal Game mode still creates full state from arena map data
    it('creates a full GameState from arena map without arenaMode', () => {
      const mapData = createArenaMapData();
      const state = createInitialState(mapData, 'cyan');
      expect(state.mapWidth).toBe(20);
      expect(state.mapHeight).toBe(20);
      // Normal Game mode: HQ entity exists (dummy HQ in map data still gets flattened)
      expect(state.entities.some(e => e.kind === 'hq')).toBe(true);
    });
  });

  describe('devResetArena', () => {
    it('returns a fresh arena MapData', () => {
      const mapData = devResetArena();
      expect(mapData.width).toBe(20);
      expect(mapData.height).toBe(20);
    });

    it('returns identical data each call', () => {
      const a = devResetArena();
      const b = devResetArena();
      expect(a.width).toBe(b.width);
      expect(a.hq.tx).toBe(b.hq.tx);
      expect(a.resources.length).toBe(b.resources.length);
      // ARENA-01H+: Both returns clean empty data
      expect(a.resources.length).toBe(0);
      expect(a.builders.length).toBe(0);
    });
  });

  describe('ARENA_MAP_ID', () => {
    it('is a non-empty string', () => {
      expect(ARENA_MAP_ID).toBeTruthy();
      expect(typeof ARENA_MAP_ID).toBe('string');
    });
  });
});

// ─── ARENA-02H+: arenaSpawnVehicle tests ────────────────────────────

describe('arenaSpawnVehicle', () => {
  let state: ReturnType<typeof createInitialState>;

  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    const mapData = createArenaMapData();
    state = createInitialState(mapData, 'cyan', 'QA Arena', { includeModularCombat: true, arenaMode: true });
  });

  it('should spawn an ally vehicle at specified position', () => {
    const result = arenaSpawnVehicle(state, 'wasp', 'smoky', 'ally', 5, 5);
    expect(result.success).toBe(true);
    expect(state.blockoutVehicles).toBeDefined();
    expect(state.blockoutVehicles!.length).toBe(1);
    expect(state.blockoutVehicles![0].bodyId).toBe('wasp');
    expect(state.blockoutVehicles![0].weaponId).toBe('smoky');
    expect(state.blockoutVehicles![0].team).toBe('ally');
    expect(state.blockoutVehicles![0].faction).toBe('cyan');
    expect(state.blockoutVehicles![0].tx).toBe(5);
    expect(state.blockoutVehicles![0].ty).toBe(5);
  });

  it('should spawn an enemy vehicle with green faction', () => {
    const result = arenaSpawnVehicle(state, 'titan', 'thunder', 'enemy', 10, 10);
    expect(result.success).toBe(true);
    expect(state.blockoutVehicles![0].team).toBe('enemy');
    expect(state.blockoutVehicles![0].faction).toBe('green');
  });

  it('should spawn multiple vehicles at different positions', () => {
    arenaSpawnVehicle(state, 'wasp', 'smoky', 'ally', 3, 3);
    arenaSpawnVehicle(state, 'mammoth', 'railgun', 'enemy', 15, 15);
    expect(state.blockoutVehicles!.length).toBe(2);
  });

  it('should return descriptive message', () => {
    const result = arenaSpawnVehicle(state, 'hunter', 'twins', 'ally', 7, 7);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Ally');
    expect(result.message).toContain('Hunter');
    expect(result.message).toContain('Twins');
    expect(result.message).toContain('(7, 7)');
  });

  // ARENA-05H+ fixup: aiMode passed to arenaSpawnVehicle
  it('should set aiMode on enemy vehicle when aiMode is provided', () => {
    const result = arenaSpawnVehicle(state, 'titan', 'thunder', 'enemy', 10, 10, 'chaser');
    expect(result.success).toBe(true);
    const vehicle = state.blockoutVehicles![0];
    expect(vehicle.team).toBe('enemy');
    expect(vehicle.aiMode).toBe('chaser');
  });

  it('should not set aiMode on ally vehicle even when aiMode is provided', () => {
    const result = arenaSpawnVehicle(state, 'viking', 'smoky', 'ally', 5, 5, 'chaser');
    expect(result.success).toBe(true);
    const vehicle = state.blockoutVehicles![0];
    expect(vehicle.team).toBe('ally');
    // Ally should remain passive regardless of aiMode param
    expect(vehicle.aiMode).toBe('passive');
  });

  it('enemy without aiMode defaults to passive', () => {
    const result = arenaSpawnVehicle(state, 'titan', 'thunder', 'enemy', 10, 10);
    expect(result.success).toBe(true);
    expect(state.blockoutVehicles![0].aiMode).toBe('passive');
  });

  it('should set aiMode for stationary_shooter', () => {
    arenaSpawnVehicle(state, 'wasp', 'smoky', 'enemy', 5, 5, 'stationary_shooter');
    expect(state.blockoutVehicles![0].aiMode).toBe('stationary_shooter');
  });

  it('should set aiMode for hold_position', () => {
    arenaSpawnVehicle(state, 'wasp', 'smoky', 'enemy', 5, 5, 'hold_position');
    expect(state.blockoutVehicles![0].aiMode).toBe('hold_position');
  });
});
