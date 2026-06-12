/**
 * Localization infrastructure — Russian player-facing UI strings.
 *
 * CORE-STEP-01A: Provides a stable English-key → localized-string map.
 * CORE-STEP-01B: Adds Pause, HUD, Status, Arena, Composer, Devtools sections.
 * CORE-STEP-01C: Adds FACTION_ROLE, tooltip strings, and getFactionTooltipText helper.
 * CORE-STEP-02A: Adds WEAPON_STRINGS, BODY_STRINGS, and BODY_ROLE_STRINGS for production config displayNames.
 * CORE-STEP-02B: Adds FACTION_STRINGS, RESOURCE_CLASS_STRINGS, BUILDING_STRINGS, and BUILDING_ROLE_STRINGS
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

/** Role description for each faction. CORE-STEP-01C: Used in tooltips/cards. */
export const FACTION_ROLE: Record<Faction, string> = {
  cyan: 'Роль: быстрый старт, темп, мобильные действия',
  green: 'Роль: развитие базы и стабильная экономика',
  yellow: 'Роль: быстрее выводит боевые силы',
  purple: 'Роль: информация, контроль карты, безопасное расширение',
};

// ─── Map style display ───────────────────────────────────────────────

/** Display labels for map styles. */
export const MAP_STYLE_DISPLAY: Record<string, string> = {
  sand: 'Песок / Классика',
  industrial: 'Промышленная платформа',
};

// ─── Tooltip strings ────────────────────────────────────────────────

const TOOLTIP_STRINGS = {
  // Faction tooltips
  tooltip_faction_cyan: 'Быстрый старт, темп, мобильные действия.',
  tooltip_faction_green: 'Развитие базы и стабильная экономика.',
  tooltip_faction_yellow: 'Быстрее выводит боевые силы.',
  tooltip_faction_purple: 'Информация, контроль карты, безопасное расширение.',
  // Setup tooltips
  tooltip_gameMode: 'Определяет правила и доступные инструменты.',
  tooltip_mapSize: 'Влияет на длительность игры и количество ресурсов.',
  tooltip_setupStart: 'Начать игру с выбранными настройками.',
  tooltip_setupBack: 'Вернуться в главное меню.',
  // HUD tooltips
  tooltip_buildSeparator: 'Сепаратор перерабатывает сырьё в энергию.',
  tooltip_buildRawStorage: 'Хранилище сырья увеличивает лимит хранения сырья.',
  tooltip_buildEnergyStorage: 'Хранилище энергии увеличивает лимит хранения энергии.',
  tooltip_buildElementsStorage: 'Хранилище элементов увеличивает лимит хранения элементов фракции.',
  tooltip_buildPowerPlant: 'Электростанция обеспечивает питание зданий.',
  tooltip_buildEnergyReactor: 'Энергореактор — улучшенная энергетическая инфраструктура (ещё не реализовано).',
  tooltip_buildFactory: 'Фабрика производит строителей и сборщиков.',
  tooltip_produceBuilder: 'Строитель возводит здания на подготовленных площадках.',
  tooltip_produceHarvester: 'Сборщик добывает сырьё и доставляет на базу.',
  // Arena composer tooltips
  tooltip_composerBody: 'Корпус определяет запас здоровья и скорость юнита.',
  tooltip_composerWeapon: 'Пушка определяет тип и урон оружия.',
  tooltip_composerTeam: 'Союзники управляются игроком, враги — ИИ.',
  tooltip_composerAiMode: 'Режим поведения ИИ для вражеских юнитов.',
  // DevTools marker
  devtools_badge: 'DEV / Отладка',
} as const;

// ─── Pause menu strings ─────────────────────────────────────────────

