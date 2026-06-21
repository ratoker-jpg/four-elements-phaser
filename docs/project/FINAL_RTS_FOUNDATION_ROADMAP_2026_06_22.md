# FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md

Status: active roadmap  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-22

---

## 1. Purpose

This roadmap defines the full RTS foundation implementation sequence that must be completed **before** any Enemy AI work begins. It covers unit production, hull/turret selection and upgrades, map generation, builder placement, visual polish, and input hardening — everything a human player needs to play a complete early-game loop against no opponent.

The roadmap replaces the ad-hoc "NEXT-ROADMAP-DECISION" state and becomes the single active implementation queue until Phase 13 closes.

---

## 2. Non-negotiable constraints

```text
- Enemy AI attack/defense/scouting is NOT in this roadmap.
- No enemy wave plan.
- No enemy economy AI plan.
- No enemy defense AI plan.
- No runtime implementation before this roadmap is accepted.
- No assets changed before this roadmap is accepted.
- No configs changed before this roadmap is accepted.
- No tests changed before this roadmap is accepted.
- No dependency changes before this roadmap is accepted.
- No combined hull x turret production matrix.
- No startup preload of all modular vehicle assets.
- Do not reassign 1-9 away from control groups.
- Do not ignore CAMERA_PROJECTION_CONTRACT.md for shadows/ranges/ground markers.
- Do not reopen closed AoE4 UX work by inertia.
```

---

## 3. Prerequisite accepted work

This roadmap builds on the following closed/accepted cycles:

```text
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
Core Mechanics roadmap/audit cycle: CLOSED after PR #207.
MODULAR-RUNTIME-04A baseline: MERGED via PR #295.
VEHICLE-RENDER-UNIFY audit/roadmap: MERGED via PR #297.
VEHICLE-RENDER-UNIFY Stage 1-4: MERGED via PRs #298, #300, #302.
ARENA-VISUAL-COMBAT-FIX-01: MERGED via PR #304.
AoE4-inspired UX redesign slice: CLOSED after PR #319.
```

Do not continue any of these closed roadmaps by inertia.

---

## 4. Phase overview

| Phase | Name | Focus | Risk | PR count |
|-------|------|-------|------|----------|
| 0 | Roadmap/Audit only | This document + implementation audit | Low | 1 (docs) |
| 1 | Unit factory production foundation | Extend ProducibleUnitType, production code path for combat units | Medium | 1 |
| 2 | Hull + turret selection UI/model | Factory sub-screen to choose hull and turret | High | 1-2 |
| 3 | Hull upgrade model | Separate hull M0-M3 progression and purchase | Medium | 1 |
| 4 | Turret/weapon upgrade model | Separate turret M0-M3 progression and purchase | Medium | 1 |
| 5 | Unit cost, production time, queue and Russian tooltips | Full cost table, queue rules, Russian UI labels | Medium | 1 |
| 6 | Starting units and early-game loop | 2 harvesters, 1 builder, 1 Wasp+Smoky M0 at game start | Medium | 1 |
| 7 | Balanced mirrored map generation and obstacles/ruins | Symmetric map, richer obstacle types | High | 1-2 |
| 8 | Builder local construction placement | Builder builds near himself, not near HQ | Medium | 1 |
| 9 | Shadows for units/buildings respecting camera projection | Real projected shadows for all entity types | Medium | 1 |
| 10 | Movement feel: animations, start/stop inertia, dust | Tank movement inertia, dust VFX, no idle bobbing | Medium | 1 |
| 11 | Fullscreen, Russian UI hardening, browser hotkey isolation, control group clarity | F11, Ctrl+1-9 browser safety, group badges | Low-Medium | 1 |
| 12 | Final QA, balance draft, save/load compatibility, smoke/e2e scenarios | Integration QA, balance pass, save migration | Medium | 1 |
| 13 | Handoff gate for future separate Enemy AI roadmap | Closure + AI roadmap entry point | Low | 1 (docs) |

**Total estimated PRs: 13-16**

Phase ordering rationale:
- Phases 1-5 are data-model-first: production, selection, upgrades, costs — the player must be able to produce and upgrade units before anything else matters.
- Phase 6 depends on 1-5: starting units require the production model to exist.
- Phase 7 (map) is independent of 1-6 in code but should come before 8 (builder placement), because builder placement depends on valid map geometry.
- Phase 8 (builder placement) depends on 7 (map) for site validation and 1-5 for builder mechanics.
- Phase 9 (shadows) and 10 (movement feel) are visual polish that can be done after core gameplay works.
- Phase 11 (input/fullscreen) is low-risk hardening that can run in parallel with 9-10 if needed.
- Phase 12 is integration QA that requires all prior phases.
- Phase 13 closes the roadmap and hands off to Enemy AI.

---

## 5. Phase details

### Phase 0 — Roadmap/Audit only

**Scope**: This document and the companion `FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md`.

