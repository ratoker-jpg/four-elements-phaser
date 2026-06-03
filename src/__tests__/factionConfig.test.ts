/**
 * Tests for production faction config data model.
 *
 * CORE-STEP-02B: Validates config completeness, accepted faction count,
 * passive bonus model, localization key presence, and no active abilities.
 */

import { describe, it, expect } from 'vitest';
import {
  FACTION_CONFIGS,
  ALL_ACCEPTED_FACTION_IDS,
  getFactionConfig,
  BONUS_KIND_TO_FACTION,
} from '../config/factionData';
import {
  ACCEPTED_FACTION_IDS,
  ACCEPTED_FACTION_COUNT,
  type FactionConfig,
  type FactionBonusKind,
} from '../config/coreMechanicsTypes';
import { LOCALIZED_STRINGS, t } from '../config/localization';

// ─── Faction count ───────────────────────────────────────────────────

describe('faction config: accepted faction count', () => {
  it('has exactly 4 accepted factions', () => {
    expect(Object.keys(FACTION_CONFIGS)).toHaveLength(4);
  });

  it('ACCEPTED_FACTION_COUNT is 4', () => {
    expect(ACCEPTED_FACTION_COUNT).toBe(4);
  });

  it('ACCEPTED_FACTION_IDS has 4 entries', () => {
    expect(ACCEPTED_FACTION_IDS).toHaveLength(4);
  });

  it('ALL_ACCEPTED_FACTION_IDS matches FACTION_CONFIGS keys', () => {
    expect(ALL_ACCEPTED_FACTION_IDS).toEqual(Object.keys(FACTION_CONFIGS));
  });
});

// ─── Faction IDs ─────────────────────────────────────────────────────

describe('faction config: faction ids', () => {
  it('accepted ids are cyan, green, yellow, purple', () => {
    expect(ACCEPTED_FACTION_IDS).toEqual(['cyan', 'green', 'yellow', 'purple']);
  });

  for (const factionId of ACCEPTED_FACTION_IDS) {
    it(`${factionId} config exists`, () => {
      expect(FACTION_CONFIGS[factionId]).toBeDefined();
    });

    it(`${factionId} id matches`, () => {
      expect(FACTION_CONFIGS[factionId].id).toBe(factionId);
    });

    it(`${factionId} id is English stable id`, () => {
      expect(FACTION_CONFIGS[factionId].id).toMatch(/^[a-z]+$/);
    });
  }
});

// ─── Required fields ─────────────────────────────────────────────────

describe('faction config: required fields', () => {
  const REQUIRED_FIELDS: (keyof FactionConfig)[] = [
    'id', 'displayNameKey', 'colorSubtitleKey', 'bonusDescriptionKey',
    'roleKey', 'primaryColor', 'primaryColorNum', 'passiveBonus',
  ];

  for (const factionId of ACCEPTED_FACTION_IDS) {
    describe(`faction: ${factionId}`, () => {
      const config = FACTION_CONFIGS[factionId];

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

      it('primaryColor is a valid CSS hex color', () => {
        expect(config.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
      });

      it('primaryColorNum is a number', () => {
        expect(typeof config.primaryColorNum).toBe('number');
      });
    });
  }
});

// ─── Passive bonus model ─────────────────────────────────────────────

describe('faction config: passive bonus model', () => {
  for (const factionId of ACCEPTED_FACTION_IDS) {
    describe(`faction: ${factionId}`, () => {
      const config = FACTION_CONFIGS[factionId];

      it('has passiveBonus field', () => {
        expect(config.passiveBonus).toBeDefined();
      });

      it('passiveBonus.kind is a valid FactionBonusKind', () => {
        const validKinds: FactionBonusKind[] = [
          'mobility_tempo', 'building_economy', 'combat_production', 'vision_territory',
        ];
        expect(validKinds).toContain(config.passiveBonus.kind);
      });

      it('passiveBonus.effects exists and has at least one concrete effect', () => {
        expect(config.passiveBonus.effects).toBeDefined();
        const effectValues = Object.values(config.passiveBonus.effects).filter(
          v => v !== undefined,
        );
        expect(effectValues.length).toBeGreaterThanOrEqual(1);
      });
    });
  }

  it('each faction has a unique bonus kind', () => {
    const kinds = ACCEPTED_FACTION_IDS.map(id => FACTION_CONFIGS[id].passiveBonus.kind);
    const unique = new Set(kinds);
    expect(unique.size).toBe(ACCEPTED_FACTION_COUNT);
  });

  it('BONUS_KIND_TO_FACTION maps each kind to correct faction', () => {
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const kind = FACTION_CONFIGS[factionId].passiveBonus.kind;
      expect(BONUS_KIND_TO_FACTION[kind]).toBe(factionId);
    }
  });
});

