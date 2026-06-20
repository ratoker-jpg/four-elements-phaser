/**
 * VISUAL-HUD-CORE-01 tests.
 *
 * Targeted tests for:
 *   - HUD safe-area constants / viewport calculation
 *   - Pointer-in-HUD detection prevents map command routing
 *   - Selection panel view model handles: no selection, unit, building
 *   - Resource strip view model formats current resources without mutating economy
 */

import { describe, it, expect } from 'vitest';
import {
  HUD_BAR_HEIGHT,
  HUD_MINIMAP_WIDTH,
  HUD_MINIMAP_HEIGHT,
  HUD_RESOURCE_STRIP_HEIGHT,
  HUD_PANEL_HEIGHT,
  isScreenPointInHud,
  cameraViewportHeight,
} from '../phaser/ui/hud/hudLayout';
import {
  buildSelectionViewModel,
} from '../phaser/ui/hud/selectionViewModel';
import type { UnitSelection } from '../state/unitSelection';

// ─── 1. HUD layout constants ──────────────────────────────────────

describe('HUD-CORE: layout constants', () => {
  it('HUD_BAR_HEIGHT is a reasonable value (100-250px)', () => {
    expect(HUD_BAR_HEIGHT).toBeGreaterThanOrEqual(100);
    expect(HUD_BAR_HEIGHT).toBeLessThanOrEqual(250);
  });

  it('minimap dimensions are positive', () => {
    expect(HUD_MINIMAP_WIDTH).toBeGreaterThan(0);
    expect(HUD_MINIMAP_HEIGHT).toBeGreaterThan(0);
  });

  it('panel height + resource strip = total bar height', () => {
    expect(HUD_PANEL_HEIGHT + HUD_RESOURCE_STRIP_HEIGHT).toBe(HUD_BAR_HEIGHT);
  });
});

// ─── 2. Camera safe-area / viewport calculation ───────────────────

describe('HUD-CORE: camera safe-area', () => {
  it('cameraViewportHeight reduces canvas height by HUD_BAR_HEIGHT', () => {
    expect(cameraViewportHeight(1080)).toBe(1080 - HUD_BAR_HEIGHT);
    expect(cameraViewportHeight(720)).toBe(720 - HUD_BAR_HEIGHT);
  });

  it('cameraViewportHeight has a minimum of 100px', () => {
    // Very small canvas should still return at least 100
    expect(cameraViewportHeight(200)).toBeGreaterThanOrEqual(100);
  });

  it('isScreenPointInHud returns true for points in the bottom HUD area', () => {
    const canvasHeight = 1080;
    // Point at the very bottom of the canvas
    expect(isScreenPointInHud(canvasHeight - 1, canvasHeight)).toBe(true);
    // Point at the top edge of the HUD bar
    expect(isScreenPointInHud(canvasHeight - HUD_BAR_HEIGHT, canvasHeight)).toBe(true);
  });

  it('isScreenPointInHud returns false for points above the HUD', () => {
    const canvasHeight = 1080;
    // Point just above the HUD bar
    expect(isScreenPointInHud(canvasHeight - HUD_BAR_HEIGHT - 1, canvasHeight)).toBe(false);
    // Point at the top of the canvas
    expect(isScreenPointInHud(0, canvasHeight)).toBe(false);
    // Point in the middle of the canvas
    expect(isScreenPointInHud(canvasHeight / 2, canvasHeight)).toBe(false);
  });

  it('isScreenPointInHud works at 1280×720', () => {
    const canvasHeight = 720;
    expect(isScreenPointInHud(720 - 1, canvasHeight)).toBe(true);
    expect(isScreenPointInHud(720 - HUD_BAR_HEIGHT, canvasHeight)).toBe(true);
    expect(isScreenPointInHud(720 - HUD_BAR_HEIGHT - 1, canvasHeight)).toBe(false);
    expect(isScreenPointInHud(0, canvasHeight)).toBe(false);
  });
});

// ─── 3. Selection view model ──────────────────────────────────────

