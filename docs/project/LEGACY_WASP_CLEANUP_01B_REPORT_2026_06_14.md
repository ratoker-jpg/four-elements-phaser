# LEGACY-WASP-CLEANUP-01B — Mark Wasp Pilot Hooks Legacy and Add Modular Isolation Tests

**Date:** 2026-06-15
**Task:** LEGACY-WASP-CLEANUP-01B — mark old Wasp pilot hooks as legacy and add modular isolation tests
**Mode:** Small safe implementation — comment-only code changes + new test file
**Executor:** GLM
**Base commit:** cd0334c (main, post PR #280)
**Previous phase:** LEGACY-WASP-CLEANUP-01A audit (report at `LEGACY_WASP_CLEANUP_01A_AUDIT_2026_06_14.md`)

---

## 1. Summary

This PR adds explicit `@legacy` JSDoc annotations to all old Wasp/Wasp m0 pilot-era hooks found by the 01A audit, and adds import isolation tests proving the clean modular runtime does not reference any legacy pilot modules. No runtime behavior is changed. No assets are changed. No code is deleted.

---

## 2. Legacy Hooks Annotated

| # | File | Symbol(s) Annotated | Annotation |
|---|------|---------------------|------------|
| 1 | `src/phaser/debug/WaspHullPlacementCalibrator.ts` | `WaspHullPlacementCalibrator` class | `@legacy Wasp/Smoky pilot-era placement helper` |
| 2 | `src/phaser/debug/WaspPlacementCalibrationPanel.ts` | `WaspPlacementCalibrationPanel` class | `@legacy Wasp/Smoky pilot-era placement helper` |
| 3 | `src/config/hullTurretVisualProfiles.ts` | `WASP_HULL_VISUAL_PROFILE` constant | `@legacy Wasp/Smoky pilot-era visual profile` |
| 4 | `src/assets/generatedHullAssets.ts` | `WASP_HULL_VISUAL_DIR16_REMAP` constant | `@legacy Wasp/Smoky pilot-era direction remap table` |
| 5 | `src/assets/generatedHullAssets.ts` | `applyHullVisualDir16Remap()` function | `@legacy Wasp/Smoky pilot-era direction remap helper` |
| 6 | `src/assets/generatedHullAssets.ts` | `WASP_HULL_OFFSET_X` constant | `@legacy Wasp/Smoky pilot-era hull placement offset` |
| 7 | `src/assets/generatedHullAssets.ts` | `WASP_HULL_OFFSET_Y` constant | `@legacy Wasp/Smoky pilot-era hull placement offset` |
| 8 | `src/assets/generatedHullAssets.ts` | `getGeneratedHullPlacementOffset()` function | `@legacy Wasp/Smoky pilot-era hull placement offset resolver` |
| 9 | `src/assets/pilotTurretComposition.ts` | Module + `resolvePilotTurretComposition()` | `@legacy Wasp/Smoky pilot-era turret composition resolver` |
| 10 | `src/assets/pilotVehicleLazyLoad.ts` | Module + `PILOT_VEHICLE_REQUEST` | `@legacy Wasp/Smoky pilot-era vehicle lazy-load lifecycle` |
| 11 | `src/assets/generatedVehicleMetadata.ts` | Module | `@legacy Wasp/Smoky pilot-era vehicle metadata contract` |
| 12 | `src/phaser/render/generatedVehiclePreviewComposition.ts` | Module + `composeGeneratedVehiclePreview()` | `@legacy Wasp/Smoky pilot-era preview composition` |
| 13 | `src/phaser/dev/GeneratedVehicleProofHarness.ts` | `GeneratedVehicleProofHarness` class | `@legacy Wasp/Smoky pilot-era proof harness` |
| 14 | `src/phaser/dev/GeneratedVehicleProofPanel.ts` | `GeneratedVehicleProofPanel` class | `@legacy Wasp/Smoky pilot-era proof harness panel` |

All annotations follow the standard format:

```
/**
 * @legacy Wasp/Smoky pilot-era <purpose>.
 * Do not import into MODULAR-RUNTIME-* code paths.
 * The clean modular runtime must use src/modular/* + generated modular manifests.
 */
```

---

## 3. What Was Intentionally NOT Removed

All legacy code is preserved in full. This PR adds comments only — no deletions, no logic changes, no disabled imports.

---

## 4. Shared Modules Intentionally Kept

The following modules are NOT marked as legacy because they serve both the old pilot path and the new modular path:

| Module | Reason Kept |
|--------|-------------|
| `GENERATED_HULL_SCALE` in `generatedHullAssets.ts` | Shared between `BlockoutVehicleRenderer` and `ModularTankRenderer` |
| `GENERATED_HULL_ORIGIN_X/Y` in `generatedHullAssets.ts` | Shared origin constants used by both paths |
| `bodyIdToGeneratedHullId()` in `generatedHullAssets.ts` | Shared bridge utility used by modular loader |
| `visualDirectionRemap.ts` | This IS the replacement architecture, not legacy |
| `generatedTurretAssets.ts` | Shared between old pilot path and modular bridge loader |

---

## 5. Isolation Tests Added

**File:** `src/__tests__/legacyWaspIsolation.test.ts`

### Approach

The test reads the raw source text of each modular runtime file (via Vite's `?raw` import) and scans for forbidden legacy identifiers and import paths. This catches both re-exports AND internal references — not just exported symbols.

### Test Cases

| # | Test | Validates |
|---|------|-----------|
| 1 | All 8 modular runtime source files are loaded as non-empty text | Sanity: raw imports work |
| 2 | No modular runtime source file contains forbidden legacy identifiers | 16 identifiers checked across 8 files' raw source text |
| 3 | No modular runtime source file imports from legacy pilot modules | Import-path regex for 8 legacy module paths |
| 4 | "wasp" hull id is allowed as a generic hull id | Confirms `'wasp'` is OK but `WASP_HULL_VISUAL_PROFILE` is not |
| 5 | Modular runtime produces valid texture keys without legacy formats | Key format sanity check |
| 6 | Modular loader queue respects 32 PNG cap without legacy paths | Loader sanity check |

### Modular Runtime Files Checked

- `src/modular/modularVehicleVisual.ts`
- `src/modular/modularVehicleComposition.ts`
- `src/modular/modularVehicleRuntimeLoader.ts`
- `src/modular/modularVehicleMetadata.ts`
- `src/phaser/render/GeneratedModularVehicleRenderer.ts`
- `src/phaser/dev/ModularVehicleDevtoolsPanel.ts`
- `src/assets/generatedModularVehicleAssets.generated.ts`
- `src/assets/generatedModularVehicleMetadata.generated.ts`

### Forbidden Legacy Identifiers

`WaspHullPlacementCalibrator`, `WASP_HULL_VISUAL_PROFILE`, `WASP_HULL_VISUAL_DIR16_REMAP`, `applyHullVisualDir16Remap`, `WASP_HULL_OFFSET_X`, `WASP_HULL_OFFSET_Y`, `pilotTurretComposition`, `pilotVehicleLazyLoad`, `generatedVehicleMetadata`, `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`, `GeneratedVehicleProofHarness`, `GeneratedVehicleProofPanel`, `generatedVehiclePreviewComposition`, `composeGeneratedVehiclePreview`, `getGeneratedHullPlacementOffset`, `_hull_dir`

---

## 6. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/phaser/debug/WaspHullPlacementCalibrator.ts` | Comment only | Added `@legacy` JSDoc annotation |
| `src/phaser/debug/WaspPlacementCalibrationPanel.ts` | Comment only | Added `@legacy` JSDoc annotation |
| `src/config/hullTurretVisualProfiles.ts` | Comment only | Added `@legacy` to `WASP_HULL_VISUAL_PROFILE` |
| `src/assets/generatedHullAssets.ts` | Comment only | Added `@legacy` to 5 Wasp-specific exports |
| `src/assets/pilotTurretComposition.ts` | Comment only | Added `@legacy` to module JSDoc |
| `src/assets/pilotVehicleLazyLoad.ts` | Comment only | Added `@legacy` to module JSDoc |
| `src/assets/generatedVehicleMetadata.ts` | Comment only | Added `@legacy` to module JSDoc |
| `src/phaser/render/generatedVehiclePreviewComposition.ts` | Comment only | Added `@legacy` to module JSDoc |
| `src/phaser/dev/GeneratedVehicleProofHarness.ts` | Comment only | Added `@legacy` to class JSDoc |
| `src/phaser/dev/GeneratedVehicleProofPanel.ts` | Comment only | Added `@legacy` to class JSDoc |
| `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` | Comment only | Removed legacy class name from comment (isolation test found it) |
| `src/__tests__/legacyWaspIsolation.test.ts` | New file | 6 isolation test cases |
| `docs/project/LEGACY_WASP_CLEANUP_01B_REPORT_2026_06_14.md` | New file | This report |
| `docs/project/CURRENT_NEXT_STEP.md` | Updated | Added 01A/01B completion + next step |

**Total: 11 files with comment-only changes + 1 new test file + 2 doc files**

---

## 7. Validation Results

| Check | Status |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run test -- src/__tests__/legacyWaspIsolation.test.ts` | PASS (6/6) |
| `npm run test` | PASS (4506/4506, 86 test files) |
| `npm run build` | PASS (155 modules, 6.40s) |
| `npm run qa:smoke` | PASS (2/2, standard + devtools) |

---

## 8. Risk / Rollback

**Risk:** Minimal — only comments added, no logic changes. The only new executable code is the isolation test file.

**Rollback:** Revert this PR. All changes are comment-only (except the test file) and can be safely reverted without affecting runtime behavior.

---

## 9. Next Recommended Step

**MODULAR-RUNTIME-02:** Controlled Arena demo unit using `GeneratedModularVehicleRenderer`. After this PR confirms legacy isolation, the next step is to wire the modular renderer into live Arena rendering for a single controlled demo unit, replacing the old pilot path for that unit while keeping the procedural turret fallback for all other units.

---

## 10. GPT Review Required

**Yes.** This PR modifies annotations across 10 source files and adds a new test contract. GPT should verify:
1. No legacy identifier was missed
2. No shared module was incorrectly marked as legacy
3. The isolation test coverage is sufficient
4. The `@legacy` annotation format is consistent
