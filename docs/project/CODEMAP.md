# CODEMAP.md — Four Elements Phaser

Status: routing map for AI agents  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-12

---

## 1. Purpose

This document maps the current repository to practical responsibilities so GPT / GLM / Codex / Claude / Opus can route tasks to the right files without repeatedly scanning the whole project.

Use this file as a **routing map**, not as a replacement for source-of-truth docs or source code.

Future tasks should start with:

```text
Read docs/project/CODEMAP.md first.
Use it as routing map.
Do not scan the whole repository unless CODEMAP is insufficient.
```

---

## 2. Required docs before work

Always read the current workflow/state docs for project rules:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md
```

For visual / render / world-space / asset placement tasks, also read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

For Arena/core mechanics tasks, also read the relevant closure/reference docs:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

Historical roadmap/audit docs are references only. Do not treat closed roadmap docs as active implementation queues unless Denis explicitly reopens them.

---

## 3. Current operational mode

Current project mode:

```text
NO ACTIVE IMPLEMENTATION ROADMAP.
DOCS/PLANNING SEQUENCE ACTIVE BEFORE NEXT BUGFIX IMPLEMENTATION.
```

Owner-selected sequence:

```text
1. AI execution workflow docs PR.              DONE
2. CODEMAP docs PR.                            THIS DOC
3. Collect current bugs/polish into fix roadmap/backlog.
4. Run GLM audit on that fix roadmap/backlog.
5. Split accepted audit into High / High+ steps.
6. Implement steps through Claude/Opus or Codex.
7. Use GLM mainly for patch apply / validation / PR delivery.
8. GPT reviews PRs.
9. Denis performs final visual/manual QA and decides merge/no-merge.
```

Do not resume turret/grid/visual implementation until this CODEMAP step is merged and the fix roadmap/backlog process is started or Denis explicitly overrides.

---

## 4. Project entrypoints

| Area | Files | Notes |
|---|---|---|
| App bootstrap | `src/main.ts` | Starts Phaser app / scene stack. Read before changing scene registration or app boot. |
| Phaser boot/preload | `src/phaser/BootScene.ts`, `src/phaser/PreloadScene.ts` | Asset loading and startup path. Read before changing preload or asset keys. |
| Main menu | `src/phaser/MainMenuScene.ts` | Main menu UX and routing into setup/load flows. |
| New game setup | `src/phaser/NewGameSetupScene.ts`, `src/state/gameSetup.ts` | Map/faction/setup config and GameScene start data. |
| Main runtime scene | `src/phaser/GameScene.ts` | Orchestrates state updates, renderers, input, HUD. Must remain orchestration-only. |
| Preview/dev scenes | `src/phaser/Visual02aPreviewScene.ts`, `src/phaser/Visual03aPreviewScene.ts`, `src/phaser/Visual04aPreviewScene.ts` | Historical/preview utility scenes. Do not treat as production runtime unless task says so. |

Rule:

```text
GameScene wires systems and calls updates/render sync.
Do not move gameplay rules into GameScene unless the accepted audit explicitly allows it.
```

---

## 5. Source areas

| Directory | Responsibility | Read when |
|---|---|---|
| `src/phaser/` | Phaser scenes, renderers, input, UI panels, dev/debug tools | Runtime visuals, input, scene lifecycle, preview/debug UI. |
| `src/phaser/render/` | Phaser render-only layer | Terrain, entities, buildings, blockout vehicles, VFX, debug overlays. |
| `src/phaser/input/` | Input controllers | Click commands, camera controls, selected unit commands, Arena target-lock. |
| `src/phaser/ui/` | DOM/Phaser UI widgets | Main menu panels, Arena menu, HUD overlays, dev panels. |
| `src/phaser/debug/`, `src/phaser/dev/` | Debug/calibration/dev tools | Wasp calibration, asset preview, debug overlays. |
| `src/state/` | Pure TypeScript game state and systems | Economy, movement, construction, targeting, AI, save/load. No Phaser imports. |
| `src/config/` | Static configs and projection/data contracts | Camera projection, movement/weapon/body/building/resource config. |
| `src/assets/` | Asset manifest helpers and generated asset key helpers | Texture key mapping, generated hull/modular unit assets, diagnostics. |
| `src/__tests__/` | Vitest tests | Use as safety net and examples for state/system behavior. |
| `tools/` | Build/asset/QA scripts | `qa:smoke`, asset validation/generation tools. |
| `docs/project/` | Current docs, roadmaps, audits, closure reports | Planning, workflow, accepted decisions. |

---

## 6. Core state model map

| System | Primary files | Notes |
|---|---|---|
| Global state model | `src/state/types.ts` | Pure TS model for terrain, resources, buildings, builders, harvesters, construction, renderable entities. |
| Initial state | `src/state/createInitialState.ts` | Builds runtime state from map/setup. Also contains legacy/static modular-combat setup. |
| Main update loop | `src/state/updateGameState.ts` | Civil/core state update path. |
| Map setup | `src/state/gameSetup.ts`, `src/state/generatedMap.ts` | Map choice, mapStyle/resourceStyle, generated map data. |
| Validation | `src/state/mapValidation.ts` | Map invariants. |
| Save/load | `src/state/saveGame.ts`, related save/load helpers | Local save flow. Avoid touching in visual tasks. |
| UI settings | `src/state/uiSettings.ts` | UI scale/settings. |
| Dev commands | `src/state/devCommands.ts` | Devtools enablement / commands. |

Layer boundary:

```text
State layer should stay Phaser-free.
Renderer reads state and renders visuals.
Input creates commands or state changes according to accepted systems.
```

---

## 7. Civil/core mechanics map

| Task/system | First files to read | Notes |
|---|---|---|
| Harvesting | `src/state/harvester.ts`, `src/state/types.ts`, `src/config/coreMechanicsTypes.ts` | Harvester phase machine, resource collection/delivery. |
| Builder/construction | `src/state/builder.ts`, `src/state/construction.ts`, `src/state/types.ts` | Builder assignment, construction progress, site lifecycle. |
| Economy/resources | `src/state/economy.ts`, `src/state/types.ts`, `src/config/coreMechanicsTypes.ts` | Raw/matter/elements/power flow. Verify exact filenames before editing; do not assume old economy model. |
| Production/factory | `src/state/production.ts`, `src/state/types.ts` | Unit production queues and costs. Verify exact current implementation before editing. |
| Occupancy/reservation | `src/state/occupancy.ts`, `src/state/tileReservation.ts` | Tile blockers, reservation age, no-overlap rules. |
| Movement | `src/state/blockoutMovement.ts`, `src/state/movementStateMachine.ts`, `src/config/blockoutMovementData.ts` | Grid/arcade movement, bodyAngle updates, collision/reservation coupling. |

If a file listed here has moved or been renamed, search the exact symbol before editing. Mark unknowns in the task report instead of guessing.

---

## 8. Render pipeline map

| Render area | Primary files | Notes |
|---|---|---|
| Terrain | `src/phaser/render/TerrainRenderer.ts` | Ground/terrain visual rendering. Respect industrial/sand fallback paths. |
| Industrial frame/background | `src/phaser/render/IndustrialFrameRenderer.ts` | Production industrial map frame/background layer. |
| Flattened entities | `src/phaser/render/EntityRenderer.ts` | HQ/builders/harvesters/resources/static modular-combat render path. |
| Building status | `src/phaser/render/BuildingStatusRenderer.ts` | Construction/building status overlays. |
| Construction visuals | `src/phaser/render/ConstructionRenderer.ts` | Construction site rendering. |
| Feedback indicators | `src/phaser/render/FeedbackRenderer.ts` | Command indicators/resource feedback. |
| Motion VFX | `src/phaser/render/UnitMotionFxRenderer.ts`, `src/state/motionFx.ts` | Dust/motion feedback. |
| Blockout vehicles | `src/phaser/render/BlockoutVehicleRenderer.ts` | Arena/dev combat vehicles, hulls, selection rings, labels, HP/resource bars, procedural turret/barrel. |
| Blockout geometry | `src/phaser/render/blockoutVehicleGeometry.ts` | Shared geometry for body/turret/barrel/mount projection. Use as source of truth for turret/barrel geometry. |
| Blockout VFX | `src/phaser/render/BlockoutWeaponVfxRenderer.ts`, `src/phaser/render/BlockoutDamageRenderer.ts` | Weapon fire and damage feedback. |
| Obstacles/upgrades | `src/phaser/render/BlockoutObstacleRenderer.ts`, `src/phaser/render/BlockoutUpgradeRenderer.ts` | Arena obstacle/upgrade visuals. |
| Sandbox HUD | `src/phaser/render/BlockoutSandboxHudRenderer.ts` | Arena/debug help/status display. |
| Projection debug | `src/phaser/render/CameraProjectionDebugRenderer.ts` | Existing dev-only projection overlay. Good reference for grid/debug overlay tasks. |
| Static modular tank visual | `src/phaser/render/ModularTankRenderer.ts` | Legacy/static debug Wasp+Smoky visual path. Reference only unless task says otherwise. |

Visual/world-space tasks must use `docs/project/CAMERA_PROJECTION_CONTRACT.md` and `src/config/cameraProjectionContract.ts`.

---

## 9. Camera/projection map

| File | Responsibility |
|---|---|
| `docs/project/CAMERA_PROJECTION_CONTRACT.md` | Human-readable projection source of truth. |
| `src/config/cameraProjectionContract.ts` | Pure TS projection helpers: `projectGroundPoint`, `projectWorldPoint`, `projectGroundRect`, `projectGroundCircleToPolyline`, `unprojectScreenToGround`. |
| `src/phaser/render/isometric.ts` | Runtime tile/screen conversion helpers. Verify relation to projection contract before editing. |
| `src/phaser/input/CameraControls.ts` | Camera pan/zoom controls. |
| `src/phaser/render/CameraProjectionDebugRenderer.ts` | Existing projection debug overlay. |

Non-negotiables:

```text
- fixed isometric / axonometric 2.5D
- camera can pan/zoom, cannot rotate
- no top-down screen-space circles for ground objects
- ground markers/rings/shadows/ranges/footprints must be projected on ground plane
```

---

## 10. Arena/control/combat map

| System | First files to read | Notes |
|---|---|---|
| Arena mode enable/context | `src/state/devArena.ts`, `src/state/arenaModeContext.ts`, `src/phaser/GameScene.ts` | Arena map, spawn helpers, context. |
| Arena menu/composer | `src/phaser/ui/ArenaMenu.ts`, `src/phaser/ui/ArenaUnitComposer.ts` | Manual unit creation UX: body + weapon + team. |
| Arena placement | `src/state/arenaPlacement.ts`, `src/phaser/GameScene.ts` | Click-to-placement tile conversion and hover tile. |
| Blockout vehicle state | `src/state/blockoutVehicleState.ts` | Runtime vehicle fields: body/weapon/team, bodyAngle, turretAngle, targetVehicleId, weapon state. |
| Blockout input | `src/phaser/input/BlockoutVehicleInputController.ts` | Selection, RMB move/attack, S stop, target-lock, debug keys. |
| Movement | `src/state/blockoutMovement.ts`, `src/state/movementStateMachine.ts` | bodyAngle updates, movement phases. |
| AI | `src/state/blockoutAi.ts` | Enemy acquire/engage/passive/chaser/hold behavior. |
| Targeting | `src/state/combatTargeting.ts` | `targetVehicleId` validation/clearing and target-lock invariants. |
| Weapon config | `src/config/weaponData.ts`, `src/config/bodyData.ts` | Weapon/body runtime data. Verify current exact files before editing. |
| Fire coordinator | `src/state/weaponFireCoordinator.ts`, `src/state/blockoutWeaponVfx.ts`, `src/state/blockoutDamage.ts`, `src/state/combatHitModel.ts` | Fire/damage/recoil/VFX path. |
| Arena tests | `src/__tests__/combatCore.test.ts`, `src/__tests__/blockoutMovement.test.ts`, `src/__tests__/step06MovementOccupancy.test.ts` | Read before changing combat/movement behavior. |

Known current bugfix context:

```text
- PR #245 depth-only turret fix failed preview.
- PR #246 Smoky turret sprite appeared but mount/rotation was wrong in preview.
- Current accepted direction: do not keep tuning offsets blindly; collect into fix roadmap/backlog first.
```

---

## 11. Body/turret routing map

Read these first for turret/body/mount tasks:

```text
src/state/blockoutVehicleState.ts
src/state/blockoutMovement.ts
src/state/movementStateMachine.ts
src/state/combatTargeting.ts
src/state/blockoutAi.ts
src/phaser/input/BlockoutVehicleInputController.ts
src/phaser/render/BlockoutVehicleRenderer.ts
src/phaser/render/blockoutVehicleGeometry.ts
src/phaser/render/ModularTankRenderer.ts
src/assets/generatedHullAssets.ts
src/assets/modularUnitAssets.ts
src/config/worldConfig.ts
src/config/unitRenderConfig.ts
src/config/weaponData.ts
```

Important distinction:

```text
Arena path = BlockoutVehicleRenderer + BlockoutVehicleState + continuous bodyAngle/turretAngle.
Legacy/static debug path = ModularTankRenderer + RenderableEntity modular-combat + discrete dir/turretDir.
```

Do not route controllable Arena vehicles through `ModularTankRenderer` without a specific accepted audit. It is a reference/calibration path, not the Arena runtime path.

---

## 12. Generated hull / modular asset map

| System | Files | Notes |
|---|---|---|
| Generated hull assets | `src/assets/generatedHullAssets.ts` | Texture keys, hull scale/origin/placement offsets, direction remap helpers. Do not change Wasp calibration casually. |
| Modular unit assets | `src/assets/modularUnitAssets.ts` | Legacy modular hull/turret texture keys such as Smoky turret keys. |
| Asset manifest | `src/assets/assetManifest.ts` | Core texture key manifest. |
| Asset diagnostics | `src/assets/assetDiagnostics.ts` | Missing asset/report helpers. |
| Preload | `src/phaser/PreloadScene.ts` | Only place to add runtime asset loads. Avoid broad/full-matrix preloads. |
| Wasp placement calibrator | `src/phaser/debug/WaspHullPlacementCalibrator.ts`, `src/phaser/debug/WaspPlacementCalibrationPanel.ts` | Debug calibration tools. Do not remove during visual fixes. |

Asset task hard rule:

```text
Do not preload full hull/turret matrices unless a specific accepted asset/runtime audit approves it.
```

---

## 13. Devtools/debug map

| Tool | Files | Notes |
|---|---|---|
| Devtools enablement | `src/state/devCommands.ts`, `src/phaser/ui/DevtoolsPanel.ts` | Dev command panel / devtools state. |
| Asset preview | `src/phaser/dev/AssetPreviewTool.ts`, `src/phaser/dev/AssetPreviewPanel.ts` | Dev-only asset preview. |
| Projection debug | `src/phaser/render/CameraProjectionDebugRenderer.ts` | Existing `C` projection debug overlay. |
| Wasp calibration | `src/phaser/debug/WaspHullPlacementCalibrator.ts`, `src/phaser/debug/WaspPlacementCalibrationPanel.ts` | Wasp generated hull placement calibration. |
| Modular debug overlay | `src/phaser/debug/ModularTankDebugOverlay.ts` | Static modular-combat body/turret debug controls. |
| Future dev grid | `src/phaser/render/IsoGridDebugRenderer.ts` | Proposed new file, not present at CODEMAP creation time. Verify before editing. |

For dev-only visual debugging, prefer additive debug overlays behind a devtools flag. Production map visuals must remain clean.

---

## 14. Common task routing

### Visual generated hull task

Read first:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
src/phaser/render/BlockoutVehicleRenderer.ts
src/assets/generatedHullAssets.ts
src/phaser/debug/WaspHullPlacementCalibrator.ts
src/phaser/debug/WaspPlacementCalibrationPanel.ts
src/phaser/render/blockoutVehicleGeometry.ts
```