const PAUSE_STRINGS = {
  pause_title: 'Пауза',
  pause_resume: 'Продолжить',
  pause_save: 'Сохранить',
  pause_load: 'Загрузить',
  pause_settings: 'Настройки',
  pause_restart: 'Перезапустить',
  pause_mainMenu: 'В главное меню',
  pause_escHint: 'Esc — продолжить',
  pause_controls: 'Управление',
  pause_loadGame: 'Загрузить игру',
  pause_noSaves: 'Сохранений нет',
  pause_clearAll: 'Очистить всё',
  pause_back: 'Назад',
  pause_delete: 'Удалить',
  pause_saveFailed: 'Ошибка сохранения',
  pause_loadWarning: 'Загрузка заменит текущую игру. Несохранённый прогресс будет потерян.',
  pause_comingSoon: 'скоро',
  pause_noSavesSuffix: 'нет сохранений',
  pause_saved: 'Сохранено',
  pause_hotkeyBuild: 'Строить Сепаратор / Энергостанция / Фабрика',
  pause_hotkeyProduce: 'Производить Строитель / Сборщик',
  pause_hotkeySelect: 'Выбрать юнит / Команда движения',
  pause_hotkeyZoom: 'Приблизить / Отдалить',
  pause_hotkeyPan: 'Перемещение камеры',
  pause_hotkeyResetCam: 'Сброс камеры на базу',
  pause_hotkeyDebug: 'Отладочный оверлей',
  pause_hotkeyEsc: 'Пауза / Продолжить',
} as const;

// ─── HUD strings ─────────────────────────────────────────────────────

const HUD_STRINGS = {
  hud_economy: 'Экономика',
  hud_raw: 'Сырьё',
  hud_matter: 'Энергия',
  hud_power: 'Питание',
  hud_units: 'Юниты',
  hud_harvesters: 'Сборщики',
  hud_separators: 'Сепараторы',
  hud_factory: 'Фабрика',
  hud_build: 'Строительство',
  hud_produce: 'Производство',
  hud_separator: 'Сепаратор',
  hud_powerPlant: 'Электростанция',
  hud_unitsFactory: 'Фабрика юнитов',
  hud_builder: 'Строитель',
  hud_harvesterUnit: 'Сборщик',
  hud_noneBuilt: 'Не построено',
  hud_noneSpawned: 'Не создано',
  hud_queueEmpty: 'Очередь: пусто',
  hud_escPause: 'Esc = Пауза и управление',
  hud_queue: 'Очередь',
  hud_blocked: 'Блокировка',
  hud_harvesterAbbr: 'С',
  hud_separatorAbbr: 'Сеп',
  hud_factoryAbbr: 'Фабр',
  hud_builderAbbr: 'Ст',
  hud_harvesterQAbbr: 'Сб',
  hud_done: 'готово',
  hud_reachable: 'Доступно',
  hud_info: 'i',
  hud_warning: '!',
  // CORE-STEP-05H+: Command routing status labels
  hud_cursorMove: 'Движение',
  hud_cursorHarvest: 'Добыча',
  hud_cursorAttack: 'Атака',
  hud_cursorSelect: 'Выбор',
  hud_cursorBlocked: 'Недоступно',
  hud_cmdStopped: 'Стоп',
  hud_cmdDeselected: 'Снято выделение',
  hud_cmdMove: 'Движение',
  hud_cmdHarvest: 'Добыча',
  hud_cmdAttack: 'Атака',
} as const;

// ─── Status label strings ───────────────────────────────────────────

const STATUS_STRINGS = {
  status_idle: 'Ожидание',
  status_processing: 'Работает',
  status_noRaw: 'Нет сырья',
  status_matterFull: 'Накопитель полон',
  status_elementFull: 'Выход заполнен',
  status_noPower: 'Нет питания',
  status_builder: 'Строитель',
  status_harvester: 'Сборщик',
  status_noMatter: 'Нет энергии',
  status_noElement: 'Нет элемента',
  status_queueFull: 'Очередь полна',
  status_unitCap: 'Лимит юнитов',
  status_noBuilder: 'Нет строителя',
  status_notBuildable: 'Не строится',
  status_noFactory: 'Нет фабрики',
  status_moving: 'Идёт',
  status_gathering: 'Сбор',
  status_returning: 'Возврат',
  status_unloading: 'Разгрузка',
  status_manual: 'Ручной',
  status_noResources: 'Нет ресурсов',
  status_noPathToResource: 'Нет пути к ресурсу',
  status_noPathToHQ: 'Нет пути к базе',
  status_storageFull: 'Хранилище полно',
  status_noSpawnTile: 'Нет места для выхода',
  status_insufficientMatter: 'Мало энергии',
} as const;

// ─── Arena menu strings ──────────────────────────────────────────────

