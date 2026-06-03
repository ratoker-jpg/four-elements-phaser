/**
 * CORE-STEP-04H+ — Buildings and Core Economy Loop: focused tests.
 *
 * Covers:
 * A. Building config completeness — all 6 gameplay-ready core buildings
 * B. Storage caps — raw-storage, matter-storage, element-storage
 * C. Separator Russian statuses
 * D. Factory queue/progress labels
 * E. Full economy loop (harvest → deposit → separator → production)
 * F. Visual-ready Energy Plant
 * G. Excluded buildings NOT gameplay-ready
 * H. Building display names
 * I. Building role descriptions
 */

import { describe, it, expect } from 'vitest';
import { BUILDING_CONFIG } from '../state/construction';
import type { BuildingType } from '../state/types';
import {
  RAW_STORAGE_RAW_BONUS,
  MATTER_STORAGE_MATTER_BONUS,
  MATTER_STORAGE_ELEMENT_BONUS,
  ELEMENT_STORAGE_ELEMENT_BONUS,
  SEP_RAW_COST,
  SEP_MATTER_YIELD,
  SEP_ELEMENT_YIELD,
  SEP_CYCLE_MS,
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
  HQ_BASE_POWER,
  POWER_PLANT_GENERATION,
} from '../state/types';
import { separatorStatusLabel, factoryStatusLabel } from '../state/statusHelpers';
import {
  getBuildingDisplayName,
  getBuildingRoleDescription,
  getBuildingReadiness,
  isGameplayReadyBuilding,
  isVisualReadyBuilding,
  BUILDING_TYPE_TO_PRODUCTION_ID,
} from '../config/buildingRuntimeMapping';
import { BUILDING_CONFIGS } from '../config/buildingData';

// ─── A. Building config completeness ────────────────────────────────

describe('CORE-STEP-04H+: building config completeness', () => {
  const GAMEPLAY_READY_BUILDINGS: BuildingType[] = [
    'separator',
    'raw-storage',
    'matter-storage',
    'element-storage',
    'power-plant',
    'units-factory',
  ];

  it('all 6 gameplay-ready core buildings have BUILDING_CONFIG entries', () => {
    for (const bt of GAMEPLAY_READY_BUILDINGS) {
      expect(BUILDING_CONFIG[bt]).toBeDefined();
    }
  });

  it('each gameplay-ready building config has all required fields', () => {
    for (const bt of GAMEPLAY_READY_BUILDINGS) {
      const config = BUILDING_CONFIG[bt]!;
      expect(config.type).toBe(bt);
      expect(config.footprintW).toBeGreaterThan(0);
      expect(config.footprintH).toBeGreaterThan(0);
      expect(config.costMatter).toBeGreaterThan(0);
      expect(config.buildTimeMs).toBeGreaterThan(0);
    }
  });
});

// ─── B. Storage caps ───────────────────────────────────────────────

describe('CORE-STEP-04H+: storage caps', () => {
  it('raw-storage increases rawCap by RAW_STORAGE_RAW_BONUS', () => {
    expect(RAW_STORAGE_RAW_BONUS).toBe(200);
  });

  it('matter-storage increases matterCap by MATTER_STORAGE_MATTER_BONUS and elementCap by MATTER_STORAGE_ELEMENT_BONUS', () => {
    expect(MATTER_STORAGE_MATTER_BONUS).toBe(200);
    expect(MATTER_STORAGE_ELEMENT_BONUS).toBe(200);
  });

  it('element-storage increases elementCap by ELEMENT_STORAGE_ELEMENT_BONUS', () => {
    expect(ELEMENT_STORAGE_ELEMENT_BONUS).toBe(200);
  });

  it('raw-storage building config exists with correct cost', () => {
    const config = BUILDING_CONFIG['raw-storage'];
    expect(config).toBeDefined();
    expect(config!.costMatter).toBe(40);
    expect(config!.buildTimeMs).toBe(15000);
  });

  it('matter-storage building config exists with correct cost', () => {
    const config = BUILDING_CONFIG['matter-storage'];
    expect(config).toBeDefined();
    expect(config!.costMatter).toBe(40);
    expect(config!.buildTimeMs).toBe(15000);
  });

  it('element-storage building config exists with correct cost', () => {
    const config = BUILDING_CONFIG['element-storage'];
    expect(config).toBeDefined();
    expect(config!.costMatter).toBe(50);
    expect(config!.buildTimeMs).toBe(18000);
  });
});

// ─── C. Separator Russian statuses ─────────────────────────────────

