# CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md

Status: implementation/system audit
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Source roadmap: `docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md`
Source decisions: `docs/project/MECHANICS_DECISIONS_2026_06_03.md`
Date: 2026-06-03

---

## 1. Title / status

```text
CORE MECHANICS SYSTEM AUDIT
Status: implementation/system audit
Project: Four Elements Phaser
Repo: ratoker-jpg/four-elements-phaser
Source roadmap: docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
Source decisions: docs/project/MECHANICS_DECISIONS_2026_06_03.md
Date: 2026-06-03
```

This is the implementation/system audit for the accepted Core Mechanics Roadmap. It converts the 8-step roadmap into a technical implementation plan with current code map, touched files, known risks, hidden coupling, PR slicing, and validation strategy.

This audit does NOT contain implementation. No code, assets, or runtime files are modified.

---

## 2. Executive summary

The Core Mechanics Roadmap has been accepted and defines 8 High+ implementation steps to turn the current prototype into a readable core gameplay baseline with Russian UX, Industrial-only maps, faction identity, resource anchors, economy buildings, unified RTS controls, grid movement, target-lock combat, weapon/body mechanics, and animation feel.

This audit is the mandatory pre-implementation document. It inspects the current codebase, maps every roadmap step to concrete files, identifies risks and hidden coupling, recommends PR slicing, and defines validation and rollback strategy. Implementation should only begin after this audit is reviewed and accepted by Denis/GPT.

Key points:

- 8 roadmap steps audited, all High+ risk.
- No implementation in this PR. Docs only.
- Biggest risks: movement refactor (Step 06) and combat hit model (Step 07) are architecturally invasive and touch the most coupled code.
- Step 01 (UI/Localization) should be split into 2-3 implementation PRs due to surface area across 10+ UI files.
- Step 08 (Weapons/Bodies/Animation) is the widest step and should be split into 3-4 implementation PRs.
- CAMERA_PROJECTION_CONTRACT.md is mandatory for all visual work.
- MECHANICS_DECISIONS is the accepted mechanics scope. Exploratory audit is reference only.
- TankViewer permission allows pipeline planning but not immediate mass asset integration.

---

## 3. Source-of-truth hierarchy

```text
1. CAMERA_PROJECTION_CONTRACT.md
   Mandatory for ALL visual/world-space/rendering/asset work.
   No top-down circles. No camera rotation. All ground markers projected.
   Source file: src/config/cameraProjectionContract.ts

2. MECHANICS_DECISIONS_2026_06_03.md
   Accepted mechanics scope. Only mechanics in this doc are roadmap scope.
   This is the authoritative source for what the game should implement.

3. CORE_MECHANICS_ROADMAP_2026_06_03.md
   Accepted roadmap scope. 8 steps, all High+.
   This audit converts the roadmap into implementable PRs.

4. ASSET_USAGE_PERMISSION_STATUS_2026_06_03.md
   TankViewer source assets are allowed for pipeline planning.
   Not for immediate mass integration or runtime .3ds loading.

5. MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md
   Reference only. NOT accepted scope.
   Do NOT add unaccepted mechanics from this document.

6. ARENA_SANDBOX_CLOSURE_REPORT.md
   Arena cycle is closed. Arena modes remain as test tools.
   Do NOT continue Arena features by inertia.
```

Any conflict between these documents is resolved by the higher-numbered source taking priority, with MECHANICS_DECISIONS as the final authority on accepted mechanics.

---

## 4. Current codebase map

### 4.1 Scenes

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/phaser/BootScene.ts` | Routes to PreloadScene or Visual preview | Low |
| `src/phaser/PreloadScene.ts` | Asset loading with progress bar | Step 01 (Russian labels) |
| `src/phaser/MainMenuScene.ts` | New Game / Continue / Settings (DOM overlay) | Step 01 (Russian text, flow) |
| `src/phaser/NewGameSetupScene.ts` | Faction, map, mode, seed selection (DOM overlay) | Step 01 (Russian, flow restructure, hide Sand/Map1) |
| `src/phaser/GameScene.ts` | Main orchestration scene, ~900+ lines | Steps 01, 05, 06, 07 (all touch this) |
| `src/phaser/Visual02aPreviewScene.ts` | Dev: layered platform frame preview | None |
| `src/phaser/Visual03aPreviewScene.ts` | Dev: runtime layered platform prototype | None |
| `src/phaser/Visual04aPreviewScene.ts` | Dev: modular grid-aligned arena frame | None |

**Risk**: GameScene.ts is the highest-coupling file in the project. Steps 01, 05, 06, and 07 all need changes here. Any step that modifies GameScene must be careful not to break other concurrent work.

### 4.2 UI / menu systems

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/phaser/ui/PauseMenu.ts` | ESC menu: Resume, Save, Load, Restart, Main Menu | Step 01 (Russian labels) |
| `src/phaser/ui/PlaytestHud.ts` | In-game HUD: resources, building status, help | Steps 01, 03, 04 (Russian, resource display, building status) |
| `src/phaser/ui/ArenaMenu.ts` | Arena primary UX: mode selection, unit creation | Step 01 (Russian labels) |
| `src/phaser/ui/ArenaUnitComposer.ts` | Body + weapon + team selection for Arena | Step 01 (Russian displayNames) |
| `src/phaser/ui/DevtoolsPanel.ts` | Debug/dev tools panel | Step 01 (separate from player UI) |
| `src/phaser/ui/TooltipManager.ts` | Tooltip display system | Step 01 (Russian tooltip content) |

**Risk**: All UI files use DOM overlays (Phaser DOM element creation). Russian text is typically 30-50% longer than English. Button widths and panel layouts must accommodate this.

### 4.3 Input controllers

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/phaser/input/CameraControls.ts` | Pan (drag), zoom (wheel), reset (R) | Step 05 (MMB drag for camera) |
| `src/phaser/input/GameInputController.ts` | Keyboard/pointer for normal game | Step 05 (complete LMB/RMB refactor) |
| `src/phaser/input/BlockoutVehicleInputController.ts` | Blockout vehicle selection, aim, fire, movement | Step 05 (LMB select, RMB command) |

**Risk**: The current input model mixes LMB and RMB responsibilities differently for Arena vs Normal mode. GameInputController handles civil unit input. BlockoutVehicleInputController handles combat vehicle input. Step 05 must unify these into one coherent LMB-select / RMB-command model across both modes.

**Hidden coupling**: GameScene.ts directly references both input controllers. CameraControls currently uses left-drag for panning. Step 05 must change this to MMB-drag only.

### 4.4 Camera / projection files

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/config/cameraProjectionContract.ts` | Projection basis vectors, ground/world projection | All visual steps |
| `src/phaser/render/isometric.ts` | tileToScreen, screenToTile, mapOriginOffset | Steps 06, 07 (depth sorting, hit detection) |
| `src/phaser/render/CameraProjectionDebugRenderer.ts` | Calibration overlay (C key in Arena) | Reference only |

**Risk**: `isometric.ts` is used everywhere. Changing tileToScreen or screenToTile signatures will cascade. The audit recommends extending rather than replacing these functions.

### 4.5 Blockout vehicle systems

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/config/blockoutWeaponData.ts` | 11 weapon profiles | Step 02 (extend to 10 accepted + full fields) |
| `src/config/blockoutBodyData.ts` | 7 body profiles | Step 02 (extend with armor, footprint, displayName) |
| `src/config/blockoutVehicleData.ts` | 9 vehicle compositions (body+weapon) | Step 02 (extend) |
| `src/config/blockoutProfiles.ts` | Type contracts for profiles | Step 02 (new type fields) |
| `src/config/blockoutMovementData.ts` | Movement profiles per body | Steps 02, 06 (unified movement) |
| `src/config/blockoutRecoilData.ts` | Recoil profiles per weapon | Step 08 (recoil mechanics) |
| `src/config/blockoutDamageData.ts` | Damage profiles per weapon | Steps 07, 08 (hit model, armor) |
| `src/config/blockoutVfxData.ts` | VFX profiles per weapon behavior | Step 08 (VFX profiles) |
| `src/config/blockoutObstacleData.ts` | 4 obstacle types + default arena layout | Step 06 (footprint collision) |
| `src/config/blockoutUpgradeData.ts` | 5 upgrade types | Step 02, 08 (M0-M3 data model) |
| `src/config/blockoutScenarioData.ts` | Sandbox/Arena scenario configs | Low |

**Risk**: The "blockout" prefix suggests these are temporary/placeholder configs. Step 02 must decide: extend blockout files with new fields, or create new production config files alongside them. The roadmap says "extend and/or create new." Recommendation: create new `src/config/weaponData.ts`, `src/config/bodyData.ts`, etc. alongside blockout files, with blockout files as Arena/dev fallback.

### 4.6 Arena systems

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/state/blockoutVehicleState.ts` | BlockoutVehicleState type, team, AI mode | Steps 05, 07 (input refactor, combat model) |
| `src/state/blockoutMovement.ts` | Blockout vehicle movement (accel/brake/turn) | Step 06 (replace with grid movement) |
| `src/state/blockoutWeaponVfx.ts` | Weapon fire, recoil, continuous fire, VFX events | Steps 07, 08 (combat, weapon mechanics) |
| `src/state/blockoutDamage.ts` | Damage application, hit detection, status effects | Steps 07, 08 (hit model, armor) |
| `src/state/blockoutObstacles.ts` | Obstacle collision/line-of-fire checks | Step 06 (footprint collision) |
| `src/state/blockoutObstacleState.ts` | BlockoutObstacleState type | Low |
| `src/state/blockoutAi.ts` | Arena AI (passive, chaser, stationary_shooter, hold_position) | Steps 06, 07 (grid pathing, combat model) |
| `src/state/blockoutUpgrades.ts` | Upgrade application, effective profile computation | Step 08 (M0-M3) |
| `src/state/blockoutScenario.ts` | Scenario reset | Low |
| `src/state/arenaModeContext.ts` | ArenaModeContext (which subsystems active) | Step 05 (input routing) |
| `src/state/arenaPlacement.ts` | Arena unit placement mode state machine | Step 05 (LMB/RMB) |
| `src/state/arenaRoster.ts` | Roster rows, delete/clear/decision logic | Step 01 (Russian labels) |
| `src/state/devArena.ts` | Arena enable check, map creation, vehicle spawn | Low |

**Risk**: Arena systems are deeply coupled to blockout configs. Steps 02, 06, 07 must not break Arena while extending the data model and movement/combat systems. Arena is a test tool that must keep working.

