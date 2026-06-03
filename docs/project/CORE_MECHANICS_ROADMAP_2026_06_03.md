# CORE_MECHANICS_ROADMAP_2026_06_03.md

Status: proposed roadmap  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Source decision doc: `docs/project/MECHANICS_DECISIONS_2026_06_03.md`  
Date: 2026-06-03

---

## 1. Title / status

```text
CORE MECHANICS ROADMAP
Status: proposed
Project: Four Elements Phaser
Repo: ratoker-jpg/four-elements-phaser
Source: docs/project/MECHANICS_DECISIONS_2026_06_03.md
Date: 2026-06-03
```

This roadmap defines the next High+/High implementation sequence for polishing and deepening the current playable core mechanics baseline.

Only mechanics accepted in `MECHANICS_DECISIONS_2026_06_03.md` are included. The exploratory audit (`MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md`) is a reference, not scope.

---

## 2. Roadmap goal

Turn the current prototype into a readable core gameplay baseline with:

- **Russian player-facing UX** — all menus, labels, tooltips, status messages, faction names, weapon names, body names, building names, and resource names in Russian. Internal code ids remain English.
- **Industrial Platform–only normal game start** — no Sand Classic, no Map 1, no mapStyle selector in normal UX. Generated maps with Industrial terrain.
- **Factions with identity** — Поток, Росток, Искра, Око with config-driven passive bonuses visible in faction selection.
- **Resources and map anchors** — 6 deposit classes with fixed anchor positions, controlled variation, and center infinite deposit.
- **Buildings and core economy loop** — HQ, Separator, storages, and Units Factory with Russian names, clear statuses, and readable economy.
- **Unified RTS controls** — LMB select/inspect, RMB command, S stop, Esc context, MMB/arrow camera. Applied consistently to all unit types.
- **Grid movement with physical feel** — tile pathing for all ground units, waypoint smoothing from the start, acceleration/braking/turn physics, tile reservation, no overlap.
- **Occupancy, collision, and depth sorting** — footprint classes, building collision, correct isometric depth sorting and occlusion.
- **Target-lock combat core** — attack command, min/ideal/max range, stopDistance, projected hit footprint, aim forgiveness, point-blank assist.
- **Weapon mechanics** — 10 accepted weapons (no Shaft) with cooldown/wind-up/canister/overheat/magazine/drum categories, M0-M3 scaling, turretTurnSpeed, VFX profiles.
- **Body mechanics** — 7 bodies with roles, HP, armor (flat reduction + minimum floor), mass, speed, acceleration, braking, turn speed, footprint classes, fixed recoil response, M0-M3 without mass/recoil changes.
- **Animation and physical feel** — hybrid animation API, procedural now and spritesheet-ready later, tracks/wheels only while moving/turning, mass-dependent recoil visuals, no idle shaking.

---

## 3. Non-goals

```text
- No production bot roadmap.
- No strategic enemy AI.
- No attack waves.
- No Shaft weapon (deferred).
- No final art generation.
- No mass asset generation.
- No active faction abilities.
- No unique faction tech trees.
- No copying code from four-elements-next.
- No camera rotation.
- No top-down ground markers.
- No implementation without future audit.
```

---

## 4. Roadmap principles

```text
- CAMERA_PROJECTION_CONTRACT.md is mandatory for all visual/world-space/rendering/asset work.
- All player-facing UI is Russian.
- Internal ids may stay English.
- Config/data model first where needed.
- No hardcoded balance if it belongs in config.
- No temporary movement/collision hacks that will be thrown away later.
- High+/High steps only — avoid many small PRs.
- Consolidate related work into larger coherent steps.
- Each step must produce a player-visible result.
- This roadmap is not the implementation audit — a separate audit will be created after this roadmap is accepted.
```

---

## 5. Proposed High+/High roadmap sequence

### STEP 01H+ — UI / Localization / Start Flow / Faction Display

**Risk**: High+

**Purpose**: Make the game speak Russian and present a clean Industrial-only game start. Remove obsolete options from normal UX. Unify the visual style to industrial/bronze/sand. Show faction names and passive bonus descriptions in faction selection.

**Player-visible result**: The entire player-facing UI is in Russian. New Game flow shows only Industrial Platform / Generated. Faction selection displays names (Поток, Росток, Искра, Око) with passive bonus text. All menus and buttons follow one coherent visual style. Debug/DevTools are visually and functionally separate from player UI.

**Accepted mechanics included**:
- All player-facing UI must be Russian (Section 3 of decisions).
- Localization/config layer required. New strings from layer, not scattered hardcoded text.
- English remains as fallback/dev reference.
- Normal game start flow: New Game → mode → map size → faction → start.
- Industrial-only normal UX: Sand Classic hidden, Map 1 hidden, mapStyle selector hidden.
- Industrial / bronze / sand UI style: dark panels, warm accents, readable states, no random button mix.
- Debug UI is visually and functionally separate from player UI.
- Player-facing displayName for factions, weapons, bodies, buildings, resources.
- Tooltips/descriptions: faction bonus, weapon role, body role, resource class, building purpose, disabled button reason.

**Expected boundaries**:
- Create localization string map system (`src/config/localization.ts` or equivalent).
- Replace all English strings in MainMenuScene, NewGameSetupScene, PauseMenu, PlaytestHud, ArenaMenu, ArenaUnitComposer, DevtoolsPanel, and all status/help messages.
- Restructure NewGameSetupScene flow to match: mode → map size → faction → start.
- Remove Sand Classic, Map 1, mapStyle from normal NewGameSetup. Keep behind `?devtools=1` or debug flag.
- Apply unified industrial/bronze/sand CSS style to all panels and buttons.
- Add faction display names (Поток / Росток / Искра / Око) with passive bonus text in faction selection.
- Add tooltip/description system for weapons, bodies, buildings, resources.
- Separate DevTools visually (different style or badge) and functionally (hidden in Standard mode).

**Dependencies**: None. This step has no dependencies on other roadmap steps and should come first because Russian UX is needed for all subsequent testing by the target audience.

