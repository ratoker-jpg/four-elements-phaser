# BLOCKOUT_01_HUGE_ROADMAP_AUDIT.md

Status: audit complete / docs-only  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-02  
Source: BLOCKOUT-MVP roadmap audit — Phase 1  
Precedes: BLOCKOUT-02 (config skeleton implementation)

---

## 1. Executive summary

### What exists now

The Four Elements Phaser project currently has a working civil-economy RTS prototype with the following systems in production:

- **Industrial generated map** as the default new-game experience (VISUAL-05A, 32x32 production map size)
- **Industrial terrain rendering** with frame/background/wall layers (TerrainRenderer, IndustrialFrameRenderer)
- **Industrial resource crystal assets** wired behind `resourceStyle` (VISUAL-06, EntityRenderer)
- **Polished UI layer**: main menu, New Game setup, ESC/pause menu, Save/Continue flow, Playtest HUD (UI-01 through HUD-01)
- **Civil unit loop**: harvesters gather resources from nodes, deliver to HQ, economy processes raw into matter/elements via separators (updateGameState)
- **Builder/construction loop**: builders auto-assigned to construction sites, buildings constructed over time (builder.ts, construction.ts)
- **Production queue**: factories produce builders and harvesters with power allocation (production.ts)
- **BFS pathfinding**: 4-connectivity shortest path for civil units, with occupancy map derived from game state (pathfinding.ts, occupancy.ts)
- **Unit selection + manual move**: click-to-select builders/harvesters, right-click to issue manual move command (GameInputController, unitCommands.ts)
- **Modular tank Wasp/Smoky**: one pre-existing modular-combat entity rendered with separate hull + turret images per direction, devtools-gated (ModularTankRenderer, worldConfig.ts)
- **Devtools panel**: debug resource manipulation, spawn commands, overlay toggles, arena mode (DevtoolsPanel, devCommands.ts)
- **Save/load**: localStorage-based save game with slot management, in-game ESC Load (saveGame.ts, PauseMenu.ts)
- **Command registry**: hotkey system for build/produce commands (commandRegistry.ts)

The project runs on Phaser 4.1.0, TypeScript, Vite, Vitest. It has 33 test suites, approximately 1001 tests, typecheck/build/qa:smoke validation, and no E2E test suite.

### What does not exist yet

The following systems required by BLOCKOUT-MVP are completely absent from the current codebase:

- **Body profiles**: no `BodyProfile` type or data exists for Wasp/Hornet/Hunter/Viking/Dictator/Titan/Mammoth
- **Weapon profiles**: no `WeaponProfile` type or data exists for any of the 11 weapon families
- **Vehicle profiles**: no `VehicleProfile` composition type exists
- **Movement profiles**: no `MovementProfile` type; civil units use hardcoded speed (2.5 tiles/sec) and instant direction changes
- **Recoil profiles**: no `RecoilProfile` type or visual recoil system
- **VFX profiles**: no primitive VFX system for weapon effects (lines, cones, circles, beams, projectiles)
- **Damage profiles**: no `DamageProfile` type; no damage/HP system for any entity
- **Obstacle profiles**: no `ObstacleProfile` type with projectile/cone/beam blocking; current obstacles are purely movement blockers in the occupancy map
- **Upgrade profiles**: no upgrade/config skeleton; no upgrade indicators
- **Independent turret rotation**: current ModularTankRenderer uses 8-direction discrete textures with debug-overlay tuner; no continuous turret rotation, no turret turn speed, no per-frame turret aim
- **Semi-physics movement**: no acceleration, braking, turn speed, body rotation lag, or mass/power model
- **Blockout renderer**: no primitive (Graphics API) renderer for vehicle bodies/turrets; current renderer uses PNG sprite images only
- **Blockout vehicle state**: no runtime state for blockout vehicles; `ModularCombatUnit` is a minimal struct with tx/ty/chassis/weapon/mod/faction only
- **Blockout scene/route**: no separate scene or dev route for blockout testing; modular tank only appears in arena mode or when devtools is active
- **Combat system**: no targeting, no damage application, no HP tracking for combat units
- **Projectile/cone/beam/line VFX**: no weapon effect rendering of any kind

### Main recommendation

Start the BLOCKOUT-MVP implementation sequence with a **config-only PR** (BLOCKOUT-02) that adds typed body/weapon/vehicle/movement/recoil/damage/obstacle profile contracts to `src/config/` without any runtime consumption. This is the safest possible first step because:

1. It adds only TypeScript types and constant data objects — zero runtime behavior change.
2. It can be fully tested with pure unit tests that verify IDs, categories, and completeness.
3. It establishes the contract that all subsequent PRs will consume, preventing ad-hoc interfaces.
4. It forces the team to validate the roadmap's type contracts against the actual codebase before any rendering or state work begins.
5. Rollback is trivial — delete the new config files.

The overall sequence should follow: config contracts → dev-only state → primitive renderer → turret rotation → movement feel → recoil → weapon VFX → damage placeholders → obstacles → upgrade skeleton → readability sandbox. Each PR should be gated behind the `devtools` flag until the blockout system is stable enough for production.

### Smallest safe first PR

**BLOCKOUT-02 — Config skeleton only**

- Add `src/config/blockoutProfiles.ts` with `BodyProfile`, `WeaponProfile`, `VehicleProfile`, `MovementProfile`, `RecoilProfile`, `DamageProfile`, `ObstacleProfile` types
- Add `src/config/blockoutBodyData.ts` with body profile data for all 7 hulls
- Add `src/config/blockoutWeaponData.ts` with weapon profile data for all 11 weapons
- Add `src/config/blockoutVehicleData.ts` with vehicle composition data for test combinations
- Add `src/__tests__/blockoutProfiles.test.ts` with pure unit tests verifying completeness, IDs, categories
- No runtime consumption, no renderer changes, no state changes, no asset changes
- Rollback: delete the new files, typecheck/build/tests pass unchanged

---

## 2. Current architecture findings

### Unit definitions

Unit data is spread across multiple locations with no centralized profile system:

- **State types** (`src/state/types.ts`): `ModularCombatUnit` is a minimal interface with `tx`, `ty`, `chassis: 'wasp'`, `weapon: 'smoky'`, `mod: 'm0'`, `faction`. This is hardcoded to a single chassis/weapon pair. The `RenderableEntity` type has `dir` and `turretDir` fields for modular units but no other combat attributes.
- **State creation** (`src/state/createInitialState.ts`): `createExtraModularCombat()` creates exactly one wasp+smoky unit with hardcoded chassis/weapon strings. The `ModularCombatUnit` type itself only allows `'wasp'` and `'smoky'` as literal types — it is not extensible.
- **Asset keys** (`src/assets/modularUnitAssets.ts`): `getWaspHullKey()` and `getSmokyTurretKey()` generate asset keys for the wasp hull and smoky turret only. There are no key generators for other chassis or weapons.
- **Config** (`src/config/worldConfig.ts`): Hull and turret mount offsets are stored as `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` and `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` — hardcoded for a single tank composition. These are mutable runtime values used by the tuner overlay.
- **Config** (`src/config/unitRenderConfig.ts`): Contains `MODULAR_RENDER_SCALE`, `MODULAR_SCALE_RATIO`, `MODULAR_ANCHOR_CORRECTION` — all specific to the single wasp/smoky modular tank.

**Finding**: The current modular unit system is a proof-of-concept for one hull + one weapon. Extending it to 7 hulls and 11 weapons requires a data-driven profile system, not incremental hardcoding. The BLOCKOUT-02 config skeleton PR must define this profile system.

### Entity rendering

Entity rendering is centralized in `EntityRenderer` with delegated subsystems:

- **EntityRenderer** (`src/phaser/render/EntityRenderer.ts`): Main renderer that handles HQ, builder, harvester, and resource rendering. Delegates modular-combat rendering to `ModularTankRenderer` and construction sites to `ConstructionRenderer`. Uses `resourceStyle` to select between legacy and industrial resource assets.
- **ModularTankRenderer** (`src/phaser/render/ModularTankRenderer.ts`): Renders the single wasp+smoky tank with separate hull and turret `Phaser.GameObjects.Image` objects. Uses 8-direction discrete textures keyed by faction+direction. Body position is computed from tile anchor + hull offset; turret mount position depends on bodyDir (not turretDir). Supports live offset tuning via the debug overlay.
- **ConstructionRenderer** (`src/phaser/render/ConstructionRenderer.ts`): Renders construction sites and building placeholders with Phaser Graphics primitives (rectangles, progress bars, labels).
- **BuildingStatusRenderer** (`src/phaser/render/BuildingStatusRenderer.ts`): Renders separator progress, factory queue indicators, and construction labels as Phaser Graphics.
- **FeedbackRenderer** (`src/phaser/render/FeedbackRenderer.ts`): Renders command OK/fail indicators and resource flow visualizations.
- **UnitMotionFxRenderer** (`src/phaser/render/UnitMotionFxRenderer.ts`): Renders movement dust particles for moving units.
- **DebugOverlayRenderer** (`src/phaser/render/DebugOverlayRenderer.ts`): Renders passability, footprint, and resource debug overlays when devtools is active.
- **TerrainRenderer** / **IndustrialFrameRenderer**: Terrain and frame rendering, not relevant to blockout vehicles.

**Finding**: The current ModularTankRenderer is a good structural reference for how to separate hull/turret rendering, but it is tightly coupled to the wasp/smoky asset pair and uses discrete 8-direction textures. The blockout renderer must use Phaser Graphics primitives (not PNG images) and support continuous rotation, variable body sizes, and multiple weapon types. It should be a new class, not an extension of ModularTankRenderer.

### Current tank/modular unit visual path

The current modular tank uses a sprite-sheet approach:

1. **Asset loading**: `loadModularUnitAssets()` in `modularUnitAssets.ts` loads 32 hull images (4 factions x 8 directions) and 32 turret images for wasp+smoky. The newer `loadGeneratedModularUnitAssets()` in `runtimeGeneratedAssets.ts` handles the same via the generated manifest pipeline.
2. **Texture keys**: Format is `wasp_m0_hull_{faction}_dir{0-7}` for hull and `smoky_m0_turret_{faction}_dir{0-7}` for turret.
3. **Rendering**: Two `Phaser.GameObjects.Image` objects placed at computed offsets. Hull uses `setTexture()` for direction changes; turret uses `setTexture()` for direction changes independently.
4. **Debug overlay**: `ModularTankDebugOverlay` shows anchor points, hull/turret positions, and direction labels.
5. **Tuning**: Arrow keys adjust hull/turret offsets per bodyDir at runtime; `C` prints offset tables to console.

**Finding**: The discrete-texture approach does not scale to 7 bodies x 11 weapons with continuous rotation. For blockout, we need Graphics-based rendering with computed geometry. The final art pipeline will eventually return to sprite/texture-based rendering, but during blockout the Graphics approach is correct for rapid iteration.

### Movement/pathfinding

Current movement is tile-based with BFS pathfinding for civil units:

- **Harvester movement** (`src/state/updateGameState.ts`): Harvesters use BFS-computed paths with `moveToward()` for straight-line interpolation between waypoints. Speed is a flat `2.5 tiles/second` with no acceleration, no turn speed, no mass. Direction is computed from movement delta via `directionFromDelta()`.
- **Builder movement** (`src/state/builder.ts`): Builders follow BFS paths similarly, with `ARRIVAL_THRESHOLD ≈ 0.03` tiles.
- **Pathfinding** (`src/state/pathfinding.ts`): Pure BFS with 4-connectivity (N/E/S/W). Returns tile-coordinate paths excluding the start. Supports `findPath()` and `findPathToAdjacent()` (for approaching footprints).
- **Occupancy** (`src/state/occupancy.ts`): Builds an `OccupancyMap` from game state with flags: impassable, unbuildable, resource, soft-occupied. Civil units are "soft-occupied" (don't block pathfinding by default, but can be added as blockers via `addUnitBlockers()`).

**Finding**: BFS pathfinding is reusable for blockout vehicles, but the movement model needs a new semi-physics layer. Blockout vehicles should not use `moveToward()` — they need acceleration, turn speed, body rotation lag, and mass/power influence. The pathfinding system itself (BFS, occupancy) can be reused to compute waypoints; the execution of those waypoints needs a new vehicle movement controller.

### Combat/projectile state

**There is no combat system.** The codebase has:

- No HP/armor state for any unit
- No damage application logic
- No projectile/spawn/track state
- No weapon firing state
- No targeting system
- No self-damage calculation
- No status effect system (burn, freeze, heal, overheat)

The `ModularCombatUnit` type exists but is purely positional (tx/ty/chassis/weapon/mod/faction). It has no combat attributes.

**Finding**: Combat state must be built from scratch. It should be added as a new blockout-only layer behind the devtools flag, not mixed into the existing `GameState` civil unit structures. The existing `EconomyState`, `HarvesterState`, `BuilderPlacement` types must not be modified to add combat fields.

### Commands/hotkeys

- **Command registry** (`src/state/commandRegistry.ts`): Defines commands with IDs, keys, categories, descriptions. Currently has build-separator (B), build-units-factory (F), build-power-plant (P), produce-builder (N), produce-harvester (G).
- **GameInputController** (`src/phaser/input/GameInputController.ts`): Wires keyboard handlers, click detection, unit selection, modular tank direction controls (Q/E for bodyDir, Z/X for turretDir, T for debug overlay, H/J for layer select, arrows for offset tuning).
- **Devtools panel** (`src/phaser/ui/DevtoolsPanel.ts`): DOM-based panel with resource manipulation, spawn commands, overlay toggles.

**Finding**: The command registry and input controller are well-structured for extension. Blockout debug commands (spawn specific body+weapon, cycle upgrades, toggle blockout renderer) can be added as new registry entries and input handlers. The existing Q/E/Z/X/T/H/J/C hotkeys for the modular tank tuner should remain functional but may need to be adapted when the blockout vehicle state replaces the single ModularTankRenderer.

### Save/load

- **Save game** (`src/state/saveGame.ts`): Serializes `GameState` to JSON, stores in localStorage with slot management. The save includes the full `mapData`, economy, harvesters, resource nodes, and production state.
- **Strip modular combat** (`src/state/createInitialState.ts`): `stripModularCombatFromState()` removes `modular-combat` entities and `extraModularCombat` from loaded saves when devtools is disabled (because modular combat textures may not be loaded in standard mode).

**Finding**: Save/load is a critical boundary. Blockout vehicle state must be carefully designed to avoid breaking saves:

1. New blockout vehicle fields should be optional or have defaults so old saves load without errors.
2. Blockout vehicles should be stripped from saves in standard mode (like `stripModularCombatFromState`).
3. The save schema should not be rewritten — new fields should be additive.
4. Blockout vehicles should not be serialized to saves at all in the MVP phase (they are dev-only).

### Config/assets

- **Config files**: `src/config/gameConfig.ts` (Phaser game config), `src/config/worldConfig.ts` (isometric tile dimensions, modular tank offsets), `src/config/unitRenderConfig.ts` (civil unit render scales).
- **Asset files**: `src/assets/assetManifest.ts` (keys and paths for approved assets), `src/assets/modularUnitAssets.ts` (wasp/smoky key generators and loader), `src/assets/civilUnitAssets.ts` (harvester/builder key helpers), `src/assets/buildingAssets.ts` (HQ key helpers), `src/assets/buildingPlacementMeta.ts` (footprint and display-width metadata), `src/assets/runtimeGeneratedAssets.ts` (generated manifest loader), `src/assets/generatedAssetManifest.ts` (auto-generated manifest), `src/assets/generatedBuildingMeta.ts` (auto-generated building metadata).

**Finding**: The asset pipeline uses a generated manifest approach (assets are declared, a tool generates the manifest, PreloadScene loads from the manifest). Blockout primitive rendering does not need PNG assets — it uses Phaser Graphics API. This means the blockout renderer bypasses the entire asset pipeline, which is correct for MVP. When final art is ready, a parallel asset integration PR will add sprite-based rendering.

### Tests/QA commands

- **Test suites**: 33 suites in `src/__tests__/`, covering pathfinding, occupancy, economy, production, construction, game setup, direction, motion FX, map validation, asset diagnostics, UI settings, camera controls, and more.
- **Validation commands**: `npm run typecheck`, `npm run test` (vitest run), `npm run build`, `npm run qa:smoke` (2 smoke tests). No `npm run test:e2e`.
- **QA smoke tool**: `tools/qa_smoke.mjs` runs headless checks against the built game.

**Finding**: The test infrastructure is solid for pure TS modules. Blockout config data should have comprehensive unit tests. Blockout renderer changes should be validated by typecheck + build + manual preview, not by brittle Phaser rendering tests. New blockout state modules (movement controller, damage calculator) should have pure TS unit tests.

---

## 3. Relevant files and functions

### Core state files

| File | What it does | Why it matters for BLOCKOUT-MVP | Risk level | Can touch early? | Notes |
|---|---|---|---|---|---|
| `src/state/types.ts` | Defines all game state types: GameState, RenderableEntity, ModularCombatUnit, HarvesterState, etc. | New blockout vehicle types may need to extend or parallel existing types. The `ModularCombatUnit` interface is too narrow (hardcoded wasp/smoky). | high | no — must not modify existing types; add new types separately | The `RenderableEntity.kind` union includes `'modular-combat'` — blockout vehicles can extend this or use a new kind. |
| `src/state/createInitialState.ts` | Creates initial GameState from MapData. Currently creates one wasp+smoky modular combat unit when devtools is active. | Blockout vehicle spawning must hook into or replace `createExtraModularCombat()`. The `stripModularCombatFromState()` function must be extended to strip blockout vehicles from saves. | high | no initially — BLOCKOUT-03 may modify | The `includeModularCombat` option pattern is a good template for blockout vehicle inclusion. |
| `src/state/updateGameState.ts` | Main game loop: advances harvesters, economy, power, production. No combat update. | Blockout vehicle movement, turret rotation, recoil, and damage updates must be called from the game loop. Adding a new `updateBlockoutVehicles()` call is needed. | high | no until BLOCKOUT-06 (movement) | Must not modify the existing harvester/economy update order. |
| `src/state/pathfinding.ts` | BFS pathfinding with 4-connectivity. Pure TS, no Phaser. | Reusable for blockout vehicle waypoint computation. Vehicles will follow BFS paths but with a new movement execution model. | low | yes — read-only reference, may add 8-connectivity option later | The BFS implementation is clean and well-tested. |
| `src/state/occupancy.ts` | Builds OccupancyMap from GameState with tile flags. | Blockout vehicles must register as soft-occupied or impassable tiles. New obstacle profiles (projectile/cone/beam blockers) need new tile flags. | medium | yes for new flags in BLOCKOUT-10 (obstacles) | Must not change existing flag behavior for civil units. |
| `src/state/gameSetup.ts` | Game setup config, map style, resource style, game mode. | The `gameMode` field already supports 'debug' and 'arena'. Blockout mode could be a new game mode or a sub-flag of devtools. | low | yes — BLOCKOUT-03 may add a blockout mode or flag | The existing devtools/arena URL parameter pattern is a good template. |
| `src/state/devCommands.ts` | Dev commands for resource manipulation, unit spawning. | Blockout vehicle spawn commands (spawn specific body+weapon combo) should be added here. | low | yes — BLOCKOUT-03 adds spawn commands | The `findSpawnTileNearHq()` helper can be reused. |
| `src/state/commandRegistry.ts` | Command registry for hotkey bindings. | Blockout debug hotkeys (toggle renderer, cycle weapons, apply upgrades) should use the registry. | low | yes — BLOCKOUT-03+ adds commands | |
| `src/state/saveGame.ts` | Save/load game state to localStorage. | Must not break when blockout vehicle state is added. Blockout vehicles should not be persisted to saves in MVP. | medium | no — must not modify | Blockout vehicle state should be transient (recreated on scene init, not saved). |
| `src/state/builder.ts` | Builder movement and assignment logic. | Not directly relevant to blockout vehicles. | low | no | |
| `src/state/construction.ts` | Construction site placement and progress. | Not relevant to blockout vehicles. | low | no | |
| `src/state/production.ts` | Factory production queue for builders/harvesters. | Blockout vehicle production is deferred. | low | no | |
| `src/state/unitCommands.ts` | Manual move commands for civil units. | Blockout vehicle move commands will need a different model (semi-physics, not instant waypoint following). | medium | no until BLOCKOUT-06 | May add `issueBlockoutVehicleMove()` as a new function. |

### Renderer files

| File | What it does | Why it matters for BLOCKOUT-MVP | Risk level | Can touch early? | Notes |
|---|---|---|---|---|---|
| `src/phaser/GameScene.ts` | Main scene: creates all renderers, runs update loop, wires input. | Must create BlockoutVehicleRenderer and wire it into the update loop. Must add blockout vehicle update calls. | high | no until BLOCKOUT-03/04 | Changes should be guarded by `devtoolsActive` flag. |
| `src/phaser/render/EntityRenderer.ts` | Central entity renderer. Delegates modular-combat to ModularTankRenderer. | Blockout vehicles may be a new kind in RenderableEntity or handled by a separate renderer. The `renderStaticEntity()` switch on `entity.kind` must handle the new blockout vehicle kind. | high | no until BLOCKOUT-04 (renderer) | The pattern of delegating to a sub-renderer (like ModularTankRenderer) should be followed. |
| `src/phaser/render/ModularTankRenderer.ts` | Renders wasp hull + smoky turret as separate Image objects with 8-direction textures. | Structural reference for hull/turret separation. Will eventually be replaced by the blockout renderer when the blockout system supersedes the legacy modular tank. | medium | no — will be replaced later | The offset/mount/scale-transform pattern is useful but the discrete-texture approach is not. |
| `src/phaser/render/isometric.ts` | Tile-to-screen and screen-to-tile conversion utilities. | Blockout vehicle renderer must use `tileToScreen()` for positioning. | low | yes — read-only | |
| `src/phaser/input/GameInputController.ts` | Handles keyboard/pointer input, unit selection, command dispatch. | Must add blockout vehicle controls: select, move, aim, fire, debug hotkeys. | medium | yes — BLOCKOUT-03+ adds handlers | Should not modify existing civil unit selection/move logic. |

### Config files

| File | What it does | Why it matters for BLOCKOUT-MVP | Risk level | Can touch early? | Notes |
|---|---|---|---|---|---|
| `src/config/worldConfig.ts` | Isometric tile dimensions, modular tank hull/turret offsets, tuner state. | The hull/turret offset tables are specific to wasp+smoky. New body profiles need their own offset tables. The `ModularTankDirection` type and `tunerState` may need to be generalized. | medium | yes — BLOCKOUT-02 adds new profile data alongside existing data | Must not remove or rename existing offset tables until blockout replaces legacy. |
| `src/config/unitRenderConfig.ts` | Civil unit render scales and modular tank scale constants. | Blockout vehicles will have their own scale factors derived from body profiles. | low | yes — BLOCKOUT-02 adds blockout render config | |
| `src/config/gameConfig.ts` | Phaser game config (scenes list, WebGL, resolution). | No changes needed for blockout MVP. | low | no | |

### Asset files

| File | What it does | Why it matters for BLOCKOUT-MVP | Risk level | Can touch early? | Notes |
|---|---|---|---|---|---|
| `src/assets/assetManifest.ts` | Keys and paths for approved runtime assets. | Blockout primitive renderer does not use PNG assets, so no new manifest entries are needed for blockout. Final art integration will add entries later. | low | no | |
| `src/assets/modularUnitAssets.ts` | Wasp hull and smoky turret key generators. | These are specific to the legacy modular tank. Blockout vehicles will use Graphics primitives, not texture keys. | low | no until final art integration | |
| `src/assets/runtimeGeneratedAssets.ts` | Generated manifest asset loading. | Not relevant for blockout primitives. | low | no | |

### Test files

| File | What it does | Why it matters for BLOCKOUT-MVP | Risk level | Can touch early? | Notes |
|---|---|---|---|---|---|
| `src/__tests__/pathfinding.test.ts` | Tests BFS pathfinding. | Should continue passing unchanged. New blockout-specific pathfinding tests should be in a separate test file. | low | no — existing tests must not change | |
| `src/__tests__/occupancy.test.ts` | Tests occupancy map. | May need extension when blockout obstacle flags are added (BLOCKOUT-10). | low | no until BLOCKOUT-10 | |
| `src/__tests__/createInitialState.test.ts` | Tests game state initialization. | Must not break when blockout vehicle state is added. | medium | no — BLOCKOUT-03 may add blockout-specific tests | |
| `src/__tests__/updateGameState.test.ts` | Tests harvester/economy/production updates. | Must not break. Blockout vehicle update tests should be separate. | low | no | |

---

## 4. Safe integration strategy

### Devtools flag vs new blockout flag vs separate scene/dev route

**Recommendation: Extend the existing devtools flag, do not create a separate scene.**

Rationale:

1. **Devtools flag already exists** (`isDevtoolsEnabled()` in `devCommands.ts`, `this.devtoolsActive` in GameScene). The blockout system should be gated behind this same flag in the MVP phase. When blockout vehicles are ready for production, the flag can be removed.
2. **Separate scene is overkill for MVP**. A new Phaser scene would require its own PreloadScene integration, camera setup, input wiring, and HUD. The GameScene already has all of these. Adding blockout vehicles to the existing scene behind a flag is simpler and allows testing alongside existing civil units.
3. **New "blockout" game mode** could be added to `GameMode` as a fourth option (`'standard' | 'debug' | 'arena' | 'blockout'`), but this is unnecessary complexity for MVP. The debug/arena mode already provides the devtools-gated environment. Simply adding blockout vehicle spawn under devtools is sufficient.
4. **Separate dev route** (like `?blockout=1`) is possible but adds URL parameter complexity. The existing `?devtools=1` is sufficient.

Implementation approach:

- Blockout vehicles are only created when `devtoolsActive` is true (same as the current modular tank).
- Blockout renderer is only instantiated when `devtoolsActive` is true.
- Blockout vehicle state is stored in a new `blockoutVehicles` field on GameState (or a separate transient state object), not mixed into `entities` or `harvesters`.
- Blockout vehicles are stripped from saves by extending `stripModularCombatFromState()`.

### Whether blockout renderer should be separate

**Recommendation: Yes, a new `BlockoutVehicleRenderer` class.**

Rationale:

1. `ModularTankRenderer` is tightly coupled to wasp/smoky PNG textures and 8-direction discrete rendering.
2. Blockout rendering uses Phaser Graphics primitives (rectangles, circles, lines, polygons) for body, turret, barrel, mount point, debug outlines, hitbox, status badges, and upgrade indicators.
3. The two renderers will coexist during the transition period. The legacy ModularTankRenderer should remain functional until the blockout system is validated and the legacy tank is replaced.
4. A new renderer allows independent development without risk of breaking the existing modular tank visuals.

The `BlockoutVehicleRenderer` should be created in `src/phaser/render/BlockoutVehicleRenderer.ts` and wired into `EntityRenderer` or `GameScene` alongside the existing `ModularTankRenderer`.

### Whether blockout vehicles should reuse existing entity structures

**Recommendation: No, create a new `BlockoutVehicleState` type.**

Rationale:

1. `RenderableEntity` is designed for static/semi-static entities with simple tx/ty/dir fields. Blockout vehicles need continuous position (ftx/fty), velocity, acceleration, turret angle, barrel state, HP, and more.
2. `HarvesterState` is specific to the civil gather/deliver loop with phase, cargo, and path fields.
3. Mixing blockout vehicle fields into existing types would violate the architecture layer rule (state layer must not gain combat-specific fields that only matter in devtools mode).
4. A new `BlockoutVehicleState` type can be designed from scratch to support the blockout contract (body ID, weapon ID, position, velocity, turret angle, HP, upgrade state, recoil state).

The new type should be:

```ts
interface BlockoutVehicleState {
  id: string;
  bodyId: BodyProfile['id'];
  weaponId: WeaponProfile['id'];
  faction: Faction;
  ftx: number;
  fty: number;
  bodyAngle: number;     // radians, continuous
  turretAngle: number;   // radians, continuous
  velocityX: number;
  velocityY: number;
  hp: number;
  maxHp: number;
  recoilState: { barrelKickback: number; recoveryMs: number };
  upgradeState: Record<string, number>;
}
```

This type lives in a new `src/state/blockoutVehicleState.ts` file and is only imported when devtools is active.

### How to avoid production breakage

1. **All blockout code is gated behind `devtoolsActive`**. When the flag is false, no blockout vehicles are created, no blockout renderer is instantiated, no blockout updates run.
2. **Blockout vehicle state is additive**. The `GameState` type may gain an optional `blockoutVehicles?: BlockoutVehicleState[]` field, but it defaults to undefined/empty. Existing code that iterates `entities`, `harvesters`, `builders` does not touch blockout vehicles.
3. **Save/load isolation**. Blockout vehicles are stripped from saves by `stripModularCombatFromState()` (renamed or extended). No blockout vehicle data is persisted.
4. **No modification to existing economy/resource/construction/production systems**. Blockout vehicles do not consume resources, do not occupy factory queues, do not interact with buildings.
5. **Test count must not drop**. Every PR must pass the full existing test suite plus any new tests.

### How to avoid save/load breakage

1. **New `blockoutVehicles` field is optional**. Old saves without this field load normally (field is undefined, which is equivalent to empty).
2. **`stripModularCombatFromState()` is extended** to also strip blockout vehicle entities and state when devtools is disabled.
3. **Blockout vehicles are not serialized**. The save function should exclude `blockoutVehicles` from the serialized JSON, or the load function should ignore it.
4. **No save schema change**. The existing save format remains identical for standard mode games.

---

## 5. Config/data strategy

### bodyProfiles

- **Recommended file**: `src/config/blockoutBodyData.ts`
- **TypeScript vs JSON**: TypeScript (typed constants, enables IDE autocomplete and compile-time validation)
- **Required tests**: Verify all 7 body IDs exist, mount categories match the roadmap, referenceM3 values are present and within expected ranges, blockoutShape values are valid enum members
- **Runtime consumption timing**: BLOCKOUT-03 reads body profiles when creating blockout vehicle state; BLOCKOUT-04 reads for renderer size/mount calculations

### weaponProfiles

- **Recommended file**: `src/config/blockoutWeaponData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify all 11 weapon IDs exist, behavior categories match the roadmap, damageModel fields are present per weapon family, recoilProfile/vfxProfile strings reference valid profiles
- **Runtime consumption timing**: BLOCKOUT-07 reads weapon profiles for VFX type selection; BLOCKOUT-08 reads for damage model; BLOCKOUT-09 reads for damage calculation

### vehicleProfiles

- **Recommended file**: `src/config/blockoutVehicleData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify test combination vehicles exist (Wasp+Smoky, Dictator+Railgun, Hunter+Twins, Mammoth+Thunder, Viking+Isida, Hornet+Ricochet, Titan+Vulcan), all bodyId/weaponId references are valid, blockoutEnabled is true for test vehicles
- **Runtime consumption timing**: BLOCKOUT-03 reads vehicle profiles for dev-spawn commands

### movement config

- **Recommended file**: `src/config/blockoutMovementData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify movement profiles exist for all body IDs, acceleration/braking/turnSpeed values are within playable ranges, massKg and enginePower produce distinguishable vehicle feels
- **Runtime consumption timing**: BLOCKOUT-06 reads movement profiles for the semi-physics movement controller

### recoil config

- **Recommended file**: `src/config/blockoutRecoilData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify recoil profiles exist for all weapon families, barrelKickback/recoveryMs values are reasonable (Railgun > Smoky > Vulcan), cameraShake is false for all MVP profiles
- **Runtime consumption timing**: BLOCKOUT-07 reads recoil profiles for visual recoil animation

### VFX config

- **Recommended file**: `src/config/blockoutVfxData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify VFX profiles exist for all weapon behaviors, primitive type (line/cone/circle/etc.) matches behavior family, color/width/duration values are present
- **Runtime consumption timing**: BLOCKOUT-08 reads VFX profiles for primitive effect rendering

### damage config

- **Recommended file**: `src/config/blockoutDamageData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify damage profiles exist for all weapon families, splashRadius is 0 for non-splash weapons, penetration is false for non-penetrating weapons, selfDamageScale is 0 for non-self-damage weapons
- **Runtime consumption timing**: BLOCKOUT-09 reads damage profiles for damage calculation

### obstacle config

- **Recommended file**: `src/config/blockoutObstacleData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify obstacle profiles exist for the first blockout obstacle set (blocker_1x1, blocker_2x1, blocker_2x2, wall_segment, wreck_placeholder, industrial_crate), blocksMovement/blocksProjectiles/blocksBeam/blocksCone flags are present
- **Runtime consumption timing**: BLOCKOUT-10 reads obstacle profiles for blocker behavior

### upgrade config

- **Recommended file**: `src/config/blockoutUpgradeData.ts`
- **TypeScript vs JSON**: TypeScript
- **Required tests**: Verify upgrade categories exist (body/turret/weapon/utility), each upgrade has visual indicator config, upgrade levels are defined
- **Runtime consumption timing**: BLOCKOUT-11 reads upgrade config for dev hotkey application and visual indicators

---

## 6. Renderer strategy

### How to render with Phaser primitives

The blockout renderer uses `Phaser.GameObjects.Graphics` for all visual elements. This avoids the asset pipeline entirely and allows rapid iteration on geometry, proportions, and positions.

#### Body

- **Shape**: Filled rectangle or polygon representing the hull silhouette. Size is derived from `BodyProfile.blockoutShape` (small_fast, light_fast, medium, large_fast, heavy, super_heavy).
- **Color**: Faction-based fill color (cyan/green/yellow/purple) with darker stroke outline.
- **Size mapping**:
  - `small_fast`: ~16x10 pixels
  - `light_fast`: ~18x12 pixels
  - `medium`: ~22x14 pixels
  - `large_fast`: ~24x14 pixels
  - `heavy`: ~28x18 pixels
  - `super_heavy`: ~32x22 pixels
- **Rotation**: The body rectangle rotates continuously based on `bodyAngle` (radians). Use `Phaser.GameObjects.Graphics` with `translate` + `rotate` transforms.

#### Turret

- **Shape**: Smaller filled rectangle or rounded rectangle on top of the body. Size is consistent across bodies (approximately 10x6 pixels) but the weapon barrel varies.
- **Rotation**: Rotates independently based on `turretAngle` (radians). Position is computed from body position + mount offset.
- **Color**: Slightly brighter faction color to distinguish from body.

#### Barrel

- **Shape**: Thin filled rectangle extending from the turret center in the turret direction. Length varies by weapon family (Railgun barrel is longest, Smoky is medium, Flamethrower is short and wide).
- **Origin**: Starts at the turret center, extends outward in the `turretAngle` direction.
- **Muzzle origin**: The tip of the barrel, used as the VFX spawn point.

#### Mount point

- **Visual**: Small circle marker at the turret mount position on the body. Only visible when debug overlay is ON.
- **Purpose**: Shows where the turret connects to the body, which varies by `mountCategory` (front, front_center, center, center_rear, rear).

#### Body direction

- **Visual**: The body rectangle's rotation reflects `bodyAngle`. A small direction indicator (arrow or line) on the body shows the forward direction.

#### Turret direction

- **Visual**: The turret + barrel rotation reflects `turretAngle`. When `turretAngle` differs from `bodyAngle`, the visual separation between body and turret aiming is clear.

#### Debug outline

- **Visual**: Dashed rectangle around the body footprint when debug overlay is ON. Shows the isometric tile footprint for collision.
- **Additional debug info**: Text label showing body ID, weapon ID, bodyAngle, turretAngle, HP.

#### Hitbox/footprint

- **Visual**: Semi-transparent isometric diamond overlaid on the tile(s) the vehicle occupies when debug overlay is ON.
- **Size**: Derived from `BodyProfile.blockoutShape` — heavier bodies occupy more tiles.

#### Status badges

- **HP bar**: Small horizontal bar above the vehicle. Color shifts from green to yellow to red as HP decreases.
- **Burn badge**: Small orange icon/text "BURN" when burn status is active.
- **Freeze badge**: Small blue icon/text "FREEZE" when freeze status is active.
- **Overheat meter**: Small arc or bar showing Vulcan overheat progress.

#### Upgrade indicators

- **Armor outline**: Thicker body outline (2px → 4px) when armor upgrade is active.
- **Speed badge**: Small "SPD" text near the vehicle when speed upgrade is active.
- **Longer aim line**: Extended line from barrel tip when range upgrade is active.
- **Brighter muzzle**: Brighter/larger muzzle flash when damage upgrade is active.
- **Bigger splash ring**: Larger radius circle when splash upgrade is active.
- **Different rail line style**: Dashed or thicker line when penetration upgrade is active.

### How to keep it separate from final assets

1. **Separate renderer class**: `BlockoutVehicleRenderer` does not import or reference any PNG texture keys. It uses only `Phaser.GameObjects.Graphics` and `Phaser.GameObjects.Text`.
2. **Feature flag**: Blockout rendering is only active when `devtoolsActive` or a specific `blockoutEnabled` flag is true. Production mode uses the existing entity renderer.
3. **No asset manifest entries**: No new texture keys are added for blockout primitives. Final art integration will be a separate PR sequence that adds PNG sprites and switches the renderer from Graphics to Image objects.
4. **Data-driven profile system**: All visual parameters (size, color, barrel length, mount offset) come from profile config, not hardcoded. When final art replaces primitives, the same profiles drive the sprite selection and offset computation.
5. **Clear naming convention**: All blockout files use the `blockout` prefix (`blockoutBodyData.ts`, `BlockoutVehicleRenderer.ts`, `BlockoutVehicleState`). This makes it easy to identify and remove/replace blockout code during the final art transition.

---

## 7. Movement/physics strategy

### Current movement logic

Civil units (harvesters, builders) use a simple movement model:

1. **Path computation**: BFS finds a tile-coordinate path from current position to destination.
2. **Waypoint following**: Units move toward the next waypoint in the path using `moveToward()`, which computes a straight-line step proportional to `speedTilesPerSecond * dt`.
3. **Arrival detection**: When distance to waypoint is below `ARRIVAL_THRESHOLD` (0.03 tiles), the unit snaps to the waypoint and advances to the next.
4. **Direction**: 8-direction facing is computed from movement delta via `directionFromDelta()`. There is no turn speed — direction changes instantly.
5. **No acceleration**: Units move at constant speed. There is no acceleration, braking, or inertia.
6. **No mass/power**: All harvesters have the same speed (2.5 tiles/second). Builder speed is also fixed.

This model is adequate for civil units (simple, predictable, good for pathfinding) but does not support the feel requirements for blockout vehicles.

### Blockout-only semi-physics approach

The blockout movement model adds physical feel without implementing a full physics engine:

1. **Target velocity computation**: Each frame, compute the desired velocity vector from the current path/destination. If the vehicle should stop, target velocity is (0, 0).
2. **Acceleration toward target**: Apply acceleration toward the target velocity, capped by `acceleration` from the MovementProfile. Heavier bodies accelerate more slowly (enginePower / massKg influences acceleration).
3. **Braking**: When the vehicle needs to decelerate, apply `braking` deceleration. Braking is stronger than acceleration (vehicles stop faster than they speed up).
4. **Turn speed**: Body rotation changes are capped by `turnSpeedDeg` degrees per second. The vehicle cannot instantly face a new direction — it must rotate toward the desired heading.
5. **Body rotation lag**: The body does not instantly align with the movement direction. `bodyRotationLag` determines how quickly the body catches up to the movement heading. A wasp has low lag (responsive), a mammoth has high lag (sluggish).
6. **Velocity update**: `velocity = velocity + acceleration * dt`. Position: `position = position + velocity * dt`.

This is a simplified "arcade physics" model — no rigid body simulation, no collision response, no friction curves, no terrain slope effects.

### Acceleration

- Derived from `MovementProfile.acceleration` and `massKg / enginePower` ratio.
- Formula: `effectiveAcceleration = acceleration * (enginePower / (massKg * 10))` (simplified, tunable).
- Wasp: high acceleration (light, powerful for its weight).
- Mammoth: low acceleration (heavy, underpowered for its weight).

### Braking

- `MovementProfile.braking` is the deceleration rate when reducing speed.
- Braking should be 1.5–2.0x acceleration for responsive stopping.
- Applied when: vehicle is approaching destination, vehicle receives a stop command, or vehicle is changing direction significantly.

### Turn speed

- `MovementProfile.turnSpeedDeg` limits how fast the body heading can change.
- Wasp: 150 deg/s (very nimble).
- Mammoth: 80 deg/s (sluggish turning).
- The body heading gradually rotates toward the desired movement direction each frame.

### Body rotation lag

- `MovementProfile.bodyRotationLag` is a 0–1 value. 0 = no lag (body instantly faces movement direction), 1 = maximum lag (body slowly aligns).
- The desired heading is the movement direction. The actual body angle interpolates toward it: `bodyAngle = lerp(bodyAngle, desiredAngle, 1 - bodyRotationLag)`.
- This creates the "tank-like" feel where the hull slowly swings around when changing direction.

### Mass/power influence

- `massKg` and `enginePower` from BodyProfile influence acceleration and top speed.
- Higher mass → slower acceleration, slower turn speed.
- Higher enginePower → faster acceleration, higher effective top speed.
- The relationship is simplified: `effectiveAccel = baseAcceleration * enginePower / (massKg * normalizer)`.

### Pathfinding reuse

- BFS pathfinding (`src/state/pathfinding.ts`) is reused for waypoint computation.
- Blockout vehicles request a path the same way civil units do.
- The path is converted into a smooth steering target (next waypoint) rather than a strict tile-by-tile movement.
- 4-connectivity BFS is sufficient for MVP. 8-connectivity can be considered later if diagonal movement is needed.

### Forbidden movement files/functions

- **Do not modify** `moveToward()` in `updateGameState.ts` — it is used by civil units.
- **Do not modify** `findPath()` or `findPathToAdjacent()` in `pathfinding.ts` — they work correctly for tile-based pathing.
- **Do not modify** `buildOccupancyMap()` in `occupancy.ts` — blockout vehicles add themselves as soft-occupied, not by changing the map builder.
- **Do not modify** `ARRIVAL_THRESHOLD` — it is calibrated for civil unit sub-pixel snap.
- **Do not modify** `directionFromDelta()` — it is used for civil unit animation direction.

---

## 8. Turret/recoil strategy

### Turret state

The turret has independent state from the body:

- **turretAngle**: Current turret facing angle in radians (continuous, not 8-directional).
- **turretTargetAngle**: The angle the turret is rotating toward (computed from aim target or movement direction).
- **turretTurnSpeed**: Degrees per second, derived from the weapon profile or a turret-specific config.
- **turretStabilization**: When enabled, the turret counter-rotates against body rotation to maintain aim. This is an advanced feature deferred past MVP.

### Independent turret rotation

The turret rotates independently from the body. This is the core visual differentiator for blockout vehicles:

1. **Body rotates** based on movement direction and `bodyRotationLag`.
2. **Turret rotates** based on aim target (mouse cursor in dev mode, or movement direction as default).
3. **Mount position** is computed from body position + `mountOffset` (which depends on `bodyAngle`, not `turretAngle`). The turret "rides" on the body and moves with it.
4. **Visual**: When the vehicle turns, the body rotates but the turret continues aiming in its own direction. The barrel visibly sweeps across the body, creating the iconic "turret-on-hull" look.

Implementation:

```ts
// Each frame:
const mountOffset = computeMountOffset(bodyAngle, bodyProfile.mountCategory);
const turretWorldX = bodyWorldX + mountOffset.x;
const turretWorldY = bodyWorldY + mountOffset.y;
// Turret rotates toward targetAngle at turretTurnSpeed
turretAngle = rotateToward(turretAngle, turretTargetAngle, turretTurnSpeed, dt);
```

### Barrel origin

The barrel origin is the center of the turret. All barrel drawing and VFX spawning originate from this point, offset by the turret position on the body.

### Muzzle origin

The muzzle origin is the tip of the barrel, computed as:

```ts
const barrelLength = weaponProfile.barrelLength;
const muzzleX = turretWorldX + Math.cos(turretAngle) * barrelLength;
const muzzleY = turretWorldY + Math.sin(turretAngle) * barrelLength;
```

VFX effects (muzzle flash, projectile spawn, beam origin) use the muzzle origin.

### Visual-only recoil first

The first recoil implementation is purely visual — no gameplay effect:

1. **Barrel kickback**: On fire, the barrel is drawn shorter (or displaced backward) for `recoveryMs` milliseconds, then smoothly returns to full length.
2. **Turret kickback**: A small position offset on the turret that decays over time.
3. **Body impulse**: A small velocity impulse applied to the body in the opposite direction of the shot. This creates visible body rocking.
4. **No camera shake** in MVP (as specified in the roadmap).

### Recoil profiles by weapon family

| Weapon family | Barrel kickback | Turret kickback | Body impulse | Recovery |
|---|---|---|---|---|
| Smoky (instant_projectile) | medium | small | small | 200ms |
| Thunder (instant_splash) | medium | medium | medium | 250ms |
| Railgun (line_pierce) | large | large | large | 400ms |
| Shaft (charge_sniper) | large on release | large on release | large on release | 500ms |
| Flamethrower (cone_stream) | none | none | none | N/A |
| Freeze (cone_stream) | none | none | none | N/A |
| Isida (beam_support) | none | none | none | N/A |
| Vulcan (rapid_fire) | tiny per shot | none | tiny per shot | 50ms |
| Twins (plasma_projectile) | small | small | small | 100ms |
| Ricochet (ricochet_projectile) | small | small | small | 120ms |
| Hammer (shotgun_cone) | large | medium | large | 300ms |

---

## 9. Weapon VFX strategy

### Instant projectile (Smoky)

- **Expected visible effect**: Short bright ray from muzzle to impact point. Small muzzle flash circle at barrel tip. Small impact dot at target.
- **Needed state/config**: `rayLength`, `rayWidth`, `rayColor`, `rayDurationMs`, `flashRadius`, `flashDurationMs`, `impactRadius`.
- **Implementation risk**: Low. Ray is a `Graphics.lineBetween()` call. Flash and impact are `Graphics.fillCircle()`.
- **Test/manual validation**: Fire Smoky at target. Verify ray appears, flash at muzzle, dot at impact. Ray fades after `rayDurationMs`.

### Instant splash (Thunder)

- **Expected visible effect**: Impact circle at hit point. Splash radius ring expanding outward. Optional self-damage debug ring.
- **Needed state/config**: `splashRadius`, `ringExpandSpeed`, `ringWidth`, `ringColor`, `ringDurationMs`, `impactFlashRadius`.
- **Implementation risk**: Low. Circle + expanding ring using Graphics.
- **Test/manual validation**: Fire Thunder near obstacles. Verify splash ring expands to `splashRadius` and is blocked by obstacles. Verify self-damage ring appears when firing too close.

### Line penetration (Railgun)

- **Expected visible effect**: Bright thin line from muzzle through target, continuing beyond. Impact flashes on each pierced target.
- **Needed state/config**: `lineWidth`, `lineColor`, `lineDurationMs`, `maxPenetrationTargets`, `piercedFlashRadius`.
- **Implementation risk**: Medium. Line must be drawn through multiple targets in a straight line. Requires ray-cast logic.
- **Test/manual validation**: Fire Railgun through aligned targets. Verify line passes through all targets within `maxPenetrationTargets`. Verify impact flashes on each.

### Charge/sniper line (Shaft)

- **Expected visible effect**: Aim/charge line from barrel while charging (faint, growing brighter). Final shot line (bright, long). Charge duration visible as line intensity.
- **Needed state/config**: `chargeDurationMs`, `aimLineWidth`, `aimLineColor`, `shotLineWidth`, `shotLineColor`, `shotLineDurationMs`, `maxRange`.
- **Implementation risk**: Medium. Requires charge state tracking and progressive visual intensity.
- **Test/manual validation**: Hold fire button. Verify aim line appears and grows brighter. Release. Verify bright shot line fires to max range.

### Cone stream (Flamethrower, Freeze)

- **Expected visible effect**: Cone sector from muzzle origin, continuously drawn while firing. Tick markers inside cone. Burn/freeze badge on affected targets.
- **Needed state/config**: `coneAngle`, `coneRange`, `coneColor`, `tickIntervalMs`, `badgeType` ('burn' | 'freeze').
- **Implementation risk**: Medium. Cone geometry must be computed each frame. Requires fill arc or polygon.
- **Test/manual validation**: Fire Flamethrower. Verify cone sector appears from barrel tip. Verify tick markers. Verify burn badge on hit targets. Verify cone is blocked by obstacles.

### Beam support (Isida)

- **Expected visible effect**: Beam tether line from muzzle to locked target. Color changes based on mode (heal = green, damage = red). Target tether indicator.
- **Needed state/config**: `beamWidth`, `beamColorHeal`, `beamColorDamage`, `beamRange`, `lockDurationMs`.
- **Implementation risk**: Medium. Requires target lock state and beam line drawn each frame to target position.
- **Test/manual validation**: Target a friendly unit. Verify green beam appears. Target an enemy. Verify red beam appears. Verify beam breaks when target moves out of range.

### Rapid fire / overheat (Vulcan)

- **Expected visible effect**: Rapid short rays/projectiles from muzzle. Spin-up feel (shots start slow, increase). Overheat meter visible on vehicle when near limit.
- **Needed state/config**: `fireRateMs`, `spinUpDurationMs`, `overheatThresholdMs`, `overheatCooldownMs`, `projectileLength`, `projectileColor`.
- **Implementation risk**: Medium-High. Requires spin-up state, overheat tracking, and rapid projectile drawing.
- **Test/manual validation**: Fire Vulcan continuously. Verify fire rate increases during spin-up. Verify overheat meter appears. Verify firing stops when overheated and resumes after cooldown.

### Plasma projectile (Twins)

- **Expected visible effect**: Repeated plasma dots/projectiles fired in a fast rhythm. Each projectile is a small colored circle that travels from muzzle toward target.
- **Needed state/config**: `projectileSpeed`, `projectileRadius`, `projectileColor`, `fireIntervalMs`, `spreadAngle`.
- **Implementation risk**: Low. Projectiles are moving circles with simple trajectory.
- **Test/manual validation**: Fire Twins. Verify two projectile streams. Verify projectiles travel in approximately the same direction with slight spread.

### Ricochet projectile (Ricochet)

- **Expected visible effect**: Projectile path with bounce markers from walls/obstacles. Projectile is a small circle that reflects off surfaces.
- **Needed state/config**: `projectileSpeed`, `projectileRadius`, `projectileColor`, `maxBounces`, `bounceMarkerRadius`.
- **Implementation risk**: High. Requires reflection vector computation off obstacle surfaces. Bounce logic is non-trivial.
- **Test/manual validation**: Fire Ricochet near a wall. Verify projectile bounces. Verify bounce markers appear. Verify projectile path is visually clear.

### Shotgun cone (Hammer)

- **Expected visible effect**: Spread rays in a short-range cone. Multiple thin lines from muzzle in a fan pattern. Pellet impact dots at end of each ray.
- **Needed state/config**: `pelletCount`, `coneAngle`, `range`, `pelletWidth`, `pelletColor`, `spreadPattern`.
- **Implementation risk**: Low. Multiple short lines drawn at spread angles.
- **Test/manual validation**: Fire Hammer. Verify spread rays appear in a cone. Verify short range. Verify impact dots at each ray end.

---

## 10. Damage placeholder strategy

### Visual-only before damage

In the first pass, damage is visual-only:

- Hit effects appear (flash, ring, impact marker).
- HP bar decreases on the target.
- No actual gameplay effect — the vehicle does not die, does not slow down, does not change behavior.

This allows testing the readability of damage effects without implementing a full damage pipeline.

### Direct hit

- **Weapons**: Smoky, Twins, Ricochet, Hammer (per pellet)
- **Visual**: Impact flash at hit point. HP bar decreases by `directDamage`.
- **Implementation**: On projectile/ray hit, apply `directDamage` to target HP. Render impact flash.

### Splash

- **Weapons**: Thunder
- **Visual**: Splash radius ring. All vehicles within `splashRadius` take damage. Damage falls off with distance if `splashFalloff` is true.
- **Implementation**: On impact, find all blockout vehicles within splash radius. Apply damage proportional to distance.

### Penetration

- **Weapons**: Railgun
- **Visual**: Line continues through target. Each pierced target takes `directDamage`. Maximum `maxPenetrationTargets` targets affected.
- **Implementation**: Ray-cast from muzzle in `turretAngle` direction. Find all vehicles along the line. Apply damage to each, up to the max.

### Cone tick

- **Weapons**: Flamethrower, Freeze
- **Visual**: Cone sector continuously drawn. Every `tickIntervalMs`, all vehicles within the cone take `damagePerSecond * tickIntervalMs / 1000` damage.
- **Implementation**: Each tick, check all vehicles within the cone geometry. Apply proportional damage.

### Beam lock

- **Weapons**: Isida
- **Visual**: Beam tether to locked target. Applies `damagePerSecond` continuously while beam is active. Alternatively heals the target (beam support mode).
- **Implementation**: While beam is active and target is in range, apply `damagePerSecond * dt / 1000` to target (or heal equivalent).

### Status effects

- **Burn (Flamethrower)**: After cone tick, target has `burn` status for `statusDurationMs`. During burn, takes `damagePerSecond` from burn alone. Visual: orange "BURN" badge.
- **Freeze (Freeze)**: After cone tick, target has `freeze` status for `statusDurationMs`. During freeze, movement speed is reduced by 50%. Visual: blue "FREEZE" badge.
- **Heal (Isida)**: When in support mode, beam restores HP instead of dealing damage. Visual: green beam.
- **Overheat (Vulcan)**: After continuous firing exceeds `overheatThresholdMs`, weapon is disabled for `overheatCooldownMs`. Visual: red overheat meter.

### Self-damage

- **Weapons**: Thunder (self-damage if too close)
- **Formula**: `selfDamage = splashDamage * selfDamageScale` when the firing vehicle is within the splash radius.
- **Visual**: Self-damage debug ring around the firing vehicle.

### Blockout-only HP

- Blockout vehicles have a `hp` and `maxHp` field in `BlockoutVehicleState`.
- Civil units (harvesters, builders) do **not** gain HP fields.
- Economy buildings, resources, and HQ do **not** gain HP fields.
- When a blockout vehicle's HP reaches 0, it becomes visually disabled (grayed out, smoke effect placeholder) but is not removed from the scene (allows readability testing of the "destroyed" state).

### Why civil units/economy must not be touched

1. The civil economy loop (harvester gather/deliver/unload, separator processing, factory production) is the core gameplay loop that must remain stable.
2. Adding HP/damage to civil units would require changes to harvester AI (flee from combat), builder AI (avoid combat zones), and economy balance.
3. The BLOCKOUT-MVP roadmap explicitly scopes combat to blockout vehicles only.
4. Save/load compatibility would break if civil unit types gain new fields.
5. Test stability: 33 existing test suites must not be affected.

---

## 11. Obstacle strategy

### Current blockers/occupancy/pathfinding

Current obstacles are defined in `MapData.obstacles` as `ObstaclePlacement` objects with `ObstacleType` (mountain-small, mountain-medium, mountain-large, volcano-small, volcano-medium, rock-cluster). These are rendered as `stateOnly` entities (no visual assets) and block movement + construction in the occupancy map.

The occupancy system (`occupancy.ts`) marks obstacle footprints as `impassable` and `unbuildable`. BFS pathfinding respects the `impassable` flag.

There is no concept of projectile/cone/beam blocking. Obstacles either block movement or they don't — there are no per-weapon-family blocking rules.

### Visual-only obstacles first

Before implementing blocking behavior, add visual-only blockout obstacles:

1. **Profile data**: Define `ObstacleProfile` objects in `src/config/blockoutObstacleData.ts` with the first blockout obstacle set (blocker_1x1, blocker_2x1, blocker_2x2, wall_segment, wreck_placeholder, industrial_crate).
2. **Visual rendering**: Each obstacle is rendered as a colored rectangle or polygon using Phaser Graphics. Different shapes for different obstacle types (1x1 square, 2x1 horizontal bar, wall segment line, etc.).
3. **Debug labels**: Text label showing obstacle ID and blocking flags when debug overlay is ON.
4. **No gameplay effect**: Obstacles are purely visual in this phase. They don't block movement, projectiles, cones, or beams.

### Movement blockers second

After visual-only obstacles are validated:

1. **Integrate with occupancy map**: When a blockout obstacle is placed, mark its footprint tiles as `impassable` in the occupancy map.
2. **Pathfinding**: BFS pathfinding automatically respects the new impassable tiles.
3. **Vehicle collision**: Blockout vehicles check occupancy before moving and stop if the next position is impassable.
4. **Civil units**: Harvesters and builders also respect the new obstacles via the existing occupancy system.

### Projectile/cone/beam blockers later

After movement blockers work:

1. **Projectile blocking**: Ray-cast for projectile weapons checks obstacle footprints. If a ray intersects an obstacle, the projectile stops (or ricochets, if `ricochet_projectile`).
2. **Cone blocking**: Cone sector geometry is clipped against obstacle footprints. The cone does not extend past blocking obstacles.
3. **Beam blocking**: Beam line is truncated at the first blocking obstacle.
4. **New tile flags**: Add `blocksProjectiles`, `blocksBeam`, `blocksCone` flags to the occupancy map (or a separate blocking data structure).

### Mapgen must not be touched early

The map generation system (`src/state/generatedMap.ts`) produces terrain, resources, obstacles, and decor. It must not be modified to add blockout obstacles because:

1. Map generation is a complex system with terrain clustering, resource placement, and validation.
2. Changing it would affect all new games, not just blockout testing.
3. Blockout obstacles should be placed via dev commands (spawn blocker at tile) or in the arena map preset.
4. When blockout obstacles are validated, a separate PR can integrate them into map generation.

---

## 12. Upgrade skeleton strategy

### Config first

Define upgrade configuration in `src/config/blockoutUpgradeData.ts` before any runtime behavior:

```ts
type UpgradeCategory = 'body' | 'turret' | 'weapon' | 'utility';

type UpgradeDef = {
  id: string;
  category: UpgradeCategory;
  label: string;
  levels: number;
  effectPerLevel: {
    [key: string]: number; // e.g., 'armorBonus': 0.1, 'speedBonus': 0.05
  };
  visualIndicator: {
    type: 'outline' | 'badge' | 'line' | 'muzzle' | 'ring' | 'style';
    params: Record<string, number | string>;
  };
};
```

### Dev hotkeys/debug controls

Upgrades are applied via dev hotkeys, not through a production upgrade shop:

1. **Hotkey `1`**: Cycle body upgrade (armor → speed → turn → mass/weight feel).
2. **Hotkey `2`**: Cycle turret upgrade (turn speed → stabilization).
3. **Hotkey `3`**: Cycle weapon upgrade (damage → range → reload → recoil → penetration → splash).
4. **Hotkey `4`**: Cycle utility upgrade (vision → repair → energy capacity).
5. **Hotkey `Shift+1-4`**: Reset upgrade level to 0.

These hotkeys are only active when devtools is ON and a blockout vehicle is selected.

### No full upgrade shop

The upgrade skeleton is explicitly not a full production upgrade shop:

- No UI panel for selecting upgrades.
- No cost/resource consumption for upgrades.
- No upgrade progression system (buying M0 → M1 → M2 → M3).
- No save/persistence of upgrade state.
- No AI/bot upgrade logic.

### Visual indicators

Each upgrade category has a placeholder visual indicator:

| Upgrade | Visual indicator | Implementation |
|---|---|---|
| Armor upgrade | Thicker body outline | `Graphics.lineStyle()` width increases from 2 to 4 |
| Speed upgrade | "SPD" badge text near vehicle | `Text` object appears near vehicle |
| Range upgrade | Longer aim line from barrel | Aim line extends by 30% per level |
| Reload upgrade | Faster shot cadence display | Shot interval decreases visibly |
| Damage upgrade | Brighter muzzle flash | Flash radius and alpha increase |
| Penetration upgrade | Different rail line style | Line becomes dashed or double-width |
| Splash upgrade | Bigger radius ring | Ring radius increases by 20% per level |

---

## 13. Risk map

| Area | Risk | Why | Mitigation | When to implement |
|---|---|---|---|---|
| Config skeleton (BLOCKOUT-02) | low | Additive only, no runtime consumption | Pure unit tests verify completeness | First PR |
| Dev-only vehicle state (BLOCKOUT-03) | medium | New state type, may conflict with existing GameState structure | Optional field on GameState, gated by devtools flag | Second PR |
| Primitive renderer (BLOCKOUT-04) | medium | New Graphics-based renderer, may have depth-sorting issues with existing entities | Test alongside existing entities, use depth values above/below existing layers | Third PR |
| Turret rotation (BLOCKOUT-05) | medium | Continuous rotation is new for this codebase (current is 8-direction discrete) | Separate turret angle state, independent from body angle | Fourth PR |
| Movement feel (BLOCKOUT-06) | high | Semi-physics model changes how vehicles move fundamentally. Risk of vehicles getting stuck, oscillating, or feeling wrong | Extensive manual testing in arena mode, tune profiles iteratively | Fifth PR |
| Recoil (BLOCKOUT-07) | medium | Visual recoil with barrel kickback and body impulse. Risk of visual glitching if timing is wrong | Simple lerp-based recovery, test per weapon family | Sixth PR |
| Weapon VFX (BLOCKOUT-08) | high+ | 11 different weapon VFX families, each with unique geometry and state. Cone/beam/ricochet are complex | Implement in order of complexity: Smoky first (simplest), then Thunder, then Railgun, then cone/beam, then ricochet last | Seventh PR |
| Damage placeholders (BLOCKOUT-09) | high | Damage affects HP, status effects, self-damage. Risk of cascading into civil units if not properly scoped | Blockout vehicles only, separate HP field, no civil unit HP | Eighth PR |
| Obstacles (BLOCKOUT-10) | high | Projectile/cone/beam blocking requires ray-cast and geometry clipping. Risk of performance issues with many obstacles | Start with visual-only, add movement blockers, then projectile blockers | Ninth PR |
| Upgrade skeleton (BLOCKOUT-11) | medium | Config and dev hotkeys are straightforward, but visual indicators may clash with existing debug overlays | Separate upgrade indicator layer, test with debug overlay ON and OFF | Tenth PR |
| Combat readability sandbox (BLOCKOUT-12) | high+ | Integration test of all systems together. Risk of interaction bugs between movement, turret, VFX, damage, obstacles, upgrades | Full manual QA in arena mode, test each weapon + body combination | Eleventh PR |
| Save/load compatibility | high | New state fields may break old saves or cause serialization issues | Optional fields with defaults, strip blockout data on save, extend stripModularCombatFromState | All PRs |
| Performance | medium | Graphics-based rendering of many vehicles + VFX may be slower than sprite-based | Profile in arena mode, limit max vehicles, use object pooling for VFX | BLOCKOUT-04+ |
| Depth sorting | medium | Isometric depth sorting must handle vehicles, VFX, obstacles, and existing entities correctly | Use consistent depth formula (100 + worldY), VFX at depth + 0.5 | BLOCKOUT-04+ |

---

## 14. Forbidden scope

### Files not to touch

- `src/state/updateGameState.ts` — harvester/economy/production update logic must not be modified (until BLOCKOUT-06 adds blockout update call as additive)
- `src/state/production.ts` — factory production must not gain combat unit types
- `src/state/construction.ts` — construction must not gain combat building types
- `src/state/builder.ts` — builder logic must not gain combat behavior
- `src/state/saveGame.ts` — save schema must not change (blockout data is transient)
- `src/state/generatedMap.ts` — map generation must not be modified
- `src/state/terrainClustering.ts` — terrain system must not be modified
- `src/assets/assetManifest.ts` — no new texture keys for blockout primitives
- `src/assets/modularUnitAssets.ts` — no new hull/turret keys until final art integration
- `src/phaser/render/ModularTankRenderer.ts` — must remain functional until blockout replaces it
- `src/phaser/ui/PlaytestHud.ts` — no combat HUD until BLOCKOUT-12 at earliest
- `src/phaser/ui/PauseMenu.ts` — no combat menu options
- `src/phaser/ui/DevtoolsPanel.ts` — may add blockout spawn controls but must not break existing dev commands
- `public/assets/**` — no new PNG assets during blockout
- `tools/**` — no build tool changes

### Functions not to touch

- `moveToward()` in `updateGameState.ts` — civil unit movement
- `findPath()` / `findPathToAdjacent()` in `pathfinding.ts` — may add 8-connectivity later but must not break 4-connectivity
- `buildOccupancyMap()` in `occupancy.ts` — may add new flags but must not change existing flag behavior
- `directionFromDelta()` in `updateGameState.ts` — civil unit direction
- `createHarvester()` in `updateGameState.ts` — civil unit factory
- `saveGame()` / `loadGame()` — save/load must remain backward compatible
- `allocatePowerAndProcess()` — economy power allocation must not change

### Systems not to touch

- **Economy**: Raw/matter/elements/power generation/consumption/caps must not change. Blockout vehicles do not consume resources.
- **Resource collection**: Harvester gather/deliver/unload loop must not change. Resource depletion/amounts must not change.
- **Map generation**: Terrain, resource, obstacle, decor placement algorithms must not change. Map size must not change.
- **Save schema**: The serialized GameState format must not change for standard mode games.
- **Production menu/factory**: The factory queue must only produce builder/harvester. No combat unit production.
- **Final asset manifest**: No new PNG/sprite assets are added during blockout.
- **Legacy tank asset deletion**: The existing wasp/smoky PNG assets and ModularTankRenderer must not be deleted or disabled. They remain as fallback/reference.
- **Enemy AI/bot systems**: No AI, no attack waves, no enemy factions.
- **Full upgrade shop UI**: No production upgrade interface.
- **Broad renderer refactor**: EntityRenderer, TerrainRenderer, IndustrialFrameRenderer must not be refactored. New blockout renderer is additive.

---

## 15. Proposed PR sequence

### BLOCKOUT-02 — Config skeleton only

- **PR id**: BLOCKOUT-02
- **Title**: BLOCKOUT-02: Add body/weapon/vehicle/movement/recoil/damage/obstacle/upgrade profile contracts
- **Goal**: Add typed profile contracts and data without runtime consumption. Establish the data foundation for all subsequent PRs.
- **Risk**: low
- **Expected visible effect**: None. Game output unchanged.
- **Allowed files**:
  - `src/config/blockoutProfiles.ts` (types)
  - `src/config/blockoutBodyData.ts` (7 body profiles)
  - `src/config/blockoutWeaponData.ts` (11 weapon profiles)
  - `src/config/blockoutVehicleData.ts` (7+ vehicle compositions)
  - `src/config/blockoutMovementData.ts` (7 movement profiles)
  - `src/config/blockoutRecoilData.ts` (11 recoil profiles)
  - `src/config/blockoutVfxData.ts` (10 VFX profiles)
  - `src/config/blockoutDamageData.ts` (11 damage profiles)
  - `src/config/blockoutObstacleData.ts` (6 obstacle profiles)
  - `src/config/blockoutUpgradeData.ts` (upgrade definitions)
  - `src/__tests__/blockoutProfiles.test.ts` (unit tests)
- **Forbidden files**: All runtime files, renderers, state files, asset files, save/load files
- **Automated tests**: Pure TS unit tests verifying: all body IDs present, mount categories match roadmap, weapon behaviors match roadmap, vehicle compositions reference valid bodies/weapons, movement profiles have required fields, damage profiles have correct zero values for non-applicable fields
- **Manual validation**: typecheck + build + test pass. Game runs unchanged.
- **Rollback plan**: Delete all new files. No other files were changed.

### BLOCKOUT-03 — Dev-only blockout vehicle state/spawn

- **PR id**: BLOCKOUT-03
- **Title**: BLOCKOUT-03: Add blockout vehicle state type and dev-spawn commands
- **Goal**: Define `BlockoutVehicleState` type, add optional `blockoutVehicles` field to GameState, add dev-spawn command for blockout vehicles, extend `stripModularCombatFromState()` to strip blockout vehicles.
- **Risk**: medium
- **Expected visible effect**: None yet (no renderer). Dev-spawn command creates state but vehicle is invisible. Console log confirms spawn.
- **Allowed files**:
  - `src/state/blockoutVehicleState.ts` (new)
  - `src/state/types.ts` (add optional `blockoutVehicles` field to GameState)
  - `src/state/createInitialState.ts` (extend strip function)
  - `src/state/devCommands.ts` (add devSpawnBlockoutVehicle command)
  - `src/__tests__/blockoutVehicleState.test.ts` (new)
- **Forbidden files**: Renderers, assets, save schema (blockout vehicles are not persisted)
- **Automated tests**: Test blockout vehicle state creation, strip function, dev-spawn command
- **Manual validation**: typecheck + build + test pass. Game runs unchanged. Dev-spawn command creates state (verify in console).
- **Rollback plan**: Revert changes. Remove `blockoutVehicles` field from GameState. Delete new files.

### BLOCKOUT-04 — Primitive renderer

- **PR id**: BLOCKOUT-04
- **Title**: BLOCKOUT-04: Blockout vehicle primitive renderer with Graphics API
- **Goal**: Render blockout vehicles as Phaser Graphics primitives (body rectangle, turret rectangle, barrel line, mount point circle, HP bar, debug outline).
- **Risk**: medium
- **Expected visible effect**: Blockout vehicles appear as colored rectangles with turret and barrel when devtools is active. Different body sizes visible. Mount points visible with debug overlay.
- **Allowed files**:
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (new)
  - `src/phaser/GameScene.ts` (create BlockoutVehicleRenderer, wire into update loop)
  - `src/phaser/render/EntityRenderer.ts` (delegate blockout vehicle kind to new renderer)
  - `src/config/unitRenderConfig.ts` (add blockout render scale constants)
- **Forbidden files**: ModularTankRenderer (must remain unchanged), asset files, state logic files
- **Automated tests**: typecheck + build pass
- **Manual validation**: Open arena mode. Spawn blockout vehicle via dev command. Verify colored rectangle with turret and barrel appears. Verify mount point with debug overlay ON. Verify different body sizes for different profiles.
- **Rollback plan**: Revert changes. Blockout vehicles become invisible again (state still exists but no rendering). Game still functions.

### BLOCKOUT-05 — Turret rotation

- **PR id**: BLOCKOUT-05
- **Title**: BLOCKOUT-05: Independent turret rotation with configurable turn speed
- **Goal**: Turret rotates independently from body. Turret aim follows mouse cursor (in dev mode) or movement direction. Turret turn speed is configurable per weapon/turret profile.
- **Risk**: high
- **Expected visible effect**: Body rotates in movement direction. Turret aims at mouse cursor separately. Visible separation between body and turret facing when vehicle turns.
- **Allowed files**:
  - `src/state/blockoutVehicleState.ts` (add turretAngle, turretTargetAngle, turretTurnSpeed fields)
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (turret rendering follows turretAngle)
  - `src/phaser/input/GameInputController.ts` (mouse position drives turret aim)
  - `src/config/blockoutMovementData.ts` (add turret turn speed per body/weapon)
- **Forbidden files**: Civil unit logic, ModularTankRenderer
- **Automated tests**: Unit tests for turret angle interpolation, turn speed clamping
- **Manual validation**: Move vehicle. Verify body rotates in movement direction. Verify turret follows mouse. Verify heavy vehicles have slower turret rotation.
- **Rollback plan**: Revert changes. Turret reverts to fixed position (matches body direction).

### BLOCKOUT-06 — Movement feel

- **PR id**: BLOCKOUT-06
- **Title**: BLOCKOUT-06: Semi-physics movement feel for blockout vehicles
- **Goal**: Implement acceleration, braking, turn speed, body rotation lag, mass/power influence for blockout vehicles.
- **Risk**: high+
- **Expected visible effect**: Wasp feels fastest and most responsive. Mammoth feels slowest and heaviest. Acceleration visible. Braking visible. Turn speed differences visible. Body rotation lag visible on heavy vehicles.
- **Allowed files**:
  - `src/state/blockoutVehicleState.ts` (add velocity, acceleration, bodyAngle, bodyRotationLag fields)
  - `src/state/blockoutMovement.ts` (new — semi-physics movement controller)
  - `src/phaser/GameScene.ts` (add blockout vehicle update call)
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (position from state, body rotation from bodyAngle)
  - `src/phaser/input/GameInputController.ts` (WASD or click-to-move for blockout vehicles)
  - `src/config/blockoutMovementData.ts` (tune movement parameters)
  - `src/__tests__/blockoutMovement.test.ts` (new)
- **Forbidden files**: `updateGameState.ts` (additive call only), civil unit movement, pathfinding core
- **Automated tests**: Unit tests for acceleration, braking, turn speed, velocity clamping, arrival detection
- **Manual validation**: Drive Wasp — verify fast acceleration, quick turns, responsive feel. Drive Mammoth — verify slow acceleration, wide turns, heavy feel. Test all 7 bodies.
- **Rollback plan**: Revert changes. Vehicles revert to instant movement (teleport to destination).

### BLOCKOUT-07 — Recoil

- **PR id**: BLOCKOUT-07
- **Title**: BLOCKOUT-07: Visual recoil by weapon family
- **Goal**: Implement visual-only recoil: barrel kickback, turret kickback, body impulse. Recoil profiles vary by weapon family.
- **Risk**: high
- **Expected visible effect**: Smoky kicks once. Railgun kicks hard. Vulcan has small repeated impulses. Cone/beam weapons have minimal recoil. Hammer has shotgun kick.
- **Allowed files**:
  - `src/state/blockoutVehicleState.ts` (add recoilState field)
  - `src/state/blockoutRecoil.ts` (new — recoil controller)
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (recoil visual: barrel shortened, turret displaced)
  - `src/config/blockoutRecoilData.ts` (tune recoil parameters)
  - `src/__tests__/blockoutRecoil.test.ts` (new)
- **Forbidden files**: Civil unit logic, camera system (no camera shake)
- **Automated tests**: Unit tests for recoil recovery timing, kickback magnitude per weapon
- **Manual validation**: Fire each weapon type. Verify recoil magnitude and recovery match expectations.
- **Rollback plan**: Revert changes. No recoil visual. Firing has no visual kickback.

### BLOCKOUT-08 — Weapon VFX visual-only

- **PR id**: BLOCKOUT-08
- **Title**: BLOCKOUT-08: Primitive VFX placeholders for all weapon behavior families
- **Goal**: Implement primitive VFX for all 10 weapon behaviors. Each weapon family has a visually distinct effect using Graphics primitives.
- **Risk**: high+
- **Expected visible effect**: Projectile / splash / line pierce / cone / beam / rapid fire / plasma / ricochet / shotgun are visually distinct and identifiable.
- **Allowed files**:
  - `src/phaser/render/BlockoutVfxRenderer.ts` (new — weapon VFX renderer)
  - `src/state/blockoutVfxState.ts` (new — VFX state: active effects, timers)
  - `src/phaser/GameScene.ts` (add VfxRenderer creation and update)
  - `src/config/blockoutVfxData.ts` (VFX parameters)
  - `src/__tests__/blockoutVfx.test.ts` (new — pure logic tests for VFX state)
- **Forbidden files**: EntityRenderer, ModularTankRenderer, civil unit rendering
- **Automated tests**: VFX state lifecycle tests (create, update, expire)
- **Manual validation**: Fire each weapon type. Verify each produces the correct visual effect. Verify effects fade after their duration.
- **Rollback plan**: Revert changes. No weapon VFX. Firing has no visible effect.

### BLOCKOUT-09 — Damage placeholders

- **PR id**: BLOCKOUT-09
- **Title**: BLOCKOUT-09: Parameterized damage behavior placeholders
- **Goal**: Implement direct hit, splash, penetration, cone tick, beam lock, status effects, self-damage. Blockout-only HP.
- **Risk**: high+
- **Expected visible effect**: Thunder shows splash radius. Railgun shows penetration. Flamethrower/Freeze show cone damage + status. Isida shows beam lock. HP bars decrease. Status badges appear.
- **Allowed files**:
  - `src/state/blockoutDamage.ts` (new — damage calculation and application)
  - `src/state/blockoutVehicleState.ts` (add hp, maxHp, statusEffect fields)
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (HP bar, status badge rendering)
  - `src/phaser/render/BlockoutVfxRenderer.ts` (damage-related VFX: splash ring, impact flash)
  - `src/config/blockoutDamageData.ts` (damage parameters)
  - `src/__tests__/blockoutDamage.test.ts` (new)
- **Forbidden files**: Civil unit types, economy, resource system, save schema
- **Automated tests**: Damage calculation tests (direct, splash with falloff, penetration, cone tick, beam, status effect duration)
- **Manual validation**: Shoot vehicles with each weapon. Verify HP decreases. Verify splash damages nearby vehicles. Verify status effects apply and expire.
- **Rollback plan**: Revert changes. No damage behavior. Firing has VFX but no HP effect.

### BLOCKOUT-10 — Obstacles

- **PR id**: BLOCKOUT-10
- **Title**: BLOCKOUT-10: Blockout obstacle visual, movement, and projectile blockers
- **Goal**: Add visual-only obstacles, then movement blockers, then projectile/cone/beam blockers.
- **Risk**: high
- **Expected visible effect**: Colored rectangles appear for blockout obstacles. Vehicles cannot drive through them. Projectiles stop at obstacles. Cones are clipped. Beams are truncated.
- **Allowed files**:
  - `src/config/blockoutObstacleData.ts` (obstacle profiles)
  - `src/state/blockoutObstacle.ts` (new — obstacle placement and blocking logic)
  - `src/state/occupancy.ts` (add blocksProjectile/blocksBeam/blocksCone flags — additive)
  - `src/phaser/render/BlockoutObstacleRenderer.ts` (new — obstacle primitive rendering)
  - `src/state/devCommands.ts` (add dev-place-obstacle command)
  - `src/__tests__/blockoutObstacle.test.ts` (new)
- **Forbidden files**: Map generation, terrain system, existing obstacle types
- **Automated tests**: Obstacle blocking tests (movement, projectile, cone, beam)
- **Manual validation**: Place obstacles. Drive vehicle into obstacle — verify it stops. Fire projectile at obstacle — verify it stops. Fire cone at obstacle — verify it clips.
- **Rollback plan**: Revert changes. No blockout obstacles. Existing obstacle system unchanged.

### BLOCKOUT-11 — Upgrade skeleton

- **PR id**: BLOCKOUT-11
- **Title**: BLOCKOUT-11: Debug/config upgrade model with visual indicators
- **Goal**: Upgrade definitions in config. Dev hotkeys to apply upgrades. Visual indicators for armor/speed/range/damage/penetration/splash.
- **Risk**: high
- **Expected visible effect**: Dev hotkeys apply upgrades. Armor upgrade shows thicker outline. Speed upgrade shows badge. Damage upgrade shows brighter muzzle. Penetration upgrade shows different line style.
- **Allowed files**:
  - `src/config/blockoutUpgradeData.ts` (upgrade definitions)
  - `src/state/blockoutUpgrade.ts` (new — upgrade application logic)
  - `src/state/blockoutVehicleState.ts` (add upgradeState field)
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (upgrade visual indicators)
  - `src/phaser/input/GameInputController.ts` (upgrade hotkeys)
  - `src/state/commandRegistry.ts` (add upgrade commands)
  - `src/__tests__/blockoutUpgrade.test.ts` (new)
- **Forbidden files**: Production UI, economy, save system
- **Automated tests**: Upgrade application tests (each category, level stacking, visual indicator config)
- **Manual validation**: Apply each upgrade via hotkey. Verify visual indicator appears. Verify parameter changes (faster movement, longer range, etc.).
- **Rollback plan**: Revert changes. No upgrade system. Vehicles have fixed parameters.

### BLOCKOUT-12 — Readability sandbox

- **PR id**: BLOCKOUT-12
- **Title**: BLOCKOUT-12: Combat readability sandbox — integrated test environment
- **Goal**: Integrated test sandbox for vehicle/weapon/obstacle/upgrade readability. Multiple vehicles visible simultaneously. All weapon families testable.
- **Risk**: high+
- **Expected visible effect**: Multiple blockout vehicles with different bodies and weapons visible. Different bodies are readable. Different weapon families are readable. Recoil readable. Splash/penetration/cone/beam readable. Obstacles affect behavior. Upgrades visibly modify behavior.
- **Allowed files**:
  - `src/state/devArena.ts` (extend arena map with blockout vehicle presets and obstacles)
  - `src/phaser/GameScene.ts` (arena mode spawns multiple blockout vehicles)
  - `src/phaser/ui/DevtoolsPanel.ts` (add blockout control section)
  - `src/phaser/input/GameInputController.ts` (add blockout vehicle selection and control)
- **Forbidden files**: All previously forbidden files remain forbidden
- **Automated tests**: Integration tests for multi-vehicle scenarios (if feasible without Phaser)
- **Manual validation**: Enter arena mode. Verify multiple vehicles. Select each. Fire each weapon. Test readability.
- **Rollback plan**: Revert changes. Arena mode reverts to civil-only state.

---

## 16. First implementation PR recommendation

**BLOCKOUT-02 — Config skeleton only**

This is the smallest and safest first implementation PR because:

1. **Zero runtime change**: The PR adds TypeScript types and constant data objects. No code path consumes them yet. The game runs identically before and after the PR.
2. **Fully testable**: Pure unit tests verify every profile has required fields, every ID is valid, every cross-reference (body in vehicle → body in bodyData) resolves correctly.
3. **Foundation for all subsequent PRs**: Every later BLOCKOUT PR depends on these types and data. Getting the contracts right first prevents interface mismatches and ad-hoc type definitions scattered across later PRs.
4. **Easy to review**: The PR contains only type definitions and data constants. No behavioral logic. Reviewers can verify data against the roadmap tables.
5. **Trivial rollback**: Delete the new files. No other files were changed.

**What it must NOT do**:

- Must not add any runtime consumption of the profile data.
- Must not modify any existing types, state, renderer, asset, or save files.
- Must not add any new GameState fields.
- Must not add any Phaser imports.
- Must not change the game output in any way.
- Must not add any new npm dependencies.

---

## 17. Validation plan

Exact validation commands for every BLOCKOUT PR:

```bash
# TypeScript type checking
npm --prefix /home/z/my-project/four-elements-phaser run typecheck

# Unit tests (expected: 33+ suites, 1001+ tests)
npm --prefix /home/z/my-project/four-elements-phaser run test

# Production build
npm --prefix /home/z/my-project/four-elements-phaser run build

# QA smoke tests (expected: 2/2 pass)
npm --prefix /home/z/my-project/four-elements-phaser run qa:smoke

# E2E tests
npm --prefix /home/z/my-project/four-elements-phaser run test:e2e
# Status: unavailable (no E2E test suite exists)
```

For BLOCKOUT-02 specifically:

- typecheck: must pass (new types are valid TypeScript)
- test: must pass with additional blockout profile tests (expected test count increases)
- build: must pass (no runtime changes)
- qa:smoke: must pass (2/2)

For subsequent PRs with runtime changes (BLOCKOUT-04+):

- All above commands must pass.
- Manual QA: open the game in devtools/arena mode, verify expected visual effects.
- No test count regression (existing tests must not be removed or broken).

---

## 18. Rollback plan

### Docs audit (this PR)

- **Rollback**: Close the PR. Delete `BLOCKOUT_01_HUGE_ROADMAP_AUDIT.md`. Revert `CURRENT_NEXT_STEP.md` if changed.
- **Impact**: None on runtime code.

### Config-only PR (BLOCKOUT-02)

- **Rollback**: Delete all `src/config/blockout*.ts` files and `src/__tests__/blockoutProfiles.test.ts`. No other files changed.
- **Impact**: Zero runtime impact. Types and data were not consumed by any runtime code.

### Renderer PR (BLOCKOUT-04)

- **Rollback**: Delete `BlockoutVehicleRenderer.ts`. Revert changes to `GameScene.ts` and `EntityRenderer.ts` (remove blockout renderer creation and delegation).
- **Impact**: Blockout vehicles become invisible (state exists but no rendering). Game runs normally.

### State PR (BLOCKOUT-03)

- **Rollback**: Delete `blockoutVehicleState.ts`. Remove `blockoutVehicles` field from `GameState`. Revert `devCommands.ts` and `createInitialState.ts` changes.
- **Impact**: Blockout vehicle state is gone. Dev-spawn command no longer exists. Game runs normally.

### Movement PR (BLOCKOUT-06)

- **Rollback**: Delete `blockoutMovement.ts`. Revert `GameScene.ts` (remove blockout update call). Vehicles revert to instant movement or no movement.
- **Impact**: Blockout vehicles don't move. Game runs normally.

### VFX PR (BLOCKOUT-08)

- **Rollback**: Delete `BlockoutVfxRenderer.ts` and `blockoutVfxState.ts`. Revert `GameScene.ts`. No weapon visual effects.
- **Impact**: Firing produces no visual effect. Game runs normally.

### Damage PR (BLOCKOUT-09)

- **Rollback**: Delete `blockoutDamage.ts`. Remove HP/status fields from `BlockoutVehicleState`. Revert renderer HP bar/status badge changes.
- **Impact**: No damage behavior. VFX still plays but no HP change. Game runs normally.

### Obstacle PR (BLOCKOUT-10)

- **Rollback**: Delete `blockoutObstacle.ts` and `BlockoutObstacleRenderer.ts`. Remove obstacle flags from occupancy map. Remove dev-place-obstacle command.
- **Impact**: No blockout obstacles. Existing obstacle system unchanged. Game runs normally.

### Upgrade PR (BLOCKOUT-11)

- **Rollback**: Delete `blockoutUpgrade.ts` and `blockoutUpgradeData.ts`. Remove upgradeState from `BlockoutVehicleState`. Remove upgrade hotkeys and commands.
- **Impact**: No upgrade system. Vehicles have fixed parameters. Game runs normally.

---

## 19. Open questions for owner/GPT

1. **Blockout vehicle control scheme**: Should blockout vehicles use WASD for direct movement (arcade style) or click-to-move (RTS style) in dev mode? WASD is easier for testing feel; click-to-move matches the RTS control pattern of the civil units.

2. **Mouse aim for turret**: Should the turret follow the mouse cursor continuously, or should the player click to set the aim direction? Mouse-follow is more intuitive for testing turret rotation readability.

3. **Firing trigger**: How should weapons fire? Spacebar? Left-click? Auto-fire when aimed at target? For dev testing, a simple key binding (e.g., Space to fire) is cleanest.

4. **Max blockout vehicles**: How many blockout vehicles should be simultaneously supported? The arena map is 20x20 with 400 tiles. A reasonable limit for MVP testing is 10–20 vehicles. Performance profiling will determine the actual limit.

5. **Blockout vehicle selection**: Should blockout vehicles be selectable via click (like civil units) or via a separate UI (tab cycle, number keys)? Click-to-select is consistent with existing unit selection.

6. **Multiple vehicles of same type**: Should we allow spawning multiple vehicles with the same body+weapon combo? Yes — for readability testing, seeing two identical vehicles at different positions helps validate that visual indicators are per-vehicle, not global.

7. **Turret stabilization**: The roadmap mentions turret stabilization as an upgrade category. Should the turret counter-rotate against body rotation by default (arcade tanks typically do this) or only when the stabilization upgrade is applied?

8. **8-connectivity pathfinding**: Current BFS uses 4-connectivity. Should blockout vehicles use 8-connectivity for smoother diagonal movement? This would require modifying or extending `pathfinding.ts`.

9. **Vehicle-vehicle collision**: Should blockout vehicles collide with each other? The civil unit system uses "soft-occupied" (units don't block each other's pathfinding but can be added as blockers). For combat readability, vehicles blocking each other is important, but it adds collision detection complexity.

10. **Targeting and enemy vehicles**: The BLOCKOUT-MVP scope explicitly excludes AI/bot systems. For damage testing, we need target vehicles. Options: (a) spawn stationary "dummy" vehicles, (b) spawn vehicles that don't move or fight back, (c) allow the player to control one vehicle while others are stationary. Which approach is preferred?

---

## 20. Final recommendation

The recommended next PR after this audit is:

**BLOCKOUT-02 — Config skeleton only**

This PR adds typed profile contracts and data for all 7 body profiles, all 11 weapon profiles, vehicle compositions, movement profiles, recoil profiles, VFX profiles, damage profiles, obstacle profiles, and upgrade definitions. It includes comprehensive unit tests verifying data completeness and cross-reference validity.

No runtime code consumes these profiles yet. The game runs identically before and after the PR. This is the safest possible first step and establishes the data contracts that all subsequent implementation PRs will depend on.

After BLOCKOUT-02 is reviewed and merged, the implementation sequence should proceed in order: BLOCKOUT-03 (state), BLOCKOUT-04 (renderer), BLOCKOUT-05 (turret), BLOCKOUT-06 (movement), BLOCKOUT-07 (recoil), BLOCKOUT-08 (VFX), BLOCKOUT-09 (damage), BLOCKOUT-10 (obstacles), BLOCKOUT-11 (upgrades), BLOCKOUT-12 (sandbox).

Each PR must pass full validation (typecheck, test, build, qa:smoke) and must not modify files outside its allowed scope.
