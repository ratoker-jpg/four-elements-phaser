# ARENA SANDBOX SYSTEM AUDIT — технический аудит

Статус: технический аудит для реализации Arena Sandbox  
Проект: Four Elements Phaser  
Репозиторий: `ratoker-jpg/four-elements-phaser`  
Phaser: 4.1.0  
TypeScript / Vite / Vitest  
Дата: 2026-06-03  
Roadmap: `docs/project/ARENA_SANDBOX_ROADMAP.md`

---

## 1. Цель аудита

Этот аудит — технический источник правды для реализации Arena Sandbox.

Он исследует текущий код репозитория и определяет:

- где сейчас живёт арена и DevTools;
- как отделить арену от обычной игры;
- как убрать препятствия из рантайма арены;
- как реализовать каждый шаг roadmap;
- какие файлы трогает каждый шаг;
- какие риски есть на каждом шаге;
- какие критерии приёмки и ручное QA для каждого шага;
- итоговую последовательность High+/High PR.

---

## 2. Текущая карта кода

### 2.1 Сцены и инициализация

```text
BootScene → PreloadScene → MainMenuScene → NewGameSetupScene → GameScene
```

Ключевые файлы:

| Файл | Класс / функция | Роль |
|------|----------------|------|
| `src/main.ts` | `createGameConfig()` | Регистрация всех сцен в Phaser |
| `src/config/gameConfig.ts` | `createGameConfig()` | WebGL, 1024×768, список сцен |
| `src/phaser/BootScene.ts` | `BootScene` | Маршрутизация в PreloadScene |
| `src/phaser/PreloadScene.ts` | `PreloadScene` | Загрузка ассетов; skip modularUnits в standard |
| `src/phaser/MainMenuScene.ts` | `MainMenuScene` | New Game / Continue / Settings |
| `src/phaser/NewGameSetupScene.ts` | `NewGameSetupScene` | Выбор фракции, карты, режима (standard/debug/arena) |
| `src/phaser/GameScene.ts` | `GameScene` | Основной игровой цикл, оркестрация всех систем |

### 2.2 Как определяется режим Arena

В `GameScene.create()`:

```typescript
urlDevtools = isDevtoolsEnabled()     // ?devtools=1
urlArena = urlDevtools && isArenaEnabled()  // ?arena=1
configDebug = setupConfig.gameMode === 'debug'
configArena = setupConfig.gameMode === 'arena'
devtoolsActive = urlDevtools || configDebug || configArena
arenaMode = urlArena || configArena
```

Когда `arenaMode = true`, используется `createArenaMapData()` вместо нормальной генерации карты.
Когда `devtoolsActive = true`, создаются все blockout-подсистемы.

Файлы:

| Файл | Функция | Роль |
|------|---------|------|
| `src/state/devArena.ts` | `isArenaEnabled()`, `createArenaMapData()`, `devResetArena()` | Данные арены |
| `src/state/devCommands.ts` | `isDevtoolsEnabled()`, DevCommand-функции | DevTools-команды |

### 2.3 Текущая карта арены

`createArenaMapData()` создаёт:

- размер: 20×20;
- terrain: все клетки `sand`;
- HQ: позиция (3, 3);
- 5 ресурсов (2 medium, 2 small, 1 infinite);
- 1 builder;
- зданий: 0;
- препятствий: 0.

Это НЕ чистая арена — в ней есть HQ, builder, ресурсы. Их нужно убрать по roadmap.

### 2.4 DevTools UI

`src/phaser/ui/DevtoolsPanel.ts` — DOM-оверлей (fixed, left side, z-index 25):

- Секции: Resources, Spawn, Diagnostics, Assets, Overlays, Arena (Reset)
- Включается: F10 или backtick
- Содержит встроенный `AssetViewerPanel`

DevTools — не основной UX арены. По roadmap арена не должна зависеть от DevTools.

### 2.5 Blockout Vehicle State

`src/state/blockoutVehicleState.ts` — `BlockoutVehicleState`:

- id, bodyId, weaponId, faction
- tx/ty, worldX/worldY, bodyAngle, turretAngle, turretTargetAngle, turretTurnSpeedDeg
- движение: vx/vy, speed, targetWorldX/Y, hasMoveTarget
- отдача: lastFiredAt, recoilActive/StartedAt/DurationMs, barrelOffset, turretOffset, bodyOffset
- стрельба: fireHeld, isFiring, lastStreamTickAt, visualOverheat
- HP/урон: hp, maxHp, isDestroyed, destroyedAt, lastDamagedAt, damageFlashUntil
- апгрейды: upgradeLevels, lastUpgradedAt

### 2.6 Конфиги юнитов

| Файл | Содержимое |
|------|-----------|
| `src/config/blockoutVehicleData.ts` | 9 предустановленных комбинаций (wasp-smoky, hornet-ricochet и т.д.) |
| `src/config/blockoutBodyData.ts` | 7 корпусов (wasp, hornet, hunter, viking, dictator, titan, mammoth) |
| `src/config/blockoutWeaponData.ts` | 11 пушек (smoky, railgun, thunder, shaft, flamethrower, freeze, isida, vulcan, twins, ricochet, hammer) |
| `src/config/blockoutMovementData.ts` | Профили движения по корпусам |
| `src/config/blockoutDamageData.ts` | Профили урона по пушкам |
| `src/config/blockoutRecoilData.ts` | Профили отдачи по пушкам |
| `src/config/blockoutVfxData.ts` | VFX-профили |
| `src/config/blockoutObstacleData.ts` | 4 типа препятствий + layout по умолчанию |
| `src/config/blockoutScenarioData.ts` | `DEFAULT_SANDBOX_SCENARIO` — 9 юнитов + 6 препятствий |
| `src/config/blockoutUpgradeData.ts` | 5 апгрейдов |
| `src/config/blockoutProfiles.ts` | Общие типы: BodyId, WeaponId, BlockoutShape и т.д. |

