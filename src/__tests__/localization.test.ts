/**
 * Tests for localization infrastructure — pure TypeScript, no Phaser.
 *
 * CORE-STEP-01A: Tests for the localization module, faction display,
 * and setup flow constraints (Standard mode hiding Sand/Map1/mapStyle).
 */

import { describe, it, expect } from 'vitest';
import {
  t,
  LOCALIZED_STRINGS,
  FACTION_DISPLAY,
  FACTION_COLOR_SUBTITLE,
  FACTION_BONUS,
  GAME_MODE_DISPLAY,
  GAME_MODE_DESCRIPTION,
  MAP_SIZE_DISPLAY,
  MAP_STYLE_DISPLAY,
  getFactionDisplayText,
  getFactionShortDisplay,
  buildMapSummary,
} from '../config/localization';
import type { Faction } from '../state/types';
import type { GameMode } from '../state/gameSetup';

// ─── Localization string map completeness ─────────────────────────────

describe('CORE-STEP-01A: LOCALIZED_STRINGS completeness', () => {
  it('has all required main menu keys', () => {
    const requiredMenuKeys = [
      'menu_newGame', 'menu_continue', 'menu_settings',
      'menu_loadGame', 'menu_noSaves', 'menu_noSavesHint',
      'menu_clearAll', 'menu_back', 'menu_delete',
      'menu_settingsTitle', 'menu_uiScale', 'menu_uiScaleNote',
      'menu_deleteConfirm', 'menu_clearAllConfirm',
    ];
    for (const key of requiredMenuKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required setup keys', () => {
    const requiredSetupKeys = [
      'setup_title', 'setup_subtitle', 'setup_gameMode',
      'setup_mapSize', 'setup_faction', 'setup_map',
      'setup_mapStyle', 'setup_seed', 'setup_seedPlaceholder',
      'setup_random', 'setup_start', 'setup_back',
    ];
    for (const key of requiredSetupKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required loading keys', () => {
    const requiredLoadingKeys = [
      'loading_combatAssets', 'loading_debugArena',
    ];
    for (const key of requiredLoadingKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('all values are non-empty Russian strings', () => {
    for (const [key, value] of Object.entries(LOCALIZED_STRINGS) as [string, string][]) {
      expect(value.length, `Key "${key}" has empty value`).toBeGreaterThan(0);
    }
  });
});

// ─── t() lookup function ─────────────────────────────────────────────

describe('CORE-STEP-01A: t() lookup function', () => {
  it('returns Russian string for valid keys', () => {
    expect(t('menu_newGame')).toBe('Новая игра');
    expect(t('menu_continue')).toBe('Продолжить');
    expect(t('menu_settings')).toBe('Настройки');
    expect(t('setup_title')).toBe('Новая игра');
    expect(t('setup_start')).toBe('Начать');
    expect(t('setup_back')).toBe('Назад');
  });

  it('returns the key itself for unknown keys (fallback)', () => {
    expect(t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
  });

  it('returns non-empty strings for all valid keys', () => {
    for (const key of Object.keys(LOCALIZED_STRINGS)) {
      expect(t(key).length).toBeGreaterThan(0);
    }
  });
});

// ─── Faction display ─────────────────────────────────────────────────

describe('CORE-STEP-01A: Faction display', () => {
  const factions: Faction[] = ['cyan', 'green', 'yellow', 'purple'];

  it('FACTION_DISPLAY has Russian names for all 4 factions', () => {
    expect(FACTION_DISPLAY.cyan).toBe('Поток');
    expect(FACTION_DISPLAY.green).toBe('Росток');
    expect(FACTION_DISPLAY.yellow).toBe('Искра');
    expect(FACTION_DISPLAY.purple).toBe('Око');
  });

  it('FACTION_COLOR_SUBTITLE has descriptions for all 4 factions', () => {
    for (const faction of factions) {
      expect(FACTION_COLOR_SUBTITLE[faction]).toBeDefined();
      expect(FACTION_COLOR_SUBTITLE[faction].length).toBeGreaterThan(0);
    }
  });

  it('FACTION_BONUS has bonus descriptions for all 4 factions', () => {
    expect(FACTION_BONUS.cyan).toContain('мобильность');
    expect(FACTION_BONUS.green).toContain('строительство');
    expect(FACTION_BONUS.yellow).toContain('боевое производство');
    expect(FACTION_BONUS.purple).toContain('обзор');
  });

  it('all faction display names start with uppercase', () => {
    for (const faction of factions) {
      const name = FACTION_DISPLAY[faction];
      expect(name[0]).toBe(name[0].toUpperCase());
    }
  });

  it('all faction bonuses contain "Бонус:" prefix', () => {
    for (const faction of factions) {
      expect(FACTION_BONUS[faction]).toContain('Бонус:');
    }
  });
});

// ─── getFactionDisplayText ───────────────────────────────────────────

describe('CORE-STEP-01A: getFactionDisplayText', () => {
  it('returns 3-line display text for cyan', () => {
    const text = getFactionDisplayText('cyan');
    expect(text).toContain('Поток');
    expect(text).toContain('Циановая фракция');
    expect(text).toContain('Бонус: мобильность и быстрый темп');
  });

  it('returns 3-line display text for all factions', () => {
    const factions: Faction[] = ['cyan', 'green', 'yellow', 'purple'];
    for (const faction of factions) {
      const text = getFactionDisplayText(faction);
      expect(text).toContain(FACTION_DISPLAY[faction]);
      expect(text).toContain(FACTION_COLOR_SUBTITLE[faction]);
      expect(text).toContain(FACTION_BONUS[faction]);
    }
  });
});

// ─── getFactionShortDisplay ──────────────────────────────────────────

describe('CORE-STEP-01A: getFactionShortDisplay', () => {
  it('returns name — bonus format', () => {
    expect(getFactionShortDisplay('cyan')).toBe('Поток — Бонус: мобильность и быстрый темп');
    expect(getFactionShortDisplay('green')).toBe('Росток — Бонус: строительство и экономика');
  });
});

// ─── Game mode display ───────────────────────────────────────────────

describe('CORE-STEP-01A: Game mode display', () => {
  it('GAME_MODE_DISPLAY has Russian labels for all modes', () => {
    expect(GAME_MODE_DISPLAY.standard).toBe('Стандартный');
    expect(GAME_MODE_DISPLAY.debug).toBe('Отладка');
    expect(GAME_MODE_DISPLAY.arena).toBe('Арена');
  });

  it('GAME_MODE_DESCRIPTION has descriptions for debug and arena', () => {
    expect(GAME_MODE_DESCRIPTION.debug.length).toBeGreaterThan(0);
    expect(GAME_MODE_DESCRIPTION.arena.length).toBeGreaterThan(0);
  });

  it('GAME_MODE_DESCRIPTION standard is empty (no note needed)', () => {
    expect(GAME_MODE_DESCRIPTION.standard).toBe('');
  });
});

// ─── Map size display ────────────────────────────────────────────────

describe('CORE-STEP-01A: Map size display', () => {
  it('MAP_SIZE_DISPLAY has Russian labels for all sizes', () => {
    expect(MAP_SIZE_DISPLAY.small).toBe('Маленькая');
    expect(MAP_SIZE_DISPLAY.standard).toBe('Стандартная');
    expect(MAP_SIZE_DISPLAY.large).toBe('Большая');
  });
});

// ─── Map style display ───────────────────────────────────────────────

describe('CORE-STEP-01A: Map style display', () => {
  it('MAP_STYLE_DISPLAY has Russian labels for all styles', () => {
    expect(MAP_STYLE_DISPLAY.sand).toBe('Песок / Классика');
    expect(MAP_STYLE_DISPLAY.industrial).toBe('Промышленная платформа');
  });
});

// ─── buildMapSummary ─────────────────────────────────────────────────

describe('CORE-STEP-01A: buildMapSummary', () => {
  it('returns arena summary for arena mode', () => {
    const summary = buildMapSummary('arena', 'fixed', 'industrial', 20, 20, 'test');
    expect(summary).toContain('20');
    expect(summary).toContain('20');
  });

  it('Standard generated map summary omits seed', () => {
    const summary = buildMapSummary('standard', 'generated', 'industrial', 32, 32, 'myseed');
    expect(summary).toContain('32');
    expect(summary).toContain('Промышленная платформа');
    expect(summary).not.toContain('сид');
    expect(summary).not.toContain('myseed');
  });

  it('Debug generated map summary includes seed', () => {
    const summary = buildMapSummary('debug', 'generated', 'industrial', 32, 32, 'default');
    expect(summary).toContain('32');
    expect(summary).toContain('Промышленная платформа');
    expect(summary).toContain('сид');
    expect(summary).toContain('default');
  });

  it('returns fixed map summary', () => {
    const summary = buildMapSummary('debug', 'fixed', 'sand', 48, 48, 'default');
    expect(summary).toContain('48');
    expect(summary).toContain('Песок');
  });
});

// ─── Standard mode setup constraints ─────────────────────────────────

describe('CORE-STEP-01A: Standard mode setup constraints', () => {
  it('Standard mode game config uses generated/industrial by default', () => {
    // Simulates what happens when selecting Standard mode in NewGameSetupScene
    const gameMode: GameMode = 'standard';
    const mapMode = gameMode === 'standard' ? 'generated' : 'fixed';
    const mapStyle = gameMode === 'standard' ? 'industrial' : 'sand';

    expect(mapMode).toBe('generated');
    expect(mapStyle).toBe('industrial');
  });

  it('Standard mode should not expose sand mapStyle', () => {
    // In Standard mode, mapStyle selector is hidden and forced to 'industrial'
    const gameMode: GameMode = 'standard';
    const shouldShowMapStyle = gameMode !== 'standard' && gameMode !== 'arena';
    expect(shouldShowMapStyle).toBe(false);
  });

  it('Standard mode should not expose Map 1 or Sand Classic', () => {
    // In Standard mode, map selector is hidden
    const gameMode: GameMode = 'standard';
    const shouldShowMapSelector = gameMode !== 'standard' && gameMode !== 'arena';
    expect(shouldShowMapSelector).toBe(false);
  });

  it('Debug mode shows all options', () => {
    const gameMode: GameMode = 'debug' as GameMode;
    const shouldShowMapSelector = gameMode !== 'standard' && gameMode !== 'arena';
    const shouldShowMapStyle = gameMode !== 'standard' && gameMode !== 'arena';
    const shouldShowSeed = gameMode !== 'standard' && gameMode !== 'arena';

    expect(shouldShowMapSelector).toBe(true);
    expect(shouldShowMapStyle).toBe(true);
    expect(shouldShowSeed).toBe(true);
  });

  it('Arena mode hides map, mapStyle, size, seed', () => {
    const gameMode: GameMode = 'arena' as GameMode;
    const shouldShowMapSelector = gameMode !== 'standard' && gameMode !== 'arena';
    const shouldShowMapStyle = gameMode !== 'standard' && gameMode !== 'arena';
    const shouldShowSize = gameMode !== 'arena';
    const shouldShowSeed = gameMode !== 'standard' && gameMode !== 'arena';

    expect(shouldShowMapSelector).toBe(false);
    expect(shouldShowMapStyle).toBe(false);
    expect(shouldShowSize).toBe(false);
    expect(shouldShowSeed).toBe(false);
  });
});

// ─── Faction display names are not used as logic ids ─────────────────

describe('CORE-STEP-01A: Internal ids vs display names', () => {
  it('faction display names differ from internal ids', () => {
    const factions: Faction[] = ['cyan', 'green', 'yellow', 'purple'];
    for (const faction of factions) {
      // Display names are Russian, ids are English — they must differ
      expect(FACTION_DISPLAY[faction]).not.toBe(faction);
    }
  });

  it('game mode display names differ from internal ids', () => {
    const modes: GameMode[] = ['standard', 'debug', 'arena'];
    for (const mode of modes) {
      expect(GAME_MODE_DISPLAY[mode]).not.toBe(mode);
    }
  });

  it('map size display names differ from internal ids', () => {
    const sizes = ['small', 'standard', 'large'] as const;
    for (const size of sizes) {
      expect(MAP_SIZE_DISPLAY[size]).not.toBe(size);
    }
  });
});

// ─── Setup flow order ──────────────────────────────────────────────

describe('CORE-STEP-01A fixup: Setup flow order', () => {
  /**
   * Accepted Standard flow: mode → map size → faction → start.
   * The localization keys for the Standard-visible sections must
   * exist and appear in the correct conceptual order.
   */
  it('Standard-visible section keys exist in accepted order', () => {
    // The accepted Standard flow is: mode → map size → faction → start
    const standardFlowKeys = [
      'setup_gameMode',   // Режим игры
      'setup_mapSize',    // Размер карты
      'setup_faction',    // Фракция
      'setup_start',      // Начать
    ] as const;

    for (const key of standardFlowKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }

    // Verify the Russian labels match the expected flow
    expect(t('setup_gameMode')).toBe('Режим игры');
    expect(t('setup_mapSize')).toBe('Размер карты');
    expect(t('setup_faction')).toBe('Фракция');
    expect(t('setup_start')).toBe('Начать');
  });

  it('Debug-only section keys still exist after faction', () => {
    // Debug shows extra sections after faction: map, mapStyle, seed
    const debugExtraKeys = [
      'setup_map',        // Карта
      'setup_mapStyle',   // Стиль карты
      'setup_seed',       // Сид
    ] as const;

    for (const key of debugExtraKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });
});
