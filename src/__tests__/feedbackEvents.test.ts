/**
 * Tests for feedback events — pure TypeScript, no Phaser.
 *
 * ARCH-13A+13B: Tests for the feedbackEvents module.
 */

import { describe, it, expect } from 'vitest';
import {
  FeedbackEventQueue,
  detectEconomyChanges,
  getGatheringHarvesters,
  FEEDBACK_DURATIONS,
  type EconomySnapshot,
} from '../state/feedbackEvents';

describe('FeedbackEventQueue', () => {
  describe('add', () => {
    it('adds an event and returns it', () => {
      const q = new FeedbackEventQueue();
      const e = q.add('command-ok', 5, 5, 1000);
      expect(e.type).toBe('command-ok');
      expect(e.tx).toBe(5);
      expect(e.ty).toBe(5);
      expect(e.createdAt).toBe(1000);
      expect(e.duration).toBe(FEEDBACK_DURATIONS['command-ok']);
    });

    it('assigns unique IDs', () => {
      const q = new FeedbackEventQueue();
      const e1 = q.add('command-ok', 1, 1, 0);
      const e2 = q.add('command-fail', 2, 2, 0);
      expect(e1.id).not.toBe(e2.id);
    });

    it('stores value for resource-gain events', () => {
      const q = new FeedbackEventQueue();
      const e = q.add('resource-raw-gain', 3, 3, 0, 20);
      expect(e.value).toBe(20);
    });
  });

  describe('ageAndPrune', () => {
    it('removes expired events', () => {
      const q = new FeedbackEventQueue();
      q.add('command-ok', 1, 1, 0);
      const pruned = q.ageAndPrune(FEEDBACK_DURATIONS['command-ok'] + 1);
      expect(pruned).toBe(1);
      expect(q.size).toBe(0);
    });

    it('keeps non-expired events', () => {
      const q = new FeedbackEventQueue();
      q.add('command-ok', 1, 1, 0);
      q.ageAndPrune(100);
      expect(q.size).toBe(1);
    });

    it('prunes only expired events, keeps live ones', () => {
      const q = new FeedbackEventQueue();
      q.add('command-ok', 1, 1, 0);           // expires at 800ms
      q.add('command-fail', 2, 2, 500);       // expires at 1300ms
      const pruned = q.ageAndPrune(900);
      expect(pruned).toBe(1);
      expect(q.size).toBe(1);
      expect(q.getActive()[0].tx).toBe(2);
    });
  });

  describe('getActive', () => {
    it('returns all active events', () => {
      const q = new FeedbackEventQueue();
      q.add('command-ok', 1, 1, 0);
      q.add('command-fail', 2, 2, 0);
      expect(q.getActive().length).toBe(2);
    });
  });

  describe('getByType', () => {
    it('filters events by type', () => {
      const q = new FeedbackEventQueue();
      q.add('command-ok', 1, 1, 0);
      q.add('command-fail', 2, 2, 0);
      q.add('command-ok', 3, 3, 0);
      expect(q.getByType('command-ok').length).toBe(2);
      expect(q.getByType('command-fail').length).toBe(1);
    });
  });

  describe('getAlpha', () => {
    it('returns 1.0 for fresh events', () => {
      const q = new FeedbackEventQueue();
      const e = q.add('command-ok', 1, 1, 0);
      expect(q.getAlpha(e, 0)).toBe(1.0);
    });

    it('returns 1.0 during the first 70% of duration', () => {
      const q = new FeedbackEventQueue();
      const e = q.add('command-ok', 1, 1, 0);
      const at50pct = e.duration * 0.5;
      expect(q.getAlpha(e, at50pct)).toBe(1.0);
    });

    it('fades to 0 during the last 30% of duration', () => {
      const q = new FeedbackEventQueue();
      const e = q.add('command-ok', 1, 1, 0);
      const at85pct = e.duration * 0.85;
      const alpha = q.getAlpha(e, at85pct);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(1.0);
    });

    it('returns 0 for expired events', () => {
      const q = new FeedbackEventQueue();
      const e = q.add('command-ok', 1, 1, 0);
      expect(q.getAlpha(e, e.duration + 100)).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all events', () => {
      const q = new FeedbackEventQueue();
      q.add('command-ok', 1, 1, 0);
      q.add('command-fail', 2, 2, 0);
      q.clear();
      expect(q.size).toBe(0);
    });

    it('resets ID counter', () => {
      const q = new FeedbackEventQueue();
      const e1 = q.add('command-ok', 1, 1, 0);
      q.clear();
      const e2 = q.add('command-ok', 1, 1, 0);
      expect(e2.id).toBe(e1.id); // reset to same starting ID
    });
  });
});

describe('detectEconomyChanges', () => {
  it('detects raw gain', () => {
    const prev: EconomySnapshot = { raw: 10, matter: 50 };
    const current: EconomySnapshot = { raw: 30, matter: 50 };
    const events = detectEconomyChanges(prev, current, 4, 4);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('resource-raw-gain');
    expect(events[0].value).toBe(20);
    expect(events[0].tx).toBe(5); // hqTx + 1
    expect(events[0].ty).toBe(5); // hqTy + 1
  });

  it('returns empty when raw decreases', () => {
    const prev: EconomySnapshot = { raw: 30, matter: 50 };
    const current: EconomySnapshot = { raw: 10, matter: 50 };
    const events = detectEconomyChanges(prev, current, 4, 4);
    expect(events.length).toBe(0);
  });

  it('returns empty when raw unchanged', () => {
    const prev: EconomySnapshot = { raw: 10, matter: 50 };
    const current: EconomySnapshot = { raw: 10, matter: 50 };
    const events = detectEconomyChanges(prev, current, 4, 4);
    expect(events.length).toBe(0);
  });
});

describe('getGatheringHarvesters', () => {
  it('returns positions of harvesters in gathering phase', () => {
    const harvesters = [
      { phase: 'gathering', ftx: 5.5, fty: 3.2 },
      { phase: 'idle', ftx: 1.0, fty: 1.0 },
      { phase: 'gathering', ftx: 8.0, fty: 8.0 },
    ];
    const positions = getGatheringHarvesters(harvesters);
    expect(positions.length).toBe(2);
    expect(positions[0]).toEqual({ tx: 6, ty: 3 });
    expect(positions[1]).toEqual({ tx: 8, ty: 8 });
  });

  it('returns empty when no harvesters are gathering', () => {
    const harvesters = [
      { phase: 'idle', ftx: 1.0, fty: 1.0 },
      { phase: 'moving-to-resource', ftx: 2.0, fty: 2.0 },
    ];
    const positions = getGatheringHarvesters(harvesters);
    expect(positions.length).toBe(0);
  });
});

describe('FEEDBACK_DURATIONS', () => {
  it('has duration for every event type', () => {
    const types: Array<keyof typeof FEEDBACK_DURATIONS> = [
      'command-ok', 'command-fail', 'resource-raw-gain', 'gathering-activity',
    ];
    for (const t of types) {
      expect(FEEDBACK_DURATIONS[t]).toBeGreaterThan(0);
    }
  });
});