### 4.7 Map generation

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/state/generatedMap.ts` | Procedural map generation (seeded) | Step 03 (resource anchors, 6 classes) |
| `src/state/mapValidation.ts` | Map validation (HQ, resources, passability) | Step 03 (new resource class validation) |
| `src/state/terrainClustering.ts` | Terrain type clustering for visual variety | Low |
| `src/data/maps/customMap1.ts` | Custom map data (48x48 predefined) | Step 03 (reference for anchor positions) |

**Risk**: `generatedMap.ts` must be restructured for anchor-based resource placement. Current generation is random scatter. New generation needs fixed anchor positions with controlled variation. This is a significant rewrite of the resource placement algorithm.

### 4.8 Resource / economy / building systems

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/state/types.ts` | Core types: Faction, Terrain, GameState, Economy | Steps 02, 03, 04 (resource classes, building types) |
| `src/state/createInitialState.ts` | Creates GameState from MapData | Step 04 (economy initialization) |
| `src/state/updateGameState.ts` | Main civil loop (harvesters, economy, separators) | Step 04 (economy loop) |
| `src/state/construction.ts` | Construction site progress + building placement | Step 04 (fix building configs) |
| `src/state/builder.ts` | Builder assignment, movement, pathfinding | Step 05 (RMB command routing) |
| `src/state/production.ts` | Factory production queue, spawn, cancel | Step 04 (Russian names, production costs) |
| `src/state/statusHelpers.ts` | Build/production/spawn block reasons | Step 01 (Russian status messages) |

**Risk**: `types.ts` is the shared type foundation. Adding resource classes, building types, and new config structures here will cascade to many files. Changes must be backward-compatible or all consumers must be updated in the same PR.

### 4.9 Faction / config files

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/state/gameSetup.ts` | GameSetupConfig, faction/map/mode selection | Step 01 (flow restructure), Step 02 (faction config) |

**Current state**: Factions are currently just color names (cyan, green, yellow, purple) with no displayName, no bonus description, no passive mechanic fields. Step 02 must create a faction config structure.

### 4.10 Pathfinding / movement

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/state/pathfinding.ts` | BFS pathfinding on tile grid | Step 06 (reuse for combat vehicles) |
| `src/state/occupancy.ts` | Tile occupancy queries | Step 06 (tile reservation, footprint classes) |
| `src/state/blockoutMovement.ts` | Blockout vehicle movement (arcade) | Step 06 (replace with grid movement) |
| `src/state/unitCommands.ts` | Manual move commands for units | Step 05 (RMB command routing) |
| `src/state/commandRegistry.ts` | Hotkey-to-command mapping | Step 05 (S=stop, Esc=context) |

**Risk**: Current civil units use BFS pathfinding (`pathfinding.ts`) and occupancy (`occupancy.ts`). Combat vehicles use arcade movement (`blockoutMovement.ts`). Step 06 must unify these — combat vehicles switch to BFS pathfinding with tile reservation, but with physical feel (acceleration, braking, turning). This is the highest-risk refactor because it changes the fundamental movement model for Arena combat vehicles.

### 4.11 Combat / damage / VFX

| File | Role | Roadmap coupling |
|------|------|-----------------|
| `src/state/blockoutDamage.ts` | Damage application, hit detection | Steps 07, 08 (hit model, armor) |
| `src/state/blockoutWeaponVfx.ts` | Weapon fire, recoil, VFX events | Steps 07, 08 (combat, weapon mechanics) |
| `src/state/blockoutAi.ts` | AI modes (passive, chaser, etc.) | Steps 06, 07 (grid pathing, combat model) |
| `src/phaser/render/BlockoutWeaponVfxRenderer.ts` | Weapon VFX rendering | Step 08 (VFX profiles) |
| `src/phaser/render/BlockoutDamageRenderer.ts` | Damage numbers, status badges | Steps 07, 08 (hit feedback) |

**Risk**: Current hit detection is screen-space distance based. Step 07 must replace this with projected hit footprint + aim forgiveness + point-blank assist. This is a fundamental change to how hits work.

### 4.12 Test files

| Category | Files | Roadmap coupling |
|----------|-------|-----------------|
| State tests | `src/state/__tests__/` | Steps 02-08 (all need new/updated tests) |
| Config tests | `src/config/__tests__/` | Step 02 (config completeness tests) |
| Integration tests | Various | Steps 05-07 (input routing, movement, combat) |
| Smoke test | `npm run qa:smoke` | All steps |

**Risk**: Current test coverage is limited. Many roadmap steps add new mechanics (grid movement for combat, hit footprint, weapon resource models) that need substantial new test files. Tests must be written alongside implementation, not as an afterthought.

### 4.13 Assets layout

```text
public/
  assets/
    terrain/           — Industrial/sand tile PNGs
    resources/         — Resource crystal/industrial PNGs
    buildings/         — Building sprite PNGs
    units/             — Harvester/builder PNGs
    blockout/          — Blockout tank hull/turret PNGs
    modular/           — Modular tank hull/turret PNGs
    vfx/               — Weapon VFX sprite PNGs
    ui/                — UI element PNGs
```

**Risk**: Industrial resource assets exist for 6 classes (very_poor through infinite). Building assets exist for current buildings but may not cover new storage buildings (Energy Storage, Element Storage). Blockout tank assets cover 7 bodies and 11 weapons but are placeholder rectangles. Step 08 animation needs to work with both blockout and (future) final assets.

### 4.14 Config files summary

| File | Current role | Step 02 target |
|------|-------------|----------------|
| `blockoutWeaponData.ts` | 11 weapon profiles (basic fields) | Extend to 10 accepted with full fields + M0-M3 |
| `blockoutBodyData.ts` | 7 body profiles (basic fields) | Extend with armor, footprint, displayName + M0-M3 |
| `blockoutVehicleData.ts` | 9 vehicle compositions | Update for new weapon/body configs |
| `blockoutProfiles.ts` | Type contracts | Add new fields to types |
| `blockoutMovementData.ts` | Movement profiles per body | Map to body config fields |
| `blockoutRecoilData.ts` | Recoil profiles per weapon | Map to weapon config fields |
| `blockoutDamageData.ts` | Damage profiles per weapon | Map to weapon config fields |
| `blockoutVfxData.ts` | VFX profiles per weapon | Extend for M0-M3 VFX scaling |
| `blockoutObstacleData.ts` | Obstacle configs | Low change |
| `blockoutUpgradeData.ts` | 5 upgrade types | Restructure for M0-M3 scaling |
| `worldConfig.ts` | TILE_W, TILE_H, offset tables | Low change |
| `gameConfig.ts` | Phaser scene list | Step 01 (if new scenes needed) |
| `unitRenderConfig.ts` | Render scales | Step 08 (animation API) |
| `cameraProjectionContract.ts` | Projection constants and helpers | Reference only |

---

## 5. Roadmap step audit

### STEP 01H+ — UI / Localization / Start Flow / Faction Display

**Risk**: High+

**Roadmap purpose**: Make the game speak Russian and present a clean Industrial-only game start. Unify visual style. Show faction names with bonuses. Separate DevTools.

**Current implementation state**:

- MainMenuScene: English text, "New Game" / "Continue" / "Settings" buttons.
- NewGameSetupScene: English labels, shows mapStyle selector (industrial/sand), Map 1 option visible.
- PauseMenu: English labels.
- PlaytestHud: English resource names, English building status.
- ArenaMenu: English labels, English weapon/body names.
- ArenaUnitComposer: English weapon/body names.
- DevtoolsPanel: Mixed into normal gameplay, no visual separation.
- No localization layer exists.
- No tooltip system exists.
- No faction display names or bonus descriptions.
- UI style is mixed colors (green, blue, red buttons with no coherent system).

**Likely touched files**:

- `src/phaser/MainMenuScene.ts` — Russian labels, flow structure
- `src/phaser/NewGameSetupScene.ts` — Russian labels, flow restructure, hide Sand/Map1
- `src/phaser/ui/PauseMenu.ts` — Russian labels
- `src/phaser/ui/PlaytestHud.ts` — Russian labels, resource/building names
- `src/phaser/ui/ArenaMenu.ts` — Russian labels
- `src/phaser/ui/ArenaUnitComposer.ts` — Russian displayNames
- `src/phaser/ui/DevtoolsPanel.ts` — Visual separation, hide in Standard
- `src/phaser/GameScene.ts` — Debug flag, Standard mode checks
- `src/phaser/PreloadScene.ts` — If new UI assets needed
- `src/styles.css` — Industrial/bronze/sand theme
- All DOM overlay HTML templates referenced in scenes

**Likely new files**:

- `src/config/localization.ts` — String map system, ru/en fallback
- `src/phaser/ui/TooltipManager.ts` — Tooltip display system (if not exists)
- `src/phaser/ui/styles/` — CSS theme files for industrial/bronze/sand

**Data/config changes**:

- New localization string map with ~200+ entries (all current English UI text).
- Faction display names and bonus descriptions in localization.
- Building/resource/weapon/body displayNames in localization.
- Debug/Standard mode flag in game config.

**Tests to add/update**:

- Localization completeness test: every UI scene has no hardcoded English strings.
- NewGameSetup flow test: Standard mode hides Sand/Map1/mapStyle.
- Debug mode test: Sand/Map1 visible with dev flag.
- Tooltip content test: all entities have non-empty Russian descriptions.

**Risk reasons**:

- Surface area: 10+ UI files need string replacement. Any missed string is a visible bug.
- Russian text is 30-50% longer than English. Button/panel layouts must be tested.
- Flow restructure in NewGameSetupScene changes the game start UX.
- DevTools separation must not break Arena mode which relies on some dev features.
- CSS theme change affects all panels simultaneously.

**Dependencies**: None (this step is first).

**Hidden coupling**:

- ArenaUnitComposer reads weapon/body names from blockout configs. Localization must read from new config, not blockout data directly.
- NewGameSetupScene flow changes affect gameSetup.ts type structure.
- DevTools panel may be referenced in GameScene for debug features.

**Suggested internal PR slicing**:

1. **PR 01a — Localization infrastructure + MainMenuScene + NewGameSetupScene**: Create localization.ts, replace strings in main menu and setup, restructure flow.
2. **PR 01b — All remaining UI Russian labels + industrial/bronze/sand theme**: PauseMenu, PlaytestHud, ArenaMenu, ArenaUnitComposer, status messages, CSS theme.
3. **PR 01c — Faction display + tooltip system + DevTools separation**: Faction names/bonuses, tooltip content, DevTools visual/functional separation.

**What must NOT be touched**:

- No weapon damage/balance changes.
- No movement/pathfinding changes.
- No combat changes.
- No building mechanic changes.
- No changes to internal English ids.
- No changes to Arena gameplay mechanics.

**Acceptance criteria**:

- All player-facing labels in Russian.
- NewGameSetupScene flow: mode → map size → faction → start.
- Sand Classic, Map 1, mapStyle not visible in Standard mode.
- All buttons follow industrial / bronze / sand visual system; destructive/danger actions use reserved warning color; no random green/yellow/teal button mix.
- Faction selection shows Russian names and passive bonus descriptions.
- Tooltips display for weapons, bodies, buildings, resources.
- DevTools not visible in Standard mode.
- Arena mode retains its tooling.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Open every menu and panel. Verify Russian text, correct layout, no text overflow.
- Start Standard mode game. Verify no Sand/Map1/mapStyle options visible.
- Start Debug mode game. Verify Sand/Map1 options visible behind dev flag.
- Select each faction. Verify Russian name and bonus description.
- Hover over weapons, bodies, buildings, resources. Verify tooltips.
- Verify DevTools hidden in Standard, visible in Debug/Arena.

