/**
 * Feedback events — pure TypeScript feedback event queue for gameplay VFX.
 *
 * ARCH-13A: Provides a lightweight event queue for command feedback
 * indicators and resource flow notifications. This is a visual-only
 * concern separated from GameState to avoid polluting the pure state
 * model with rendering/transient data.
 *
 * ARCH-13B: Includes state-to-feedback selectors that detect
 * economic changes (harvester unload, gathering activity) from
 * GameState snapshots without mutating state.
 *
 * Pure TS, no Phaser, no DOM.
 */

// ─── Types ──────────────────────────────────────────────────────────

/** Types of feedback events. */
export type FeedbackEventType =
  | 'command-ok'
  | 'command-fail'
  | 'resource-raw-gain'
  | 'gathering-activity';

/** A single transient feedback event. */
export interface FeedbackEvent {
  /** Unique ID for this event. */
  id: number;
  /** What kind of feedback this is. */
  type: FeedbackEventType;
  /** Tile X position where the feedback should appear. */
  tx: number;
  /** Tile Y position where the feedback should appear. */
  ty: number;
  /** Game time when the event was created (ms). */
  createdAt: number;
  /** How long the event should live before fading out (ms). */
  duration: number;
  /** Optional numeric value (e.g. raw amount gained). */
  value?: number;
}

/** Duration constants for each event type (ms). */
export const FEEDBACK_DURATIONS: Record<FeedbackEventType, number> = {
  'command-ok': 800,
  'command-fail': 800,
  'resource-raw-gain': 1500,
  'gathering-activity': 700,
};

/** Interval between gathering activity pulses (ms). */
export const GATHERING_PULSE_INTERVAL = 600;

// ─── FeedbackEventQueue ──────────────────────────────────────────────

/**
 * Manages a queue of transient feedback events.
 *
 * Events are added by gameplay code and aged/pruned each frame.
 * Renderers read active events to draw indicators.
 *
 * Not part of GameState — this is a separate visual-only runtime object.
 */
export class FeedbackEventQueue {
  private events: FeedbackEvent[] = [];
  private nextId = 1;

  /** Add a new feedback event to the queue. Returns the created event. */
  add(type: FeedbackEventType, tx: number, ty: number, now: number, value?: number): FeedbackEvent {
    const event: FeedbackEvent = {
      id: this.nextId++,
      type,
      tx,
      ty,
      createdAt: now,
      duration: FEEDBACK_DURATIONS[type],
      value,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Age and prune events based on the current game time.
   * Removes events that have exceeded their duration.
   * Returns the number of events pruned.
   */
  ageAndPrune(now: number): number {
    const before = this.events.length;
    this.events = this.events.filter(e => now - e.createdAt < e.duration);
    return before - this.events.length;
  }

  /** Get all currently active events. */
  getActive(): ReadonlyArray<FeedbackEvent> {
    return this.events;
  }

  /** Get active events of a specific type. */
  getByType(type: FeedbackEventType): ReadonlyArray<FeedbackEvent> {
    return this.events.filter(e => e.type === type);
  }

  /** Get the alpha (opacity) for an event at the given time. Fades from 1→0 over the last 30% of duration. */
  getAlpha(event: FeedbackEvent, now: number): number {
    const elapsed = now - event.createdAt;
    const fadeStart = event.duration * 0.7;
    if (elapsed < fadeStart) return 1.0;
    const fadeProgress = (elapsed - fadeStart) / (event.duration - fadeStart);
    return Math.max(0, 1.0 - fadeProgress);
  }

  /** Clear all events. */
  clear(): void {
    this.events = [];
    this.nextId = 1;
  }

  /** Number of active events. */
  get size(): number {
    return this.events.length;
  }
}

// ─── State-to-feedback selectors ────────────────────────────────────

/** Previous economy snapshot for detecting changes. */
export interface EconomySnapshot {
  raw: number;
  matter: number;
}

/**
 * Detect resource changes between two economy snapshots.
 * Returns events to emit based on what changed.
 *
 * This is a pure function — does not mutate state or the queue.
 * GameScene calls this each frame and pushes events to the queue.
 */
export function detectEconomyChanges(
  prev: EconomySnapshot,
  current: EconomySnapshot,
  hqTx: number,
  hqTy: number,
): Array<{ type: 'resource-raw-gain'; tx: number; ty: number; value: number }> {
  const events: Array<{ type: 'resource-raw-gain'; tx: number; ty: number; value: number }> = [];

  const rawDelta = current.raw - prev.raw;
  if (rawDelta > 0) {
    events.push({ type: 'resource-raw-gain', tx: hqTx + 1, ty: hqTy + 1, value: rawDelta });
  }

  return events;
}

/**
 * Check if a harvester is currently gathering at a resource.
 * Returns the resource tile position if gathering, null otherwise.
 *
 * Pure function — reads state, no mutation.
 */
export function getGatheringHarvesters(
  harvesters: ReadonlyArray<{ phase: string; ftx: number; fty: number }>,
): Array<{ tx: number; ty: number }> {
  const positions: Array<{ tx: number; ty: number }> = [];
  for (const h of harvesters) {
    if (h.phase === 'gathering') {
      positions.push({ tx: Math.round(h.ftx), ty: Math.round(h.fty) });
    }
  }
  return positions;
}

/**
 * Determine which gathering positions need a new activity pulse.
 *
 * Compares current gathering positions against a map of last-pulse times.
 * Emits a pulse for a position if:
 *   - it has never been pulsed before (new gathering start), or
 *   - GATHERING_PULSE_INTERVAL has elapsed since the last pulse.
 * Stale keys (positions no longer gathering) are dropped from the
 * returned map automatically.
 *
 * Pure function — reads tracking map, returns pulses and updated map.
 */
export function getGatheringPulses(
  currentPositions: ReadonlyArray<{ tx: number; ty: number }>,
  lastPulseTime: Map<string, number>,
  now: number,
): { pulses: Array<{ tx: number; ty: number }>; updatedMap: Map<string, number> } {
  const updatedMap = new Map<string, number>();
  const pulses: Array<{ tx: number; ty: number }> = [];

  for (const pos of currentPositions) {
    const key = `${pos.tx},${pos.ty}`;
    const lastTime = lastPulseTime.get(key);
    if (lastTime === undefined || now - lastTime >= GATHERING_PULSE_INTERVAL) {
      pulses.push(pos);
      updatedMap.set(key, now);
    } else {
      updatedMap.set(key, lastTime);
    }
  }

  // Keys not in currentPositions are stale — they are simply not copied
  // to updatedMap, so they disappear automatically.

  return { pulses, updatedMap };
}