const ARENA_STRINGS = {
  arena_title: 'Арена',
  arena_units: 'Юниты',
  arena_roster: 'Список',
  arena_actions: 'Действия',
  arena_reset: 'Сбросить',
  arena_deleteSel: 'Удалить выбор',
  arena_clearAll: 'Очистить всех',
  arena_clearAllies: 'Очистить союзников',
  arena_clearEnemies: 'Очистить врагов',
  arena_help: 'Помощь [H]',
  arena_helpClose: '[H] Закрыть',
  arena_vehicles: 'Юниты',
  arena_alive: 'живых',
  arena_ally: 'союзников',
  arena_enemy: 'врагов',
  arena_noUnits: 'Юниты не размещены',
  arena_empty: 'Арена пуста — разместите юнит',
  arena_placing: 'Размещение — клик на поле | Esc/ПКМ отмена',
  arena_clickToSelect: 'юнит(ов) — кликните на союзника для выбора',
  arena_noTarget: 'нет цели',
  arena_targetLost: 'цель потеряна',
  arena_selected: 'Выбран',
  arena_target: 'Цель',
  arena_hp: 'ЗД',
  arena_destroyed: 'УНИЧТОЖЕН',
  arena_noUnitSelected: 'Юнит не выбран',
  arena_arenaReset: 'Арена сброшена',
  arena_unitNotFound: 'Юнит не найден',
  arena_allyLabel: 'Союзник',
  arena_enemyLabel: 'Враг',
  arena_deleted: 'удалён',
  arena_allCleared: 'Юниты удалены',
  arena_alliesCleared: 'Союзники удалены',
  arena_noAllies: 'Нет союзников',
  arena_enemiesCleared: 'Враги удалены',
  arena_noEnemies: 'Нет врагов',
  arena_arenaEmptyStatus: 'Арена пуста',
  arena_inspection: 'Inspection',
  arena_prevBody: '< Body',
  arena_nextBody: 'Body >',
  arena_prevWeapon: '< Weapon',
  arena_nextWeapon: 'Weapon >',
  arena_resetPose: 'Reset pose',
} as const;

// ─── Arena unit composer strings ─────────────────────────────────────

const COMPOSER_STRINGS = {
  composer_body: 'Корпус',
  composer_weapon: 'Пушка',
  composer_team: 'Команда',
  composer_ally: 'Союзник',
  composer_enemy: 'Враг',
  composer_aiMode: 'Режим ИИ',
  composer_placeUnit: 'Разместить',
  composer_cancel: 'Отмена',
  composer_placing: 'Размещение',
  composer_placingClickHint: 'клик на поле | Esc/ПКМ отмена',
} as const;

// ─── AI mode display ─────────────────────────────────────────────────

/** Russian display labels for Arena AI modes. Internal ids remain English. */
export const AI_MODE_DISPLAY: Record<string, string> = {
  passive: 'Пассивный',
  stationary_shooter: 'Стрелок на месте',
  chaser: 'Преследователь',
  hold_position: 'Удерживать позицию',
};

// ─── Devtools label strings (minimal — full separation is 01C) ──────

const DEVTOOLS_STRINGS = {
  devtools_title: 'Инструменты',
  devtools_resources: 'Ресурсы',
  devtools_addRaw: '+Сырьё',
  devtools_addMatter: '+Энергия',
  devtools_addElement: '+Элемент',
  devtools_max: 'Макс [DEV]',
  devtools_zero: 'Обнулить',
  devtools_spawn: 'Создание',
  devtools_spawnBuilder: 'Строитель',
  devtools_spawnHarvester: 'Сборщик',
  devtools_diagnostics: 'Диагностика',
  devtools_assets: 'Активы',
  devtools_assetViewer: 'Просмотр активов',
  devtools_overlays: 'Слои',
  devtools_passOverlay: 'Проход',
  devtools_footOverlay: 'Площадь',
  devtools_resOverlay: 'Рес',
  devtools_arena: 'Арена',
  devtools_resetArena: 'Сбросить арену',
} as const;

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

// ─── Weapon display names (CORE-STEP-02A) ──────────────────────────

/** Russian display names for 10 accepted weapons. Keys match weaponData.ts displayNameKey. */
const WEAPON_STRINGS = {
  weapon_smoky: 'Смоки',
  weapon_thunder: 'Гром',
  weapon_railgun: 'Рельса',
  weapon_flamethrower: 'Огнемёт',
  weapon_freeze: 'Фриз',
  weapon_isida: 'Изида',
  weapon_vulcan: 'Вулкан',
  weapon_twins: 'Твинс',
  weapon_ricochet: 'Рикошет',
  weapon_hammer: 'Молот',
} as const;