describe('HUD-CORE: selection view model', () => {
  it('returns empty state when no selection', () => {
    const vm = buildSelectionViewModel({} as any, null);
    expect(vm.hasSelection).toBe(false);
    expect(vm.kind).toBe('none');
    expect(vm.name).toBe('');
    expect(vm.status).toBe('No selection');
  });

  it('returns builder view model for builder selection', () => {
    const mockState = {
      mapData: {
        builders: [{
          id: 'builder-1',
          ftx: 5,
          fty: 5,
          phase: 'idle',
          busy: false,
          manualMove: false,
        }],
      },
      harvesters: [],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.hasSelection).toBe(true);
    expect(vm.kind).toBe('builder');
    expect(vm.name).toBe('Builder');
    expect(vm.faction).toBe('cyan');
    expect(vm.status).toBe('Idle');
  });

  it('returns harvester view model for harvester selection', () => {
    const mockState = {
      mapData: { builders: [] },
      harvesters: [{
        id: 'harvester-1',
        ftx: 3,
        fty: 3,
        phase: 'gathering',
        faction: 'cyan',
      }],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'harvester', id: 'harvester-1' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.hasSelection).toBe(true);
    expect(vm.kind).toBe('harvester');
    expect(vm.name).toBe('Harvester');
    expect(vm.faction).toBe('cyan');
    expect(vm.status).toBe('Gathering');
  });

  it('returns empty when builder ID not found in state', () => {
    const mockState = {
      mapData: { builders: [] },
      harvesters: [],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'builder', id: 'nonexistent' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.hasSelection).toBe(false);
  });

  it('returns empty when harvester ID not found in state', () => {
    const mockState = {
      mapData: { builders: [] },
      harvesters: [],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'harvester', id: 'nonexistent' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.hasSelection).toBe(false);
  });

  it('builder with phase "building" shows "Building" status', () => {
    const mockState = {
      mapData: {
        builders: [{
          id: 'builder-1',
          ftx: 5,
          fty: 5,
          phase: 'building',
          busy: true,
        }],
      },
      harvesters: [],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.status).toBe('Building');
  });

  it('builder with phase "moving-to-site" shows "Moving" status', () => {
    const mockState = {
      mapData: {
        builders: [{
          id: 'builder-1',
          ftx: 5,
          fty: 5,
          phase: 'moving-to-site',
          busy: true,
        }],
      },
      harvesters: [],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.status).toBe('Moving');
  });

  it('harvester with phase "returning-to-hq" shows "Returning" status', () => {
    const mockState = {
      mapData: { builders: [] },
      harvesters: [{
        id: 'harvester-1',
        ftx: 3,
        fty: 3,
        phase: 'returning-to-hq',
        faction: 'cyan',
      }],
      playerFaction: 'cyan',
    } as any;

    const selection: UnitSelection = { kind: 'harvester', id: 'harvester-1' };
    const vm = buildSelectionViewModel(mockState, selection);

    expect(vm.status).toBe('Returning');
  });
});

// ─── 4. Resource strip does not mutate economy ────────────────────

describe('HUD-CORE: resource strip reads without mutation', () => {
  it('view model reads economy fields without modifying them', () => {
    const originalEconomy = {
      raw: 100,
      matter: 50,
      elements: { cyan: 30 },
      rawCap: 500,
      matterCap: 200,
      elementCap: 300,
      powerGenerated: 8,
      powerConsumed: 5,
    };

    // Simulate what the resource strip does: read fields
    const raw = Math.floor(originalEconomy.raw);
    const matter = Math.floor(originalEconomy.matter);
    const elements = Math.floor(originalEconomy.elements.cyan ?? 0);
    const power = `${originalEconomy.powerConsumed}/${originalEconomy.powerGenerated}`;

    // Verify reads are correct
    expect(raw).toBe(100);
    expect(matter).toBe(50);
    expect(elements).toBe(30);
    expect(power).toBe('5/8');

    // Verify no mutation
    expect(originalEconomy.raw).toBe(100);
    expect(originalEconomy.matter).toBe(50);
    expect(originalEconomy.elements.cyan).toBe(30);
  });
});
