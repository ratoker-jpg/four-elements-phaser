# ROADMAP SYSTEM AUDIT 01D — Four Elements Phaser

**Дата:** 2026-03-04 (оригинал) / 01B: 2026-05-26 / 01C: 2026-05-26 / **01D:** 2026-05-26
**Статус:** Финальная ревизия — **source-of-truth после мержа ARCH-00-docs** для будущих GPT/GLM промптов. До мержа ARCH-00-docs — справочный документ с подготовленными, но не замерженными workflow-файлами. Отчёт только, без изменений кода
**Проект:** `ratoker-jpg/four-elements-phaser`
**Референс-донор:** `ratoker-jpg/four-elements-next`
**Art-пайплайн референс:** `studioigor/ashen-crown`
**Триггер:** ROADMAP.md требует системного аудита перед продолжением реализации

---

## 0. Current main sync (Синхронизация с текущим main)

> **Note:** This section describes repo state at audit time before PR #31 / ARCH-00-docs merge.
> After PR #31 merge, `docs/project/` files and `docs/ROADMAP_SYSTEM_AUDIT.md` are expected to be on main.

**Commit:** `acf5820` (merge PR #30 — BUILD-ANCHOR-01)

### Уже сделано / замержено

| Компонент | Файл(ы) | PR / коммит |
|-----------|---------|-------------|
| BuildingPlacementMeta data model | `src/assets/buildingPlacementMeta.ts` + test | PR #30 (BUILD-ANCHOR-01) |
| Construction core (Separator) | `src/state/construction.ts` | PR #20 (ARCH-13E1) |
| Build site selection (spiral search + auto) | `src/state/buildSiteSelection.ts` | PR #24 (ARCH-13E4) |
| Builder state machine + movement | `src/state/builder.ts` | PR #22 (ARCH-13E3) |
| Occupancy grid | `src/state/occupancy.ts` | PR #19 (ARCH-13C+D) |
| BFS pathfinding | `src/state/pathfinding.ts` | PR #19 (ARCH-13C+D) |
| Construction renderer (amber/green diamonds, progress bar, builder sprite) | `src/phaser/render/ConstructionRenderer.ts` | PR #21-27 |
| Builder spritesheet rendering | `src/phaser/render/ConstructionRenderer.ts` | PR #27 (ASSET-02) |
| Modular tank renderer (extracted from EntityRenderer) | `src/phaser/render/ModularTankRenderer.ts` + `ModularTankDebugOverlay.ts` | PR #7 → refactor |
| Building placement strategy doc | `docs/BUILDING_PLACEMENT_STRATEGY.md` | PR #29 (DOC-01) |
| Civil + building assets ported | `src/assets/buildingAssets.ts`, `civilUnitAssets.ts` | PR #26 (ASSET-01) |
| Construction UX / QA cleanup | various | PR #25 (ARCH-13F1) |
| 10 unit-тестов | `src/__tests__/` | cumulative |

### Частично сделано

| Компонент | Что есть | Что отсутствует |
|-----------|----------|-----------------|
| Строительство (render) | Amber/green diamonds, progress bar, builder sprite | Нет PNG-рендеринга completed buildings через BUILD-ANCHOR metadata; нет staged placeholder → PNG transition |
| Экономика | Только `rawMinerals` в GameState | Нет matter, elements, power, control, storage caps, separator processing |
| Харвестер | Полный auto-gather loop | Нет pathfinding в харвестерном цикле (проходят сквозь стены); нет manual move override |

### Отсутствует (verify before tasking)

| Компонент | Критичность |
|-----------|-------------|
| EconomyState (raw/matter/elements/power/control) | 🔴 Критично |
| Offline alpha-bounds generator (BUILD-ANCHOR-02) | 🟡 Важный следующий шаг |
| South-vertex building placement в ConstructionRenderer (BUILD-ANCHOR-03) | 🟡 Важный следующий шаг |
| Unit selection / control system | 🔴 Критично |
| Separator processing cycle (raw → matter + elements) | 🔴 Критично |
| Units-factory production | 🟡 |
| Cancel/refund UX для строительства | 🟡 |
| No-route UX | 🟡 |
| Full build menu UI | 🟡 |
| Production-ready building renderer using BUILD-ANCHOR metadata | 🟡 |
| Construction visual polish | 🟢 |
| VFX (dust, inertia, feedback) | 🟢 |
| Mapgen | 🟡 |
| E2E тесты | 🔴 |

### Superseded / закрыто

| Компонент | Статус | Примечание |
|-----------|--------|------------|
| PR #28 — Separator manual tuner/render path | ❌ Закрыт, не замержен | Подход `displayWidth/originY/offsetX/offsetY` ручной калибровки не масштабируется. Только diagnostic learning. Продакшн-путь — BUILD-ANCHOR модель |

### Подготовлено, но не замержено (Prepared but not merged)

Следующие файлы подготовлены и приняты как контент, но **не находятся на текущем main**. Они войдут в main через PR `ARCH-00-docs`. До мержа ARCH-00-docs — эти файлы существуют только вне main (в рабочем контексте / ветке / локально).

| Файл | Назначение | Примечание |
|------|-----------|----------|
| `docs/project/START_HERE_FOR_GPT.md` | Точка входа для GPT/GLM сессий | Подготовлен, ожидает ARCH-00-docs PR |
| `docs/project/GPT_WORKFLOW.md` | Процесс PR, аудит, ревью для GPT | Подготовлен, ожидает ARCH-00-docs PR |
| `docs/project/GLM_EXECUTOR_RULES.md` | Правила исполнения для GLM executor | Подготовлен, ожидает ARCH-00-docs PR |
| `docs/project/PROJECT_STATE.md` | Текущий статус проекта | Подготовлен, ожидает ARCH-00-docs PR |
| `docs/ROADMAP.md` v2 | Обновлённый 21-ARCH roadmap | Подготовлен, заменит текущий `docs/ROADMAP.md` на main через ARCH-00-docs PR |
| `ROADMAP_SYSTEM_AUDIT_01C.md` | Аудит ревизии 01C | Справочный документ, не на main |
| `ROADMAP_SYSTEM_AUDIT_01D.md` | Аудит ревизии 01D (настоящий документ) | Справочный документ, не на main |

---

## 1. Резюме (Executive Summary)

### Что обнаружил аудит

Проект four-elements-phaser находится в состоянии «худшего из двух миров»: он использует Phaser 4 WebGL, но не задействует ряд продвинутых API движка (TilemapGPULayer, SpriteGPULayer, Filters — **PHASER4-API-SPIKE** обязан верифицировать доступность и стабильность этих API в Phaser 4.1.0 перед тем, как закладываться на них в архитектуре; см. раздел «Phaser 4 advanced API gate» ниже), и при этом утратил функциональность, работавшую в старом репозитории four-elements-next (экономика, строительный production loop, территория). Текущий рендеринг — по сути Canvas 2D логика, перенесённая поверх WebGL через `RenderTexture.stamp()`. Стратегический порядок нарушен: вместо PR4 (строительство) реализованы PR5/PR6 фичи (модульный боевой танк, tuner). Мутабельный глобальный стейт `tunerState` утёк в production rendering path. Тесты существуют (10 файлов), но покрытие неполное — нет E2E тестов, нет интеграционных тестов для ключевых систем. PR #28 закрыт/superseded — продакшн-путь идёт через BUILD-ANCHOR модель (PR #30 замержен).

### Топ-3 критические рекомендации

1. **Вернуться к стратегическому порядку роадмапа.** Заморозить combat-фичи, реализовать ARCH-01 (экономика) → BUILD-ANCHOR-02/03 (metadata-driven building placement) → ARCH-04 (завершение строительства) → ARCH-05 (управление юнитами) → ARCH-06 (харвестинг/сепаратор/продакшн). Civil loop first — это не пожелание, а условие выживания проекта.

2. **Завершить системный metadata-driven подход к размещению зданий.** PR #28 закрыт/superseded. `BuildingPlacementMeta` data model замержена (BUILD-ANCHOR-01, PR #30). Следующий шаг: BUILD-ANCHOR-02 (offline alpha-bounds generator) → BUILD-ANCHOR-03 (south-vertex placement в ConstructionRenderer). Dev tuner — только для диагностики, не для production.

3. **Начать использовать Phaser 4 по-назначению — но с верификацией API.** Исследовать TilemapGPULayer для террейна, SpriteGPULayer для массовых юнитов, Phaser Tweens для VFX, Particle system для dust/explosions. **PHASER4-API-SPIKE** (см. ниже) обязан верифицировать доступность этих API перед планированием PR. Текущий подход «Canvas 2D поверх WebGL» не оправдывает выбор Phaser как движка.

### Общая оценка здоровья проекта

🟡 **Умеренное, с тенденцией к ухудшению.** Фундамент правильный (Phaser 4, TypeScript strict, Vite, state/render split), но стратегическое расхождение с роадмапом и отсутствие ключевых civil-систем создают растущий долг. Проект функционально беднее своего предшественника, при этом технически сложнее. Без коррекции курса проект рискует повторить паттерн старого репозитория — накопление фич без играбельного core loop.

---

## 2. Текущее состояние репозитория (Current repo state)

### Структура файлов

```
four-elements-phaser/
├── .github/workflows/pages.yml          — CI/CD → GitHub Pages
├── docs/
│   ├── AI_WORKFLOW.md
│   ├── ASSET_POLICY.md
│   ├── BUILDING_PLACEMENT_STRATEGY.md   — DOC-01 (PR #29)
│   ├── CURRENT_PROJECT_GUARDRAILS.md
│   ├── FUTURE_PR4_PR5_NOTES.md
│   ├── PHASER4_RUNTIME_NOTES.md
│   ├── PR1_TASK.md
│   ├── PROJECT_CHARTER.md
│   └── ROADMAP.md                       — текущий roadmap на main (будет заменён/обновлён через ARCH-00-docs)
├── docs/project/                         — ⚠️ НЕ на текущем main; запланировано для ARCH-00-docs PR
│   ├── START_HERE_FOR_GPT.md            — подготовлен, не замержен
│   ├── GPT_WORKFLOW.md                  — подготовлен, не замержен
│   ├── GLM_EXECUTOR_RULES.md            — подготовлен, не замержен
│   └── PROJECT_STATE.md                 — подготовлен, не замержен
├── public/assets/
│   ├── environment/                      — 3 минерала (small/medium/large)
│   ├── factions/{cyan,green,purple,yellow}/
│   │   ├── buildings/                    — HQ + 6 типов зданий × 4 фракции
│   │   └── units/                        — harvester, builder, light_tank (8dirs)
│   └── tiles/                            — 3 варианта песка (legacy)
├── src/
│   ├── main.ts                           — Точка входа (Phaser.Game конфиг)
│   ├── styles.css
│   ├── assets/
│   │   ├── assetManifest.ts              — Реестр ключей/путей
│   │   ├── buildingAssets.ts             — Ключи зданий по фракции
│   │   ├── buildingPlacementMeta.ts      — BuildingPlacementMeta data model (BUILD-ANCHOR-01, PR #30)
│   │   ├── civilUnitAssets.ts            — Ключи civil-юнитов
│   │   └── modularUnitAssets.ts          — 64 ключа модульного танка
│   ├── config/
│   │   ├── gameConfig.ts                 — Phaser Game конфигурация
│   │   └── worldConfig.ts               — TILE_W/H, MAP_SIZE, мутабельный tunerState
│   ├── data/maps/
│   │   └── customMap1.ts                — Захардкоженная карта 48×48
│   ├── state/                            — Чистый TypeScript, без Phaser
│   │   ├── types.ts                      — GameState, BuildingConfig, все типы
│   │   ├── createInitialState.ts         — Фабрика начального состояния
│   │   ├── updateGameState.ts            — Тик харвестера + строительство
│   │   ├── construction.ts              — Конфиг строительства, BUILDING_CONFIG
│   │   ├── buildSiteSelection.ts        — Spiral search для площадки
│   │   ├── builder.ts                   — Логика билдера
│   │   ├── occupancy.ts                 — Occupancy grid
│   │   └── pathfinding.ts               — BFS путьпоиск
│   ├── phaser/
│   │   ├── BootScene.ts                 — Минимальный boot
│   │   ├── PreloadScene.ts             — Загрузка всех ассетов
│   │   ├── GameScene.ts                — Оркестратор + debug keyboard (~417 строк)
│   │   ├── input/
│   │   │   └── CameraControls.ts       — Пан, зум, сброс
│   │   ├── render/
│   │   │   ├── TerrainRenderer.ts       — RenderTexture + stamp
│   │   │   ├── EntityRenderer.ts        — Фасад рендерера (~326 строк, делегирует модульный танк и строительство)
│   │   │   ├── ConstructionRenderer.ts  — Строительство: ромбы + progress bar + builder sprite (~352 строки)
│   │   │   ├── ModularTankRenderer.ts   — Wasp + Smoky (~268 строк)
│   │   │   └── isometric.ts            — tileToScreen, screenToTile
│   │   └── debug/
│   │       └── ModularTankDebugOverlay.ts
│   └── __tests__/                        — 10 unit-тестов
│       ├── buildSiteSelection.test.ts
│       ├── buildingPlacementMeta.test.ts  — BUILD-ANCHOR-01 (PR #30)
│       ├── isometric.test.ts
│       ├── occupancy.test.ts
│       ├── pathfinding.test.ts
│       ├── updateGameState.test.ts
│       ├── directionFromDelta.test.ts
│       ├── createInitialState.test.ts
│       ├── builder.test.ts
│       └── construction.test.ts
```

### Что работает

| Функция | Статус | Примечание |
|---------|--------|------------|
| Phaser 4 WebGL boot (Boot → Preload → Game) | ✅ | Стабильно |
| Изометрический террейн 48×48 | ✅ | RenderTexture + stamp, 3 варианта песка |
| HQ видимый (cyan) | ✅ | PNG с hardcoded scale/origin |
| Харвестеры | ✅ | Spritesheet 8×8, 8 направлений, origin 0.5/0.75 |
| Цикл харвестера | ✅ | idle → move → gather → return → unload → repeat |
| Ресурсы | ✅ | 3 размера + infinite, depletion |
| Камера: пан/зум/сброс | ✅ | Cursor-stable zoom |
| Модульный танк | ✅ | Wasp M0 + Smoky M0, 4 фракции × 8 направлений |
| Строительство (state) | ✅ | BUILDING_CONFIG, spiral search, occupancy, pathfinding, builder lifecycle |
| Строительство (render) | 🟡 | Amber/green ромбы + progress bar + builder sprite; нет PNG rendering через BUILD-ANCHOR metadata |
| Builder визуал | ✅ | Спрайтшит рендеринг (ASSET-02, PR #27) |
| BuildingPlacementMeta data model | ✅ | BUILD-ANCHOR-01 замержен (PR #30) |
| 10 unit-тестов | ✅ | state-слой покрыт частично, +buildingPlacementMeta.test.ts |

### Что НЕ работает / отсутствует

| Функция | Критичность |
|---------|-------------|
| Экономика (Raw/Matter/Element/Power/Control) | 🔴 Критично — нет геймплея |
| Путьпоиск в харвестерном цикле | 🔴 — харвестеры проходят сквозь стены |
| Продакшн (Units Factory) | 🟡 |
| Варианты террейна (sand_tile_01..12) | 🟡 — карта выглядит пустой |
| Варианты ресурсов (9 на размер) | 🟡 |
| Препятствия/декор рендеринг | 🟡 |
| VFX (dust, inertia, feedback) | 🟡 |
| Экраны UI (меню, faction select) | 🟢 |
| Сохранение/загрузка | 🟢 |
| E2E тесты | 🔴 — нет ни одного |
| Mapgen | 🟡 — одна захардкоженная карта |

### Покрытие тестами

Unit-тесты: 10 файлов покрывают `src/state/` (types, construction, buildSiteSelection, occupancy, pathfinding, builder, updateGameState, createInitialState) + isometric + buildingPlacementMeta. Это хорошее начало для state-слоя, но:
- Нет тестов для render-слоя (expected — Phaser трудно тестировать в unit)
- Нет E2E/интеграционных тестов
- Нет тестов для asset manifest корректности
- Нет smoke-тестов для Phaser boot

### Ключевые архитектурные проблемы

1. **EntityRenderer.ts — фасад, требующий наблюдения.** После экстракции ModularTankRenderer и ConstructionRenderer, EntityRenderer сократился до ~326 строк. Он больше не God Object, но всё ещё содержит: статичный рендеринг (HQ, builder placeholder), динамический рендеринг (харвестеры, ресурсы), фасадные методы делегирования к ModularTankRenderer. Требует мониторинга роста, но не является автоматическим первым PR-кандидатом на рефакторинг. Не генерировать будущие задачи, повторяющие уже выполненную экстракцию.
2. **Мутабельный глобальный стейт** — `tunerState`, `MODULAR_TANK_*_OFFSET` в `worldConfig.ts` утекли в production rendering path. Изменение этих значений в dev влияет на продакшн-рендеринг.
3. **GameScene содержит ~90 строк debug keyboard handling** (T, H, J, C, arrow, Q/E/Z/X, B) — должно быть вынесено в отдельный InputHandler/DevController.
4. **customMap1.ts = 251 строка inline terrain grid** — данные карты должны быть в JSON, не в TypeScript.
5. **64 combat-изображения загружаются всегда** — 4 фракции × 2 части × 8 направлений = 2.7 MB для одного танка на карте.
6. **Нет economy system** — `rawMinerals` единственный ресурс в GameState. Нет matter, elements, power, control.
7. **Phaser 4 advanced API claims не верифицированы** — TilemapGPULayer, SpriteGPULayer, Filters упоминаются как целевые, но их наличие/стабильность в текущем Phaser 4.1.0 package не подтверждены spike. Требуется **PHASER4-API-SPIKE** перед планированием PR, зависящих от этих API (см. обязательный gate ниже).

---

## 3. Ключевая архитектурная рекомендация (Key architecture recommendation)

### State/render split — правильный фундамент, но требует завершения

Разделение `src/state/` (чистый TypeScript) и `src/phaser/render/` (Phaser-зависимый) — правильное архитектурное решение. Это позволяет тестировать игровую логику без Phaser и заменять рендерер без изменения состояния. Однако split не завершён:

**Что правильно:**
- GameState — чистый TypeScript тип, не зависит от Phaser
- updateGameState, createInitialState, construction, builder, occupancy, pathfinding — все в `src/state/`, без Phaser импортов
- Render-модули читают GameState и создают/обновляют Phaser GameObjects
- GameScene — оркестратор, не содержит бизнес-логики

**Что требует доработки:**

1. **Economy system должна быть в `src/state/`.** Полная модель экономики (raw, matter, elements, separator processing, power, control, storage caps) должна быть чистым TypeScript, полностью тестируемым без Phaser. Файлы: `src/state/economy.ts`, `src/state/power.ts`, `src/state/control.ts`, `src/state/production.ts`. Экономика не должна знать о рендеринге.

2. **Render-слой должен быть декларативным «отражателем» state.** Текущий подход местами императивный (например, `EntityRenderer` управляет анимациями харвестера). Идеальная модель: render-слой читает `GameState` каждый кадр и маппит его на Phaser GameObjects — без внутренней логики. Анимации и VFX — render-only эффекты, не влияющие на state.

3. **Asset metadata должна быть статической, не мутабельной.** `tunerState` в `worldConfig.ts` — нарушение этого принципа. Все placement metadata (alpha-bounds, ground-line, scale) должны быть предвычисленными константами, генерируемыми offline скриптом. Dev tuner — только диагностический инструмент.

4. **Config должен быть immutable в runtime.** `worldConfig.ts` содержит `tunerState` — мутабельный объект, который изменяется через keyboard input. Это создаёт недетерминированное поведение: один и тот же GameState может рендериться по-разному в зависимости от того, нажимал ли разработчик клавиши tuner'а. Решение: вынести tuner state в отдельный dev-only модуль, который НЕ импортируется production-кодом.

5. **Scene split должен произойти вовремя.** GameScene не должен превращаться в монолит. Когда количество subsystem renderer'ов и input handler'ов превысит разумный предел, нужно разбить GameScene на суб-модули: `InputController`, `DevController`, `RenderOrchestrator`, `UIBridge`. Это ARCH-18, и хотя это не приоритет сейчас, нужно следить за размером GameScene.

---

## 4. Phaser 4 advanced API gate (PHASER4-API-SPIKE)

### Обязательное правило

**PHASER4-API-SPIKE** должен верифицировать доступность, стабильность, import path, минимальный working example и пригодность для данного проекта **ПЕРЕД** тем, как любой PR будет зависеть от следующих API:

- `TilemapGPULayer`
- `SpriteGPULayer`
- `Filters`
- Продвинутые pipelines/shaders
- Любые другие неверефицированные Phaser 4 API

### Пока spike не подтвердит — эти API являются **только кандидатами**

До подтверждения:
- Не планировать PR, зависящий от TilemapGPULayer для террейна
- Не планировать PR, зависящий от SpriteGPULayer для массовых юнитов
- Не планировать PR, зависящий от Filters для эффектов
- Использовать проверенные API: RenderTexture, GameObjects, Tweens, Particles, Animation

### Spike-формат

Результат spike документируется в `docs/PHASER4_RUNTIME_NOTES.md`:

```text
API: TilemapGPULayer
Status: works / partial / absent / unstable
Import path: ...
Minimal working example: ...
Fit for this project: yes / no / conditional
Notes: ...
```

### Карта возможностей Phaser 4 (только верифицированные + кандидаты)

| Phaser 4 система | Используется? | Статус верификации | Обоснование |
|---|---|---|---|
| **Scenes** | ✅ Boot → Preload → Game | ✅ Верифицировано | Scenes — основной механизм модульности в Phaser. Добавить DevArena Scene (ARCH-12), возможно UIScene как overlay. |
| **GameObjects (Image, Sprite)** | ✅ Image для зданий, Sprite для харвестеров | ✅ Верифицировано | Основной строительный блок рендеринга. |
| **Spritesheets** | ✅ harvester_8x8_256, builder_8x8_256 | ✅ Верифицировано | 8×8 layout — устоявшаяся конвенция проекта. |
| **Animation (AnimationManager)** | ❌ Не используется | ✅ Верифицировано (Phaser standard) | Вместо ручного frame-switching использовать `scene.anims.create()`. |
| **Textures (TextureManager)** | ✅ Через PreloadScene | ✅ Верифицировано | `texture.getSourceImage()` — только для offline metadata generator, НЕ в runtime. |
| **RenderTexture** | ✅ TerrainRenderer | ✅ Верифицировано | Работающее решение для 48×48. Не масштабируется на 128×128+. |
| **Containers** | ❌ Не используется | ✅ Верифицировано | Идеально для «танк = корпус + башня» и «здание = спрайт + индикаторы». |
| **Groups** | ❌ Не используется | ✅ Верифицировано | Полезен для batch-операций. Не нужен prematurely. |
| **Cameras** | ✅ CameraControls | ✅ Верифицировано | `camera.shake()`, `camera.pan()` — встроенные. |
| **Input** | ✅ Pointer drag | ✅ Верифицировано | Расширить: click selection, right-click move command. |
| **Particles** | ❌ Не используется | ✅ Верифицировано (Phaser standard) | Для dust, sparks, debris. |
| **Tweens** | ❌ Не используется | ✅ Верифицировано (Phaser standard) | Для inertia, feedback pulses, smooth transitions. Render-only. |
| **Depth sorting** | ✅ Ручной `setDepth(100 + worldY)` | ✅ Верифицировано | Painter's algorithm работает корректно для изометрии. |
| **Data Manager** | ❌ Не используется | ✅ Верифицировано | `gameObject.setData()` — удобный способ хранить metadata. |
| **Loader** | ✅ PreloadScene | ✅ Верифицировано | Расширить: pack loading, manifest-driven loading. |
| **Scale Manager** | ✅ EXPAND + CENTER_BOTH | ✅ Верифицировано | Текущая конфигурация работает корректно. |
| **TilemapGPULayer** | ❌ | ⚠️ КАНДИДАТ — PHASER4-API-SPIKE required | Может заменить RenderTexture для террейна (один quad вместо 2304 draw calls). Но существование в Phaser 4.1.0 не подтверждено. |
| **SpriteGPULayer** | ❌ | ⚠️ КАНДИДАТ — PHASER4-API-SPIKE required | Может масштабировать массовый рендеринг юнитов. Но существование в Phaser 4.1.0 не подтверждено. |
| **Pipeline/Shader** | ❌ | ⚠️ КАНДИДАТ — PHASER4-API-SPIKE required | Fog of war, selection glow. PR10+ приоритет. |
| **Filters** | ❌ | ⚠️ КАНДИДАТ — PHASER4-API-SPIKE required | Post-processing эффекты. PR10+ приоритет. |

### Приоритет внедрения Phaser 4 API

1. **Немедленно (BUILD-ANCHOR-03 / ARCH-04 / ARCH-05):** Animation, Containers, Input (click/selection) — все верифицированы
2. **Следующий приоритет (ARCH-06/07/13):** Tweens, Particles, Camera shake/pan — все верифицированы
3. **PHASER4-API-SPIKE first (ARCH-08/18):** TilemapGPULayer, SpriteGPULayer — **верифицировать перед планированием PR**
4. **Отложить (ARCH-19+):** Pipeline/Shader, Filters — **PHASER4-API-SPIKE required**

---

## 5. Economy naming gate

### Обязательное правило

**ARCH-01A** (EconomyState типы) не может быть реализован без **финальной синхронизации терминологии экономики**.

### Терминология должна быть зафиксирована до ARCH-01A

Перед реализацией экономики необходимо определить и зафиксировать названия для:

| Концепт | Кандидат-название (из Next baseline) | Примечание |
|---------|--------------------------------------|------------|
| Ресурс, добываемый харвестером | `raw` | Из Next: `rawMinerals`, `START_RAW=30` |
| Обработанный ресурс | `matter` | Из Next: `START_MATTER=120`, `costMatter` |
| Выход сепаратора (element units) | `elements` | Из Next: `SEP_ELEMENT_YIELD=2` |
| Энергоснабжение | `power` | Из Next: power-plant supply/demand |
| Лимит юнитов | `control` | Из Next: HQ +10, Relay +5, cap 50 |

### Жёсткое правило

Не смешивать термины «matter», «energy» и «power» произвольно. Использовать Next как baseline, если PROJECT_STATE.md / ROADMAP.md не говорят иначе. ARCH-01A должен сначала зафиксировать naming и mapping, затем реализовывать типы.

---

## 6. Пошаговый план реализации по блокам ROADMAP

### ARCH-00 — Workflow / project docs

**Цель:** Зафиксировать проектный workflow перед продолжением реализации.

**Рекомендуемый подход:** Замержить уже подготовленные документы: `START_HERE_FOR_GPT.md`, `GPT_WORKFLOW.md`, `GLM_EXECUTOR_RULES.md`, `PROJECT_STATE.md` в `docs/project/`, обновить `docs/ROADMAP.md` до v2 (21-ARCH формат). Эти файлы уже созданы и приняты по контенту, но ещё не находятся на main. Не создавать избыточную документацию — каждый документ должен быть action-oriented.

**Phaser 4 API/системы:** Нет.

**Чистый TS:** Нет.

**Рендерер/Scene:** Нет.

**DOM UI:** Нет.

**Данные/конфиг/метаданные:** Markdown файлы в `docs/`.

**Тесты:** Нет — документация.

**Ручное QA:** Ревью документов владельцем проекта.

**Риски:** 🟢 Минимальные. Главная опасность — over-documentation.

**Чего НЕ делать:** Не создавать документацию ради документации. Не дублировать ROADMAP.md.

**Разбивка на PR:** 1 PR — `ARCH-00-docs`.

**Зависимости:** Нет. Это первый блок.

---

### ARCH-01 — Economy baseline

**Цель:** Портировать/адаптировать рабочую civil-экономику из four-elements-next в чистый TypeScript.

**Рекомендуемый подход:** Реализовать economy как чистый TypeScript в `src/state/`, используя Next как спецификацию (reference → rewrite). Не копировать implementation. Базовые значения из Next: `START_RAW=30, START_MATTER=120, SEP_RAW_COST=12, SEP_CYCLE_SECONDS=5, SEP_ELEMENT_YIELD=2`. Добавить типы: `EconomyState`, `ResourceType`, `StorageCap`. Разделить на модули: `economy.ts` (raw/matter/elements, separator processing, storage), `power.ts` (supply/demand, priority, death spiral prevention), `control.ts` (HQ +10, Relay +5, cap 50). Экономика не зависит от Phaser.

**⚠️ Economy naming gate:** Перед ARCH-01A — финальная синхронизация терминологии (см. раздел 5). Не смешивать «matter», «energy», «power».

**Phaser 4 API/системы:** Нет — чистый state.

**Чистый TS:** `src/state/economy.ts`, `src/state/power.ts`, `src/state/control.ts`, обновить `types.ts` (добавить EconomyState, PowerState, ControlState в GameState), обновить `createInitialState.ts`, обновить `updateGameState.ts` (добавить economy tick).

**Рендерер/Scene:** Минимальный — обновить HUD в GameScene для отображения новых ресурсов.

**DOM UI:** Обновить HTML HUD для отображения raw/matter/elements/power/control.

**Данные/конфиг/метаданные:** `src/config/economyConfig.ts` — стартовые значения, costs, caps, cycle durations.

**Тесты:** Unit-тесты для каждого модуля: `economy.test.ts`, `power.test.ts`, `control.test.ts`. Проверить: separator processing cycle, storage caps enforcement, power priority sorting, control cap calculation.

**Ручное QA:** Запустить игру, проверить что ресурсы отображаются в HUD, что separator processing работает (когда строительство реализовано), что storage caps ограничивают.

**Риски:** 🟡 Средние. Экономика из Next проверена, но адаптация может выявить несовместимости с текущей state-моделью. Начать с минимума: raw, matter, elements, separator. Power и control добавить отдельными PR.

**Чего НЕ делать:** Не добавлять combat-экономику. Не добавлять faction bonuses. Не добавлять trading. Не копировать Next implementation напрямую. Не смешивать economy logic с render logic.

**Разбивка на PR:**
- `ARCH-01A`: EconomyState типы + raw/matter/elements + storage caps (после naming gate)
- `ARCH-01B`: Separator processing cycle
- `ARCH-01C`: Power system (supply/demand)
- `ARCH-01D`: Control system (unit cap)

**Зависимости:** Нет — экономика не зависит от рендеринга. Но ARCH-04 (строительство) нужен для проверки что economy работает в gameplay контексте.

---

### ARCH-02 — Art / sprite pipeline

**Цель:** Создать системный пайплайн для добавления и валидации спрайтов/ассетов.

**Рекомендуемый подход:** Адаптировать Ashen Crown art pipeline: source sheets → Python/Node processor → runtime PNGs → manifest → sample viewer → audit images. Ключевые компоненты: (1) `tools/process-art-assets.py` — нарезка source sheets на runtime PNGs; (2) `manifest.generated.json` — список enabledKeys + loadAll flag; (3) `src/assets/artManifest.ts` — ART_ASSETS массив + `resolveEnabledArtAssets()` фильтрация; (4) `task/art-sample/index.html` — viewer для превью; (5) audit images. Для Four Elements специфика: изометрические building sheets (5 стадий), unit spritesheets (8×8), modular unit individual PNGs (8 направлений), terrain tiles, FX particles, UI icons.

**Phaser 4 API/системы:** Loader (`this.load.image()`, `this.load.spritesheet()`), TextureManager для верификации.

**Чистый TS:** `src/assets/artManifest.ts`, `src/assets/assetManifest.ts` (обновить), типы для manifest.

**Рендерер/Scene:** Обновить PreloadScene для manifest-driven loading.

**DOM UI:** Sample viewer — standalone HTML страница.

**Данные/конфиг/метаданные:** `manifest.generated.json`, naming conventions, frame layout rules.

**Тесты:** Тест для `resolveEnabledArtAssets()`, тест для asset key generation.

**Ручное QA:** Запустить sample viewer, проверить все ассеты. Проверить audit images.

**Риски:** 🟡 Средние. Не over-engineering pipeline раньше контента.

**Чего НЕ делать:** Не копировать Ashen Crown processor напрямую. Не блокировать gameplay PR на pipeline PR.

**Разбивка на PR:**
- `ARCH-02A`: Naming conventions + manifest format + artManifest.ts
- `ARCH-02B`: Sample viewer HTML
- `ARCH-02C`: Processor script (source sheets → runtime PNGs)
- `ARCH-02D`: Audit images + normalized previews

**Зависимости:** ARCH-00. ARCH-03 для building-specific metadata. Параллельно с gameplay PR.

---

### ARCH-03 — Building / asset placement system

**Цель:** Сделать PNG-изображения зданий корректно выровненными на изометрических footprint'ах через generic систему.

**Рекомендуемый подход:** Реализовать гибридный подход (Option D из BUILD_ASSET_ANCHOR_AUDIT): offline alpha-bounds metadata + south-vertex anchoring + category defaults + dev tuner для диагностики.

**Phaser 4 API/системы:** `Phaser.GameObjects.Image`, `setOrigin()`, `setPosition()`, `setScale()`, `setDepth()`, `texture.getSourceImage()` (только в offline скрипте, НЕ в runtime).

**Чистый TS:** `src/assets/buildingPlacementMeta.ts` — интерфейс `BuildingPlacementMeta` и сгенерированные данные. `tools/generate-building-meta.ts` — Node.js скрипт.

**Рендерер/Scene:** Обновить `ConstructionRenderer.ts` — заменить placeholder diamonds на generic функцию `placeBuildingFromMeta()` для completed зданий.

**DOM UI:** Нет.

**Данные/конфиг/метаданные:** Модель данных `BuildingPlacementMeta`:

```typescript
interface BuildingPlacementMeta {
  buildingType: BuildingType;
  faction: Faction;
  assetKey: string;
  sourceWidth: number;
  sourceHeight: number;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
  visibleWidth: number;
  visibleHeight: number;
  footprintW: number;
  footprintH: number;
  anchorMode: BuildingAnchorMode;
  category: BuildingPlacementCategory;
  groundLineRatio: number;
  originX: number;
  originY: number;
  targetDisplayWidth: number;
  computedScale: number;
  exceptionOffsetX?: number;
  exceptionOffsetY?: number;
}
```

Renderer formula:
1. South vertex = `tileToScreen(tx + fpW - 1, ty + fpH - 1)` + `TILE_H / 2`
2. Scale = `meta.computedScale`
3. Origin = `(meta.originX, meta.originY)`
4. Position = `(southX + meta.exceptionOffsetX, southY + meta.exceptionOffsetY)`
5. Depth = `100 + tileToScreen(tx + fpW - 1, ty + fpH - 1).y`

**Тесты:** Unit-тест для `placeBuildingFromMeta()` формулы. Тест для alpha-bounds generator.

**Ручное QA:** Построить Separator, проверить: base на south edge, центрирование, «стоит на земле». Проверить 4+ типа зданий. Zoom 0.5/1.0/2.0.

**Риски:** 🟡 Средние. PNG с тенями могут искажать ground-line detection. Mitigation: heuristic + exceptionOffset.

**Чего НЕ делать:** НЕ использовать `displayWidth/originY/offsetX/offsetY` ручную калибровку как production mechanism (подход PR #28). НЕ сканировать PNG пиксели в runtime. НЕ смешивать building anchor model с unit anchor model. НЕ добавлять Canvas fallback. НЕ мержить PR #28.

**Разбивка на PR:**
- ~~`BUILD-ANCHOR-01`: BuildingPlacementMeta data model~~ — ✅ **DONE**, замержен как PR #30
- `BUILD-ANCHOR-02`: Offline alpha-bounds generator script (`tools/generate-building-meta.ts`)
- `BUILD-ANCHOR-03`: South-vertex building placement в ConstructionRenderer
- `BUILD-01`: Применить ко всем текущим зданиям (6 типов × 4 фракции)
- `DEV-TOOLS-01`: BuildingDevTuner как diagnostic-only tool

**Зависимости:** Нет жёстких. Параллельно с ARCH-01. Но ARCH-04 зависит от ARCH-03.

**Диспозиция PR #28:** Закрыт / superseded. Не замержен в main. Только diagnostic learning. Продакшн-путь идёт через BUILD-ANCHOR модель/metadata/renderer formula.

---

### ARCH-04 — Civil construction loop

**Цель:** Завершить civil construction loop — от выбора площадки до завершённого здания.

### Что уже существует (verify before tasking)

- ✅ `src/state/construction.ts` — BUILDING_CONFIG, canPlaceBuilding, placeConstructionSite, updateConstructionSiteProgress
- ✅ `src/state/buildSiteSelection.ts` — spiral search
- ✅ `src/state/builder.ts` — builder state machine (idle, moving-to-site, building)
- ✅ `src/state/occupancy.ts` — occupancy grid
- ✅ `src/state/pathfinding.ts` — BFS путьпоиск
- ✅ `src/phaser/render/ConstructionRenderer.ts` — amber/green diamonds, progress bar, builder sprite

### Что отсутствует / требует завершения

- 🔴 Интеграция с финальной экономикой (cost deduction через matter вместо raw)
- 🟡 Cancel/refund UX (прерывание строительства, возврат ресурсов)
- 🟡 No-route UX (builder не может дойти до site)
- 🟡 Full build menu UI (DOM-панель выбора типа здания)
- 🟡 Production-ready building renderer using BUILD-ANCHOR metadata (PNG вместо зелёных ромбов)
- 🟢 Construction visual polish (staged placeholders, transition effects)
- 🟢 Robust QA scenarios (edge cases: cancel mid-build, multiple sites, etc.)

**Рекомендуемый подход:** Завершить на основе существующего state: (1) подключить экономику для cost deduction; (2) добавить cancel/refund; (3) обновить ConstructionRenderer для BUILD-ANCHOR metadata PNG rendering; (4) добавить build menu UI (DOM).

**Phaser 4 API/системы:** Image (для completed buildings), Graphics (для placeholders), Container (для building + progress bar).

**Чистый TS:** Дополнить `construction.ts` (cancelConstruction, refund), `builder.ts` (no-route handling).

**Рендерер/Scene:** ConstructionRenderer — BUILD-ANCHOR PNG rendering для completed зданий.

**DOM UI:** Build menu: кнопки для каждого доступного здания с отображением стоимости.

**Тесты:** cancelConstruction, refund calculation, no-route detection.

**Ручное QA:** Построить здание end-to-end: build → выбрать тип → подтвердить → строительство → завершено → PNG корректно отображается. Cancel → refund.

**Риски:** 🟡 Средние. Много edge cases: cancel, no-route, resources insufficient.

**Чего НЕ делать:** Не добавлять combat здания. Не добавлять territory checks.

**Разбивка на PR:**
- `ARCH-04A`: Cancel/refund + no-route UX (state logic)
- `ARCH-04B`: Build menu UI (DOM)
- `ARCH-04C`: Construction renderer upgrade (PNG через BUILD-ANCHOR metadata)
- `ARCH-04D`: Integration с экономикой (cost deduction через matter)

**Зависимости:** ARCH-01 (экономика), BUILD-ANCHOR-03 (building placement).

---

### ARCH-05 — Unit movement / control MVP

**Цель:** Добавить RTS-стиль управления текущими civil-юнитами.

**Рекомендуемый подход:** Реализовать: (1) click selection; (2) selection highlight; (3) right-click move command; (4) harvester manual move override; (5) pathfinding через passable tiles only; (6) builder 8-direction facing fix; (7) movement centered on tile lanes.

**⚠️ Harvester manual override safety rule:**
- НЕ переписывать и НЕ ломать текущий auto-harvest loop
- Manual movement реализуется как **explicit command mode/state** вокруг существующего поведения
- Manual command должен быть **cancelable/reversible**
- Return-to-auto поведение должно быть **специфицировано и протестировано**
- После manual move харвестер должен иметь возможность вернуться к auto-gather

**Phaser 4 API/системы:** Input, Graphics (selection highlight), Containers (unit + selection marker), Tweens (smooth movement, render-only).

**Чистый TS:** `src/state/selection.ts` (selected entity tracking), `src/state/commands.ts` (move command, stop command), обновить `pathfinding.ts` (подключить к харвестерам).

**Рендерер/Scene:** Selection highlight, movement debug markers, path visualization.

**DOM UI:** Командная панель при выборе юнита.

**Данные/конфиг/метаданные:** `src/config/controlsConfig.ts` — hotkey bindings.

**Тесты:** `selection.test.ts`, `commands.test.ts`, обновить `pathfinding.test.ts` (buildings как obstacles).

**Ручное QA:** Клик на харвестер → подсветка → правый клик → харвестер идёт по пути, обходя здания. Manual move → return to auto-gather.

**Риски:** 🟡 Средние. Pathfinding + occupancy interaction сложна.

**Чего НЕ делать:** Не добавлять box selection (позже). Не добавлять attack-move, patrol. Не делать movement через Phaser physics.

**Разбивка на PR:**
- `ARCH-05A`: Selection system (click, highlight, deselect)
- `ARCH-05B`: Move command + pathfinding integration
- `ARCH-05C`: Harvester manual override + auto-gather return (с safety rule)
- `ARCH-05D`: Builder facing + movement polish

**Зависимости:** Pathfinding (уже есть) + occupancy (уже есть).

---

### ARCH-06 — Harvesting / separator / production loop

**Цель:** Завершить базовый civil production loop.

**Рекомендуемый подход:** Соединить существующие системы: (1) harvester собирает raw → доставляет к dropoff; (2) separator обрабатывает raw → matter + elements; (3) storage caps; (4) power/matter/element обновляются каждый tick; (5) units-factory производит builder/harvester; (6) factory queue size = 2. Использовать Next как reference.

**Phaser 4 API/системы:** Tweens (production progress feedback), Graphics (queue indicator), Containers (factory + queue display).

**Чистый TS:** `src/state/economy.ts` (separator processing, storage caps), `src/state/production.ts` (factory queue, spawn logic).

**Рендерер/Scene:** Separator active/inactive state, factory queue indicator, spawn animation.

**DOM UI:** Factory production panel.

**Данные/конфиг/метаданные:** `src/config/productionConfig.ts` — costs, queue limit.

**Тесты:** `production.test.ts`, `economy.test.ts` — separator cycle, storage caps.

**Ручное QA:** Separator → харвестер приносит raw → processing → matter/elements. Factory → заказать builder → spawn.

**Риски:** 🟡 Средние. Integration risk — много subsystem взаимодействуют.

**Чего НЕ делать:** Не добавлять tanks/combat units. Не добавлять faction bonuses.

**Разбивка на PR:**
- `ARCH-06A`: Separator processing (raw → matter + elements)
- `ARCH-06B`: Storage caps enforcement
- `ARCH-06C`: Units Factory production (queue, spawn)
- `ARCH-06D`: Production UI panel

**Зависимости:** ARCH-01, ARCH-04, ARCH-05.

---

### ARCH-07 — Building / production visual indicators

**Цель:** Сделать состояние зданий и производства читаемым в мире игры.

**Рекомендуемый подход:** Phaser Graphics для in-world индикаторов: separator active/idle, construction progress bar, factory queue, power warning, resource feedback numbers. Все — render-only.

**Phaser 4 API/системы:** Graphics, Tweens, Text, Containers.

**Чистый TS:** Нет — визуальные индикаторы. State должен экспонировать нужные данные.

**Рендерер/Scene:** `BuildingIndicatorsRenderer.ts` (новый).

**DOM UI:** Tooltip при наведении на здание.

**Тесты:** Рендер — только manual QA.

**Ручное QA:** Наблюдать индикаторы на зданиях.

**Риски:** 🟢 Низкие. Чисто визуальный слой. Главное — не перегрузить сцену.

**Чего НЕ делать:** Не делать health bars для civil зданий. Не делать popup windows в game world.

**Разбивка на PR:**
- `ARCH-07A`: Construction progress bar
- `ARCH-07B`: Separator active/idle indicator
- `ARCH-07C`: Factory queue indicator + production progress
- `ARCH-07D`: Power warning + resource feedback

**Зависимости:** ARCH-04, ARCH-06.

---

### ARCH-08 — Map visual / terrain readability

**Цель:** Исправить текущую карту — слишком пустая, grid-heavy, board-like.

**Рекомендуемый подход:** Tile variation, grid softening, edge boundary, environment renderer. **TilemapGPULayer spike — только после PHASER4-API-SPIKE.**

**Phaser 4 API/системы:** RenderTexture (variant-aware stamping), Graphics (edge boundary). TilemapGPULayer — **PHASER4-API-SPIKE required**.

**Чистый TS:** `src/state/mapgen.ts`, `src/core/asset-variants.ts` (FNV-1a hash).

**Рендерер/Scene:** Обновить TerrainRenderer, новый EnvironmentRenderer.

**Тесты:** `mapgen.test.ts` — determinism, validation.

**Риски:** 🟡 Средние. TilemapGPULayer spike может не сработать.

**Разбивка на PR:**
- `ARCH-08A`: Tile variant system + FNV-1a hash
- `ARCH-08B`: Grid softening + edge boundary
- `ARCH-08C`: Environment renderer
- `ARCH-08D`: TilemapGPULayer spike (эксперимент, PHASER4-API-SPIKE first)

**Зависимости:** ARCH-02, ARCH-09.

---

### ARCH-09 — Mapgen / resource balance

**Цель:** Генерируемые карты, играбельные и сбалансированные для civil экономики.

**Рекомендуемый подход:** PRNG → terrain → HQ → resources → obstacles → decor → validation → retry. 4 пресета. Center infinite mineral.

**Чистый TS:** `src/state/mapgen.ts`, `mapgen-config.ts`, `mapgen-presets.ts`, `map-validation.ts`.

**Тесты:** Extensive: determinism, 100 seeds validation, reachability.

**Риски:** 🟡 Средние. Много параметров, validation может быть insufficient.

**Разбивка на PR:**
- `ARCH-09A`: Core mapgen
- `ARCH-09B`: Obstacles, decor, mountains
- `ARCH-09C`: Validation + retry
- `ARCH-09D`: Presets + seed UI

**Зависимости:** ARCH-08, ARCH-10.

---

### ARCH-10 — Passability / validation / telemetry

**Цель:** Диагностика проблем карты и пути.

**Рекомендуемый подход:** PassabilityGrid, BFS validation, pathfinding telemetry, passability cache, reachability checks.

**Чистый TS:** `src/state/passability.ts`, обновить `pathfinding.ts`.

**Рендерер/Scene:** Debug overlay.

**Тесты:** `passability.test.ts`, расширенные `pathfinding.test.ts`.

**Риски:** 🟢 Низкие. Хорошо понятные алгоритмы.

**Разбивка на PR:**
- `ARCH-10A`: PassabilityGrid + pathfinding integration
- `ARCH-10B`: BFS validation + telemetry
- `ARCH-10C`: Debug overlay
- `ARCH-10D`: Reachability checks

**Зависимости:** ARCH-05, ARCH-09.

---

### ARCH-11 — Devtools / QA sandbox

**Цель:** Быстрые QA инструменты для civil систем.

**Рекомендуемый подход:** Dev panel как DOM overlay с кнопками: spawn, resources, overlays. Через `?devtools=1` или hotkey.

**Чистый TS:** Dev action functions в `src/state/`.

**DOM UI:** Dev panel sidebar/overlay.

**Тесты:** Dev action functions — чистый TS.

**Риски:** 🟢 Низкие. Изолированный инструмент.

**Разбивка на PR:**
- `ARCH-11A`: Dev panel DOM + basic actions
- `ARCH-11B`: Passability/blocking overlay
- `ARCH-11C`: Sprite debug + asset preview
- `ARCH-11D`: Economy test + builder test scenarios

**Зависимости:** Нет жёстких. Полезны с самого начала.

---

### ARCH-12 — Dev Test Arena / Unit Sandbox

**Цель:** Dev-only арена для целевого тестирования юнитов/комбата/VFX без full game loop.

**Рекомендуемый подход:** **Отдельная Phaser Scene** (`DevArenaScene`). Полная изоляция, отдельный lifecycle.

**⚠️ DevArena priority nuance:**
- DevArena skeleton **может быть сдвинут раньше** полного combat, если он помогает тестировать unit movement, facing, anchors, projectiles, VFX, dummy targets
- Combat-specific arena features (attack test, turret rotation test, projectile/muzzle flash test) остаются **заблокированы** до combat readiness (ARCH-19)
- Early DevArena может включать: spawn unit, spawn dummy, reset, show anchors/directions/frame index

**Phaser 4 API/системы:** Scene, `scene.start()`, `scene.time.timeScale`.

**Чистый TS:** Arena state — минимальный GameState subset.

**Рендерер/Scene:** `DevArenaScene.ts` — переиспользование sub-renderers из GameScene.

**DOM UI:** Arena control panel.

**Риски:** 🟢 Низкие. Изолированная Scene.

**Чего НЕ делать:** Не делать arena внутри GameScene.

**Разбивка на PR:**
- `ARCH-12A`: DevArenaScene skeleton + spawn + reset (можно раньше combat)
- `ARCH-12B`: Movement + pathing test
- `ARCH-12C`: Combat test (post-ARCH-19)
- `ARCH-12D`: VFX test + time controls

**Зависимости:** ARCH-11 (consistency). ARCH-05 (unit control). Combat-часть заблокирована до ARCH-19.

---

### ARCH-13 — Visual motion / animations / VFX

**Цель:** Сделать игру визуально живой и читаемой.

**Рекомендуемый подход:** Phaser Tweens + Particles для VFX. Inertia, dust, gather pulse, construction feedback, separator VFX, factory spawn. **Ключевое правило: gameplay state не должен искажаться visual interpolation.**

**Phaser 4 API/системы:** Tweens, Particles, Graphics. Все верифицированы.

**Риски:** 🟡 Средние. Главное — не over-VFX. «No idle bobbing, no noisy particles».

**Разбивка на PR:**
- `ARCH-13A`: Inertia (render-only movement tilt)
- `ARCH-13B`: Dust (movement particles)
- `ARCH-13C`: Gather/unload pulse + construction feedback
- `ARCH-13D`: Separator + factory VFX

**Зависимости:** ARCH-05, ARCH-06.

---

### ARCH-14 — UI shell / menus / HUD

**Цель:** Играбельная outer shell и читаемый HUD.

**Рекомендуемый подход:** **DOM overlay** поверх Phaser canvas. Flow: Main Menu → Map Size → Seed → Faction → Game.

**Phaser 4 API/системы:** Нет — DOM.

**Риски:** 🟡 Средние. Объёмная, но технически простая работа.

**Разбивка на PR:**
- `ARCH-14A`: Screen manager + Main Menu
- `ARCH-14B`: New Game flow
- `ARCH-14C`: Game HUD
- `ARCH-14D`: Build Panel + Unit Info
- `ARCH-14E`: Esc Menu + Settings

**Зависимости:** ARCH-01, ARCH-09.

---

### ARCH-15 — Save / load MVP

**Цель:** Сохранение и возобновление игровой сессии.

**Рекомендуемый подход:** GameState serialization, versioned save format, localStorage.

**Чистый TS:** `src/state/saveManager.ts`.

**Риски:** 🟡 Средние. Убедиться что все данные сериализуемы.

**Разбивка на PR:**
- `ARCH-15A`: SaveManager
- `ARCH-15B`: Save/Load UI
- `ARCH-15C`: Dev save/load hooks

**Зависимости:** ARCH-01, ARCH-14.

---

### ARCH-16 — Seed / map editor / custom maps

**Цель:** Портировать/адаптировать редактор карт и seed flow из Next.

**Рекомендуемый подход:** Seed input + presets + map editor (отдельная Scene).

**Риски:** 🟡 Средние. Начать с seed input + presets.

**Разбивка на PR:**
- `ARCH-16A`: Seed input + mapgen presets
- `ARCH-16B`: Basic map editor
- `ARCH-16C`: Asset placement
- `ARCH-16D`: Validation + storage + launch

**Зависимости:** ARCH-09, ARCH-14.

---

### ARCH-17 — Unit / object addition workflow

**Цель:** Стандартный workflow для добавления нового объекта.

**Рекомендуемый подход:** Checklist: asset requirements → naming → metadata → manifest → config → viewer check → devtools check → runtime integration → QA.

**Риски:** 🟢 Низкие. Процессный/документационный блок.

**Разбивка на PR:** 1 PR — `ARCH-17-workflow-docs`.

**Зависимости:** ARCH-02, ARCH-03.

---

### ARCH-18 — Architecture hygiene / scene split

**Цель:** Предотвратить превращение GameScene в монолит.

**Рекомендуемый подход:** Когда GameScene > ~300 строк или > 3 ответственности: разбить на InputController, DevController, RenderOrchestrator, UIBridge, TestBridge.

**⚠️ Важное уточнение:** EntityRenderer больше не God Object (326 строк, делегирует к ModularTankRenderer и ConstructionRenderer). Не генерировать задачи на повторную экстракцию уже выполненной работы. Архитектурная гигиена остаётся валидной, но не должна быть автоматическим первым PR если она не блокирует следующую scoped задачу.

**Риски:** 🟢 Низкие. Чистый refactor.

**Разбивка на PR:**
- `ARCH-18A`: Вынести debug keyboard handling в DevController
- `ARCH-18B`: Вынести input handling в InputController
- `ARCH-18C`: RenderOrchestrator
- `ARCH-18D`: TestBridge для E2E тестов

**Зависимости:** Нет жёстких. Когда GameScene становится слишком большим.

---

### ARCH-19 — Combat readiness

**Цель:** Foundation для combat после стабилизации civil.

**Рекомендуемый подход:** Health/damage, attack commands, turret model, projectiles, muzzle flash, hit impact, destroyed state, targeting.

**Риски:** 🔴 Высокие. Сложная система, нужен thorough testing.

**Разбивка на PR:**
- `ARCH-19A`: Health/damage model + targeting
- `ARCH-19B`: Attack commands + projectile model
- `ARCH-19C`: Combat renderer
- `ARCH-19D`: Turret rotation + health bars + destroyed states

**Зависимости:** БЛОКИРОВАНО до: civil loop stable, unit control, dev arena, VFX pipeline, save/UI/devtools usable.

---

### ARCH-20 — Enemy AI / bot

**Цель:** Поведение противника после combat readiness.

**Рекомендуемый подход:** Scout → economy bot → attack waves → base behavior → difficulty levels → AI telemetry.

**Риски:** 🔴 Высокие. Самая сложная система в RTS.

**Разбивка на PR:**
- `ARCH-20A`: AI Decider framework + economy bot
- `ARCH-20B`: Scout + attack waves
- `ARCH-20C`: Base behavior + defense
- `ARCH-20D`: Difficulty levels + AI telemetry

**Зависимости:** БЛОКИРОВАНО до ARCH-19.

---

## 7. Каноническая последовательность следующих PR (Final recommended next PR sequence)

### Единый канонический список — без конфликтов

Порядок основан на текущем main (`acf5820`), принятом workflow state и зависимостях между ARCH-блоками.

| # | PR ID | Описание | Зависимости | Приоритет |
|---|-------|----------|-------------|-----------|
| 1 | **ARCH-00-docs** | Зафиксировать workflow/roadmap/audit docs | Нет | 🔴 |
| 2 | **BUILD-ANCHOR-02** | Offline alpha-bounds generator script | BUILD-ANCHOR-01 (done) | 🔴 |
| 3 | **BUILD-ANCHOR-03** | South-vertex building placement в ConstructionRenderer | #2 | 🔴 |
| 4 | **ARCH-01A** | EconomyState типы + raw/matter/elements + storage caps (после naming gate) | Нет | 🔴 |
| 5 | **ARCH-05A** | Selection system (click, highlight, deselect) | Нет | 🔴 |

**Обоснование порядка:**

1. **ARCH-00-docs** — фиксирует workflow, чтобы все последующие GPT/GLM сессии имели контекст. Без этого каждый новый чат теряет контекст.

2. **BUILD-ANCHOR-02** — заполняет BuildingPlacementMeta данными через offline генератор. BUILD-ANCHOR-01 data model уже в main. Это следующий логический шаг в metadata-driven подходе.

3. **BUILD-ANCHOR-03** — завершает ARCH-03, позволяя ConstructionRenderer рендерить completed здания через PNG вместо зелёных ромбов. Зависит от BUILD-ANCHOR-02 (нужны metadata).

4. **ARCH-01A** — экономика — фундамент для всех gameplay систем. Может идти параллельно с BUILD-ANCHOR-02/03 (нет зависимостей). Но naming gate должен быть пройден первым.

5. **ARCH-05A** — unit selection — первый шаг к RTS-управлению. Не зависит от экономики или строительства. Может идти параллельно.

**PHASER4-API-SPIKE** (не PR, а обязательный шаг): Перед планированием любого PR, зависящего от TilemapGPULayer / SpriteGPULayer / Filters — выполнить spike и задокументировать результат в `docs/PHASER4_RUNTIME_NOTES.md`.

**Что НЕ входит в список:**
- ❌ BUILD-ANCHOR-01 — уже DONE (PR #30 замержен)
- ❌ Повторная экстракция EntityRenderer — уже выполнена (ModularTankRenderer + ConstructionRenderer)
- ❌ PR #28 — superseded/closed, не production path

---

## 8. Что можно объединить vs разделить

### Можно объединять

| Бандл | Состав | Почему безопасно |
|-------|--------|-----------------|
| ARCH-05A + ARCH-05B | Selection + Move command | Selection без move бессмысленна |
| ARCH-10A + ARCH-10B | PassabilityGrid + BFS validation | Половина функции без другой |
| ARCH-13A + ARCH-13B | Inertia + Dust | Один renderer, одна концепция |
| ARCH-11A + ARCH-18A | Dev panel + DevController | DevController — prerequisite |

### Нужно разделять

| Разделение | Почему |
|-----------|--------|
| ARCH-01 → A/B/C/D | Разные подсистемы, разные зависимости |
| ARCH-03 → BUILD-ANCHOR-02/03 + BUILD-01 | Data model, generator, renderer — разные слои |
| ARCH-04 → A/B/C/D | State, builder, renderer, UI — разные subsystem |
| ARCH-06 → A/B/C/D | Separator, storage, factory, UI |
| ARCH-08 → A/B/C/D | Variants, grid, environment, spike |

---

## 9. Модели данных и владение

| Модель данных | Владелец | Файл |
|---|---|---|
| `GameState` | `updateGameState.ts` | `src/state/types.ts` |
| `EconomyState` | `economy.ts` | `src/state/economy.ts` (будущий) |
| `PowerState` | `power.ts` | `src/state/power.ts` (будущий) |
| `ControlState` | `control.ts` | `src/state/control.ts` (будущий) |
| `ConstructionState` | `construction.ts` | `src/state/construction.ts` ✅ |
| `ProductionState` | `production.ts` | `src/state/production.ts` (будущий) |
| `MapData` | `mapgen.ts` | `src/state/mapgen.ts` (будущий) |
| `PassabilityGrid` | `passability.ts` | `src/state/passability.ts` (будущий) |
| `BuildingPlacementMeta` | `buildingPlacementMeta.ts` | `src/assets/buildingPlacementMeta.ts` ✅ |
| `BuildingConfig` | `construction.ts` | `src/state/construction.ts` ✅ |
| `WorldConfig` | `worldConfig.ts` | `src/config/worldConfig.ts` — должен стать immutable |

### Критические правила

- Только `updateGameState.ts` мутирует `GameState`
- Render-слой **никогда** не мутирует state
- Phaser GameObjects — «зеркала» state, не хранят gameplay-данные
- Dev actions — через explicit dev-only functions

---

## 10. Рекомендация по art pipeline

### Что адаптировать из Ashen Crown

1. Source sheet folder → runtime PNGs
2. Python/Node processor → нарезка
3. Manifest с enabledKeys
4. Sample viewer
5. Audit images
6. Normalized previews
7. Crop/edge warnings
8. Runtime asset gating

### Специфика Four Elements

| Asset тип | Four Elements формат | Разница с Ashen Crown |
|---|---|---|
| Здания | Individual PNGs + BuildingPlacementMeta | Metadata-driven placement, не uniform frame |
| Units | Spritesheet 8×8 (256 frame) | Frame size другой |
| Modular units | Individual PNGs per direction | Уникальная фича |
| Terrain | Individual PNGs + variants | Совместим |

### Что НЕ копировать

1. Орк-эльф faction split (4 фракции, не 2)
2. Building spritesheet format (individual PNGs, не sheets)
3. Damage/destruction overlays (premature — нет combat)
4. Caravan/future unit sheets
5. Water tile sheets

---

## 11. Рекомендация по devtools / test arena

### DevArenaScene (отдельная Phaser Scene)

**Рекомендация: Отдельная Phaser Scene.** Полная изоляция, отдельный lifecycle, простой переход через `scene.start()`.

**DevArena priority nuance:**
- Skeleton может быть сдвинут раньше полного combat
- Помогает тестировать unit movement, facing, anchors, VFX, dummy targets
- Combat-specific features заблокированы до ARCH-19
- Early DevArena: spawn unit, spawn dummy, reset, show anchors/directions/frame index

### Структура DevArenaScene

```
DevArenaScene
├── preload() — только arena-relevant ассеты
├── create()
│   ├── Arena state (минимальный GameState subset)
│   ├── Arena renderer (переиспользует sub-renderers)
│   ├── Arena input controller
│   └── Arena UI panel (DOM)
└── update()
    ├── Tick arena state
    └── Sync render
```

### Активация

- `?arena=1` query param
- Dev panel кнопка
- Keyboard shortcut (dev mode only)

---

## 12. Рекомендация по VFX

### Конкретная реализация

| VFX тип | Phaser API | Когда |
|---|---|---|
| Inertia | `scene.tweens.add()` | ARCH-13A |
| Dust | `scene.add.particles()` | ARCH-13B |
| Gather pulse | `scene.tweens.add()` | ARCH-13C |
| Unload pulse | `scene.tweens.add()` | ARCH-13C |
| Construction milestone | `scene.tweens.add()` | ARCH-13C |
| Separator active | `scene.add.particles()` | ARCH-13D |
| Factory spawn | `scene.tweens.add()` | ARCH-13D |
| Projectile/Muzzle/Hit | Tweens + Particles | ARCH-19C |
| Destroyed state | Particles + sprite swap | ARCH-19D |

### Правила

- Phaser Tweens предпочтительнее для большинства VFX
- Custom interpolation только для projectile arc, turret rotation
- Particle design: минимум particles, короткий lifespan, low emit rate, small texture, alpha fade-out
- **Gameplay state не должен искажаться visual interpolation**

---

## 13. Рекомендация по UI/save/редактору

### DOM UI архитектура

DOM overlay поверх Phaser canvas. Screen Manager управляет переключением. UI-Game bridge через getters и callbacks.

### Save/load schema

Versioned JSON, localStorage, 3 save slots. Все данные JSON-serializable.

### Editor

Отдельная Phaser Scene (`EditorScene`). Place/Erase/Select/Fill tools. Validation panel.

---

## 14. Риски и антипаттерны

### Критические риски

| Риск | Вероятность | Влияние | Mitigation |
|---|---|---|---|
| Civil loop не fun | 🟡 | 🔴 | 15-30 min playtest после PR5. Если не fun — фиксить loop, не добавлять combat |
| Phaser 4 API instability | 🟢 | 🟡 | Пин точную версию. PHASER4-API-SPIKE перед зависимостью |
| Performance degradation | 🟡 | 🟡 | RenderTexture.stamp() = N draw calls. Spike для TilemapGPULayer |
| Manual calibration debt | 🔴 | 🔴 | ARCH-03 metadata-driven подход. PR #28 закрыт |
| Mutable global state | 🟡 | 🟡 | Убрать tunerState из worldConfig. Dev-only guard |
| Over-engineering pipeline | 🟡 | 🟡 | Pipeline по необходимости. Минимум: naming + manifest |
| Under-testing | 🔴 | 🔴 | Каждый PR — тесты. Unit для state, manual QA для render |

### Антипаттерны

| Антипаттерн | Как избежать |
|---|---|
| Manual per-PNG tuning | Metadata-driven: BuildingPlacementMeta, offline generator |
| Mutable global config | Immutable config, dev overrides через guard |
| God Object renderer | Sub-renderers (уже частично сделано — ModularTankRenderer, ConstructionRenderer) |
| GameScene as monolith | Sub-controllers. GameScene — orchestration only |
| Copy-paste from Next | Reference → Rewrite |
| Phaser as Canvas 2D | Исследовать advanced API (через PHASER4-API-SPIKE) |
| Combat before civil | Строго следовать роадмапу |
| Runtime pixel scanning | Offline metadata generation only |
| Dual renderer/fallback | Один renderer: Phaser 4 WebGL-only |

---

## 15. Триггеры повторного аудита

1. Phaser major version update
2. Civil loop не fun после PR5
3. GameScene > 500 строк (после split)
4. Performance regression > 20%
5. More than 3 manual offset values в production code
6. Save format version change
7. Architecture decision, противоречащий этому аудиту
8. Unit count > 50 on screen (SpriteGPULayer spike)
9. Map size > 64×64 (TilemapGPULayer spike)
10. Before ARCH-19 (обязательный аудит civil loop)

---

## 16. Стратегия валидации

### Трёхуровневая валидация

**Уровень 1: TypeScript Compiler** — `npm run typecheck`, strict mode
**Уровень 2: Unit Tests** — Vitest для `src/state/`, coverage > 80%
**Уровень 3: Integration / E2E** — Playwright smoke tests после ARCH-18D

---

## 17. Стратегия ручного QA

### QA checklist для каждого PR

1. Boot check — страница загружается без errors
2. Terrain check — тайлы видны
3. Entity check — все entities на месте
4. Camera check — пан, зум, сброс
5. HUD check — resource counts обновляются
6. No regression — всё работает как до PR

### QA environments

| Среда | URL |
|---|---|
| PR preview | `https://ratoker-jpg.github.io/four-elements-phaser/pr-NN/` |
| Main branch | `https://ratoker-jpg.github.io/four-elements-phaser/` |
| Local dev | `http://localhost:5173/` |

---

## Acceptance criteria for ROADMAP_SYSTEM_AUDIT_01D

- [x] Нет конфликтующих списков следующих PR (единый канонический список в разделе 7)
- [x] Нет stale BUILD-ANCHOR-01 future task (помечен как DONE)
- [x] Current main sync section существует (раздел 0)
- [x] PR #28 помечен как superseded (в разделе 0 и ARCH-03)
- [x] Advanced Phaser APIs gated by PHASER4-API-SPIKE (раздел 4)
- [x] Economy naming gate существует (раздел 5)
- [x] Construction existing/missing split существует (ARCH-04)
- [x] Harvester manual override safety rule существует (ARCH-05)
- [x] DevArena priority nuance существует (ARCH-12)
- [x] EntityRenderer статус скорректирован (не God Object, экстракция уже выполнена)
- [x] Документ пригоден для GPT/GLM task generation (каждый ARCH содержит: Goal, Approach, Phaser APIs, Pure TS, Renderer, DOM UI, Data/Config, Tests, QA, Risks, What not to do, PR breakdown, Dependencies)
- [x] Статус документа уточнён: source-of-truth **после мержа ARCH-00-docs**, не до
- [x] docs/project/ файлы помечены как подготовленные, но не на main
- [x] docs/ROADMAP.md на main помечен как текущий/старый, будет заменён через ARCH-00-docs
- [x] Добавлен блок «Подготовлено, но не замержено» (раздел 0)
- [x] ARCH-00 описывает замерж уже подготовленных файлов, не создание с нуля
