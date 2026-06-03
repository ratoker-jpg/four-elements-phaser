/**
 * Tests for production weapon config data model.
 *
 * CORE-STEP-02A: Validates config completeness, accepted weapon count,
 * Shaft exclusion, M0-M3 scaling rules, and localization key presence.
 */

import { describe, it, expect } from 'vitest';
import {
  WEAPON_CONFIGS,
  ALL_ACCEPTED_WEAPON_IDS,
  getWeaponConfig,
  getWeaponMLevelValue,
} from '../config/weaponData';
import {
  ACCEPTED_WEAPON_IDS,
  ACCEPTED_WEAPON_COUNT,
  MODIFICATION_LEVEL_COUNT,
  type WeaponConfig,
  type WeaponFireType,
  type WeaponRangeClass,
} from '../config/coreMechanicsTypes';
import { LOCALIZED_STRINGS, t } from '../config/localization';

// ─── Weapon count ────────────────────────────────────────────────────

describe('weapon config: accepted weapon count', () => {
  it('has exactly 10 accepted weapons', () => {
    expect(Object.keys(WEAPON_CONFIGS)).toHaveLength(10);
  });

  it('ACCEPTED_WEAPON_COUNT is 10', () => {
    expect(ACCEPTED_WEAPON_COUNT).toBe(10);
  });

  it('ACCEPTED_WEAPON_IDS has 10 entries', () => {
    expect(ACCEPTED_WEAPON_IDS).toHaveLength(10);
  });

  it('ALL_ACCEPTED_WEAPON_IDS matches WEAPON_CONFIGS keys', () => {
    expect(ALL_ACCEPTED_WEAPON_IDS).toEqual(Object.keys(WEAPON_CONFIGS));
  });
});

// ─── Shaft exclusion ─────────────────────────────────────────────────

describe('weapon config: Shaft exclusion', () => {
  it('shaft is not in WEAPON_CONFIGS', () => {
    expect(WEAPON_CONFIGS).not.toHaveProperty('shaft');
  });

  it('shaft is not in ACCEPTED_WEAPON_IDS', () => {
    expect(ACCEPTED_WEAPON_IDS).not.toContain('shaft');
  });

  it('getWeaponConfig returns undefined for shaft', () => {
    expect(getWeaponConfig('shaft')).toBeUndefined();
  });
});

// ─── Required fields ─────────────────────────────────────────────────