**Acceptance criteria**:
- All player-facing labels in Russian.
- NewGameSetupScene flow: mode → map size → faction → start.
- Sand Classic, Map 1, mapStyle not visible in Standard mode.
- All buttons follow one visual system (bronze/teal/red for primary/secondary/danger).
- Faction selection shows Russian names and passive bonus descriptions.
- Tooltips display for weapons, bodies, buildings, resources.
- DevTools not visible in Standard mode.
- Arena mode retains its tooling.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No weapon damage/balance changes.
- No movement/pathfinding changes.
- No combat changes.
- No building mechanic changes.
- No changes to internal English ids.

**Manual QA focus**:
- Open every menu and panel. Verify Russian text, correct layout (wider buttons for longer Russian words), no text overflow.
- Start a Standard mode game. Verify no Sand/Map1/mapStyle options visible.
- Start a Debug mode game. Verify Sand/Map1 options visible behind dev flag.
- Select each faction. Verify Russian name and bonus description.
- Hover over weapons, bodies, buildings, resources. Verify tooltips.
- Verify DevTools hidden in Standard, visible in Debug/Arena.

**Why this step first**: Russian UX is the foundation for all subsequent work. Without Russian labels, the target audience cannot test the game. The start flow cleanup removes obsolete options that would confuse players. The UI style unification creates a consistent visual baseline for all future UI work. Faction display establishes the faction identity that later steps build upon.

---

### STEP 02H+ — Config and Data Model Foundation

**Risk**: High+

**Purpose**: Create config-driven data models for all accepted mechanics so that subsequent steps can reference structured, localized, upgrade-aware configs instead of scattered hardcoded values. This step prepares the ground for weapons, bodies, factions, resources, and buildings without implementing their gameplay mechanics yet.

**Player-visible result**: Player sees Russian displayNames for weapons, bodies, buildings, and resources in tooltips and UI. Faction bonuses are described from config, not hardcoded. M0-M3 upgrade indicators exist in data. Resource deposit classes have Russian names. Building roles have Russian descriptions.

**Accepted mechanics included**:
- displayName for all entities (Section 3, 7, 9, 10, 11, 12 of decisions).
- Localization layer from Step 01 is used for all displayNames.
- Weapon global fields: displayName, rangeClass, minRange, idealRange, maxRange, stopDistance, fireType, cooldown/windUp/canister/overheat/magazine/drum model, damage model, VFX profile, turretTurnSpeed, M0-M3 scaling (Section 7).
- Body global fields: displayName, role, HP, armor, mass, speed, acceleration, braking, bodyTurnSpeed, footprint/collision class (Section 9).
- Faction config: displayName, passive bonus description, passive bonus fields (Section 10).
- Resource classes: 6 classes with displayName and asset mapping (Section 11).
- Building readiness classes: gameplay-ready, visual-ready/mechanic-later, deferred (Section 12).
- Armor model: flat reduction + minimum damage floor (Section 9).
- M0-M3 always increase damage, turretTurnSpeed, and weapon's profile-specific parameter (Section 7).
- Body M0-M3: HP, armor, speed, acceleration, braking, bodyTurnSpeed. NOT mass, NOT recoil resistance (Section 9).

**Expected boundaries**:
- Extend `blockoutWeaponData.ts` and/or create new config files with full accepted fields per weapon (all 10 accepted weapons, no Shaft).
- Extend `blockoutBodyData.ts` and/or create new config files with full accepted fields per body (7 bodies).
- Create faction config with displayName, passive bonus fields, and description.
- Extend resource config with 6 classes, displayName per class, asset key mapping, and amount ranges.
- Add armor field to body config (flat reduction value + minDamagePercent).
- Add M0-M3 scaling data model to weapon and body configs.
- Add turretTurnSpeed per weapon and per M-level.
- Add minRange, idealRange, maxRange, stopDistance per weapon.
- All displayNames come from localization layer.
- Existing blockout data remains as fallback for Arena/dev.
- No gameplay behavior changes — this step is data model and config only.

**Dependencies**: Step 01 (localization layer must exist for displayNames).

**Acceptance criteria**:
- Every accepted weapon (10, no Shaft) has config entry with: displayName (ru), rangeClass, minRange, idealRange, maxRange, stopDistance, fireType, cooldown/windUp/canister/overheat/magazine/drum fields, damage model, VFX profile, turretTurnSpeed, M0-M3 scaling fields.
- Every body (7) has config entry with: displayName (ru), role, HP, armor (flat value + minDamagePercent), mass, speed, acceleration, braking, bodyTurnSpeed, footprint/collision class.
- Every faction (4) has config entry with: displayName (ru), passive bonus description (ru), passive bonus fields.
- Every resource class (6) has config entry with: displayName (ru), asset key, amount range.
- Building config entries have: displayName (ru), role description (ru), readiness class.
- All displayNames are sourced from localization layer.
- Existing Arena/blockout gameplay is not broken.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No damage formula changes yet.
- No movement/pathfinding changes.
- No combat behavior changes.
- No UI layout changes (Step 01 handles that).
- No changes to Arena AI modes.

**Manual QA focus**:
- Verify Arena still works with extended config (old blockout data still functions).
- Verify tooltips pick up displayName from config.
- Verify M0-M3 fields exist and are structurally correct for each weapon and body.

**Why this step before Steps 03-08**: Every subsequent step depends on structured config data. Weapons, bodies, factions, resources, and buildings all need their data models defined before gameplay mechanics can be implemented from them. Without this step, each later step would independently extend configs in potentially inconsistent ways.

---

### STEP 03H+ — Industrial Map and Resource Layout

**Risk**: High+

**Purpose**: Implement the accepted 6-class resource model with fixed anchor placement and controlled variation. Restructure map generation to use Industrial Platform terrain with deterministic resource anchors for start zone, side/intermediate, contested, and center positions.

