import { describe, it, expect } from 'vitest';

/**
 * FIX-05: Focused tests for the CameraControls listener lifecycle safety pattern.
 *
 * CameraControls depends on Phaser.Scene which requires a browser DOM.
 * Importing it in Vitest (Node.js without jsdom) triggers Phaser's
 * module-level `window` access, causing "window is not defined".
 *
 * Rather than adding jsdom (heavy, fragile with Phaser), these tests
 * verify the listener lifecycle PATTERN that CameraControls now follows:
 *
 * 1. Handlers are stored as bound references on construction.
 * 2. destroy() removes only those specific references from the emitter.
 * 3. Other listeners on the same events are not affected.
 * 4. destroy() is idempotent.
 *
 * The actual CameraControls behavior (pan, zoom, reset) is verified by
 * typecheck, build, qa:smoke, and manual QA.
 *
 * If Phaser becomes mockable in a future test infrastructure upgrade,
 * these pattern tests can be replaced with direct CameraControls tests.
 */

// ─── Minimal mock of an event emitter (matches Phaser input plugin API) ──

interface ListenerEntry {
  event: string;
  handler: Function;
}

/** Mock emitter that tracks registered/removed listeners. */
function createMockEmitter() {
  const listeners: ListenerEntry[] = [];

  return {
    on(event: string, handler: Function) {
      listeners.push({ event, handler });
    },
    off(event: string, handler?: Function) {
      if (handler !== undefined) {
        // Remove only the specific handler (FIX-05 correct behavior)
        const idx = listeners.findIndex(
          l => l.event === event && l.handler === handler,
        );
        if (idx !== -1) listeners.splice(idx, 1);
      } else {
        // Remove ALL listeners for this event (the OLD broken behavior)
        for (let i = listeners.length - 1; i >= 0; i--) {
          if (listeners[i].event === event) listeners.splice(i, 1);
        }
      }
    },
    getListeners(): readonly ListenerEntry[] {
      return listeners;
    },
    getHandlers(event: string): Function[] {
      return listeners.filter(l => l.event === event).map(l => l.handler);
    },
    hasHandler(event: string, handler: Function): boolean {
      return listeners.some(l => l.event === event && l.handler === handler);
    },
  };
}

// ─── Simulated CameraControls-like class using the FIX-05 pattern ──────

/**
 * Simulates CameraControls' listener registration/cleanup pattern.
 * This is the EXACT pattern used in the real CameraControls after FIX-05.
 * Testing this class verifies the lifecycle contract without Phaser.
 */
class SimulatedCameraControls {
  private emitter: ReturnType<typeof createMockEmitter>;
  private _destroyed = false;

  // Bound handler references (FIX-05 pattern)
  private boundPointerdown: (pointer: any) => void;
  private boundPointermove: (pointer: any) => void;
  private boundPointerup: () => void;
  private boundPointerupoutside: () => void;
  private boundWheel: (pointer: any, go: any, dx: number, dy: number, dz: number) => void;

  constructor(emitter: ReturnType<typeof createMockEmitter>) {
    this.emitter = emitter;

    // Create bound handler references BEFORE registration
    this.boundPointerdown = this.onPointerdown.bind(this);
    this.boundPointermove = this.onPointermove.bind(this);
    this.boundPointerup = this.onPointerup.bind(this);
    this.boundPointerupoutside = this.onPointerupoutside.bind(this);
    this.boundWheel = this.onWheel.bind(this);

    // Register using bound references
    this.emitter.on('pointerdown', this.boundPointerdown);
    this.emitter.on('pointermove', this.boundPointermove);
    this.emitter.on('pointerup', this.boundPointerup);
    this.emitter.on('pointerupoutside', this.boundPointerupoutside);
    this.emitter.on('wheel', this.boundWheel);
  }

