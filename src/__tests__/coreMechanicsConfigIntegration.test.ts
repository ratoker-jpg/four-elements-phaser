/**
 * Cross-config integration tests for production core mechanics config.
 *
 * CORE-STEP-02C: Validates consistency across all production config modules
 * (weapons, bodies, factions, resources, buildings, localization).
 *
 * Sections:
 * A. M0-M3 consistency
 * B. Armor formula integration with body configs
 * C. Cross-config localization
 * D. Cross-config IDs
 * E. Resource/building integration
 * F. Faction config integration
 */

import { describe, it, expect } from 'vitest';
import { WEAPON_CONFIGS, getWeaponConfig } from '../config/weaponData';
import { BODY_CONFIGS, getBodyConfig } from '../config/bodyData';
import { FACTION_CONFIGS, getFactionConfig } from '../config/factionData';
import { RESOURCE_CLASS_CONFIGS, getResourceClassConfig } from '../config/resourceClassData';
import { BUILDING_CONFIGS, getBuildingConfig } from '../config/buildingData';
import { LOCALIZED_STRINGS, t } from '../config/localization';
import { ASSET_KEYS } from '../assets/assetManifest';
import {
  ACCEPTED_WEAPON_IDS,
  ACCEPTED_BODY_IDS,
  ACCEPTED_FACTION_IDS,
  ACCEPTED_RESOURCE_CLASS_IDS,
  ACCEPTED_BUILDING_IDS,
  MODIFICATION_LEVEL_COUNT,
} from '../config/coreMechanicsTypes';
import {
  isNonDecreasingMLevelData,
  isNonIncreasingMLevelData,
} from '../config/m0m3Scaling';
import { calculateArmorReducedDamage } from '../config/armorFormula';

// ═══════════════════════════════════════════════════════════════════════
// A. M0-M3 consistency
// ═══════════════════════════════════════════════════════════════════════

describe('integration: M0-M3 consistency — weapons', () => {
  for (const weaponId of ACCEPTED_WEAPON_IDS) {
    describe(`weapon: ${weaponId}`, () => {
      const config = WEAPON_CONFIGS[weaponId];

      it('every M-level field has exactly 4 values', () => {
        // cooldown
        expect(config.cooldown).toHaveLength(MODIFICATION_LEVEL_COUNT);
        // turretTurnSpeed
        expect(config.turretTurnSpeed).toHaveLength(MODIFICATION_LEVEL_COUNT);
        // optional fields
        if (config.damage.directDamage) {
          expect(config.damage.directDamage).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.damage.damagePerSecond) {
          expect(config.damage.damagePerSecond).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.support) {
          expect(config.support.healPerSecond).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.windUp) {
          expect(config.windUp).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.canister) {
          expect(config.canister.capacity).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.canister.drainPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.canister.regenPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.overheat) {
          expect(config.overheat.heatPerShot).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.overheat.coolingPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.magazine) {
          expect(config.magazine.stockSize).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.magazine.regenPerSec).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
        if (config.drum) {
          expect(config.drum.delayBetweenVolleysMs).toHaveLength(MODIFICATION_LEVEL_COUNT);
          expect(config.drum.reloadMs).toHaveLength(MODIFICATION_LEVEL_COUNT);
        }
      });

      it('damage/heal/turretTurnSpeed is non-decreasing M0→M3', () => {
        // Damage
        const dmg = config.damage.directDamage ?? config.damage.damagePerSecond;
        if (dmg) {
          expect(isNonDecreasingMLevelData(dmg)).toBe(true);
        }
        // Heal (support weapons)
        if (config.support) {
          expect(isNonDecreasingMLevelData(config.support.healPerSecond)).toBe(true);
        }
        // Turret turn speed
        expect(isNonDecreasingMLevelData(config.turretTurnSpeed)).toBe(true);
      });

      it('cooldown/windUp improve in correct direction (non-increasing = faster)', () => {
        expect(isNonIncreasingMLevelData(config.cooldown)).toBe(true);
        if (config.windUp) {
          expect(isNonIncreasingMLevelData(config.windUp)).toBe(true);
        }
      });

      it('canister drain improves (non-increasing = less drain) and regen improves (non-decreasing)', () => {
        if (config.canister) {
          expect(isNonIncreasingMLevelData(config.canister.drainPerSec)).toBe(true);
          expect(isNonDecreasingMLevelData(config.canister.regenPerSec)).toBe(true);
          expect(isNonDecreasingMLevelData(config.canister.capacity)).toBe(true);
        }
      });

      it('overheat heatPerShot improves (non-increasing) and coolingPerSec improves (non-decreasing)', () => {
        if (config.overheat) {
          expect(isNonIncreasingMLevelData(config.overheat.heatPerShot)).toBe(true);
          expect(isNonDecreasingMLevelData(config.overheat.coolingPerSec)).toBe(true);
        }
      });

      it('drum delayBetweenVolleysMs and reloadMs improve (non-increasing)', () => {
        if (config.drum) {
          expect(isNonIncreasingMLevelData(config.drum.delayBetweenVolleysMs)).toBe(true);
          expect(isNonIncreasingMLevelData(config.drum.reloadMs)).toBe(true);
        }
      });

      it('magazine stockSize and regenPerSec improve', () => {
        if (config.magazine) {
          expect(isNonDecreasingMLevelData(config.magazine.stockSize)).toBe(true);
          expect(isNonDecreasingMLevelData(config.magazine.regenPerSec)).toBe(true);
        }
      });
    });
  }
});