**Player-visible result**: Normal game maps use only Industrial Platform terrain with 6 distinct resource deposit types visible (Очень бедная through Бесконечная). Start zone has appropriate poor/medium deposits. Center has a 2×2 infinite deposit. Side zones have rich/very_rich deposits. Resource class is visible in tooltip. Maps feel strategically structured, not random.

**Accepted mechanics included**:
- Normal game uses Industrial Platform, Generated maps (Section 11).
- 6 deposit classes: very_poor, poor, medium, rich, very_rich, infinite with Russian UI names and industrial asset mapping (Section 11).
- Starter zone uses very_poor / poor / medium (Section 11).
- Side / intermediate zones use medium / rich (Section 11).
- Contested zones use rich / very_rich (Section 11).
- Center uses infinite 2×2 deposit (Section 11).
- Key resource points use fixed anchors (Section 11).
- Small controlled variation around anchors is allowed (Section 11).
- Exact amounts live in config, not hardcode (Section 11).
- Map 1 may be used as reference for resource anchors (Section 11).
- Sand Classic and Map 1 hidden from normal UX (Section 3, already done in Step 01).

**Expected boundaries**:
- Extend `src/state/types.ts` with 6 resource classes (very_poor, poor, medium, rich, very_rich, infinite).
- Create resource amount config with ranges per class (preliminary amounts from decisions: 150-250, 300-500, 800-1200, 1800-2500, 3500-5000, infinite/50000+).
- Create industrial asset key mapping per resource class.
- Redesign `generateResources()` to use fixed anchor positions per map size.
- Define anchor layouts for Small (32×32), Standard (48×48), Large (64×64).
- Start zone anchors NE of HQ. Center infinite anchor at map center. Side/contested anchors at defined positions.
- Implement controlled variation: slight random offset within anchor zone, slight type variation (medium vs rich in contested zone).
- Ensure map validation still passes (starter resources near HQ, HQ area clear, central deposit exists).
- Harvester gathering logic must handle 6 resource classes and appropriate amount ranges.
- Update PlaytestHud resource display to show resource class in Russian.

**Dependencies**: Step 01 (Russian labels), Step 02 (resource config data model).

**Acceptance criteria**:
- 6 resource classes exist in config with Russian displayNames, asset keys, and amount ranges.
- Generated maps place resources at fixed anchor positions with controlled variation.
- Start zone has very_poor/poor/medium deposits.
- Center has infinite 2×2 deposit.
- Side/contested zones have rich/very_rich deposits.
- Map validation passes for all seeds and map sizes.
- Harvester gathers from all 6 resource classes correctly.
- Resource class shown in tooltip/UI with Russian name.
- No sand terrain in normal game flow.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No combat changes.
- No movement/pathfinding changes.
- No building mechanic changes.
- No weapon/body balance changes.
- Arena mode remains unchanged (Arena has its own map setup).

**Manual QA focus**:
- Start games on Small, Standard, Large maps. Verify resource anchor positions are readable and consistent.
- Verify start zone has appropriate deposits.
- Verify center has 2×2 infinite deposit.
- Harvest from each resource class. Verify amounts and gathering behavior.
- Verify same seed produces same anchor positions.
- Verify different seeds produce slight variation within anchor zones.

**Why this step after Step 02**: The resource class data model and amount config must exist before the map generator can place deposits by class. Step 02 creates the config structure; this step uses it.

---

### STEP 04H+ — Buildings and Core Economy Loop

**Risk**: High+

**Purpose**: Make the core economy loop fully playable with Russian names, clear building statuses, and readable economy. Fix the 3 non-functional building configs (Raw Storage, Energy Storage, Element Storage). Ensure every core building has a Russian displayName, role description, clear visual status, and working mechanic.

**Player-visible result**: Player can build all core buildings (Главное здание, Сепаратор, Хранилище сырья, Хранилище энергии, Хранилище элементов, Фабрика юнитов) with Russian names and clear purpose descriptions. Separator shows clear status (no raw / output full / working). Storages raise resource caps. Factory shows production queue/progress. Economy is readable and complete through the core loop.

**Accepted mechanics included**:
- Core gameplay-ready buildings: Главное здание, Сепаратор, Хранилище сырья, Хранилище энергии, Хранилище элементов, Фабрика юнитов (Section 12).
- Building readiness classes: gameplay-ready first (Section 12).
- Главное здание: start base, drop-off point, base vision, starting storage, defeat condition later (Section 12).
- Сепаратор: raw minerals → energy + faction element. Needs clear statuses: no raw, output full, working (Section 12).
- Хранилища: raise limits, no passive production (Section 12).
- Фабрика юнитов: produces units, queue/progress, production cost (Section 12).
- Энергостанция/Энергореактор: should not replace Separator, should improve energy infrastructure (Section 12) — visual-ready/mechanic-later in this step, not gameplay-ready.
- Ремонтный центр, Оборонная башня: gameplay later, not in this step (Section 12).
- No copying Next code (Section 12).
- Buildings are gameplay/economy/progression objects, not random decor (Section 12).

**Expected boundaries**:
- Fix Raw Storage (`raw-storage`) building config in `construction.ts` — add cost, build time, footprint.
- Create Energy Storage (`energy-storage`) and Element Storage (`element-storage`) building configs — these may be new building types or repurposed existing ones. Map to existing assets where available.
- Add Russian displayName and role description to all building configs (from localization layer).
- Ensure Separator status messages are in Russian and clear: "Нет сырья", "Накопитель полон", "Работает".
- Ensure Factory production queue shows Russian unit names and progress.
- Ensure all building costs, build times, and effects are in config, not hardcoded.
- Add Энергостанция/Энергореактор as visual-ready building (can be placed/seen, marked as planned, no gameplay mechanic yet).
- Verify building placement uses CAMERA_PROJECTION_CONTRACT.md for footprint rendering.
- Verify building depth sorting is correct (south vertex anchor).
- Update PlaytestHud to show Russian building names and statuses.

**Dependencies**: Step 01 (Russian labels), Step 02 (building config data model), Step 03 (resource classes — storages interact with resource amounts and caps).

