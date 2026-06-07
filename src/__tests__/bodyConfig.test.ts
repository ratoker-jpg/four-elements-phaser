/**
 * Tests for production body config data model.
 *
 * CORE-STEP-02A: Validates config completeness, accepted body count,
 * M0-M3 scaling rules, fixed mass rule, armor fields, localization keys,
 * and footprint class assignments.
 */

import { describe, it, expect } from 'vitest';
import {
  BODY_CONFIGS,
  ALL_ACCEPTED_BODY_IDS,
  getBodyConfig,
  getBodyMLevelValue,
  FOOTPRINT_CLASS_BODIES,
} from '../config/bodyData';
import {
  ACCEPTED_BODY_IDS,
  ACCEPTED_BODY_COUNT,
  MODIFICATION_LEVEL_COUNT,
  type BodyConfig,
  type BodyFootprintClass,
} from '../config/coreMechanicsTypes';
import { LOCALIZED_STRINGS, t } from '../config/localization';

// ─── Body count ──────────────────────────────────────────────────────

describe('body config: accepted body count', () => {
  it('has exactly 7 accepted bodies', () => {
    expect(Object.keys(BODY_CONFIGS)).toHaveLength(7);
  });

  it('ACCEPTED_BODY_COUNT is 7', () => {
    expect(ACCEPTED_BODY_COUNT).toBe(7);
  });

  it('ACCEPTED_BODY_IDS has 7 entries', () => {
    expect(ACCEPTED_BODY_IDS).toHaveLength(7);
  });

  it('ALL_ACCEPTED_BODY_IDS matches BODY_CONFIGS keys', () => {
    expect(ALL_ACCEPTED_BODY_IDS).toEqual(Object.keys(BODY_CONFIGS));
  });
});

// ─── Required fields ─────────────────────────────────────────────────

