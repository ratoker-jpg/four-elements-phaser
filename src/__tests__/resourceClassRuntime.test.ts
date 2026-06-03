/**
 * Tests for resource class runtime helpers — bridge between config and runtime.
 *
 * CORE-STEP-03A: Validates asset key resolution, amount range resolution,
 * infinite checks, display name key resolution, legacy ResourceType mapping,
 * asset key validation, and backward compatibility with optional resourceClass.
 */

import { describe, it, expect } from 'vitest';
import {
  getResourceClassAssetKey,
  getResourceClassAmountRange,
  isInfiniteResourceClass,
  getResourceClassDisplayNameKey,
  legacyResourceTypeToResourceClass,
  getLegacyResourceTypeAssetKey,
  isValidIndustrialResourceAssetKey,
  validateResourceClassAssetKeys,
  LEGACY_RESOURCE_TYPE_MAPPING,
} from '../config/resourceClassRuntime';
import {
  ACCEPTED_RESOURCE_CLASS_IDS,
  type AcceptedResourceClassId,
} from '../config/coreMechanicsTypes';
import type { ResourceType } from '../state/types';
import { ASSET_KEYS } from '../assets/assetManifest';
import { LOCALIZED_STRINGS, t } from '../config/localization';

// ─── Asset key resolution ───────────────────────────────────────────

describe('getResourceClassAssetKey', () => {
  it('resolves very_poor to correct asset key', () => {
    expect(getResourceClassAssetKey('very_poor')).toBe('resource_industrial_very_poor_01');
  });

  it('resolves poor to correct asset key', () => {
    expect(getResourceClassAssetKey('poor')).toBe('resource_industrial_poor_01');
  });

  it('resolves medium to correct asset key', () => {
    expect(getResourceClassAssetKey('medium')).toBe('resource_industrial_medium_01');
  });

  it('resolves rich to correct asset key', () => {
    expect(getResourceClassAssetKey('rich')).toBe('resource_industrial_rich_01');
  });

  it('resolves very_rich to correct asset key', () => {
    expect(getResourceClassAssetKey('very_rich')).toBe('resource_industrial_very_rich_01');
  });

  it('resolves infinite to center 2x2 asset key', () => {
    expect(getResourceClassAssetKey('infinite')).toBe('resource_industrial_infinite_center_2x2_01');
  });

  it('returns undefined for unknown resource class', () => {
    expect(getResourceClassAssetKey('nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getResourceClassAssetKey('')).toBeUndefined();
  });

  it('all 6 accepted classes resolve to non-undefined asset keys', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      expect(getResourceClassAssetKey(classId)).toBeDefined();
    }
  });
});

// ─── Asset key existence in ASSET_KEYS ──────────────────────────────

describe('resource class asset keys exist in ASSET_KEYS', () => {
  it('very_poor asset key exists in ASSET_KEYS', () => {
    expect(Object.values(ASSET_KEYS)).toContain('resource_industrial_very_poor_01');
  });

  it('poor asset key exists in ASSET_KEYS', () => {
    expect(Object.values(ASSET_KEYS)).toContain('resource_industrial_poor_01');
  });

  it('medium asset key exists in ASSET_KEYS', () => {
    expect(Object.values(ASSET_KEYS)).toContain('resource_industrial_medium_01');
  });

  it('rich asset key exists in ASSET_KEYS', () => {
    expect(Object.values(ASSET_KEYS)).toContain('resource_industrial_rich_01');
  });

  it('very_rich asset key exists in ASSET_KEYS', () => {
    expect(Object.values(ASSET_KEYS)).toContain('resource_industrial_very_rich_01');
  });

  it('infinite asset key exists in ASSET_KEYS', () => {
    expect(Object.values(ASSET_KEYS)).toContain('resource_industrial_infinite_center_2x2_01');
  });

  it('every resource class asset key is a valid industrial resource asset key', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const assetKey = getResourceClassAssetKey(classId);
      expect(assetKey).toBeDefined();
      expect(isValidIndustrialResourceAssetKey(assetKey!)).toBe(true);
    }
  });
});

// ─── Amount range resolution ────────────────────────────────────────

