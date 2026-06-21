# FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md

Status: proposed / pending Denis+GPT acceptance
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-22

---

## 1. Purpose

This document audits the current implementation state of the Four Elements Phaser repository against the requirements of the RTS Foundation Roadmap (`FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md`). For each roadmap topic, it identifies what exists, what is missing, what must be built, and what risks exist.

This audit is the baseline reference for all implementation work in the RTS Foundation roadmap, once accepted. It should not be re-derived for each phase — phases should reference this audit and update it only if facts change. Until the roadmap is accepted by Denis and GPT, this audit is a proposal and implementation facts should be re-validated before any code work begins.

---

## 2. Repository facts

```text
Source files:     119 .ts files in src/       (reported from prior repo scan)
Test files:       107 test files               (reported from prior repo scan)
Total tests:      ~5253                        (previously observed, needs validation)
Passing:          ~5225                        (previously observed, needs validation)
Failing:          ~28                          (previously observed, needs validation)
Phaser version:   4.1.0                        (verified in package.json)
Build system:     Vite                         (verified)
Renderer:         WebGL-only (no Canvas fallback)
Camera:           Fixed isometric / axonometric 2.5D
```

Note: Test counts were observed during a prior automated scan and have not been re-validated for this audit. Before any implementation phase begins, run `npm test` and record the actual current count. Known pre-existing test failures previously observed in `blockoutDamage`, `blockoutObstacles`, `coreEconomyLoop` — these predated the AoE4 UX work and were not regressions. Re-verify before implementation.

---

## 3. Audit by roadmap topic

### 3.1 Unit factory production

**What exists**:
- `src/state/production.ts` — `startUnitProduction()`, `cancelFactoryQueueItem()`, cost lookups, production tick.
- `src/state/types.ts` — `UnitFactoryRuntimeState`, `ProductionQueueItem`, `ProducibleUnitType`.
- `src/state/construction.ts` — Factory registration on build completion.
- Queue limit: 2 items per factory.
- Production tick + power allocation in `updateGameState.ts`.

**Current `ProducibleUnitType`**: `'builder' | 'harvester'` only.

**Combat unit production**: Reserved cost constants exist (Wasp+Smoky: 45 matter, 10 EU, 25s) but **no code path**. The `startUnitProduction()` function only handles civil units. When a combat unit completes production, there is no code to create a `ModularCombatUnit` state object.

**Cost table (current)**:
| Unit | Matter | ElementUnits | Duration |
|------|--------|-------------|----------|
| Builder | 40 | 10 | 15s |
| Harvester | 50 | 10 | 20s |
| Wasp+Smoky (reserved) | 45 | 10 | 25s |

**What must be built (Phase 2)**:
- Extend `ProducibleUnitType` to support combat unit keys (e.g., `{hullId}:{turretId}`).
- Add `CombatUnitProductionConfig` type.
- Extend `startUnitProduction()` for combat units.
- Extend `updateGameState.ts` production tick for combat unit completion.
- On completion, create `ModularCombatUnit` with correct hull, turret, M0.
- Wire factory command card button to production sub-menu.

**Risk**: Medium. The production system is well-structured for extension, but the combat unit creation path involves multiple state systems (unit state, occupancy, render registration).

---

### 3.2 Hull + turret selection

**What exists**:
- `src/config/hullTurretVisualProfiles.ts` — `HullVisualProfile`, `TurretVisualProfile`, `SocketProfile`, `PivotProfile`, `UpgradeLevelProfile`.
- `src/config/hullVisualProfiles.ts` — Per-hull `visualOffsetPx`, `ringScale` for 7 hulls (Wasp, Hornet, Hunter, Viking, Dictator, Titan, Mammoth).
- `src/config/turretAttachmentMath.ts` — Turret-to-socket attachment computation.
- `src/config/directionalTurretProfiles.ts` — Per-direction turret pivot recovery.
- `src/config/visualDirectionRemap.ts` — Direction remapping per hull/turret PNG family.
- `src/phaser/ui/ArenaUnitComposer.ts` — Arena body/weapon/team picker UI (reference implementation).
- `src/config/blockoutProfiles.ts` — Body/weapon ID types and profile data.
- `src/config/bodyData.ts` — 7 body configs with M0-M3 data.
- `src/config/weaponData.ts` — 10 weapon configs with M0-M3 data.

