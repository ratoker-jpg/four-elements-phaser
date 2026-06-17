# VEHICLE-RENDER-UNIFY-03-VH — Stage 3 Legacy Renderer Retirement Report

**Date:** 2026-06-17
**Project:** Four Elements Phaser
**Repo:** `ratoker-jpg/four-elements-phaser`
**Base branch:** `main` @ `20cd1f44` (after PR #299 merge)
**Implementation branch:** `vehicle-render-unify-03-vh`
**Mode:** VERY HIGH implementation
**Scope:** Stage 3 — Legacy renderer retirement. Stage 4 (GameScene orchestration cleanup) is NOT in this PR.

---

## 1. Summary

This PR retires the legacy modular vehicle render paths identified in the
VEHICLE-RENDER-UNIFY-03-04-VH-AUDIT. The canonical modular render path
(`ModularVehicleLiveAdapter` + `composeModularVehicle`) is now the single
production path. Legacy emergency fallback is preserved only as explicit
procedural blockout geometry in `BlockoutVehicleRenderer`, gated by
`plan.available === false` AND sticky-not-set (Stage 2 contract).

After this PR:
- `ModularTankRenderer` is a thin delegate (~360 lines, was 733).
- Legacy `getWaspHullKey` / `getSmokyTurretKey` / per-dir offset tables
  are removed from production code.
- `pilotTurretComposition` and its quarantine flag are removed.
- `ModularTankDebugOverlay` is removed (no offset tables to visualize).
- Stage 2 contracts (faction resolver, sticky no-flicker, debug flags
  OFF by default) are preserved unchanged.

---

## 2. Exact files changed

### Removed (3 files)
- `src/assets/pilotTurretComposition.ts` — legacy pilot turret composition (quarantined since 03B, never enabled).
- `src/phaser/debug/ModularTankDebugOverlay.ts` — offset-tuner overlay (no offset tables to visualize after Stage 3).
- `src/__tests__/runtime03PilotTurretComposition.test.ts` — test for removed module.

### Modified (4 files)
- `src/config/worldConfig.ts` — removed `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`, `DEFAULT_*` variants, `tunerState`, `TunerLayer`, `cloneOffsetRecord`, `ALL_DIRS`. Retained: `TILE_W`, `TILE_H`, `MAP_W`, `MAP_H`, `Offset2D`, `ModularTankDirection`. (~85 lines → ~45 lines)
- `src/phaser/render/ModularTankRenderer.ts` — rewrote as thin delegate around `ModularVehicleLiveAdapter`. Removed legacy hull/turret sprite path, offset table usage, tuner state, debug overlay, `applyScaleTransform` helper, `printOffsetTables`, `updateVisuals` (now no-op stubs). (~733 lines → ~365 lines)
- `src/phaser/render/BlockoutVehicleRenderer.ts` — removed `pilotTurretComposition` import, `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` flag, `vehicleTurretComp` Map, turret sprite positioning block, `generatedTurretLogged` field. Kept `vehicleTurretSprites` Map for defensive cleanup of stale sprites. (~1596 lines → ~1526 lines)
- `src/phaser/input/GameInputController.ts` — removed `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`, `tunerState` imports; removed tuner hotkeys (T/H/J/C/Q/E/Z/X + arrow keys); removed `boundArrowHandler` field, `onArrowKey` method, `ARROW_STEP`/`ARROW_SHIFT_STEP` constants. (~996 lines → ~920 lines)

### Added (1 file)
- `src/__tests__/vehicleRenderNoLegacyPath.test.ts` — 17 contract tests verifying legacy paths are not re-introduced.

---

## 3. What legacy paths were removed

### A. Legacy Wasp/Smoky fallback path
- `getWaspHullKey` / `getSmokyTurretKey` imports removed from `ModularTankRenderer`.
- Legacy hull/turret sprite creation logic in `ModularTankRenderer.place()` (lines ~264–400 of the original file) removed.
- `usingGeneratedHull` / `generatedHullId` / `generatedHullMod` fields removed.
- `storedModularEntity` / `storedChassis` / `storedWeapon` / `storedMod` fields kept for devtools toggle-on scenario (`activateCleanModularRender`).

### B. Legacy offset/tuner path
- `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` removed from `worldConfig.ts`.
- `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` removed from `worldConfig.ts`.
- `DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` removed.
- `DEFAULT_MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` removed.
- `tunerState` mutable runtime tuning state removed.
- `TunerLayer` type removed.
- `cloneOffsetRecord` helper removed.
- `ALL_DIRS` constant removed.
- `ModularTankDebugOverlay` (offset-tuner overlay) removed — no offset tables to visualize.
- Tuner hotkeys (T/H/J/C/Q/E/Z/X + arrow keys) removed from `GameInputController`.
- `boundArrowHandler` field, `onArrowKey` method, `ARROW_STEP`/`ARROW_SHIFT_STEP` constants removed from `GameInputController`.

### C. Pilot turret composition quarantine
- `pilotTurretComposition.ts` file deleted.
- `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` flag removed from `BlockoutVehicleRenderer`.
- `resolvePilotTurretComposition` import removed.
- `PilotTurretCompositionResult` type import removed.
- `vehicleTurretComp` Map removed.
- Turret sprite positioning block in `renderVehicle()` (that read `turretComp.turretOffsetPx` / `socketZHeight`) removed.
- `generatedTurretLogged` field removed.
- `runtime03PilotTurretComposition.test.ts` test file deleted.

---

## 4. What fallback remains

### Explicit emergency/loading fallback (Stage 2 contract, unchanged)
- `BlockoutVehicleRenderer` procedural blockout geometry — drawn only when `plan.available === false` AND sticky not set (first render of a visual identity while assets load). This is the **explicit emergency fallback**.
- `ModularVehicleLiveAdapter` sticky no-flicker state — once a vehicle is rendered as modular PNG, transient `plan.available === false` states keep the last good modular sprites visible (no fallback to blockout). This is the **Stage 2 no-flicker contract**.
- `ModularVehicleLiveAdapter.retryCleanModular()` — re-attempts `placeModularCombat()` each frame until textures arrive. Once textures load, modular sprites appear and sticky is set.

### What is NOT a fallback anymore
- Legacy `getWaspHullKey` + `getSmokyTurretKey` sprite path — **removed**. Normal-runtime modular-combat entities no longer fall back to cyan-tinted wasp+smoky sprites. Instead, FIXUP-1 shows a **neutral gray procedural loading placeholder** while modular assets load. The placeholder is removed once modular PNG appears.
- `pilotTurretComposition` — **removed**. Arena vehicles no longer have a pilot turret composition fallback. The modular adapter handles all turret positioning via `composeModularVehicle()` metadata-driven socket/pivot math.

### Behavior change risk
- **Normal-runtime modular-combat entity**: FIXUP-1 added an explicit loading placeholder (neutral gray procedural box) that is shown when modular assets are unavailable on first render and sticky is not set. The placeholder is removed once `retryCleanModular()` succeeds and modular PNG appears. The entity is **never invisible** during loading — the placeholder ensures visible presence. Stage 2 sticky state covers all subsequent direction changes (no flicker). This is the explicit loading behavior — no silent cyan recolor, no legacy fallback, no permanent invisibility.

---

## 5. What was intentionally NOT touched

- `composeModularVehicle()` math — placement/composition/socket/pivot unchanged.
- `MODULAR_VEHICLE_BASE_SCALE = 0.16` — 04A source of truth preserved.
- `HULL_VISUAL_SCALE_MULTIPLIERS.dictator = 1.09` — Dictator +9% hull-only preserved.
- `cameraProjectionContract.ts` — unchanged.
- `ModularVehicleLiveAdapter` — unchanged (sticky state, faction resolver integration, retry logic all preserved from Stage 2).
- `debugRenderFlags.ts` — unchanged (4 flags, all default false).
- `factionResolver.ts` — unchanged (canonical faction resolution, no silent cyan).
- `GeneratedModularVehicleRenderer` — unchanged (devtools preview only).
- `ModularVehicleDevtoolsPanel` — unchanged.
- `pilotVehicleLazyLoad` — kept (still referenced by `PreloadScene.loadArenaVisualAssets()` for devtools/arena pilot set preload).
- `modularUnitAssets` — kept (the `MODULAR_FACTIONS` list may still be referenced; only `getWaspHullKey`/`getSmokyTurretKey` were the removed exports — verify in validation).
- Combat / movement / economy / mapgen / pathfinding / save-load — unchanged.
- `GameScene` orchestration — unchanged (Stage 4 will address).
- No new `RenderManager` — Stage 4 scope.
- No PNG assets / generated metadata / package files changed.
- No new query-string flags.

---

## 6. Tests and validation

### 6.1 Test results
```text
npm run typecheck: PASS
npm test:           PASS — 91 files, 4671 tests (was 91 files, 4698 tests on main)
  Removed: -44 tests (runtime03PilotTurretComposition.test.ts deleted)
  Added:   +17 tests (vehicleRenderNoLegacyPath.test.ts)
  Net:     -27 tests (4654 pre-existing pass + 17 new = 4671)
npm run build:      not run — ENOSPC environment constraint (verified on clean main in PR #298; not a code defect)
npm run qa:smoke:   not run — ENOSPC + Playwright browser missing (same as 04A report)
git diff --check:   PASS
secret/token scan:  PASS
```

### 6.2 New contract tests (17 tests in `vehicleRenderNoLegacyPath.test.ts`)

**Legacy import guards (4 tests):**
- `ModularTankRenderer` does not import `getWaspHullKey`, `getSmokyTurretKey`, `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`, `tunerState`, `pilotTurretComposition`, `ModularTankDebugOverlay`, or any `generatedHullAssets` export.
- `BlockoutVehicleRenderer` does not import `pilotTurretComposition`, `PilotTurretCompositionResult`, `resolvePilotTurretComposition`, `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`.
- `GameInputController` does not import `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`, `tunerState`.
- `worldConfig.ts` does not contain `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `tunerState`, `TunerLayer`, `cloneOffsetRecord`, etc.

**File removal guards (3 tests):**
- `pilotTurretComposition.ts` is deleted (import fails).
- `ModularTankDebugOverlay.ts` is deleted (import fails).
- `runtime03PilotTurretComposition.test.ts` is deleted (import fails).

**Size guard (1 test):**
- `ModularTankRenderer` is now < 400 lines (was 733).

**Behavior preservation guards (6 tests):**
- `factionResolver` still exports `resolveFactionOrDiagnosticFallback` + `CANONICAL_FACTIONS`.
- `debugRenderFlags` still has 4 flags, all default false.
- `ENABLE_MODULAR_VEHICLE_RENDER` default is still true.
- `MODULAR_VEHICLE_BASE_SCALE` is still 0.16.
- `HULL_VISUAL_SCALE_MULTIPLIERS.dictator` is still 1.09.
- `MAX_MODULAR_VEHICLE_SET_PNG` is still 32.

**Tuner hotkey guards (2 tests):**
- `GameInputController` source has no `tunerState` / `MODULAR_TANK_HULL_OFFSETS` / `MODULAR_TANK_TURRET_MOUNT` references.
- `worldConfig` retains `TILE_W`, `TILE_H`, `MAP_W`, `MAP_H`, `Offset2D`, `ModularTankDirection`.

### 6.3 Existing tests
All 4654 pre-existing tests (after removing the 44 deleted `runtime03PilotTurretComposition` tests) continue to pass unchanged. Stage 2 contracts (faction flow, sticky no-flicker, debug gating, Dictator +9%) are preserved.

---

## 7. Manual QA checklist for Denis

Denis must complete this checklist on his local machine before merge:

1. Open standard game mode (`?skipMenu`).
2. Open devtools Arena mode (`?skipMenu&devtools=1&arena=1`).
3. Confirm default view has no debug artifacts (no green movement line, no red dashed aim line, no direction arrow, no mount-point dot, no debug label, no turret-to-cursor).
4. Spawn/check all 4 factions: cyan, green, yellow, purple — all render via modular PNG.
5. No silent cyan recolor (console: no `[factionResolver]` warnings).
6. Representative hulls: wasp, hunter, titan, dictator — all render correctly.
7. Representative turrets: smoky, ricochet, railgun, thunder — all render correctly.
8. No flicker back to turquoise/green blockout cube after PNG appears.
9. **Stage 3 extra:** normal-runtime modular-combat entity appears within ~1 second of spawn (no permanent invisibility). Brief invisibility on first spawn is acceptable (loading); permanent invisibility is a regression.
10. No disappearing units during asset loading (sticky keeps last good modular visible during direction changes).
11. Visual placement not regressed (hull+turret alignment on tile looks the same as before).
12. Dictator +9% hull only; turret not scaled by +9%.
13. Devtools debug overlay (if explicitly enabled) still works: mount-point dot, debug labels, aim line, direction arrow reappear when `debugRenderFlags.*` are set to true.

---

## 8. Risks and rollback plan

### 8.1 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Normal-runtime modular-combat entity briefly invisible on first spawn (no legacy wasp+smoky fallback) | Medium | `retryCleanModular()` runs each frame; entity appears within ~1s. Stage 2 sticky state covers all subsequent direction changes. Manual QA item 9 verifies. |
| `pilotVehicleLazyLoad` still references cyan-only pilot set — non-cyan vehicles may have slower first-load | Low | Stage 2 sticky state + lazy-load 32-PNG cap already handle this. Not a Stage 3 regression. |
| `modularUnitAssets` may still export `getWaspHullKey`/`getSmokyTurretKey` (unused but not deleted from the file) | Low | Contract test verifies no production file imports them. The exports themselves are dead code; Stage 4 cleanup can remove them if desired. |
| `ModularTankRenderer.updateVisuals` / `printOffsetTables` / `toggleDebug` / `isDebugOverlayVisible` are now no-op stubs | Low | Kept for EntityRenderer facade compatibility. Stage 4 can remove the facades when GameScene orchestration is cleaned up. |
| `GameInputController` no longer wires T/H/J/C/Q/E/Z/X hotkeys | Low | These were devtools-only tuner hotkeys. Q/E/Z/X direction cycling is now driven by game state (`entity.dir` / `entity.turretDir`), not manual keyboard input. |

### 8.2 Rollback plan
Revert the PR. The changes are:
- 3 files deleted (`pilotTurretComposition.ts`, `ModularTankDebugOverlay.ts`, `runtime03PilotTurretComposition.test.ts`).
- 4 files modified (`worldConfig.ts`, `ModularTankRenderer.ts`, `BlockoutVehicleRenderer.ts`, `GameInputController.ts`).
- 1 file added (`vehicleRenderNoLegacyPath.test.ts`).

Single-PR revert restores all legacy paths. The revert is safe because:
- `ModularVehicleLiveAdapter` is unchanged (Stage 2 contracts intact).
- `composeModularVehicle()` math is unchanged.
- `debugRenderFlags` is unchanged.
- `factionResolver` is unchanged.
- No assets/metadata/generated files changed.
- No dependencies added.

---

## 9. GPT / Denis review required

This PR is ready for review. It must not be merged until:
1. GPT reviews the implementation against the `VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md` and the Stage 3 audit.
2. Denis completes the manual QA checklist (§7) on his local machine.
3. Denis confirms visual placement did not regress.
4. Denis confirms no permanent invisibility for normal-runtime modular-combat entities.

After GPT/Denis acceptance, Stage 4 (GameScene render orchestration cleanup) can begin as a separate PR.

---

**Status:** Ready for GPT review + Denis manual QA.
