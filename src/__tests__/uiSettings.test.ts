/**
 * Tests for UI settings — pure TypeScript, no Phaser.
 *
 * ARCH-14C: Tests for the uiSettings module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setUiSettingsStorage,
  loadUiSettings,
  saveUiSettings,
  validateUiScale,
  uiScaleToCssScale,
  DEFAULT_UI_SCALE,
  UI_SCALE_OPTIONS,
  type UiSettingsStorage,
} from '../state/uiSettings';

// ─── In-memory storage mock ─────────────────────────────────────────

function createMockStorage(): UiSettingsStorage {
  const store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return store[key] ?? null;
    },
    setItem(key: string, value: string): boolean {
      store[key] = value;
      return true;
    },
    removeItem(key: string): void {
      delete store[key];
    },
  };
}

let mockStorage: ReturnType<typeof createMockStorage>;

beforeEach(() => {
  mockStorage = createMockStorage();
  setUiSettingsStorage(mockStorage);
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('validateUiScale', () => {
  it('accepts valid scale values', () => {
    expect(validateUiScale(100)).toBe(100);
    expect(validateUiScale(125)).toBe(125);
    expect(validateUiScale(150)).toBe(150);
  });

  it('returns default for invalid values', () => {
    expect(validateUiScale(0)).toBe(DEFAULT_UI_SCALE);
    expect(validateUiScale(50)).toBe(DEFAULT_UI_SCALE);
    expect(validateUiScale(200)).toBe(DEFAULT_UI_SCALE);
    expect(validateUiScale(-1)).toBe(DEFAULT_UI_SCALE);
    expect(validateUiScale('100')).toBe(DEFAULT_UI_SCALE);
    expect(validateUiScale(null)).toBe(DEFAULT_UI_SCALE);
    expect(validateUiScale(undefined)).toBe(DEFAULT_UI_SCALE);
  });
});

describe('uiScaleToCssScale', () => {
  it('converts percentages to decimal scale', () => {
    expect(uiScaleToCssScale(100)).toBe(1);
    expect(uiScaleToCssScale(125)).toBe(1.25);
    expect(uiScaleToCssScale(150)).toBe(1.5);
  });
});

describe('loadUiSettings', () => {
  it('returns defaults when no settings stored', () => {
    const settings = loadUiSettings();
    expect(settings.uiScale).toBe(DEFAULT_UI_SCALE);
  });

  it('loads valid stored settings', () => {
    saveUiSettings({ uiScale: 150 });
    const settings = loadUiSettings();
    expect(settings.uiScale).toBe(150);
  });

  it('falls back to default for corrupted data', () => {
    mockStorage.setItem('four-elements-ui-settings', 'not-json');
    const settings = loadUiSettings();
    expect(settings.uiScale).toBe(DEFAULT_UI_SCALE);
  });

  it('falls back to default for invalid scale in stored data', () => {
    mockStorage.setItem('four-elements-ui-settings', JSON.stringify({ uiScale: 999 }));
    const settings = loadUiSettings();
    expect(settings.uiScale).toBe(DEFAULT_UI_SCALE);
  });

  it('falls back to default for null stored data', () => {
    mockStorage.setItem('four-elements-ui-settings', JSON.stringify(null));
    const settings = loadUiSettings();
    expect(settings.uiScale).toBe(DEFAULT_UI_SCALE);
  });
});

describe('saveUiSettings', () => {
  it('saves valid settings', () => {
    const result = saveUiSettings({ uiScale: 125 });
    expect(result).toBe(true);
    const loaded = loadUiSettings();
    expect(loaded.uiScale).toBe(125);
  });

  it('normalizes invalid scale to default before saving', () => {
    saveUiSettings({ uiScale: 999 as any });
    const loaded = loadUiSettings();
    expect(loaded.uiScale).toBe(DEFAULT_UI_SCALE);
  });

  it('returns false when storage write fails', () => {
    const failingStorage: UiSettingsStorage = {
      getItem(): string | null { return null; },
      setItem(): boolean { return false; },
      removeItem(): void {},
    };
    setUiSettingsStorage(failingStorage);
    const result = saveUiSettings({ uiScale: 125 });
    expect(result).toBe(false);
  });
});

describe('UI_SCALE_OPTIONS', () => {
  it('contains expected values', () => {
    expect(UI_SCALE_OPTIONS).toEqual([100, 125, 150]);
  });
});