**What is missing**:
- No factory-side hull/turret selection UI.
- No `FactoryProductionPanel` component.
- No dynamic cost computation for hull+turret combinations.
- No production request model that carries hull+turret selection.

**What must be built (Phase 3)**:
- `FactoryProductionPanel` UI with hull column, turret column, cost display, "Produce" button.
- Production request model with selected hull + turret.
- Dynamic cost/time computation from hull base cost + turret base cost.
- Russian labels for all factory panel strings.

**Risk**: High. This is the most complex UI component in the roadmap. The `ArenaUnitComposer` provides a reference, but the factory panel has different requirements (cost display, queue integration, production constraints). The modular vehicle model is well-established, so the data layer is solid; the risk is primarily in UX design and iteration.

---

### 3.3 Hull upgrades (M0-M3)

**What exists**:
- `src/config/coreMechanicsTypes.ts` — `MLevelData<T>`, `ModificationLevel` (0|1|2|3).
- `src/config/m0m3Scaling.ts` — `getMLevelValue()`, `clampModificationLevel()`, validation helpers.
- `src/config/bodyData.ts` — Full M0-M3 tuples for all 7 bodies (hp, speed, mass, etc.).
- `src/state/blockoutUpgrades.ts` — Arena dev-only upgrade system (5 upgrade types, maxLevel 3).
- `src/phaser/render/BlockoutUpgradeRenderer.ts` — Visual upgrade markers.

**What is missing**:
- No `hullMod` field on `ModularCombatUnit` (currently `mod: 'm0'` hardcoded).
- No hull upgrade purchase action in command card.
- No hull upgrade cost/duration config.
- No hull upgrade lifecycle (purchase → timer → complete → stat update).
- No visual hull upgrade (M-level sprite swap).

**What must be built (Phase 4)**:
- `HullUpgradeConfig` with M0-M3 cost, duration, stat deltas per hull.
- `hullMod` field on `ModularCombatUnit`.
- Hull upgrade action in command card.
- Hull upgrade lifecycle: purchase, timed process, completion, stat update.
- Visual M-level swap (graceful degradation if assets not available).
- Russian labels.

**Risk**: Medium. The data model exists; the gap is the upgrade purchase lifecycle and command card integration. The arena upgrade system provides a partial reference but is dev-only and not production-quality.

---

### 3.4 Turret/weapon upgrades (M0-M3)

**What exists**:
- `src/config/weaponData.ts` — Full M0-M3 tuples for all 10 weapons (damage, cooldown, range, turretTurnSpeed, etc.).
- Same scaling helpers as hull.

**What is missing**:
- No `turretMod` field on `ModularCombatUnit` (currently `mod: 'm0'` hardcoded for entire unit).
- No turret upgrade purchase action.
- No turret upgrade cost/duration config.
- No turret upgrade lifecycle.
- No visual turret upgrade (M-level sprite swap).

**What must be built (Phase 5)**:
- `TurretUpgradeConfig` with M0-M3 cost, duration, stat deltas per turret.
- `turretMod` field on `ModularCombatUnit` (independent of `hullMod`).
- Turret upgrade action in command card.
- Turret upgrade lifecycle.
- Visual M-level swap.
- Russian labels.

**Risk**: Medium. Very similar to Phase 4. If Phase 4 establishes the upgrade lifecycle pattern well, Phase 5 should be straightforward by analogy.

---

### 3.5 Unit cost, production time, queue rules

**What exists**:
- Civil unit costs are defined inline in `types.ts` and `production.ts`.
- Queue limit: 2 per factory, FIFO, cancellable.
- Combat unit costs are placeholder constants.

**What is missing**:
- No structured `UnitCostTable` for all combat unit configurations.
- No additive cost model (hull base + turret base).
- No production time formula (max(hull_time, turret_time) + offset).
- No formal queue rule documentation beyond code comments.
- No upgrade cost tables.
- No comprehensive Russian tooltips for production/upgrade costs.

**What must be built (Phase 6)**:
- `src/config/productionCosts.ts` — complete cost/duration/queue tables.
- Additive cost computation.
- Production time formula.
- Formal queue rules with refund logic.
- Upgrade cost tables for M0-M3 hull and turret upgrades.
- Comprehensive Russian tooltips.

