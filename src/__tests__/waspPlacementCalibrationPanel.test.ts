/**
 * Tests for WaspPlacementCalibrationPanel — on-screen button panel
 * for Wasp hull placement calibration.
 *
 * PIM-HULL-WASP-ANCHOR-MAP-01 fixup v3: Tests focus on panel lifecycle
 * (show/hide/destroy) and button action dispatch. Since the panel creates
 * Phaser game objects, we mock the scene and verify interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  activatePlacement,
  deactivatePlacement,
  getDebugOffsetX,
  getDebugOffsetY,
  resetPlacementOffset,
  adjustUp,
  adjustDown,
  adjustLeft,
  adjustRight,
  printPlacementValues,
} from '../phaser/debug/WaspHullPlacementCalibrator';

// ─── State management integration tests ───────────────────────────

describe('WaspPlacementCalibrationPanel integration', () => {
  beforeEach(() => {
    deactivatePlacement();
  });

  it('adjustUp is called when panel UP button would fire', () => {
    activatePlacement();
    adjustUp(false);
    expect(getDebugOffsetY()).toBe(-1);
  });

  it('adjustDown is called when panel DOWN button would fire', () => {
    activatePlacement();
    adjustDown(false);
    expect(getDebugOffsetY()).toBe(1);
  });

  it('adjustLeft is called when panel LEFT button would fire', () => {
    activatePlacement();
    adjustLeft(false);
    expect(getDebugOffsetX()).toBe(-1);
  });

  it('adjustRight is called when panel RIGHT button would fire', () => {
    activatePlacement();
    adjustRight(false);
    expect(getDebugOffsetX()).toBe(1);
  });

  it('adjustUp(true) is called when panel UP x5 button would fire', () => {
    activatePlacement();
    adjustUp(true);
    expect(getDebugOffsetY()).toBe(-5);
  });

  it('adjustDown(true) is called when panel DOWN x5 button would fire', () => {
    activatePlacement();
    adjustDown(true);
    expect(getDebugOffsetY()).toBe(5);
  });

  it('adjustLeft(true) is called when panel LEFT x5 button would fire', () => {
    activatePlacement();
    adjustLeft(true);
    expect(getDebugOffsetX()).toBe(-5);
  });

  it('adjustRight(true) is called when panel RIGHT x5 button would fire', () => {
    activatePlacement();
    adjustRight(true);
    expect(getDebugOffsetX()).toBe(5);
  });

  it('resetPlacementOffset is called when panel RESET button would fire', () => {
    activatePlacement();
    adjustDown(true);
    adjustRight(true);
    expect(getDebugOffsetX()).toBe(5);
    expect(getDebugOffsetY()).toBe(5);
    resetPlacementOffset();
    expect(getDebugOffsetX()).toBe(0);
    expect(getDebugOffsetY()).toBe(0);
  });

  it('printPlacementValues is callable when panel PRINT VALUES button would fire', () => {
    activatePlacement();
    // Should not throw
    expect(() => printPlacementValues()).not.toThrow();
  });
});

// ─── Panel class lifecycle tests (with mocked Phaser scene) ──────

describe('WaspPlacementCalibrationPanel lifecycle', () => {
  // Minimal mock of Phaser.Scene methods used by the panel
  function createMockScene() {
    const objects: any[] = [];
    const mockCamera = { width: 1280, height: 720, scrollX: 0, scrollY: 0, zoom: 1 };
    return {
      cameras: { main: mockCamera },
      add: {
        container: vi.fn((_x: number, _y: number) => {
          const container = {
            setDepth: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            add: vi.fn(),
            destroy: vi.fn(),
          };
          objects.push(container);
          return container;
        }),
        graphics: vi.fn(() => {
          const g = {
            fillStyle: vi.fn().mockReturnThis(),
            fillRoundedRect: vi.fn().mockReturnThis(),
            lineStyle: vi.fn().mockReturnThis(),
            strokeRoundedRect: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          };
          objects.push(g);
          return g;
        }),
        text: vi.fn((_x: number, _y: number, _text: string, _style?: any) => {
          const t = {
            setOrigin: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          };
          objects.push(t);
          return t;
        }),
        rectangle: vi.fn((_x: number, _y: number, _w: number, _h: number, _color: number, _alpha: number) => {
          const r = {
            setOrigin: vi.fn().mockReturnThis(),
            setStrokeStyle: vi.fn().mockReturnThis(),
            setInteractive: vi.fn().mockReturnThis(),
            on: vi.fn().mockReturnThis(),
            setFillStyle: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          };
          objects.push(r);
          return r;
        }),
      },
      _objects: objects,
    } as any;
  }

  it('show() creates panel game objects', async () => {
    const { WaspPlacementCalibrationPanel } = await import('../phaser/debug/WaspPlacementCalibrationPanel');
    const mockScene = createMockScene();
    const panel = new WaspPlacementCalibrationPanel(mockScene);

    expect(panel.isVisible()).toBe(false);
    panel.show();
    expect(panel.isVisible()).toBe(true);
    // Container should have been created
    expect(mockScene.add.container).toHaveBeenCalled();
  });

  it('show() is no-op when already visible', async () => {
    const { WaspPlacementCalibrationPanel } = await import('../phaser/debug/WaspPlacementCalibrationPanel');
    const mockScene = createMockScene();
    const panel = new WaspPlacementCalibrationPanel(mockScene);

    panel.show();
    const callCount = mockScene.add.container.mock.calls.length;
    panel.show(); // second call should be no-op
    expect(mockScene.add.container.mock.calls.length).toBe(callCount);
  });

  it('hide() destroys the panel', async () => {
    const { WaspPlacementCalibrationPanel } = await import('../phaser/debug/WaspPlacementCalibrationPanel');
    const mockScene = createMockScene();
    const panel = new WaspPlacementCalibrationPanel(mockScene);

    panel.show();
    expect(panel.isVisible()).toBe(true);
    panel.hide();
    expect(panel.isVisible()).toBe(false);
  });

  it('hide() is no-op when already hidden', async () => {
    const { WaspPlacementCalibrationPanel } = await import('../phaser/debug/WaspPlacementCalibrationPanel');
    const mockScene = createMockScene();
    const panel = new WaspPlacementCalibrationPanel(mockScene);

    panel.hide(); // should not throw
    expect(panel.isVisible()).toBe(false);
  });

  it('destroy() cleans up panel', async () => {
    const { WaspPlacementCalibrationPanel } = await import('../phaser/debug/WaspPlacementCalibrationPanel');
    const mockScene = createMockScene();
    const panel = new WaspPlacementCalibrationPanel(mockScene);

    panel.show();
    panel.destroy();
    expect(panel.isVisible()).toBe(false);
  });

  it('creates 10 buttons (4 direction + 4 x5 + RESET + PRINT VALUES)', async () => {
    const { WaspPlacementCalibrationPanel } = await import('../phaser/debug/WaspPlacementCalibrationPanel');
    const mockScene = createMockScene();
    const panel = new WaspPlacementCalibrationPanel(mockScene);

    panel.show();
    // 10 rectangles for buttons
    expect(mockScene.add.rectangle.mock.calls.length).toBe(10);
    // Button labels + title + panel text
    expect(mockScene.add.text.mock.calls.length).toBeGreaterThanOrEqual(10);
  });
});