### 2.7 Система препятствий

`src/state/blockoutObstacleState.ts`:

```typescript
BlockoutObstacleType = 'blocker_wall' | 'cover_crate' | 'low_barrier' | 'dummy_rock'
```

`src/config/blockoutObstacleData.ts` — конфиги типов:

| Тип | Форма | blocksMove | blocksLOF | pierceable | Цвет |
|-----|-------|-----------|-----------|------------|------|
| blocker_wall | rect 80×16 | да | да | нет | 0x555555 |
| cover_crate | rect 24×24 | да | да | нет | 0x8B6914 |
| low_barrier | rect 40×10 | да | да | да | 0x777777 |
| dummy_rock | circle r=18 | да | да | нет | 0x6b5b3a |

`src/state/blockoutObstacles.ts` — геометрия столкновений:
- `lineIntersectsRect()`, `lineIntersectsCircle()` — пересечение отрезка с формой
- `findNearestObstacleBlockingLine()` — ближайшее препятствие на линии огня
- `isLineOfFireBlocked()` — проверка блокировки огня
- `checkVehicleObstacleCollision()` — столкновение юнит-препятствие
- `resolveVehicleObstacleCollisions()` — разрешение всех коллизий

Рендерер: `src/phaser/render/BlockoutObstacleRenderer.ts`

### 2.8 HQ / база / харвестеры / ресурсы

HQ:
- `src/state/types.ts` — `HqPlacement { tx, ty, faction }`, 3×3 footprint
- `src/state/createInitialState.ts` — HQ center position

Харвестеры:
- `src/state/updateGameState.ts` — полная state machine харвестера:
  idle → moving-to-resource → gathering → returning-to-hq → unloading → idle

Ресурсы:
- `src/state/types.ts` — `ResourceType`, `ResourceNodeState`

Экономика:
- `src/state/types.ts` — `EconomyState { raw, matter, elements, powerGenerated, powerConsumed, ... }`

### 2.9 Turret / оружие / урон

Turret rotation:
- `src/phaser/input/BlockoutVehicleInputController.ts` — **turret aim = mouse world position** (каждый кадр)
- `rotateTowardAngle(current, target, maxDelta)` — rate-limited поворот

Оружие:
- `src/state/blockoutWeaponVfx.ts` — `fireBlockoutWeapon()`, `tickContinuousFire()`

Урон:
- `src/state/blockoutDamage.ts` — 9 damage kinds, все find-функции для целей

Отдача:
- `src/config/blockoutRecoilData.ts` — barrelKickbackPx, turretKickbackRad, bodyImpulsePx, recoveryMs

### 2.10 Input / управление

GameInputController (гражданские юниты):
- `src/phaser/input/GameInputController.ts` — LMB select/move, ESC, build/produce hotkeys

BlockoutVehicleInputController (dev/arena):
- `src/phaser/input/BlockoutVehicleInputController.ts`:
  - LMB → select blockout vehicle
  - RMB → set movement target
  - Mouse move → turret aim target (каждый кадр) — **это то, что нужно заменить**
  - Space/F → fire weapon
  - U/I/O/P/B (1-5) → upgrades
  - R → reset scenario
  - T → cycle selected vehicle
  - H → help overlay
  - C → camera calibration
  - Key-up Space/F → stop continuous fire

### 2.11 Камерная проекция

`src/config/cameraProjectionContract.ts`:

```text
basisX = {x: 38, y: 19}
basisY = {x: -38, y: 19}
basisZ = {x: 0, y: -60}
PROJ_TILE_W = 76, PROJ_TILE_H = 38
projectGroundPoint(wx, wy, origin)
projectWorldPoint(wx, wy, wz, origin)
unprojectScreenToGround(screenX, screenY, origin)
```

`src/phaser/render/isometric.ts`:
- `tileToScreen(tx, ty)` — `(tx-ty)*38, (tx+ty)*19`
- `screenToTile(sx, sy)` — обратная проекция

`src/phaser/render/blockoutVehicleGeometry.ts` — shared geometry (единый источник правды):
- `computeProjectedTurretMountScreen()`
- `computeProjectedBarrelTipScreen()`
- `computeProjectedBarrelTipScreenAtZ()`
- `computeProjectedBlockoutVehicleGeometry()`

### 2.12 HUD / UI

| Файл | Роль |
|------|------|
| `src/phaser/ui/PlaytestHud.ts` | Правая панель: экономика, харвестеры, фабрики, строительство, производство |
| `src/phaser/ui/DevtoolsPanel.ts` | Левая панель: ресурсы, spawn, диагностика, ассеты, оверлеи |
| `src/phaser/render/BlockoutSandboxHudRenderer.ts` | Help overlay (H) + статус выбранного юнита |
| `src/phaser/ui/PauseMenu.ts` | ESC меню: Resume, Restart, Main Menu, Save, Load |

### 2.13 State management

Основной цикл GameScene.update():