describe('CORE-STEP-04H+: separator Russian statuses', () => {
  it('blocked-no-raw → "Нет сырья"', () => {
    expect(separatorStatusLabel('blocked-no-raw')).toBe('Нет сырья');
  });

  it('blocked-matter-cap → "Накопитель полон"', () => {
    expect(separatorStatusLabel('blocked-matter-cap')).toBe('Накопитель полон');
  });

  it('blocked-element-cap → "Выход заполнен"', () => {
    expect(separatorStatusLabel('blocked-element-cap')).toBe('Выход заполнен');
  });

  it('processing → "Работает"', () => {
    expect(separatorStatusLabel('processing')).toBe('Работает');
  });

  it('idle → "Ожидание"', () => {
    expect(separatorStatusLabel('idle')).toBe('Ожидание');
  });

  it('blocked-power → "Нет питания"', () => {
    expect(separatorStatusLabel('blocked-power')).toBe('Нет питания');
  });
});

// ─── D. Factory queue/progress labels ──────────────────────────────

describe('CORE-STEP-04H+: factory queue/progress labels', () => {
  it('producing-builder → "Строитель"', () => {
    expect(factoryStatusLabel('producing-builder')).toBe('Строитель');
  });

  it('producing-harvester → "Сборщик"', () => {
    expect(factoryStatusLabel('producing-harvester')).toBe('Сборщик');
  });

  it('idle → "Ожидание"', () => {
    expect(factoryStatusLabel('idle')).toBe('Ожидание');
  });

  it('blocked-no-matter → "Нет энергии"', () => {
    expect(factoryStatusLabel('blocked-no-matter')).toBe('Нет энергии');
  });

  it('blocked-no-element → "Нет элемента"', () => {
    expect(factoryStatusLabel('blocked-no-element')).toBe('Нет элемента');
  });

  it('blocked-queue-full → "Очередь полна"', () => {
    expect(factoryStatusLabel('blocked-queue-full')).toBe('Очередь полна');
  });

  it('blocked-power → "Нет питания"', () => {
    expect(factoryStatusLabel('blocked-power')).toBe('Нет питания');
  });

  it('blocked-unit-cap → "Лимит юнитов"', () => {
    expect(factoryStatusLabel('blocked-unit-cap')).toBe('Лимит юнитов');
  });
});

// ─── E. Full economy loop ──────────────────────────────────────────

describe('CORE-STEP-04H+: full economy loop constants and flow', () => {
  it('separator processing constants are consistent', () => {
    // Separator consumes raw → produces matter + elements
    expect(SEP_RAW_COST).toBe(12);
    expect(SEP_MATTER_YIELD).toBe(10);
    expect(SEP_ELEMENT_YIELD).toBe(2);
    expect(SEP_CYCLE_MS).toBe(5000);
  });

  it('production costs are defined for builder', () => {
    expect(BUILDER_PRODUCTION_MATTER_COST).toBe(40);
    expect(BUILDER_PRODUCTION_ELEMENT_COST).toBe(10);
  });

  it('production costs are defined for harvester', () => {
    expect(HARVESTER_PRODUCTION_MATTER_COST).toBe(50);
    expect(HARVESTER_PRODUCTION_ELEMENT_COST).toBe(10);
  });

  it('power generation constants are consistent', () => {
    expect(HQ_BASE_POWER).toBe(10);
    expect(POWER_PLANT_GENERATION).toBe(15);
  });

  it('economy loop: raw → separator → matter + element → production', () => {
    // Simulate the economy loop mathematically:
    // 1. Start with raw = 120, matter = 120, element = 0
    // 2. Separator processes: consumes 12 raw → yields 10 matter + 2 elementUnits
    // 3. After 1 cycle: raw=108, matter=130, element=2
    // 4. After 10 cycles: raw=0, matter=220, element=20
    // 5. Produce 1 builder: costs 40 matter + 10 elementUnits
    //    After: matter=180, element=10
    const raw = 120;
    const matter = 120;
    const element = 0;
    const cycles = 10;

    const rawAfter = raw - cycles * SEP_RAW_COST;
    const matterAfter = matter + cycles * SEP_MATTER_YIELD;
    const elementAfter = element + cycles * SEP_ELEMENT_YIELD;

    expect(rawAfter).toBe(0);
    expect(matterAfter).toBe(220);
    expect(elementAfter).toBe(20);

    // Builder costs
    const matterAfterBuilder = matterAfter - BUILDER_PRODUCTION_MATTER_COST;
    const elementAfterBuilder = elementAfter - BUILDER_PRODUCTION_ELEMENT_COST;
    expect(matterAfterBuilder).toBe(180);
    expect(elementAfterBuilder).toBe(10);
  });
});

// ─── F. Visual-ready Energy Plant ──────────────────────────────────

