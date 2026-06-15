# MODULAR-RUNTIME-03C1: Remove Dead Generated Vehicle Proof Harness

**Date:** 2026-06-16
**PR:** #294
**Branch:** `modular-runtime-03c1-proof-harness-cleanup`
**Mode:** Low-risk cleanup. Strict scope.

---

## Summary

After MODULAR-RUNTIME-03A (Arena live adapter) and 03B (normal runtime integration), the old `GeneratedVehicleProofHarness` / `GeneratedVehicleProofPanel` / `composeGeneratedVehiclePreview` path is fully superseded by:

- `GeneratedModularVehicleRenderer` (all-factions preview with calibration)
- `ModularVehicleDevtoolsPanel` (Live Render toggle, hull/turret/faction/mod selectors)
- `composeModularVehicle()` (clean modular composition API)
- `modular_hull_*` / `generated_turret_*` clean modular pipeline

The proof harness was Wasp/Smoky-only, used the old `composeGeneratedVehiclePreview` composition function (not `composeModularVehicle`), and had no integration with the live modular rendering path. The `9` hotkey that toggled it is removed along with the harness.

---

## Removed Files

| File | Reason |
|------|--------|
| `src/phaser/dev/GeneratedVehicleProofHarness.ts` | Wasp/Smoky-only proof harness, superseded by `GeneratedModularVehicleRenderer` |
| `src/phaser/dev/GeneratedVehicleProofPanel.ts` | DOM panel for proof harness, superseded by `ModularVehicleDevtoolsPanel` |
| `src/phaser/render/generatedVehiclePreviewComposition.ts` | Composition function only used by proof harness, superseded by `composeModularVehicle()` |
| `src/__tests__/generatedVehiclePreviewComposition.test.ts` | Tests for removed `composeGeneratedVehiclePreview()` |

---

## Updated Files

| File | Change |
|------|--------|
| `src/phaser/GameScene.ts` | Removed `GeneratedVehicleProofHarness`/`GeneratedVehicleProofPanel` imports, fields, instantiation, and cleanup code |
| `src/phaser/input/GameInputController.ts` | Removed `GeneratedVehicleProofHarness` type import, `GameInputDeps.generatedVehicleProofHarness` field, private field, constructor assignment, and `9` hotkey toggle handler |
| `src/__tests__/legacyWaspIsolation.test.ts` | Removed `GeneratedVehicleProofHarness`, `GeneratedVehicleProofPanel`, `generatedVehiclePreviewComposition`, `composeGeneratedVehiclePreview` from forbidden identifiers and import path lists (these modules no longer exist, so testing for them is meaningless) |
| `docs/project/CURRENT_NEXT_STEP.md` | Added 03C1 status, kept next step as 03C2 |
| `docs/project/MODULAR_RUNTIME_03C1_PROOF_HARNESS_CLEANUP_REPORT_2026_06_16.md` | This report |

---

## Explicitly Not Touched

- `src/assets/generatedHullAssets.ts` — Still active (BlockoutVehicleRenderer depends on it)
- `src/assets/pilotTurretComposition.ts` — Still active (BlockoutVehicleRenderer calls it)
- `src/assets/pilotVehicleLazyLoad.ts` — Still active (Arena preload + diagnostics)
- `src/assets/modularUnitAssets.ts` — Still active (ModularTankRenderer uses getWaspHullKey/getSmokyTurretKey)
- `src/phaser/render/BlockoutVehicleRenderer.ts` — Not touched
- `src/phaser/render/ModularTankRenderer.ts` — Not touched
- `src/phaser/render/ModularVehicleLiveAdapter.ts` — Not touched
- `src/phaser/render/EntityRenderer.ts` — Not touched
- `src/phaser/render/GeneratedModularVehicleRenderer.ts` — Not touched (still active)
- `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` — Not touched (still active)
- All `modular_hull_*` / `generated_turret_*` namespace code — Not touched
- All PNG assets — Not touched
- Any gameplay/combat/movement/economy/mapgen/save-load code — Not touched
- `ENABLE_MODULAR_VEHICLE_RENDER` behavior — Not touched
- 03A/03B modular adapter logic — Not touched

---

## Tests

| Test File | Status |
|-----------|--------|
| `src/__tests__/generatedVehiclePreviewComposition.test.ts` | **Deleted** — tested removed function |
| `src/__tests__/legacyWaspIsolation.test.ts` | **Updated** — removed deleted module names from forbidden lists |
| All other test files (4645 tests) | **Pass** |

---

## Validation

| Check | Status |
|-------|--------|
| TypeScript typecheck (`tsc --noEmit`) | **PASS** |
| Unit tests (`npm test`) | **PASS** — 88 test files, 4645 tests |
| Build (`npm run build`) | **FAIL** — ENOSPC (pre-existing environment issue: 4.7GB `public/assets/` fills disk during vite copy). Not code-related. `tsc` step of build passes. |
| qa:smoke | **SKIPPED** — requires build |

---

## Risk / Rollback

**Risk level:** Low

- All removed modules were devtools-only with no live rendering integration
- `GeneratedModularVehicleRenderer` + `ModularVehicleDevtoolsPanel` provide all the functionality the proof harness had, plus all-factions support, calibration, and Live Render toggle
- The `9` hotkey is no longer available (the new preview is accessed via the devtools panel)
- No gameplay, combat, or rendering behavior changes

**Rollback:** `git revert` of the single commit restores all removed files and references.

---

## GPT Review Required Before Merge

Yes. This PR modifies devtools wiring in `GameScene.ts` and `GameInputController.ts`. GPT should verify:
1. No remaining references to deleted modules exist
2. The `9` hotkey removal does not break any documented UX flow
3. The `legacyWaspIsolation.test.ts` update is correct (removing entries for deleted modules from forbidden lists)
