# FULL_PROJECT_AUDIT_20260529 — Four Elements Phaser

Status: full project audit and roadmap
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Reference/donor repo: `ratoker-jpg/four-elements-next` (donor/reference only)
Date: 2026-05-29

---

## 1. Резюме

### Текущий статус проекта

Проект Four Elements Phaser прошёл полный цикл Sandbox MVP engine/foundation (PR #83–#95). Реализована гражданская экономическая петля: raw → separator → matter → строительство → factory → юниты. Все 4 фракции отображаются корректно. Animation Manager мигрирован для харвестеров. QA smoke автоматизация покрывает базовый запуск. Валидация проходит: 751 unit-тест, typecheck, build, qa:smoke (2/2 PASS).

### Главный вывод

Sandbox MVP **функционально работает**, но **не ощущается как игра**. Это больше похоже на коллекцию отладочных систем с рабочей экономикой, чем на играбельный прототип. Игрок может начать игру, выбрать фракцию, запустить экономику и построить базу, но сессия не имеет чёткой цели, обратная связь местами техническая, а не игровая, и два HUD'а создают путаницу.

### Top 5 рисков

| # | Риск | Серьёзность | Описание |
|---|------|-------------|----------|
| 1 | Харвестеры застревают | **blocker** | Харвестер может перейти в idle/blocked без ясной обратной связи игроку. Известная проблема, паркованная до аудита. |
| 2 | Два HUD | **high** | Legacy top-bar HUD + PlaytestHud дублируют информацию и создают путаницу. Нет единого плана консолидации. |
| 3 | Нет мягкой цели | **high** | Игрок не понимает, что делать после запуска экономики. "Построй базу" — недостаточно для 10–15 минутной сессии. |
| 4 | CameraControls.destroy() | **medium** | Удаляет ВСЕ input listeners сцены, не только свои. Если вызвать отдельно от shutdown, сломает GameInputController. |
| 5 | updateGameState.ts — монолит 866 LOC | **medium** | Содержит стейт-машину харвестеров, фабрику, сепараторы, спавн, движение, BFS. Риск при изменениях. |

### Рекомендуемое направление

**Polish → Reliability → UX** — довести Sandbox MVP до ощущения играбельного прототипа, прежде чем добавлять фичи. Последовательность: playable loop polish → harvester reliability → HUD/UI pass → economy/balance → docs checkpoint.

---

## 2. Подтверждение репо/версии/PR

| Проверка | Ожидание | Факт | Совпадение |
|----------|----------|------|------------|
| Active repo | `ratoker-jpg/four-elements-phaser` | `ratoker-jpg/four-elements-phaser` | Да |
| Phaser version | 4.1.0 | `"phaser": "4.1.0"` в package.json | Да |
| PR #95 merged | Да | `fc37e25` — Merge pull request #95 | Да |
| CURRENT_NEXT_STEP.md | Не указывает на ARCH-02 | Указывает на ARCH-11A (завершён) | Да |
| Документы устарели | Ожидаются | PROJECT_STATE.md, NEW_CHAT_HANDOFF.md, CURRENT_NEXT_STEP.md — не обновлены после PR #95 | Да, устарели |

### Устаревшие документы (требуют обновления в отдельном docs checkpoint PR)

- `PROJECT_STATE.md` — описывает статус до PR #95
- `CURRENT_NEXT_STEP.md` — указывает на ARCH-11A как на следующий шаг
- `NEW_CHAT_HANDOFF.md` — не отражает завершение ARCH-11A
- `FIX_BACKLOG.md` — может потребовать обновления по итогам данного аудита

---

## 3. Что существует сейчас

### Сцены

| Сцена | LOC | Назначение |
|-------|-----|------------|
| BootScene | 20 | Минимальная загрузка → PreloadScene |
| PreloadScene | 55 | Загрузка всех ассетов через `loadGenerated*`. ModularUnits — только при devtools |
| MainMenuScene | 632 | New Game / Continue / Settings / Save list |
| NewGameSetupScene | 471 | Выбор фракции, карты, seed |
| GameScene | 604 | Основная игровая сцена, оркестрация всего |

### Игровое состояние (GameState)

- Чистый TypeScript, без Phaser-зависимостей
- 446 LOC в `types.ts`: полный тип-модел экономики, юнитов, зданий, сепараторов, фабрик
- Харвестеры: `HarvesterState` — 6 фаз, BFS-пути, blockedReason, cargo
- Строители: `BuilderPlacement` — 3 фазы, path, assignedSiteId
- Экономика: `EconomyState` — raw/matter/elements/power/separators/caps

### Экономика

- **Raw**: добывается харвестерами из ресурсных нод → разгружается на HQ
- **Matter**: производится сепараторами из raw (12 raw → 10 matter + 2 elementUnits, 5s цикл)
- **Power**: HQ = 10, Power Plant = 15. Сепаратор = 5, Фабрика = 4. Распределение по порядку строительства
- **Elements**: 4 фракции, elementUnits. Производятся сепараторами. Используются для производства юнитов
- **Storage caps**: HQ: raw 200, matter 200, element 200. raw-storage: +200 raw. matter-storage: +200 matter + element

### Харвестер-луп

- 6 фаз: idle → moving-to-resource → gathering → returning-to-hq → unloading → (idle)
- BFS pathfinding для движения к ресурсу и обратно к HQ
- Blocked-reason телеметрия (no-resources, no-approach-path, no-path-to-hq, raw-storage-full)
- Animation Manager мигрирован (walk cycle 8fps, idle single-frame)

### Строитель/строительство

- 3 фазы: idle → moving-to-site → building
- Авто-назначение на pending construction sites
- BFS к adjacent-tile от footprint
- Строительство продвигается только когда builder в фазе 'building'
- BUILDING_CONFIG: separator (60m, 20s), power-plant (100m, 25s), units-factory (120m, 40s)
- raw-storage, matter-storage, command-relay — типы существуют, но **нет в BUILDING_CONFIG**

### Фабрика/производство/отмена

- Queue limit = 2. Стоимость: builder 40m+10e/15s, harvester 50m+10e/20s
- Cancel без возврата ресурсов — intentional
- Unit cap = 10 (DEFAULT_UNIT_CAP)
- Spawn blockage feedback: unit-cap-reached, no-spawn-tile

### Загрузка ассетов

- 106 ключей: terrain(3) + resources(3) + hq(4) + buildings(24) + civilUnits(8) + modularUnits(64)
- Standard mode: 42 ключа (64 modularUnits пропускаются)
- Devtools/arena mode: 106 ключей
- `stripModularCombatFromState()` для старых сейвов в standard mode

### Рендеринг

- RenderTexture для terrain (статический, stamp один раз)
- EntityRenderer (495 LOC): харвестеры + HQ + ресурсы
- ConstructionRenderer (487 LOC): строитель + construction sites + completed buildings
- BuildingStatusRenderer (413 LOC): progress bars + status text
- FeedbackRenderer (230 LOC): command indicators, resource flow
- UnitMotionFxRenderer (269 LOC): dust particles
- ModularTankRenderer (293 LOC): hull + turret (devtools only)
- DebugOverlayRenderer (263 LOC): passability, footprints, resources

### Ввод

- GameInputController (543 LOC): pointer + keyboard + selection + commands
- CameraControls (159 LOC): pan/zoom/reset

### UI

- PlaytestHud (712 LOC): DOM overlay — economy, harvesters, separators, factory, build, production, diagnostics
- PauseMenu (329 LOC): Continue/Save/Restart/Main Menu
- DevtoolsPanel (531 LOC): resource/spawn controls, diagnostics, overlays
- AssetViewerPanel (296 LOC): asset registry browser
- Legacy top-bar HUD: coordinates, economy, build hints (в GameScene)

### Save/Load

- localStorage, versioned, max 5 slots
- Injectable storage backend для тестов
- Basic validation при загрузке

### QA tooling

- qa_smoke.mjs: dual-mode (standard + devtools), console markers, DOM assertion `#hud-economy`
- 27 unit-тест файлов, 751 тест, Vitest
- JSON + Markdown отчёты, screenshots

### Devtools/Arena

- `?devtools=1` / `?arena=1`: загрузка modularUnits, dev panel, debug overlays
- `isDevtoolsEnabled()` из `src/state/devCommands.ts`

### Asset pipeline

- generatedAssetManifest.ts (155 LOC): автогенерированный манифест
- generatedBuildingMeta.ts (470 LOC): метаданные для PNG placement
- buildingPlacementMeta.ts (418 LOC): origin/scale/anchor данных
- runtimeGeneratedAssets.ts (196 LOC): лоадеры
- runtimeAssetDiagnostics.ts (159 LOC): проверки загрузки
- assetDiagnostics.ts (427 LOC): аудит ассетов

---

## 4. Оценка текущего Sandbox MVP

### Что игрок может сделать сейчас

1. Запустить игру, выбрать фракцию (4 варианта)
2. Выбрать карту (фиксированная или сгенерированная с seed)
3. Наблюдать харвестеров, собирающих raw и разгружающих на HQ
4. Построить Separator, Power Plant, Units Factory через hotkeys (B/P/F)
5. Наблюдать работу сепаратора (raw → matter)
6. Заказать Builder или Harvester через hotkeys (N/G)
7. Отменить заказ в фабрике (кнопка X)
8. Достичь unit cap (10) и увидеть заблокированную фабрику
9. Сохранить/загрузить игру
10. Использовать devtools для диагностики

### Что ощущается завершённым

- Экономическая петля raw → matter → build → produce — работает
- Фракционные ассеты корректны для всех 4 фракций
- Save/Load стабилен для стандартного режима
- Unit cap и blocked feedback — функциональны
- QA smoke автоматизация покрывает базовый запуск

### Что ощущается как debug/prototype

- Два HUD с дублирующей информацией
- Статусы харвестеров технические ("No Approach Path", "Raw Storage Full") — неигровые
- Нет понимания "что делать дальше" после запуска экономики
- Нет визуального preview при строительстве — здание появляется мгновенно
- Diagnostics section в HUD показывает отладочную информацию
- Строитель использует `setFrame()` (нет walk animation)
- Dust particles — графические кружки, не настоящие частицы

### Что мешает удовлетворительной 10–15 минутной сессии

| Проблема | Серьёзность | Описание |
|----------|-------------|----------|
| Нет мягкой цели | **high** | Игрок не знает, к чему стремиться. "Построй базу" — не цель для 15 минут. Не ломает текущую функциональность, но снижает качество сессии |
| Харвестеры застревают | **blocker** | Харвестер может перейти в idle без видимой причины. Известная проблема |
| Два HUD | **high** | Legacy + PlaytestHud путают. Две панели с экономикой, разный формат |
| Blocked feedback технический | **high** | "No Approach Path" — непонятно игроку. Нужно "Resource blocked by buildings" |
| Нет next-step подсказок | **high** | После первых зданий — непонятно, что строить дальше |
| Нет визуального placement preview | **medium** | Здание появляется мгновенно без подтверждения позиции |

### Есть ли мягкая цель

**Нет.** Текущая неявная цель "построй базу и добывай ресурсы" недостаточна. Denis подтвердил: нужна простая Sandbox objective (построить рабочую базу, произвести N юнитов, достичь стабильной production, раскрыть часть карты), но формальный win/loss — позже.

---

## 5. Аудит игровых систем

### 5.1 Raw/Matter/Power экономика

**Наблюдение**: Экономическая модель функциональна и достаточна для Sandbox MVP. Raw → matter → build → produce — замкнутая петля. Power добавляет стратегический выбор: какие здания активировать.

**Проблема**: Element production работает, но элементы сейчас используются только для производства юнитов. Element — "транзитная валюта" без глубины. Это нормально для MVP, но элемент-связанные типы (raw-storage, matter-storage, command-relay) существуют в типах, но не в BUILDING_CONFIG.

**Влияние**: Низкое для MVP. Игрок может не замечать elements до тех пор, пока не попытается произвести юнитов.

**Рекомендация**: Парковка. Не углублять экономику до стабилизации playable loop.

### 5.2 Separator loop

**Наблюдение**: Сепаратор работает: 12 raw → 10 matter + 2 elementUnits за 5 секунд. Power allocation по порядку строительства.

**Проблема**: Если raw storage full — сепаратор молча останавливается. StatusHelpers корректно показывают "Matter Full" / "No Raw", но это видно только в PlaytestHud.

**Рекомендация**: Средний приоритет — улучшить feedback в world-space (BuildingStatusRenderer уже показывает статус, но текст технический).

### 5.3 Factory loop

**Наблюдение**: Фабрика работает: queue limit 2, cancel без возврата, spawn blockage feedback.

**Проблема**: Spawn position search (`findSpawnPosition`) вызывает `buildOccupancyMap` каждый вызов. Если фабрика окружена — юнит не появится, и feedback "No Spawn Tile" — технический.

**Рекомендация**: Низкий приоритет для MVP. Улучшить текст feedback.

### 5.4 Unit cap

**Наблюдение**: DEFAULT_UNIT_CAP = 10. Проверка при enqueue и при spawn.

**Проблема**: `getUnitCap()` — заглушка с `void state`. Denis указал: cap должен идти от command-relay, но это не immediate task.

**Рекомендация**: Парковка. Реализовать command-relay → unit cap в economy/balance pass.

### 5.5 Строительство

**Наблюдение**: BUILDING_CONFIG содержит 3 типа: separator, power-plant, units-factory. Размещение автоматическое — горячая клавиша → ближайшая позиция рядом со строителем.

**Проблемы**:
- Нет manual placement с preview — здание появляется мгновенно
- raw-storage, matter-storage, command-relay — типы существуют, но не могут быть построены
- builder идентифицируется по array index, не по stable ID

**Рекомендация**:
- Manual placement preview — later, после playable loop polish
- Добавить storage/command-relay в BUILDING_CONFIG — economy/balance pass
- Builder stable IDs — medium/high приоритет

### 5.6 Storage

**Наблюдение**: HQ обеспечивает базовый cap. raw-storage/matter-storage — бонусы существуют в константах, но не могут быть построены (нет в BUILDING_CONFIG).

**Рекомендация**: Парковка. Добавить в economy/balance pass.

### 5.7 Map resources

**Наблюдение**: 48×48 карта, детерминированная генерация. Ресурсы: small(20), medium(60), large(120), infinite(999999).

**Проблема**: Баланс ресурсов не проверен для 10–15 минутной сессии. Infinite resources у HQ могут делать экономику слишком простой.

**Рекомендация**: Парковка. Баланс map/resources — позже.

### 5.8 Session goals

**Наблюдение**: Нет мягкой цели. Denis подтвердил необходимость.

**Рекомендация**: Добавить простую Sandbox objective (например: "Produce 3 harvesters + build 2 separators + reach 100 matter" — мягкая цель без формального win/loss). Приоритет: high, в playable loop polish.

---

## 6. Аудит движения / поведения юнитов

### 6.1 Надёжность харвестеров — **КРИТИЧЕСКАЯ ПРОБЛЕМА**

**Наблюдение**: Харвестеры используют BFS pathfinding для движения к ресурсу и обратно к HQ. `handleIdle()` вызывает `findNearestAvailableResource()`, затем `findResourceApproachTile()` + `findPath()`. Если путь не найден — `blockedReason` устанавливается, но харвестер остаётся в фазе `idle` или `returning-to-hq` бесконечно.

**Известные сценарии застревания**:
1. `no-resources` — все ресурсы исчерпаны. Харвестер стоит idle навсегда без автоматического переключения
2. `no-approach-path` — ресурс окружён непроходимыми тайлами (здания). BFS не находит подхода
3. `no-path-to-hq` — HQ заблокирован постройками. Харвестер с cargo не может вернуться
4. `raw-storage-full` — raw storage заполнен, харвестер ждёт у HQ

**Корневые причины** (требуют подтверждения):
- `findNearestAvailableResource()` выбирает ближайший по прямой, но не проверяет достижимость до попытки pathfinding
- BFS вызывается на каждой смене фазы, что может быть дорого при многих юнитах
- Нет retry mechanism с backoff при повторных неудачах
- `handleReturningToHQ` при `no-path-to-hq` остаётся в той же фазе и повторяет BFS каждый кадр

**Влияние**: **blocker** для playable MVP. Харвестер, который перестал работать без объяснимой причины — главный источник фрустрации.

**Рекомендация**: Немедленный аудит/дизайн (SP-01). Потом scoped implementation.

### 6.2 Builder stable IDs

**Наблюдение**: `ConstructionSitePlacement.builderIndex` — числовой индекс в массиве `mapData.builders`. Если builder удалён или массив перестроен — index становится некорректным. `spawnBuilder()` генерирует ID через `builder-spawn-${tx}-${ty}-${Date.now()}`, но в `assignedSiteId` хранится числовой index, не ID.

**Влияние**: medium/high. Проблемы при save/load, при множественных builder'ах, при будущем multi-unit commands.

**Рекомендация**: Добавить стабильный `builderId: string` в BuilderPlacement. Приоритет: medium/high, но не blocker для playable loop.

### 6.3 Pathfinding

**Наблюдение**: BFS в `pathfinding.ts` (223 LOC). `findPath()` и `findPathToAdjacent()` корректны. `buildOccupancyMap()` вызывается часто — в `assignIdleBuilders`, `handleMovingToResource`, `handleReturningToHQ`, `findSpawnPosition`, `canPlaceBuilding`, `statusHelpers`.

**Проблема**: `buildOccupancyMap()` перестраивается каждый вызов. При 5+ юнитов одновременно это может стать узким местом. Однако текущий масштаб (48×48, ~10 юнитов) — приемлем.

**Рекомендация**: Парковка. Оптимизировать кешированием occupancy map только при появлении проблем производительности.

### 6.4 Дублирование movement helpers

**Наблюдение**:
- `moveToward()` в `updateGameState.ts` (строки 432–455) — для харвестеров
- `moveBuilderToward()` в `builder.ts` (строки 266–289) — для строителей
- Код идентичен, отличается только тип параметра (HarvesterState vs BuilderPlacement) и константа скорости

**Влияние**: medium. При изменении логики движения нужно править оба места.

**Рекомендация**: Вынести в общий `moveToward(entity: {ftx,fty,speedTilesPerSecond}, target, dt)`. Приоритет: medium, привязать к harvester reliability PR.

### 6.5 Дублирование getRingCandidates

**Наблюдение**: `getRingCandidates()` реализован дважды:
- В `updateGameState.ts` (строки 746–773) — для `findSpawnPosition()`
- В `statusHelpers.ts` (строки 282–309) — для `hasFactorySpawnTile()`

Код идентичен.

**Влияние**: low-medium. `statusHelpers` существует чтобы не дублировать логику, но сам дублирует helper.

**Рекомендация**: Вынести в общий модуль (например, `spawnHelpers.ts`). Приоритет: low, привязать к harvester/factory reliability PR.

### 6.6 Дублирование power allocation checks

**Наблюдение**: Логика power allocation повторяется 3 раза:
- `allocatePowerAndProcess()` в `updateGameState.ts` — мутация
- `computeAvailablePowerForBuilding()` в `statusHelpers.ts` — read-only реплика
- Условия separator resources (raw/caps/elements) — в обоих местах

**Влияние**: medium. При изменении power allocation нужно синхронизировать оба места.

**Рекомендация**: Вынести power allocation в общую pure функцию + обёртку с мутацией. Приоритет: medium, привязать к updateGameState decomposition.

### 6.7 Direction handling

**Наблюдение**: `directionFromDelta()` — чистая функция, корректная. DIR_LABELS для Animation Manager — в EntityRenderer.

**Рекомендация**: Нет проблем. Не трогать.

### 6.8 Animation state

**Наблюдение**: Харвестеры используют Animation Manager (walk cycle 8fps). Строители используют `setFrame()` — нет walk animation.

**Рекомендация**: Builder Animation Manager migration — later, после playable loop polish.

### 6.9 Selection marker grounding

**Наблюдение**: Selection highlight — пульсирующий cyan circle в `GameInputController`. Рисуется в `update()` каждый кадр через Graphics.

**Проблема**: Маркер рисуется на tile ground position, но юнит может быть между тайлами (ftx/fty). Визуально может не совпадать с позицией спрайта.

**Рекомендация**: Low приоритет. Исправить после playable loop.

### 6.10 Dust/motion FX

**Наблюдение**: UnitMotionFxRenderer рисует круги через Graphics. MAX_PARTICLES = 60.

**Рекомендация**: Парковка. Phaser Particles — later для polish.

---

## 7. Аудит UX/UI

### 7.1 Два HUD системы — **КРИТИЧЕСКАЯ ПРОБЛЕМА UX**

**Наблюдение**:
- **Legacy top-bar HUD**: `updateHUD()` в GameScene (строки 437–490). Показывает zoom/scroll, economy summary, harvester phases, factory status. DOM-элементы по ID из index.html.
- **PlaytestHud**: 712 LOC, fixed position top-right. Показывает economy с delta, harvesters, separators, factory с cancel, build buttons, production buttons, diagnostics.

**Проблемы**:
1. Информация дублируется: economy readout, harvester status, factory status — в обоих
2. Legacy HUD менее информативен, но занимает верх экрана
3. PlaytestHud имеет кнопки и интерактивность, legacy — read-only
4. Игрок не понимает, куда смотреть

**Влияние**: **high**. Конфузия для нового игрока.

**Рекомендация**:
1. **Немедленно**: Удалить или отключить legacy HUD, оставить PlaytestHud как единственный
2. **Опционально**: Переместить camera info в PlaytestHud
3. **Later**: Редизайн PlaytestHud для более чистого вида

Приоритет: high, первый PR в UX/UI pass.

### 7.2 PlaytestHud per-frame innerHTML

**Наблюдение**: `update()` вызывается каждый кадр (~60fps). Секции economy, harvesters, separators, factory, diagnostics — все перестраиваются через `innerHTML` каждый кадр.

**Проблема**: DOM churn. При 5+ harvesters и 3+ factories генерируется значительный объём innerHTML каждый кадр.

**Влияние**: medium. Может вызывать micro-stutter при большом количестве юнитов.

**Рекомендация**: Throttle до ~10fps или использовать targeted DOM updates (textContent для чисел, class toggle для статусов). Приоритет: medium, привязать к HUD consolidation PR.

### 7.3 Inline CSS дублирование

**Наблюдение**: Существенный inline CSS дублируется между файлами:
- PlaytestHud: ~150 строк inline CSS в `style.cssText`
- PauseMenu: ~50 строк
- DevtoolsPanel: ~80 строк
- NewGameSetupScene: ~60 строк
- MainMenuScene: ~70 строк

Общий объём: ~400+ строк дублированного inline CSS.

**Рекомендация**: Вынести общие стили в CSS классы. Не добавлять UI framework. Приоритет: low-medium, после playable loop стабилизации.

### 7.4 Build controls

**Наблюдение**: Горячие клавиши B/P/F для строительства. PlaytestHud кнопки с disable reasons. Размещение — автоматическое, рядом со строителем.

**Проблема**: Нет визуального preview здания. Игрок не видит, где появится здание, пока оно не построено.

**Рекомендация**: Manual placement с preview — later, scoped PR. Не смешивать с другими задачами.

### 7.5 Factory queue/cancel UX

**Наблюдение**: Cancel кнопка (X) для каждого queue item. Delegated click handler. Cancel без возврата — intentional.

**Проблема**: Blocked reason текст технический: "Unit Cap", "No Spawn Tile". Неигровой.

**Рекомендация**: Улучшить текст feedback: "Max units reached" вместо "Unit Cap". Приоритет: low, в UX pass.

### 7.6 Blocked feedback

**Наблюдение**: Харвестеры показывают blocked reason в PlaytestHud. BuildingStatusRenderer показывает status bars в world-space.

**Проблема**: Тексты технические: "No Approach Path", "Raw Storage Full". Для нового игрока — неинформативно.

**Рекомендация**: Перевести на понятные сообщения: "Can't reach resource", "Storage full, build Raw Storage". Приоритет: medium, в UX pass.

### 7.7 Menu/new game flow

**Наблюдение**: MainMenuScene → NewGameSetupScene → GameScene. Работает. `?skipMenu` для QA.

**Рекомендация**: Не редизайнить сейчас. Polish позже, если запутывает.

### 7.8 Camera controls

**Наблюдение**: Pan (drag), zoom (scroll), reset (R). Bounds от TerrainRenderer.

**Рекомендация**: Достаточно для MVP. Camera follow на выбранном юните — later.

### 7.9 UI scale

**Наблюдение**: CSS variable `--ui-scale` для PlaytestHud и других панелей. Settings menu.

**Проблема**: Legacy HUD не уважает UI scale. Нужно проверить все UI элементы.

**Рекомендация**: Проверить consistency при HUD consolidation.

### 7.10 Что путает игрока — сводка

| Область | Почему путает | Приоритет исправления |
|---------|---------------|----------------------|
| Почему харвестер остановился | Технический статус вместо понятного объяснения | High |
| Какая следующая цель | Нет soft goal / objective | High |
| Почему действие недоступно | "No Matter" вместо "Not enough Matter — need 60" | Medium |
| Что означает unit cap | Не объяснено в игре | Medium |
| Два HUD с разной информацией | Дублирование и путаница | High |
| Debug-looking системы | Diagnostics section, devtools panel видны | Low (devtools hidden по умолчанию) |

---

## 8. Аудит рендеринга / ассетов / Phaser 4

### 8.1 RenderTexture terrain

**Наблюдение**: TerrainRenderer (118 LOC) штампует все тайлы на RenderTexture один раз. Эффективно.

**Рекомендация**: Не менять. Хватит для MVP.

### 8.2 EntityRenderer

**Наблюдение**: 495 LOC. Харвестеры с Animation Manager. HQ + ресурсы как Image. Глубина: `100 + worldY`. Delegates: ConstructionRenderer, ModularTankRenderer.

**Проблемы**:
- `harvesterAnimRegistered` flag не сбрасывается при scene restart. Phaser AnimationManager persists — `exists()` guard достаточен. Low concern.
- `staticObjects` cleanup работает корректно в `destroy()`.

**Рекомендация**: Не менять архитектуру. Cleanup — low приоритет.

### 8.3 BuildingStatusRenderer

**Наблюдение**: 413 LOC. Graphics + Text, пересоздаётся каждый кадр (clear + redraw). Depth: 200+.

**Проблема**: Полная перерисовка каждого кадра — неидеально, но нормально для текущего масштаба.

**Рекомендация**: Парковка. Оптимизировать только при проблемах.

### 8.4 Asset pipeline

**Наблюдение**: Deprecated loaders в assetManifest.ts, buildingAssets.ts, civilUnitAssets.ts, modularUnitAssets.ts. Рабочие лоадеры — в runtimeGeneratedAssets.ts.

**Рекомендация**: Cleanup deprecated файлов — low-risk, отдельный PR. Не менять generatedAssetManifest.

### 8.5 Faction assets

**Наблюдение**: Все 4 фракции имеют HQ, harvester, builder, building sprites. Faction asset wiring работает корректно после FIX-01.

**Рекомендация**: Не нужен major faction work. Проверить completeness — low приоритет.

### 8.6 Animation Manager

**Наблюдение**: Харвестеры мигрированы (PHASER4-ANIM-02). Builder — нет.

**Phaser 4 Animation Manager**:
- **Стоит использовать**: Builder migration — прямой путь, низкий риск
- **Не стоит использовать сейчас**: Gathering/unloading animation — нет art frames
- **Риск**: `play()` меняет texture — необходимо per-faction animation keys (уже реализовано)

**Рекомендация**: Builder Animation Manager migration — later, после playable loop.

### 8.7 Loader

**Наблюдение**: Pack files поддерживаются, conditional loading реализован (PHASER4-LOAD-02).

**Phaser 4 Loader**:
- **Стоит использовать**: Faction-aware loading — feasible, но premature
- **Не стоит**: Asset unloading — risky, пока не появится чёткая потребность

**Рекомендация**: Faction-aware loading — later, после combat или роста asset count.

### 8.8 Containers

**Наблюдение**: Phaser 4 Containers доступны, не используются.

**Phaser 4 Containers**:
- **Потенциальная польза**: Группировка entity + marker + status bar в один Container для управления lifecycle
- **Риск**: Depth sorting. Container имеет единую depth. В изометрии каждый объект внутри контейнера должен сортироваться по worldY — контейнер не поддерживает per-child depth в painter's algorithm
- **Рекомендация**: Исследовать, но **не реализовывать** без глубокой проверки depth сортировки. Если Containers ломают isometric depth — отказаться.

### 8.9 Groups

**Наблюдение**: Phaser 4 Groups доступны, не используются.

**Рекомендация**: Groups могут упростить lifecycle/collection management ( создание/удаление группы харвестеров). Но не стоит добавлять только потому что API существует. Исследовать если появляется реальная проблема.

### 8.10 Tweens

**Наблюдение**: Используются для visual pulses (gathering, construction). Корректно.

**Рекомендация**: Minor improvements только. Не менять подход.

### 8.11 Particles

**Наблюдение**: Не используются. Dust — Graphics circles.

**Phaser 4 Particles**:
- **Стоит использовать**: Dust FX later — мягче, лучше выглядят
- **Не сейчас**: Не приоритет

### 8.12 Cameras

**Наблюдение**: Pan/zoom/reset работают. Follow target не используется.

**Рекомендация**: Camera follow на выбранном юните — nice-to-have later.

### 8.13 DOMElement

**Наблюдение**: UI построен на raw DOM overlays, не Phaser DOMElement.

**Phaser 4 DOMElement**:
- **Потенциальная польза**: Управление HUD через Phaser Scene lifecycle
- **Риск**: Миграция всего UI — большой refactor
- **Рекомендация**: Не сейчас. Первый приоритет — CSS/HUD consolidation, не обязательно через Phaser DOMElement.

### 8.14 Events

**Наблюдение**: Прямые вызовы между subsystems. No event bus.

**Phaser 4 Events**:
- **Стоит рассмотреть**: Если reduce coupling между GameScene и подсистемами
- **Не стоит**: Overengineer. Direct calls работают при текущем масштабе.

### 8.15 Data Manager

**Рекомендация**: Не приоритет. Вероятно, не нужен сейчас.

### 8.16 Phaser 4 API — сводка

| API | Использовать сейчас? | Причина |
|-----|---------------------|---------|
| Animation Manager | Да (builder migration) | Низкий риск, прямой путь |
| Loader / Pack | Нет (faction-aware) | Premature |
| Containers | Нет | Depth sorting risk в isometric |
| Groups | Нет | Нет реальной потребности |
| Tweens | Да (уже используем) | Minor improvements |
| Particles | Нет (later) | Не приоритет для playable loop |
| Camera follow | Нет (later) | Nice-to-have polish |
| DOMElement | Нет | Слишком большой refactor |
| Events | Нет | Direct calls работают |
| Data Manager | Нет | Не нужен |
| **SpriteGPULayer** | **НЕТ** | Isometric depth blocker (PHASER4-GPU-01) |
| **TilemapGPULayer** | **НЕТ** | Orthographic-only (PHASER4-GPU-01) |

---

## 9. Аудит архитектуры / качества кода

### 9.1 GameScene размер и ответственность

**Наблюдение**: GameScene.ts — 604 LOC. После GameInputController extraction — улучшился.

**Оставшиеся ответственности**:
- Scene lifecycle (create, update, shutdown)
- Game state management (new game, loaded save, arena)
- update() loop — 10 шагов (state → builders → construction → render → HUD → input → devtools → feedback → dust)
- Legacy HUD update
- Pause/resume logic

**Рекомендация**: Дальнейшая декомпозиция — carefully. Legacy HUD update вынести. Scene orchestration оставить в GameScene. Избегать одного огромного refactor PR.

### 9.2 updateGameState.ts — монолит

**Наблюдение**: 866 LOC. Содержит:
- Харвестер state machine (строки 86–455) — ~370 LOC
- Resource lookup helpers (строки 457–488) — ~30 LOC
- Direction computation (строки 490–517) — ~30 LOC
- Power allocation + separator processing (строки 519–666) — ~150 LOC
- Factory spawn logic (строки 668–818) — ~150 LOC
- Power recomputation (строки 820–842) — ~25 LOC
- Factory helpers / createHarvester (строки 844–867) — ~25 LOC

**Логические кандидаты для декомпозиции**:
1. `harvesterStateMachine.ts` — handleIdle, handleMovingToResource, handleGathering, handleReturningToHQ, handleUnloading, moveToward
2. `factorySpawn.ts` — processFactorySpawns, findSpawnPosition, getRingCandidates, spawnBuilder, spawnHarvesterUnit
3. `powerAllocation.ts` — allocatePowerAndProcess, recomputePower
4. `separatorProcessing.ts` — логика separator уже в allocatePowerAndProcess, но может быть выделена

**Риск**: medium/high. Декомпозиция может сломать тонкие зависимости.

**Рекомендация**: Staged decomposition. Сначала аудит/дизайн. Потом scoped PR sequence. Не делать полный rewrite в один PR.

### 9.3 State layer boundaries

**Наблюдение**: State layer — чистый TypeScript, без Phaser imports. Сильная сторона проекта.

**Рекомендация**: Сохранять. Unit test coverage — сильный (751 тестов). Не добавлять Phaser в state.

### 9.4 Renderer boundaries

**Наблюдение**: Renderers читают state и рендерят. Не владеют gameplay logic. EntityRenderer делегирует ConstructionRenderer и ModularTankRenderer. Facade методы на EntityRenderer — не создают maintenance risk.

**Рекомендация**: Не убирать facade методы без реальной потребности.

### 9.5 Input controller

**Наблюдение**: GameInputController (543 LOC) — выделен из GameScene. Pointer + keyboard + selection + commands.

**Рекомендация**: Declarative key binding table — later, не urgent.

### 9.6 Status helpers

**Наблюдение**: statusHelpers.ts (598 LOC). Реплицирует condition checks из updateGameState (power allocation, resource checks).

**Проблема**: Дублирование condition logic. При изменении в allocatePowerAndProcess нужно синхронизировать computeAvailablePowerForBuilding.

**Рекомендация**: Вынести shared conditions в pure selectors. Приоритет: medium, привязать к updateGameState decomposition.

### 9.7 Config/worldConfig mutable state

**Наблюдение**: `tunerState` и mutable offset records в worldConfig.ts. Runtime mutation через keyboard для dev tuning.

**Проблема**: Если dev behavior протекает в production — может быть баг.

**Рекомендация**: Low приоритет. Проверить, что dev tuning code не вызывается без `?devtools=1`.

### 9.8 File organization

**Рекомендация**: Не реорганизовывать папки для эстетики. Текущая структура логична.

### 9.9 Naming inconsistencies

**Проблемы**:
- Builder идентификация: `builderIndex` (array index) vs stable ID
- Building type: hyphenated (`raw-storage`) vs asset key underscored (`raw_storage`)
- `BUILDING_KEY_SUFFIXES` mapping helper существует

**Рекомендация**: Улучшить naming где влияет на стабильность (builder stable ID). Не делать broad rename без scoped и tested.

### 9.10 Дублирование — сводка

| Что дублируется | Где | Риск | Рекомендуемый приоритет |
|-----------------|-----|------|------------------------|
| `moveToward()` | updateGameState + builder | Изменение логики в одном месте | Medium — привязать к SP-01 |
| `getRingCandidates()` | updateGameState + statusHelpers | Разсинхронизация при изменении | Low — привязать к factory fix |
| Power allocation checks | updateGameState + statusHelpers | Разсинхронизация conditions | Medium — привязать к decomposition |
| Inline CSS | PlaytestHud + PauseMenu + DevtoolsPanel + scenes | Визуальная несогласованность | Low — после playable loop |
| Legacy HUD data | GameScene.updateHUD + PlaytestHud | Два источника правды | High — HUD consolidation |

---

## 10. Аудит QA / тестирования

### 10.1 Unit tests

**Наблюдение**: 27 файлов, 751 тест, все проходят. Покрытие state layer сильное.

**Проблемы**:
- Нет тестов для renderer логики (acceptably — renderer validated by typecheck/build/manual)
- Нет integration/browser тестов для UI interactions
- `mapValidation.test.ts` — самый медленный (1.8s), работает с реальной картой

### 10.2 ARCH-11A smoke

**Наблюдение**: Dual-mode smoke (standard + devtools). Console markers + DOM assertion `#hud-economy`. Screenshots для manual review. Runtime ~15s total.

**Проблема**: Не проверяет функциональность экономики — только startup.

**Рекомендация**: Текущая strictness достаточна. Interaction tests — после HUD consolidation.

### 10.3 CI expectations

**Наблюдение**: qa_smoke.mjs работает локально. Нет CI workflow файла в репо.

**Рекомендация**: CI smoke должен быть required — позже, не immediate.

### 10.4 Report artifacts

**Наблюдение**: JSON + Markdown + PNG screenshots. Хороший формат.

**Рекомендация**: Улучшить summary readability — low приоритет.

### 10.5 Что тестировать дальше

| Что | Тип | Когда |
|-----|-----|-------|
| Harvester stuck scenarios | Unit tests (state) | После SP-01 audit/design |
| Factory spawn edge cases | Unit tests | После factory fixes |
| HUD consolidation | Manual QA | После HUD PR |
| Long session stability | Manual playtest | Всегда |
| Save/load round-trip | Unit test + manual | После изменений |

### 10.6 Что НЕ автоматизировать сейчас

- Playwright click interactions — HUD volatile, нет flake plan
- Screenshot pixel diff — артефакты для manual review только
- Broad browser compatibility — не приоритет

### 10.7 Manual QA gaps

Нет formal manual playtest checklist. Данный аудит включает checklist в секции 16.

---

## 11. Аудит Save/Load / session stability

### 11.1 Текущее состояние

- localStorage-based, versioned (version 1), max 5 slots
- Basic validation при загрузке: version match, playerFaction, economy exist
- Injectable storage backend для тестов
- `stripModularCombatFromState()` для старых сейвов

### 11.2 Modular-combat stripping

**Наблюдение**: `stripModularCombatFromState()` работает. PHASER4-LOAD-02.

**Рекомендация**: Стабильно. Не нужен rewrite.

### 11.3 Старые сейвы

**Проблема**: Если GameState schema меняется (новые поля), старые сейвы могут не загрузиться корректно. Validation минимальный — проверяет только playerFaction и economy.

**Рекомендация**: Добавить migration path или более строгую validation при schema changes. Приоритет: low, после первых реальных schema changes.

### 11.4 Long session risks

**Проблемы**:
- Нет autosave — при краше браузера прогресс теряется
- localStorage имеет ~5MB лимит — большие сейвы могут не вместиться
- Нет cleanup старых/depleted resource nodes в save data

**Рекомендация**: Autosave — nice-to-have later. Не immediate.

### 11.5 Что тестировать вручную

- Save в начале игры → Load → продолжить
- Save с 5+ юнитами и 5+ зданиями → Load → проверить состояние
- Save в devtools mode → Load в standard mode (modular-combat stripping)
- Save → построить здание → Load → здание не должно дублироваться
- Delete save → проверить удаление
- 5 saves → попытка 6-го → error message

---

## 12. Матрица рисков

| # | Нахождение | Серьёзность | Вероятность | Влияние | Рекомендуемый тайминг | Первый PR |
|---|-----------|-------------|-------------|---------|----------------------|-----------|
| 1 | Харвестеры застревают | blocker | high | Нег playable session | Now | SP-01 audit |
| 2 | Нет soft goal/objective | high | certain | Нет мотивации играть 15 мин | Now | PLAY-01 |
| 3 | Два HUD | high | certain | Игрок путается | Now (Next) | HUD-01 |
| 4 | CameraControls.destroy() | medium | low-medium | Сломает input при частичном cleanup | Now | FIX-05 |
| 5 | updateGameState монолит | medium | medium | Сложность изменений | Next | DECOMP-01 |
| 6 | Blocked feedback технический | high | certain | Игрок не понимает | Now (Next) | UX-01 |
| 7 | Builder array index | medium | medium | Save/load, selection bugs | Next | BUILDER-ID |
| 8 | moveToward дублирование | medium | medium | Разсинхронизация при изменениях | Next | DEDUPE-01 |
| 9 | PlaytestHud innerHTML per frame | medium | low | Micro-stutter при масштабе | Later | HUD-02 |
| 10 | Power allocation дублирование | medium | medium | Разсинхронизация conditions | Next | DECOMP-01 |
| 11 | Inline CSS ~400+ строк | low | certain | Technical debt | Later | CSS-01 |
| 12 | Builder нет walk animation | low | certain | Визуально rough | Later | ANIM-03 |
| 13 | Deprecated loader файлы | low | certain | Technical debt | Later | CLEANUP-01 |
| 14 | worldConfig mutable state | low | low | Dev behavior в production | Later | — |
| 15 | Нет CI workflow | medium | certain | Регрессии не ловятся автоматически | Later | CI-01 |

---

## 13. Матрица Now / Next / Later / Never

### Now — ближайшая последовательность PR (5–8 штук)

| ID | Задача | Тип |
|----|--------|-----|
| SP-01 | Harvester/pathfinding reliability audit/design | audit/design |
| PLAY-01 | Sandbox soft goal / objective implementation | implementation |
| HUD-01 | Legacy HUD removal / HUD consolidation decision | implementation |
| FIX-05 | CameraControls.destroy() bound handlers fix | implementation |
| UX-01 | Blocked feedback player-readable messages | implementation |
| BUILDER-ID | Builder stable IDs | implementation |
| DEDUPE-01 | MoveToward + getRingCandidates deduplication | implementation |

### Next — после стабилизации playable loop

| ID | Задача |
|----|--------|
| DECOMP-01 | updateGameState.ts staged decomposition |
| ANIM-03 | Builder Animation Manager migration |
| HUD-02 | PlaytestHud throttled/targeted DOM updates |
| CSS-01 | Shared CSS classes extraction |
| ECON-01 | Economy/balance pass (storage buildings, command-relay, refund) |
| DOCS-01 | Docs checkpoint (PROJECT_STATE, CURRENT_NEXT_STEP, etc.) |

### Later — будущая работа

| ID | Задача |
|----|--------|
| COMBAT-01 | Combat foundation audit (после Sandbox MVP polish) |
| ENEMY-01 | Enemy/bot (после combat) |
| PLACE-01 | Manual building placement с preview |
| MAP-01 | Map generation/resources balance |
| ONBOARD-01 | Onboarding/tutorial |
| PARTICLE-01 | Phaser Particles для dust FX |
| CAMERA-01 | Camera follow на выбранном юните |
| CI-01 | CI smoke workflow |
| CLEANUP-01 | Deprecated loader file cleanup |
| SAVE-01 | Autosave / session stability improvements |

### Never / не сейчас

- **Combat implementation** — parked until Sandbox MVP polished
- **Enemy/bot** — parked
- **GPU layer implementation** (SpriteGPULayer / TilemapGPULayer) — rejected by PHASER4-GPU-01 spike
- **Elements as immediate feature** — parked for upgrades/faction progression/combat
- **Faction-aware loading** — premature per PHASER4-LOAD-01
- **Broad UI framework** — не добавлять
- **Giant updateGameState rewrite в один PR** — staged decomposition только
- **Playwright click tests** — пока нет flake plan
- **Canvas fallback / legacy renderer** — запрещено
- **Rex plugins** — запрещено
- **Package dependency changes** — только с отдельного approval

---

## 14. Рекомендуемая последовательность roadmap

### Фаза 1: Playable Sandbox Polish + Reliability (Now)

| # | Task ID | Название | Тип | Риск | Ожидаемые файлы | Зависимости | Validation | Manual QA |
|---|---------|----------|-----|------|-----------------|-------------|------------|-----------|
| 1 | **SP-01** | Harvester/pathfinding reliability audit/design | audit/design | low | docs/project/ | None | audit report only | — |
| 2 | **SP-02** | Harvester reliability fixes (scoped from SP-01) | implementation | medium | src/state/updateGameState.ts, src/state/pathfinding.ts, src/state/unitCommands.ts | SP-01 | npm test, typecheck, build, qa:smoke | Харвестеры не застревают 10 мин |
| 3 | **PLAY-01** | Sandbox soft goal implementation | implementation | low-medium | src/state/objectives.ts (new), src/state/types.ts, src/phaser/ui/PlaytestHud.ts, src/phaser/GameScene.ts | None | npm test, typecheck, build, qa:smoke | Цель видна в HUD |
| 4 | **HUD-01** | Legacy HUD removal + HUD consolidation | implementation | low-medium | src/phaser/GameScene.ts, index.html | None | typecheck, build, qa:smoke | Один HUD, нет дублей |
| 5 | **FIX-05** | CameraControls.destroy() bound handlers | implementation | low | src/phaser/input/CameraControls.ts | None | npm test, typecheck, build | Destroy не ломает input |
| 6 | **UX-01** | Player-readable blocked feedback messages | implementation | low | src/state/statusHelpers.ts, src/phaser/ui/PlaytestHud.ts, src/phaser/render/BuildingStatusRenderer.ts | None | npm test, typecheck, build | Сообщения понятны |
| 7 | **BUILDER-ID** | Builder stable IDs | implementation | medium | src/state/types.ts, src/state/builder.ts, src/state/construction.ts, src/state/updateGameState.ts, src/state/saveGame.ts | None | npm test, typecheck, build, qa:smoke | Builder selection/save/load работает |
| 8 | **DEDUPE-01** | MoveToward + getRingCandidates deduplication | implementation | low | src/state/movementHelpers.ts (new), src/state/updateGameState.ts, src/state/builder.ts, src/state/statusHelpers.ts | None | npm test, typecheck, build | Тесты проходят |

### Фаза 2: Architecture + UX Pass (Next)

| # | Task ID | Название | Тип | Риск | Ожидаемые файлы | Зависимости |
|---|---------|----------|-----|------|-----------------|-------------|
| 9 | **DECOMP-01** | updateGameState staged decomposition — audit/design | audit/design | low | docs/project/ | SP-02, BUILDER-ID |
| 10 | **DECOMP-02** | Harvester state machine extraction | implementation | medium-high | src/state/harvesterStateMachine.ts (new), src/state/updateGameState.ts | DECOMP-01 |
| 11 | **DECOMP-03** | Factory spawn + power allocation extraction | implementation | medium | src/state/factorySpawn.ts, src/state/powerAllocation.ts (new) | DECOMP-02 |
| 12 | **ANIM-03** | Builder Animation Manager migration | implementation | low-medium | src/phaser/render/ConstructionRenderer.ts | None |
| 13 | **HUD-02** | PlaytestHud DOM update optimization | implementation | low-medium | src/phaser/ui/PlaytestHud.ts | HUD-01 |
| 14 | **CSS-01** | Shared CSS classes extraction | implementation | low | src/styles.css, src/phaser/ui/*.ts | HUD-01 |
| 15 | **DOCS-01** | Docs checkpoint (PROJECT_STATE, CURRENT_NEXT_STEP, etc.) | docs-only | low | docs/project/PROJECT_STATE.md, etc. | All above |

### Что НЕ трогать в каждой задаче

Каждый PR должен явно указать "What was intentionally NOT changed". Общие ограничения:
- Не менять gameplay movement/pathfinding/state logic в UI/renderer PR
- Не менять renderer в state PR
- Не менять assets в code PR
- Не добавлять новые building types без explicit scope
- Не трогать PreloadScene или generatedAssetManifest без direct root cause

---

## 15. Первые 3 готовых GLM-промпта

> **Примечание о порядке промптов vs roadmap.** Первые 3 готовых промпта (SP-01, HUD-01, BUILDER-ID) не совпадают с первыми 3 задачами roadmap (SP-01, SP-02, PLAY-01). SP-02 зависит от результатов SP-01, поэтому его промпт должен быть сгенерирован после завершения SP-01. PLAY-01 лучше генерировать после подтверждения roadmap. Включённые промпты покрывают первую задачу audit/design плюс два вероятных кандидата на implementation, но порядок roadmap остаётся авторитетным.

### Промпт 1: SP-01 — Harvester/pathfinding reliability audit/design

```markdown
Task:
SP-01 — Harvester/pathfinding reliability audit/design

Mode:
AUDIT REPORT ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #96 / FULL-PROJECT-AUDIT-01.
4. Read docs/project/FULL_PROJECT_AUDIT_20260529.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/FULL_PROJECT_AUDIT_20260529.md
- src/state/updateGameState.ts
- src/state/pathfinding.ts
- src/state/unitCommands.ts
- src/state/occupancy.ts
- src/state/builder.ts
- src/state/statusHelpers.ts
- src/phaser/render/EntityRenderer.ts
- src/phaser/GameScene.ts

Context:
Harvesters can enter idle/blocked states without clear player feedback.
Known stuck scenarios: no-resources, no-approach-path, no-path-to-hq, raw-storage-full.
The harvester state machine is in updateGameState.ts (~370 LOC of harvester logic).
BFS pathfinding is in pathfinding.ts.
The player experience goal is: harvesters should never appear "stuck" without
a clear, actionable reason shown to the player.
Harvester reliability is the #1 blocker for playable MVP (per FULL_PROJECT_AUDIT_20260529).

Goal:
Produce a detailed audit/design report that:

1. Identifies all scenarios where harvesters stop making visible progress
2. Maps root causes for each scenario (state logic, pathfinding, occupancy)
3. Determines whether BFS contributes to stuck cases
4. Proposes the smallest PR sequence to fix reliability
5. Evaluates whether A* is needed or BFS is sufficient
6. Identifies all duplicated movement/status logic that should be deduplicated
7. Proposes player-facing improvements (what the player should see)

Scope:
- Read-only audit. Do not edit runtime files.
- Focus on harvester reliability first, builder second.
- Do not recommend combat, enemy, bot, GPU, elements, or faction-aware loading.
- Do not recommend a giant updateGameState rewrite.
- Do recommend staged, scoped PR sequence with risk assessment.

Hard rules:
- Do not edit runtime code
- Do not edit tests
- Do not edit package files
- Do not edit assets
- Do not start implementation
- Do not merge

Output:
- Create docs/project/SP_01_HARVESTER_RELIABILITY_AUDIT.md
- Open docs-only PR into main
- Do not merge

Include in the audit report:
- Root cause analysis for each stuck scenario
- Recommended PR sequence (task IDs, risk, touched files, validation)
- What NOT to do
- Whether builder stable IDs should be in the same PR sequence

Validation:
- Audit report only — no runtime validation required
- Confirm audit file exists and is complete
- Confirm PR is docs-only (no src/ changes)

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

### Промпт 2: HUD-01 — Legacy HUD removal / HUD consolidation

```markdown
Task:
HUD-01 — Legacy HUD removal + HUD consolidation

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #96 / FULL-PROJECT-AUDIT-01.
4. Read docs/project/FULL_PROJECT_AUDIT_20260529.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/FULL_PROJECT_AUDIT_20260529.md
- src/phaser/GameScene.ts
- src/phaser/ui/PlaytestHud.ts
- index.html
- src/styles.css

Context:
The project currently has two HUD systems:
1. Legacy top-bar HUD in GameScene.updateHUD() — reads DOM elements by ID
2. PlaytestHud — DOM overlay sidebar with full economy, build, production controls

The audit determined that the legacy HUD should be removed and PlaytestHud
should become the single main HUD. Camera info (zoom, scroll position)
should be moved into PlaytestHud or removed.
Two HUDs are rated high severity in the project audit — they confuse new players.

Goal:
Remove the legacy HUD system and make PlaytestHud the single source of
economy/status/controls information.

Scope:
- Remove legacy HUD DOM elements from GameScene (hudCoords, hudMapName,
  hudEconomy, hudBuild, hudBuilder)
- Remove updateHUD() method from GameScene
- Remove or comment out legacy HUD DOM elements in index.html
- Optionally move camera info into PlaytestHud diagnostics section
- Do NOT redesign PlaytestHud layout
- Do NOT add new UI features
- Do NOT change PlaytestHud styling significantly

Hard rules:
- Do not change gameplay state logic
- Do not change renderer code
- Do not change assets
- Do not add new dependencies
- Do not break qa:smoke (DOM assertion for #hud-economy must still work)
- If removing #hud-economy from legacy HUD, ensure PlaytestHud has an
  equivalent element that qa:smoke can assert
- Do not merge

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA:
- Start standard game — only one HUD visible
- Economy readout works in PlaytestHud
- Build/production buttons work
- Camera info visible somewhere
- No empty DOM areas where legacy HUD was
- qa:smoke passes

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

### Промпт 3: BUILDER-ID — Builder stable IDs

```markdown
Task:
BUILDER-ID — Builder stable IDs

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #96 / FULL-PROJECT-AUDIT-01.
4. Read docs/project/FULL_PROJECT_AUDIT_20260529.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/FULL_PROJECT_AUDIT_20260529.md
- src/state/types.ts
- src/state/builder.ts
- src/state/construction.ts
- src/state/updateGameState.ts
- src/state/saveGame.ts
- src/state/createInitialState.ts
- src/phaser/input/GameInputController.ts
- src/phaser/render/ConstructionRenderer.ts

Context:
Builders currently use array index for identification (builderIndex).
This is fragile: if the builders array is reordered or an element is removed,
all indices shift. Harvesters use stable string IDs (e.g., "harvester-spawn-...").
Builders should follow the same pattern for consistency and safety.
Builder array index is rated medium severity in the project audit —
it causes save/load and selection bugs with multiple builders.

Goal:
Add stable string IDs to BuilderPlacement and update all references
from array index to stable ID where it affects correctness.

Scope:
- Add `id: string` field to BuilderPlacement interface in types.ts
- Update ConstructionSitePlacement to use `builderId: string | null` instead of
  `builderIndex: number` (where builderIndex === -1 means no builder)
- Update all builder lookup code to use ID instead of index
- Update spawnBuilder to generate stable ID
- Update createInitialState to assign IDs to initial builders
- Update save/load compatibility (migration for old saves with builderIndex)
- Update GameInputController selection (currently uses builder index)
- Update ConstructionRenderer and EntityRenderer references
- Add unit tests for builder ID lookup

Hard rules:
- Do not change harvester logic
- Do not change renderer visual behavior
- Do not change assets
- Do not add new gameplay features
- Keep backward compatibility for save/load (old saves with builderIndex
  should still load — map old index to new ID)
- Do not change BUILDING_CONFIG
- Do not start other tasks
- Do not merge

Validation:
- npm test (all 751+ tests must pass)
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA:
- Start new game — builders have correct IDs
- Build a building — builder assigned by ID
- Save → Load — builders maintain IDs
- Select builder via click — works correctly
- Multiple builders — no confusion
- Factory spawn builder — gets stable ID

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

---

## 16. Manual playtest checklist

### Базовый запуск

- [ ] Запустить стандартную игру (без devtools)
- [ ] Выбрать фракцию (не cyan — проверить faction assets)
- [ ] Наблюдать начальную базу: HQ + харвестеры видны
- [ ] Камера: pan (drag), zoom (scroll), reset (R) работают

### Экономика

- [ ] Харвестер движется к ресурсу
- [ ] Харвестер собирает raw (cargo counter увеличивается)
- [ ] Харвестер возвращается к HQ
- [ ] Харвестер разгружает raw (economy raw counter увеличивается)
- [ ] Сепаратор обрабатывает raw → matter (progress bar двигается)

### Строительство

- [ ] Нажать B — построить Separator (здание появляется)
- [ ] Нажать P — построить Power Plant
- [ ] Нажать F — построить Units Factory
- [ ] Строитель движется к construction site
- [ ] Progress bar двигается, когда строитель на месте

### Производство

- [ ] Нажать N — заказать Builder (queue отображается)
- [ ] Нажать G — заказать Harvester
- [ ] Progress bar двигается в фабрике
- [ ] Юнит появляется рядом с фабрикой

### Unit cap

- [ ] Произвести юнитов до unit cap (10)
- [ ] Фабрика показывает "Unit Cap" / заблокирована
- [ ] Дальнейшие заказы невозможны

### Factory cancel

- [ ] Заказать юнит в фабрике
- [ ] Нажать X (cancel button) — юнит удалён из очереди
- [ ] Matter не возвращается (intentional)

### Blocked harvester

- [ ] Построить здание, блокирующее путь к ресурсу
- [ ] Наблюдать, что харвестер показывает blocked status
- [ ] Проверить, понятен ли reason

### Save/Load

- [ ] Сохранить игру (Esc → Save)
- [ ] Вернуться в главное меню
- [ ] Continue → загрузить последний сейв
- [ ] Проверить, что экономика, юниты, здания на месте

### Devtools/Arena

- [ ] Запустить `?devtools=1&arena=1`
- [ ] Devtools panel видна
- [ ] +Raw, +Matter работают
- [ ] Spawn Builder/Harvester работают
- [ ] Debug overlays (T) переключаются

### UI/визуальные проблемы

- [ ] Один HUD (после HUD-01) или два (до) — отметить
- [ ] Статусы харвестеров понятны
- [ ] Blocked reasons читаемые
- [ ] Нет console errors
- [ ] Нет визуальных артефактов (мерцание, наложение)
- [ ] Camera info видна

---

## 17. Do not do list

Следующее **НЕ делать** как immediate implementation:

1. **Combat implementation** — parked until Sandbox MVP polished
2. **Enemy/bot** — parked
3. **GPU layer implementation** (SpriteGPULayer / TilemapGPULayer) — rejected by PHASER4-GPU-01
4. **Elements as immediate feature** — parked for upgrades/faction/combat
5. **Faction-aware loading** — premature per PHASER4-LOAD-01
6. **Broad UI framework** — не добавлять
7. **Giant updateGameState rewrite в один PR** — staged decomposition только
8. **Playwright click tests** — пока нет flake plan
9. **Canvas fallback / legacy renderer** — запрещено
10. **Rex plugins** — запрещено
11. **Package dependency changes** — только с отдельного approval
12. **Multi-tier processing / complex economy** — не углублять до playable loop
13. **Scouts/transport/combat units** — later
14. **Refund economy** — later, в economy/balance pass
15. **Box select / multi-select** — later, перед combat или larger unit counts
16. **Full UI redesign** — не до playable loop stabilisation

---

## 18. Финальная рекомендация

### Должен ли проект продолжить с polish/reliability перед фичами?

**Да.** Проект должен продолжить с polish/reliability перед любыми новыми фичами. Текущий Sandbox MVP функционален, но не играбелен в смысле "хочется играть ещё". Харвестеры застревают, нет цели, два HUD, технический feedback. Эти проблемы нужно решить до добавления combat, enemy, upgrades, или расширенной экономики.

### Каким должен быть immediate next prompt?

**SP-01 — Harvester/pathfinding reliability audit/design.** Это самый важный блокер для playable MVP. После SP-01 audit, sequence: SP-02 (fixes) → PLAY-01 (soft goal) → HUD-01 (HUD consolidation) → FIX-05 (CameraControls) → UX-01 (feedback) → BUILDER-ID → DEDUPE-01.

### Нужен ли docs checkpoint после аудита?

**Да.** После approval данного аудита, нужен отдельный docs checkpoint PR, обновляющий:
- `PROJECT_STATE.md`
- `CURRENT_NEXT_STEP.md`
- `NEW_CHAT_HANDOFF.md`
- `FIX_BACKLOG.md`
- Возможно, `CHECKPOINT` doc

Но **этот** аудит PR не должен обновлять эти документы — только создать `FULL_PROJECT_AUDIT_20260529.md`.

---

## Приложение A: Команды валидации

| Команда | Результат | Детали |
|---------|-----------|--------|
| `npm test` | PASS | 27 test files, 751 tests passed, 2.16s |
| `npm run typecheck` | PASS | `tsc --noEmit` — без ошибок |
| `npm run build` | PASS | 61 modules, 1868.58 kB main chunk, 3.87s |
| `npm run qa:smoke` | PASS | Standard: PASS (4.9s), Devtools: PASS (2.6s), Combined: PASS (14.7s) |

---

## Приложение B: LOC сводка по модулям

| Модуль | Файлов | LOC |
|--------|--------|-----|
| src/state/ | 20 | 6800 |
| src/phaser/ | 21 | ~7200 |
| src/assets/ | 10 | 2173 |
| src/config/ | 3 | 223 |
| src/__tests__/ | 27 | 10533 |
| tools/ | 11 | ~5400 |
| docs/project/ | 14 | ~8000+ |
| **Total src** | — | **~17000** |

---

## Приложение C: Сравнение с four-elements-next (donor/reference only)

| Аспект | four-elements-phaser | four-elements-next (reference) | Примечание |
|--------|---------------------|-------------------------------|------------|
| Engine | Phaser 4.1.0 | Phaser 3.90 | Разные API |
| Framework | Vite + TypeScript | Next.js | Разная архитектура |
| Rendering | WebGL-only | Canvas + WebGL fallback | Phaser 4: WebGL only |
| Isometric | Custom 2:1 RenderTexture | Custom 2:1 | Аналогичный подход |
| Economy | raw/matter/elements/power | raw/matter/elements/power | Концепции совпадают |
| ControlState | DEFAULT_UNIT_CAP = 10 | Command-relay based cap | Phaser version: заглушка |
| Animation | Animation Manager (harvester) | Manual frame indexing | Phaser 4: лучше |
| Save/Load | localStorage | localStorage | Аналогично |
| Devtools | isDevtoolsEnabled() + arena | Разные подходы | Phaser version: чище |

**Важно**: four-elements-next — reference only. Не копировать код напрямую. Концепции — можно адаптировать к Phaser 4.
