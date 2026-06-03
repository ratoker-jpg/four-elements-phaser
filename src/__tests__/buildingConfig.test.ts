/**
 * Tests for production building config data model.
 *
 * CORE-STEP-02B: Validates config completeness, HQ rules, buildable buildings,
 * storage deltas, production roles, readiness classes, and localization.
 */

import { describe, it, expect } from 'vitest';
import {
  BUILDING_CONFIGS,
  ALL_ACCEPTED_BUILDING_IDS,
  GAMEPLAY_READY_BUILDING_IDS,
  BUILDABLE_BUILDING_IDS,
  STORAGE_BUILDING_IDS,
  getBuildingConfig,
} from '../config/buildingData';
import {
  ACCEPTED_BUILDING_IDS,
  ACCEPTED_BUILDING_COUNT,
  type BuildingConfig,
  type BuildingReadiness,
  type BuildingCategory,
} from '../config/coreMechanicsTypes';
import { LOCALIZED_STRINGS, t } from '../config/localization';

// ─── Building count ──────────────────────────────────────────────────

describe('building config: accepted count', () => {
  it('has exactly 10 accepted buildings', () => {
    expect(Object.keys(BUILDING_CONFIGS)).toHaveLength(10);
  });

  it('ACCEPTED_BUILDING_COUNT is 10', () => {
    expect(ACCEPTED_BUILDING_COUNT).toBe(10);
  });

  it('ACCEPTED_BUILDING_IDS has 10 entries', () => {
    expect(ACCEPTED_BUILDING_IDS).toHaveLength(10);
  });

  it('ALL_ACCEPTED_BUILDING_IDS matches BUILDING_CONFIGS keys', () => {
    expect(ALL_ACCEPTED_BUILDING_IDS).toEqual(Object.keys(BUILDING_CONFIGS));
  });
});

// ─── Building IDs ────────────────────────────────────────────────────

describe('building config: required core buildings exist', () => {
  const REQUIRED_BUILDINGS = [
    'hq', 'separator', 'raw_storage', 'energy_storage',
    'elements_storage', 'units_factory', 'power_plant',
    'energy_reactor', 'repair_center', 'defense_tower',
  ];

  for (const buildingId of REQUIRED_BUILDINGS) {
    it(`${buildingId} exists in BUILDING_CONFIGS`, () => {
      expect(BUILDING_CONFIGS[buildingId as keyof typeof BUILDING_CONFIGS]).toBeDefined();
    });
  }
});

// ─── Required fields ─────────────────────────────────────────────────