describe('weapon config: required fields', () => {
  const REQUIRED_FIELDS: (keyof WeaponConfig)[] = [
    'id', 'displayNameKey', 'fireType', 'rangeClass',
    'minRange', 'idealRange', 'maxRange', 'stopDistance',
    'damage', 'cooldown', 'turretTurnSpeed', 'vfxProfileKey',
  ];

  for (const weaponId of ACCEPTED_WEAPON_IDS) {
    describe(`weapon: ${weaponId}`, () => {
      const config = WEAPON_CONFIGS[weaponId];

      it('config exists', () => {
        expect(config).toBeDefined();
      });

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${String(field)}`, () => {
          expect(config).toHaveProperty(String(field));
          expect((config as unknown as Record<string, unknown>)[String(field)]).not.toBeUndefined();
        });
      }

      it('id matches weaponId', () => {
        expect(config.id).toBe(weaponId);
      });

      it('id is English stable id', () => {
        expect(config.id).toMatch(/^[a-z_]+$/);
      });

      it('fireType is a valid WeaponFireType', () => {
        const validFireTypes: WeaponFireType[] = [
          'cooldown', 'wind_up', 'canister_stream', 'overheat',
          'near_continuous', 'magazine', 'drum',
        ];
        expect(validFireTypes).toContain(config.fireType);
      });

      it('rangeClass is a valid WeaponRangeClass', () => {
        const validRangeClasses: WeaponRangeClass[] = ['short', 'medium', 'long'];
        expect(validRangeClasses).toContain(config.rangeClass);
      });

      it('range fields are non-negative', () => {
        expect(config.minRange).toBeGreaterThanOrEqual(0);
        expect(config.idealRange).toBeGreaterThanOrEqual(0);
        expect(config.maxRange).toBeGreaterThanOrEqual(0);
        expect(config.stopDistance).toBeGreaterThanOrEqual(0);
      });

      it('range fields are ordered: minRange <= idealRange <= maxRange', () => {
        expect(config.minRange).toBeLessThanOrEqual(config.idealRange);
        expect(config.idealRange).toBeLessThanOrEqual(config.maxRange);
      });

      it('stopDistance is within range', () => {
        expect(config.stopDistance).toBeGreaterThanOrEqual(config.minRange);
        expect(config.stopDistance).toBeLessThanOrEqual(config.maxRange);
      });

      it('displayNameKey is a non-empty string', () => {
        expect(config.displayNameKey).toBeTruthy();
        expect(typeof config.displayNameKey).toBe('string');
      });

      it('vfxProfileKey is a non-empty string', () => {
        expect(config.vfxProfileKey).toBeTruthy();
        expect(typeof config.vfxProfileKey).toBe('string');
      });
    });
  }
});

// ─── M0-M3 entries ───────────────────────────────────────────────────

describe('weapon config: M0-M3 data', () => {
  for (const weaponId of ACCEPTED_WEAPON_IDS) {
    describe(`weapon: ${weaponId}`, () => {
      const config = WEAPON_CONFIGS[weaponId];

      it('cooldown has 4 entries (M0-M3)', () => {
        expect(config.cooldown).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('turretTurnSpeed has 4 entries (M0-M3)', () => {
        expect(config.turretTurnSpeed).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('windUp has 4 entries if present', () => {
        if (config.windUp) {
          expect(config.windUp).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('canister fields have 4 entries if present', () => {
        if (config.canister) {
          expect(config.canister.capacity).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.canister.drainPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.canister.regenPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('overheat.heatPerShot has 4 entries if present', () => {
        if (config.overheat) {
          expect(config.overheat.heatPerShot).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.overheat.coolingPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('magazine fields have 4 entries if present', () => {
        if (config.magazine) {
          expect(config.magazine.stockSize).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.magazine.regenPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('drum.delayBetweenVolleysMs has 4 entries if present', () => {
        if (config.drum) {
          expect(config.drum.delayBetweenVolleysMs).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.drum.reloadMs).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('damage.directDamage has 4 entries if present', () => {
        if (config.damage.directDamage) {
          expect(config.damage.directDamage).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('damage.damagePerSecond has 4 entries if present', () => {
        if (config.damage.damagePerSecond) {
          expect(config.damage.damagePerSecond).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });
    });
  }
});

// ─── M0-M3 scaling rules ─────────────────────────────────────────────

describe('weapon config: M0-M3 scaling rules', () => {
  for (const weaponId of ACCEPTED_WEAPON_IDS) {
    describe(`weapon: ${weaponId}`, () => {
      const config = WEAPON_CONFIGS[weaponId];

      it('weapon damage does not decrease from M0 to M3', () => {
        const dmg = config.damage.directDamage ?? config.damage.damagePerSecond;
        expect(dmg).toBeDefined();
        for (let i = 0; i < dmg!.length - 1; i++) {
          expect(dmg![i]).toBeLessThanOrEqual(dmg![i + 1]);
        }
      });

      it('turretTurnSpeed does not decrease from M0 to M3', () => {
        for (let i = 0; i < config.turretTurnSpeed.length - 1; i++) {
          expect(config.turretTurnSpeed[i]).toBeLessThanOrEqual(config.turretTurnSpeed[i + 1]);
        }
      });

      it('cooldown does not increase from M0 to M3 (improves = shorter)', () => {
        for (let i = 0; i < config.cooldown.length - 1; i++) {
          expect(config.cooldown[i]).toBeGreaterThanOrEqual(config.cooldown[i + 1]);
        }
      });
    });
  }
});

// ─── Fire type specific fields ───────────────────────────────────────

describe('weapon config: fire type specific fields', () => {
  it('wind_up weapons have windUp field', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const config = WEAPON_CONFIGS[weaponId];
      if (config.fireType === 'wind_up') {
        expect(config.windUp).toBeDefined();
        expect(config.windUp!.length).toBe(MODIFICATION_LEVEL_COUNT);
      }
    }
  });

  it('canister_stream weapons have canister field', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const config = WEAPON_CONFIGS[weaponId];
      if (config.fireType === 'canister_stream') {
        expect(config.canister).toBeDefined();
      }
    }
  });

  it('overheat weapons have overheat field', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const config = WEAPON_CONFIGS[weaponId];
      if (config.fireType === 'overheat') {
        expect(config.overheat).toBeDefined();
      }
    }
  });

  it('magazine weapons have magazine field', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const config = WEAPON_CONFIGS[weaponId];
      if (config.fireType === 'magazine') {
        expect(config.magazine).toBeDefined();
      }
    }
  });

  it('drum weapons have drum field', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const config = WEAPON_CONFIGS[weaponId];
      if (config.fireType === 'drum') {
        expect(config.drum).toBeDefined();
      }
    }
  });
});

// ─── Localization keys ───────────────────────────────────────────────

describe('weapon config: localization keys', () => {
  for (const weaponId of ACCEPTED_WEAPON_IDS) {
    it(`displayNameKey '${WEAPON_CONFIGS[weaponId].displayNameKey}' exists in LOCALIZED_STRINGS`, () => {
      const key = WEAPON_CONFIGS[weaponId].displayNameKey;
      expect(LOCALIZED_STRINGS).toHaveProperty(key);
      expect(t(key)).not.toBe(key); // t() returns the Russian string, not the key
    });
  }
});

// ─── Railgun-specific rules ──────────────────────────────────────────

describe('weapon config: Railgun-specific rules', () => {
  const railgun = WEAPON_CONFIGS.railgun;

  it('Railgun has slow turret turn speed compared to canister_stream weapons', () => {
    // MECHANICS_DECISIONS: "Railgun M3 turns faster than Railgun M0, but still
    // does not turn like Freeze or Flamethrower." Canister/stream weapons have
    // high turret turn speed by design. Drum/shotgun (Hammer) is short-range
    // but has slow turret by design — not a fair comparison.
    const streamWeapons = ACCEPTED_WEAPON_IDS.filter(
      (id: string) => WEAPON_CONFIGS[id as keyof typeof WEAPON_CONFIGS].fireType === 'canister_stream',
    );
    for (const streamId of streamWeapons) {
      expect(railgun.turretTurnSpeed[3]).toBeLessThan(WEAPON_CONFIGS[streamId].turretTurnSpeed[0]);
    }
  });

  it('Railgun has wind_up fireType', () => {
    expect(railgun.fireType).toBe('wind_up');
  });

  it('Railgun has penetration', () => {
    expect(railgun.damage.penetration).toBe(true);
  });
});

// ─── Lookup helper ───────────────────────────────────────────────────

describe('getWeaponMLevelValue', () => {
  const data = [10, 20, 30, 40] as const;

  it('returns M0 for level 0', () => {
    expect(getWeaponMLevelValue(data, 0)).toBe(10);
  });

  it('returns M3 for level 3', () => {
    expect(getWeaponMLevelValue(data, 3)).toBe(40);
  });

  it('clamps negative levels to M0', () => {
    expect(getWeaponMLevelValue(data, -1)).toBe(10);
  });

  it('clamps levels above 3 to M3', () => {
    expect(getWeaponMLevelValue(data, 5)).toBe(40);
  });
});

// ─── getWeaponConfig ─────────────────────────────────────────────────

describe('getWeaponConfig', () => {
  it('returns config for valid weapon id', () => {
    const config = getWeaponConfig('smoky');
    expect(config).toBeDefined();
    expect(config!.id).toBe('smoky');
  });

  it('returns undefined for unknown weapon id', () => {
    expect(getWeaponConfig('nonexistent')).toBeUndefined();
  });

  it('returns undefined for shaft', () => {
    expect(getWeaponConfig('shaft')).toBeUndefined();
  });
});
