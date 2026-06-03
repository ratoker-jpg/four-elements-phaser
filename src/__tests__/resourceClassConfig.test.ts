/**
 * Tests for production resource class config data model.
 *
 * CORE-STEP-02B: Validates config completeness, accepted resource class count,
 * amount ordering, infinite modeling, asset keys, and localization.
 */

import { describe, it, expect } from 'vitest';
import {
  RESOURCE_CLASS_CONFIGS,
  ALL_ACCEPTED_RESOURCE_CLASS_IDS,
  FINITE_RESOURCE_CLASS_IDS,
  INFINITE_RESOURCE_CLASS_IDS,
  getResourceClassConfig,
} from '../config/resourceClassData';
import {
  ACCEPTED_RESOURCE_CLASS_IDS,
  ACCEPTED_RESOURCE_CLASS_COUNT,
  type ResourceClassConfig,
} from '../config/coreMechanicsTypes';
import { LOCALIZED_STRINGS, t } from '../config/localization';

// ─── Resource class count ────────────────────────────────────────────

describe('resource class config: accepted count', () => {
  it('has exactly 6 accepted resource classes', () => {
    expect(Object.keys(RESOURCE_CLASS_CONFIGS)).toHaveLength(6);
  });

  it('ACCEPTED_RESOURCE_CLASS_COUNT is 6', () => {
    expect(ACCEPTED_RESOURCE_CLASS_COUNT).toBe(6);
  });

  it('ACCEPTED_RESOURCE_CLASS_IDS has 6 entries', () => {
    expect(ACCEPTED_RESOURCE_CLASS_IDS).toHaveLength(6);
  });

  it('ALL_ACCEPTED_RESOURCE_CLASS_IDS matches RESOURCE_CLASS_CONFIGS keys', () => {
    expect(ALL_ACCEPTED_RESOURCE_CLASS_IDS).toEqual(Object.keys(RESOURCE_CLASS_CONFIGS));
  });
});

// ─── Resource class IDs ──────────────────────────────────────────────

describe('resource class config: ids', () => {
  it('accepted ids are very_poor, poor, medium, rich, very_rich, infinite', () => {
    expect(ACCEPTED_RESOURCE_CLASS_IDS).toEqual([
      'very_poor', 'poor', 'medium', 'rich', 'very_rich', 'infinite',
    ]);
  });

  for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
    it(`${classId} config exists`, () => {
      expect(RESOURCE_CLASS_CONFIGS[classId]).toBeDefined();
    });

    it(`${classId} id matches`, () => {
      expect(RESOURCE_CLASS_CONFIGS[classId].id).toBe(classId);
    });

    it(`${classId} id is English stable id`, () => {
      expect(classId).toMatch(/^[a-z_]+$/);
    });
  }
});

// ─── Required fields ─────────────────────────────────────────────────