describe('building config: required fields', () => {
  const REQUIRED_FIELDS: (keyof BuildingConfig)[] = [
    'id', 'displayNameKey', 'roleKey', 'category', 'readiness',
    'isStartingBase', 'isBuildable', 'costEnergy', 'costElements',
    'buildTimeMs', 'hp', 'footprintW', 'footprintH', 'visionRadius',
  ];

  for (const buildingId of ACCEPTED_BUILDING_IDS) {
    describe(`building: ${buildingId}`, () => {
      const config = BUILDING_CONFIGS[buildingId];

      it('config exists', () => {
        expect(config).toBeDefined();
      });

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${String(field)}`, () => {
          expect(config).toHaveProperty(String(field));
          expect((config as unknown as Record<string, unknown>)[String(field)]).not.toBeUndefined();
        });
      }

      it('id matches buildingId', () => {
        expect(config.id).toBe(buildingId);
      });

      it('id is English stable id', () => {
        expect(config.id).toMatch(/^[a-z_]+$/);
      });

      it('readiness is a valid BuildingReadiness', () => {
        const validReadiness: BuildingReadiness[] = ['gameplay_ready', 'visual_ready', 'deferred'];
        expect(validReadiness).toContain(config.readiness);
      });

      it('category is a valid BuildingCategory', () => {
        const validCategories: BuildingCategory[] = [
          'core_economy', 'storage', 'production', 'power', 'defense', 'support',
        ];
        expect(validCategories).toContain(config.category);
      });

      it('footprintW and footprintH are positive', () => {
        expect(config.footprintW).toBeGreaterThan(0);
        expect(config.footprintH).toBeGreaterThan(0);
      });

      it('visionRadius is non-negative', () => {
        expect(config.visionRadius).toBeGreaterThanOrEqual(0);
      });
    });
  }
});

// ─── HQ rules ────────────────────────────────────────────────────────

describe('building config: HQ is starting base, not ordinary placeable', () => {
  const hq = BUILDING_CONFIGS.hq;

  it('HQ is starting base', () => {
    expect(hq.isStartingBase).toBe(true);
  });

  it('HQ is NOT buildable', () => {
    expect(hq.isBuildable).toBe(false);
  });

  it('HQ has zero costEnergy', () => {
    expect(hq.costEnergy).toBe(0);
  });

  it('HQ has zero costElements', () => {
    expect(hq.costElements).toBe(0);
  });

  it('HQ has zero buildTimeMs', () => {
    expect(hq.buildTimeMs).toBe(0);
  });

  it('HQ has positive hp', () => {
    expect(hq.hp).toBeGreaterThan(0);
  });

  it('HQ has positive visionRadius', () => {
    expect(hq.visionRadius).toBeGreaterThan(0);
  });

  it('HQ has storageDelta', () => {
    expect(hq.storageDelta).toBeDefined();
  });

  it('HQ has productionRole', () => {
    expect(hq.productionRole).toBeDefined();
  });
});

// ─── Only HQ is starting base ────────────────────────────────────────

describe('building config: only HQ is starting base', () => {
  it('exactly one building has isStartingBase = true', () => {
    const startingBases = ACCEPTED_BUILDING_IDS.filter(
      id => BUILDING_CONFIGS[id].isStartingBase,
    );
    expect(startingBases).toHaveLength(1);
    expect(startingBases[0]).toBe('hq');
  });
});

// ─── Buildable buildings ─────────────────────────────────────────────

describe('building config: buildable buildings', () => {
  it('all buildable buildings have positive costEnergy', () => {
    for (const buildingId of BUILDABLE_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      expect(config.costEnergy).toBeGreaterThan(0);
    }
  });

  it('all buildable buildings have positive buildTimeMs', () => {
    for (const buildingId of BUILDABLE_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      expect(config.buildTimeMs).toBeGreaterThan(0);
    }
  });

  it('all buildable buildings have positive hp', () => {
    for (const buildingId of BUILDABLE_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      expect(config.hp).toBeGreaterThan(0);
    }
  });

  it('non-buildable buildings have zero cost and buildTime', () => {
    const nonBuildable = ACCEPTED_BUILDING_IDS.filter(id => !BUILDING_CONFIGS[id].isBuildable);
    for (const buildingId of nonBuildable) {
      const config = BUILDING_CONFIGS[buildingId];
      expect(config.costEnergy).toBe(0);
      expect(config.costElements).toBe(0);
      expect(config.buildTimeMs).toBe(0);
    }
  });
});

// ─── Storage buildings ───────────────────────────────────────────────

describe('building config: storage buildings', () => {
  it('raw_storage has storageDelta.raw', () => {
    expect(BUILDING_CONFIGS.raw_storage.storageDelta).toBeDefined();
    expect(BUILDING_CONFIGS.raw_storage.storageDelta!.raw).toBeGreaterThan(0);
  });

  it('energy_storage has storageDelta.energy', () => {
    expect(BUILDING_CONFIGS.energy_storage.storageDelta).toBeDefined();
    expect(BUILDING_CONFIGS.energy_storage.storageDelta!.energy).toBeGreaterThan(0);
  });

  it('elements_storage has storageDelta.elements', () => {
    expect(BUILDING_CONFIGS.elements_storage.storageDelta).toBeDefined();
    expect(BUILDING_CONFIGS.elements_storage.storageDelta!.elements).toBeGreaterThan(0);
  });

  it('HQ has storageDelta with all three resources', () => {
    const delta = BUILDING_CONFIGS.hq.storageDelta;
    expect(delta).toBeDefined();
    expect(delta!.raw).toBeGreaterThan(0);
    expect(delta!.energy).toBeGreaterThan(0);
    expect(delta!.elements).toBeGreaterThan(0);
  });

  it('STORAGE_BUILDING_IDS includes all storage buildings', () => {
    expect(STORAGE_BUILDING_IDS).toContain('raw_storage');
    expect(STORAGE_BUILDING_IDS).toContain('energy_storage');
    expect(STORAGE_BUILDING_IDS).toContain('elements_storage');
    expect(STORAGE_BUILDING_IDS).toContain('hq');
  });

  it('non-storage buildings do not have storageDelta', () => {
    const nonStorage = ACCEPTED_BUILDING_IDS.filter(id => !STORAGE_BUILDING_IDS.includes(id as keyof typeof BUILDING_CONFIGS));
    for (const buildingId of nonStorage) {
      expect(BUILDING_CONFIGS[buildingId].storageDelta).toBeUndefined();
    }
  });
});

// ─── Production roles ────────────────────────────────────────────────

describe('building config: production roles', () => {
  it('separator has productionRole.kind = separator', () => {
    expect(BUILDING_CONFIGS.separator.productionRole).toBeDefined();
    expect(BUILDING_CONFIGS.separator.productionRole!.kind).toBe('separator');
  });

  it('separator productionRole describes raw minerals conversion', () => {
    const desc = BUILDING_CONFIGS.separator.productionRole!.description.toLowerCase();
    expect(desc).toContain('raw');
    expect(desc).toContain('energy');
  });

  it('units_factory has productionRole.kind = unit_production', () => {
    expect(BUILDING_CONFIGS.units_factory.productionRole).toBeDefined();
    expect(BUILDING_CONFIGS.units_factory.productionRole!.kind).toBe('unit_production');
  });

  it('power_plant has productionRole.kind = power_generation', () => {
    expect(BUILDING_CONFIGS.power_plant.productionRole).toBeDefined();
    expect(BUILDING_CONFIGS.power_plant.productionRole!.kind).toBe('power_generation');
  });
});

// ─── Readiness classes ───────────────────────────────────────────────

describe('building config: readiness classes', () => {
  it('GAMEPLAY_READY_BUILDING_IDS includes core economy buildings', () => {
    const ready = GAMEPLAY_READY_BUILDING_IDS as readonly string[];
    expect(ready).toContain('hq');
    expect(ready).toContain('separator');
    expect(ready).toContain('raw_storage');
    expect(ready).toContain('energy_storage');
    expect(ready).toContain('elements_storage');
    expect(ready).toContain('units_factory');
    expect(ready).toContain('power_plant');
  });

  it('energy_reactor is visual_ready', () => {
    expect(BUILDING_CONFIGS.energy_reactor.readiness).toBe('visual_ready');
  });

  it('repair_center is deferred', () => {
    expect(BUILDING_CONFIGS.repair_center.readiness).toBe('deferred');
  });

  it('defense_tower is deferred', () => {
    expect(BUILDING_CONFIGS.defense_tower.readiness).toBe('deferred');
  });

  it('visual_ready and deferred buildings are NOT buildable', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      if (config.readiness !== 'gameplay_ready') {
        expect(config.isBuildable).toBe(false);
      }
    }
  });

  it('deferred buildings have zero hp', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId];
      if (config.readiness === 'deferred') {
        expect(config.hp).toBe(0);
      }
    }
  });
});

// ─── Localization keys ───────────────────────────────────────────────

describe('building config: localization keys', () => {
  for (const buildingId of ACCEPTED_BUILDING_IDS) {
    const config = BUILDING_CONFIGS[buildingId];

    it(`displayNameKey '${config.displayNameKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.displayNameKey);
      expect(t(config.displayNameKey)).not.toBe(config.displayNameKey);
    });

    it(`roleKey '${config.roleKey}' exists in LOCALIZED_STRINGS`, () => {
      expect(LOCALIZED_STRINGS).toHaveProperty(config.roleKey);
      expect(t(config.roleKey)).not.toBe(config.roleKey);
    });
  }
});