Avoid:

```text
combat damage, pathfinding, economy, save/load, map generation, broad asset preload changes
```

### Turret / mount / target-lock task

Read first:

```text
src/state/blockoutVehicleState.ts
src/state/combatTargeting.ts
src/state/blockoutAi.ts
src/phaser/input/BlockoutVehicleInputController.ts
src/phaser/render/BlockoutVehicleRenderer.ts
src/phaser/render/blockoutVehicleGeometry.ts
src/phaser/render/ModularTankRenderer.ts
src/assets/generatedHullAssets.ts
src/assets/modularUnitAssets.ts
src/config/worldConfig.ts
src/config/unitRenderConfig.ts
src/config/weaponData.ts
```

Also read relevant tests before behavior changes:

```text
src/__tests__/combatCore.test.ts
src/__tests__/blockoutMovement.test.ts
src/__tests__/step06MovementOccupancy.test.ts
```

### Dev grid / debug overlay task

Read first:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
src/config/cameraProjectionContract.ts
src/phaser/render/CameraProjectionDebugRenderer.ts
src/phaser/GameScene.ts
src/phaser/input/BlockoutVehicleInputController.ts
src/phaser/render/BlockoutVehicleRenderer.ts
```

### Arena unit behavior task

Read first:

```text
src/state/devArena.ts
src/state/arenaModeContext.ts
src/state/arenaPlacement.ts
src/state/blockoutVehicleState.ts
src/state/blockoutMovement.ts
src/state/blockoutAi.ts
src/state/combatTargeting.ts
src/phaser/input/BlockoutVehicleInputController.ts
src/phaser/GameScene.ts
src/phaser/ui/ArenaMenu.ts
```

### Asset preload task

Read first:

```text
src/phaser/PreloadScene.ts
src/assets/assetManifest.ts
src/assets/generatedHullAssets.ts
src/assets/modularUnitAssets.ts
src/assets/assetDiagnostics.ts
```

Avoid:

```text
full matrix preload, unrelated asset paths, PNG edits without explicit asset task
```

### Camera/projection task

Read first:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
src/config/cameraProjectionContract.ts
src/phaser/render/isometric.ts
src/phaser/input/CameraControls.ts
src/phaser/render/CameraProjectionDebugRenderer.ts
```