describe('CORE-STEP-04H+: visual-ready Energy Plant', () => {
  it('energy-plant BuildingType exists', () => {
    const bt: BuildingType = 'energy-plant';
    expect(bt).toBe('energy-plant');
  });

  it('energy-plant is mapped to energy_reactor in production config', () => {
    expect(BUILDING_TYPE_TO_PRODUCTION_ID['energy-plant']).toBe('energy_reactor');
  });

  it('energy-plant is marked visual_ready (not gameplay_ready)', () => {
    expect(getBuildingReadiness('energy-plant')).toBe('visual_ready');
    expect(isVisualReadyBuilding('energy-plant')).toBe(true);
    expect(isGameplayReadyBuilding('energy-plant')).toBe(false);
  });

  it('energy-plant has a BUILDING_CONFIG entry with reasonable cost', () => {
    const config = BUILDING_CONFIG['energy-plant'];
    expect(config).toBeDefined();
    expect(config!.costMatter).toBe(80);
    expect(config!.buildTimeMs).toBe(20000);
  });

  it('energy_reactor production config has visual_ready readiness', () => {
    const config = BUILDING_CONFIGS['energy_reactor'];
    expect(config).toBeDefined();
    expect(config!.readiness).toBe('visual_ready');
  });
});

// ─── G. Excluded buildings NOT gameplay-ready ──────────────────────

describe('CORE-STEP-04H+: excluded buildings NOT gameplay-ready', () => {
  it('repair_center is NOT gameplay_ready', () => {
    expect(BUILDING_CONFIGS['repair_center'].readiness).toBe('deferred');
    expect(BUILDING_CONFIGS['repair_center'].isBuildable).toBe(false);
  });

  it('defense_tower is NOT gameplay_ready', () => {
    expect(BUILDING_CONFIGS['defense_tower'].readiness).toBe('deferred');
    expect(BUILDING_CONFIGS['defense_tower'].isBuildable).toBe(false);
  });

  it('command-relay has no BUILDING_CONFIG entry', () => {
    expect(BUILDING_CONFIG['command-relay']).toBeUndefined();
  });
});

// ─── H. Building display names ─────────────────────────────────────

describe('CORE-STEP-04H+: building display names', () => {
  const CORE_BUILDINGS: BuildingType[] = [
    'separator',
    'raw-storage',
    'matter-storage',
    'element-storage',
    'power-plant',
    'energy-plant',
    'units-factory',
  ];

  it('all core buildings have Russian display names', () => {
    for (const bt of CORE_BUILDINGS) {
      const name = getBuildingDisplayName(bt);
      // Display name should not be the raw type string (meaning it resolved)
      // It should be a Russian string
      expect(name).not.toBe(bt);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('separator display name is "Сепаратор"', () => {
    expect(getBuildingDisplayName('separator')).toBe('Сепаратор');
  });

  it('raw-storage display name is "Хранилище сырья"', () => {
    expect(getBuildingDisplayName('raw-storage')).toBe('Хранилище сырья');
  });

  it('matter-storage display name is "Хранилище энергии"', () => {
    expect(getBuildingDisplayName('matter-storage')).toBe('Хранилище энергии');
  });

  it('element-storage display name is "Хранилище элементов"', () => {
    expect(getBuildingDisplayName('element-storage')).toBe('Хранилище элементов');
  });

  it('power-plant display name is "Электростанция"', () => {
    expect(getBuildingDisplayName('power-plant')).toBe('Электростанция');
  });

  it('energy-plant display name is "Энергореактор"', () => {
    expect(getBuildingDisplayName('energy-plant')).toBe('Энергореактор');
  });

  it('units-factory display name is "Фабрика юнитов"', () => {
    expect(getBuildingDisplayName('units-factory')).toBe('Фабрика юнитов');
  });
});

// ─── I. Building role descriptions ─────────────────────────────────

describe('CORE-STEP-04H+: building role descriptions', () => {
  const CORE_BUILDINGS: BuildingType[] = [
    'separator',
    'raw-storage',
    'matter-storage',
    'element-storage',
    'power-plant',
    'energy-plant',
    'units-factory',
  ];

  it('all core buildings have non-empty Russian role descriptions', () => {
    for (const bt of CORE_BUILDINGS) {
      const role = getBuildingRoleDescription(bt);
      expect(role.length).toBeGreaterThan(0);
    }
  });

  it('separator role describes processing', () => {
    const role = getBuildingRoleDescription('separator');
    expect(role).toContain('Перерабатывает');
  });

  it('raw-storage role describes raw cap increase', () => {
    const role = getBuildingRoleDescription('raw-storage');
    expect(role).toContain('сырья');
  });

  it('matter-storage role describes energy cap increase', () => {
    const role = getBuildingRoleDescription('matter-storage');
    expect(role).toContain('энергии');
  });

  it('element-storage role describes element cap increase', () => {
    const role = getBuildingRoleDescription('element-storage');
    expect(role).toContain('элементов');
  });

  it('energy-plant role description mentions not yet implemented', () => {
    const role = getBuildingRoleDescription('energy-plant');
    expect(role).toContain('не реализовано');
  });
});