**Deliverables**:
- Roadmap document (this file).
- Implementation audit document.
- Docs-only PR. No runtime changes.

**Validation**: Docs-only PR, no runtime validation needed.

**Non-goals**: No code, no assets, no configs, no tests.

---

### Phase 1 — Unit factory production foundation

**Goal**: Extend the production system so that combat units (hull+turret combos) can be produced from the Units Factory, not just civil units.

**Current state**:
- `ProducibleUnitType` is `'builder' | 'harvester'` only.
- Combat unit costs are reserved constants (Wasp+Smoky: 45 matter, 10 elementUnits, 25s) but have no code path.
- Queue limit is 2.

**Implementation scope**:
1. Extend `ProducibleUnitType` to support combat unit identifiers. Use a structured key like `{hullId}:{turretId}` (e.g. `'wasp:smoky'`) rather than a flat string, to preserve the modular hull+turret model.
2. Add a `CombatUnitProductionConfig` type with hull, turret, and default M-level fields.
3. Extend `startUnitProduction()` to handle combat unit production entries with correct cost lookup, duration, and power consumption.
4. Extend `updateGameState.ts` production tick to process combat unit queue items through the same pipeline as civil units.
5. On production complete, create a `ModularCombatUnit` state object with the correct hull, turret, and M0 modification level.
6. Wire the "Units Factory" command card button to open a production sub-menu (the factory panel is expanded in Phase 2 with hull/turret selection).
7. Maintain queue limit rules: max 2 items per factory, cancellable.

**Key files to modify**:
- `src/state/types.ts` — extend `ProducibleUnitType`, add `CombatUnitProductionConfig`.
- `src/state/production.ts` — extend `startUnitProduction()`, `cancelFactoryQueueItem()`.
- `src/state/updateGameState.ts` — extend production tick for combat units.
- `src/state/construction.ts` — factory registration on build completion.
- `src/config/localization.ts` — Russian labels for combat unit production.
- `src/phaser/ui/hud/HudCommandPanel.ts` — factory panel entry point.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for combat unit production lifecycle (queue, tick, complete, cancel).
- Manual QA: build factory, produce Wasp+Smoky M0, verify unit spawns.

**Non-goals**:
- No hull/turret selection UI (Phase 2).
- No M1/M2/M3 production (Phase 3-4).
- No cost balance pass (Phase 5).
- No starting units (Phase 6).
- No Enemy AI.

---

### Phase 2 — Hull + turret selection UI/model

**Goal**: Players choose a hull and a turret separately inside the Units Factory production panel, following the accepted modular vehicle model (hull sprite separately + turret sprite separately + socket/pivot metadata).

**Current state**:
- `ArenaUnitComposer` has a body/weapon picker for arena mode.
- `hullTurretVisualProfiles.ts` has comprehensive visual profile data for 7 hulls and 10 turrets.
- No factory-side hull/turret selection UI exists.

**Implementation scope**:
1. Create a `FactoryProductionPanel` UI component that shows available hulls and turrets as separate selection columns.
2. Hull column: show hull name, icon/preview, base stats (HP, speed), cost modifier.
3. Turret column: show turret name, icon/preview, base stats (damage, cooldown, range), cost modifier.
4. Total cost and production time update dynamically as the player changes hull/turret selection.
5. Selected combination is the production request. Player clicks "Produce" to add to queue.
6. The panel respects the modular model: any legal hull+turret combination is allowed. There is no combined matrix and no restriction on which turret fits which hull.
7. Russian labels for all hull names, turret names, and panel strings via `localization.ts`.
8. Command card integration: "F" key opens factory panel. Panel shows queue status and available production slots.

**Key files to modify/create**:
- `src/phaser/ui/hud/FactoryProductionPanel.ts` — new component.
- `src/phaser/ui/hud/HudCommandPanel.ts` — wire factory panel open/close.
- `src/config/localization.ts` — Russian labels for factory panel.
- `src/state/types.ts` — factory panel state.
- `src/state/production.ts` — production request with hull+turret selection.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for selection state, cost computation.
- Manual QA: open factory, select hull+turret, verify cost, produce.

**Non-goals**:
- No upgrade selection (Phase 3-4).
- No combined hull x turret matrix.
- No full asset preload.
- No Arena changes.

---

### Phase 3 — Hull upgrade model

**Goal**: Separate hull upgrade model where players can upgrade a unit's hull from M0 to M1/M2/M3 independently of its turret.

**Current state**:
- `MLevelData<T>` and `ModificationLevel` type exist in `coreMechanicsTypes.ts`.
- `bodyData.ts` has full M0-M3 tuples for all 7 bodies (hp, speed, etc.).
- `m0m3Scaling.ts` has scaling helpers.
- Arena has a dev-only upgrade system (`blockoutUpgrades.ts`).
- No production-time M-level selection. No upgrade purchase for existing units.