**Rollback/fallback strategy**:

- If Russian localization causes layout breakage, keep English as fallback behind a config flag.
- If NewGameSetup flow restructure breaks game start, add a fallback flow that preserves old sequence behind dev flag.
- CSS theme can be reverted independently of string changes.

**Notes for GPT review**:

- Verify that localization.ts design supports future dynamic language switching (even if not implemented now).
- Verify that DevTools separation does not remove Arena debugging capability.
- Verify tooltip system design is reusable for Steps 02-08.

---

### STEP 02H+ — Config and Data Model Foundation

**Risk**: High+

**Roadmap purpose**: Create config-driven data models for all accepted mechanics so subsequent steps reference structured, localized, upgrade-aware configs instead of scattered hardcoded values.

**Current implementation state**:

- `blockoutWeaponData.ts`: 11 weapons with basic fields (name, damage, cooldown, range, projectileSpeed, splashRadius). No displayName, no rangeClass, no minRange/idealRange/stopDistance, no fireType, no M0-M3 scaling, no turretTurnSpeed, no VFX profile, no armor model.
- `blockoutBodyData.ts`: 7 bodies with basic fields (name, HP, speed, turnSpeed, width, height). No displayName, no armor, no mass, no acceleration, no braking, no footprint/collision class.
- No faction config exists. Factions are just color strings.
- Resource config is minimal: single type with amount range. No 6-class system.
- Building config is partial: some buildings have cost/footprint, others (Raw Storage, Energy Storage, Element Storage) are incomplete or missing.
- No M0-M3 scaling data model.

**Likely touched files**:

- `src/config/blockoutWeaponData.ts` — Extend or create new weapon config
- `src/config/blockoutBodyData.ts` — Extend or create new body config
- `src/config/blockoutVehicleData.ts` — Update for new configs
- `src/config/blockoutProfiles.ts` — Add new type fields
- `src/config/blockoutMovementData.ts` — Map to body config
- `src/config/blockoutRecoilData.ts` — Map to weapon config
- `src/config/blockoutDamageData.ts` — Map to weapon config
- `src/config/blockoutVfxData.ts` — Map to weapon config
- `src/config/blockoutUpgradeData.ts` — Restructure for M0-M3

**Likely new files**:

- `src/config/weaponData.ts` — Full production weapon config (10 weapons)
- `src/config/bodyData.ts` — Full production body config (7 bodies)
- `src/config/factionData.ts` — Faction config with displayName, bonus
- `src/config/resourceClassData.ts` — 6 resource classes with displayName, asset, amounts
- `src/config/buildingData.ts` — Building config with readiness classes
- `src/config/m0m3Scaling.ts` — M0-M3 scaling data model and types

**Data/config changes**:

- Weapon config: add displayName (ru), rangeClass, minRange, idealRange, maxRange, stopDistance, fireType, cooldown/windUp/canister/overheat/magazine/drum fields, damage model, VFX profile reference, turretTurnSpeed, M0-M3 scaling fields.
- Body config: add displayName (ru), role, armor (flat reduction + minDamagePercent), mass, acceleration, braking, bodyTurnSpeed, footprint/collision class (Light/Medium/Heavy), M0-M3 scaling fields.
- Faction config: create 4 factions with displayName (ru), passive bonus description (ru), passive bonus fields.
- Resource class config: create 6 classes with displayName (ru), asset key, amount range.
- Building config: add displayName (ru), role description (ru), readiness class.
- All displayNames sourced from localization layer (Step 01).

**Tests to add/update**:

- Config completeness test: every weapon has all required fields.
- Config completeness test: every body has all required fields.
- Faction config test: 4 factions, each with displayName and bonus.
- Resource class test: 6 classes, each with displayName, asset key, amount range.
- Building config test: readiness classes assigned correctly.
- M0-M3 scaling test: damage increases from M0 to M3 for every weapon.
- M0-M3 scaling test: turretTurnSpeed increases from M0 to M3 for every weapon.
- Body M0-M3 test: mass does NOT change from M0 to M3.
- Armor formula test: `max(rawDamage - armor, rawDamage * minDamagePercent)` produces correct results.

**Risk reasons**:

- Adding many new fields to configs may break existing Arena/blockout code that reads old field names.
- Blockout data consumers (ArenaUnitComposer, BlockoutVehicleRenderer, blockoutMovement, blockoutDamage) all read from blockout configs. New fields must be optional or have defaults.
- M0-M3 scaling data model must be designed to support 10 weapons x 4 levels = 40 scaling entries plus 7 bodies x 4 levels = 28 scaling entries. Data structure must avoid sprawl.
- Faction config is entirely new. No existing code reads faction data beyond color.

**Dependencies**: Step 01 (localization layer must exist for displayNames).

**Hidden coupling**:

- ArenaUnitComposer reads weapon/body names directly from blockoutWeaponData/blockoutBodyData. New production configs must either extend these or Arena must be updated to read from new config.
- blockoutDamage reads damage values from blockoutDamageData. New damage model (with armor) changes the damage formula.
- blockoutMovement reads movement values from blockoutMovementData. New body config may reorganize where movement data lives.

**Suggested internal PR slicing**:

1. **PR 02a — Weapon config + body config data models**: New production config files with full fields, M0-M3 types, backward-compatible with blockout data.
2. **PR 02b — Faction config + resource class config + building config**: New config files for factions, resources, buildings.
3. **PR 02c — M0-M3 scaling data + armor formula + config integration tests**: Complete scaling data, armor formula, comprehensive tests.

**What must NOT be touched**:

- No damage formula changes in gameplay code yet (config only).
- No movement/pathfinding changes.
- No combat behavior changes.
- No UI layout changes.
- No changes to Arena AI modes.

**Acceptance criteria**:

- Every accepted weapon (10, no Shaft) has config entry with full fields.
- Every body (7) has config entry with full fields including armor.
- Every faction (4) has config entry with displayName and bonus.
- Every resource class (6) has config entry with displayName, asset key, amount range.
- Building config entries have displayName, role description, readiness class.
- All displayNames sourced from localization layer.
- Existing Arena/blockout gameplay not broken.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Verify Arena still works with extended config.
- Verify tooltips pick up displayName from config.
- Verify M0-M3 fields exist and are structurally correct.

**Rollback/fallback strategy**:

- If new config breaks Arena, blockout data remains as fallback. Arena reads blockout config, production code reads new config.
- New config files are additive — they don't replace blockout files until Step 08.

**Notes for GPT review**:

- Verify M0-M3 data model design: flat array vs nested object vs factory function. Recommend flat array with M-level index for simplicity.
- Verify armor formula matches MECHANICS_DECISIONS: `max(rawDamage - armor, rawDamage * minDamagePercent)`.
- Verify faction config bonus fields are concrete (e.g. speedMultiplier: 1.1) not vague descriptions.

---

### STEP 03H+ — Industrial Map and Resource Layout

**Risk**: High+

**Roadmap purpose**: Implement 6-class resource model with fixed anchor placement. Restructure map generation for Industrial Platform with deterministic resource anchors.

**Current implementation state**:

- `generatedMap.ts`: Generates maps with random resource scatter. No anchor positions. No resource classes. All resources have same amount range.
- `types.ts`: Single resource type with amount. No resource class field.
- Industrial terrain assets exist and are rendered.
- Resource crystals exist for industrial style.
- Map validation checks for starter resources near HQ and central deposit.

**Likely touched files**:

- `src/state/types.ts` — Add ResourceClass enum and resource class field
- `src/state/generatedMap.ts` — Rewrite resource placement with anchors
- `src/state/mapValidation.ts` — Validate 6-class resource model
- `src/state/createInitialState.ts` — Initialize economy with new resource types
- `src/state/updateGameState.ts` — Harvester handles 6 resource classes
- `src/assets/assetManifest.ts` — New resource asset keys
- `src/assets/runtimeGeneratedAssets.ts` — Load new resource assets
- `src/phaser/render/EntityRenderer.ts` — Render 6 resource class types
- `src/phaser/ui/PlaytestHud.ts` — Show resource class in Russian

**Likely new files**:

- `src/config/resourceAnchors.ts` — Anchor position definitions per map size preset
- `src/config/resourceAmountConfig.ts` — Amount ranges per resource class

**Data/config changes**:

- ResourceClass enum: very_poor, poor, medium, rich, very_rich, infinite
- Resource class displayNames (Russian): Очень бедная, Бедная, Средняя, Богатая, Очень богатая, Бесконечная
- Asset key mapping per class
- Amount ranges per class (from decisions: 150-250 through 50000+/infinite)
- Anchor positions per map size preset
- Controlled variation parameters (offset radius, type variation probability)

**Tests to add/update**:

- Resource class config test: 6 classes with correct Russian names and asset keys.
- Anchor placement test: generated maps place resources at anchor positions.
- Map validation test: validates start zone, center, side/contested zone resources.
- Seed reproducibility test: same seed produces same anchor positions.
- Variation test: different seeds produce slight variation within anchor zones.
- Harvester gathering test: harvester gathers from all 6 resource classes.

**Risk reasons**:

- Current `generateResources()` is random scatter. New anchor-based placement is a significant algorithm rewrite.
- Map size presets are not finalized (32/48/64 not accepted). Anchor layouts must be parameterized by map dimensions, not hardcoded.
- Harvester logic must handle 6 different amount ranges. Infinite deposits need special handling (never depletes or depletes very slowly).
- Resource class affects game balance: start zone should be harder, center should be contested.

**Dependencies**: Step 01 (Russian labels), Step 02 (resource config data model).

**Hidden coupling**:

- Harvester gathering rate depends on resource class amount. Economy balance is affected.
- Storage caps interact with resource amounts. Step 04 depends on consistent resource amounts.
- Map validation checks starter resources. New anchor system must satisfy validation rules.

**Suggested internal PR slicing**:

1. **PR 03a — Resource class types + config + asset mapping**: Add ResourceClass enum, config entries, asset keys.
2. **PR 03b — Anchor-based resource placement + map generation rewrite**: Rewrite generateResources() with fixed anchors and controlled variation.
3. **PR 03c — Harvester 6-class gathering + UI display + map validation update**: Update harvester, HUD, and validation.

**What must NOT be touched**:

- No combat changes.
- No movement/pathfinding changes.
- No building mechanic changes.
- No weapon/body balance changes.
- Arena mode remains unchanged.

**Acceptance criteria**:

- 6 resource classes in config with Russian displayNames, asset keys, amount ranges.
- Generated maps place resources at fixed anchor positions with controlled variation.
- Start zone has very_poor/poor/medium deposits.
- Center has infinite 2x2 deposit.
- Side/contested zones have rich/very_rich deposits.
- Map validation passes for all seeds and map sizes.
- Harvester gathers from all 6 classes correctly.
- Resource class shown in tooltip/UI with Russian name.
- No sand terrain in normal game flow.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Start games on multiple map sizes. Verify resource anchor positions.
- Verify start zone has appropriate deposits.
- Verify center has 2x2 infinite deposit.
- Harvest from each resource class. Verify amounts.
- Verify same seed = same anchor positions. Different seed = slight variation.