```text
1. updateGameState(state, delta)         → harvester loop, power, separators, factories
2. assignIdleBuilders(state)             → auto-assign builders
3. updateBuilders(state, delta)          → builder movement
4. updateConstructionSiteProgress()      → building construction
5. entityRenderer.syncFromState()
6. buildingStatusRenderer.syncFromState()
7. playtestHud.update()
8. inputController.update()              → selection highlight
9. devtoolsPanel.update()
10. debugOverlayRenderer.syncFromState()
11. feedbackRenderer.syncFromState()
12. motionFxRenderer.syncFromState()
13. [Dev] blockoutVehicleInputController.update()
14. [Dev] updateBlockoutVehicleMovement()
15. [Dev] updateBlockoutRecoil()
16. [Dev] tickContinuousFire() + tickContinuousDamage()
17. [Dev] blockoutVehicleRenderer/weaponVfx/damage/obstacle/upgrade/hud syncs
```

---

## 3. Анализ разделения Arena от Normal Game и DevTools

### 3.1 Текущая проблема

Сейчас арена — это просто набор URL-параметров и флагов внутри GameScene. Нет отдельной сцены для арены. Нет отдельного потока инициализации. Арена запускает тот же GameScene, что и обычная игра, но с флагами `devtoolsActive` и `arenaMode`.

Арена наследует от обычной игры:
- HQ и харвестеров (через `createArenaMapData()`);
- экономику и производство (через PlaytestHud);
- DevTools-панель как основной UX;
- всю логику гражданского цикла (updateGameState).

### 3.2 Как отделить Arena от Normal Game

Нужен **отдельный путь инициализации**. Возможные подходы:

**Подход A: ArenaScene — отдельная Phaser-сцена**

Создать новую `ArenaScene` (extends Phaser.Scene), которая:
- не создаёт HQ, харвестеров, ресурсы, экономику;
- не создаёт PlaytestHud;
- создаёт только: TerrainRenderer, CameraControls, BlockoutVehicle подсистемы, Arena Menu;
- создаёт ArenaMenu (DOM UI) вместо PlaytestHud + DevtoolsPanel.

Плюсы: полная изоляция, нет риска сломать обычную игру.
Минусы: дублирование части кода (terrain, camera, entity sync).

**Подход B: Режим внутри GameScene с early-return**

Оставить одну GameScene, но в `create()` при `arenaMode`:
- не создавать HQ/harvesters/resources/economy subsystems;
- не создавать PlaytestHud;
- создавать ArenaMenu вместо DevtoolsPanel + PlaytestHud;
- в `update()` пропускать гражданский цикл.

Плюсы: нет дублирования кода.
Минусы: GameScene становится сложнее, больше условий.

**Рекомендация: Подход B с чистым разделением через ArenaModeContext.**

Создать `ArenaModeContext` — объект, который передаётся в подсистемы и определяет, какие подсистемы активны. Это даёт изоляцию без дублирования.

### 3.3 Как отделить Arena от DevTools

DevTools должен остаться доступным в Debug-режиме, но не быть основным UX арены.

Арена должна иметь свой ArenaMenu (DOM UI), который:
- заменяет DevtoolsPanel для управления ареной;
- не зависит от DevtoolsPanel;
- не требует включения DevTools.

DevtoolsPanel остаётся доступной через F10/backtick как отладочный инструмент, но не является основным путём работы с ареной.

### 3.4 Файлы, которые нужно изменить для разделения

| Файл | Изменение |
|------|----------|
| `src/state/devArena.ts` | Переписать `createArenaMapData()`: убрать HQ, ресурсы, builder |
| `src/phaser/GameScene.ts` | Добавить ArenaModeContext; условное создание подсистем |
| `src/phaser/NewGameSetupScene.ts` | Режим arena → передать флаг в GameScene |
| `src/state/createInitialState.ts` | При arenaMode: не создавать harvester/economy/HQ |

Новые файлы:

| Файл | Назначение |
|------|-----------|
| `src/phaser/ui/ArenaMenu.ts` | Arena DOM UI (замена DevTools для арены) |
| `src/state/arenaModeContext.ts` | Контекст арены: флаги, какие подсистемы активны |

---

## 4. Как убрать препятствия из Arena

### 4.1 Текущие препятствия

Препятствия существуют только в blockout-режиме:
- `BlockoutObstacleState` в `GameState.blockoutObstacles`
- Создаются через `createBlockoutObstacle()` в `blockoutScenario.ts`
- Рендерятся через `BlockoutObstacleRenderer`
- Используются в `blockoutObstacles.ts` для коллизий и линии огня

### 4.2 Что нужно убрать

По roadmap арена не должна содержать:

- `blocker_wall`
- `cover_crate`
- `low_barrier`
- `dummy_rock`
- ящики, камни, барьеры, стены как геймплейные преграды

### 4.3 Как убрать

1. **В `createArenaMapData()` / `devResetArena()`**: не создавать препятствия. Сейчас `createArenaMapData()` и так не создаёт препятствия (0 obstacles), но `DEFAULT_SANDBOX_SCENARIO` в `blockoutScenarioData.ts` создаёт 6 препятствий.

2. **В `resetBlockoutScenario()`**: при arenaMode не создавать scenario obstacles.

3. **В `BlockoutVehicleInputController`**: убрать клавиши добавления/удаления препятствий, если они есть (проверить).

4. **В `DevtoolsPanel`**: убрать секцию obstacles для arenaMode (если она есть).