### Economy / production task

Read first:

```text
src/state/types.ts
src/state/updateGameState.ts
src/state/construction.ts
src/state/builder.ts
src/state/harvester.ts
src/state/economy.ts
src/state/production.ts
src/config/coreMechanicsTypes.ts
src/phaser/ui/PlaytestHud.ts
```

Verify exact current filenames before editing; if missing, search symbols rather than guessing.

### Tests / QA task

Read first:

```text
package.json
tools/qa_smoke.mjs
src/__tests__/
```

Validation baseline:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

---

## 15. Hard boundaries for visual tasks

Visual/render/asset placement tasks must not touch these unless the task explicitly says so and an accepted audit covers it:

```text
src/state/blockoutMovement.ts
src/state/movementStateMachine.ts
src/state/occupancy.ts
src/state/tileReservation.ts
src/state/weaponFireCoordinator.ts
src/state/combatHitModel.ts
src/state/blockoutDamage.ts
src/state/saveGame.ts
src/state/updateGameState.ts
src/state/harvester.ts
src/state/builder.ts
src/state/construction.ts
src/state/economy.ts
src/state/production.ts
src/state/generatedMap.ts
```

Do not change:

```text
- gameplay damage/cooldowns/recoil/hit logic
- pathfinding/occupancy/reservation
- economy/production/save-load
- map generation/resource placement
- Wasp generated hull scale/placement/direction remap
- assets/PNG files
- broad preload policy
```

