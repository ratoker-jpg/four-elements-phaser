/**
 * UI settings — pure TypeScript, no Phaser.
 *
 * ARCH-14C: Minimal UI settings persistence.
 * Currently only supports UI Scale (100% / 125% / 150%).
 * Persisted in localStorage under a well-known key.
 *
 * Design decisions:
 * - localStorage only (no cloud, no export).
 * - CSS variable --ui-scale is set on document root by the scene that
 *   reads settings; pure TS helpers here don't touch the DOM.
 * - Phaser canvas/game zoom is NOT changed — only DOM overlays scale.
 */

// ─── Constants ──────────────────────────────────────────────────────

/** localStorage key for UI settings. */
const UI_SETTINGS_KEY = 'four-elements-ui-settings';

/** Supported UI scale percentages. */
export const UI_SCALE_OPTIONS = [100, 125, 150] as const;

/** Type for UI scale values. */
export type UiScaleValue = typeof UI_SCALE_OPTIONS[number];

/** Default UI scale. */
export const DEFAULT_UI_SCALE: UiScaleValue = 100;

// ─── Types ──────────────────────────────────────────────────────────

/** Persisted UI settings. */
export interface UiSettings {
  /** UI scale percentage (100 / 125 / 150). */
  uiScale: UiScaleValue;
}

// ─── Storage abstraction ────────────────────────────────────────────

/** Storage interface (same as saveGame for testability). */
export interface UiSettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): void;
}

/** Default browser localStorage storage. */
const browserStorage: UiSettingsStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      console.warn('[uiSettings] localStorage.setItem failed');
      return false;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
  },
};

let storage: UiSettingsStorage = browserStorage;

/** Set the storage backend (for tests). */
export function setUiSettingsStorage(s: UiSettingsStorage): void {
  storage = s;
}

/** Reset storage to browser default. */
export function resetUiSettingsStorage(): void {
  storage = browserStorage;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Validate a UI scale value. Returns the value if valid, else default. */
export function validateUiScale(value: unknown): UiScaleValue {
  if (typeof value === 'number' && UI_SCALE_OPTIONS.includes(value as UiScaleValue)) {
    return value as UiScaleValue;
  }
  return DEFAULT_UI_SCALE;
}

/** Generate a CSS scale transform value for a given percentage. */
export function uiScaleToCssScale(scale: UiScaleValue): number {
  return scale / 100;
}

// ─── Public API ─────────────────────────────────────────────────────

/** Load UI settings from storage. Returns defaults if not found or corrupted. */
export function loadUiSettings(): UiSettings {
  const raw = storage.getItem(UI_SETTINGS_KEY);
  if (!raw) return { uiScale: DEFAULT_UI_SCALE };

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { uiScale: DEFAULT_UI_SCALE };
    }
    return {
      uiScale: validateUiScale(parsed.uiScale),
    };
  } catch {
    return { uiScale: DEFAULT_UI_SCALE };
  }
}

/** Save UI settings to storage. Returns true on success. */
export function saveUiSettings(settings: UiSettings): boolean {
  const data: UiSettings = {
    uiScale: validateUiScale(settings.uiScale),
  };
  return storage.setItem(UI_SETTINGS_KEY, JSON.stringify(data));
}

/** Apply UI scale to the document root as a CSS variable. */
export function applyUiScale(scale: UiScaleValue): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--ui-scale', String(uiScaleToCssScale(scale)));
}