5. **Не удалять** систему препятствий из кода — она нужна для Normal Game и может понадобиться позже. Просто не создавать препятствия в arenaMode.

### 4.4 Файлы

| Файл | Изменение |
|------|----------|
| `src/state/devArena.ts` | Убедиться, что `devResetArena()` не создаёт препятствия |
| `src/state/blockoutScenario.ts` | При arenaMode: `resetBlockoutScenario()` не создаёт obstacles |
| `src/config/blockoutScenarioData.ts` | Опционально: добавить `ARENA_SANDBOX_SCENARIO` без препятствий |

---

## 5. Как реализовать Unit Composer

### 5.1 Текущее состояние

Сейчас юниты создаются через `devSpawnBlockoutVehicle(bodyId, weaponId, faction, tx, ty)` в `devCommands.ts`. Это функция без UI — вызывается из DevTools или клавиатуры.

Конфиги уже разделены:
- 7 корпусов: `blockoutBodyData.ts`
- 11 пушек: `blockoutWeaponData.ts`
- Комбинации: `blockoutVehicleData.ts` (9 предустановок)

`BodyId` и `WeaponId` — string union types в `blockoutProfiles.ts`.

### 5.2 Unit Composer — что нужно

ArenaMenu должен предоставить:

1. **Выбор корпуса**: выпадающий список или кнопки из 7 корпусов
2. **Выбор пушки**: выпадающий список или кнопки из 11 пушек
3. **Выбор стороны**: ally / enemy (2 кнопки)
4. **Кнопка «Разместить»**: переводит в режим размещения
5. **Кнопка «Отмена»**: выходит из режима размещения

### 5.3 Реализация Unit Composer

Создать `ArenaUnitComposer` — DOM UI компонент внутри `ArenaMenu`:

```text
ArenaMenu
├── ArenaUnitComposer
│   ├── BodySelector (7 корпусов)
│   ├── WeaponSelector (11 пушек)
│   ├── TeamSelector (ally / enemy)
│   ├── PlaceButton
│   └── CancelButton
├── ArenaRoster + Usability (Step 4)
├── ArenaActions (Reset, Clear, Help)
└── ArenaStatus (placement mode, target status)
```

**Данные**: читать списки корпусов и пушек напрямую из конфигов:

```typescript
import { BODY_PROFILES } from '../config/blockoutBodyData';
import { WEAPON_PROFILES } from '../config/blockoutWeaponData';
```

Не хардкодить списки в UI. Конфиг — единственный источник правды.

**Создание юнита**: вызвать `devSpawnBlockoutVehicle(bodyId, weaponId, faction, tx, ty)` или создать Arena-специфичную функцию `arenaSpawnVehicle()`.

### 5.4 Файлы

Новые:

| Файл | Назначение |
|------|-----------|
| `src/phaser/ui/ArenaMenu.ts` | Arena DOM UI |
| `src/phaser/ui/ArenaUnitComposer.ts` | Выбор корпуса/пушки/стороны + размещение |

Изменяемые:

| Файл | Изменение |
|------|----------|
| `src/state/devArena.ts` | Добавить `arenaSpawnVehicle()` или расширить `devSpawnBlockoutVehicle()` |
| `src/state/blockoutVehicleState.ts` | Добавить поле `team: 'ally' | 'enemy'` (сейчас только faction: 'cyan' | 'green') |

---

## 6. Как реализовать Click Placement через камерную проекцию

### 6.1 Текущее состояние

Сейчас юниты размещаются:
- по предустановленным позициям из scenario;
- через `devSpawnBlockoutVehicle(bodyId, weaponId, faction, tx, ty)` с заданными координатами.

Нет интерактивного click-to-place.

### 6.2 Реализация Click Placement

Использовать камерную проекцию для конвертации screen → world → tile:

```text
1. Пользователь кликает на экран.
2. camera.getWorldPoint(screenX, screenY) → screen-world position.
3. unprojectScreenToGround(worldX, worldY, mapOrigin) → { x, y } —
   мировые/тайловые координаты на ground plane (z=0).
4. x и y — это дробные тайловые координаты. Округлить Math.round(x),
   Math.round(y) до ближайшего целого тайла.
5. Проверить passability через occupancy map.
6. Если проходимо — создать юнита в (tx=Math.round(x), ty=Math.round(y)).
7. Если нет — показать feedback (красная вспышка / сообщение).
```

Ключевая функция из `cameraProjectionContract.ts`:

```typescript
unprojectScreenToGround(screenX, screenY, origin): { x: number; y: number }
```

Возвращает `{ x, y }` — мировые/тайловые координаты на ground plane.
Значения дробные, поэтому для размещения юнита нужно округлить
до целого тайла: `tx = Math.round(result.x)`, `ty = Math.round(result.y)`.

Не путать с `screenToTile()` из `isometric.ts`, которая использует
другую формулу. Для click placement следует использовать
`unprojectScreenToGround()` — это единый источник правды
согласно CAMERA_PROJECTION_CONTRACT.

### 6.3 Placement Mode State Machine

```text
IDLE → (нажал "Разместить") → PLACING → (клик по арене) → юнит создан → IDLE
                                         → (Esc / RMB) → отмена → IDLE
```

Нужен state: `placementMode: 'idle' | 'placing'` + выбранные body/weapon/team.

### 6.4 Файлы

Новые:

| Файл | Назначение |
|------|-----------|
| `src/state/arenaPlacement.ts` | Placement state machine, click-to-tile conversion |