**Risk**: Medium. The math is straightforward but the Russian tooltip content is substantial (7 hulls × 10 turrets × M0-M3 × production + upgrade = many string entries).

---

### 3.6 Starting units

**What exists**:
- Game initialization spawns HQ, harvesters, and basic economy.
- `src/state/initialGameState.ts` or equivalent handles unit spawn.

**What is missing**:
- No starter combat unit (Wasp + Smoky M0) at game start.
- No `StartingUnitConfig` type.
- Starting positions may not be validated against mirrored maps.

**What must be built (Phase 7)**:
- `StartingUnitConfig`: 2 harvesters, 1 builder, 1 Wasp+Smoky M0.
- Spawn logic for starter combat unit using modular vehicle system.
- Position validation near HQ, collision avoidance between starting units.
- Early playable loop verification (harvest → build → produce → move).

**Dependency note**: Phase 7 does NOT depend on Phase 8 (mirrored maps). Starting units work on the current map generator. Phase 8 will later re-validate positions against mirrored layouts as a follow-up.

**Risk**: Medium. The modular vehicle system already handles combat unit creation. The gap is initialization code and position logic.

---

### 3.7 Mirrored map generation and obstacles

**What exists**:
- `src/state/generatedMap.ts` (756 lines) — `generateMapData()`, Mulberry32 PRNG, patch-based terrain, 6-class resource anchors, map validation.
- `src/state/mapValidation.ts` — Starter reachability, resource count checks.
- `src/config/resourceAnchors.ts` — 6-class anchor positions per map size.
- `src/state/terrainClustering.ts` — Patch-based terrain generation.
- Arena obstacle system: `src/state/blockoutObstacles.ts`, `blockoutObstacleState.ts`, `blockoutObstacleData.ts`, `BlockoutObstacleRenderer.ts`.
- 4 blockout obstacle types: wall, crate, barrier, rock.
- Collision/line-of-fire logic: `lineIntersectsRect()`, `lineIntersectsCircle()`, `findNearestObstacleBlockingLine()`, `isLineOfFireBlocked()`, `resolveVehicleObstacleCollisions()`.
- Production obstacle types in `types.ts`: `mountain-small`, `mountain-medium`, etc. — defined but no generation or rendering.

**What is missing**:
- **No map mirroring/symmetry**. Maps are generated asymmetrically.
- **No production map obstacles**. `obstacles[]` and `decor[]` arrays are empty in generated maps.
- No industrial ruins, destroyed structures, debris/walls obstacle types.
- No obstacle generation in `generateMapData()`.
- No obstacle rendering for production maps (only arena blockout rendering).
- No mirrored resource placement.

**What must be built (Phase 8)**:
- Map mirroring: generate half-map, mirror to create symmetric full map.
- Mirrored resource clusters and starting positions.
- New obstacle types: rocks, industrial ruins, destroyed structures, walls/debris, tactical blockers.
- Obstacle generation in `generateMapData()` with mirroring.
- Obstacle rendering for production maps (blockout primitives).
- Obstacle placement validation (not blocking starters).
- Configurable obstacle density.

**Risk**: High. Map generation is the most architecturally complex part of this roadmap. Mirroring must work correctly for competitive fairness, and obstacle placement must not break pathfinding or starter reachability. The existing `generatedMap.ts` is 756 lines and will need significant extension.

---

### 3.8 Builder local construction placement

**What exists**:
- `src/state/builder.ts` — `assignIdleBuilders()`, `updateBuilders()`, `releaseBuilder()`.
- `src/state/construction.ts` — `canPlaceBuilding()`, `placeConstructionSite()`, `updateConstructionSiteProgress()`, `BUILDING_CONFIG`.
- `src/state/buildSiteSelection.ts` — `findBuildSiteNearPlayerBuildings()` with gap rules and anchor proximity.
- `src/state/occupancy.ts` — `buildOccupancyMap()`, `isBuildable()`.
- `src/phaser/render/ConstructionRenderer.ts` — Progress bar, builder sprite, site visualization.
- `src/assets/buildingPlacementMeta.ts` — Building placement metadata.