describe('integration: M0-M3 consistency — bodies', () => {
  for (const bodyId of ACCEPTED_BODY_IDS) {
    describe(`body: ${bodyId}`, () => {
      const config = BODY_CONFIGS[bodyId];

      it('every M-level field has exactly 4 values', () => {
        expect(config.hp).toHaveLength(MODIFICATION_LEVEL_COUNT);
        expect(config.armor).toHaveLength(MODIFICATION_LEVEL_COUNT);
        expect(config.maxSpeed).toHaveLength(MODIFICATION_LEVEL_COUNT);
        expect(config.acceleration).toHaveLength(MODIFICATION_LEVEL_COUNT);
        expect(config.braking).toHaveLength(MODIFICATION_LEVEL_COUNT);
        expect(config.bodyTurnSpeed).toHaveLength(MODIFICATION_LEVEL_COUNT);
      });

      it('body mass is NOT M-leveled (fixed number)', () => {
        expect(typeof config.mass).toBe('number');
        expect(Number.isFinite(config.mass)).toBe(true);
        // Ensure mass is not an array (not M-leveled)
        expect(Array.isArray(config.mass)).toBe(false);
      });

      it('body footprintClass is NOT M-leveled (fixed string)', () => {
        expect(typeof config.footprintClass).toBe('string');
        expect(['light', 'medium', 'heavy']).toContain(config.footprintClass);
      });

      it('hp, armor, speed, accel, braking, turnSpeed are non-decreasing M0→M3', () => {
        expect(isNonDecreasingMLevelData(config.hp)).toBe(true);
        expect(isNonDecreasingMLevelData(config.armor)).toBe(true);
        expect(isNonDecreasingMLevelData(config.maxSpeed)).toBe(true);
        expect(isNonDecreasingMLevelData(config.acceleration)).toBe(true);
        expect(isNonDecreasingMLevelData(config.braking)).toBe(true);
        expect(isNonDecreasingMLevelData(config.bodyTurnSpeed)).toBe(true);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// B. Armor formula integration with body configs
// ═══════════════════════════════════════════════════════════════════════

describe('integration: armor formula with body configs', () => {
  it('formula matches max(rawDamage - armor, rawDamage * minDamagePercent) for all bodies', () => {
    for (const bodyId of ACCEPTED_BODY_IDS) {
      const body = BODY_CONFIGS[bodyId];
      for (let m = 0; m < MODIFICATION_LEVEL_COUNT; m++) {
        const rawDamage = 50;
        const result = calculateArmorReducedDamage({
          rawDamage,
          armor: body.armor[m],
          minDamagePercent: body.minDamagePercent,
        });
        const expected = Math.max(rawDamage - body.armor[m], rawDamage * body.minDamagePercent);
        expect(result.finalDamage).toBeCloseTo(expected, 10);
      }
    }
  });

  it('Vulcan-style small hits against Mammoth still deal floor damage', () => {
    const mammoth = BODY_CONFIGS.mammoth;
    const vulcanDamage = 5;
    for (let m = 0; m < MODIFICATION_LEVEL_COUNT; m++) {
      const result = calculateArmorReducedDamage({
        rawDamage: vulcanDamage,
        armor: mammoth.armor[m],
        minDamagePercent: mammoth.minDamagePercent,
      });
      expect(result.finalDamage).toBeGreaterThan(0);
      expect(result.hitFloor).toBe(true);
    }
  });

  it('Railgun-style large hit remains useful against heavy armor', () => {
    const titan = BODY_CONFIGS.titan;
    const railgunDamage = 40;
    for (let m = 0; m < MODIFICATION_LEVEL_COUNT; m++) {
      const result = calculateArmorReducedDamage({
        rawDamage: railgunDamage,
        armor: titan.armor[m],
        minDamagePercent: titan.minDamagePercent,
      });
      expect(result.finalDamage).toBeGreaterThan(0);
      // Railgun should deal meaningful damage even against Titan M3
      expect(result.finalDamage).toBeGreaterThan(railgunDamage * titan.minDamagePercent * 0.5);
    }
  });

  it('armor cannot reduce damage below floor for any body', () => {
    for (const bodyId of ACCEPTED_BODY_IDS) {
      const body = BODY_CONFIGS[bodyId];
      const result = calculateArmorReducedDamage({
        rawDamage: 10,
        armor: body.armor[3], // max armor
        minDamagePercent: body.minDamagePercent,
      });
      expect(result.finalDamage).toBeGreaterThanOrEqual(10 * body.minDamagePercent - 0.001);
    }
  });

  it('armor 0 returns raw damage for all bodies at M0', () => {
    for (const bodyId of ACCEPTED_BODY_IDS) {
      const body = BODY_CONFIGS[bodyId];
      const result = calculateArmorReducedDamage({
        rawDamage: 50,
        armor: 0,
        minDamagePercent: body.minDamagePercent,
      });
      expect(result.finalDamage).toBe(50);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C. Cross-config localization
// ═══════════════════════════════════════════════════════════════════════

describe('integration: cross-config localization', () => {
  it('all weapon displayNameKey keys exist in LOCALIZED_STRINGS and resolve', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const key = WEAPON_CONFIGS[weaponId].displayNameKey;
      expect(LOCALIZED_STRINGS).toHaveProperty(key);
      expect(t(key)).not.toBe(key);
    }
  });

  it('all body displayNameKey and roleKey keys exist in LOCALIZED_STRINGS', () => {
    for (const bodyId of ACCEPTED_BODY_IDS) {
      const config = BODY_CONFIGS[bodyId];
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
      expect(LOCALIZED_STRINGS).toHaveProperty(config.roleKey);
      expect(t(config.roleKey)).not.toBe(config.roleKey);
    }
  });

  it('all faction display/role/bonus keys exist in LOCALIZED_STRINGS', () => {
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const config = FACTION_CONFIGS[factionId];
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
      expect(LOCALIZED_STRINGS).toHaveProperty(config.colorSubtitleKey);
      expect(t(config.colorSubtitleKey)).not.toBe(config.colorSubtitleKey);
      expect(LOCALIZED_STRINGS).toHaveProperty(config.bonusDescriptionKey);
      expect(t(config.bonusDescriptionKey)).not.toBe(config.bonusDescriptionKey);
      expect(LOCALIZED_STRINGS).toHaveProperty(config.roleKey);
      expect(t(config.roleKey)).not.toBe(config.roleKey);
    }
  });

  it('all resource class displayNameKey and descriptionKey keys exist in LOCALIZED_STRINGS', () => {
    for (const rcId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const config = RESOURCE_CLASS_CONFIGS[rcId];
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
      expect(LOCALIZED_STRINGS).toHaveProperty(config.descriptionKey);
      expect(t(config.descriptionKey)).not.toBe(config.descriptionKey);
    }
  });

  it('all building displayNameKey and roleKey keys exist in LOCALIZED_STRINGS', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
      expect(LOCALIZED_STRINGS).toHaveProperty(config.roleKey);
      expect(t(config.roleKey)).not.toBe(config.roleKey);
    }
  });

  it('no config display/role/description key resolves to the key itself', () => {
    const allKeys: string[] = [];
    for (const w of ACCEPTED_WEAPON_IDS) allKeys.push(WEAPON_CONFIGS[w].displayNameKey);
    for (const b of ACCEPTED_BODY_IDS) {
      allKeys.push(BODY_CONFIGS[b].displayNameKey);
      allKeys.push(BODY_CONFIGS[b].roleKey);
    }
    for (const f of ACCEPTED_FACTION_IDS) {
      const fc = FACTION_CONFIGS[f];
      allKeys.push(fc.displayNameKey, fc.colorSubtitleKey, fc.bonusDescriptionKey, fc.roleKey);
    }
    for (const r of ACCEPTED_RESOURCE_CLASS_IDS) {
      allKeys.push(RESOURCE_CLASS_CONFIGS[r].displayNameKey);
      allKeys.push(RESOURCE_CLASS_CONFIGS[r].descriptionKey);
    }
    for (const b of ACCEPTED_BUILDING_IDS) {
      allKeys.push(BUILDING_CONFIGS[b].displayNameKey);
      allKeys.push(BUILDING_CONFIGS[b].roleKey);
    }
    for (const key of allKeys) {
      expect(t(key)).not.toBe(key);
    }
  });

  it('no player-facing "Материя" or "Matter" in new production config localization values', () => {
    const russianStrings = Object.values(LOCALIZED_STRINGS);
    for (const str of russianStrings) {
      expect(str).not.toContain('Материя');
      expect(str).not.toContain('Matter');
      expect(str).not.toContain('matter');
    }
  });

  it('Shaft is still excluded from accepted weapon config', () => {
    expect(ACCEPTED_WEAPON_IDS).not.toContain('shaft');
    expect(getWeaponConfig('shaft')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D. Cross-config IDs
// ═══════════════════════════════════════════════════════════════════════

describe('integration: cross-config IDs', () => {
  it('accepted weapon IDs are stable English ids', () => {
    for (const id of ACCEPTED_WEAPON_IDS) {
      expect(id).toMatch(/^[a-z]+$/);
    }
  });

  it('accepted body IDs are stable English ids', () => {
    for (const id of ACCEPTED_BODY_IDS) {
      expect(id).toMatch(/^[a-z]+$/);
    }
  });

  it('accepted faction IDs are stable English ids', () => {
    for (const id of ACCEPTED_FACTION_IDS) {
      expect(id).toMatch(/^[a-z]+$/);
    }
  });

  it('accepted resource class IDs are stable English ids', () => {
    for (const id of ACCEPTED_RESOURCE_CLASS_IDS) {
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });

  it('accepted building IDs are stable English ids', () => {
    for (const id of ACCEPTED_BUILDING_IDS) {
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });

  it('no duplicate IDs inside each config', () => {
    // Weapons
    const weaponIds = ACCEPTED_WEAPON_IDS;
    expect(new Set(weaponIds).size).toBe(weaponIds.length);
    // Bodies
    const bodyIds = ACCEPTED_BODY_IDS;
    expect(new Set(bodyIds).size).toBe(bodyIds.length);
    // Factions
    const factionIds = ACCEPTED_FACTION_IDS;
    expect(new Set(factionIds).size).toBe(factionIds.length);
    // Resource classes
    const rcIds = ACCEPTED_RESOURCE_CLASS_IDS;
    expect(new Set(rcIds).size).toBe(rcIds.length);
    // Buildings
    const buildingIds = ACCEPTED_BUILDING_IDS;
    expect(new Set(buildingIds).size).toBe(buildingIds.length);
  });

  it('every get*Config helper returns config for valid ids and undefined for unknown', () => {
    // Weapon
    expect(getWeaponConfig('smoky')).toBeDefined();
    expect(getWeaponConfig('nonexistent')).toBeUndefined();
    // Body
    expect(getBodyConfig('hunter')).toBeDefined();
    expect(getBodyConfig('nonexistent')).toBeUndefined();
    // Faction
    expect(getFactionConfig('cyan')).toBeDefined();
    expect(getFactionConfig('nonexistent')).toBeUndefined();
    // Resource class
    expect(getResourceClassConfig('medium')).toBeDefined();
    expect(getResourceClassConfig('nonexistent')).toBeUndefined();
    // Building
    expect(getBuildingConfig('hq')).toBeDefined();
    expect(getBuildingConfig('nonexistent')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// E. Resource/building integration
// ═══════════════════════════════════════════════════════════════════════

describe('integration: resource class asset keys', () => {
  it('resource class asset keys exist as strings matching accepted industrial naming', () => {
    for (const rcId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const config = RESOURCE_CLASS_CONFIGS[rcId];
      expect(config.assetKey).toMatch(/^resource_industrial_[a-z0-9_]+_\d+$/);
    }
  });

  it('resource class asset keys are present in ASSET_KEYS', () => {
    const assetKeyValues = Object.values(ASSET_KEYS);
    for (const rcId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const config = RESOURCE_CLASS_CONFIGS[rcId];
      expect(assetKeyValues).toContain(config.assetKey);
    }
  });
});

describe('integration: building storage and cost fields', () => {
  it('building storageDelta fields refer only to accepted resource buckets: raw, energy, elements', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      if (config.storageDelta) {
        const keys = Object.keys(config.storageDelta);
        for (const key of keys) {
          expect(['raw', 'energy', 'elements']).toContain(key);
        }
      }
    }
  });

  it('building costs use energy/elements, not matter', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      // BuildingConfig has costEnergy and costElements, no costMatter field
      expect(config).not.toHaveProperty('costMatter');
      expect(typeof config.costEnergy).toBe('number');
      expect(typeof config.costElements).toBe('number');
    }
  });

  it('HQ is starting base and not buildable', () => {
    const hq = BUILDING_CONFIGS.hq;
    expect(hq.isStartingBase).toBe(true);
    expect(hq.isBuildable).toBe(false);
    expect(hq.costEnergy).toBe(0);
    expect(hq.costElements).toBe(0);
  });

  it('only HQ is starting base', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      if (buildingId === 'hq') continue;
      expect(BUILDING_CONFIGS[buildingId].isStartingBase).toBe(false);
    }
  });

  it('infinite resource is distinct and center/2x2', () => {
    const infinite = RESOURCE_CLASS_CONFIGS.infinite;
    expect(infinite.isInfinite).toBe(true);
    expect(infinite.suggestedPlacementZone).toBe('center');
    expect(infinite.footprint).toBe(2);
  });

  it('only infinite resource has isInfinite=true', () => {
    for (const rcId of ACCEPTED_RESOURCE_CLASS_IDS) {
      if (rcId === 'infinite') continue;
      expect(RESOURCE_CLASS_CONFIGS[rcId].isInfinite).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F. Faction config integration
// ═══════════════════════════════════════════════════════════════════════

describe('integration: faction config integration', () => {
  it('every faction has concrete passiveBonus.effects', () => {
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const config = FACTION_CONFIGS[factionId];
      expect(config.passiveBonus.effects).toBeDefined();
      const effectValues = Object.values(config.passiveBonus.effects).filter(v => v !== undefined);
      expect(effectValues.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('no faction uses generic multiplier field', () => {
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const bonus = FACTION_CONFIGS[factionId].passiveBonus as unknown as Record<string, unknown>;
      expect(bonus).not.toHaveProperty('multiplier');
    }
  });

  it('no activeAbilities / techTree fields on any faction', () => {
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const config = FACTION_CONFIGS[factionId] as unknown as Record<string, unknown>;
      expect(config).not.toHaveProperty('activeAbilities');
      expect(config).not.toHaveProperty('techTree');
    }
  });

  it('faction ids remain cyan/green/yellow/purple', () => {
    expect(ACCEPTED_FACTION_IDS).toEqual(['cyan', 'green', 'yellow', 'purple']);
  });

  it('faction display keys match accepted Russian names', () => {
    const expectedNames: Record<string, string> = {
      cyan: 'Поток',
      green: 'Росток',
      yellow: 'Искра',
      purple: 'Око',
    };
    for (const factionId of ACCEPTED_FACTION_IDS) {
      const config = FACTION_CONFIGS[factionId];
      expect(t(config.displayNameKey)).toBe(expectedNames[factionId]);
    }
  });
});