**Acceptance criteria**:
- All 6 core buildings are placeable and functional in Standard mode.
- Raw Storage, Energy Storage, Element Storage have configs and can be built.
- All buildings have Russian displayNames and descriptions in tooltips.
- Separator shows clear Russian status messages.
- Factory shows production queue with Russian names.
- Storages correctly raise resource caps.
- Economy loop (HQ → harvester → resource → separator → matter → builder → building) works end-to-end.
- Энергостанция exists as visual-ready building (placeable, visible, no mechanic).
- Building placement uses projected footprints.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No combat changes.
- No movement/pathfinding changes.
- No weapon/body balance changes.
- No faction mechanic changes (passive bonuses apply in Step 02 config; economy effects of faction bonuses are balance tuning, not this step).
- No repair center or defense tower (gameplay later).
- No walls/barriers.

**Manual QA focus**:
- Build each core building. Verify Russian name, description, cost, and build time.
- Build Separator. Verify status messages cycle correctly in Russian.
- Build each Storage. Verify resource caps increase.
- Build Factory. Verify production queue works with Russian names.
- Run full economy loop: harvest → deposit → separate → build → produce.
- Verify building footprints render correctly on isometric ground.

**Why this step after Step 03**: Buildings depend on resource classes and amounts. Storage caps must be consistent with the 6-class resource model. The economy loop must work with the new resource amounts before faction bonuses can be balanced against it.

---

### STEP 05H+ — Unified RTS Controls and Command Routing

**Risk**: High+

**Purpose**: Replace the current mixed input model with the accepted classic RTS control scheme. LMB for selection/inspect only. RMB for all commands. S for stop. Esc for context cancel. MMB drag and arrow keys for camera. Apply consistently to all unit types — harvester, builder, and combat vehicle.

**Player-visible result**: Player selects units with LMB, commands them with RMB. Right-click ground = move. Right-click enemy = attack. Right-click resource = harvest (if selected can harvest). Right-click building = context action. S stops and clears commands. Esc cancels modes/deselects. MMB drag pans camera. Arrow keys move camera. No LMB camera drag. No RMB camera drag. Works for harvesters, builders, and combat vehicles alike.

**Accepted mechanics included**:
- LMB = selection / inspect (Section 4).
- RMB = command: move, attack, harvest, context (Section 4).
- S = stop selected units, clear movement/attack command, clear target-lock (Section 4).
- Esc = cancel active mode / close overlay / deselect / pause depending on context (Section 4).
- MMB drag = camera pan (Section 4).
- Arrow keys = camera movement (Section 4).
- LMB does NOT move camera, issue move command, or issue attack command (Section 4).
- RMB does NOT move camera (Section 4).
- No selected unit = no-op for RMB (Section 4).
- Rejected: LMB move/attack, pure LMB-only, RMB camera pan, LMB camera pan, mixing selection and command on same button (Section 4).

**Expected boundaries**:
- Refactor input handling in GameScene to separate LMB (selection) and RMB (command) paths.
- LMB click on own unit: select it. LMB click on enemy: inspect (show info, no control transfer). LMB click on building: select/inspect.
- RMB click on ground with selected unit: move command. RMB click on enemy with selected unit: attack command. RMB click on resource with selected harvester: harvest command. RMB click on building with selected builder: build/enter command.
- S key: stop selected units, clear current movement, clear target-lock.
- Esc key: context-sensitive — cancel placement mode first, then deselect, then close overlay, then pause menu.
- MMB drag: camera pan (not RMB drag, not LMB drag).
- Arrow keys: camera movement (already exists, verify still works).
- RMB with no selected unit: no-op.
- Apply to Arena mode: LMB selects ally, RMB commands ally, RMB on enemy = attack command. Arena input controller updated.
- Apply to Normal mode: harvesters, builders, and combat vehicles all use same LMB/RMB scheme.
- Remove any LMB-move or LMB-attack behavior from any mode.
- Add cursor feedback: move cursor on RMB ground, attack cursor on RMB enemy, harvest cursor on RMB resource.
- Add command confirmation: brief visual ring at command target location.

**Dependencies**: Step 01 (Russian labels for cursor feedback / command confirmation messages). Step 02 (weapon/body config for attack range data used by attack command).

**Acceptance criteria**:
- LMB selects/inspects only. Never commands movement or attack.
- RMB commands: move, attack, harvest, context. Never moves camera.
- S stops and clears target-lock.
- Esc follows context priority: cancel → deselect → close → pause.
- MMB drag pans camera.
- No LMB camera drag. No RMB camera drag.
- Works for harvester, builder, and combat vehicle.
- Arena mode uses same LMB/RMB scheme for ally control.
- Cursor changes on RMB hover to indicate command type.
- Command confirmation appears at target location.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No movement/pathfinding changes (that is Step 06).
- No damage/hit model changes (that is Step 07).
- No weapon/body balance changes.
- No building mechanic changes.
- No Arena AI mode changes.

**Manual QA focus**:
- Select harvester with LMB. RMB on resource = harvest. RMB on ground = move.
- Select builder with LMB. RMB on building site = build. RMB on ground = move.
- Select combat vehicle with LMB. RMB on enemy = attack. RMB on ground = move.
- S stops selected unit and clears target-lock.
- Esc cancels placement, then deselects, then closes overlay, then pauses.
- MMB drag pans camera. LMB does not pan camera. RMB does not pan camera.
- In Arena: LMB selects ally, RMB commands ally, RMB on enemy = attack.
- Verify cursor feedback changes for different RMB targets.

**Why this step before Step 06**: The control scheme determines how players issue move and attack commands. Movement (Step 06) implements how units execute move commands. Combat (Step 07) implements how units execute attack commands. The command routing must be in place first so that movement and combat have a clear input contract.

---

### STEP 06H+ — Movement / Occupancy / Depth Sorting

**Risk**: High+

**Purpose**: Replace the current dual movement model (BFS for civil, arcade for combat) with a unified grid/tile pathing system for all ground units. Implement waypoint smoothing, physical turning, acceleration/braking, tile reservation, and collision from the start. Add correct isometric depth sorting and building occlusion.