**What is missing**:
- **No click-to-place**. Placement is automatic via `findBuildSiteNearPlayerBuildings()`.
- **No placement preview**. No projected ground-plane ghost following the cursor.
- No builder-centric site selection (current logic prefers sites near player buildings, not near the builder).
- No build mode input handling.

**Denis approval gate**: Phase 9 changes the builder placement model from auto-site-selection (near HQ/existing buildings) to player click-to-place (near builder). This is a significant UX change. Phase 9 implementation must not begin until Denis has explicitly approved the click-to-place interaction model. If Denis prefers to keep auto-placement for now, Phase 9 should be deferred or its scope reduced to builder-proximity validation only (no click-to-place preview).

**What must be built (Phase 9)**:
- Builder-centric placement model: site validation near builder, not near HQ.
- Click-to-place preview: projected ground-plane diamond following cursor (using `CAMERA_PROJECTION_CONTRACT.md`).
- Validity feedback (red preview for invalid placement).
- Build mode input handling (LMB confirm, RMB/Esc cancel).
- Builder movement to adjacent site before construction begins.
- Auto-assignment improvement (nearest idle builder to site).

**Risk**: Medium. The construction system is well-structured; the gap is the input handling and preview rendering. The `CAMERA_PROJECTION_CONTRACT.md` ground-plane projection functions are already available. However, the UX model change requires Denis approval before implementation.

---

### 3.9 Shadows

**What exists**:
- `src/phaser/render/projectedGroundPrimitives.ts` — `drawProjectedShadow()` — projected ground-plane shadow ellipse.
- `src/phaser/render/BlockoutVehicleRenderer.ts` — Vehicle shadows at depth 95, `SHADOW_RADIUS_FRACTION = 0.7`, fixed south offset 0.15 tile units.
- `src/config/cameraProjectionContract.ts` — Projection math used by shadow rendering.

**What is missing**:
- **No building shadows**.
- No light direction model (shadows use fixed south offset, no directional light).
- No shadow offset based on entity height.
- No shadow shape variation (all shadows are identical ellipses).
- No shadow alpha variation by entity type.

**What must be built (Phase 10)**:
- Consistent light direction model (fixed direction, e.g., from NW).
- Light-direction-based shadow offset (taller entities = longer shadow).
- Vehicle shadow upgrade: directional offset instead of fixed south.
- Building shadow: projected parallelogram matching building footprint, offset by height.
- Shadow alpha variation by entity type.
- All shadow shapes must use `CAMERA_PROJECTION_CONTRACT.md` projection functions.

**Risk**: Medium. The projection infrastructure exists. The gap is the light direction model and building shadow rendering. Z-depth sorting with many overlapping shadows needs testing but is manageable at current entity counts.

---

### 3.10 Unit movement feel

**What exists**:
- `src/state/movementStateMachine.ts` — 11-phase grid movement FSM with acceleration/braking.
- `src/state/trackAnimation.ts` — `getTrackAnimationState()` — spritesheet-ready track animation API.
- `src/state/motionFx.ts` — `isMoving()`, `getDustProfile()`, `computeDustAlpha()`, `computeDustRadius()`, `speedAlphaMultiplier()`.
- `src/phaser/render/UnitMotionFxRenderer.ts` — Phaser Graphics dust particle renderer.
- `src/config/blockoutMovementData.ts` — Movement profiles per body.
- `src/state/blockoutMovement.ts` — Arena vehicle movement logic.
- Dust profiles: builder (light), harvester (medium), tank (heavy).

**What is missing**:
- No physics-based inertia (acceleration/braking curves approximate it, but there is no arcade physics engine).
- Tank dust profiles defined but **tanks are static in arena** — no combat unit movement exists in the default game mode.
- No animation speed correlation with movement speed.
- No explicit "no idle bobbing" enforcement (current behavior is correct but not tested/locked).

**What must be built (Phase 11)**:
- Ensure acceleration/braking curves produce smooth start/stop for all unit types (light hulls accelerate faster, heavy hulls stop slower).
- Enable tank movement in default game mode (requires Phase 2 for combat unit creation).
- Tank dust VFX when tanks are moving.
- Animation speed correlation with movement speed.
- No idle bobbing: verify and enforce that stationary units have no oscillation.
- Per-body inertia tuning (acceleration time, deceleration distance).