Изменяемые:

| Файл | Изменение |
|------|----------|
| `src/phaser/GameScene.ts` | Обработка клика в режиме placement |
| `src/phaser/input/BlockoutVehicleInputController.ts` | Интеграция placement mode |

---

## 7. Как заменить mouse-follow turret на target-lock

### 7.1 Текущее поведение

В `BlockoutVehicleInputController.update()`:

```typescript
// Каждый кадр:
turretTargetAngle = angleFromTo(turretMountScreen, mouseWorldPosition);
vehicle.turretTargetAngle = rotateTowardAngle(
  vehicle.turretAngle,
  turretTargetAngle,
  maxDelta
);
```

Башня всегда поворачивается к позиции мыши.

### 7.2 Целевое поведение

```text
1. Игрок выбирает союзного юнита.
2. Игрок кликает по вражескому юниту → враг становится target.
3. turretTargetAngle = angleFromTo(turretMountScreen, target.worldX/worldY).
4. Если цель уничтожена → башня держит последний угол.
5. Esc / отдельная кнопка → снять цель.
6. Мышка не управляет башней.
```

### 7.3 Реализация

Добавить в `BlockoutVehicleState`:

```typescript
targetVehicleId: string | null;  // ID целевого юнита
```

Добавить в input controller:

```text
1. LMB click на врага → selectedVehicle.targetVehicleId = enemy.id
2. В update():
   if (targetVehicleId !== null) {
     const target = findVehicleById(targetVehicleId);
     if (target && !target.isDestroyed) {
       turretTargetAngle = angleFromTo(turretMountScreen, targetWorldCenter);
     } else {
       // цель уничтожена — держать последний угол
       // не обновлять turretTargetAngle
     }
   } else {
     // нет цели — башня держит текущий угол
     // (не следит за мышкой)
   }
```

Снять цель:
- Esc при выбранном юните;
- клик по пустому месту;
- отдельная кнопка «Снять цель» в ArenaMenu.

### 7.4 Ally/Enemy модель

Нужно различать союзников и врагов:

```typescript
// В BlockoutVehicleState:
team: 'ally' | 'enemy';
```

Правила:
- `ally`: управляемый, можно выбрать, двигать, назначить цель, стрелять.
- `enemy`: неуправляемый, можно назначить целью, наносить урон, уничтожить.
- `ally` может иметь `targetVehicleId` → только на `enemy` юнита.
- `enemy` не может быть выбран игроком для управления.

### 7.5 Файлы

Изменяемые:

| Файл | Изменение |
|------|----------|
| `src/state/blockoutVehicleState.ts` | Добавить `team`, `targetVehicleId` |
| `src/phaser/input/BlockoutVehicleInputController.ts` | Target-lock логика вместо mouse-follow |
| `src/state/blockoutDamage.ts` | Учитывать ally/enemy при поиске целей |
| `src/config/blockoutScenarioData.ts` | Обновить сценарий: указать team для юнитов |

---

## 8. Поведение врагов

### 8.1 Текущее состояние

Враги (green faction) — статические. Нет AI, нет поведения. Они стоят на месте, пока игрок не выстрелит.

### 8.2 Целевые режимы

| Режим | Описание |
|-------|----------|
| Пассивная цель | Враг стоит и получает урон |
| Стоячий стрелок | Враг стоит на месте, но стреляет по ближайшему ally |
| Преследователь | Враг едет к ближайшему ally и стреляет |
| Охрана позиции | Враг стоит в зоне, стреляет если ally в радиусе |

### 8.3 Реализация

Добавить в `BlockoutVehicleState`:

```typescript
aiMode: 'passive' | 'stationary_shooter' | 'chaser' | 'hold_position' | 'none';
aiHoldRadius: number; // для hold_position
```

Создать `src/state/blockoutAi.ts`:

```typescript
function updateBlockoutAi(vehicles: BlockoutVehicleState[], delta: number): void
```

Логика по режимам:

**passive**: ничего не делать. Враг стоит.

**stationary_shooter**:
- найти ближайшего ally;
- если ally в радиусе оружия → навести turret на ally;
- если turret наведена → стрелять.

**chaser**:
- найти ближайшего ally;
- установить moveTarget = ally position;
- если расстояние < weapon range → навести turret + стрелять.

**hold_position**:
- если ally в радиусе aiHoldRadius → навести turret + стрелять;
- если враг сдвинулся > aiHoldRadius от стартовой позиции → вернуться.

### 8.4 Файлы

Новые:

| Файл | Назначение |
|------|-----------|
| `src/state/blockoutAi.ts` | AI behaviour: updateBlockoutAi() |

Изменяемые:

| Файл | Изменение |
|------|----------|
| `src/state/blockoutVehicleState.ts` | Добавить aiMode, aiHoldRadius |
| `src/phaser/GameScene.ts` | Вызывать updateBlockoutAi() в update loop |
| `src/phaser/ui/ArenaMenu.ts` | Добавить AI mode selector для enemy юнитов |

---

## 9. Пошаговый план реализации

### ARENA-00H+ — Большой аудит (этот документ)

**Тип**: Docs only  
**Риск**: Нет  
**Что добавляет**: Технический источник правды для всех следующих шагов

---

### ARENA-01H+ — Отдельная чистая арена

**Цель**: Арена — отдельный режим. Нет HQ, харвестеров, ресурсов, экономики, препятствий. Есть Arena Menu.