describe('resource class config: required fields', () => {
  const REQUIRED_FIELDS: (keyof ResourceClassConfig)[] = [
    'id', 'displayNameKey', 'descriptionKey', 'assetKey',
    'amountMin', 'amountMax', 'isInfinite', 'strategicRole',
    'suggestedPlacementZone', 'footprint',
  ];

  for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
    describe(`resource class: ${classId}`, () => {
      const config = RESOURCE_CLASS_CONFIGS[classId];

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${String(field)}`, () => {
          expect(config).toHaveProperty(String(field));
          expect((config as unknown as Record<string, unknown>)[String(field)]).not.toBeUndefined();
        });
      }

      it('displayNameKey is a non-empty string', () => {
        expect(config.displayNameKey).toBeTruthy();
        expect(typeof config.displayNameKey).toBe('string');
      });

      it('descriptionKey is a non-empty string', () => {
        expect(config.descriptionKey).toBeTruthy();
        expect(typeof config.descriptionKey).toBe('string');
      });

      it('assetKey is a non-empty string', () => {
        expect(config.assetKey).toBeTruthy();
        expect(typeof config.assetKey).toBe('string');
      });

      it('footprint is positive', () => {
        expect(config.footprint).toBeGreaterThan(0);
      });

      it('strategicRole is a non-empty string', () => {
        expect(config.strategicRole).toBeTruthy();
      });
    });
  }
});

// ─── Amount ordering ─────────────────────────────────────────────────

describe('resource class config: amount ranges', () => {
  it('amount ranges are ordered from very_poor to very_rich', () => {
    // For finite classes, amountMin should increase monotonically
    for (let i = 0; i < FINITE_RESOURCE_CLASS_IDS.length - 1; i++) {
      const current = RESOURCE_CLASS_CONFIGS[FINITE_RESOURCE_CLASS_IDS[i]];
      const next = RESOURCE_CLASS_CONFIGS[FINITE_RESOURCE_CLASS_IDS[i + 1]];
      expect(current.amountMax).toBeLessThanOrEqual(next.amountMin);
    }
  });

  it('each finite class has amountMin <= amountMax', () => {
    for (const classId of FINITE_RESOURCE_CLASS_IDS) {
      const config = RESOURCE_CLASS_CONFIGS[classId];
      expect(config.amountMin).toBeLessThanOrEqual(config.amountMax);
    }
  });

  it('all finite classes have positive amounts', () => {
    for (const classId of FINITE_RESOURCE_CLASS_IDS) {
      const config = RESOURCE_CLASS_CONFIGS[classId];
      expect(config.amountMin).toBeGreaterThan(0);
      expect(config.amountMax).toBeGreaterThan(0);
    }
  });
});

// ─── Infinite modeling ───────────────────────────────────────────────

describe('resource class config: infinite is distinctly modeled', () => {
  it('only infinite class has isInfinite = true', () => {
    for (const classId of FINITE_RESOURCE_CLASS_IDS) {
      expect(RESOURCE_CLASS_CONFIGS[classId].isInfinite).toBe(false);
    }
    for (const classId of INFINITE_RESOURCE_CLASS_IDS) {
      expect(RESOURCE_CLASS_CONFIGS[classId].isInfinite).toBe(true);
    }
  });

  it('INFINITE_RESOURCE_CLASS_IDS contains only infinite', () => {
    expect(INFINITE_RESOURCE_CLASS_IDS).toHaveLength(1);
    expect(INFINITE_RESOURCE_CLASS_IDS[0]).toBe('infinite');
  });

  it('FINITE_RESOURCE_CLASS_IDS contains 5 non-infinite classes', () => {
    expect(FINITE_RESOURCE_CLASS_IDS).toHaveLength(5);
  });

  it('infinite has footprint 2 (2x2 deposit)', () => {
    expect(RESOURCE_CLASS_CONFIGS.infinite.footprint).toBe(2);
  });

  it('all finite classes have footprint 1', () => {
    for (const classId of FINITE_RESOURCE_CLASS_IDS) {
      expect(RESOURCE_CLASS_CONFIGS[classId].footprint).toBe(1);
    }
  });

  it('infinite is placed in center zone', () => {
    expect(RESOURCE_CLASS_CONFIGS.infinite.suggestedPlacementZone).toBe('center');
  });
});

// ─── Asset keys ──────────────────────────────────────────────────────

describe('resource class config: asset keys', () => {
  for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
    it(`${classId} assetKey starts with 'resource_industrial_'`, () => {
      expect(RESOURCE_CLASS_CONFIGS[classId].assetKey).toMatch(/^resource_industrial_/);
    });
  }
});

// ─── Localization keys ───────────────────────────────────────────────

describe('resource class config: localization keys', () => {
  for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
    const config = RESOURCE_CLASS_CONFIGS[classId];

    it(`displayNameKey '${config.displayNameKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
    });

    it(`descriptionKey '${config.descriptionKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.descriptionKey);
      expect(t(config.descriptionKey)).not.toBe(config.descriptionKey);
    });

    it(`displayName for ${classId} contains Russian text`, () => {
      const displayName = t(config.displayNameKey);
      // Russian text contains Cyrillic characters
      expect(displayName).toMatch(/[а-яА-ЯёЁ]/);
    });
  }
});

// ─── No player-facing Matter ─────────────────────────────────────────

describe('resource class config: no player-facing Matter', () => {
  it('no displayName contains Материя or matter', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const displayName = t(RESOURCE_CLASS_CONFIGS[classId].displayNameKey);
      expect(displayName).not.toContain('Материя');
      expect(displayName.toLowerCase()).not.toContain('matter');
    }
  });
});

// ─── Lookup helper ───────────────────────────────────────────────────

describe('getResourceClassConfig', () => {
  it('returns config for valid resource class id', () => {
    const config = getResourceClassConfig('medium');
    expect(config).toBeDefined();
    expect(config!.id).toBe('medium');
  });

  it('returns undefined for unknown resource class id', () => {
    expect(getResourceClassConfig('nonexistent')).toBeUndefined();
  });
});
