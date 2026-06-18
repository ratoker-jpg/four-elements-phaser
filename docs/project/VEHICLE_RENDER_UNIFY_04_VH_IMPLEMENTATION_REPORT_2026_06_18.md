# VEHICLE-RENDER-UNIFY-04-VH — Stage 4 Implementation Report

**Date:** 2026-06-18
**Project:** Four Elements Phaser
**Branch:** `vehicle-render-unify-04-vh`
**PR:** #302
**Base:** `main` @ `ab0fa1f2`
**Mode:** Very High risk implementation — DRAFT PR

---

## 1. Summary

Stage 4 extracts render orchestration from GameScene into RenderManager. RenderManager owns all 18 renderer fields, construction order, per-frame sync orchestration (via 3 phase methods), visual-state bridge methods, and destroy order. GameScene retains scene lifecycle, gameplay state, input controllers, UI panels, camera, and placement handlers.

---

## 2. Files changed (4)

**New (3):**
- `src/phaser/render/RenderManager.ts` (472 lines) — owns all 18 renderer fields + create + 3 phase sync methods + bridge methods + destroy
- `src/__tests__/renderManager.test.ts` (242 lines, 46 tests) — contract tests
- `docs/project/VEHICLE_RENDER_UNIFY_04_VH_IMPLEMENTATION_REPORT_2026_06_18.md` — this report

**Modified (1):**
- `src/phaser/GameScene.ts` (1361 → 1164 lines, −197 lines)

---

## 3. Renderers moved to RenderManager (18)

Terrain, Industrial, Entity, Building, Feedback, MotionFx, DebugOverlay, BlockoutVehicle, BlockoutWeaponVfx, BlockoutDamage, BlockoutObstacle, BlockoutUpgrade, BlockoutSandboxHud, CameraProjectionDebug, GeneratedModular, ModularDevtoolsPanel, AssetPreviewTool, AssetPreviewPanel

---

## 4. What stayed in GameScene and why

| Item | Reason |
|------|--------|
| PlaytestHud | UI panel (DOM overlay), event-driven, calls back into GameScene for build/produce |
| ArenaMenu | UI panel (DOM overlay), event-driven, calls back into GameScene for placement/selection |
| PauseMenu | UI panel (DOM overlay), calls back into GameScene for save/load/restart |
| DevtoolsPanel | UI panel (DOM overlay), calls back into GameScene for commands |
| BlockoutVehicleInputController | Input controller (not a renderer), feeds visual state to RenderManager |
| CameraControls | Camera (not a renderer) |
| GameInputController | Input controller (not a renderer) |
| PlacementMarker | Gameplay input (not render) |
| ReservationMap | Gameplay state |

---

## 5. Phase methods and lifecycle order

### Construction (RenderManager.create):
Exact same order as original GameScene.create() — terrain, industrial, entity, building, feedback, motion, debug, asset preview, modular devtools, blockout vehicle/VFX/damage/obstacle/upgrade, sandbox HUD, camera projection.

### Per-frame sync (3 phase methods called from GameScene.update):
1. `syncCivilRenderState(state, timeNow)` — entity, building, debug, feedback, motion, assetPreview
2. `syncBlockoutInputVisualState(state, hoveredId, selectedId, arenaMode)` — hover/target visual state
3. `syncBlockoutRenderState(state, timeNow, selectedId, devtoolsActive, arenaMode)` — blockout vehicle/VFX/damage/obstacle/upgrade/sandbox

### Visual-state bridges:
- `setSelectedVehicleId(id)` — called when selection changes
- `toggleSandboxHelp()` — called when help hotkey pressed
- `toggleCameraProjectionDebug()` — called when calibration hotkey pressed

### Destroy (RenderManager.destroy):
Preserves original GameScene.shutdown() order (not exact reverse of construction — the original shutdown order was already not reverse-of-construction). Verified by comparing RenderManager.destroy() against original GameScene.shutdown() from main: all 18 renderer destroy calls appear in the same relative order.

---

## 6. FIXUP-1 and FIXUP-2 summary

### FIXUP-1: RenderManager owns sync orchestration
- Replaced single `syncFromState()` with 3 phase methods
- GameScene.update() delegates sync through phase methods instead of direct renderer calls
- All 15 direct sync calls replaced

### FIXUP-2: CI failure fix + contract cleanup
- Root cause: TS6133 noUnusedLocals — 9 unused getter declarations after sync calls moved to RenderManager
- Removed 9 unused getters from GameScene
- Added 2 bridge methods to RenderManager: `toggleSandboxHelp()`, `toggleCameraProjectionDebug()`
- Routed visual-state calls through RenderManager instead of direct renderer access
- Removed orphaned JSDoc for old `syncFromState()` method

---

## 7. Validation results

- npm run typecheck: PASS
- npm test: PASS — 92 files, 4683 tests
- GitHub Actions: ALL GREEN (build-and-deploy + qa-smoke + Graphify)
- git diff --check: PASS
- token/secret scan: PASS

---

## 8. Risk matrix

| Risk | Severity | Mitigation |
|------|----------|------------|
| Invisible units | Low | Same sync order preserved |
| Blockout/cube fallback regression | Low | No adapter/sticky changes |
| z-depth regression | Low | Sync order preserved |
| Arena/runtime divergence | Low | Conditional creation preserved |
| Shutdown/memory leak | Medium | Destroy order preserved; tested |
| Scene restart bugs | Medium | RenderManager null-safe after destroy |
| QA smoke regression | Low | CI green |

---

## 9. Rollback plan

Revert PR #302. Restores GameScene to original 1361-line state with direct renderer ownership. Safe because:
- RenderManager is new code (deleting is safe)
- No renderer source files changed
- No gameplay state changed

---

## 10. Manual QA checklist

1. Standard game mode
2. Devtools Arena mode
3. No default debug artifacts
4. All 4 factions render correctly
5. No silent cyan recolor
6. No old Wasp M0 forced as default
7. No persistent blockout cubes
8. No missing turret
9. No flicker back to cubes
10. Hulls: wasp, hunter, titan, dictator
11. Turrets: smoky, ricochet, railgun, thunder
12. Dictator +9% hull only
13. z-depth unchanged
14. Placement unchanged
15. Devtools panels work
16. Asset preview works
17. Pause/menu flow works
18. Scene restart/shutdown clean