**Файлы, которые нужно тронуть**:

| Файл | Изменение |
|------|----------|
| `src/state/devArena.ts` | Переписать `createArenaMapData()`: убрать HQ, ресурсы, builder; пустая 20×20 карта |
| `src/state/devArena.ts` | Добавить `devResetArena()` без HQ/ресурсов |
| `src/phaser/GameScene.ts` | ArenaModeContext; условное создание подсистем |
| `src/state/createInitialState.ts` | При arenaMode: не создавать harvester/economy/HQ |
| `src/state/blockoutScenario.ts` | При arenaMode: resetBlockoutScenario() без obstacles |
| `src/phaser/ui/ArenaMenu.ts` | **Новый** — Arena DOM UI (shell: Reset, Clear, Help, Add Unit placeholder) |

Новые файлы:

| Файл | Назначение |
|------|-----------|
| `src/phaser/ui/ArenaMenu.ts` | Arena Menu DOM UI |
| `src/state/arenaModeContext.ts` | Контекст режима арены |

**Риски**:

| Риск | Описание | Смягчение |
|------|----------|----------|
| GameScene усложняется | Больше условий в create/update | ArenaModeContext инкапсулирует логику |
| Сломается Normal Game | Условная логика может сломать обычный режим | Полное ручное QA Normal Game после изменений |
| PlaytestHud всё ещё создан | Нужно скрыть/не создавать для arenaMode | Условное создание в GameScene.create() |
| Save/Load может не работать | ArenaState может не сериализоваться | Не добавлять save/load для арены сейчас |

**Критерии приёмки**:

- [ ] Arena mode открывается через NewGameSetupScene → Arena
- [ ] Нет HQ на карте
- [ ] Нет харвестеров на карте
- [ ] Нет ресурсов на карте
- [ ] Нет экономики / производственного HUD
- [ ] Нет препятствий на карте
- [ ] Есть Arena Menu (shell)
- [ ] Есть кнопка Reset Arena
- [ ] Есть кнопка Clear Units
- [ ] Есть кнопка Help
- [ ] Normal Game не сломан

**Ручное QA**:

1. Запустить Normal Game → проверить, что HQ, харвестеры, ресурсы, экономика работают
2. Запустить Arena → проверить, что карта пустая, нет HQ/ресурсов/харвестеров
3. Проверить Arena Menu: Reset, Clear, Help кнопки
4. Проверить DevTools: F10 работает, но не является основным UX

---

### ARENA-02H+ — Создание и расстановка юнитов

**Цель**: Ручное создание юнита (body + weapon + team) + placement по клику.

**Файлы, которые нужно тронуть**:

| Файл | Изменение |
|------|----------|
| `src/phaser/ui/ArenaMenu.ts` | Добавить ArenaUnitComposer |
| `src/state/blockoutVehicleState.ts` | Добавить `team: 'ally' \| 'enemy'` |
| `src/state/devArena.ts` | Добавить `arenaSpawnVehicle()` |
| `src/state/blockoutScenario.ts` | При arenaMode: не использовать DEFAULT_SANDBOX_SCENARIO |

Новые файлы:

| Файл | Назначение |
|------|-----------|
| `src/phaser/ui/ArenaUnitComposer.ts` | Body/Weapon/Team selector + Place/Cancel |
| `src/state/arenaPlacement.ts` | Placement state machine, click-to-tile |

**Риски**:

| Риск | Описание | Смягчение |
|------|----------|----------|
| Camera projection неточность | unproject может давать неточный tile | Использовать `unprojectScreenToGround()` из контракта |
| Placement на занятом тайле | Два юнита на одном тайле | Проверка occupancy |
| Team не совместим с faction | faction = cyan/green, team = ally/enemy | team — отдельное поле, faction задаёт цвет |

**Критерии приёмки**:

- [ ] Arena Menu показывает 7 корпусов
- [ ] Arena Menu показывает 11 пушек
- [ ] Arena Menu показывает ally/enemy выбор
- [ ] Клик по «Разместить» переводит в placement mode
- [ ] Клик по арене создаёт юнита в точке клика
- [ ] Esc / RMB отменяет placement
- [ ] Код не навязывает комбинации body+weapon
- [ ] Ally юниты помечены как ally
- [ ] Enemy юниты помечены как enemy

**Ручное QA**:

1. Выбрать Wasp + Smoky + Ally → Разместить → клик по арене → юнит появился
2. Выбрать Titan + Thunder + Enemy → Разместить → клик → юнит появился
3. Попробовать разместить на занятом тайле → feedback / отказ
4. Нажать Esc в режиме размещения → отмена
5. Проверить, что списки корпусов и пушек берутся из конфигов (не хардкод)

---

### ARENA-03H+ — Управление, цели и правила башни

**Цель**: Ally управляемый, enemy неуправляемый, turret target-lock вместо mouse-follow.

**Файлы, которые нужно тронуть**:

| Файл | Изменение |
|------|----------|
| `src/phaser/input/BlockoutVehicleInputController.ts` | Target-lock логика; mouse-follow убрать |
| `src/state/blockoutVehicleState.ts` | Добавить `targetVehicleId: string \| null` |
| `src/state/blockoutDamage.ts` | Учитывать ally/enemy при поиске целей |
| `src/phaser/GameScene.ts` | Обработка клика по enemy для назначения цели |

**Риски**:

| Риск | Описание | Смягчение |
|------|----------|----------|
| Turret mouse-follow удалён | Может сломать Debug-режим | В Debug-режиме сохранить mouse-follow как опцию |
| Target lost при уничтожении | Нужно держать последний угол | Не обновлять turretTargetAngle если target isDestroyed |
| Ally может стрелять по ally | Нет проверки friendly fire | Добавить проверку team в damage find-функции |

**Критерии приёмки**:

- [ ] Ally можно выбрать кликом
- [ ] Ally можно двигать (RMB)
- [ ] Клик по enemy назначает его как цель
- [ ] Turret ally поворачивается к цели
- [ ] Turret НЕ следит за мышкой
- [ ] Если цель уничтожена — turret держит последний угол
- [ ] Esc снимает цель
- [ ] Enemy нельзя выбрать для управления
- [ ] Ally не может стрелять по ally (friendly fire блокировка)

**Ручное QA**:

1. Создать ally + enemy
2. Выбрать ally, кликнуть enemy как цель
3. Объехать enemy вокруг — turret смотрит на enemy
4. Уничтожить enemy — turret держит последний угол
5. Нажать Esc — цель снята
6. Кликнуть по ally — нельзя управлять enemy

---

### ARENA-04H+ — Arena Control Panel: Roster + Usability + Help

**Цель**: Полная панель управления ареной — список юнитов, статусы, помощь, сообщения. Арена удобна без DevTools и без запоминания горячих клавиш.

Этот шаг объединяет roster и usability в один High+ PR, потому что по отдельности они — medium-scope шаги, а roadmap требует только High+/High gameplay шагов. Вместе они составляют полноценный контрольный центр арены.

**Файлы, которые нужно тронуть**:

| Файл | Изменение |
|------|----------|
| `src/phaser/ui/ArenaMenu.ts` | Добавить ArenaRoster секцию, help, статусы, сообщения |
| `src/phaser/render/BlockoutSandboxHudRenderer.ts` | Обновить help overlay для arena |

Новые файлы:

| Файл | Назначение |
|------|-----------|
| `src/phaser/ui/ArenaRoster.ts` | Список юнитов, select/delete/clear |

**Риски**:

| Риск | Описание | Смягчение |
|------|----------|----------|
| Производительность при большом числе юнитов | DOM обновление на каждый кадр | Обновлять roster по событию, не каждый кадр |
| Синхронизация roster ↔ state | Удаление из roster должно удалить из state | Единственный источник правды — state |
| Help overlay устареет | При изменении горячих клавиш | Читать горячие клавиши из конфига/реестра |

**Критерии приёмки**:

Roster:
- [ ] Roster показывает всех юнитов
- [ ] Видно: body, weapon, team, HP, alive/destroyed
- [ ] Клик по юниту в roster → выбрать на карте
- [ ] Кнопка Delete → удалить выбранного юнита
- [ ] Кнопка Clear Allies → удалить всех ally
- [ ] Кнопка Clear Enemies → удалить всех enemy
- [ ] Кнопка Reset Arena → полная очистка
- [ ] Кнопка Repeat Placement → создать похожего юнита

Usability:
- [ ] Help overlay показывает все горячие клавиши
- [ ] Статус placement mode виден
- [ ] Статус выбранной цели виден
- [ ] Подсказка при пустой арене
- [ ] Сообщение при очистке юнитов
- [ ] Сообщение при сбросе арены

**Ручное QA**:

Roster:
1. Создать 3 ally + 2 enemy
2. Проверить roster: все 5 юнитов видны
3. Удалить одного из roster → юнит исчез с карты
4. Clear Enemies → enemy нет, ally остались
5. Reset Arena → арена пустая

Usability:
6. Открыть Help → все горячие клавиши описаны
7. Войти в placement mode → статус виден
8. Выбрать цель → статус виден
9. Очистить арену → сообщение «Арена очищена»
10. Сбросить арену → сообщение «Арена сброшена»

---

### ARENA-05H+ — Режимы поведения врагов

**Цель**: Простые AI-режимы для enemy юнитов.

**Файлы, которые нужно тронуть**:

| Файл | Изменение |
|------|----------|
| `src/state/blockoutVehicleState.ts` | Добавить `aiMode`, `aiHoldRadius` |
| `src/phaser/GameScene.ts` | Вызывать `updateBlockoutAi()` в update loop |
| `src/phaser/ui/ArenaMenu.ts` | AI mode selector для enemy |

Новые файлы:

| Файл | Назначение |
|------|-----------|
| `src/state/blockoutAi.ts` | AI behaviour update function |
| `src/__tests__/blockoutAi.test.ts` | Unit tests для AI logic |

**Риски**:

| Риск | Описание | Смягчение |
|------|----------|----------|
| AI влияет на Normal Game | AI logic может быть вызвана в обычном режиме | AI вызывается только в arenaMode |
| AI jitter | Chaser может дёргаться при смене цели | Hysteresis: не менять цель часто |
| Performance | AI update каждый кадр для многих юнитов | Ограничить частоту AI tick (раз в 200ms) |

**Критерии приёмки**:

- [ ] Passive: enemy стоит, получает урон
- [ ] Stationary Shooter: enemy стреляет по ally
- [ ] Chaser: enemy едет к ally + стреляет
- [ ] Hold Position: enemy стоит, стреляет если ally рядом
- [ ] AI mode можно выбрать в ArenaMenu при создании enemy
- [ ] AI mode можно изменить для существующего enemy
- [ ] Normal Game не затронут