// ─── Body display names (CORE-STEP-02A) ─────────────────────────────

/** Russian display names for 7 accepted bodies. Keys match bodyData.ts displayNameKey. */
const BODY_STRINGS = {
  body_wasp: 'Васп',
  body_hornet: 'Хорнет',
  body_hunter: 'Хантер',
  body_viking: 'Викинг',
  body_dictator: 'Диктатор',
  body_titan: 'Титан',
  body_mammoth: 'Мамонт',
} as const;

// ─── Body role descriptions (CORE-STEP-02A) ─────────────────────────

/** Russian role descriptions for 7 accepted bodies. Keys match bodyData.ts roleKey. */
const BODY_ROLE_STRINGS = {
  role_wasp: 'Быстрый разведчик / удар и отступление',
  role_hornet: 'Лёгкий рейдер / мобильный боец',
  role_hunter: 'Универсальный средний корпус',
  role_viking: 'Среднетяжёлый боец',
  role_dictator: 'Тяжёлая платформа поддержки',
  role_titan: 'Тяжёлый авангард / стабильная платформа',
  role_mammoth: 'Сверхтяжёлая крепость',
} as const;

// ─── Faction config display names (CORE-STEP-02B) ──────────────────

/** Russian display names for 4 accepted factions. Keys match factionData.ts displayNameKey. */
const FACTION_STRINGS = {
  faction_cyan: 'Поток',
  faction_green: 'Росток',
  faction_yellow: 'Искра',
  faction_purple: 'Око',
} as const;

/** Russian color subtitles for 4 factions. Keys match factionData.ts colorSubtitleKey. */
const FACTION_COLOR_STRINGS = {
  faction_color_cyan: 'Циановая фракция',
  faction_color_green: 'Зелёная фракция',
  faction_color_yellow: 'Жёлтая фракция',
  faction_color_purple: 'Фиолетовая фракция',
} as const;

/** Russian bonus descriptions for 4 factions. Keys match factionData.ts bonusDescriptionKey. */
const FACTION_BONUS_STRINGS = {
  faction_bonus_cyan: 'Бонус: мобильность и быстрый темп',
  faction_bonus_green: 'Бонус: строительство и экономика',
  faction_bonus_yellow: 'Бонус: боевое производство',
  faction_bonus_purple: 'Бонус: обзор и контроль территории',
} as const;

/** Russian role descriptions for 4 factions. Keys match factionData.ts roleKey. */
const FACTION_ROLE_STRINGS = {
  faction_role_cyan: 'Роль: быстрый старт, темп, мобильные действия',
  faction_role_green: 'Роль: развитие базы и стабильная экономика',
  faction_role_yellow: 'Роль: быстрее выводит боевые силы',
  faction_role_purple: 'Роль: информация, контроль карты, безопасное расширение',
} as const;

// ─── Resource class display names (CORE-STEP-02B) ──────────────────

/** Russian display names for 6 accepted resource classes. Keys match resourceClassData.ts displayNameKey. */
const RESOURCE_CLASS_STRINGS = {
  resource_very_poor: 'Очень бедная залежь',
  resource_poor: 'Бедная залежь',
  resource_medium: 'Средняя залежь',
  resource_rich: 'Богатая залежь',
  resource_very_rich: 'Очень богатая залежь',
  resource_infinite: 'Бесконечная залежь',
} as const;

/** Russian descriptions for 6 resource classes. Keys match resourceClassData.ts descriptionKey. */
const RESOURCE_CLASS_DESC_STRINGS = {
  resource_very_poor_desc: 'Минимальная залежь в стартовой зоне. Быстро иссякает.',
  resource_poor_desc: 'Небольшая залежь в стартовой зоне. Для начального сбора.',
  resource_medium_desc: 'Стандартная залежь в промежуточной зоне. Стабильный доход.',
  resource_rich_desc: 'Богатая залежь в спорной зоне. Стоит борьбы.',
  resource_very_rich_desc: 'Очень богатая залежь в спорной зоне. Ценный стратегический ресурс.',
  resource_infinite_desc: 'Бесконечная залежь в центре карты. Никогда не иссякает.',
} as const;