**Rollback/fallback strategy**:

- If anchor placement breaks map generation, fallback to current random scatter behind a config flag.
- Resource class data is additive — old single-type resources remain for Arena/sand maps.

**Notes for GPT review**:

- Verify anchor position parameterization: must work for any map size, not just 32/48/64.
- Verify controlled variation doesn't create "no resource" scenarios.
- Verify infinite deposit handling: harvester should never deplete or have very high cap.

---

### STEP 04H+ — Buildings and Core Economy Loop

**Risk**: High+

**Roadmap purpose**: Make the core economy loop fully playable with Russian names, clear building statuses, readable economy. Fix non-functional building configs.

**Current implementation state**:

- `construction.ts`: Building configs exist for HQ, Separator, Factory, Raw Storage. Raw Storage has issues (may be incomplete). Energy Storage and Element Storage are missing or non-functional.
- `updateGameState.ts`: Separator processing works (raw → energy + faction element). Storage caps partially implemented. Factory production works but may have incomplete cost model.
- Building assets exist for current buildings. New storage buildings may need placeholder assets.
- Building status messages are in English.

**Likely touched files**:

- `src/state/construction.ts` — Fix Raw Storage, create Energy/Element Storage configs
- `src/state/types.ts` — Add new building types if needed
- `src/state/updateGameState.ts` — Complete economy loop
- `src/state/production.ts` — Russian unit names, production costs
- `src/state/statusHelpers.ts` — Russian status messages
- `src/phaser/render/EntityRenderer.ts` — Render new buildings
- `src/phaser/render/BuildingStatusRenderer.ts` — Russian status messages
- `src/phaser/ui/PlaytestHud.ts` — Russian building names
- `src/assets/buildingAssets.ts` — New building asset keys
- `src/assets/buildingPlacementMeta.ts` — New building footprint metadata

**Likely new files**:

- Building asset entries for Energy Storage, Element Storage
- Building footprint metadata for new buildings

**Data/config changes**:

- Raw Storage: add cost, build time, footprint (fix incomplete config).
- Energy Storage: new building config with cost, build time, footprint, resource cap effect.
- Element Storage: new building config with cost, build time, footprint, resource cap effect.
- All buildings: add Russian displayName and role description from localization.
- Separator status messages: Russian ("Нет сырья", "Накопитель полон", "Работает").
- Factory production: Russian unit names, clear cost model.
- Энергостанция: visual-ready building config (placeable, visible, no mechanic).
- All building costs/build times/effects in config, not hardcoded.

**Tests to add/update**:

- Building config test: all 6 core buildings have complete configs.
- Economy loop test: raw minerals → separator → energy + faction elements → buildings / unit production works end-to-end.
- Storage cap test: each storage type correctly raises its resource cap.
- Separator status test: correct Russian messages for no-raw, output-full, working states.
- Factory production test: production queue with Russian names, correct cost deduction.
- Visual-ready building test: Энергостанция can be placed but has no gameplay mechanic.

**Risk reasons**:

- Energy Storage and Element Storage are entirely new building types. Need new configs, new assets (or placeholders), new footprint metadata, new rendering.
- Economy loop must balance: if storage caps are too low, economy stalls. If too high, no pressure to build storages.
- Building placement must use CAMERA_PROJECTION_CONTRACT for footprint rendering. Current placement may not use projected footprints.
- HQ is the starting base, not an ordinary placeable building. Must not appear in build menu.

**Dependencies**: Step 01 (Russian labels), Step 02 (building config data model), Step 03 (resource classes — storages interact with amounts and caps).

**Hidden coupling**:

- Storage caps affect harvester behavior: if cap is reached, harvester should stop or queue.
- Separator output depends on resource class amounts. Step 03 resource model must be complete.
- Factory production costs must be consistent with economy income rates.
- Building placement rendering depends on CAMERA_PROJECTION_CONTRACT footprint projection.

**Suggested internal PR slicing**:

1. **PR 04a — Fix Raw Storage + create Energy/Element Storage configs + Russian names**: Fix existing building configs, add new storage buildings.
2. **PR 04b — Economy loop completion + Separator status + Factory production**: Complete the economy loop with Russian status messages and production queue.
3. **PR 04c — Visual-ready Энергостанция + building placement footprint rendering**: Add visual-ready building, verify footprint rendering.

**What must NOT be touched**:

- No combat changes.
- No movement/pathfinding changes.
- No weapon/body balance changes.
- No faction mechanic changes.
- No repair center or defense tower.
- No walls/barriers.

**Acceptance criteria**:

- HQ exists and functions as starting base.
- Other core economy buildings are buildable: Separator, Raw Storage, Energy Storage, Elements Storage, Units Factory.
- All buildings have Russian displayNames and descriptions.
- Separator shows clear Russian status messages.
- Factory shows production queue with Russian names.
- Storages correctly raise resource caps.
- Economy loop works end-to-end.
- Энергостанция exists as visual-ready building.
- Building placement uses projected footprints.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Build each core building. Verify Russian name, description, cost, build time.
- Build Separator. Verify status messages cycle correctly in Russian.
- Build each Storage. Verify resource caps increase.
- Build Factory. Verify production queue with Russian names.
- Run full economy loop: harvest → deposit → separate → build → produce.
- Verify building footprints render correctly on isometric ground.

**Rollback/fallback strategy**:

- If new storage buildings break economy, keep existing Raw Storage behavior as fallback.
- Visual-ready buildings are non-functional by design — easy to remove if problematic.

**Notes for GPT review**:

- Verify HQ is NOT in the build menu. It exists at game start only.
- Verify economy loop wording matches accepted chain: raw minerals → separator → energy + faction elements → buildings / unit production. No "matter" anywhere.
- Verify building costs are in config, not hardcoded in gameplay code.

---

### STEP 05H+ — Unified RTS Controls and Command Routing

**Risk**: High+

**Roadmap purpose**: Replace mixed input model with classic RTS controls. LMB select/inspect, RMB command, S stop, Esc context, MMB/arrow camera. Consistent across all unit types.

**Current implementation state**:

- `GameInputController.ts`: Handles civil unit input. Currently allows LMB for both selection and some commands. No clear LMB/RMB separation.
- `BlockoutVehicleInputController.ts`: Handles combat vehicle input. Uses LMB for aim/fire, some RMB for movement. Not aligned with accepted control model.
- `CameraControls.ts`: Currently uses left-drag for camera pan. Must change to MMB-drag.
- GameScene dispatches input to both controllers based on game mode.
- No cursor feedback system (move/attack/harvest cursor).
- No command confirmation visual.

**Likely touched files**:

- `src/phaser/input/GameInputController.ts` — Complete refactor: LMB select, RMB command
- `src/phaser/input/BlockoutVehicleInputController.ts` — Refactor: LMB select ally, RMB command ally
- `src/phaser/input/CameraControls.ts` — Change to MMB-drag only
- `src/phaser/GameScene.ts` — Input routing refactor, cursor feedback, command confirmation
- `src/state/unitCommands.ts` — RMB command dispatch
- `src/state/commandRegistry.ts` — S=stop, Esc=context, hotkey mapping
- `src/state/unitSelection.ts` — LMB selection logic

**Likely new files**:

- `src/state/commandRouter.ts` — Unified command routing for LMB/RMB
- `src/phaser/render/CursorFeedbackRenderer.ts` — Cursor change rendering
- `src/phaser/render/CommandConfirmationRenderer.ts` — Visual ring at command target

**Data/config changes**:

- Command routing config: LMB actions, RMB actions, S action, Esc priority chain.
- Cursor asset mapping: move cursor, attack cursor, harvest cursor, default cursor.

**Tests to add/update**:

- Input routing test: LMB never commands movement or attack.
- Input routing test: RMB commands based on target type (ground, enemy, resource, building).
- Input routing test: S stops and clears target-lock.
- Input routing test: Esc follows priority chain.
- Camera test: MMB drag pans camera. LMB does not pan. RMB does not pan.
- Arena input test: LMB selects ally, RMB commands ally.

**Risk reasons**:

- Current input model has LMB doing selection AND some commands. Removing command behavior from LMB may break existing gameplay flow.
- Camera pan change (left-drag → MMB-drag) changes muscle memory for anyone currently testing.
- Two separate input controllers must be unified or coordinated. Current code has separate paths for civil and combat input.
- Arena mode uses BlockoutVehicleInputController which must be updated to match the new LMB/RMB scheme.

**Dependencies**: Step 01 (Russian labels for cursor feedback), Step 02 (weapon/body config for attack range data).

**Hidden coupling**:

- GameScene.ts directly calls methods on both input controllers. Refactoring input must update GameScene coordination.
- CameraControls is referenced by GameScene for camera setup. Changing to MMB-drag affects the camera initialization.
- unitSelection.ts is called from GameInputController. LMB selection must route through the same system.
- Command confirmation visual needs FeedbackRenderer which reads from feedbackEvents.ts.

**Suggested internal PR slicing**:

1. **PR 05a — Command routing refactor + LMB/RMB separation**: Create commandRouter.ts, refactor GameInputController and BlockoutVehicleInputController for clear LMB/RMB paths.
2. **PR 05b — Camera controls (MMB-drag) + S/Esc key handling + Arena input alignment**: Camera change, stop key, Esc priority, Arena input update.
3. **PR 05c — Cursor feedback + command confirmation visual**: Cursor changes on hover, visual ring at command target.

**What must NOT be touched**:

- No movement/pathfinding changes.
- No damage/hit model changes.
- No weapon/body balance changes.
- No building mechanic changes.
- No Arena AI mode changes.

**Acceptance criteria**:

- LMB selects/inspects only. Never commands movement or attack.
- RMB commands: move, attack, harvest, context. Never moves camera.
- S stops and clears target-lock.
- Esc follows context priority: cancel → deselect → close → pause.
- MMB drag pans camera.
- No LMB camera drag. No RMB camera drag.
- Works for harvester, builder, and combat vehicle.
- Arena mode uses same LMB/RMB scheme.
- Cursor changes on RMB hover.
- Command confirmation appears at target location.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Select harvester with LMB. RMB on resource = harvest. RMB on ground = move.
- Select builder with LMB. RMB on building site = build. RMB on ground = move.
- Select combat vehicle with LMB. RMB on enemy = attack. RMB on ground = move.
- S stops selected unit and clears target-lock.
- Esc cancels placement, then deselects, then closes overlay, then pauses.
- MMB drag pans camera. LMB does not pan. RMB does not pan.
- In Arena: LMB selects ally, RMB commands ally.

**Rollback/fallback strategy**:

- If LMB/RMB separation breaks gameplay, add a config flag to revert to old input model temporarily.
- Camera MMB-drag can coexist with optional left-drag behind a config flag during transition.

**Notes for GPT review**:

- Verify that RMB no-op when no unit is selected is implemented.
- Verify Esc priority chain: cancel active mode → deselect → close overlay → pause menu.
- Verify Arena BlockoutVehicleInputController is updated, not just GameInputController.

---

### STEP 06H+ — Movement / Occupancy / Depth Sorting

**Risk**: High+

**Roadmap purpose**: Replace dual movement model (BFS for civil, arcade for combat) with unified grid/tile pathing. Implement waypoint smoothing, physical turning, acceleration/braking, tile reservation, collision. Add correct isometric depth sorting and building occlusion.

**Current implementation state**:

- `pathfinding.ts`: BFS pathfinding for civil units. Works on tile grid. Returns path as array of tile coordinates.
- `occupancy.ts`: Tile occupancy queries. Used by civil units.
- `blockoutMovement.ts`: Arcade movement for combat vehicles. Screen-space movement with acceleration/braking/turning. No tile pathing. No tile reservation. Units can overlap.
- Civil units (harvester/builder) use BFS pathfinding + occupancy.
- Combat vehicles use arcade movement from blockoutMovement.ts.
- No unified movement state machine.
- No waypoint smoothing.
- No body footprint classes.
- No isometric depth sorting (rendering order is likely by creation order or Y-sort hack).
- No building occlusion system.

**Likely touched files**:

- `src/state/blockoutMovement.ts` — Replace with grid-based movement state machine
- `src/state/pathfinding.ts` — Extend for combat vehicle path requests
- `src/state/occupancy.ts` — Extend with tile reservation, footprint classes
- `src/state/blockoutAi.ts` — Update AI to use grid movement commands
- `src/state/blockoutVehicleState.ts` — Add movement state, footprint class
- `src/phaser/GameScene.ts` — Movement update loop, depth sorting integration
- `src/phaser/render/BlockoutVehicleRenderer.ts` — Render based on movement state
- `src/phaser/render/EntityRenderer.ts` — Depth sorting for all entities
- `src/phaser/render/DebugOverlayRenderer.ts` — Footprint, occupancy, path debug

**Likely new files**:

- `src/state/unifiedMovement.ts` — Grid-based movement state machine for all units
- `src/state/tileReservation.ts` — Tile reservation system
- `src/state/footprintClasses.ts` — Light/Medium/Heavy footprint definitions
- `src/state/depthSorting.ts` — Isometric depth sorting algorithm
- `src/phaser/render/DepthSortRenderer.ts` — Depth-sorted rendering pass

**Data/config changes**:

- Body footprint class config: Light (Wasp, Hornet), Medium (Hunter, Viking, Dictator), Heavy (Titan, Mammoth).
- Movement state machine states: idle, path_requested, turning_to_segment, moving_segment, braking, next_segment, attacking, stopping, blocked, repathing, target_chase.
- Tile reservation config: reservation timeout, max reservations per unit.
- Waypoint smoothing config: arc radius, corridor width, turn-in-place threshold.

**Tests to add/update**:

- Grid movement test: combat vehicle follows BFS path through tile centers.
- Physical turning test: heavy bodies turn slower than light bodies.
- Waypoint smoothing test: smooth arc stays within tile corridor. Fallback to turn-in-place if arc violates occupancy.
- Tile reservation test: two units cannot enter same tile simultaneously.
- Footprint class test: Heavy body occupies more tiles than Light body.
- Building collision test: units cannot enter building footprint tiles.
- Depth sorting test: unit behind building renders behind. Unit in front renders above.
- Large building depth test: depth based on footprint, not sprite center.
- Unified movement test: harvester and combat vehicle use same system.
- Arena AI test: chaser uses grid pathing toward ally.

**Risk reasons**:

- This is the HIGHEST-RISK step. Replacing arcade movement with grid pathing for combat vehicles changes the fundamental movement model.
- Arena currently relies on blockoutMovement.ts for all vehicle movement. Any change must not break Arena gameplay.
- Waypoint smoothing inside tile corridors is mathematically complex. Incorrect smoothing can violate occupancy or create visual glitches.
- Depth sorting affects every rendered object. Incorrect sorting is immediately visible.
- Tile reservation must handle edge cases: unit dies while reserving, path cancellation, priority conflicts.
- Movement state machine has 11 states. State transitions must be carefully designed and tested.

**Dependencies**: Step 02 (body config with footprint, speed, acceleration, braking, turn speed), Step 04 (building footprints for collision), Step 05 (command routing — move commands trigger pathfinding).

**Hidden coupling**:

- blockoutAi.ts (chaser, hold_position) directly sets movement velocity. Must be updated to issue move commands through the new system.
- blockoutWeaponVfx.ts may check unit position for firing logic. Must work with new movement positions.
- GameScene update loop calls both civil unit movement and blockout vehicle movement separately. Must be unified.
- Entity rendering currently may not depth-sort across unit types. New depth sorting must handle buildings + civil units + combat vehicles + resources.

**Suggested internal PR slicing**:

1. **PR 06a — Unified movement state machine + grid pathing for combat vehicles**: Create unifiedMovement.ts, implement state machine, connect to pathfinding.ts.
2. **PR 06b — Waypoint smoothing + physical turning + acceleration/braking**: Implement smooth movement inside tile corridors with physical feel.
3. **PR 06c — Tile reservation + footprint classes + building collision**: Prevent unit overlap, implement footprint classes, block building tiles.
4. **PR 06d — Isometric depth sorting + building occlusion**: Implement depth sorting for all entities, basic occlusion.

**What must NOT be touched**:

- No damage/hit model changes.
- No weapon balance changes.
- No changes to Arena AI behavior modes (they now use grid pathing instead of arcade).
- No economy changes.

**Acceptance criteria**:

- All ground units use grid/tile pathing.
- No unit overlap. No passing through other units.
- Units physically turn toward next path segment. Heavy bodies turn slower.
- Waypoint smoothing produces smooth visual movement inside tile corridor.
- Fallback to turn-in-place if arc violates occupancy.
- Tile reservation prevents two units from entering same tile simultaneously.
- Body footprint classes affect tile occupancy.
- Building footprints block unit movement.
- Isometric depth sorting correct: units behind buildings render behind, units in front render above.
- Depth sorting handles large buildings by footprint, not sprite center.
- Arena combat vehicles use grid pathing.
- Territory does not block movement.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Move harvester to resource. Verify grid pathing with smooth turns.
- Move combat vehicle across map. Verify grid pathing, physical turning, no overlap.
- Place two units head-on. Verify no overlap; one waits/repaths.
- Place unit behind building. Verify renders behind building.
- Place unit in front of building. Verify renders above building.
- Move heavy body (Mammoth). Verify slow turn speed vs light body (Wasp) fast turn speed.
- In Arena: place chaser enemy. Verify grid pathing toward ally.

**Rollback/fallback strategy**:

- This step is hard to rollback partially. Recommend keeping blockoutMovement.ts as a compile-time option (flag) during development.
- If grid movement breaks Arena, Arena can temporarily use old blockoutMovement while unified system is fixed.
- Depth sorting can be added incrementally — even basic Y-sort is better than creation-order rendering.

**Notes for GPT review**:

- Verify movement state machine has all 11 states from MECHANICS_DECISIONS.
- Verify waypoint smoothing "safe tile corridor" definition is clear.
- Verify tile reservation handles unit death and path cancellation.
- Verify depth sorting separates collision, depth, and occlusion as independent systems.

---

### STEP 07H+ — Combat Core / Targeting / Hit Model

**Risk**: High+

**Roadmap purpose**: Implement target-lock combat with attack commands, weapon range bands, projected hit footprints, aim forgiveness, point-blank assist. Make combat reliable at all ranges.

**Current implementation state**:

- `blockoutDamage.ts`: Current hit detection is screen-space distance based. If projectile sprite overlaps target sprite, hit is registered. No projected hit footprint. No aim forgiveness. No point-blank assist.
- `blockoutWeaponVfx.ts`: Current firing creates VFX projectiles that travel screen-space. No range band logic. No stopDistance.
- `blockoutAi.ts`: Current AI fires when target is in screen-space range. No minRange/maxRange/stopDistance.
- Target-lock exists in Arena (turret aims at target, not mouse) from ARENA-05H+. But range logic is basic.
- No cone hit detection, no splash hit detection, no 2.5D vertical forgiveness.

**Likely touched files**:

- `src/state/blockoutDamage.ts` — Replace screen-space hit detection with projected hit footprint + aim forgiveness + point-blank assist
- `src/state/blockoutWeaponVfx.ts` — Range band logic, stopDistance, firing conditions
- `src/state/blockoutAi.ts` — AI uses stopDistance, range checks, projected hit detection
- `src/state/blockoutVehicleState.ts` — Add targetVehicleId, attack state
- `src/phaser/render/BlockoutWeaponVfxRenderer.ts` — Render weapon fire with range constraints
- `src/phaser/render/BlockoutDamageRenderer.ts` — Hit feedback with projected positions
- `src/phaser/GameScene.ts` — Attack command integration, combat update loop
- `src/config/cameraProjectionContract.ts` — projectGroundRect for hit footprints

**Likely new files**:

- `src/state/combatModel.ts` — Attack command logic, range bands, target-lock management
- `src/state/hitDetection.ts` — Projected hit footprint, aim forgiveness, point-blank assist, cone detection, splash detection
- `src/state/rangeModel.ts` — minRange/idealRange/maxRange/stopDistance per weapon

**Data/config changes**:

- Weapon config: minRange, idealRange, maxRange, stopDistance values (from Step 02).
- Hit tolerance values per weapon category (direct, cone, splash).
- Point-blank assist threshold.
- Cone angle for Flamethrower, Freeze, Hammer.
- Splash radius for Thunder.

**Tests to add/update**:

- Range band test: unit stops at stopDistance, not at enemy center.
- Target-lock test: turret aims at target, not mouse. turretTurnSpeed from weapon config.
- Projected hit footprint test: hit detection uses ground-plane projection, not screen distance.
- Aim forgiveness test: near-misses are counted as hits within tolerance.
- Point-blank assist test: targets within minRange are auto-hit.
- Cone weapon test: Flamethrower, Freeze, Hammer hit targets in cone + footprint.
- Splash weapon test: Thunder hits targets within projected ground radius.
- 2.5D vertical forgiveness test: Wasp vs Mammoth (different heights) no height-related misses.
- S key test: clears target-lock.
- AI combat test: AI modes use new combat model.

**Risk reasons**:

- This is the SECOND-HIGHEST-RISK step. Hit detection is the core of combat. Replacing screen-space hit detection with projected hit footprint is a fundamental change.
- Point-blank assist must be carefully tuned. Too aggressive = no skill. Too weak = frustrating misses at close range.
- Cone detection (Flamethrower, Freeze, Hammer) requires ground-plane cone geometry projected through isometric transform.
- Splash detection (Thunder) requires projected ground radius that must respect CAMERA_PROJECTION_CONTRACT.
- 2.5D vertical forgiveness must handle Dictator (tall) vs Wasp (short) without making Dictator an easy target or Wasp invulnerable.