If a visual fix appears to require touching these systems, stop and request a scoped audit/update.

---

## 16. PR/review routing checklist

Before GPT recommends merge, inspect:

```text
- PR state/open/closed/merged
- base/head branch and SHA
- changed files
- diff scope
- forbidden files touched?
- validation status
- PR body vs actual diff
- manual QA notes for visual/runtime work
- preview URL when available
```

Do not recommend merge based only on an agent summary.

Visual/runtime PRs need Denis visual/manual QA even if tests pass.

---

## 17. Agent economy rules

Use agents by role:

```text
GLM: audit, patch application, validation, PR delivery, Telegram.
Claude/Opus: expensive/high-value implementation, local patch, root-cause code work.
Codex 5.5: expensive/high-value implementation, screenshot-driven debugging, PRs when access works.
GPT: coordination, task slicing, review, merge/no-merge advice.
Denis: final product/visual QA.
```

Claude/Opus and Codex should not be burned on routine audits or patch delivery when GLM can do it.

If Claude/Opus/Codex push is blocked by 403:

```text
- retry at most once;
- then stop;
- provide patch handoff with base SHA, head SHA, changed files, validation, full git format-patch.
```

---

## 18. CODEMAP maintenance rule

Update this file when:

```text
- a major system moves files;
- a new renderer/input/state subsystem is added;
- task routing changes;
- a repeated bug shows agents are reading the wrong files;
- a new fix roadmap/audit is accepted and changes active routing.
```

Keep CODEMAP concise. It should help agents find the right files fast; it should not become a second implementation manual.
