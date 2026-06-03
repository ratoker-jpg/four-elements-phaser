/**
 * Localization infrastructure — Russian player-facing UI strings.
 *
 * CORE-STEP-01A: Provides a stable English-key → localized-string map.
 * Russian is the primary language. English keys are internal ids and
 * never displayed to players. English fallback values exist for dev
 * reference only.
 *
 * Design rules:
 * - Internal code ids remain English (cyan, green, yellow, purple, etc.)
 * - Player-facing display strings come from this module
 * - Keys are stable English identifiers
 * - Russian values are the default/primary output
 * - Adding a new string = adding a key to LOCALIZED_STRINGS
 * - Adding a new faction = adding to FACTION_DISPLAY + FACTION_BONUS
 */

import type { Faction } from '../state/types';
import type { GameMode } from '../state/gameSetup';
import type { MapSizeOption } from '../state/generatedMap';

// ─── String key types ────────────────────────────────────────────────

/** All valid localization keys. */
export type LocalizationKey = keyof typeof LOCALIZED_STRINGS;

// ─── Main menu strings ───────────────────────────────────────────────

const MENU_STRINGS = {
  /** Main menu: New Game button */
  menu_newGame: 'Новая игра',
  /** Main menu: Continue button */
  menu_continue: 'Продолжить',
  /** Main menu: Settings button */
  menu_settings: 'Настройки',
  /** Save list: panel title */
  menu_loadGame: 'Загрузить игру',
  /** Save list: empty state */
  menu_noSaves: 'Сохранений нет',
  /** Save list: empty hint */
  menu_noSavesHint: 'Начните новую игру и сохраните, чтобы создать первый слот.',
  /** Save list: Clear All button */
  menu_clearAll: 'Очистить всё',
  /** Save list: Back button */
  menu_back: 'Назад',
  /** Save list: Delete button */
  menu_delete: 'Удалить',
  /** Settings: panel title */
  menu_settingsTitle: 'Настройки',
  /** Settings: UI Scale label */
  menu_uiScale: 'Масштаб интерфейса',
  /** Settings: limitation note */
  menu_uiScaleNote: 'Применяется к DOM-элементам. Масштаб игрового поля не изменяется.',
  /** Delete confirmation */
  menu_deleteConfirm: 'Удалить это сохранение?',
  /** Clear all confirmation */
  menu_clearAllConfirm: 'Удалить все сохранения? Это нельзя отменить.',
} as const;

// ─── Game setup strings ──────────────────────────────────────────────

const SETUP_STRINGS = {
  /** Setup: page title */
  setup_title: 'Новая игра',
  /** Setup: subtitle */
  setup_subtitle: 'Настройте игру',
  /** Setup: Game Mode label */
  setup_gameMode: 'Режим игры',
  /** Setup: Map Size label */
  setup_mapSize: 'Размер карты',
  /** Setup: Faction label */
  setup_faction: 'Фракция',
  /** Setup: Map label */
  setup_map: 'Карта',
  /** Setup: Map Style label */
  setup_mapStyle: 'Стиль карты',
  /** Setup: Seed label */
  setup_seed: 'Сид',
  /** Setup: seed input placeholder */
  setup_seedPlaceholder: 'Введите сид...',
  /** Setup: Random seed button */
  setup_random: 'Случайный',
  /** Setup: Start button */
  setup_start: 'Начать',
  /** Setup: Back button */
  setup_back: 'Назад',
} as const;

// ─── Game mode display ───────────────────────────────────────────────

/** Display labels for game modes. Internal ids remain English. */
export const GAME_MODE_DISPLAY: Record<GameMode, string> = {
  standard: 'Стандартный',
  debug: 'Отладка',
  arena: 'Арена',
};

// ─── Game mode descriptions ──────────────────────────────────────────

/** Descriptive notes for game modes. */
export const GAME_MODE_DESCRIPTION: Record<GameMode, string> = {
  standard: '',
  debug: 'Инструменты разработчика и тестовые ресурсы включены.',
  arena: 'Боевой полигон — небольшая карта для испытания боевых единиц.',
};

// ─── Map size display ────────────────────────────────────────────────

/** Display labels for map sizes. Internal ids remain English. */
export const MAP_SIZE_DISPLAY: Record<MapSizeOption, string> = {
  small: 'Маленькая',
  standard: 'Стандартная',
  large: 'Большая',
};