// ─── No player-facing Matter ─────────────────────────────────────────

describe('building config: no player-facing Matter', () => {
  it('no building displayName contains Материя or Matter', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const displayName = t(BUILDING_CONFIGS[buildingId].displayNameKey);
      expect(displayName).not.toContain('Материя');
      expect(displayName.toLowerCase()).not.toContain('matter');
    }
  });

  it('no building roleKey value contains Материя or Matter', () => {
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const roleText = t(BUILDING_CONFIGS[buildingId].roleKey);
      expect(roleText).not.toContain('Материя');
      expect(roleText.toLowerCase()).not.toContain('matter');
    }
  });
});

// ─── Economy model ───────────────────────────────────────────────────

describe('building config: accepted economy model', () => {
  it('separator description mentions energy conversion (not matter)', () => {
    const desc = BUILDING_CONFIGS.separator.productionRole!.description.toLowerCase();
    expect(desc).toContain('energy');
    expect(desc).not.toContain('matter');
  });

  it('building costs use costEnergy and costElements (not costMatter)', () => {
    // Verify the BuildingConfig type has costEnergy and costElements
    // and does NOT have costMatter as a field
    for (const buildingId of ACCEPTED_BUILDING_IDS) {
      const config = BUILDING_CONFIGS[buildingId] as unknown as Record<string, unknown>;
      expect(config).not.toHaveProperty('costMatter');
      expect(typeof config.costEnergy).toBe('number');
      expect(typeof config.costElements).toBe('number');
    }
  });
});

// ─── Lookup helper ───────────────────────────────────────────────────

describe('getBuildingConfig', () => {
  it('returns config for valid building id', () => {
    const config = getBuildingConfig('separator');
    expect(config).toBeDefined();
    expect(config!.id).toBe('separator');
  });

  it('returns undefined for unknown building id', () => {
    expect(getBuildingConfig('nonexistent')).toBeUndefined();
  });
});