**Risk**: Medium. The movement FSM and dust system are mature. The main gap is enabling combat unit movement in the default game mode and tuning inertia curves.

---

### 3.11 Fullscreen

**What exists**:
- `src/config/gameConfig.ts` — `scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH }`.
- `src/main.ts` — Creates game with config.

**What is missing**:
- **No fullscreen toggle**. The word "fullscreen" / "fullScreen" does not appear anywhere in `src/`.
- No F11 key binding.
- No fullscreen button in HUD.
- No localStorage persistence of fullscreen preference.
- No browser fullscreen API integration (`requestFullscreen()` / `exitFullscreen()`).

**What must be built (Phase 12)**:
- F11 key binding with `preventDefault()` (browser default is native fullscreen toggle).
- HUD fullscreen toggle button.
- `document.documentElement.requestFullscreen()` / `exitFullscreen()` integration.
- Phaser scale mode adaptation for fullscreen transitions.
- localStorage persistence.

**Risk**: Low. This is a standard browser API integration. The main concern is Phaser scale mode behavior during transitions, which is well-documented.

---

### 3.12 Russian UI labels and localization

**What exists**:
- `src/config/localization.ts` (682 lines) — Complete Russian localization with 200+ strings across 15 sections.
- `t(key)` lookup function with key-as-fallback.
- Menu strings, setup strings, HUD strings, status strings, arena strings, tooltip strings, building strings (10 buildings), weapon strings (10 weapons), body strings (7 bodies), faction strings (4 factions), resource class strings (6 classes), feedback strings.
- `FACTION_DISPLAY`, `GAME_MODE_DISPLAY`, `MAP_SIZE_DISPLAY`, `AI_MODE_DISPLAY` display maps.

**What is missing**:
- **No multi-language support** — Russian only, no language switcher, no i18n framework.
- Missing strings for production-specific tooltips (combat unit production, hull/turret selection, upgrade costs, queue status).
- Missing strings for factory panel UI.
- Missing strings for build mode feedback.
- Missing strings for obstacle/map generation options.
- Missing strings for fullscreen toggle.
- Missing strings for control group badges.

**What must be built (Phase 6, Phase 12)**:
- Fill all missing Russian tooltip strings for production, upgrade, and factory panel features.
- Fill missing strings for build mode, fullscreen, control group clarity.
- Verify Russian text renders correctly at 1280x720 minimum.
- No multi-language framework (Russian-only is the stated scope).

**Risk**: Low. The localization system is mature and well-structured. The gap is content, not infrastructure.

---

### 3.13 Browser hotkey conflict handling

**What exists**:
- `src/phaser/input/GameInputController.ts` — Keyboard input handling including control groups.
- `src/state/controlGroups.ts` — `ControlGroupManager` with `assignGroup()`, `recallGroup()`, `shouldCenterOnGroup()`.
- Ctrl+1-9 assigns groups, 1-9 recalls, double-tap centers camera.

**What is missing**:
- **No `preventDefault()` for Ctrl+1-9**. Browsers intercept Ctrl+number for tab switching.
- **No `preventDefault()` for F11**. Browser uses F11 for native fullscreen.
- No focus management (canvas focus vs browser focus).
- No `stopPropagation()` for game-captured key combinations.

**What must be built (Phase 12)**:
- `event.preventDefault()` and `event.stopPropagation()` for Ctrl+1-9 when canvas is focused.
- `event.preventDefault()` for F11 when canvas is focused.
- Focus management: capture keyboard when canvas is focused, release when unfocused.
- Test in Chrome, Firefox, Edge.

**Risk**: Low-Medium. `preventDefault()` is straightforward but browser behavior varies. Edge cases exist (Ctrl+Shift+1-9, browser-specific tab management shortcuts).

---

### 3.14 Control group UI clarity

**What exists**:
- `src/state/controlGroups.ts` — Full control group manager with assign, recall, double-tap.
- `src/phaser/ui/hud/HudSelectionPanel.ts` — Selection panel with unit info.
- `src/phaser/ui/hud/HudCommandPanel.ts` — Command card.
- Control group feedback in typed feedback system.