**Dependencies**: Step 02 (weapon config with range data, turretTurnSpeed), Step 05 (attack command routing), Step 06 (grid movement for pathfinding toward target, stopping at range).

**Hidden coupling**:

- blockoutAi.ts directly calls fire methods. Must be updated to use range bands and stopDistance.
- blockoutWeaponVfx.ts creates VFX projectiles. Hit detection may need to work differently for different weapon types (instant beam vs projectile vs cone).
- GameScene update loop processes combat. Must integrate new combat model alongside existing systems.
- Damage numbers and status badges must position at projected hit point, not screen-center.

**Suggested internal PR slicing**:

1. **PR 07a — Attack command + target-lock + range bands**: Implement attack command from Step 05 routing, turret target-lock, range check logic, stopDistance.
2. **PR 07b — Projected hit footprint + aim forgiveness + point-blank assist**: Replace screen-space hit detection with projected geometry.
3. **PR 07c — Cone/splash/2.5D hit detection + AI combat update**: Special hit detection for cone and splash weapons, vertical forgiveness, AI update.

**What must NOT be touched**:

- No weapon resource model changes (canister/overheat — that is Step 08).
- No body armor model changes (that is Step 08).
- No movement/pathfinding changes (already done in Step 06).
- No economy changes.

**Acceptance criteria**:

- Attack command works for all unit types.
- Unit pathfinds toward target if out of range, stops at stopDistance.
- Turret aims at target (not mouse). turretTurnSpeed from weapon config.
- Hits use projected hit footprint, not screen-distance.
- Aim forgiveness prevents near-misses from being counted as misses.
- Point-blank assist prevents misses at very close range.
- Cone weapons hit correctly using cone + target footprint.
- Splash weapons hit correctly using projected ground radius.
- Different body heights do not cause misses.
- S key clears target-lock.
- Arena AI modes use new combat model.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Attack enemy at long range. Verify unit moves to stopDistance and fires.
- Attack enemy at close range. Verify point-blank assist works.
- Attack enemy with Hammer at point-blank. Verify all pellets hit.
- Attack enemy with Railgun at max range. Verify hit with slight angle offset.
- Attack enemy with Flamethrower. Verify cone hits.
- Attack enemy with Thunder near allies. Verify splash.
- Verify turret tracks target, not mouse.
- Verify S key clears target-lock.
- Test with Wasp vs Mammoth. Verify no height-related misses.

**Rollback/fallback strategy**:

- If projected hit detection breaks combat, fallback to screen-space detection behind a config flag.
- Point-blank assist can be disabled independently if it creates balance issues.
- AI combat model update can be deferred if it breaks Arena AI.

**Notes for GPT review**:

- Verify that CAMERA_PROJECTION_CONTRACT is used for all projected geometry (hit footprint, splash radius, cone).
- Verify point-blank assist threshold is weapon-specific (short-range weapons have larger assist).
- Verify cone detection uses both cone angle AND target footprint (not just cone).
- Verify splash damage includes self-damage for Thunder (as per roadmap).

---

### STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel

**Risk**: High+

**Roadmap purpose**: Implement full weapon mechanics (10 weapons, no Shaft) with per-weapon resource models, body mechanics with flat armor and mass-dependent recoil, M0-M3 scaling, hybrid animation API.

**Current implementation state**:

- Weapons: 11 blockout weapons exist with basic cooldown/damage/speed. No canister, no overheat, no wind-up, no magazine, no drum mechanics. All weapons fire the same way: cooldown-based single shot or continuous stream.
- Bodies: 7 blockout bodies exist with basic HP/speed. No armor model. No mass-dependent recoil. No M0-M3 scaling.
- Animation: No animation API. Blockout vehicles are rectangles. No tracks/wheels animation. No recoil animation. No idle rule enforcement.
- M0-M3: No scaling system. Current "upgrades" in blockoutUpgradeData.ts are generic stat boosts, not per-weapon M0-M3 scaling.

**Likely touched files**:

- `src/config/blockoutWeaponData.ts` — Extend with per-weapon resource model fields
- `src/config/blockoutBodyData.ts` — Extend with armor, mass, M0-M3 fields
- `src/config/blockoutRecoilData.ts` — Connect to mass-dependent recoil
- `src/config/blockoutDamageData.ts` — Connect to armor model
- `src/config/blockoutVfxData.ts` — M0-M3 VFX scaling
- `src/config/blockoutUpgradeData.ts` — Replace with M0-M3 scaling system
- `src/state/blockoutWeaponVfx.ts` — Per-weapon fire mechanics
- `src/state/blockoutDamage.ts` — Armor formula integration
- `src/state/blockoutMovement.ts` (or unifiedMovement.ts from Step 06) — Recoil impulse
- `src/phaser/render/BlockoutVehicleRenderer.ts` — Animation API integration
- `src/phaser/render/BlockoutWeaponVfxRenderer.ts` — Per-weapon VFX rendering

**Likely new files**:

- `src/state/weaponResourceModel.ts` — Canister, overheat, wind-up, magazine, drum state machines
- `src/state/armorModel.ts` — Flat reduction + minimum damage floor
- `src/state/recoilModel.ts` — Mass-dependent recoil impulse (visual only)
- `src/state/m0m3Model.ts` — M0-M3 scaling application
- `src/phaser/render/animationApi.ts` — Hybrid animation API (procedural now, spritesheet-ready)
- `src/phaser/render/TrackAnimationRenderer.ts` — Tracks/wheels animation
- `src/phaser/render/RecoilAnimationRenderer.ts` — Recoil visual animation

**Data/config changes**:

- Per-weapon resource model configs:
  - Смоки: cooldown fields
  - Гром: cooldown + splash fields
  - Рельса: windUp + cooldown fields
  - Огнемёт: canister (fuel, drain, regeneration) fields
  - Фриз: canister (freon, drain, regeneration) fields
  - Изида: canister (energy, drain, regeneration) fields
  - Вулкан: overheat (heatPerShot, coolingRate, overheatThreshold, overheatPenalty) + spinUp fields
  - Твинс: near-continuous fire rate fields
  - Рикошет: magazine (chargeStock, chargeRegeneration, maxCharges) + bounce fields
  - Молот: drum (volleyCount, drumSize, reloadTime, delayBetweenVolleys) + shotgun fields

- Body armor configs:
  - armor (flat reduction value) per body
  - minDamagePercent per body

- M0-M3 scaling configs:
  - Per-weapon M0-M3: damage, turretTurnSpeed, profile-specific parameter
  - Per-body M0-M3: HP, armor, speed, acceleration, braking, bodyTurnSpeed

- Animation config:
  - Track animation speed scaling
  - Recoil impulse per weapon / body mass
  - Idle rule: no animation when stationary

**Tests to add/update**:

- Weapon resource model tests (per weapon type):
  - Смоки: cooldown cycles correctly
  - Гром: splash radius constant M0-M3
  - Рельса: wind-up delays shot, then fires
  - Огнемёт: canister depletes and regenerates
  - Фриз: canister depletes, slows enemies
  - Изида: beam heals ally, auto-targets nearest
  - Вулкан: spin-up, heat build-up, overheat penalty, cooling
  - Твинс: alternates barrels, high fire rate
  - Рикошет: magazine depletes, charges regenerate, bounces
  - Молот: 3 volleys then reload, drum cycle

- Armor model test: `max(rawDamage - armor, rawDamage * minDamagePercent)` for various damage/armor combinations.
- Recoil test: visual recoil = weaponRecoil / bodyMass. Does not break tile occupancy.
- M0-M3 weapon test: damage increases M0→M3, turretTurnSpeed increases M0→M3.
- M0-M3 body test: HP/armor/speed/acceleration/braking/bodyTurnSpeed increase M0→M3. Mass does NOT increase.
- Animation idle test: no animation when unit is stationary.
- Animation track test: tracks animate while moving/turning, not while idle.
- Animation recoil test: recoil stronger on light bodies, weaker on heavy bodies.

**Risk reasons**:

- This is the WIDEST step. 10 different weapon resource models, each with unique state machine logic.
- Vulcan overheat is complex: spin-up delay, heat accumulation, overheat jam/penalty, cooling rate, reduced turret turn speed while firing.
- Рикошет bouncing projectiles require wall/surface detection for bounce paths.
- Молот drum/volley system requires managing 3-volley sequences with reload.
- Armor model must work with existing damage numbers and status effects.
- Animation API must be designed for both current blockout rectangles AND future spritesheets.
- M0-M3 scaling must be tested for all 10 weapons x 4 levels + 7 bodies x 4 levels = 68 scaling entries.

**Dependencies**: Step 02 (weapon/body config with M0-M3 fields), Step 06 (recoil must not break tile occupancy), Step 07 (armor model works with hit detection, weapon fire integrates with combat model).

**Hidden coupling**:

- Weapon resource models affect when weapons can fire. This interacts with combat model from Step 07 (range check → turret aimed → fire condition).
- Canister/overheat models add new "cannot fire" reasons that must be surfaced to UI.
- Armor model changes the damage numbers shown by BlockoutDamageRenderer.
- Recoil is visual only but must not break tile occupancy (from Step 06).
- Animation API replaces some direct rendering in BlockoutVehicleRenderer.

**Suggested internal PR slicing**:

1. **PR 08a — Armor model + mass-dependent recoil**: Implement armor formula, recoil impulse, update damage rendering.
2. **PR 08b — Cooldown weapons (Смоки, Гром) + wind-up (Рельса) + near-continuous (Твинс)**: Implement simpler weapon resource models first.
3. **PR 08c — Canister weapons (Огнемёт, Фриз, Изида) + overheat (Вулкан)**: Implement canister and overheat state machines.
4. **PR 08d — Magazine/drum weapons (Рикошет, Молот) + M0-M3 scaling + hybrid animation API**: Complete remaining weapons, M0-M3, animation.

**What must NOT be touched**:

- No Shaft weapon implementation.
- No movement/pathfinding changes.
- No economy changes.
- No changes to Arena AI behavior modes.
- No final art generation.
- No mass asset generation.

**Acceptance criteria**:

- All 10 accepted weapons have unique resource model mechanics.
- Armor reduces small hits but never makes weapon useless.
- M0-M3 scaling works for all weapons and bodies.
- Body mass is fixed per body, not increased by M0-M3.
- Recoil depends on weaponRecoil / bodyMass. Visual only, no tile occupancy change.
- Hybrid animation API: procedural now, spritesheet-ready later.
- Tracks animate while moving/turning, not while idle.
- No idle shaking/bobbing.
- Dust only while moving.

**Validation commands**:

```text
npm run typecheck && npm run test && npm run build && npm run qa:smoke
```

**Manual QA**:

- Test each weapon type: verify unique mechanics (canister depletion, overheat, wind-up, magazine, drum).
- Test armor: Vulcan vs Mammoth (low damage per hit vs high armor). Verify minimum damage floor.
- Test M0 vs M3: verify visible improvement in damage, turret speed, and profile-specific parameter.
- Test recoil: fire Railgun on Wasp (strong recoil) vs Mammoth (minimal recoil).
- Test animation: verify tracks animate while moving, stop while idle. Verify no idle shaking.
- Test Вулcan overheat: fire until overheat, verify jam/penalty, verify cooling.