// ─── Concrete passive bonus effects ──────────────────────────────────

describe('faction config: concrete passive bonus effects', () => {
  it('cyan has civilUnitProductionSpeedMultiplier > 1', () => {
    const effects = FACTION_CONFIGS.cyan.passiveBonus.effects;
    expect(effects.civilUnitProductionSpeedMultiplier).toBeDefined();
    expect(effects.civilUnitProductionSpeedMultiplier!).toBeGreaterThan(1);
  });

  it('green has buildingSpeedMultiplier > 1', () => {
    const effects = FACTION_CONFIGS.green.passiveBonus.effects;
    expect(effects.buildingSpeedMultiplier).toBeDefined();
    expect(effects.buildingSpeedMultiplier!).toBeGreaterThan(1);
  });

  it('green has processingSpeedMultiplier > 1', () => {
    const effects = FACTION_CONFIGS.green.passiveBonus.effects;
    expect(effects.processingSpeedMultiplier).toBeDefined();
    expect(effects.processingSpeedMultiplier!).toBeGreaterThan(1);
  });

  it('yellow has combatUnitProductionSpeedMultiplier > 1', () => {
    const effects = FACTION_CONFIGS.yellow.passiveBonus.effects;
    expect(effects.combatUnitProductionSpeedMultiplier).toBeDefined();
    expect(effects.combatUnitProductionSpeedMultiplier!).toBeGreaterThan(1);
  });

  it('purple has territoryVisionRadiusBonus > 0', () => {
    const effects = FACTION_CONFIGS.purple.passiveBonus.effects;
    expect(effects.territoryVisionRadiusBonus).toBeDefined();
    expect(effects.territoryVisionRadiusBonus!).toBeGreaterThan(0);
  });

  it('no faction relies only on a generic multiplier field', () => {
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const bonus = FACTION_CONFIGS[factionId].passiveBonus as unknown as Record<string, unknown>;
      // Ensure there is no bare 'multiplier' field at the passiveBonus level
      expect(bonus).not.toHaveProperty('multiplier');
    }
  });
});

// ─── No active abilities ─────────────────────────────────────────────

describe('faction config: no active abilities or tech trees', () => {
  for (const factionId of ACCEPTED_FACTION_IDS) {
    it(`${factionId} does NOT have activeAbilities field`, () => {
      const config = FACTION_CONFIGS[factionId] as unknown as Record<string, unknown>;
      expect(config).not.toHaveProperty('activeAbilities');
    });

    it(`${factionId} does NOT have techTree field`, () => {
      const config = FACTION_CONFIGS[factionId] as unknown as Record<string, unknown>;
      expect(config).not.toHaveProperty('techTree');
    });
  }
});

// ─── Localization keys ───────────────────────────────────────────────

describe('faction config: localization keys', () => {
  for (const factionId of ACCEPTED_FACTION_IDS) {
    const config = FACTION_CONFIGS[factionId];

    it(`displayNameKey '${config.displayNameKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
    });

    it(`colorSubtitleKey '${config.colorSubtitleKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.colorSubtitleKey);
      expect(t(config.colorSubtitleKey)).not.toBe(config.colorSubtitleKey);
    });

    it(`bonusDescriptionKey '${config.bonusDescriptionKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.bonusDescriptionKey);
      expect(t(config.bonusDescriptionKey)).not.toBe(config.bonusDescriptionKey);
    });

    it(`roleKey '${config.roleKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.roleKey);
      expect(t(config.roleKey)).not.toBe(config.roleKey);
    });
  }
});

// ─── Lookup helper ───────────────────────────────────────────────────

describe('getFactionConfig', () => {
  it('returns config for valid faction id', () => {
    const config = getFactionConfig('cyan');
    expect(config).toBeDefined();
    expect(config!.id).toBe('cyan');
  });

  it('returns undefined for unknown faction id', () => {
    expect(getFactionConfig('nonexistent')).toBeUndefined();
  });
});
