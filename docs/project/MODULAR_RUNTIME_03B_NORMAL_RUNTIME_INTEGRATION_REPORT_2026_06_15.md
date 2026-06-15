# MODULAR-RUNTIME-03B: Normal Runtime Integration Report

**Date:** 2026-06-16  
**Scope:** Route normal runtime modular-combat visual path through clean modular adapter  
**Status:** Implementation complete with fixups, pending QA and GPT review

## Summary

MODULAR-RUNTIME-03B extends the clean modular vehicle rendering pipeline (established in 03A for Arena devtools/demo) to the normal game runtime. When `ENABLE_MODULAR_VEHICLE_RENDER` is on, the normal-runtime modular-combat tank (Wasp + Smoky) renders through `composeModularVehicle()` using `modular_hull_*` / `generated_turret_*` namespace instead of the legacy `generated_hull_*` / `wasp_m0_hull_*` path. The existing legacy path remains as fallback when the flag is off or assets are not yet loaded.

## Fixup Changes (this revision)

### 1. Removed accidental tool-results files
- `tool-results/read_1781541301303_0efcb73cf696.txt` and `tool-results/read_1781541313132_b5f62307dcf2.txt` are no longer in the PR diff.

### 2. Retry/resync after asset loading
- **Problem**: `EntityRenderer.renderStaticEntities()` places modular-combat once. If `placeModularCombat()` requests assets but `plan.available !== true`, it falls back to legacy and never retries when textures load.
- **Fix**: `ModularVehicleLiveAdapter` stores a `PendingModularCombat` entry when assets are not ready at place time. `EntityRenderer.syncFromState()` calls `ModularTankRenderer.retryCleanModular()` each frame while the flag is on and a pending entry exists. Once `plan.available` becomes true, the adapter applies the modular plan, the renderer suppresses legacy hull/turret visuals, and the pending entry is cleared. Legacy visuals remain visible during loading — no entity disappears.

### 3. Toggle-off clears normal runtime modular sprites
- **Problem**: GameScene toggle-off only called `blockoutVehicleRenderer.clearModularVehicleRender()`. 03B creates a separate adapter in EntityRenderer.
- **Fix**: Added `EntityRenderer.clearModularVehicleRender()` which delegates to `ModularTankRenderer.clearModularVehicleRender()`, which calls `adapter.hideVehicle(entityId)` and restores legacy hull/turret visibility. GameScene `onLiveRenderToggle(false)` now calls both `blockoutVehicleRenderer.clearModularVehicleRender()` and `entityRenderer.clearModularVehicleRender()`.

### 4. Wording fix
- Turrets use `generated_turret_*` namespace (not `modular_turret_*`). Hulls use `modular_hull_*`. Report and comments corrected.

## Current Normal Runtime Path Found

The normal runtime has a single modular-combat entity rendered by `ModularTankRenderer.place()`, called once from `EntityRenderer.renderStaticEntity()` during game initialization. The tank is static (no per-frame position updates unless the debug tuner changes direction).

**Legacy path** (pre-03B):
- `ModularTankRenderer.place(entity)` → prefers `generated_hull_*` if loaded, falls back to `wasp_m0_hull_*`
- Turret uses `smoky_m0_turret_*` (legacy 8-direction)
- Depth via `computeDepthValue()`
- Per-bodyDir offset tables for hull position and turret mount
- Debug overlay via `ModularTankDebugOverlay`

## Files Changed

| File | Change |
|------|--------|
| `src/modular/normalCombatToModularVisual.ts` | **New** — Normal-runtime entity → ModularVehicleVisual mapper |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | Added `placeModularCombat()`, `retryCleanModular()`, `setPendingDepth()`, `hasPendingCombat()`, `setNormalRuntimeDepth()`, `updateDirection()`, `PendingModularCombat` interface |
| `src/phaser/render/ModularTankRenderer.ts` | Guarded integration: tries clean modular first, falls back to legacy; `retryCleanModular()`, `clearModularVehicleRender()` |
| `src/phaser/render/EntityRenderer.ts` | Creates `ModularVehicleLiveAdapter`, passes to renderer; `syncFromState()` calls `retryCleanModular()`; `clearModularVehicleRender()` |
| `src/phaser/GameScene.ts` | `onLiveRenderToggle(false)` clears both Arena and normal runtime modular sprites |
| `src/__tests__/modularRuntime03b.test.ts` | **New** — Tests for 03B including retry/resync and toggle-off |
| `docs/project/CURRENT_NEXT_STEP.md` | Updated with 03B status |
| `docs/project/MODULAR_RUNTIME_03B_NORMAL_RUNTIME_INTEGRATION_REPORT_2026_06_15.md` | **New** — This report |

## Mapping Design

`normalCombatToModularVisual.ts` maps the normal runtime's `RenderableEntity` + `ModularCombatUnit` fields to `ModularVehicleVisual`:

- `chassis` (e.g., 'wasp') → `hullId` via `bodyIdToModularHullId()` (reused from 03A)
- `weapon` (e.g., 'smoky') → `turretId` via `weaponIdToModularTurretId()` (reused from 03A)
- `faction` → `faction` via `factionToModularFactionId()` (reused from 03A)
- `mod` (e.g., 'm0') → `hullMod`/`turretMod` via `modStringToModularMod()`
- `dir` (0–7 dir8) → `hullDir16` via `dir8ToDir16()`
- `turretDir` (0–7 dir8) → `turretDir16` via `dir8ToDir16()`

Defaults: `dir=2` (S), `turretDir=dir`, `mod='m0'`, `faction='cyan'`. Unknown values return null visual with failReason instead of throwing.

## Adapter/Reuse Design

Instead of extracting a shared adapter class (overengineering for a single-entity path), 03B adds methods to the existing `ModularVehicleLiveAdapter`:

- `placeModularCombat()` — called once at entity placement; stores `PendingModularCombat` if assets not ready
- `retryCleanModular()` — called each frame from `syncFromState()` while pending; applies modular plan once assets load
- `setPendingDepth()` — stores computed depth for later retry
- `hasPendingCombat()` — whether a pending entity exists
- `setNormalRuntimeDepth()` — sets absolute depth (normal runtime uses `computeDepthValue()`, not the Arena's `BLOCKOUT_DEPTH + depthIndex` scheme)
- `updateDirection()` — handles `setBodyDir()`/`setTurretDir()` via `composeModularVehicle()` re-computation

The `ModularTankRenderer` stores a reference to the adapter and the entity ID when using the clean modular path, and delegates direction changes through the adapter.

## Feature Flag Behavior

`ENABLE_MODULAR_VEHICLE_RENDER` (same flag as 03A):

- **Flag off** (default): Normal runtime uses the existing `generated_hull_*` / `wasp_m0_hull_*` path. Arena devtools uses `BlockoutVehicleRenderer` legacy path. No modular sprites created.
- **Flag on**: Both Arena devtools (03A) and normal runtime (03B) attempt clean modular rendering. If `plan.available === true`, uses `modular_hull_*` + `generated_turret_*`. If assets not loaded, falls back to legacy.
- **Toggle off**: Both Arena and normal runtime modular sprites are hidden via `clearModularVehicleRender()`. Legacy visuals are restored.

## Fallback Behavior

- If `ENABLE_MODULAR_VEHICLE_RENDER` is false: legacy path runs unchanged.
- If mapping fails (unknown chassis/weapon/faction): falls back to legacy.
- If `plan.available !== true` (assets loading or missing): falls back to legacy. Legacy visuals remain visible. `PendingModularCombat` is stored for retry.
- If clean modular succeeds: only the legacy hull+turret sprites are suppressed; overlays/debug chrome remain.
- `retryCleanModular()` is called each frame until assets load or flag is turned off.

## Toggle-off Behavior

When `ENABLE_MODULAR_VEHICLE_RENDER` is toggled OFF:
1. `GameScene.onLiveRenderToggle(false)` calls `blockoutVehicleRenderer.clearModularVehicleRender()` (Arena/03A)
2. `GameScene.onLiveRenderToggle(false)` calls `entityRenderer.clearModularVehicleRender()` (normal runtime/03B)
3. `EntityRenderer.clearModularVehicleRender()` → `ModularTankRenderer.clearModularVehicleRender()`
4. `ModularTankRenderer.clearModularVehicleRender()` calls `adapter.hideVehicle(entityId)` and restores legacy hull/turret visibility (`usingCleanModular = false`, `hull.setVisible(true)`, `turret.setVisible(true)`)
5. No modular sprites remain visible. Legacy visuals are fully restored.

## What Was Intentionally Not Changed

- BlockoutVehicleRenderer / Arena demo (03A) behavior unchanged
- ModularTankDebugOverlay still works in both paths
- Combat, movement, economy, mapgen, pathfinding, save/load all unchanged
- PNG assets and generated metadata unchanged
- ModularPreviewCalibration not used in live runtime
- Legacy `generated_hull_*` path still available as fallback
- `ModularTankRenderer.updateVisuals()` still works for the debug tuner
- Existing 03A tests all pass unchanged
- No tool-results files in the PR diff

## Tests

- New tests in `modularRuntime03b.test.ts`
- Key test areas:
  - `dir8ToDir16` conversion (9 tests)
  - `modStringToModularMod` conversion (6 tests)
  - `normalCombatToModularVisual` mapping (12 tests)
  - End-to-end: normalCombat → composeModularVehicle (3 tests)
  - Feature flag behavior (4 tests)
  - Retry/resync after asset loading (8 tests)
  - Toggle-off clears normal runtime modular sprites (4 tests)
  - Lazy loading constraint (2 tests)
  - No preview calibration (2 tests)
  - 03A mapping helper reuse (2 tests)
  - Namespace correctness (2 tests)

## Manual QA Plan

### A. Flag off (default)
- Normal runtime renders exactly as before (generated hull or legacy Wasp)
- Arena devtools works as after 03A
- No modular sprites visible in normal runtime

### B. Flag on
- Normal runtime modular-combat entity attempts modular rendering
- If assets loading, legacy fallback visible
- Once loaded, modular hull/turret replaces old body/turret (retry mechanism)
- HP/selection/shadow/labels remain (normal runtime has no vehicle overlays currently)
- No double render after toggle off
- No entity disappears during load
- Debug tuner still works for direction changes

### C. Visual cases
- Wasp + Smoky + cyan + m0
- Dictator + Railgun (1.09 hull scale)
- All 4 factions if available in normal runtime data

### D. Toggle-off
- Flag ON → assets load → modular visible → Flag OFF
- No modular sprites persist
- Legacy hull/turret fully restored

### E. Regression
- Modular Preview / Calibration still works (devtools-only)
- 03A Arena Live Render still works
- Normal runtime fallback still works when flag off

## Risks / Rollback

- **Risk**: If `composeModularVehicle()` positioning differs from the offset-table approach in `ModularTankRenderer`, the tank may appear at a different screen position when the flag is on.
  - **Mitigation**: The flag defaults to false, so the legacy path is the default. Visual QA must confirm positioning before the flag is enabled in production.
- **Rollback**: Set `ENABLE_MODULAR_VEHICLE_RENDER = false` (default). The entire 03B code path is gated by this flag. No code removal needed.

## Next Recommended Step

MODULAR-RUNTIME-03C — optional cleanup of legacy Wasp/Smoky/proof harness after QA acceptance of 03B modular rendering.