**Ручное QA**:

1. Создать enemy в passive → ally стреляет, enemy стоит
2. Создать enemy в stationary_shooter → enemy стреляет по ally
3. Создать enemy в chaser → enemy едет к ally + стреляет
4. Создать enemy в hold_position → enemy стоит, стреляет при приближении ally
5. Сменить AI mode → поведение меняется

---

## 10. Сводка рисков

Все gameplay-шаги классифицированы как High+ или High согласно roadmap-дисциплине владельца: gameplay implementation steps must be High+ or High only.

| Шаг | Главный риск | Классификация |
|-----|-------------|---------------|
| ARENA-01H+ | GameScene усложняется, может сломаться Normal Game | High |
| ARENA-02H+ | Camera projection + placement + ally/enemy model — новый gameplay-слой | High+ |
| ARENA-03H+ | Удаление mouse-follow, замена на target-lock, friendly fire — критический gameplay-шаг | High+ |
| ARENA-04H+ | Roster + usability — объединённый шаг для соответствия High+ дисциплине | High |
| ARENA-05H+ | AI режимы — новый gameplay-слой с движением и стрельбой врагов | High+ |

---

## 11. Итоговая последовательность PR

```text
ARENA-01H+ [High]  — Standalone Clean Arena
  ├── arenaModeContext.ts (новый)
  ├── ArenaMenu.ts (новый, shell)
  ├── devArena.ts (переписать createArenaMapData)
  ├── GameScene.ts (ArenaModeContext, условные подсистемы)
  ├── createInitialState.ts (arenaMode: skip HQ/harvesters/economy)
  └── blockoutScenario.ts (arenaMode: skip obstacles)

ARENA-02H+ [High+] — Unit Creation + Click Placement
  ├── ArenaUnitComposer.ts (новый)
  ├── arenaPlacement.ts (новый)
  ├── blockoutVehicleState.ts (добавить team)
  ├── devArena.ts (arenaSpawnVehicle)
  └── ArenaMenu.ts (интеграция UnitComposer)

ARENA-03H+ [High+] — Control, Targeting, and Turret Rules
  ├── BlockoutVehicleInputController.ts (target-lock вместо mouse-follow)
  ├── blockoutVehicleState.ts (добавить targetVehicleId)
  ├── blockoutDamage.ts (ally/enemy проверки)
  └── GameScene.ts (обработка клика по enemy)

ARENA-04H+ [High]  — Arena Control Panel: Roster + Usability + Help
  ├── ArenaRoster.ts (новый)
  ├── ArenaMenu.ts (интеграция Roster + help + статусы + сообщения)
  └── BlockoutSandboxHudRenderer.ts (обновить help overlay)

ARENA-05H+ [High+] — Enemy Behavior Modes
  ├── blockoutAi.ts (новый)
  ├── blockoutAi.test.ts (новый)
  ├── blockoutVehicleState.ts (aiMode, aiHoldRadius)
  ├── GameScene.ts (updateBlockoutAi в loop)
  └── ArenaMenu.ts (AI mode selector)
```

---

## 12. Соблюдение CAMERA_PROJECTION_CONTRACT

Все шаги, связанные с click placement и turret наведением, должны использовать `cameraProjectionContract.ts` как источник правды для проекции:

- `unprojectScreenToGround()` для click-to-tile конверсии (возвращает `{ x, y }`, округлять до целого тайла)
- `projectGroundPoint()` / `projectWorldPoint()` для отрисовки
- `blockoutVehicleGeometry.ts` для turret mount и barrel tip позиций

Не вводить параллельные формулы проекции. Не использовать ручные смещения вместо проекции.

---

## 13. Что НЕ делается в этом цикле

```text
- Экономика в арене
- Добыча ресурсов в арене
- Строительство базы в арене
- Производство в арене
- DevTools как основной UX арены
- Тестирование препятствий
- Финальный продакшен-бой
- Финальный арт
- AI противника за пределами 4 простых режимов
- Волны атак
- Система апгрейдов за пределами текущей
- Save/load для арены
- Несколько типов карт арены
- Fog of war в арене
- Миникарта в арене
- Pathfinding changes
- Normal Game changes
```

---

## 14. Минимальный полезный результат

После шагов ARENA-01H+ через ARENA-03H+:

```text
1. Чистая арена без HQ, харвестеров, ресурсов, препятствий
2. Arena Menu с Unit Composer
3. Создание любого body + weapon + team юнита
4. Расстановка по клику через камерную проекцию
5. Ally управляемый, enemy неуправляемый
6. Turret target-lock вместо mouse-follow
7. Friendly fire блокировка
```

Это уже даёт полноценный инструмент для тестирования движения и боя.

---

## 15. Полный первый цикл

После шагов ARENA-01H+ через ARENA-05H+ добавляется:

```text
8. Список юнитов (roster) с управлением
9. Удобство: help, статусы, сообщения
10. AI режимы для enemy: passive, shooter, chaser, hold position
```

---

## 16. Проверка перед реализацией

Перед началом реализации каждого шага:

1. Убедиться, что предыдущий шаг смержен.
2. Убедиться, что Normal Game не сломан.
3. Прочитать этот аудит и roadmap перед началом.
4. Не расширять scope без одобрения владельца.
5. Запустить полную валидацию перед commit:
   ```text
   npm run typecheck
   npm run test
   npm run build
   npm run qa:smoke
   ```
6. Не мерджить PR без одобрения владельца.