**Player-visible result**: All units — harvesters, builders, and combat vehicles — move along grid paths through tile centers. Units physically turn toward the next path segment before driving. Heavy bodies turn slower, light bodies turn faster. No unit overlap. No instant direction snaps. No free diagonal sliding. Units behind buildings render behind them. Units in front render above. No z-order glitches.

**Accepted mechanics included**:
- All ground units use grid/tile pathing (Section 5).
- Path goes through tile centers (Section 5).
- Free arcade movement is not the production model (Section 5).
- No diagonal corner cutting as primary movement model (Section 5).
- Units reserve the next tile/corridor before moving (Section 5, Section 6).
- Units cannot enter occupied cells, pass through other units, or pass through obstacle/building footprints (Section 5, Section 6).
- Movement has acceleration and braking (Section 5).
- Body direction does not snap instantly (Section 5).
- Unit turns physically toward the next segment (Section 5).
- Waypoint smoothing accepted from the start, must remain inside safe tile corridor (Section 5).
- If smooth arc would violate occupancy/pathing, fallback is turn-in-place (Section 5).
- Movement states: idle, path_requested, turning_to_segment, moving_segment, braking, next_segment, attacking, stopping, blocked, repathing, target_chase (Section 5).
- Every ground unit has logical footprint/collision profile (Section 6).
- Body size affects footprint/collision class — Light/Medium/Heavy (Section 6).
- If next cell is occupied, unit waits briefly, then repaths, then stops with feedback if no path (Section 6).
- Building and obstacle footprints block movement (Section 6).
- Correct isometric depth sorting is part of mechanics readability (Section 6).
- Units behind buildings render behind; in front render above (Section 6).
- Building depth based on footprint/front-bottom edge (Section 6).
- Unit depth based on ground contact point / logical tile position (Section 6).
- Large buildings consider footprint, not sprite center (Section 6).
- Collision, depth sorting, and occlusion are separate systems (Section 6).

**Expected boundaries**:
- Extend or replace `blockoutMovement.ts` with grid-based movement state machine for combat vehicles.
- Reuse BFS pathfinding (`pathfinding.ts`) for combat vehicles, same as civil units.
- Implement movement state machine: idle → path_requested → turning_to_segment → moving_segment → braking → next_segment → (repeat or arrived).
- Implement waypoint smoothing: at each direction change, unit traces a smooth arc inside the tile corridor. If arc would violate occupancy, fallback to turn-in-place.
- Implement physical turning: unit rotates body toward next segment direction at bodyTurnSpeed rate. Heavy bodies turn slower.
- Implement acceleration/braking: unit accelerates from stop, brakes before waypoint. Rates from body config.
- Implement tile reservation: unit reserves next tile before entering it. Other units cannot path into reserved tiles.
- Implement unit collision: if next tile is occupied, wait briefly (configurable), then repath. If no path, stop and show feedback.
- Implement body footprint classes: Light (Wasp, Hornet), Medium (Hunter, Viking, Dictator), Heavy (Titan, Mammoth). Affect how many tiles a unit occupies.
- Implement building/obstacle footprint collision: combat vehicles cannot enter building footprint tiles.
- Implement isometric depth sorting: sort all renderable objects (units + buildings) by their ground-plane Y position (projected bottom point). Break ties by X position. Large buildings use footprint, not sprite center.
- Implement basic occlusion: units behind tall buildings may be partially hidden. Full occlusion (clip/mask) can be simplified to transparency or depth-based rendering order.
- Update civil unit movement (harvester/builder) to use same unified system if not already compatible.
- Remove screen-space arcade movement as production model. Arena combat vehicles now use grid pathing.
- Territory does not block movement (per decisions).

**Dependencies**: Step 02 (body config with footprint/collision class, speed, acceleration, braking, turn speed). Step 04 (building footprints for collision). Step 05 (command routing — move commands trigger pathfinding and movement).

**Acceptance criteria**:
- All ground units (harvester, builder, combat vehicle) use grid/tile pathing.
- No unit overlap. No passing through other units.
- Units physically turn toward next path segment. Heavy bodies turn slower.
- Waypoint smoothing produces smooth visual movement inside tile corridor.
- Fallback to turn-in-place if arc would violate occupancy.
- Tile reservation prevents two units from entering same tile simultaneously.
- Body footprint classes affect tile occupancy.
- Building footprints block unit movement.
- Isometric depth sorting is correct: units behind buildings render behind, units in front render above.
- Depth sorting handles large buildings by footprint, not sprite center.
- Arena combat vehicles use grid pathing (no more arcade movement).
- Territory does not block movement.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No damage/hit model changes (that is Step 07).
- No weapon balance changes.
- No changes to Arena AI behavior modes (passive, stationary_shooter, chaser, hold_position still function — they now use grid pathing instead of arcade movement).
- No economy changes.

**Manual QA focus**:
- Move harvester to resource. Verify grid pathing with smooth turns.
- Move combat vehicle across map. Verify grid pathing, physical turning, no overlap with other units.
- Place two units head-on. Verify they do not overlap; one waits/repaths.
- Place unit behind building. Verify it renders behind building.
- Place unit in front of building. Verify it renders above building.
- Move heavy body (Mammoth). Verify slow turn speed vs light body (Wasp) fast turn speed.
- In Arena: place chaser enemy. Verify it uses grid pathing toward ally.
- Verify waypoint smoothing looks smooth but stays within tile corridor.

**Why this step after Step 05**: Movement executes move commands. The command routing (Step 05) must define what a "move command" is before movement can implement how to execute it. Building footprints (Step 04) must exist for collision.

---

### STEP 07H+ — Combat Core / Targeting / Hit Model

**Risk**: High+

**Purpose**: Implement the accepted target-lock combat model with attack commands, weapon range bands, projected hit footprints, aim forgiveness, and point-blank assist. Make combat reliable and readable at all ranges.