**What is missing**:
- **No group badges on units**. When a unit belongs to control group 3, there is no visual indicator on the unit itself.
- No group membership display in selection panel.
- No group recall highlight (brief flash when group is recalled).
- No assignment confirmation feedback with group number.

**What must be built (Phase 12)**:
- Small group number badge on unit selection indicator.
- Group membership display in HUD selection panel.
- Brief highlight when group is recalled (1-9 key).
- Assignment confirmation with group number (Ctrl+1-9).

**Risk**: Low. Visual badge rendering is straightforward. The selection panel update is a UI change.

---

## 4. Cross-cutting concerns

### 4.1 Save/load compatibility

Current save format does not include:
- Combat unit production queue state.
- Hull/turret M-level for individual units (only `mod: 'm0'`).
- Mirrored map state.
- Obstacle state in production maps.

**Impact**: Phase 12 must add migration for new state fields. Save format needs a version field and default values for missing fields.

### 4.2 CAMERA_PROJECTION_CONTRACT compliance

All visual work in this roadmap must respect `CAMERA_PROJECTION_CONTRACT.md`:
- Building placement preview: projected ground-plane diamond, not axis-aligned rectangle.
- Shadows: projected ground-plane shapes, not screen-space circles.
- Obstacle rendering: projected footprints.
- Range indicators: projected ground circles.

**Current compliance**: Good. Existing code uses projection functions. New code must follow the same pattern.

### 4.3 Modular vehicle model

The accepted model is:
```text
hull sprite separately + turret sprite separately + socket/pivot metadata
```

The rejected model is:
```text
combined hull x turret production matrix
```

**Current compliance**: Good. The production system must use structured keys (e.g., `{hullId}:{turretId}`) rather than a flat matrix. No combined sprites.

### 4.4 On-demand asset loading

The accepted model is:
```text
requestModularVehicleSet() owns on-demand loading.
No startup preload of all modular vehicle assets.
```

**Current compliance**: Good. New combat unit production must use the same on-demand loading model. Do not preload all hull+turret combinations.

### 4.5 Russian-only UI

The project is Russian-only for user-facing text. English keys are internal IDs only.

**Current compliance**: Good. All new UI strings must be Russian with `localization.ts` entries. No multi-language framework needed.

---

## 5. Gap summary

| Roadmap topic | Implementation gap | Gap severity |
|---------------|-------------------|-------------|
| Combat unit production | No code path for combat unit production | High |
| Hull/turret selection UI | No factory panel UI | High |
| Hull upgrade model | No upgrade lifecycle, no `hullMod` field | Medium |
| Turret upgrade model | No upgrade lifecycle, no `turretMod` field | Medium |
| Complete cost/queue rules | No structured cost table, missing tooltips | Medium |
| Starting units | No starter combat unit, no config type | Medium |
| Mirrored map generation | No mirroring, no production obstacles | High |
| Builder local placement | No click-to-place, no preview, builder-centric logic missing. Requires Denis approval for UX model change. | Medium |
| Building shadows | No building shadows, no light direction model | Medium |
| Movement feel | Tank movement disabled, dust unused for combat units | Medium |
| Fullscreen | No fullscreen toggle at all | Low |
| Russian tooltips | Missing strings for new features | Low |
| Browser hotkey isolation | No `preventDefault()` for Ctrl+1-9, F11 | Low-Medium |
| Control group clarity | No group badges, no recall highlight | Low |

---

## 6. Implementation readiness by phase