  private onPointerdown(_pointer: any): void {}
  private onPointermove(_pointer: any): void {}
  private onPointerup(): void {}
  private onPointerupoutside(): void {}
  private onWheel(_p: any, _go: any, _dx: number, _dy: number, _dz: number): void {}

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Remove ONLY the specific bound references (FIX-05)
    this.emitter.off('pointerdown', this.boundPointerdown);
    this.emitter.off('pointermove', this.boundPointermove);
    this.emitter.off('pointerup', this.boundPointerup);
    this.emitter.off('pointerupoutside', this.boundPointerupoutside);
    this.emitter.off('wheel', this.boundWheel);
  }
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('FIX-05: CameraControls listener lifecycle pattern', () => {
  it('registers exactly 5 input listeners on construction', () => {
    const emitter = createMockEmitter();
    new SimulatedCameraControls(emitter);

    const listeners = emitter.getListeners();
    expect(listeners.length).toBe(5);

    const events = listeners.map(l => l.event);
    expect(events).toContain('pointerdown');
    expect(events).toContain('pointermove');
    expect(events).toContain('pointerup');
    expect(events).toContain('pointerupoutside');
    expect(events).toContain('wheel');
  });

  it('each event has exactly one handler (no duplicates)', () => {
    const emitter = createMockEmitter();
    new SimulatedCameraControls(emitter);

    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointerupoutside', 'wheel']) {
      expect(emitter.getHandlers(event).length).toBe(1);
    }
  });

  it('destroy removes only CameraControls-owned listeners', () => {
    const emitter = createMockEmitter();
    const controls = new SimulatedCameraControls(emitter);

    // Simulate another system (e.g., GameInputController) registering on shared events
    const otherPointerdownHandler = () => {};
    const otherPointerupHandler = () => {};
    emitter.on('pointerdown', otherPointerdownHandler);
    emitter.on('pointerup', otherPointerupHandler);

    // Before destroy: 2 pointerdown, 2 pointerup
    expect(emitter.getHandlers('pointerdown').length).toBe(2);
    expect(emitter.getHandlers('pointerup').length).toBe(2);

    // Destroy CameraControls
    controls.destroy();

    // After destroy: CameraControls handlers removed, other handlers remain
    expect(emitter.getHandlers('pointerdown').length).toBe(1);
    expect(emitter.getHandlers('pointerdown')[0]).toBe(otherPointerdownHandler);
    expect(emitter.getHandlers('pointerup').length).toBe(1);
    expect(emitter.getHandlers('pointerup')[0]).toBe(otherPointerupHandler);

    // Non-shared events fully removed
    expect(emitter.getHandlers('pointermove').length).toBe(0);
    expect(emitter.getHandlers('pointerupoutside').length).toBe(0);
    expect(emitter.getHandlers('wheel').length).toBe(0);
  });

  it('destroy is idempotent — calling twice is safe', () => {
    const emitter = createMockEmitter();
    const controls = new SimulatedCameraControls(emitter);

    // Add another system's listener
    const otherHandler = () => {};
    emitter.on('pointerdown', otherHandler);

    controls.destroy();
    const countAfterFirst = emitter.getListeners().length;

    // Second destroy should be a no-op
    controls.destroy();
    const countAfterSecond = emitter.getListeners().length;

    expect(countAfterFirst).toBe(countAfterSecond);
    // Other handler should still be registered
    expect(emitter.hasHandler('pointerdown', otherHandler)).toBe(true);
  });

  it('destroy removes all 5 CameraControls listeners', () => {
    const emitter = createMockEmitter();
    const controls = new SimulatedCameraControls(emitter);

    expect(emitter.getListeners().length).toBe(5);

    controls.destroy();

    expect(emitter.getListeners().length).toBe(0);
  });

  it('off(event) without handler reference removes ALL listeners (the old broken behavior)', () => {
    const emitter = createMockEmitter();
    new SimulatedCameraControls(emitter);

    // Simulate another system's listener
    const otherHandler = () => {};
    emitter.on('pointerdown', otherHandler);

    expect(emitter.getHandlers('pointerdown').length).toBe(2);

    // OLD broken behavior: off('pointerdown') without handler removes ALL
    emitter.off('pointerdown');

    // Both listeners removed — this is the bug FIX-05 fixes
    expect(emitter.getHandlers('pointerdown').length).toBe(0);
  });

  it('off(event, handler) with specific reference removes only that handler (FIX-05 correct behavior)', () => {
    const emitter = createMockEmitter();
    const controls = new SimulatedCameraControls(emitter);

    // Simulate another system's listener
    const otherHandler = () => {};
    emitter.on('pointerdown', otherHandler);

    expect(emitter.getHandlers('pointerdown').length).toBe(2);

    // FIX-05 correct behavior: controls.destroy() uses specific handler refs
    controls.destroy();

    // Only CameraControls' handler removed; other handler preserved
    expect(emitter.getHandlers('pointerdown').length).toBe(1);
    expect(emitter.hasHandler('pointerdown', otherHandler)).toBe(true);
  });
});