// ─── Faction display ─────────────────────────────────────────────────

/** Russian display name for each faction. Internal ids remain English. */
export const FACTION_DISPLAY: Record<Faction, string> = {
  cyan: 'Поток',
  green: 'Росток',
  yellow: 'Искра',
  purple: 'Око',
};

/** Color subtitle for each faction. */
export const FACTION_COLOR_SUBTITLE: Record<Faction, string> = {
  cyan: 'Циановая фракция',
  green: 'Зелёная фракция',
  yellow: 'Жёлтая фракция',
  purple: 'Фиолетовая фракция',
};

/** Bonus description for each faction. */
export const FACTION_BONUS: Record<Faction, string> = {
  cyan: 'Бонус: мобильность и быстрый темп',
  green: 'Бонус: строительство и экономика',
  yellow: 'Бонус: боевое производство',
  purple: 'Бонус: обзор и контроль территории',
};

// ─── Map style display ───────────────────────────────────────────────

/** Display labels for map styles. */
export const MAP_STYLE_DISPLAY: Record<string, string> = {
  sand: 'Песок / Классика',
  industrial: 'Промышленная платформа',
};

// ─── Late-loading overlay ────────────────────────────────────────────

const LOADING_STRINGS = {
  /** Late-loading: main text */
  loading_combatAssets: 'Загрузка боевых ресурсов...',
  /** Late-loading: hint text */
  loading_debugArena: 'Подготовка режима отладки/арены',
} as const;

// ─── Map summary strings ─────────────────────────────────────────────

const MAP_SUMMARY_STRINGS = {
  /** Arena map summary */
  mapSummary_arena: '20×20 тайлов — боевой полигон',
  /** Generated map summary template parts */
  mapSummary_tiles: 'тайлов',
  mapSummary_seed: 'сид',
  mapSummary_predefined: 'предопределённая карта',
} as const;

// ─── Combined string map ─────────────────────────────────────────────

/**
 * Complete localized string map.
 * Keys are stable English identifiers. Values are Russian player-facing text.
 */
export const LOCALIZED_STRINGS = {
  ...MENU_STRINGS,
  ...SETUP_STRINGS,
  ...LOADING_STRINGS,
  ...MAP_SUMMARY_STRINGS,
} as const;

// ─── Lookup function ─────────────────────────────────────────────────

/**
 * Get a localized string by key.
 *
 * Returns the Russian string for the given key.
 * If the key is missing, returns the key itself as a fallback
 * (visible in dev, clearly indicates a missing translation).
 */
export function t(key: LocalizationKey): string;
export function t(key: string): string;
export function t(key: string): string {
  return (LOCALIZED_STRINGS as Record<string, string>)[key] ?? key;
}

// ─── Faction display helper ──────────────────────────────────────────

/**
 * Get the full faction display text for a faction.
 * Returns the display name, color subtitle, and bonus description.
 *
 * Example for 'cyan':
 *   "Поток\nЦиановая фракция\nБонус: мобильность и быстрый темп"
 */
export function getFactionDisplayText(faction: Faction): string {
  return `${FACTION_DISPLAY[faction]}\n${FACTION_COLOR_SUBTITLE[faction]}\n${FACTION_BONUS[faction]}`;
}

/**
 * Get a short faction display: name + bonus.
 *
 * Example for 'cyan':
 *   "Поток — Бонус: мобильность и быстрый темп"
 */
export function getFactionShortDisplay(faction: Faction): string {
  return `${FACTION_DISPLAY[faction]} — ${FACTION_BONUS[faction]}`;
}

// ─── Map summary helper ──────────────────────────────────────────────

/**
 * Build the map summary text for the setup scene.
 */
export function buildMapSummary(
  gameMode: GameMode,
  mapMode: 'fixed' | 'generated',
  mapStyle: string,
  width: number,
  height: number,
  seed: string,
): string {
  if (gameMode === 'arena') {
    return t('mapSummary_arena');
  }

  const styleLabel = MAP_STYLE_DISPLAY[mapStyle] ?? mapStyle;

  if (mapMode === 'generated') {
    return `${width}×${height} ${t('mapSummary_tiles')} · ${styleLabel} · ${t('mapSummary_seed')}: ${seed}`;
  }

  return `${width}×${height} ${t('mapSummary_tiles')} · ${styleLabel} · ${t('mapSummary_predefined')}`;
}