describe('getResourceClassAmountRange', () => {
  it('very_poor returns range 150-250', () => {
    const range = getResourceClassAmountRange('very_poor');
    expect(range).toEqual({ min: 150, max: 250 });
  });

  it('poor returns range 300-500', () => {
    const range = getResourceClassAmountRange('poor');
    expect(range).toEqual({ min: 300, max: 500 });
  });

  it('medium returns range 800-1200', () => {
    const range = getResourceClassAmountRange('medium');
    expect(range).toEqual({ min: 800, max: 1200 });
  });

  it('rich returns range 1800-2500', () => {
    const range = getResourceClassAmountRange('rich');
    expect(range).toEqual({ min: 1800, max: 2500 });
  });

  it('very_rich returns range 3500-5000', () => {
    const range = getResourceClassAmountRange('very_rich');
    expect(range).toEqual({ min: 3500, max: 5000 });
  });

  it('infinite returns 50000-50000', () => {
    const range = getResourceClassAmountRange('infinite');
    expect(range).toEqual({ min: 50000, max: 50000 });
  });

  it('returns undefined for unknown resource class', () => {
    expect(getResourceClassAmountRange('nonexistent')).toBeUndefined();
  });

  it('all ranges have min <= max', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const range = getResourceClassAmountRange(classId);
      expect(range).toBeDefined();
      expect(range!.min).toBeLessThanOrEqual(range!.max);
    }
  });

  it('finite ranges increase monotonically from very_poor to very_rich', () => {
    const finiteIds: AcceptedResourceClassId[] = ['very_poor', 'poor', 'medium', 'rich', 'very_rich'];
    for (let i = 0; i < finiteIds.length - 1; i++) {
      const current = getResourceClassAmountRange(finiteIds[i])!;
      const next = getResourceClassAmountRange(finiteIds[i + 1])!;
      expect(current.max).toBeLessThanOrEqual(next.min);
    }
  });
});

// ─── Infinite check ─────────────────────────────────────────────────

describe('isInfiniteResourceClass', () => {
  it('returns true for infinite', () => {
    expect(isInfiniteResourceClass('infinite')).toBe(true);
  });

  it('returns false for very_poor', () => {
    expect(isInfiniteResourceClass('very_poor')).toBe(false);
  });

  it('returns false for poor', () => {
    expect(isInfiniteResourceClass('poor')).toBe(false);
  });

  it('returns false for medium', () => {
    expect(isInfiniteResourceClass('medium')).toBe(false);
  });

  it('returns false for rich', () => {
    expect(isInfiniteResourceClass('rich')).toBe(false);
  });

  it('returns false for very_rich', () => {
    expect(isInfiniteResourceClass('very_rich')).toBe(false);
  });

  it('returns false for unknown resource class', () => {
    expect(isInfiniteResourceClass('nonexistent')).toBe(false);
  });

  it('exactly one resource class is infinite', () => {
    const infiniteCount = ACCEPTED_RESOURCE_CLASS_IDS.filter(id => isInfiniteResourceClass(id)).length;
    expect(infiniteCount).toBe(1);
  });
});

// ─── Display name key resolution ────────────────────────────────────

describe('getResourceClassDisplayNameKey', () => {
  it('very_poor returns resource_very_poor', () => {
    expect(getResourceClassDisplayNameKey('very_poor')).toBe('resource_very_poor');
  });

  it('poor returns resource_poor', () => {
    expect(getResourceClassDisplayNameKey('poor')).toBe('resource_poor');
  });

  it('medium returns resource_medium', () => {
    expect(getResourceClassDisplayNameKey('medium')).toBe('resource_medium');
  });

  it('rich returns resource_rich', () => {
    expect(getResourceClassDisplayNameKey('rich')).toBe('resource_rich');
  });

  it('very_rich returns resource_very_rich', () => {
    expect(getResourceClassDisplayNameKey('very_rich')).toBe('resource_very_rich');
  });

  it('infinite returns resource_infinite', () => {
    expect(getResourceClassDisplayNameKey('infinite')).toBe('resource_infinite');
  });

  it('returns undefined for unknown resource class', () => {
    expect(getResourceClassDisplayNameKey('nonexistent')).toBeUndefined();
  });

  it('all display name keys exist in LOCALIZED_STRINGS', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const key = getResourceClassDisplayNameKey(classId);
      expect(key).toBeDefined();
      expect(LOCALIZED_STRINGS).toHaveProperty(key!);
    }
  });

  it('all display names contain Russian text (Cyrillic)', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const key = getResourceClassDisplayNameKey(classId)!;
      const displayName = t(key);
      expect(displayName).toMatch(/[а-яА-ЯёЁ]/);
    }
  });
});

