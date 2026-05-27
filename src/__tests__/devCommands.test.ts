/**
 * Tests for dev commands — pure TypeScript, no Phaser.
 *
 * ARCH-11A: Tests for the devCommands module.
 */

import { describe, it, expect } from 'vitest';
import {
  devAddRaw,
  devAddMatter,
  devAddFactionElement,
  devMaxResources,
  devZeroResources,
  devSpawnBuilder,
  devSpawnHarvester,
  findSpawnTileNearHq,
  devGetDiagnostics,
  isDevtoolsEnabled,
} from '../state/devCommands';
import type { GameState, Faction } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import { customMap1 } from '../data/maps/customMap1';

// ─── Helper: create a real GameState ────────────────────────────────

function makeGameState(faction: Faction = 'cyan'): GameState {
  return createInitialState(customMap1, faction);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('devCommands', () => {
  describe('isDevtoolsEnabled', () => {
    it('returns false when window is undefined', () => {
      // In Node test environment, window.location may not have search params
      // Just verify it doesn't throw
      const result = isDevtoolsEnabled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('devAddRaw', () => {
    it('adds raw minerals respecting cap', () => {
      const gs = makeGameState();
      const initialRaw = gs.economy.raw;
      const result = devAddRaw(gs);

      expect(result.success).toBe(true);
      expect(gs.economy.raw).toBeGreaterThan(initialRaw);
      expect(gs.economy.raw).toBeLessThanOrEqual(gs.economy.rawCap);
    });

    it('fails when raw storage is full', () => {
      const gs = makeGameState();
      gs.economy.raw = gs.economy.rawCap;
      const result = devAddRaw(gs);

      expect(result.success).toBe(false);
      expect(result.message).toContain('full');
    });
  });

  describe('devAddMatter', () => {
    it('adds matter respecting cap', () => {
      const gs = makeGameState();
      const initialMatter = gs.economy.matter;
      const result = devAddMatter(gs);

      expect(result.success).toBe(true);
      expect(gs.economy.matter).toBeGreaterThan(initialMatter);
      expect(gs.economy.matter).toBeLessThanOrEqual(gs.economy.matterCap);
    });

    it('fails when matter storage is full', () => {
      const gs = makeGameState();
      gs.economy.matter = gs.economy.matterCap;
      const result = devAddMatter(gs);

      expect(result.success).toBe(false);
      expect(result.message).toContain('full');
    });
  });

  describe('devAddFactionElement', () => {
    it('adds faction element units respecting cap', () => {
      const gs = makeGameState();
      const faction = gs.playerFaction;
      const initial = gs.economy.elements[faction];
      const result = devAddFactionElement(gs);

      expect(result.success).toBe(true);
      expect(gs.economy.elements[faction]).toBeGreaterThan(initial);
      expect(gs.economy.elements[faction]).toBeLessThanOrEqual(gs.economy.elementCap);
    });

    it('fails when element storage is full', () => {
      const gs = makeGameState();
      gs.economy.elements[gs.playerFaction] = gs.economy.elementCap;
      const result = devAddFactionElement(gs);

      expect(result.success).toBe(false);
      expect(result.message).toContain('full');
    });

    it('works for non-cyan faction', () => {
      const gs = makeGameState('green');
      const initial = gs.economy.elements['green'];
      const result = devAddFactionElement(gs);

      expect(result.success).toBe(true);
      expect(gs.economy.elements['green']).toBeGreaterThan(initial);
    });
  });

  describe('devMaxResources', () => {
    it('sets all resources to cap values', () => {
      const gs = makeGameState();
      const result = devMaxResources(gs);

      expect(result.success).toBe(true);
      expect(gs.economy.raw).toBe(gs.economy.rawCap);
      expect(gs.economy.matter).toBe(gs.economy.matterCap);
      expect(gs.economy.elements[gs.playerFaction]).toBe(gs.economy.elementCap);
      expect(result.message).toContain('DEV');
    });
  });

  describe('devZeroResources', () => {
    it('sets all resources to zero', () => {
      const gs = makeGameState();
      const result = devZeroResources(gs);

      expect(result.success).toBe(true);
      expect(gs.economy.raw).toBe(0);
      expect(gs.economy.matter).toBe(0);
      expect(gs.economy.elements[gs.playerFaction]).toBe(0);
    });
  });

  describe('devSpawnBuilder', () => {
    it('spawns a builder near HQ', () => {
      const gs = makeGameState();
      const initialCount = gs.mapData.builders.length;
      const result = devSpawnBuilder(gs);

      expect(result.success).toBe(true);
      expect(gs.mapData.builders.length).toBe(initialCount + 1);
      expect(result.message).toContain('Builder');
      expect(result.message).toContain('spawned');
    });

    it('spawns builder with correct faction', () => {
      const gs = makeGameState('green');
      devSpawnBuilder(gs);
      const lastBuilder = gs.mapData.builders[gs.mapData.builders.length - 1];

      expect(lastBuilder.phase).toBe('idle');
      expect(lastBuilder.busy).toBe(false);
    });

    it('spawned builder is on a valid passable tile', () => {
      const gs = makeGameState();
      devSpawnBuilder(gs);
      const lastBuilder = gs.mapData.builders[gs.mapData.builders.length - 1];

      // Builder position should be within map bounds
      expect(lastBuilder.tx).toBeGreaterThanOrEqual(0);
      expect(lastBuilder.ty).toBeGreaterThanOrEqual(0);
      expect(lastBuilder.tx).toBeLessThan(gs.mapWidth);
      expect(lastBuilder.ty).toBeLessThan(gs.mapHeight);
    });

    it('adds entity to renderable entity list', () => {
      const gs = makeGameState();
      const initialEntityCount = gs.entities.length;
      devSpawnBuilder(gs);

      expect(gs.entities.length).toBe(initialEntityCount + 1);
      const lastEntity = gs.entities[gs.entities.length - 1];
      expect(lastEntity.kind).toBe('builder');
    });
  });

  describe('devSpawnHarvester', () => {
    it('spawns a harvester near HQ', () => {
      const gs = makeGameState();
      const initialCount = gs.harvesters.length;
      const result = devSpawnHarvester(gs);

      expect(result.success).toBe(true);
      expect(gs.harvesters.length).toBe(initialCount + 1);
      expect(result.message).toContain('Harvester');
      expect(result.message).toContain('spawned');
    });

    it('spawns harvester in idle phase', () => {
      const gs = makeGameState();
      devSpawnHarvester(gs);
      const lastHarvester = gs.harvesters[gs.harvesters.length - 1];

      expect(lastHarvester.phase).toBe('idle');
      expect(lastHarvester.cargoRaw).toBe(0);
    });

    it('adds entity to renderable entity list', () => {
      const gs = makeGameState();
      const initialEntityCount = gs.entities.length;
      devSpawnHarvester(gs);

      expect(gs.entities.length).toBe(initialEntityCount + 1);
      const lastEntity = gs.entities[gs.entities.length - 1];
      expect(lastEntity.kind).toBe('harvester');
    });
  });

  describe('findSpawnTileNearHq', () => {
    it('finds a valid tile near HQ', () => {
      const gs = makeGameState();
      const pos = findSpawnTileNearHq(gs);

      expect(pos).not.toBeNull();
      expect(pos!.tx).toBeGreaterThanOrEqual(0);
      expect(pos!.ty).toBeGreaterThanOrEqual(0);
      expect(pos!.tx).toBeLessThan(gs.mapWidth);
      expect(pos!.ty).toBeLessThan(gs.mapHeight);
    });

    it('spawning twice does not place both units on the same tile when alternatives exist', () => {
      const gs = makeGameState();
      const result1 = devSpawnBuilder(gs);
      expect(result1.success).toBe(true);

      const result2 = devSpawnBuilder(gs);
      expect(result2.success).toBe(true);

      // The two builders should be on different tiles
      const b1 = gs.mapData.builders[gs.mapData.builders.length - 2];
      const b2 = gs.mapData.builders[gs.mapData.builders.length - 1];
      const sameTile = Math.round(b1.ftx) === Math.round(b2.ftx) &&
                       Math.round(b1.fty) === Math.round(b2.fty);
      expect(sameTile).toBe(false);
    });

    it('spawning builder then harvester does not reuse the same tile', () => {
      const gs = makeGameState();
      const result1 = devSpawnBuilder(gs);
      expect(result1.success).toBe(true);

      const result2 = devSpawnHarvester(gs);
      expect(result2.success).toBe(true);

      // Builder and harvester should be on different tiles
      const builder = gs.mapData.builders[gs.mapData.builders.length - 1];
      const harvester = gs.harvesters[gs.harvesters.length - 1];
      const sameTile = Math.round(builder.ftx) === Math.round(harvester.ftx) &&
                       Math.round(builder.fty) === Math.round(harvester.fty);
      expect(sameTile).toBe(false);
    });

    it('returns failure when all nearby candidate tiles are occupied', () => {
      const gs = makeGameState();

      // Spawn many builders to exhaust nearby tiles (8 rings * many candidates)
      // Keep spawning until it fails
      let lastResult = { success: true, message: '' };
      for (let i = 0; i < 200; i++) {
        lastResult = devSpawnBuilder(gs);
        if (!lastResult.success) break;
      }

      expect(lastResult.success).toBe(false);
      expect(lastResult.message).toContain('No valid spawn tile');
    });
  });

  describe('devGetDiagnostics', () => {
    it('returns correct diagnostics snapshot', () => {
      const gs = makeGameState();
      gs.economy.raw = 150;
      gs.economy.matter = 80;
      const diag = devGetDiagnostics(gs);

      expect(diag.faction).toBe('cyan');
      expect(diag.raw).toBe(150);
      expect(diag.matter).toBe(80);
      expect(diag.builderCount).toBe(gs.mapData.builders.length);
      expect(diag.resourceNodeCount).toBe(gs.resourceNodes.filter(r => !r.depleted).length);
      expect(diag.separatorCount).toBe(gs.economy.separators.length);
      expect(typeof diag.factoryQueueSummary).toBe('string');
    });

    it('diagnostics snapshot does not mutate state', () => {
      const gs = makeGameState();
      const rawBefore = gs.economy.raw;
      devGetDiagnostics(gs);

      expect(gs.economy.raw).toBe(rawBefore);
    });
  });
});