| Phase | Ready? | Blockers | Notes |
|-------|--------|----------|-------|
| 0 (this audit) | Yes | None | Docs-only |
| 1 (validation baseline) | Yes — this is the first implementation phase | 28 failing tests, qa:smoke Windows, Vite audit, command alias drift | **Red gate**: no Phase 2+ until baseline is green or accepted |
| 2 (factory production) | Yes, after Phase 1 | Phase 1 red gate | `ProducibleUnitType` extension is well-scoped |
| 3 (hull+turret selection) | Yes, after Phase 2 | None after Phase 2 | Reference: `ArenaUnitComposer` |
| 4 (hull upgrade) | Yes, after Phase 2 | None after Phase 2 | Data model exists. **Deferrable past Phase 7 for earlier playable loop.** |
| 5 (turret upgrade) | Yes, after Phase 4 | None after Phase 4 | Follows hull upgrade pattern. **Deferrable past Phase 7 for earlier playable loop.** |
| 6 (cost/queue/Russian) | Yes, after Phases 3-5 | None after Phases 3-5 | Content-heavy |
| 7 (starting units + early playable loop) | Yes, after Phases 2-6 | None after Phases 2-6 | **Early Playable Loop Milestone.** Does NOT depend on Phase 8 (mirrored maps). M0-only is sufficient. |
| 8 (mirrored map + obstacles) | Yes | None | Independent of Phases 2-7 in code. Re-validates Phase 7 placements as follow-up. |
| 9 (builder placement) | Yes, after Denis approval | Denis approval gate + Phase 8 for map validation | Click-to-place UX model requires Denis explicit approval before implementation begins. |
| 10 (shadows) | Yes | None | Projection infrastructure exists |
| 11 (movement feel) | Yes | Phase 2 for combat units | Tanks need to exist first |
| 12 (fullscreen/hotkeys) | Yes | None | Low-risk, mostly browser API |
| 13 (QA/balance) | Yes | All prior phases | Integration phase |
| 14 (handoff) | Yes | Phase 13 | Docs-only. Next-roadmap candidates documented. |

---

## 7. Files inventory (most relevant to roadmap)

### State / production
```text
src/state/production.ts          — Production queue, start/cancel
src/state/types.ts               — Unit types, factory state, ProducibleUnitType
src/state/construction.ts        — Factory registration, building placement
src/state/updateGameState.ts     — Production tick, power allocation
src/state/builder.ts             — Builder assignment, update
src/state/buildSiteSelection.ts  — Site selection near player buildings
src/state/occupancy.ts           — Buildability checks
src/state/controlGroups.ts       — Control group manager
```

### Config / data
```text
src/config/bodyData.ts                — 7 bodies, M0-M3 stats
src/config/weaponData.ts              — 10 weapons, M0-M3 stats
src/config/blockoutProfiles.ts        — Body/weapon IDs and profiles
src/config/blockoutMovementData.ts    — Movement profiles per body
src/config/blockoutObstacleData.ts    — Arena obstacle configs
src/config/blockoutUpgradeData.ts     — Arena upgrade configs
src/config/coreMechanicsTypes.ts      — MLevelData<T>, ModificationLevel
src/config/m0m3Scaling.ts             — M-level scaling helpers
src/config/hullTurretVisualProfiles.ts — Visual profile types
src/config/hullVisualProfiles.ts      — Per-hull visual offsets
src/config/turretAttachmentMath.ts    — Turret-to-socket math
src/config/directionalTurretProfiles.ts — Per-direction turret pivots
src/config/cameraProjectionContract.ts  — Projection constants and helpers
src/config/localization.ts            — 200+ Russian strings
src/config/resourceAnchors.ts         — Map resource anchor positions
```

### Map generation
```text
src/state/generatedMap.ts        — Map generation (756 lines)
src/state/mapValidation.ts       — Starter reachability
src/state/terrainClustering.ts   — Patch-based terrain
```

### Rendering
```text
src/phaser/render/projectedGroundPrimitives.ts — Shadow and ground markers
src/phaser/render/BlockoutVehicleRenderer.ts    — Vehicle rendering + shadows
src/phaser/render/BlockoutObstacleRenderer.ts   — Obstacle rendering (arena)
src/phaser/render/ConstructionRenderer.ts       — Construction progress
src/phaser/render/UnitMotionFxRenderer.ts       — Dust particles
src/phaser/render/BlockoutUpgradeRenderer.ts    — Upgrade markers
```

### UI
```text
src/phaser/ui/ArenaUnitComposer.ts      — Arena body/weapon picker (reference)
src/phaser/ui/hud/HudCommandPanel.ts    — Command card
src/phaser/ui/hud/HudSelectionPanel.ts  — Selection panel
src/phaser/ui/hud/HudResourceStrip.ts   — Resource display
src/phaser/ui/hud/HudMinimap.ts         — Minimap
src/phaser/ui/hud/VisualHudCore.ts      — HUD core
```

### Input
```text
src/phaser/input/GameInputController.ts — Keyboard/mouse input
src/phaser/input/CameraControls.ts      — Camera pan/zoom
```