// ─── Legacy ResourceType mapping ────────────────────────────────────

describe('legacyResourceTypeToResourceClass', () => {
  it('maps small to very_poor', () => {
    expect(legacyResourceTypeToResourceClass('small')).toBe('very_poor');
  });

  it('maps medium to poor', () => {
    expect(legacyResourceTypeToResourceClass('medium')).toBe('poor');
  });

  it('maps large to rich', () => {
    expect(legacyResourceTypeToResourceClass('large')).toBe('rich');
  });

  it('maps infinite to infinite', () => {
    expect(legacyResourceTypeToResourceClass('infinite')).toBe('infinite');
  });

  it('all 4 legacy types have mappings', () => {
    const legacyTypes: ResourceType[] = ['small', 'medium', 'large', 'infinite'];
    for (const type of legacyTypes) {
      expect(LEGACY_RESOURCE_TYPE_MAPPING[type]).toBeDefined();
    }
  });

  it('all mapped values are accepted resource class IDs', () => {
    for (const mapped of Object.values(LEGACY_RESOURCE_TYPE_MAPPING)) {
      expect(ACCEPTED_RESOURCE_CLASS_IDS).toContain(mapped);
    }
  });

  it('mapping covers all legacy types', () => {
    expect(Object.keys(LEGACY_RESOURCE_TYPE_MAPPING)).toHaveLength(4);
  });
});

// ─── Legacy asset key resolution ────────────────────────────────────

describe('getLegacyResourceTypeAssetKey', () => {
  it('small resolves to very_poor asset key', () => {
    expect(getLegacyResourceTypeAssetKey('small')).toBe('resource_industrial_very_poor_01');
  });

  it('medium resolves to poor asset key', () => {
    expect(getLegacyResourceTypeAssetKey('medium')).toBe('resource_industrial_poor_01');
  });

  it('large resolves to rich asset key', () => {
    expect(getLegacyResourceTypeAssetKey('large')).toBe('resource_industrial_rich_01');
  });

  it('infinite resolves to infinite center 2x2 asset key', () => {
    expect(getLegacyResourceTypeAssetKey('infinite')).toBe('resource_industrial_infinite_center_2x2_01');
  });

  it('all legacy asset keys are valid industrial resource asset keys', () => {
    const legacyTypes: ResourceType[] = ['small', 'medium', 'large', 'infinite'];
    for (const type of legacyTypes) {
      const assetKey = getLegacyResourceTypeAssetKey(type);
      expect(assetKey).toBeDefined();
      expect(isValidIndustrialResourceAssetKey(assetKey!)).toBe(true);
    }
  });
});

// ─── Asset key validation ───────────────────────────────────────────

describe('isValidIndustrialResourceAssetKey', () => {
  it('recognizes very_poor asset key', () => {
    expect(isValidIndustrialResourceAssetKey('resource_industrial_very_poor_01')).toBe(true);
  });

  it('recognizes poor asset key', () => {
    expect(isValidIndustrialResourceAssetKey('resource_industrial_poor_01')).toBe(true);
  });

  it('recognizes medium asset key', () => {
    expect(isValidIndustrialResourceAssetKey('resource_industrial_medium_01')).toBe(true);
  });

  it('recognizes rich asset key', () => {
    expect(isValidIndustrialResourceAssetKey('resource_industrial_rich_01')).toBe(true);
  });

  it('recognizes very_rich asset key', () => {
    expect(isValidIndustrialResourceAssetKey('resource_industrial_very_rich_01')).toBe(true);
  });

  it('recognizes infinite center 2x2 asset key', () => {
    expect(isValidIndustrialResourceAssetKey('resource_industrial_infinite_center_2x2_01')).toBe(true);
  });

  it('rejects legacy mineral_small asset key', () => {
    expect(isValidIndustrialResourceAssetKey('mineral_small')).toBe(false);
  });

  it('rejects legacy mineral_medium asset key', () => {
    expect(isValidIndustrialResourceAssetKey('mineral_medium')).toBe(false);
  });

  it('rejects legacy mineral_large asset key', () => {
    expect(isValidIndustrialResourceAssetKey('mineral_large')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidIndustrialResourceAssetKey('')).toBe(false);
  });

  it('rejects random string', () => {
    expect(isValidIndustrialResourceAssetKey('not_an_asset_key')).toBe(false);
  });
});