**Player-visible result**: Player right-clicks enemy to issue attack command. Selected unit pathfinds toward target until within weapon range, then stops at appropriate distance. Turret aims at target (not mouse). Weapon fires when target is in range and turret is aimed. Hits are reliable — no point-blank misses, no "shot passes through" problems. Short-range weapons work up close. Splash damage is visible and understandable.

**Accepted mechanics included**:
- Attack command: RMB on enemy = attack command for selected units (Section 4).
- Target-lock: turret aims at target, not mouse (Section 6, Arena closure).
- minRange, idealRange, maxRange, stopDistance per weapon (Section 6).
- Attack command does not move unit to enemy center — unit moves to weapon-appropriate stop/ideal distance (Section 6).
- Short-range weapons do not require direct overlap (Section 6).
- If target too close, unit can reposition or weapon uses point-blank assist (Section 6).
- If target outside range, unit pathfinds toward target (Section 6).
- If target inside range, unit stops, turret aims, weapon fires (Section 6).
- Hits are not based only on thin pixel-perfect screen-space line (Section 6).
- Targets have projected hit footprint (Section 6).
- Weapons have hit tolerance / aim forgiveness (Section 6).
- Short-range weapons can use point-blank assist (Section 6).
- Railgun/beam/direct weapons hit projected target footprint with tolerance (Section 6).
- Shotgun/cone weapons use cone + target footprint (Section 6).
- Splash uses ground-plane projected radius (Section 6).
- No full 3D turret pitch simulation now (Section 6).
- Practical 2.5D forgiveness for low/high bodies (Section 6).
- S key clears target-lock (Section 4).

**Expected boundaries**:
- Implement attack command in command routing (from Step 05): RMB on enemy → set targetVehicleId → if out of range, pathfind toward → if in range, stop at stopDistance → turret aims → fire.
- Implement turret target-lock: turret tracks assigned target, not mouse position. turretTurnSpeed from weapon config (from Step 02). Turret does not snap.
- Implement minRange/idealRange/maxRange/stopDistance per weapon from config. Attack command uses stopDistance to determine where unit stops.
- Implement range check: is target within [minRange, maxRange]? If outside maxRange, pathfind closer. If inside minRange, reposition or use point-blank assist.
- Implement projected hit footprint: use `projectGroundRect` to create target footprint on ground plane. Hit detection checks against this footprint instead of screen-distance.
- Implement aim forgiveness: hit tolerance radius per weapon category. Larger for shotguns/cone, smaller for railgun/direct.
- Implement point-blank assist: if target is within minRange, auto-hit (weapon is touching the target).
- Implement cone hit detection using target footprint + cone angle (for Flamethrower, Freeze, Hammer).
- Implement splash hit detection using ground-plane projected radius (for Thunder).
- Implement 2.5D vertical forgiveness: different body heights (Dictator is taller, Wasp is shorter) do not cause misses. Apply practical tolerance.
- Update Arena AI: stationary_shooter, chaser, hold_position now use stopDistance and projected hit detection.
- No 3D turret pitch simulation.
- CAMERA_PROJECTION_CONTRACT.md respected for all projected geometry.

**Dependencies**: Step 02 (weapon config with range data, turretTurnSpeed). Step 05 (attack command routing). Step 06 (grid movement for pathfinding toward target, stopping at range).

**Acceptance criteria**:
- Attack command (RMB on enemy) works for all unit types.
- Unit pathfinds toward target if out of range, stops at stopDistance.
- Turret aims at target (not mouse). turretTurnSpeed from weapon config.
- Hits use projected hit footprint, not screen-distance.
- Aim forgiveness prevents near-misses from being counted as misses.
- Point-blank assist prevents misses at very close range.
- Cone weapons (Flamethrower, Freeze, Hammer) hit correctly using cone + target footprint.
- Splash weapons (Thunder) hit correctly using projected ground radius.
- Different body heights do not cause misses.
- S key clears target-lock.
- Arena AI modes use new combat model.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No weapon resource model changes (canister/overheat — that is Step 08).
- No body armor model changes (that is Step 08).
- No movement/pathfinding changes (already done in Step 06).
- No economy changes.

**Manual QA focus**:
- Attack enemy at long range. Verify unit moves to stopDistance and fires.
- Attack enemy at close range. Verify point-blank assist works.
- Attack enemy with Hammer at point-blank. Verify all pellets hit.
- Attack enemy with Railgun at max range. Verify hit with slight angle offset.
- Attack enemy with Flamethrower. Verify cone hits.
- Attack enemy with Thunder near allies. Verify splash (self-damage is expected).
- Verify turret tracks target, not mouse.
- Verify S key clears target-lock.
- Test with Wasp vs Mammoth (different heights). Verify no height-related misses.

**Why this step after Step 06**: Combat requires grid movement for pathfinding toward targets and stopping at range. Hit detection requires projected geometry which depends on correct unit positions from the movement system. Depth sorting (from Step 06) ensures visual consistency during combat.

---

### STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel

**Risk**: High+

**Purpose**: Implement the full accepted weapon mechanics (10 weapons, no Shaft) with per-weapon resource models (cooldown, wind-up, canister, overheat, magazine, drum), body mechanics with flat armor and mass-dependent recoil, M0-M3 scaling for weapons and bodies, and the hybrid animation API for procedural/blockout animation that is spritesheet-ready for the future.

**Player-visible result**: Every weapon plays differently — Смоки is reliable single-shot, Огнемёт streams with canister depletion, Вулкан spins up and overheats, Молот fires 3 volleys then reloads, Рельса has wind-up charge, Рикошет bounces with magazine. Bodies have distinct roles — Васп is fast and fragile, Мамонт is slow and armored. Armor reduces small hits but never makes a weapon useless. M0-M3 upgrades visibly improve weapons and bodies. Tracks animate while moving. Recoil is stronger on light bodies. No idle shaking.

**Accepted mechanics included**:

**Weapons (Section 7, 8)**:
- Смоки: cooldown, no critical, M0-M3 improve damage/cooldown/turretTurnSpeed, VFX: pale puff → denser/darker impact.
- Гром: cooldown splash, splash radius does NOT increase M0-M3, close range risky, M0-M3 improve damage/cooldown/turretTurnSpeed/impact readability.
- Рельса: wind-up charge before shot, visual: barrel glow → charge → shot → cooldown, long cooldown, slow turretTurnSpeed, penetration identity, M0-M3 improve damage/wind-up/cooldown/turretTurnSpeed, VFX: pale cyan → denser/stronger.
- Огнемёт: fuel canister, cone stream, ignite buildup, M0 hard to ignite quickly, M3 ignites quickly, M0-M3 improve damage/ignite/canister/drain/regen/turretTurnSpeed/VFX density.
- Фриз: freon canister, cone stream, freeze/slow buildup, cools burning allies, accelerates Vulcan cooling, high turretTurnSpeed, M0-M3 improve effectiveness/freeze/canister/drain/regen/turretTurnSpeed.
- Изида: energy canister, beam heals allies, auto-targets nearest ally, heal-only, M0-M3 improve heal/canister/drain/regen/turretTurnSpeed/beam readability.
- Вулкан: barrel spin-up, builds heat, overheat jams/penalizes, cools when not firing, reduced turretTurnSpeed while firing, Freeze accelerates cooling, M0-M3 improve damage/heat/cooling/overheat penalty/spin-up/turretTurnSpeed.
- Твинс: twin plasma, alternates barrels, high fire rate, projectile/plasma balls, small splash possible, no canister/overheat, near-continuous, M0-M3 improve damage/tempo/projectile speed/turretTurnSpeed.
- Рикошет: charge/magazine, limited stock regenerates, can fire partial, bounces from surfaces, self-hit risk deferred, M0-M3 improve damage/charge regen/magazine/bounce/turretTurnSpeed/VFX.
- Молот: drum/shotgun, 3 fast volleys then long reload, can fire partial, pellets spread in cone, one pellet ricochet deferred, M0-M3 improve damage/drum/reload/delay/turretTurnSpeed/VFX.

**Bodies (Section 9)**:
- 7 bodies with roles: Васп (fast scout/flanker), Хорнет (light raider), Хантер (universal baseline), Викинг (medium-heavy brawler), Диктатор (support/control platform), Титан (heavy frontline), Мамонт (super-heavy fortress).
- Armor: flat reduction + minimum damage floor. `finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)`.
- Mass: fixed per body. M0-M3 do NOT increase mass or recoil resistance.
- Recoil: `visualRecoil = weaponRecoil / bodyMass`. Visual recoil must not break tile occupancy.
- Body M0-M3: HP, armor, speed, acceleration, braking, bodyTurnSpeed. NOT mass, NOT recoil resistance, NOT footprint, NOT role.
- Footprint classes: Light (Wasp, Hornet), Medium (Hunter, Viking, Dictator), Heavy (Titan, Mammoth).

**Animation (Section 13)**:
- Hybrid animation API: procedural now, spritesheet-ready later. No one-off tied to current rectangles.
- Units accelerate, brake, turn through turn rate. Heavy turn slower.
- Tracks/wheels animate only while moving or turning. Standing = no animation.
- During turn-in-place, tracks can move in opposite directions.
- Animation speed depends on movement speed.
- Recoil is visual/body impulse, depends on weaponRecoil and bodyMass, does not break tile occupancy.
- Body and turret rotate separately. Turret has turretTurnSpeed from weapon config.
- Barrel/turret can have visual recoil.
- Standing unit: no jump/bob/shake, no dust, no track animation. Turret may turn only if target/command.
- Dust/track FX only while moving/turning. Heavier = stronger dust. Must not clutter.

**Expected boundaries**:

*Weapon mechanics implementation*:
- Implement canister model for Огнемёт, Фриз, Изида: pool, drain rate while firing, regen rate while not, minimum threshold before can fire again, UI charge bar.
- Implement overheat model for Вулкан: heat gauge, spin-up time, heat buildup per shot, cooling rate, overheat threshold, jam/penalty duration, cooling interaction with Freeze.
- Implement wind-up model for Рельса: barrel glow phase → charge phase → shot → cooldown phase. Visual sequence required.
- Implement magazine/charge model for Рикошет: limited stock, regeneration while not firing, can fire with partial stock.
- Implement drum model for Молот: 3 volleys, short delay between volleys, long reload after drum empty, partial magazine does not reload until reload cycle.
- Implement near-continuous model for Твинс: alternating barrels, no canister/overheat, projectile travel.
- Update damage system to support all weapon-specific mechanics (canister drain, overheat jam, wind-up delay, magazine stock, drum volleys).
- Implement M0-M3 scaling for all 10 weapons from config.
- Implement turretTurnSpeed per weapon and per M-level.
- Implement VFX color/density progression per weapon per M-level.

*Body mechanics implementation*:
- Implement flat armor reduction + minDamagePercent floor in damage calculation.
- Implement mass-dependent recoil: `visualRecoil = weaponRecoil / bodyMass`.
- Implement body M0-M3 scaling from config (HP, armor, speed, acceleration, braking, bodyTurnSpeed).
- Verify all 7 body roles are distinct and readable.

*Animation implementation*:
- Create hybrid animation API that abstracts vehicle visual state (idle, turning, moving, braking, firing, recoil, destroyed) and can be backed by either procedural Graphics or spritesheet frames.
- Implement track/wheel animation: animate only while moving/turning. Stop when idle. Speed proportional to movement speed. Opposite direction tracks during turn-in-place.
- Implement mass-dependent recoil visual: light bodies visually kick more than heavy bodies.
- Implement barrel/turret visual recoil.
- Implement dust/track FX: only while moving/turning. Heavier = stronger. Must not clutter.
- Implement idle rule: no bobbing, no shaking, no dust, no track animation when standing. Turret turns only with target/command.
- All animation must work with current procedural/blockout rendering and be designed for future spritesheet replacement.

**Dependencies**: Step 02 (weapon/body config with M0-M3 data). Step 05 (attack command). Step 06 (movement state machine, tile occupancy). Step 07 (hit model, range checking, target-lock).