**Implementation scope**:
1. Define `HullUpgradeConfig` with M0-M3 cost, duration, and stat deltas per hull type.
2. Add a hull upgrade action to the unit context/command card when a unit with an upgradable hull is selected.
3. Hull upgrade deducts resources, starts a timed upgrade process. On completion, unit's hull M-level increments and its stats update via `bodyData.ts` lookup.
4. Visual hull upgrade: the unit's hull sprite changes to the appropriate M-level asset if available, or stays at the current visual if M-level assets are not yet imported (graceful degradation, not a blocker).
5. Russian labels for upgrade actions, costs, and tooltips.

**Key files to modify**:
- `src/state/types.ts` — add `hullMod` field to `ModularCombatUnit`.
- `src/state/production.ts` or new `src/state/upgrades.ts` — hull upgrade logic.
- `src/config/bodyData.ts` — reference for M0-M3 stat lookup.
- `src/config/localization.ts` — Russian labels for hull upgrade.
- `src/phaser/ui/hud/HudCommandPanel.ts` — upgrade command in card.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for hull upgrade lifecycle (purchase, tick, complete, stat change).
- Manual QA: select tank, upgrade hull M0→M1, verify HP increase.

**Non-goals**:
- No turret upgrade (Phase 4).
- No factory M-level selection at production time (Phase 5).
- No visual asset import for all M-levels (that is the asset pipeline's job).

---

### Phase 4 — Turret/weapon upgrade model

**Goal**: Separate turret upgrade model where players can upgrade a unit's turret from M0 to M1/M2/M3 independently of its hull.

**Current state**:
- `weaponData.ts` has full M0-M3 tuples for all 10 weapons (damage, cooldown, range, etc.).
- Same scaling helpers as hull.
- No turret upgrade purchase for existing units.

**Implementation scope**:
1. Define `TurretUpgradeConfig` with M0-M3 cost, duration, and stat deltas per turret type.
2. Add a turret upgrade action to the unit context/command card when a unit with an upgradable turret is selected.
3. Turret upgrade deducts resources, starts a timed upgrade process. On completion, unit's turret M-level increments and its stats update via `weaponData.ts` lookup.
4. Visual turret upgrade: the unit's turret sprite changes to the appropriate M-level asset if available.
5. Hull and turret upgrades are fully independent. Upgrading hull M-level does not affect turret M-level and vice versa.
6. Russian labels for upgrade actions, costs, and tooltips.

**Key files to modify**:
- `src/state/types.ts` — add `turretMod` field to `ModularCombatUnit`.
- `src/state/upgrades.ts` — turret upgrade logic.
- `src/config/weaponData.ts` — reference for M0-M3 stat lookup.
- `src/config/localization.ts` — Russian labels for turret upgrade.
- `src/phaser/ui/hud/HudCommandPanel.ts` — upgrade command in card.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for turret upgrade lifecycle.
- Manual QA: select tank, upgrade turret M0→M1, verify damage increase.

**Non-goals**:
- No hull upgrade (already in Phase 3).
- No combined upgrade purchase.
- No visual asset import.

---

### Phase 5 — Unit cost, production time, queue and Russian tooltips

**Goal**: Complete the economic model with full cost tables, production times, queue rules, and comprehensive Russian UI labels/tooltips for every production and upgrade action.

**Current state**:
- Civil unit costs are defined (builder: 40 matter, 10 EU, 15s; harvester: 50 matter, 10 EU, 20s).
- Combat unit costs are placeholder constants only.
- Queue limit is 2 per factory.
- Russian localization has 200+ strings but is missing production-specific tooltip content.

**Implementation scope**:
1. Define a complete `UnitCostTable` for all producible combat unit configurations. Base cost = hull base cost + turret base cost. Each hull and turret has a base cost; the total is additive, not multiplicative.
2. Define production time as: base time = max(hull_time, turret_time) + assembly_offset. This prevents trivially fast production of light hulls with heavy turrets.
3. Define queue rules formally:
   - Max 2 items per factory.
   - Items process sequentially (first-in, first-out).
   - Player can cancel any item in the queue; cancelling the active item refunds full resources.
   - Queue slot becomes available immediately on completion or cancellation.
4. Define upgrade costs: M0→M1 costs X, M1→M2 costs Y, M2→M3 costs Z, scaling per hull/turret type.
5. Add comprehensive Russian tooltips for:
   - Each producible unit combination (hull + turret name, cost, time, base stats).
   - Each upgrade step (M0→M1, M1→M2, M2→M3, cost, time, stat change).
   - Queue status (item in progress, items waiting, time remaining).
   - Insufficient resource feedback (exact deficit in Russian).
6. Command card shows production and upgrade costs in Russian with clear formatting.

**Key files to modify**:
- `src/state/types.ts` — cost table types.
- `src/config/productionCosts.ts` — new file for complete cost/duration/queue tables.
- `src/state/production.ts` — use cost table instead of inline constants.
- `src/config/localization.ts` — add all missing Russian tooltip strings.
- `src/phaser/ui/hud/FactoryProductionPanel.ts` — display costs/tooltips.
- `src/phaser/ui/hud/HudCommandPanel.ts` — display costs/tooltips.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for cost computation, queue rules, refund logic.
- Manual QA: verify Russian tooltips display correctly for all production/upgrade actions.

**Non-goals**:
- No balance pass (Phase 12 does a draft balance).
- No Enemy AI economy.
- No multi-language support beyond Russian.

---

### Phase 6 — Starting units and early-game loop

**Goal**: When a new game starts, the player is given starting units: 2 harvesters, 1 builder, 1 starter tank (Wasp hull + Smoky turret, M0). This enables a complete early-game loop: harvest → build → produce → upgrade.

**Current state**:
- Game starts with HQ, some harvesters, and basic economy. Exact starting unit composition needs verification and adjustment.
- No starter combat unit spawns at game start.

**Implementation scope**:
1. Define `StartingUnitConfig` specifying exact starting units:
   - 2 harvester units.
   - 1 builder unit.
   - 1 combat unit: Wasp hull + Smoky turret, M0 modification.
2. On game initialization, spawn all starting units at valid positions near the player HQ.
3. Starter combat unit uses the modular vehicle system: hull sprite + turret sprite + socket/pivot metadata. It is not a special-cased unit type — it uses the same `ModularCombatUnit` as factory-produced units.
4. Starting units should be placed on walkable tiles adjacent to HQ, with collision avoidance between starting units.
5. Verify the early-game loop works end-to-end:
   - Harvesters gather resources → builder constructs factory → factory produces combat units → combat units can be selected and moved.
6. Starting unit positions should respect the mirrored map (Phase 7) so both players have equivalent starting conditions.

**Key files to modify**:
- `src/state/initialGameState.ts` or game initialization code — spawn starting units.
- `src/state/types.ts` — starting unit config type.
- `src/state/construction.ts` — verify builder can build immediately.
- `src/config/localization.ts` — any new strings for starting unit feedback.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for starting unit spawn, position validity.
- Manual QA: start new game, verify 4 starting units, verify early-game loop.

**Non-goals**:
- No enemy starting units (Enemy AI is separate).
- No balance pass for starting unit count (Phase 12).
- No map changes (Phase 7).

---

### Phase 7 — Balanced mirrored map generation and obstacles/ruins

**Goal**: Generate fair/mirrored maps where both players have equivalent resource access and starting positions, plus richer obstacle types that create tactical gameplay.

**Current state**:
- `generatedMap.ts` uses Mulberry32 PRNG, patch-based terrain, and 6-class resource anchors.
- No map mirroring or symmetry.
- `obstacles[]` and `decor[]` arrays are empty in generated maps.
- Arena has 4 blockout obstacle types (wall, crate, barrier, rock) with collision/line-of-fire logic.
- Production obstacle types (`mountain-small`, `mountain-medium`, etc.) exist in `types.ts` but have no generation or rendering.

**Implementation scope**:
1. **Mirrored map generation**:
   - Generate one half of the map (quadrant or half-plane), then mirror it to create a symmetric map.
   - Mirror operation: for each tile at (x, y), create a corresponding tile at (mirror_x, mirror_y) where the mirror axis runs through the map center.
   - Resource clusters must be mirrored so both sides have identical resource access.
   - Starting positions must be mirrored at equal distance from the center.
   - The center of the map may have shared/neutral resources or obstacles.

2. **Richer obstacle types**:
   - Rocks: impassable, block line of fire, medium visual footprint. Multiple sizes (small, medium, large rock clusters).
   - Industrial ruins: impassable or partially passable, block line of fire, large footprint. Former buildings or machinery.
   - Destroyed structures: impassable debris, block line of fire, irregular shape. Remnants of walls or fortifications.
   - Walls/debris: linear obstacles, block movement and line of fire. Can create corridors and choke points.
   - Tactical blockers: low walls or barriers that block movement but allow fire over them (for specific weapon types only — defer weapon-specific rules if complex).

3. **Obstacle generation in map gen**:
   - Populate the `obstacles[]` array in `generateMapData()` with placed obstacle instances.
   - Obstacles must be mirrored along with the map.
   - Obstacle placement must not block starter reachability (validated by `mapValidation.ts`).
   - Obstacle density should be configurable (sparse/medium/dense).

4. **Obstacle rendering**:
   - Use projected ground-plane shapes following `CAMERA_PROJECTION_CONTRACT.md`.
   - Blockout-style graphics primitives for initial implementation (colored shapes with labels).
   - Asset-based rendering can replace primitives later via the asset pipeline.

**Key files to modify/create**:
- `src/state/generatedMap.ts` — add mirror logic, populate obstacles.
- `src/config/mapGenConfig.ts` — new file for map generation parameters (symmetry mode, obstacle density).
- `src/state/mapValidation.ts` — validate mirrored maps.
- `src/state/blockoutObstacleState.ts` — extend with new obstacle types.
- `src/config/blockoutObstacleData.ts` — add new obstacle type configs.
- `src/phaser/render/BlockoutObstacleRenderer.ts` — render new obstacle types.
- `src/config/localization.ts` — Russian labels for obstacle/map generation options.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for map mirroring correctness (symmetry verification).
- Unit tests for obstacle placement not blocking starters.
- Manual QA: generate multiple maps, verify visual symmetry, verify obstacle rendering, verify pathfinding around obstacles.

**Non-goals**:
- No destructible obstacles (future feature).
- No obstacle health/damage model.
- No procedurally generated obstacle art (use blockout primitives).
- No Enemy AI pathfinding around obstacles (Enemy AI is separate).

---

### Phase 8 — Builder local construction placement

**Goal**: Builders construct buildings near themselves, not near HQ. The player moves a builder to a desired location, then the builder builds there.

**Current state**:
- `findBuildSiteNearPlayerBuildings()` finds the nearest valid site near existing player buildings.
- `assignIdleBuilders()` auto-assigns idle builders to construction sites.
- No direct player click-to-place. Placement is automatic.
- Comments explicitly state mouse/keyboard placement is intentionally not implemented.

**Implementation scope**:
1. **Builder-centric placement model**:
   - When a player selects a builder and chooses a building to construct, the build site is validated near the builder's current position, not near HQ or other buildings.
   - The builder must be within a configurable radius of the proposed site (e.g., 3 tiles) to start construction.
   - If the builder is too far, it moves toward the target location first, then begins construction when adjacent.

2. **Click-to-place preview**:
   - When the player activates "build mode" from the command card, a projected ground-plane preview follows the cursor.
   - Preview shows the building footprint projected via `CAMERA_PROJECTION_CONTRACT.md` — a diamond/parallelogram, not an axis-aligned rectangle.
   - Preview turns red when placement is invalid (occupied, out of bounds, no adjacent builder).
   - LMB confirms placement. RMB/Esc cancels.
   - The builder moves to the nearest valid adjacent tile and begins construction.

3. **Build site validation**:
   - `canPlaceBuilding()` checks: tile is buildable, not occupied, not blocked by obstacles, builder can reach adjacent tile.
   - Building must not overlap with existing buildings or obstacles.
   - Building must be on walkable terrain.

4. **Builder auto-assignment update**:
   - `assignIdleBuilders()` should prefer the nearest idle builder to each pending site, not just any idle builder.
   - Builders that are already on their way to a site should not be reassigned.

**Key files to modify**:
- `src/state/buildSiteSelection.ts` — change from `findBuildSiteNearPlayerBuildings()` to builder-centric logic.
- `src/state/construction.ts` — add click-to-place validation, builder proximity check.
- `src/state/builder.ts` — builder movement to construction site, auto-assignment improvements.
- `src/phaser/input/GameInputController.ts` — build mode input handling.
- `src/phaser/render/ConstructionRenderer.ts` — placement preview rendering.
- `src/config/localization.ts` — Russian labels for build mode feedback.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Unit tests for builder-centric site validation, proximity checks.
- Manual QA: select builder, click build, verify preview, place building, verify builder moves and constructs.

**Non-goals**:
- No changes to building types or costs.
- No build queue UI for multiple buildings.
- No blueprint/ghost system beyond simple preview.
- No Enemy AI builder behavior.

---

### Phase 9 — Shadows for units/buildings respecting camera projection

**Goal**: All units and buildings cast projected ground-plane shadows that respect the fixed isometric camera defined in `CAMERA_PROJECTION_CONTRACT.md`.

**Current state**:
- Vehicles have basic projected ground-plane shadow ellipses via `drawProjectedShadow()`.
- Shadow is a fixed south offset (0.15 tile units), no directional light, no blur.
- No building shadows exist.
- `CAMERA_PROJECTION_CONTRACT.md` explicitly forbids circular top-down shadows.

**Implementation scope**:
1. **Shadow model**:
   - Define a consistent light direction (e.g., from NW at a fixed elevation angle). This light direction is the same for all entities and never changes at runtime.
   - For each entity, compute a shadow projection: offset from anchor point in the direction opposite the light, scaled by entity height.
   - Shadow shape is a projected ground-plane shape (not a circle): vehicles use projected ellipses, buildings use projected parallelograms matching their footprint.

2. **Vehicle shadows (upgrade)**:
   - Replace the current fixed-offset shadow with light-direction-based offset.
   - Hull height determines shadow offset distance. Taller units cast longer shadows.
   - Shadow shape remains a projected ellipse but is offset based on light direction.
   - Shadow alpha varies with entity type (vehicles: 0.25, buildings: 0.3).

3. **Building shadows**:
   - Each building type has a defined shadow footprint based on its collision footprint and height.
   - Shadow is a projected parallelogram on the ground plane, offset by light direction × building height.
   - Large buildings (HQ, factory) cast proportionally larger shadows.

4. **Shadow rendering**:
   - Shadows render at a depth layer below all entities but above terrain (current depth 95 is reasonable).
   - Shadows are semi-transparent fills with no blur (Phaser Graphics primitives).
   - Multiple overlapping shadows merge visually through alpha blending.
   - No per-pixel shadow mapping — this is a 2.5D isometric game, not a 3D engine.

5. **Respect camera projection**:
   - All shadow offsets and shapes must use `projectGroundPoint()` and `projectGroundRect()` from `cameraProjectionContract.ts`.
   - No screen-space circle shadows.
   - No top-down shadow assumptions.

**Key files to modify**:
- `src/phaser/render/projectedGroundPrimitives.ts` — extend shadow drawing with light direction.
- `src/phaser/render/BlockoutVehicleRenderer.ts` — update vehicle shadow to use light direction.
- `src/phaser/render/ConstructionRenderer.ts` — add building shadows.
- `src/config/cameraProjectionContract.ts` — may need shadow-specific helpers.
- `src/config/shadowConfig.ts` — new file for light direction, shadow parameters.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Visual QA: verify shadows project correctly on isometric ground plane.
- Verify no circular top-down shadows.
- Verify building shadows are visible and correctly positioned.
- Verify shadows do not cause z-depth sorting issues.

**Non-goals**:
- No dynamic light direction (fixed light).
- No per-pixel shadow mapping.
- No shadow blur/soft shadows.
- No shadow LOD or culling optimization.
- No shadow changes in Arena (Arena has its own visual baseline).

---

### Phase 10 — Movement feel: animations, start/stop inertia, dust

**Goal**: Tank and unit movement feels responsive and physical with start inertia, stop inertia, movement dust, directional animation, and no idle bobbing.

**Current state**:
- Grid movement FSM has 11 phases with acceleration/braking curves.
- `trackAnimation.ts` provides sprite-sheet-ready track animation state.
- `motionFx.ts` and `UnitMotionFxRenderer.ts` handle dust particles per unit type.
- Dust profiles defined for tanks (heavy) but tanks are static in arena.
- No true physics-based inertia — acceleration/braking curves approximate it.
- No idle bobbing exists (good — enforce this).

**Implementation scope**:
1. **Start inertia**:
   - When a unit receives a move command, it accelerates from zero to cruising speed over a configurable duration (per body type).
   - Light hulls (Wasp, Hornet) accelerate faster than heavy hulls (Titan, Mammoth).
   - During acceleration, the unit's movement speed ramps up smoothly. No instant full-speed jumps.
   - Use the existing acceleration curves in `blockoutMovementData.ts` and the movement FSM.

2. **Stop inertia**:
   - When a unit reaches its destination or is given a stop command, it decelerates smoothly from cruising speed to zero.
   - Heavier units have longer stopping distances.
   - During deceleration, the unit continues moving forward for a short distance before stopping.
   - No instant stop unless the unit is already at very low speed.

3. **Tank dust**:
   - Heavy dust trail when a tank is moving at cruising speed.
   - Lighter dust during acceleration/deceleration.
   - No dust when stationary.
   - Use existing `UnitMotionFxRenderer` and `motionFx.ts` dust profiles.
   - Dust should scale with speed: alpha and radius increase as the unit accelerates.

4. **Animation**:
   - Units play directional walk/track animation while moving.
   - Animation speed correlates with movement speed (faster movement = faster animation cycle).
   - Turret tracks target independently of hull direction while moving (already implemented for arena).

5. **No idle bobbing**:
   - Units do not bob, bounce, or oscillate when stationary.
   - Static idle state is clean and stable.
   - This is the current behavior and must be preserved.

**Key files to modify**:
- `src/state/movementStateMachine.ts` — ensure smooth acceleration/deceleration curves for all unit types.
- `src/state/blockoutMovement.ts` — arena vehicle movement with inertia.
- `src/config/blockoutMovementData.ts` — per-body acceleration/braking curves.
- `src/state/motionFx.ts` — dust alpha/radius scaling with speed.
- `src/phaser/render/UnitMotionFxRenderer.ts` — dust rendering updates.
- `src/state/trackAnimation.ts` — animation speed correlation.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Visual QA: move tanks around, verify smooth start/stop, dust trails, no bobbing.
- Verify light hulls accelerate faster than heavy hulls.
- Verify dust scales with speed.

**Non-goals**:
- No arcade physics engine.
- No suspension/bounce physics.
- No track marks on terrain.
- No engine sound effects.
- No idle animation cycles (no bobbing, no idle sway).

---

### Phase 11 — Fullscreen, Russian UI hardening, browser hotkey isolation, control group clarity

**Goal**: Add fullscreen support, ensure all Russian UI labels are consistent and complete, handle browser hotkey conflicts for Ctrl+1-9, and improve control group UI clarity.

**Current state**:
- No fullscreen toggle exists. `Phaser.Scale.EXPAND` fills the container but does not enter browser fullscreen.
- Russian localization is comprehensive (200+ strings) but may have gaps for new production/upgrade features.
- Ctrl+1-9 assigns control groups in-game, but browsers may intercept Ctrl+number for tab switching.
- Control group badges/indicators may not be clearly visible on selected units.

**Implementation scope**:
1. **Fullscreen support**:
   - Add a fullscreen toggle button in the HUD or accessible via F11 key.
   - Use `document.documentElement.requestFullscreen()` / `document.exitFullscreen()` browser API.
   - Phaser scale mode should adapt when entering/exiting fullscreen.
   - Remember fullscreen preference in localStorage.

2. **Russian UI hardening**:
   - Audit all UI surfaces for missing Russian labels (especially new production/upgrade tooltips from Phases 2-5).
   - Ensure all button labels, tooltips, status messages, and error feedback are in Russian.
   - No English-only strings in user-facing UI. English keys are internal IDs only.
   - Verify Russian text renders correctly at all supported resolutions (1280x720 minimum).

3. **Browser hotkey conflict handling**:
   - Ctrl+1-9 in most browsers switches to the Nth tab. The game must `preventDefault()` on these key combinations when the game canvas is focused.
   - Add explicit `event.preventDefault()` for Ctrl+1 through Ctrl+9 in the keydown handler.
   - Also prevent default for Ctrl+Shift+1-9 if browsers use that combination.
   - F11 for fullscreen must also prevent browser default (native fullscreen toggle).
   - Ensure the game captures keyboard input when the canvas is focused and releases it when the canvas loses focus (e.g., user clicks outside the game).

4. **Control group UI clarity**:
   - When a unit belongs to a control group, display a small group badge on the unit's selection indicator (e.g., "1", "2", etc.).
   - In the HUD selection panel, show which control group(s) each selected unit belongs to.
   - When a control group is recalled (1-9 key), briefly highlight all units in that group.
   - When assigning a control group (Ctrl+1-9), show brief feedback confirming the assignment with the group number.

**Key files to modify**:
- `src/config/gameConfig.ts` — fullscreen scale integration.
- `src/phaser/input/GameInputController.ts` — preventDefault for Ctrl+1-9, F11.
- `src/phaser/ui/hud/VisualHudCore.ts` — fullscreen button, group badges.
- `src/phaser/ui/hud/HudSelectionPanel.ts` — group membership display.
- `src/config/localization.ts` — fill any Russian label gaps.
- `src/state/controlGroups.ts` — group badge data.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Manual QA: F11 toggles fullscreen. Ctrl+1-9 does not switch browser tabs when game is focused. Russian labels are complete. Group badges are visible.

**Non-goals**:
- No multi-language support (Russian only).
- No custom key binding UI.
- No keyboard layout detection.
- No changes to control group hotkey mapping (1-9 stays as groups).

---

### Phase 12 — Final QA, balance draft, save/load compatibility, smoke/e2e scenarios

**Goal**: Integration QA across all prior phases, a draft balance pass, save/load compatibility verification, and comprehensive smoke/e2e test scenarios.

**Implementation scope**:
1. **Integration QA**:
   - Full playthrough from game start to mid-game: start → harvest → build factory → produce combat units → upgrade units → move/attack with units.
   - Verify no regressions in existing systems (fog, minimap, HUD, selection, control groups, command card).
   - Verify Arena mode still works independently.
   - Verify no broken modular vehicles.
   - Verify no debug artifacts in production mode.

2. **Balance draft**:
   - Review all production costs, upgrade costs, production times, and starting unit composition.
   - Target: a playable early-game loop where the player can reach mid-game within ~10 minutes without stalling.
   - This is a draft, not final balance. Numbers may be adjusted after playtesting.
   - Document balance rationale in a `BALANCE_DRAFT.md` or equivalent.

3. **Save/load compatibility**:
   - Verify save/load works with new production queue state, upgrade state, starting unit state, and mirrored map state.
   - Add migration path if save format changes (version field, field defaults for missing data).
   - Test: save game with active production queue, load, verify queue state preserved.
   - Test: save game with upgraded units, load, verify M-level preserved.

4. **Smoke/e2e scenarios**:
   - Automated smoke test covering: game start, build building, produce unit, upgrade unit, move unit, save game, load game.
   - Verify no crashes, no console errors, no stuck states.
   - Verify fog/vision still works with new units.
   - Verify minimap shows new unit types and building types.

**Key files to modify**:
- `src/state/saveLoad.ts` or equivalent — save format migration.
- `src/config/productionCosts.ts` — balance adjustments.
- `src/__tests__/` — integration/smoke test scenarios.
- `BALANCE_DRAFT.md` — balance rationale documentation.

**Validation**:
- `npm run typecheck && npm run test && npm run build`
- Full manual QA pass.
- Save/load round-trip test.
- Balance draft review by Denis.

**Non-goals**:
- No final balance (draft only).
- No multiplayer balancing.
- No AI opponent balancing.
- No performance optimization pass (separate concern).

---

### Phase 13 — Handoff gate for future separate Enemy AI roadmap

**Goal**: Close this roadmap and prepare the handoff point for the future Enemy AI roadmap. The Enemy AI roadmap is a separate, independent roadmap that will be planned after this one closes.

**Implementation scope**:
1. Mark this roadmap as CLOSED.
2. Update `PROJECT_STATE.md` and `CURRENT_NEXT_STEP.md` to reflect closed RTS Foundation roadmap.
3. Document the handoff point: what systems exist, what interfaces the Enemy AI roadmap can hook into (production system, upgrade system, map generation, movement, combat).
4. Create a skeleton Enemy AI roadmap document that lists high-level areas (scouting, attack planning, defense positioning, economy management) without any implementation details or timing commitments.
5. The handoff document explicitly states: Enemy AI attack/defense/scouting is a separate roadmap and must not be implemented until that roadmap is accepted.

**Deliverables**:
- Updated `PROJECT_STATE.md`.
- Updated `CURRENT_NEXT_STEP.md`.
- `ENEMY_AI_ROADMAP_SKELETON.md` (outline only, no implementation).
- This roadmap marked CLOSED.

**Validation**: Docs-only. No runtime validation.

**Non-goals**:
- No Enemy AI implementation.
- No Enemy AI audit (separate task when that roadmap is planned).
- No Enemy AI code of any kind.

---

## 6. Dependency graph

```text
Phase 0 ──> Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4 ──> Phase 5
                                                        │
                                                        v
                                                      Phase 6
                                                        │
Phase 7 ──────────────────────────────────────────> Phase 8
    │                                                 │
    v                                                 v
Phase 9 ──> Phase 10 ──> Phase 11 ──> Phase 12 ──> Phase 13
```

Parallelism opportunities:
- Phase 7 (map) is independent of Phases 1-6 in code and can start in parallel.
- Phase 9 (shadows) and Phase 10 (movement feel) are independent and can run in parallel.
- Phase 11 (input/fullscreen) is low-risk and can overlap with Phases 9-10.

Critical path: Phase 1 → 2 → 3 → 4 → 5 → 6 → 8 → 12 → 13

---

## 7. Risk register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Hull/turret selection UI is complex to design for isometric view | High | Start with simple list UI, iterate based on Denis feedback. Use ArenaUnitComposer as reference. |
| Map mirroring breaks existing map generation assumptions | Medium | Implement mirroring as a post-processing step on a half-generated map. Validate with symmetry tests. |
| Production cost balance is wrong on first pass | Low | Phase 12 is a draft balance pass. Numbers are tunable via config without code changes. |
| Ctrl+1-9 browser conflict is not fully resolvable | Low | Test in Chrome, Firefox, Edge. Use `preventDefault()` + `stopPropagation()`. Document any remaining edge cases. |
| Building shadows cause z-depth sorting issues | Medium | Render shadows at a dedicated depth layer below all entities. Test with multiple overlapping buildings. |
| Save format migration breaks old saves | Medium | Version field + default values for missing fields. Test migration explicitly. |
| M-level visual assets not available for all hulls/turrets | Low | Graceful degradation: show M0 visual if higher M-level asset is missing. Not a blocker. |

---

## 8. Validation requirements

For every implementation PR in this roadmap:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
git diff --check
secret/token scan
```

If build/Playwright is blocked in the execution environment, report honestly and check GitHub Actions directly.

For docs-only PRs (Phase 0, Phase 13), no runtime validation is needed.

---

## 9. Manual QA gates

Before merging any implementation PR in this roadmap:

```text
- Default game mode boots without errors.
- Arena mode still boots.
- No default debug artifacts.
- No broken modular vehicles.
- No regression to #304 accepted Arena visuals.
- No silent cyan recolor.
- No full modular matrix preload.
- No old Wasp M0 preload.
- HUD/minimap/command layout approved by Denis when touched.
- Russian labels are correct and complete for new features.
- No fog/vision regression.
- No control group regression.
```

---

## 10. Closure criteria

This roadmap is CLOSED when:

1. All Phases 0-13 are complete and merged.
2. Denis has accepted the final QA pass (Phase 12).
3. `PROJECT_STATE.md` and `CURRENT_NEXT_STEP.md` are updated.
4. The Enemy AI roadmap skeleton exists (Phase 13).
5. No open blockers or regressions from this roadmap's changes.

After closure, any issues found should become focused fixup PRs, not a continuation of this roadmap by inertia.