describe('body config: required fields', () => {
  const REQUIRED_FIELDS: (keyof BodyConfig)[] = [
    'id', 'displayNameKey', 'roleKey',
    'hp', 'mass', 'armor', 'minDamagePercent',
    'maxSpeed', 'acceleration', 'braking', 'bodyTurnSpeed',
    'footprintClass',
  ];

  for (const bodyId of ACCEPTED_BODY_IDS) {
    describe(`body: ${bodyId}`, () => {
      const config = BODY_CONFIGS[bodyId];

      it('config exists', () => {
        expect(config).toBeDefined();
      });

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${String(field)}`, () => {
          expect(config).toHaveProperty(String(field));
          expect((config as unknown as Record<string, unknown>)[String(field)]).not.toBeUndefined();
        });
      }

      it('id matches bodyId', () => {
        expect(config.id).toBe(bodyId);
      });

      it('id is English stable id', () => {
        expect(config.id).toMatch(/^[a-z_]+$/);
      });

      it('displayNameKey is a non-empty string', () => {
        expect(config.displayNameKey).toBeTruthy();
        expect(typeof config.displayNameKey).toBe('string');
      });

      it('roleKey is a non-empty string', () => {
        expect(config.roleKey).toBeTruthy();
        expect(typeof config.roleKey).toBe('string');
      });

      it('footprintClass is a valid BodyFootprintClass', () => {
        const validClasses: BodyFootprintClass[] = ['light', 'medium', 'heavy'];
        expect(validClasses).toContain(config.footprintClass);
      });

      it('mass is positive', () => {
        expect(config.mass).toBeGreaterThan(0);
      });

      it('minDamagePercent is between 0 and 1', () => {
        expect(config.minDamagePercent).toBeGreaterThan(0);
        expect(config.minDamagePercent).toBeLessThanOrEqual(1);
      });
    });
  }
});

// ─── M0-M3 entries ───────────────────────────────────────────────────

describe('body config: M0-M3 data', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    describe(`body: ${bodyId}`, () => {
      const config = BODY_CONFIGS[bodyId];

      it('hp has 4 entries (M0-M3)', () => {
        expect(config.hp).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('armor has 4 entries (M0-M3)', () => {
        expect(config.armor).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('maxSpeed has 4 entries (M0-M3)', () => {
        expect(config.maxSpeed).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('acceleration has 4 entries (M0-M3)', () => {
        expect(config.acceleration).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('braking has 4 entries (M0-M3)', () => {
        expect(config.braking).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('bodyTurnSpeed has 4 entries (M0-M3)', () => {
        expect(config.bodyTurnSpeed).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });
    });
  }
});

// ─── M0-M3 scaling rules ─────────────────────────────────────────────

describe('body config: M0-M3 scaling rules', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    describe(`body: ${bodyId}`, () => {
      const config = BODY_CONFIGS[bodyId];

      it('HP does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.hp.length - 1; i++) {
          expect(config.hp[i]).toBeLessThanOrEqual(config.hp[i + 1]);
        }
      });

      it('armor does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.armor.length - 1; i++) {
          expect(config.armor[i]).toBeLessThanOrEqual(config.armor[i + 1]);
        }
      });

      it('maxSpeed does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.maxSpeed.length - 1; i++) {
          expect(config.maxSpeed[i]).toBeLessThanOrEqual(config.maxSpeed[i + 1]);
        }
      });

      it('acceleration does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.acceleration.length - 1; i++) {
          expect(config.acceleration[i]).toBeLessThanOrEqual(config.acceleration[i + 1]);
        }
      });

      it('braking does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.braking.length - 1; i++) {
          expect(config.braking[i]).toBeLessThanOrEqual(config.braking[i + 1]);
        }
      });

      it('bodyTurnSpeed does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.bodyTurnSpeed.length - 1; i++) {
          expect(config.bodyTurnSpeed[i]).toBeLessThanOrEqual(config.bodyTurnSpeed[i + 1]);
        }
      });

      it('mass is fixed across M0-M3 (not an array)', () => {
        // mass is a single number, not an M-level array
        expect(typeof config.mass).toBe('number');
      });
    });
  }
});

// ─── Fixed mass rule ─────────────────────────────────────────────────

describe('body config: mass is fixed per body (not per M-level)', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    it(`${bodyId} mass is a number, not an array`, () => {
      const config = BODY_CONFIGS[bodyId];
      expect(typeof config.mass).toBe('number');
      expect(Array.isArray(config.mass)).toBe(false);
    });
  }
});

// ─── Armor fields ────────────────────────────────────────────────────

describe('body config: armor fields', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    it(`${bodyId} has armor M0-M3 entries`, () => {
      const config = BODY_CONFIGS[bodyId];
      expect(config.armor).toHaveLength(MODIFICATION_LEVEL_COUNT);
      // All armor values should be non-negative
      for (const val of config.armor) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it(`${bodyId} has minDamagePercent between 0 and 1`, () => {
      const config = BODY_CONFIGS[bodyId];
      expect(config.minDamagePercent).toBeGreaterThan(0);
      expect(config.minDamagePercent).toBeLessThanOrEqual(1);
    });
  }
});

// ─── Armor model: heavy bodies have more armor than light ─────────────

describe('body config: armor hierarchy', () => {
  it('heavy bodies have more M3 armor than medium bodies', () => {
    const heavyArmor = ACCEPTED_BODY_IDS
      .filter((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].footprintClass === 'heavy')
      .map((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].armor[3]);
    const mediumArmor = ACCEPTED_BODY_IDS
      .filter((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].footprintClass === 'medium')
      .map((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].armor[3]);

    const minHeavyArmor = Math.min(...heavyArmor);
    const maxMediumArmor = Math.max(...mediumArmor);
    expect(minHeavyArmor).toBeGreaterThan(maxMediumArmor);
  });

  it('medium bodies have more M3 armor than light bodies', () => {
    const mediumArmor = ACCEPTED_BODY_IDS
      .filter((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].footprintClass === 'medium')
      .map((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].armor[3]);
    const lightArmor = ACCEPTED_BODY_IDS
      .filter((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].footprintClass === 'light')
      .map((id: string) => BODY_CONFIGS[id as keyof typeof BODY_CONFIGS].armor[3]);

    const minMediumArmor = Math.min(...mediumArmor);
    const maxLightArmor = Math.max(...lightArmor);
    expect(minMediumArmor).toBeGreaterThan(maxLightArmor);
  });
});

// ─── Localization keys ───────────────────────────────────────────────

describe('body config: localization keys', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    it(`displayNameKey '${BODY_CONFIGS[bodyId].displayNameKey}' exists in LOCALIZED_STRINGS`, () => {
      const key = BODY_CONFIGS[bodyId].displayNameKey;
      expect(LOCALIZED_STRINGS).toHaveProperty(key);
      expect(t(key)).not.toBe(key);
    });

    it(`roleKey '${BODY_CONFIGS[bodyId].roleKey}' exists in LOCALIZED_STRINGS`, () => {
      const key = BODY_CONFIGS[bodyId].roleKey;
      expect(LOCALIZED_STRINGS).toHaveProperty(key);
      expect(t(key)).not.toBe(key);
    });
  }
});

// ─── Internal ids are English ────────────────────────────────────────

describe('body config: internal ids are English', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    it(`${bodyId} id contains only lowercase English letters`, () => {
      expect(bodyId).toMatch(/^[a-z]+$/);
    });
  }
});

// ─── Footprint class assignments ─────────────────────────────────────

describe('body config: footprint class assignments', () => {
  it('light bodies are wasp and hornet', () => {
    expect(FOOTPRINT_CLASS_BODIES.light).toEqual(['wasp', 'hornet']);
  });

  it('medium bodies are hunter, viking, dictator', () => {
    expect(FOOTPRINT_CLASS_BODIES.medium).toEqual(['hunter', 'viking', 'dictator']);
  });

  it('heavy bodies are titan and mammoth', () => {
    expect(FOOTPRINT_CLASS_BODIES.heavy).toEqual(['titan', 'mammoth']);
  });

  it('every body appears in exactly one footprint class', () => {
    const allInClasses = [
      ...FOOTPRINT_CLASS_BODIES.light,
      ...FOOTPRINT_CLASS_BODIES.medium,
      ...FOOTPRINT_CLASS_BODIES.heavy,
    ];
    expect(allInClasses).toHaveLength(ACCEPTED_BODY_COUNT);
    const unique = new Set(allInClasses);
    expect(unique.size).toBe(ACCEPTED_BODY_COUNT);
  });

  it('footprintClass in config matches FOOTPRINT_CLASS_BODIES', () => {
    for (const [cls, bodyIds] of Object.entries(FOOTPRINT_CLASS_BODIES) as [string, string[]][]) {
      for (const bodyId of bodyIds) {
        expect(BODY_CONFIGS[bodyId as keyof typeof BODY_CONFIGS].footprintClass).toBe(cls);
      }
    }
  });
});

// ─── Body role differences ───────────────────────────────────────────

describe('body config: body roles are distinct', () => {
  it('each body has a unique roleKey', () => {
    const roleKeys = ACCEPTED_BODY_IDS.map(id => BODY_CONFIGS[id].roleKey);
    const unique = new Set(roleKeys);
    expect(unique.size).toBe(ACCEPTED_BODY_COUNT);
  });
});

// ─── Lookup helper ───────────────────────────────────────────────────

describe('getBodyMLevelValue', () => {
  const data = [100, 200, 300, 400] as const;

  it('returns M0 for level 0', () => {
    expect(getBodyMLevelValue(data, 0)).toBe(100);
  });

  it('returns M3 for level 3', () => {
    expect(getBodyMLevelValue(data, 3)).toBe(400);
  });

  it('clamps negative levels to M0', () => {
    expect(getBodyMLevelValue(data, -1)).toBe(100);
  });

  it('clamps levels above 3 to M3', () => {
    expect(getBodyMLevelValue(data, 5)).toBe(400);
  });
});

// ─── getBodyConfig ───────────────────────────────────────────────────

describe('getBodyConfig', () => {
  it('returns config for valid body id', () => {
    const config = getBodyConfig('wasp');
    expect(config).toBeDefined();
    expect(config!.id).toBe('wasp');
  });

  it('returns undefined for unknown body id', () => {
    expect(getBodyConfig('nonexistent')).toBeUndefined();
  });
});