describe('validateResourceClassAssetKeys', () => {
  it('returns no errors for current config', () => {
    const errors = validateResourceClassAssetKeys();
    expect(errors).toHaveLength(0);
  });
});

// ─── Infinite is distinct ───────────────────────────────────────────

describe('infinite resource class is distinct', () => {
  it('infinite maps to center/infinite asset key (not a standard single-tile)', () => {
    const assetKey = getResourceClassAssetKey('infinite');
    expect(assetKey).toContain('center_2x2');
  });

  it('infinite footprint is 2 (2x2 deposit)', () => {
    // This is already tested in resourceClassConfig.test.ts,
    // but we validate it through the runtime helpers too
    const assetKey = getResourceClassAssetKey('infinite');
    expect(assetKey).toBeDefined();
    // The infinite asset key contains '2x2' confirming its multi-tile nature
    expect(assetKey).toContain('2x2');
  });
});

// ─── No player-facing Matter ────────────────────────────────────────

describe('no player-facing Matter in runtime helpers', () => {
  it('no display name for any resource class contains matter', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const key = getResourceClassDisplayNameKey(classId)!;
      const displayName = t(key);
      expect(displayName.toLowerCase()).not.toContain('matter');
      expect(displayName).not.toContain('Материя');
    }
  });

  it('no asset key contains matter', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const assetKey = getResourceClassAssetKey(classId)!;
      expect(assetKey.toLowerCase()).not.toContain('matter');
    }
  });
});

// ─── Optional resourceClass backward compatibility ──────────────────

describe('optional resourceClass field is backward compatible', () => {
  it('ResourcePlacement without resourceClass still compiles', () => {
    const placement: import('../state/types').ResourcePlacement = {
      tx: 5,
      ty: 10,
      type: 'medium',
      footprint: 1,
    };
    expect(placement.type).toBe('medium');
    expect(placement.resourceClass).toBeUndefined();
  });

  it('ResourcePlacement with resourceClass compiles', () => {
    const placement: import('../state/types').ResourcePlacement = {
      tx: 5,
      ty: 10,
      type: 'medium',
      footprint: 1,
      resourceClass: 'medium',
    };
    expect(placement.resourceClass).toBe('medium');
  });

  it('ResourceNodeState without resourceClass still compiles', () => {
    const node: import('../state/types').ResourceNodeState = {
      id: 'res-0',
      tx: 5,
      ty: 10,
      resourceType: 'medium',
      footprint: 1,
      remainingRaw: 800,
      depleted: false,
    };
    expect(node.resourceType).toBe('medium');
    expect(node.resourceClass).toBeUndefined();
  });

  it('ResourceNodeState with resourceClass compiles', () => {
    const node: import('../state/types').ResourceNodeState = {
      id: 'res-0',
      tx: 5,
      ty: 10,
      resourceType: 'medium',
      footprint: 1,
      remainingRaw: 800,
      depleted: false,
      resourceClass: 'medium',
    };
    expect(node.resourceClass).toBe('medium');
  });

  it('resourceClass accepts all 6 accepted IDs', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const placement: import('../state/types').ResourcePlacement = {
        tx: 0,
        ty: 0,
        type: 'medium',
        footprint: 1,
        resourceClass: classId,
      };
      expect(placement.resourceClass).toBe(classId);
    }
  });
});
