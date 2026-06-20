/**
 * MINIMAP-INTERACTION-04 FIXUP-2: Real DOM event/state tests.
 *
 * Uses jsdom environment to create actual DOM elements, dispatch real
 * pointer events, and verify HudMinimap behavior end-to-end.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HudMinimap } from '../phaser/ui/hud/HudMinimap';

// ─── Helpers ────────────────────────────────────────────────────────

/** Create a jsdom PointerEvent with configurable properties. */
function createPointerEvent(
  type: string,
  overrides: Partial<PointerEventInit> & { offsetX?: number; offsetY?: number } = {},
): PointerEvent {
  const { offsetX, offsetY, ...eventInit } = overrides;
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    ...eventInit,
  });
  // offsetX/offsetY are readonly on PointerEvent, so we override via Object.defineProperty
  if (offsetX !== undefined) {
    Object.defineProperty(event, 'offsetX', { value: offsetX, writable: false });
  }
  if (offsetY !== undefined) {
    Object.defineProperty(event, 'offsetY', { value: offsetY, writable: false });
  }
  return event;
}

describe('MINIMAP-INTERACTION-04 FIXUP-2: DOM event/state tests', () => {
  let minimap: HudMinimap;
  let parent: HTMLDivElement;
  let cameraCallbackCalls: Array<{ worldX: number; worldY: number }>;
  let cameraCallback: (worldX: number, worldY: number) => void;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    cameraCallbackCalls = [];
    cameraCallback = (worldX: number, worldY: number) => {
      cameraCallbackCalls.push({ worldX, worldY });
    };
    minimap = new HudMinimap();
    parent = document.createElement('div');
    document.body.appendChild(parent);

    minimap.create(parent, cameraCallback);

    // Find the canvas inside the minimap container
    canvas = parent.querySelector('#hud-minimap-canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // Stub setPointerCapture / releasePointerCapture on the canvas
    // (jsdom may not implement them)
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();

    // Seed the minimap with map dimensions by directly setting the
    // private cached fields. We can't call update() because jsdom
    // doesn't have a real Canvas 2D context (getContext returns null).
    const mm = minimap as any;
    mm.cachedMapWidth = 40;
    mm.cachedMapHeight = 40;
  });

  afterEach(() => {
    minimap.destroy();
    parent.remove();
  });

  // ─── stopPropagation ──────────────────────────────────────────

  it('pointerdown calls stopPropagation', () => {
    const event = createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 });
    const spy = vi.spyOn(event, 'stopPropagation');
    canvas.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  it('pointermove calls stopPropagation during drag', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    const moveEvent = createPointerEvent('pointermove', { offsetX: 60, offsetY: 60 });
    const spy = vi.spyOn(moveEvent, 'stopPropagation');
    canvas.dispatchEvent(moveEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('pointermove without drag still calls stopPropagation (input isolation)', () => {
    // No pointerdown — just a hover move over the minimap.
    // stopPropagation must still fire so the event doesn't leak to game canvas.
    const moveEvent = createPointerEvent('pointermove', { offsetX: 80, offsetY: 40 });
    const spy = vi.spyOn(moveEvent, 'stopPropagation');
    canvas.dispatchEvent(moveEvent);
    expect(spy).toHaveBeenCalled();
    // No camera callback should fire (no drag)
    expect(cameraCallbackCalls.length).toBe(0);
  });

  it('pointerup calls stopPropagation', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    const upEvent = createPointerEvent('pointerup', { offsetX: 50, offsetY: 50 });
    const spy = vi.spyOn(upEvent, 'stopPropagation');
    canvas.dispatchEvent(upEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('pointerleave calls stopPropagation', () => {
    const event = createPointerEvent('pointerleave');
    const spy = vi.spyOn(event, 'stopPropagation');
    canvas.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  it('pointercancel calls stopPropagation', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    const cancelEvent = createPointerEvent('pointercancel');
    const spy = vi.spyOn(cancelEvent, 'stopPropagation');
    canvas.dispatchEvent(cancelEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('lostpointercapture calls stopPropagation', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    const lostEvent = createPointerEvent('lostpointercapture');
    const spy = vi.spyOn(lostEvent, 'stopPropagation');
    canvas.dispatchEvent(lostEvent);
    expect(spy).toHaveBeenCalled();
  });

  // ─── Pointer capture ──────────────────────────────────────────

  it('setPointerCapture called on pointerdown', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('releasePointerCapture called on pointerup', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 50, offsetY: 50 }));
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  // ─── Click-to-camera ──────────────────────────────────────────

  it('click below threshold calls camera callback exactly once on pointerup', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 100, offsetY: 50 }));
    // Sub-threshold move (1px)
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 101, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 101, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);
  });

  it('click without any move calls camera callback once', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 100, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 100, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);
  });

  // ─── Drag-to-pan ──────────────────────────────────────────────

  it('drag above threshold calls camera callback on pointermove', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    // Move 5px — above threshold
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 55, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);
  });

  it('drag above threshold does NOT call camera callback on pointerup (click suppressed)', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 55, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 55, offsetY: 50 }));
    // Only the move should have called the callback, not the up
    expect(cameraCallbackCalls.length).toBe(1);
  });

  // ─── Pointer capture vs pointerleave ──────────────────────────

  it('pointerleave during capture does NOT clear drag before pointerup', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    // Drag above threshold
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 55, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);

    // Pointer leaves canvas while captured — should NOT kill drag
    canvas.dispatchEvent(createPointerEvent('pointerleave'));
    // Drag continues — another move should still pan camera
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 60, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(2);

    // pointerup clears drag
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 60, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(2); // no extra callback on up
  });

  it('pointerleave without capture DOES clear drag', () => {
    // Simulate a pointerdown that fails to capture (e.g. setPointerCapture throws)
    const downEvent = createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 });
    // Override setPointerCapture to throw, simulating unsupported capture
    (canvas.setPointerCapture as any).mockImplementation(() => {
      throw new Error('not supported');
    });
    canvas.dispatchEvent(downEvent);

    // Drag above threshold
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 55, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);

    // Pointer leaves — since capture failed, this should cancel drag
    canvas.dispatchEvent(createPointerEvent('pointerleave'));
    // Next move should NOT trigger callback (drag was cancelled)
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 60, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1); // still 1, not 2
  });

  // ─── pointercancel / lostpointercapture ────────────────────────

  it('pointercancel clears drag state', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 55, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);

    // Cancel the pointer
    canvas.dispatchEvent(createPointerEvent('pointercancel'));
    // Move after cancel should NOT trigger callback
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 60, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1); // still 1
  });

  it('lostpointercapture clears drag state', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 55, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);

    // Capture is lost unexpectedly
    canvas.dispatchEvent(createPointerEvent('lostpointercapture'));
    // Move after lost capture should NOT trigger callback
    canvas.dispatchEvent(createPointerEvent('pointermove', { offsetX: 60, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1); // still 1
  });

  // ─── No stale drag state ──────────────────────────────────────

  it('no stale drag after pointerup + new pointerdown', () => {
    // First interaction: click
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 50, offsetY: 50 }));
    expect(cameraCallbackCalls.length).toBe(1);

    // Second interaction: click at different position
    cameraCallbackCalls.length = 0;
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 100, offsetY: 80 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 100, offsetY: 80 }));
    expect(cameraCallbackCalls.length).toBe(1);
  });

  it('no stale drag after pointercancel + new pointerdown', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('pointercancel'));

    // New interaction should work cleanly
    cameraCallbackCalls.length = 0;
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 100, offsetY: 80 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 100, offsetY: 80 }));
    expect(cameraCallbackCalls.length).toBe(1);
  });

  it('no stale drag after lostpointercapture + new pointerdown', () => {
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 50, offsetY: 50 }));
    canvas.dispatchEvent(createPointerEvent('lostpointercapture'));

    // New interaction should work cleanly
    cameraCallbackCalls.length = 0;
    canvas.dispatchEvent(createPointerEvent('pointerdown', { offsetX: 100, offsetY: 80 }));
    canvas.dispatchEvent(createPointerEvent('pointerup', { offsetX: 100, offsetY: 80 }));
    expect(cameraCallbackCalls.length).toBe(1);
  });
});