---

## 8. Risks and recommendations

### High-risk items

1. **Hull/turret selection UI (Phase 3)**: This is the most complex UI component. Start with a minimal list-based UI and iterate based on Denis feedback. Use `ArenaUnitComposer` as a functional reference but do not copy it — the factory panel has different requirements (costs, queue integration, production constraints).

2. **Validation baseline (Phase 1)**: 28 failing tests and a broken smoke pipeline mean new failures will be invisible. This must be resolved first — building on a red baseline is the #1 risk to the entire roadmap.

3. **Mirrored map generation (Phase 8)**: Map generation is already 756 lines. Adding mirroring and obstacle generation will significantly increase complexity. Recommend implementing mirroring as a post-processing step on a half-generated map rather than modifying the generation algorithm itself. Write comprehensive symmetry validation tests.

### Medium-risk items

4. **Combat unit production (Phase 2)**: The production system is well-structured for extension, but combat unit creation touches multiple state systems. Write integration tests before manual QA.

5. **Shadows (Phase 10)**: Z-depth sorting with many overlapping shadows needs testing. Render all shadows at a dedicated depth layer and verify no entity appears behind its own shadow.

6. **Movement feel (Phase 11)**: Tuning inertia curves requires manual playtesting. Define target values (e.g., "Wasp reaches full speed in 0.3s, Mammoth in 1.2s") before implementation.

### Low-risk items

7. **Fullscreen, hotkeys, Russian labels**: Standard implementation with well-known patterns.

8. **Control group badges**: Simple visual additions.

### Overall recommendation

The roadmap is feasible. The critical path runs through Phases 1-2-3-6-7 (fast-path to first playable loop) then 4-5-8-9-13-14. The highest-risk phases (1, 3, 8) should receive extra review and iterative feedback from Denis before merge. Phase 1 (validation baseline) is a hard gate — no implementation should proceed on a red baseline.

---

## 9. Explicitly out of scope

```text
- multiplayer (lockstep, netcode, lobby);
- full strategic AI (build orders, scouting, economy, attack planning);
- campaign (missions, story, cutscenes);
- full faction asymmetry (unique buildings, tech trees, mechanics per faction);
- A*/flow-field/pathfinding rewrite (current BFS is sufficient for this scope);
- fixed timestep simulation;
- full tech tree (tech-lab, building prerequisites, unlock chains);
- full M0-M3 balancing before playable loop (M0-only is sufficient for first milestone);
- particles/VFX polish (muzzle flash, explosions, impact effects);
- CSS/UI framework migration (current DOM HUD is functional);
- all-faction asset import (per-set pilot only, no mass import);
- full modular preload (selected-set loading only);
- enemy wave system (deferred to next roadmap);
- win/lose screen (deferred to next roadmap);
- attack-move / formations / patrol / hold-position commands;
- shift-queue for commands;
- audio/SFX/music layer;
- replay system;
- tutorial / onboarding missions;
- mobile/touch controls;
- I18n/multi-language support beyond Russian.
```

## 10. Audit synthesis note

This audit incorporates findings from three project audits conducted on 2026-06-21/22 against commit `c330b602`:

**Codex audit priority** (validation gates and repo health):
- Validation baseline must be green before new implementation. Phase 1 (red gate) directly addresses this.
- Combat hit-model test failures (21 in `blockoutDamage.test.ts`) are the #1 risk for expanding combat runtime.
- Command alias contract drift between source and tests must be resolved.

**Opus audit priority** (product/gameplay direction):
- Connect Normal economy with Arena combat — the game is two disconnected halves.
- Early playable loop milestone (Phase 7) addresses this by requiring combat unit production in Normal mode.
- M0-only is sufficient for first playable; full M0-M3 balancing is deferrable.
- Base-defense / pressure loop is recommended as the safest next roadmap after this one.

**GLM audit priority** (product/GDD/MVP clarity):
- Project needs a clear MVP win/loss condition. Addressed in roadmap Section 11 (GDD-lite).
- Economy linearity and faction cosmetic-only status are acknowledged and not in this roadmap's scope.
- Broad ideas from the GLM audit are backlog items captured as next-roadmap candidates (Phase 14).