**Acceptance criteria**:
- All 10 weapons have their accepted resource model working (cooldown, wind-up, canister, overheat, magazine, drum).
- Canister weapons show charge bar in HUD. Overheat weapon shows heat gauge.
- Wind-up (Рельса) has visible charge sequence before shot.
- Magazine (Рикошет) regenerates charges. Drum (Молот) fires 3 volleys then reloads.
- M0-M3 scaling works for all weapons (damage, turretTurnSpeed, profile-specific parameter).
- Flat armor reduces incoming damage. Minimum damage floor prevents 0-damage loops.
- Mass-dependent recoil: Wasp kicks noticeably, Mammoth barely moves.
- Body M0-M3 scaling works (HP, armor, speed, etc.). Mass does not change.
- Tracks animate while moving/turning. Stop when idle.
- Recoil visual scales with body mass.
- No idle bobbing/shaking/dust.
- Hybrid animation API is not hardwired to procedural rendering.
- `npm run typecheck && npm run test && npm run build && npm run qa:smoke` pass.

**What not to touch**:
- No Shaft weapon.
- No bot/AI beyond Arena modes.
- No active faction abilities.
- No new building types.
- No economy changes.

**Manual QA focus**:
- Test each weapon in Arena. Verify its resource model works (canister drains, overheat jams, wind-up charges, magazine regenerates, drum reloads).
- Test M0 vs M3 for each weapon. Verify damage, turret turn speed, and VFX progression.
- Test flat armor: Vulcan vs Mammoth (should deal reduced but non-zero damage), Railgun vs Mammoth (should deal full-ish damage after armor).
- Test mass-dependent recoil: Railgun on Wasp vs Railgun on Mammoth. Visual kick should be dramatically different.
- Test track animation: move unit → tracks animate. Stop → tracks stop. Turn in place → tracks move opposite.
- Test idle: standing unit should be completely still. No bobbing, no dust, no track movement.
- Test Freeze + Vulcan interaction: Freeze should accelerate Vulcan cooling.
- Test Изида: heal-only, auto-targets ally, canister drains and regenerates.

**Why this step last**: Weapon and body mechanics depend on the combat core (Step 07) being stable — hit detection, range checking, and target-lock must work before weapon-specific behaviors can be layered on top. Animation depends on the movement state machine (Step 06) providing correct movement states. This step brings all the pieces together into a complete combat and feel experience.

---

## 6. Roadmap step summary

| Step | Risk | Purpose | Dependencies | Player-visible result |
|------|------|---------|-------------|----------------------|
| 01H+ | High+ | UI / Localization / Start Flow / Faction Display | None | Russian UI, Industrial-only start, faction names, tooltips |
| 02H+ | High+ | Config and Data Model Foundation | 01 | Structured configs for weapons, bodies, factions, resources, buildings with M0-M3 |
| 03H+ | High+ | Industrial Map and Resource Layout | 01, 02 | 6 resource classes, fixed anchors, center infinite, strategic map structure |
| 04H+ | High+ | Buildings and Core Economy Loop | 01, 02, 03 | All core buildings functional, Russian names, clear statuses, economy readable |
| 05H+ | High+ | Unified RTS Controls and Command Routing | 01, 02 | LMB select, RMB command, S stop, Esc context, MMB camera |
| 06H+ | High+ | Movement / Occupancy / Depth Sorting | 02, 04, 05 | Grid pathing, waypoint smoothing, physical turns, no overlap, correct depth |
| 07H+ | High+ | Combat Core / Targeting / Hit Model | 02, 05, 06 | Attack command, target-lock, range bands, hit footprint, aim forgiveness |
| 08H+ | High+ | Weapons / Bodies / M0-M3 / Animation Feel | 02, 05, 06, 07 | All weapon mechanics, armor, recoil, M0-M3, track animation, no idle shake |

---

## 7. Global validation expectations

This roadmap PR is docs-only. No runtime validation is required for this PR.

For future implementation PRs derived from this roadmap, every PR must pass:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

Additional per-step validation:

- Step 01: Visual verification of Russian text layout in all menus and HUD.
- Step 02: Config structure tests — verify all required fields exist for each entity.
- Step 03: Map generation tests — verify anchor placement, resource class distribution, validation passes across 10+ seeds per map size.
- Step 04: Economy loop tests — verify full harvest → deposit → separate → build → produce cycle.
- Step 05: Input routing tests — verify LMB/RMB/S/Esc/MMB behavior for all unit types.
- Step 06: Movement tests — verify grid pathing, reservation, collision, depth sorting.
- Step 07: Combat tests — verify hit detection, aim forgiveness, point-blank assist.
- Step 08: Weapon mechanics tests — verify canister, overheat, wind-up, magazine, drum models.

---

## 8. Backlog

The following are explicitly not in this roadmap. They require separate intake/audit/roadmap in the future.

```text
- Shaft weapon (sniper mode, special aim, separate UI/camera/aiming model)
- Production bot roadmap
- Strategic AI
- Attack waves
- Enemy economy / base building
- Arena save/load setups
- Arena JSON import/export
- Active faction abilities
- Unique faction tech trees
- Final animation asset pipeline
- Mass asset generation
- Buildable walls/barriers
- Faction-specific buildings
- Minimap / fog expansion
- Full 3D turret pitch / ballistics
```

---

## 9. Next step after roadmap merge

After this roadmap is reviewed, accepted, and merged:

```text
Create a standard huge implementation/system audit based on this roadmap.
```

That audit must include:

```text
- Current code map: which files exist, what they do, what they touch
- Touched files/systems per roadmap step
- Risks and mitigation for each step
- Sequencing within each step (which PRs first, which can be parallel)
- Forbidden scope per step: what must NOT change
- Validation plan per step: automated + manual QA
- Manual QA plan per step
- PR-by-PR implementation recommendations
```

The audit is the bridge between this roadmap and actual implementation PRs. No implementation PR should be started before the audit for that step is reviewed and accepted.
