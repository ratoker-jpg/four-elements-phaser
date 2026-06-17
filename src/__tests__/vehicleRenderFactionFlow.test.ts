/**
 * VEHICLE-RENDER-UNIFY-01-VH Package G — canonical faction resolver tests.
 *
 * Tests cover:
 *   - all four canonical factions pass through unchanged;
 *   - missing/invalid faction warns once per context (no silent recolor);
 *   - diagnostic cyan fallback is marked via usedFallback=true;
 *   - subsequent invalid calls for the same context are silent (count tracked);
 *   - different contexts warn independently.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveFactionOrDiagnosticFallback,
  isCanonicalFaction,
  CANONICAL_FACTIONS,
  resetFactionWarningLedger,
  getFactionWarningCounts,
} from '../modular/factionResolver';

describe('VEHICLE-RENDER-UNIFY-01-VH: factionResolver', () => {
  beforeEach(() => {
    resetFactionWarningLedger();
  });

  describe('isCanonicalFaction', () => {
    it('returns true for all four canonical factions', () => {
      expect(isCanonicalFaction('cyan')).toBe(true);
      expect(isCanonicalFaction('green')).toBe(true);
      expect(isCanonicalFaction('yellow')).toBe(true);
      expect(isCanonicalFaction('purple')).toBe(true);
    });

    it('returns false for non-canonical values', () => {
      expect(isCanonicalFaction('red')).toBe(false);
      expect(isCanonicalFaction('blue')).toBe(false);
      expect(isCanonicalFaction('')).toBe(false);
      expect(isCanonicalFaction(undefined)).toBe(false);
      expect(isCanonicalFaction(null)).toBe(false);
      expect(isCanonicalFaction(123)).toBe(false);
      expect(isCanonicalFaction({})).toBe(false);
    });

    it('CANONICAL_FACTIONS contains exactly the 4 accepted factions', () => {
      expect(CANONICAL_FACTIONS).toEqual(['cyan', 'green', 'yellow', 'purple']);
      expect(CANONICAL_FACTIONS.length).toBe(4);
    });
  });

  describe('resolveFactionOrDiagnosticFallback — valid factions', () => {
    it('passes cyan through unchanged', () => {
      const r = resolveFactionOrDiagnosticFallback('cyan', 'test-cyan');
      expect(r.faction).toBe('cyan');
      expect(r.isValid).toBe(true);
      expect(r.usedFallback).toBe(false);
      expect(r.originalValue).toBe('cyan');
    });

    it('passes green through unchanged', () => {
      const r = resolveFactionOrDiagnosticFallback('green', 'test-green');
      expect(r.faction).toBe('green');
      expect(r.isValid).toBe(true);
      expect(r.usedFallback).toBe(false);
    });

    it('passes yellow through unchanged', () => {
      const r = resolveFactionOrDiagnosticFallback('yellow', 'test-yellow');
      expect(r.faction).toBe('yellow');
      expect(r.isValid).toBe(true);
      expect(r.usedFallback).toBe(false);
    });

    it('passes purple through unchanged', () => {
      const r = resolveFactionOrDiagnosticFallback('purple', 'test-purple');
      expect(r.faction).toBe('purple');
      expect(r.isValid).toBe(true);
      expect(r.usedFallback).toBe(false);
    });
  });

  describe('resolveFactionOrDiagnosticFallback — missing/invalid factions', () => {
    it('warns once and returns diagnostic cyan for undefined faction', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = resolveFactionOrDiagnosticFallback(undefined, 'test-undefined');

      expect(r.faction).toBe('cyan');
      expect(r.isValid).toBe(false);
      expect(r.usedFallback).toBe(true);
      expect(r.originalValue).toBe(undefined);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('test-undefined');
      expect(warnSpy.mock.calls[0][0]).toContain('undefined');
      warnSpy.mockRestore();
    });

    it('warns once and returns diagnostic cyan for null faction', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = resolveFactionOrDiagnosticFallback(null, 'test-null');

      expect(r.faction).toBe('cyan');
      expect(r.usedFallback).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it('warns once and returns diagnostic cyan for invalid string faction', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = resolveFactionOrDiagnosticFallback('red', 'test-invalid-string');

      expect(r.faction).toBe('cyan');
      expect(r.usedFallback).toBe(true);
      expect(r.originalValue).toBe('red');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('"red"');
      warnSpy.mockRestore();
    });

    it('does NOT warn again for the same context (warn-once per context)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      resolveFactionOrDiagnosticFallback(undefined, 'ctx-A');
      resolveFactionOrDiagnosticFallback(undefined, 'ctx-A');
      resolveFactionOrDiagnosticFallback(undefined, 'ctx-A');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      // Count is still tracked for diagnostics
      expect(getFactionWarningCounts().get('ctx-A')).toBe(3);
      warnSpy.mockRestore();
    });

    it('warns independently for different contexts', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      resolveFactionOrDiagnosticFallback(undefined, 'ctx-A');
      resolveFactionOrDiagnosticFallback(undefined, 'ctx-B');
      resolveFactionOrDiagnosticFallback(undefined, 'ctx-A'); // silent (already warned for ctx-A)

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(getFactionWarningCounts().get('ctx-A')).toBe(2);
      expect(getFactionWarningCounts().get('ctx-B')).toBe(1);
      warnSpy.mockRestore();
    });

    it('resetFactionWarningLedger clears all counts', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      resolveFactionOrDiagnosticFallback(undefined, 'ctx-X');
      expect(getFactionWarningCounts().size).toBe(1);

      resetFactionWarningLedger();
      expect(getFactionWarningCounts().size).toBe(0);

      // After reset, the next invalid call warns again
      resolveFactionOrDiagnosticFallback(undefined, 'ctx-X');
      expect(warnSpy).toHaveBeenCalledTimes(2);
      warnSpy.mockRestore();
    });
  });

  describe('resolveFactionOrDiagnosticFallback — no silent cyan recolor', () => {
    it('a valid faction NEVER triggers the fallback path', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (const f of CANONICAL_FACTIONS) {
        const r = resolveFactionOrDiagnosticFallback(f, 'never-fallback');
        expect(r.usedFallback).toBe(false);
        expect(r.isValid).toBe(true);
        expect(r.faction).toBe(f);
      }

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('the diagnostic fallback is ALWAYS marked via usedFallback=true', () => {
      // This is the core "no silent recolor" guarantee: callers/tests can
      // always distinguish "real cyan" from "diagnostic cyan" via
      // usedFallback === true.
      const r1 = resolveFactionOrDiagnosticFallback(undefined, 'mark-test');
      const r2 = resolveFactionOrDiagnosticFallback('red', 'mark-test');
      const r3 = resolveFactionOrDiagnosticFallback(null, 'mark-test');

      expect(r1.faction).toBe('cyan');
      expect(r1.usedFallback).toBe(true);

      expect(r2.faction).toBe('cyan');
      expect(r2.usedFallback).toBe(true);

      expect(r3.faction).toBe('cyan');
      expect(r3.usedFallback).toBe(true);

      // And a real cyan is NOT marked as fallback
      const r4 = resolveFactionOrDiagnosticFallback('cyan', 'mark-test');
      expect(r4.faction).toBe('cyan');
      expect(r4.usedFallback).toBe(false);
    });
  });
});