// ─── Building display names (CORE-STEP-02B) ─────────────────────────

/** Russian display names for accepted buildings. Keys match buildingData.ts displayNameKey. */
const BUILDING_STRINGS = {
  building_hq: 'Главное здание',
  building_separator: 'Сепаратор',
  building_raw_storage: 'Хранилище сырья',
  building_energy_storage: 'Хранилище энергии',
  building_elements_storage: 'Хранилище элементов',
  building_units_factory: 'Фабрика юнитов',
  building_power_plant: 'Электростанция',
  building_energy_reactor: 'Энергореактор',
  building_repair_center: 'Ремонтный центр',
  building_defense_tower: 'Оборонная башня',
} as const;

/** Russian role/descriptions for buildings. Keys match buildingData.ts roleKey. */
const BUILDING_ROLE_STRINGS = {
  building_role_hq: 'Стартовая база, точка приёма ресурсов, базовое питание и хранилище',
  building_role_separator: 'Перерабатывает сырьё в энергию и элементы фракции',
  building_role_raw_storage: 'Увеличивает лимит хранения сырья',
  building_role_energy_storage: 'Увеличивает лимит хранения энергии',
  building_role_elements_storage: 'Увеличивает лимит хранения элементов фракции',
  building_role_units_factory: 'Производит строителей и сборщиков',
  building_role_power_plant: 'Вырабатывает питание для зданий',
  building_role_energy_reactor: 'Улучшает энергетическую инфраструктуру (ещё не реализовано)',
  building_role_repair_center: 'Стационарный ремонт за энергию (ещё не реализовано)',
  building_role_defense_tower: 'Оборона базы (ещё не реализовано)',
} as const;

// ─── Combined string map ─────────────────────────────────────────────

/**
 * Complete localized string map.
 * Keys are stable English identifiers. Values are Russian player-facing text.
 */
export const LOCALIZED_STRINGS = {
  ...MENU_STRINGS,
  ...SETUP_STRINGS,
  ...PAUSE_STRINGS,
  ...HUD_STRINGS,
  ...STATUS_STRINGS,
  ...ARENA_STRINGS,
  ...COMPOSER_STRINGS,
  ...DEVTOOLS_STRINGS,
  ...LOADING_STRINGS,
  ...MAP_SUMMARY_STRINGS,
  ...TOOLTIP_STRINGS,
  ...WEAPON_STRINGS,
  ...BODY_STRINGS,
  ...BODY_ROLE_STRINGS,
  ...FACTION_STRINGS,
  ...FACTION_COLOR_STRINGS,
  ...FACTION_BONUS_STRINGS,
  ...FACTION_ROLE_STRINGS,
  ...RESOURCE_CLASS_STRINGS,
  ...RESOURCE_CLASS_DESC_STRINGS,
  ...BUILDING_STRINGS,
  ...BUILDING_ROLE_STRINGS,
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

/**
 * Get full faction tooltip text: display name + color subtitle + bonus + role.
 * CORE-STEP-01C: Used for faction card tooltips.
 */
export function getFactionTooltipText(faction: Faction): string {
  return `${FACTION_DISPLAY[faction]}\n${FACTION_COLOR_SUBTITLE[faction]}\n${FACTION_BONUS[faction]}\n${FACTION_ROLE[faction]}`;
}

// ─── Map summary helper ──────────────────────────────────────────────

/**
 * Build the map summary text for the setup scene.
 *
 * CORE-STEP-01A fixup: Standard mode omits seed from summary.
 * - Standard generated: "32×32 тайлов · Промышленная платформа"
 * - Debug generated:   "32×32 тайлов · Промышленная платформа · сид: default"
 * - Arena:             "20×20 тайлов — боевой полигон"
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
    // Standard mode: omit seed from player-facing summary
    if (gameMode === 'standard') {
      return `${width}×${height} ${t('mapSummary_tiles')} · ${styleLabel}`;
    }
    return `${width}×${height} ${t('mapSummary_tiles')} · ${styleLabel} · ${t('mapSummary_seed')}: ${seed}`;
  }

  return `${width}×${height} ${t('mapSummary_tiles')} · ${styleLabel} · ${t('mapSummary_predefined')}`;
}
