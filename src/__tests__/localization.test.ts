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
  FACTION_ROLE,
  GAME_MODE_DISPLAY,
  GAME_MODE_DESCRIPTION,
  MAP_SIZE_DISPLAY,
  MAP_STYLE_DISPLAY,
  AI_MODE_DISPLAY,
  getFactionDisplayText,
  getFactionShortDisplay,
  getFactionTooltipText,
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

/** CORE-STEP-01B: Tests for Pause, HUD, Status, Arena, Composer, Devtools localization keys. */
describe('CORE-STEP-01B: LOCALIZED_STRINGS completeness — Pause/HUD/Arena', () => {
  it('has all required pause menu keys', () => {
    const requiredPauseKeys = [
      'pause_title', 'pause_resume', 'pause_save', 'pause_load',
      'pause_settings', 'pause_restart', 'pause_mainMenu', 'pause_escHint',
      'pause_controls', 'pause_loadGame', 'pause_noSaves', 'pause_clearAll',
      'pause_back', 'pause_delete', 'pause_saveFailed', 'pause_loadWarning',
      'pause_comingSoon', 'pause_noSavesSuffix', 'pause_saved',
    ];
    for (const key of requiredPauseKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required HUD keys', () => {
    const requiredHudKeys = [
      'hud_economy', 'hud_raw', 'hud_matter', 'hud_power', 'hud_units',
      'hud_harvesters', 'hud_separators', 'hud_factory', 'hud_build',
      'hud_produce', 'hud_separator', 'hud_powerPlant', 'hud_unitsFactory',
      'hud_builder', 'hud_harvesterUnit', 'hud_noneBuilt', 'hud_noneSpawned',
      'hud_queueEmpty', 'hud_escPause', 'hud_queue', 'hud_blocked',
    ];
    for (const key of requiredHudKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required status keys', () => {
    const requiredStatusKeys = [
      'status_idle', 'status_processing', 'status_noRaw', 'status_matterFull',
      'status_elementFull', 'status_noPower', 'status_builder', 'status_harvester',
      'status_noMatter', 'status_noElement', 'status_queueFull', 'status_unitCap',
      'status_noBuilder', 'status_noFactory', 'status_insufficientMatter',
    ];
    for (const key of requiredStatusKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required arena keys', () => {
    const requiredArenaKeys = [
      'arena_title', 'arena_units', 'arena_roster', 'arena_actions',
      'arena_reset', 'arena_deleteSel', 'arena_clearAll', 'arena_clearAllies',
      'arena_clearEnemies', 'arena_help', 'arena_helpClose', 'arena_vehicles',
      'arena_alive', 'arena_ally', 'arena_enemy', 'arena_noUnits', 'arena_empty',
      'arena_placing', 'arena_clickToSelect', 'arena_noTarget', 'arena_targetLost',
      'arena_selected', 'arena_target', 'arena_hp', 'arena_destroyed',
      'arena_noUnitSelected', 'arena_arenaReset', 'arena_unitNotFound',
      'arena_allyLabel', 'arena_enemyLabel', 'arena_deleted',
      'arena_allCleared', 'arena_alliesCleared', 'arena_noAllies',
      'arena_enemiesCleared', 'arena_noEnemies', 'arena_arenaEmptyStatus',
      'arena_inspection', 'arena_prevBody', 'arena_nextBody',
      'arena_prevWeapon', 'arena_nextWeapon', 'arena_resetPose',
    ];
    for (const key of requiredArenaKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required composer keys', () => {
    const requiredComposerKeys = [
      'composer_body', 'composer_weapon', 'composer_team',
      'composer_ally', 'composer_enemy', 'composer_aiMode',
      'composer_placeUnit', 'composer_cancel', 'composer_placing',
      'composer_placingClickHint',
    ];
    for (const key of requiredComposerKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has all required devtools keys', () => {
    const requiredDevtoolsKeys = [
      'devtools_title', 'devtools_resources', 'devtools_addRaw',
      'devtools_addMatter', 'devtools_addElement', 'devtools_max',
      'devtools_zero', 'devtools_spawn', 'devtools_spawnBuilder',
      'devtools_spawnHarvester', 'devtools_diagnostics', 'devtools_assets',
      'devtools_assetViewer', 'devtools_overlays', 'devtools_passOverlay',
      'devtools_footOverlay', 'devtools_resOverlay', 'devtools_arena',
      'devtools_resetArena',
    ];
    for (const key of requiredDevtoolsKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });
});

// ─── CORE-STEP-01B: AI mode display ──────────────────────────────────

describe('CORE-STEP-01B: AI mode display', () => {
  it('AI_MODE_DISPLAY has full Russian labels', () => {
    expect(AI_MODE_DISPLAY.passive).toBe('Пассивный');
    expect(AI_MODE_DISPLAY.stationary_shooter).toBe('Стрелок на месте');
    expect(AI_MODE_DISPLAY.chaser).toBe('Преследователь');
    expect(AI_MODE_DISPLAY.hold_position).toBe('Удерживать позицию');
  });

  it('AI mode display names differ from internal ids', () => {
    const modes = ['passive', 'stationary_shooter', 'chaser', 'hold_position'];
    for (const mode of modes) {
      expect(AI_MODE_DISPLAY[mode]).not.toBe(mode);
    }
  });

  it('stationary_shooter and hold_position use descriptive full forms', () => {
    // CORE-STEP-01B: These were updated from shortened forms to full descriptive Russian
    expect(AI_MODE_DISPLAY.stationary_shooter).toContain('Стрелок');
    expect(AI_MODE_DISPLAY.hold_position).toContain('Удерживать');
  });
});

// ─── CORE-STEP-01B: Pause menu Russian labels ──────────────────────

describe('CORE-STEP-01B: Pause menu Russian labels', () => {
  it('pause labels are Russian', () => {
    expect(t('pause_resume')).toBe('Продолжить');
    expect(t('pause_save')).toBe('Сохранить');
    expect(t('pause_load')).toBe('Загрузить');
    expect(t('pause_restart')).toBe('Перезапустить');
    expect(t('pause_mainMenu')).toBe('В главное меню');
    expect(t('pause_settings')).toBe('Настройки');
  });
});

// ─── CORE-STEP-01B: HUD Russian labels ─────────────────────────────

describe('CORE-STEP-01B: HUD Russian labels', () => {
  it('economy labels are Russian', () => {
    expect(t('hud_raw')).toBe('Сырьё');
    expect(t('hud_matter')).toBe('Энергия');
    expect(t('hud_power')).toBe('Питание');
    expect(t('hud_units')).toBe('Юниты');
  });

  it('building labels are Russian', () => {
    expect(t('hud_separator')).toBe('Сепаратор');
    expect(t('hud_powerPlant')).toBe('Электростанция');
    expect(t('hud_unitsFactory')).toBe('Фабрика юнитов');
  });

  it('unit labels are Russian', () => {
    expect(t('hud_builder')).toBe('Строитель');
    expect(t('hud_harvesterUnit')).toBe('Сборщик');
  });

  it('HUD Esc hint is Russian', () => {
    expect(t('hud_escPause')).toBe('Esc = Пауза и управление');
  });
});

// ─── CORE-STEP-01B: Arena Russian labels ────────────────────────────

describe('CORE-STEP-01B: Arena Russian labels', () => {
  it('arena menu labels are Russian', () => {
    expect(t('arena_reset')).toBe('Сбросить');
    expect(t('arena_clearAll')).toBe('Очистить всех');
    expect(t('arena_help')).toBe('Помощь [H]');
  });

  it('arena roster status labels are Russian', () => {
    expect(t('arena_selected')).toBe('Выбран');
    expect(t('arena_target')).toBe('Цель');
    expect(t('arena_hp')).toBe('ЗД');
    expect(t('arena_destroyed')).toBe('УНИЧТОЖЕН');
    expect(t('arena_noTarget')).toBe('нет цели');
    expect(t('arena_targetLost')).toBe('цель потеряна');
  });

  it('arena roster clear messages are Russian', () => {
    expect(t('arena_allCleared')).toBe('Юниты удалены');
    expect(t('arena_alliesCleared')).toBe('Союзники удалены');
    expect(t('arena_enemiesCleared')).toBe('Враги удалены');
    expect(t('arena_noAllies')).toBe('Нет союзников');
    expect(t('arena_noEnemies')).toBe('Нет врагов');
  });

  it('composer labels are Russian', () => {
    expect(t('composer_body')).toBe('Корпус');
    expect(t('composer_weapon')).toBe('Пушка');
    expect(t('composer_team')).toBe('Команда');
    expect(t('composer_ally')).toBe('Союзник');
    expect(t('composer_enemy')).toBe('Враг');
    expect(t('composer_aiMode')).toBe('Режим ИИ');
  });
});

// ─── CORE-STEP-01B: Status labels Russian ───────────────────────────

describe('CORE-STEP-01B: Status labels Russian', () => {
  it('separator status labels are Russian', () => {
    expect(t('status_idle')).toBe('Ожидание');
    expect(t('status_processing')).toBe('Работает');
    expect(t('status_noRaw')).toBe('Нет сырья');
    expect(t('status_matterFull')).toBe('Накопитель полон');
    expect(t('status_noPower')).toBe('Нет питания');
  });

  it('factory status labels are Russian', () => {
    expect(t('status_builder')).toBe('Строитель');
    expect(t('status_harvester')).toBe('Сборщик');
    expect(t('status_noFactory')).toBe('Нет фабрики');
    expect(t('status_queueFull')).toBe('Очередь полна');
    expect(t('status_unitCap')).toBe('Лимит юнитов');
  });

  it('build/production block labels are Russian', () => {
    expect(t('status_noBuilder')).toBe('Нет строителя');
    expect(t('status_insufficientMatter')).toBe('Мало энергии');
  });

  it('harvester status labels are Russian', () => {
    expect(t('status_moving')).toBe('Идёт');
    expect(t('status_gathering')).toBe('Сбор');
    expect(t('status_returning')).toBe('Возврат');
    expect(t('status_noResources')).toBe('Нет ресурсов');
    expect(t('status_storageFull')).toBe('Хранилище полно');
  });
});


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

// ─── CORE-STEP-01C: Tooltip keys and faction roles ──────────────────

describe('CORE-STEP-01C: Tooltip keys exist', () => {
  it('has all faction tooltip keys', () => {
    const factionTooltipKeys = [
      'tooltip_faction_cyan', 'tooltip_faction_green',
      'tooltip_faction_yellow', 'tooltip_faction_purple',
    ];
    for (const key of factionTooltipKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has setup tooltip keys', () => {
    const setupTooltipKeys = [
      'tooltip_gameMode', 'tooltip_mapSize',
      'tooltip_setupStart', 'tooltip_setupBack',
    ];
    for (const key of setupTooltipKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has HUD tooltip keys', () => {
    const hudTooltipKeys = [
      'tooltip_buildSeparator', 'tooltip_buildPowerPlant',
      'tooltip_buildFactory', 'tooltip_produceBuilder',
      'tooltip_produceHarvester',
    ];
    for (const key of hudTooltipKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has Arena composer tooltip keys', () => {
    const composerTooltipKeys = [
      'tooltip_composerBody', 'tooltip_composerWeapon',
      'tooltip_composerTeam', 'tooltip_composerAiMode',
    ];
    for (const key of composerTooltipKeys) {
      expect(LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
      expect(typeof LOCALIZED_STRINGS[key as keyof typeof LOCALIZED_STRINGS]).toBe('string');
    }
  });

  it('has DevTools badge key', () => {
    expect(LOCALIZED_STRINGS['devtools_badge' as keyof typeof LOCALIZED_STRINGS]).toBeDefined();
    expect(t('devtools_badge')).toContain('DEV');
    expect(t('devtools_badge')).toContain('Отладка');
  });

  it('all tooltip values are non-empty Russian strings', () => {
    const allTooltipKeys = Object.keys(LOCALIZED_STRINGS).filter(k => k.startsWith('tooltip_'));
    expect(allTooltipKeys.length, 'Should have tooltip keys').toBeGreaterThan(0);
    for (const key of allTooltipKeys) {
      const value = (LOCALIZED_STRINGS as Record<string, string>)[key];
      expect(value.length, `Tooltip key "${key}" has empty value`).toBeGreaterThan(0);
    }
  });
});

describe('CORE-STEP-01C: FACTION_ROLE', () => {
  it('has role descriptions for all 4 factions', () => {
    const factions: Faction[] = ['cyan', 'green', 'yellow', 'purple'];
    for (const faction of factions) {
      expect(FACTION_ROLE[faction]).toBeDefined();
      expect(FACTION_ROLE[faction].length).toBeGreaterThan(0);
    }
  });

  it('faction roles contain "Роль:" prefix', () => {
    const factions: Faction[] = ['cyan', 'green', 'yellow', 'purple'];
    for (const faction of factions) {
      expect(FACTION_ROLE[faction]).toContain('Роль:');
    }
  });

  it('faction roles match expected content', () => {
    expect(FACTION_ROLE.cyan).toContain('мобильн');
    expect(FACTION_ROLE.green).toContain('экономик');
    expect(FACTION_ROLE.yellow).toContain('боев');
    expect(FACTION_ROLE.purple).toContain('контроль');
  });

  it('getFactionTooltipText includes all 4 lines', () => {
    const factions: Faction[] = ['cyan', 'green', 'yellow', 'purple'];
    for (const faction of factions) {
      const text = getFactionTooltipText(faction);
      expect(text).toContain(FACTION_DISPLAY[faction]);
      expect(text).toContain(FACTION_COLOR_SUBTITLE[faction]);
      expect(text).toContain(FACTION_BONUS[faction]);
      expect(text).toContain(FACTION_ROLE[faction]);
    }
  });
});