**Rollback/fallback strategy**:

- If a specific weapon resource model is broken, it can be temporarily reverted to simple cooldown while the model is fixed.
- Armor model can be disabled (set all armor to 0) if it creates balance issues.
- Animation API is additive — blockout rendering continues to work without animation.

**Notes for GPT review**:

- Verify that Shaft is NOT included in any weapon config or weapon selection UI.
- Verify M0-M3 does NOT increase body mass or recoil resistance (per MECHANICS_DECISIONS).
- Verify animation API is designed for future spritesheet replacement (not hardwired to current rectangles).
- Verify Изида is heal-only (damage mode rejected per MECHANICS_DECISIONS).

---

## 6. Cross-cutting architecture risks

### 6.1 Localization / string ownership

**Risk**: Medium

All player-facing strings must come from the localization layer. This requires a clear ownership model: which code owns which strings, and how are they keyed? Without a consistent keying convention (e.g. `scene.entity.field`), string lookups become chaotic. Recommend a namespace-based key system: `mainMenu.newGame`, `faction.potok.name`, `weapon.smoky.description`, etc.

### 6.2 Config sprawl vs typed config model

**Risk**: High

The current codebase has 11+ blockout config files with overlapping concerns (blockoutDamageData + blockoutWeaponData + blockoutVfxData + blockoutRecoilData all describe aspects of weapons). Step 02 must decide: consolidate into fewer typed config files, or keep the current split with cross-references? Consolidation reduces sprawl but increases merge conflicts. Current split is more granular but creates data duplication.

Recommendation: Create new production config files (`weaponData.ts`, `bodyData.ts`) that aggregate fields from multiple blockout files. Keep blockout files as Arena/dev fallback. Production code reads from new files; Arena code continues reading from blockout files.

### 6.3 Old English ids vs Russian displayName

**Risk**: Medium

Internal code ids (e.g. "wasp", "smoky", "raw-storage") must remain English. Player-facing displayNames (e.g. "Васп", "Смоки", "Хранилище сырья") come from localization. Code must never use displayNames for logic — only for UI display. Config entries must have both `id` (English, used in code) and `displayName` (Russian, used in UI).

### 6.4 Current Arena vs Normal mode coupling

**Risk**: High

Arena and Normal mode share significant code: GameScene, rendering systems, blockout configs, damage system. Step 05 (input refactor) and Step 06 (movement refactor) must update both modes simultaneously. If Arena breaks, the primary testing tool is lost.

Recommendation: Every implementation PR must include Arena smoke testing. Arena is not a separate game — it is a mode within the same codebase. Changes to shared systems must be tested in both modes.

### 6.5 DevTools separation

**Risk**: Medium

DevTools panel must be visually and functionally separate from player UI. This means: different style/badge, hidden in Standard mode, accessible in Debug/Arena mode. Dev commands (addRaw, spawn, diagnostics) must not appear in player-facing UI.

### 6.6 Camera projection contract risks

**Risk**: Medium

All visual work must use CAMERA_PROJECTION_CONTRACT. The biggest risk areas are:
- Step 03: Resource asset rendering (industrial crystal positions must be projected).
- Step 06: Depth sorting (projected Y position determines render order).
- Step 07: Hit footprint (projected ground rect for hit detection), splash radius (projected ground circle).
- Step 08: VFX rendering (projected positions for all weapon effects).

Any step that draws circles on the ground plane MUST use `projectGroundCircleToPolyline`, not screen-space circles.

### 6.7 Top-down marker regression risk

**Risk**: Medium

The codebase had a history of using top-down screen-space circles for ground markers. CAMERA_PROJECTION_CONTRACT forbids this. Any new code that draws selection rings, range indicators, footprints, or shadows must use projected primitives. Code review must catch any `graphics.fillCircle()` calls that represent ground-plane concepts.

### 6.8 Movement refactor risk

**Risk**: High+

Step 06 is the highest-risk single change. Replacing arcade movement with grid pathing for combat vehicles touches: blockoutMovement.ts (replace), blockoutAi.ts (update), GameScene.ts (unify update loop), BlockoutVehicleRenderer.ts (update rendering). Any of these can break Arena.

Mitigation: Keep blockoutMovement.ts as a compile-time option. Implement unifiedMovement.ts alongside it. Arena can be switched to unified system once validated.

### 6.9 Pathfinding / occupancy coupling

**Risk**: High

pathfinding.ts and occupancy.ts are currently used only by civil units. Step 06 extends them to combat vehicles. This means: higher load on BFS pathfinding (more units pathing simultaneously), occupancy must handle tile reservation (new concept), and path requests must be cancellable (unit stops, repaths, dies).

### 6.10 Unit / building depth sorting risk

**Risk**: High

Current rendering likely uses creation-order or simple Y-sort. Step 06 must implement proper isometric depth sorting: sort by projected ground-plane Y position, break ties by X position, large buildings use footprint (not sprite center). This affects every rendered entity and is immediately visible if wrong.

### 6.11 Combat hit model risk

**Risk**: High

Step 07 replaces screen-space hit detection with projected hit footprint + aim forgiveness + point-blank assist. This is a fundamental change to how combat works. If hit detection is too generous, combat feels random. If too strict, close-range weapons are frustrating.

### 6.12 Weapon resource model complexity

**Risk**: High

10 different weapon resource models (cooldown, wind-up, canister x3, overheat, near-continuous, magazine, drum) mean 10 different state machines. Each must be individually designed, implemented, tested, and balanced. The most complex are: Вулкан (spin-up + overheat + gyroscopic turret effect), Рикошет (bouncing projectiles + magazine regeneration), Молот (3-volley drum + reload).

### 6.13 Body M0-M3 data migration

**Risk**: Medium

Body M0-M3 must NOT increase mass or recoil resistance. This is a design constraint from MECHANICS_DECISIONS. If the upgrade system accidentally increases mass, light bodies become less light at M3, breaking the design. Tests must explicitly verify mass is constant across M0-M3.

### 6.14 Save / load compatibility risk

**Risk**: Low

Current save/load uses localStorage with GameState serialization. Adding new fields (resource classes, building types, weapon resource model state) will change the save format. Old saves may not load correctly. Recommend adding a save format version field and migration logic.

### 6.15 Test brittleness

**Risk**: Medium

Current tests may rely on specific blockout config values (damage numbers, speed values). When Step 02 extends configs with new fields and potentially new values, tests may break. Recommend: tests should use config values, not hardcoded numbers. Test the config structure, not specific balance values.

### 6.16 QA burden

**Risk**: High

8 High+ steps, each with multiple manual QA items. Total manual QA items across all steps: ~60+. Denis must test each step manually. This is a significant burden. Recommend: automate what can be automated (input routing tests, config completeness tests, economy loop tests). Leave only visual/feel testing for manual QA.

---

## 7. TankViewer asset pipeline feasibility section

### 7.1 Source assets are planning input, not runtime assets

The TankViewer_needed_files.zip contains 3DS models, detail textures, lightmaps, and hull/turret separation data. These are source assets for an offline conversion pipeline, NOT runtime assets. Phaser runtime must never load .3ds files directly.

### 7.2 Offline conversion pipeline

The accepted pipeline direction (from ASSET_USAGE_PERMISSION_STATUS):

```text
3DS + details + lightmap
  -> Blender import / conversion
  -> material reconstruction (using details textures + lightmap)
  -> optional recolor / adaptation for factions/M-levels
  -> render body/turret sprites or atlases from multiple directions
  -> generate metadata JSON
  -> Phaser loads PNG/WebP/atlas + JSON metadata
```

### 7.3 Metadata needed per rendered asset

Each rendered body/turret sprite/atlas must be accompanied by metadata:

```text
- anchor: pixel offset from sprite top-left to ground contact point
- groundContactPoint: where the object touches the isometric ground plane
- turretSocket: pixel offset from body anchor to turret pivot point
- barrelTip: pixel offset from turret pivot to barrel end (for VFX origin)
- bounds: sprite width/height for hit detection and rendering
- footprintClass: Light/Medium/Heavy for collision
- bodyId: which body this asset represents
- weaponId: which turret this asset represents (for turrets)
- modification: M0/M1/M2/M3 level
```

### 7.4 How this relates to STEP 08

Step 08 implements the hybrid animation API. The API must be designed so that:
- Current blockout rectangles work with the animation API immediately.
- Future spritesheet assets can be plugged into the same API without code changes.
- The animation API accepts: body sprite, turret sprite, track/wheel state, recoil state.
- When TankViewer-rendered assets become available, they replace blockout rectangles in the config, and the animation API works identically.

This means Step 08 must NOT hardcode assumptions about rectangle dimensions or single-frame rendering. The API must support multi-frame spritesheets from the start, even if blockout rendering only uses one frame.

### 7.5 Why mass asset generation is still out of scope

Mass asset generation requires:
1. Blender pipeline setup and testing (significant tooling work).
2. Material reconstruction per body/turret (art decisions).
3. Multi-direction rendering (8 directions minimum for smooth rotation).
4. M0-M3 visual differentiation per weapon/body (4x more assets).
5. Faction color adaptation (4x more assets).
6. Metadata generation and validation per asset.

This is a separate pipeline audit/PR, not part of the core mechanics roadmap. The current roadmap uses blockout rectangles for all rendering.

### 7.6 Recommended future separate pipeline audit/PR

After the core mechanics roadmap is implemented and stable, create a separate TankViewer Asset Pipeline audit that covers:

- Exact asset inventory from TankViewer_needed_files.zip.
- Blender import/conversion feasibility testing.
- Material reconstruction workflow.
- Render direction count (8? 16? 32?).
- Sprite/atlas dimensions and compression.
- M0-M3 visual differentiation strategy.
- Faction color adaptation strategy.
- Metadata generation automation.
- Storage and naming conventions.
- Integration with CAMERA_PROJECTION_CONTRACT.
- QA process for generated assets.

Do NOT start this pipeline audit until the core mechanics roadmap implementation is well underway.

---

## 8. Proposed implementation sequence after audit

### 8.1 Which roadmap step first

Step 01 (UI / Localization / Start Flow / Faction Display) should be implemented first. It has no dependencies on other roadmap steps and creates the Russian UX foundation that all subsequent testing requires.

### 8.2 Whether Step 01 should be one PR or split

Step 01 should be split into 3 implementation PRs:
- PR 01a: Localization infrastructure + MainMenuScene + NewGameSetupScene.
- PR 01b: All remaining UI Russian labels + industrial/bronze/sand theme.
- PR 01c: Faction display + tooltip system + DevTools separation.

Rationale: Step 01 touches 10+ UI files and ~200+ strings. A single PR would be too large for effective review. Splitting by concern allows incremental review and reduces rollback risk.

### 8.3 Where GLM should start

GLM should start with PR 01a (localization infrastructure + main menu + game setup). This is the smallest, most self-contained slice with the least coupling. It establishes the localization layer that all subsequent PRs depend on.

### 8.4 Where GPT review must be strict

GPT review must be strictest on:

1. **Step 06 (Movement refactor)** — This is the highest-risk change. Review must verify: movement state machine completeness, waypoint smoothing correctness, tile reservation edge cases, Arena compatibility, depth sorting algorithm.

2. **Step 07 (Combat hit model)** — Second-highest risk. Review must verify: projected hit footprint geometry, aim forgiveness tuning, point-blank assist threshold, cone/splash detection math, CAMERA_PROJECTION_CONTRACT compliance.

3. **Step 08 (Weapon resource models)** — Widest surface area. Review must verify: each weapon model matches MECHANICS_DECISIONS description, armor formula is correct, M0-M3 does not increase mass/recoil, animation API is spritesheet-ready.

4. **Step 02 (Config data model)** — Foundation for all subsequent steps. Review must verify: type safety, completeness, backward compatibility with Arena/blockout, M0-M3 scaling model design.

### 8.5 Where manual QA is critical

Manual QA is most critical for:

1. **Step 01** — Russian text layout (button overflow, panel sizing).
2. **Step 05** — Input model change (LMB/RMB, camera, S/Esc).
3. **Step 06** — Visual movement feel (smoothness, turning, depth sorting).
4. **Step 07** — Combat feel (hit reliability, point-blank, splash).
5. **Step 08** — Weapon variety feel (each weapon plays differently).

---

## 9. Validation plan

### 9.1 Standard validation (every implementation PR)

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

No PR passes without all four commands succeeding.

### 9.2 Step-specific tests

**Step 01 — Localization tests**:
- Every UI scene has no hardcoded English strings (grep test).
- Localization layer returns Russian for all keys.
- English fallback works for missing Russian keys.
- NewGameSetup flow: Standard mode hides Sand/Map1.
- Debug mode: Sand/Map1 visible with dev flag.

**Step 02 — Config completeness tests**:
- Every weapon (10) has all required fields populated.
- Every body (7) has all required fields populated.
- Every faction (4) has displayName and bonus fields.
- Every resource class (6) has displayName, asset key, amount range.
- M0-M3 scaling: damage and turretTurnSpeed increase M0→M3.
- Body M0-M3: mass constant across M0-M3.

**Step 03 — Map anchor tests**:
- Resource class config completeness.
- Anchor placement: generated maps place resources at anchors.
- Seed reproducibility: same seed = same anchors.
- Map validation passes for all seeds.
- Harvester gathers from all 6 classes.

**Step 04 — Economy loop tests**:
- All 6 core buildings have complete configs.
- Economy loop: raw → separator → energy + element → build → produce.
- Storage caps: each storage raises its resource cap.
- Separator status: correct Russian messages.
- Factory production: queue + cost deduction.

**Step 05 — Input routing tests**:
- LMB never commands movement or attack.
- RMB commands based on target type.
- S stops and clears target-lock.
- Esc follows priority chain.
- Camera: MMB pans, LMB/RMB do not pan.

**Step 06 — Movement/occupancy tests**:
- Combat vehicles use BFS pathfinding.
- No unit overlap.
- Physical turning: heavy slower than light.
- Waypoint smoothing inside corridor.
- Tile reservation prevents double-entry.
- Footprint classes affect occupancy.
- Depth sorting: behind/in front correct.

**Step 07 — Projection/depth/hit tests**:
- Attack command + target-lock.
- Range bands: unit stops at stopDistance.
- Projected hit footprint: not screen-distance.
- Aim forgiveness: near-misses count as hits.
- Point-blank assist: auto-hit within minRange.
- Cone/splash detection geometry.
- 2.5D vertical forgiveness.

**Step 08 — Weapon resource model tests**:
- Per-weapon model tests (10 weapons).
- Armor formula: max(damage - armor, damage * minPercent).
- Recoil: weaponRecoil / bodyMass, visual only.
- M0-M3: all scaling correct.
- Animation: idle = no animation, moving = tracks animate.

---

## 10. Manual QA master checklist

This checklist is for Denis to verify each step after implementation.

### 10.1 Menus / Russian UI

- [ ] Main menu: all labels in Russian (Новая игра, Продолжить, Настройки)
- [ ] New Game setup: Russian labels throughout
- [ ] Pause menu: Russian labels (Продолжить, Сохранить, Загрузить, В главное меню)
- [ ] Settings: Russian labels
- [ ] All buttons wide enough for Russian text, no overflow
- [ ] All panels follow industrial/bronze/sand visual system

### 10.2 New game flow

- [ ] Flow: mode → map size → faction → start
- [ ] Standard mode: no Sand Classic, no Map 1, no mapStyle selector
- [ ] Debug mode: Sand Classic and Map 1 visible behind dev flag
- [ ] Arena mode: retains its tooling

### 10.3 Faction selection

- [ ] 4 factions shown with Russian names (Поток, Росток, Искра, Око)
- [ ] Each faction shows passive bonus description in Russian
- [ ] Faction colors correct (cyan, green, yellow, purple)

### 10.4 Resources

- [ ] 6 resource deposit classes visible (Очень бедная through Бесконечная)
- [ ] Start zone has poor/medium deposits
- [ ] Center has 2x2 infinite deposit
- [ ] Side zones have rich/very_rich deposits
- [ ] Resource class visible in tooltip with Russian name
- [ ] Harvester gathers from all classes correctly

### 10.5 Buildings / economy

- [ ] HQ exists at game start (not in build menu)
- [ ] All 5 buildable core buildings available (Separator, 3 Storages, Factory)
- [ ] All buildings have Russian names and descriptions
- [ ] Separator status messages in Russian (Нет сырья / Накопитель полон / Работает)
- [ ] Storages raise resource caps
- [ ] Factory production queue works with Russian unit names
- [ ] Economy loop works: harvest → deposit → separate → build → produce

### 10.6 Unit controls

- [ ] LMB selects units and buildings
- [ ] LMB on enemy inspects but does not control
- [ ] RMB on ground = move command
- [ ] RMB on enemy = attack command
- [ ] RMB on resource = harvest (if selected can harvest)
- [ ] RMB with no unit selected = no-op
- [ ] S stops unit and clears target-lock
- [ ] Esc follows priority: cancel → deselect → close → pause

### 10.7 Camera controls

- [ ] MMB drag pans camera
- [ ] Arrow keys move camera
- [ ] Scroll wheel zooms camera
- [ ] LMB does NOT pan camera
- [ ] RMB does NOT pan camera
- [ ] No camera rotation

### 10.8 Movement and collision

- [ ] All units follow grid/tile paths
- [ ] Units physically turn toward next path segment
- [ ] Heavy bodies turn slower than light bodies
- [ ] No unit overlap
- [ ] No passing through other units
- [ ] No passing through building footprints
- [ ] Waypoint smoothing looks smooth
- [ ] Territory does not block movement

### 10.9 Depth sorting

- [ ] Units behind buildings render behind them
- [ ] Units in front of buildings render above them
- [ ] Large buildings depth-sorted by footprint, not sprite center
- [ ] No z-order glitches between units and buildings

### 10.10 Combat targeting

- [ ] Right-click enemy = attack command
- [ ] Unit pathfinds toward target until in range
- [ ] Unit stops at stopDistance (not at enemy center)
- [ ] Turret aims at target (not mouse)
- [ ] Turret tracks target at turretTurnSpeed (does not snap)
- [ ] S key clears target-lock

### 10.11 Hit reliability

- [ ] No point-blank misses (point-blank assist works)
- [ ] Near-misses count as hits (aim forgiveness)
- [ ] Different body heights do not cause misses (2.5D forgiveness)
- [ ] Cone weapons (Flamethrower, Freeze, Hammer) hit targets in cone
- [ ] Splash weapons (Thunder) hit targets in projected radius
- [ ] Self-damage from Thunder splash works

### 10.12 Weapon behavior

- [ ] Смоки: reliable single-shot with cooldown
- [ ] Гром: splash damage, radius constant M0-M3
- [ ] Рельса: wind-up charge before shot
- [ ] Огнемёт: canister depletes and regenerates
- [ ] Фриз: canister depletes, slows enemies
- [ ] Изида: beam heals nearest ally
- [ ] Вулкан: spin-up, overheat, cooling
- [ ] Твинс: alternates barrels, high fire rate
- [ ] Рикошет: magazine with regeneration, bouncing
- [ ] Молот: 3-volley drum, then reload

### 10.13 Body differences

- [ ] Васп: fast, fragile, strong recoil impact
- [ ] Мамонт: slow, armored, minimal recoil
- [ ] Хантер: baseline medium reference
- [ ] Armor reduces small hits but never to zero

### 10.14 Animation

- [ ] Tracks/wheels animate while moving
- [ ] Tracks/wheels animate while turning
- [ ] Tracks/wheels do NOT animate while idle
- [ ] Recoil visible on firing (stronger on light bodies)
- [ ] No idle shaking or bobbing
- [ ] Dust only while moving, not while idle

---

## 11. Forbidden scope master list

```text
- No production bot
- No strategic enemy AI
- No attack waves
- No Shaft weapon (deferred)
- No final art generation
- No mass asset generation
- No active faction abilities
- No unique faction tech trees
- No copying code from four-elements-next
- No camera rotation
- No top-down ground markers / rings / shadows / range indicators
  (all ground markers must be projected through CAMERA_PROJECTION_CONTRACT)
- No direct .3ds runtime loading
- No raw TankViewer source asset commit in this audit PR
- No implementation in this audit PR
- No Arena feature expansion by inertia
- No bot roadmap
- No economy AI
- No enemy base building
- No buildable walls/barriers
- No repair center (gameplay later)
- No defense tower (gameplay later)
- No unique faction buildings
- No minimap/fog expansion
- No full 3D turret pitch / ballistics
- No save/load format changes without version field
```

---

## 12. Next action after audit merge

After this audit is reviewed and merged, start STEP 01H+ implementation only after Denis/GPT explicitly approve the first implementation task.

The recommended first implementation task is:

```text
PR 01a — Localization infrastructure + MainMenuScene + NewGameSetupScene
```

This establishes the localization layer and Russian UI foundation that all subsequent steps depend on.

No implementation should begin until:
1. This audit is reviewed by GPT.
2. This audit is merged by Denis.
3. Denis or GPT explicitly assigns the first implementation PR.

---

## Optional: CURRENT_NEXT_STEP.md update recommendation

After this audit is merged, `docs/project/CURRENT_NEXT_STEP.md` should be updated to reflect:

```text
Core Mechanics Roadmap: ACCEPTED.
Core Mechanics System Audit: ACCEPTED.
Current direction: Core Mechanics implementation.
Next action: STEP 01H+ implementation (PR 01a: Localization + MainMenu + NewGameSetup).
```

This update should be done in a separate small commit after the audit PR is merged, to avoid ambiguity about the audit's status before merge.
