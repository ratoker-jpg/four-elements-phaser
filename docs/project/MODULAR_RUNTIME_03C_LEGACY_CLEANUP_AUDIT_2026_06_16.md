# MODULAR-RUNTIME-03C-AUDIT: Legacy Modular Vehicle Cleanup Plan

**Date:** 2026-06-16
**Mode:** Audit only. No code changes. No commits. No PR.
**Baseline:** After merged MODULAR-RUNTIME-03A (PR #291) + 03B (PR #293)
**Author:** GLM executor (audit-only mode)

---

## 1. Executive Summary

After MODULAR-RUNTIME-03A (Arena live adapter) and 03B (normal runtime integration), the clean modular vehicle path (`modular_hull_*` + `generated_turret_*` namespace) is the primary rendering pipeline when `ENABLE_MODULAR_VEHICLE_RENDER` is toggled on. The legacy pilot-era paths (`wasp_m0_hull_*`, `smoky_m0_turret_*`, `generated_hull_*`, `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`, etc.) still exist in the codebase and serve as fallback, devtools proof, and Arena legacy rendering when the modular flag is off.

This audit classifies every legacy path, identifies what can be safely removed and what must be retained, and proposes a cleanup PR sequence that minimizes risk.

**Key finding:** The legacy `wasp_m0_hull_*` / `smoky_m0_turret_*` PNG assets under `assets/units/chassis/wasp_m0/` and `assets/units/weapons/smoky_m0/` are already disabled in the manifest (`modularUnits.enabled: false`) and the PNG files have been removed from the repo. The `generated_hull_*` namespace (from `generatedHullAssets.ts`) is still actively used by `BlockoutVehicleRenderer` when the modular flag is OFF, so it CANNOT be removed until 03B manual QA is accepted and the flag can default to ON.

---

## 2. Legacy Path Inventory

### 2.1 Texture Key Namespaces

| Namespace | Format | Source Module | Status |
|-----------|--------|---------------|--------|
| `wasp_m0_hull_<faction>_dir<N>` | 8-dir, 4 factions × 8 dirs = 32 keys | `modularUnitAssets.ts` | **Dead** — PNG files removed, manifest disabled |
| `smoky_m0_turret_<faction>_dir<N>` | 8-dir, 4 factions × 8 dirs = 32 keys | `modularUnitAssets.ts` | **Dead** — PNG files removed, manifest disabled |
| `generated_hull_<hull>_<faction>_<mod>_dirNN` | 16-dir, 7 hulls × 4 factions × 4 mods × 16 dirs = 1792 keys | `generatedHullAssets.ts` | **Active** — used by BlockoutVehicleRenderer legacy path |
| `generated_turret_<turret>_<faction>_<mod>_dirNN` | 16-dir, built by `generatedModularVehicleAssets.generated.ts` | `generatedModularVehicleAssets.generated.ts` | **Active** — used by both 03A and 03B modular path |
| `modular_hull_<hull>_<faction>_<mod>_dirNN` | 16-dir, built by `generatedModularVehicleAssets.generated.ts` | `generatedModularVehicleAssets.generated.ts` | **Active** — primary modular hull namespace (02A+) |

### 2.2 Legacy Code Modules

| Module | File | @legacy Tag | Active Consumers | Classification |
|--------|------|-------------|-------------------|----------------|
| `modularUnitAssets.ts` | `src/assets/modularUnitAssets.ts` | No (should have one) | `ModularTankRenderer.ts` (getWaspHullKey, getSmokyTurretKey), 1 test file | **Keep temporarily** — ModularTankRenderer still imports getWaspHullKey/getSmokyTurretKey for legacy fallback path |
| `pilotTurretComposition.ts` | `src/assets/pilotTurretComposition.ts` | Yes | `BlockoutVehicleRenderer.ts` (resolvePilotTurretComposition), 1 test file | **Keep temporarily** — used when modular flag is OFF |
| `generatedVehiclePreviewComposition.ts` | `src/phaser/render/generatedVehiclePreviewComposition.ts` | Yes | `GeneratedVehicleProofHarness.ts`, 1 test file | **Safe to remove** (with proof harness) |
| `GeneratedVehicleProofHarness.ts` | `src/phaser/dev/GeneratedVehicleProofHarness.ts` | Yes | `GameScene.ts`, `GameInputController.ts` | **Safe to remove** — superseded by GeneratedModularVehicleRenderer |
| `GeneratedVehicleProofPanel.ts` | `src/phaser/dev/GeneratedVehicleProofPanel.ts` | Yes | `GameScene.ts` | **Safe to remove** — superseded by ModularVehicleDevtoolsPanel |
| `pilotVehicleLazyLoad.ts` | `src/assets/pilotVehicleLazyLoad.ts` | Yes | `runtimeGeneratedAssets.ts`, `PreloadScene.ts`, `GeneratedVehicleProofHarness.ts`, 1 test file | **Keep temporarily** — still loads `generated_hull_*` textures for Arena legacy path |
| `generatedHullAssets.ts` | `src/assets/generatedHullAssets.ts` | Partial | `BlockoutVehicleRenderer.ts`, `ModularTankRenderer.ts`, `pilotVehicleLazyLoad.ts`, multiple test files | **Keep temporarily** — BlockoutVehicleRenderer depends on it for legacy hull rendering |
| `modularVehicleLoader.ts` | `src/assets/modularVehicleLoader.ts` | No | `pilotVehicleLazyLoad.ts` | **Keep temporarily** — bridge between legacy and modular loader |
| `generatedAssetManifest.ts` | `src/assets/generatedAssetManifest.ts` | No | `runtimeGeneratedAssets.ts` | **Keep temporarily** — still references `modularUnits` family (disabled) |
| `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` | Constant in `BlockoutVehicleRenderer.ts` | — | `BlockoutVehicleRenderer.ts` line 114 | **Safe to remove** — hardcoded `false`, never toggled, superseded by modular adapter |

### 2.3 Legacy Constants

| Constant | File | Value | Used By | Classification |
|----------|------|-------|---------|----------------|
| `WASP_HULL_VISUAL_DIR16_REMAP` | `generatedHullAssets.ts` | `{0:4, 1:5, ..., 15:3}` | `generatedHullAssets.ts`, `applyHullVisualDir16Remap()`, 1 test | **Keep temporarily** — used by legacy hull direction resolution in BlockoutVehicleRenderer |
| `WASP_HULL_OFFSET_X = -1` | `generatedHullAssets.ts` | -1 | `getGeneratedHullPlacementOffset()`, 1 test | **Keep temporarily** — used by legacy hull placement |
| `WASP_HULL_OFFSET_Y = 12` | `generatedHullAssets.ts` | 12 | `getGeneratedHullPlacementOffset()`, 1 test | **Keep temporarily** — used by legacy hull placement |
| `GENERATED_HULL_SCALE = 0.12` | `generatedHullAssets.ts` | 0.12 | `BlockoutVehicleRenderer.ts`, `ModularTankRenderer.ts` | **Keep temporarily** — legacy hull scale |
| `GENERATED_HULL_ORIGIN_X = 0.5` | `generatedHullAssets.ts` | 0.5 | `BlockoutVehicleRenderer.ts`, `ModularTankRenderer.ts` | **Keep temporarily** |
| `GENERATED_HULL_ORIGIN_Y = 0.75` | `generatedHullAssets.ts` | 0.75 | `BlockoutVehicleRenderer.ts`, `ModularTankRenderer.ts` | **Keep temporarily** |
| `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false` | `BlockoutVehicleRenderer.ts` | false | `BlockoutVehicleRenderer.ts` line 460 | **Safe to remove** |

---

## 3. Classification

### 3.1 Keep Required (cannot remove)

These modules/constants are actively used by the live rendering pipeline regardless of the modular flag state:

| Item | Reason |
|------|--------|
| `generatedHullAssets.ts` (entire module) | BlockoutVehicleRenderer uses `resolveGeneratedHullKey()`, `GENERATED_HULL_SCALE`, placement offsets for legacy hull rendering when modular flag is OFF. ModularTankRenderer imports some types/helpers. Removing this would break Arena rendering with flag OFF. |
| `pilotTurretComposition.ts` | BlockoutVehicleRenderer calls `resolvePilotTurretComposition()` when modular flag is OFF and `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` is false. The composition result is stored for diagnostic purposes even when the turret sprite is not created. |
| `pilotVehicleLazyLoad.ts` | `loadPilotTurretSet()` is called from `runtimeGeneratedAssets.ts` during Arena preload. `getPilotVehicleLoadDiagnostics()` is used by `PreloadScene.ts`. |
| `modularVehicleLoader.ts` | `preloadVehicleAssetSet()` is the underlying loader used by pilotVehicleLazyLoad. Also provides `MAX_VEHICLE_SET_PNG_COUNT` and `resolveVehicleAssetSetSupport()`. |
| `generated_turret_*` namespace | Active namespace used by both 03A and 03B modular path. NOT legacy — this is the current turret namespace. |
| `modular_hull_*` namespace | Active namespace used by both 03A and 03B modular path. NOT legacy — this is the current hull namespace. |
| `generatedModularVehicleAssets.generated.ts` | Source of truth for `modular_hull_*` and `generated_turret_*` key builders. NOT legacy. |
| `GeneratedModularVehicleRenderer.ts` | Active devtools preview renderer using `composeModularVehicle()`. NOT legacy. |
| `ModularVehicleDevtoolsPanel.ts` | Active devtools panel with Live Render toggle. NOT legacy. |
| `ModularVehicleLiveAdapter.ts` | Active 03A+03B adapter. NOT legacy. |
| `normalCombatToModularVisual.ts` | Active 03B mapper. NOT legacy. |
| `blockoutToModularVisual.ts` | Active 03A mapper. NOT legacy. |

### 3.2 Keep Temporarily (remove after 03B manual QA acceptance)

These are active only when `ENABLE_MODULAR_VEHICLE_RENDER` is OFF (the current default). Once 03B manual QA is accepted and the flag can default to ON, these become removable:

| Item | Condition for Removal |
|------|----------------------|
| `resolvePilotTurretComposition()` call in BlockoutVehicleRenderer | After modular flag defaults ON and legacy turret composition is no longer needed |
| `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` constant | After legacy turret composition code path is removed from BlockoutVehicleRenderer |
| `WASP_HULL_VISUAL_DIR16_REMAP` and `applyHullVisualDir16Remap()` | After legacy `generated_hull_*` direction resolution is replaced by `modular_hull_*` path |
| `WASP_HULL_OFFSET_X/Y` and `getGeneratedHullPlacementOffset()` | After legacy hull placement offsets are replaced by modular composition |
| `GENERATED_HULL_SCALE / ORIGIN_X / ORIGIN_Y` in generatedHullAssets.ts | After BlockoutVehicleRenderer uses modular composition exclusively |
| `pilotVehicleLazyLoad.ts` load functions | After Arena preload uses `requestModularVehicleSet()` instead of `loadPilotTurretSet()` |

### 3.3 Safe to Remove Now

These are fully superseded by the modular runtime and have no remaining active consumers that cannot be replaced:

| Item | Superseded By | Risk |
|------|---------------|------|
| `GeneratedVehicleProofHarness.ts` | `GeneratedModularVehicleRenderer.ts` (all-factions, composition-based preview) | **Low** — devtools-only, isolated from live rendering. The old harness uses `composeGeneratedVehiclePreview` which is Wasp/Smoky-only. The new renderer uses `composeModularVehicle` with all hulls/turrets. |
| `GeneratedVehicleProofPanel.ts` | `ModularVehicleDevtoolsPanel.ts` | **Low** — devtools-only DOM panel. The new panel has Live Render toggle, hull/turret selection, calibration controls. |
| `composeGeneratedVehiclePreview()` in `generatedVehiclePreviewComposition.ts` | `composeModularVehicle()` in `modularVehicleComposition.ts` | **Low** — pure function, only used by proof harness + test. |
| `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false` constant | — | **Very Low** — hardcoded false, never toggled. The code path it guards in BlockoutVehicleRenderer can be simplified. |
| `modularUnitAssets.ts` → `loadModularUnitAssets()` function | `requestModularVehicleSet()` | **Low** — already `@deprecated`, not called by PreloadScene. But `getWaspHullKey()`/`getSmokyTurretKey()` ARE still used by ModularTankRenderer. |
| `modularUnitAssets.ts` → `resolveModularTurretSpriteKey()` | `composeModularVehicle()` | **Low** — not wired into any renderer. Only Smoky. Has its own test. |

### 3.4 Unknown / Needs Manual QA

| Item | Question |
|------|----------|
| `getWaspHullKey()` / `getSmokyTurretKey()` in `modularUnitAssets.ts` | These produce `wasp_m0_hull_*` / `smoky_m0_turret_*` keys. ModularTankRenderer still imports them for the legacy fallback hull/turret path. Can they be replaced with `modular_hull_*` / `generated_turret_*` keys in ModularTankRenderer? Requires confirming that ModularTankRenderer's legacy path can safely use the new namespace when modular flag is OFF. |
| `GENERATED_ASSET_MANIFEST.families.modularUnits` | Already `enabled: false`. The 64 legacy keys and their paths are dead code in the manifest. Can the entire family entry be removed? The paths still point to deleted PNG files. |
| `GENERATED_ASSET_MANIFEST.paths` — 64 legacy `wasp_m0_hull_*` / `smoky_m0_turret_*` entries | Dead paths pointing to removed files. Safe to remove from manifest, but the auto-generated nature of the file means the tool (`tools/process_art_assets.mjs`) might re-add them. Need to verify the tool skips missing files. |

---

## 4. Tests That Would Break If Removed

| Test File | Tests Removed Module? | Breakage If Module Removed | Action |
|-----------|----------------------|---------------------------|--------|
| `generatedVehiclePreviewComposition.test.ts` | Yes — 15+ tests for `composeGeneratedVehiclePreview` | **Full break** | Delete with `generatedVehiclePreviewComposition.ts` |
| `modularTurretSpriteResolver.test.ts` | Yes — 10 tests for `resolveModularTurretSpriteKey` | **Full break** | Delete with `resolveModularTurretSpriteKey` or when `modularUnitAssets.ts` is cleaned |
| `runtime03PilotTurretComposition.test.ts` | Yes — 30+ tests for `resolvePilotTurretComposition` | **Full break** | Keep until `pilotTurretComposition.ts` is removed |
| `runtime02bPilotLazyLoad.test.ts` | Yes — tests for `loadPilotTurretSet`, `loadPilotVehicleAssetSet`, `getPilotVehicleLoadDiagnostics` | **Full break** | Keep until `pilotVehicleLazyLoad.ts` is removed |
| `generatedHullAssets.test.ts` | Yes — 40+ tests for `generated_hull_*` namespace, Wasp remap, placement offsets | **Full break** | Keep until `generatedHullAssets.ts` is removed |
| `legacyWaspIsolation.test.ts` | Yes — 8 tests for modular/legacy namespace isolation | **Partial break** — need to update forbidden identifiers list if legacy modules are removed | Update test; keep isolation guard |
| `generatedMap.test.ts` | Possibly — tests the auto-generated manifest | May break if manifest structure changes | Verify |
| `modularLiveAdapter03a.test.ts` | No — tests 03A adapter | No breakage | Keep |
| `modularRuntime03b.test.ts` | No — tests 03B integration | No breakage | Keep |
| `modularRuntime01.test.ts` | No — tests clean modular runtime | No breakage | Keep |
| `modularPreviewCalibration01c.test.ts` | No — tests preview calibration | No breakage | Keep |

---

## 5. Devtools/Proof Harnesses — Still Useful?

| Component | Still Useful? | Reason |
|-----------|---------------|--------|
| `GeneratedModularVehicleRenderer.ts` | **Yes** — keep | Active all-factions preview renderer with calibration controls, tile overlay, and markers. Used by ModularVehicleDevtoolsPanel. Supersedes old proof harness. |
| `ModularVehicleDevtoolsPanel.ts` | **Yes** — keep | Active devtools panel with Live Render toggle, hull/turret/mod/faction/direction selectors, calibration controls. Used in both Arena and Standard modes. |
| `GeneratedVehicleProofHarness.ts` | **No** — remove | Wasp/Smoky-only, uses `composeGeneratedVehiclePreview` (not `composeModularVehicle`). Superseded by `GeneratedModularVehicleRenderer` which supports all hulls/turrets/factions. |
| `GeneratedVehicleProofPanel.ts` | **No** — remove | DOM panel for old proof harness. Superseded by `ModularVehicleDevtoolsPanel`. |

---

## 6. Proposed Cleanup PR Sequence

### PR 03C1: Remove Dead Proof Harness + Dead Code (Low Risk)

**Scope:** Remove modules that are fully superseded and have no active rendering consumers.

**Files to delete:**
- `src/phaser/dev/GeneratedVehicleProofHarness.ts`
- `src/phaser/dev/GeneratedVehicleProofPanel.ts`
- `src/phaser/render/generatedVehiclePreviewComposition.ts`
- `src/__tests__/generatedVehiclePreviewComposition.test.ts`

**Files to modify:**
- `src/phaser/GameScene.ts` — Remove imports and fields for `GeneratedVehicleProofHarness`, `GeneratedVehicleProofPanel`; remove harness instantiation in devtools init; remove harness reference from `GameInputController` deps
- `src/phaser/input/GameInputController.ts` — Remove `GeneratedVehicleProofHarness` import and `generatedVehicleProofHarness` field from `GameInputDeps`
- `src/assets/generatedAssetManifest.ts` — Remove `modularUnits` family entry and all 64 `wasp_m0_hull_*` / `smoky_m0_turret_*` path entries (already `enabled: false`, PNG files gone)
- `src/__tests__/legacyWaspIsolation.test.ts` — Remove `composeGeneratedVehiclePreview`, `GeneratedVehicleProofHarness`, `GeneratedVehicleProofPanel` from forbidden identifiers list (they no longer exist)

**Files NOT to touch:**
- `src/assets/generatedHullAssets.ts` — Still active
- `src/assets/pilotTurretComposition.ts` — Still active
- `src/assets/pilotVehicleLazyLoad.ts` — Still active
- `src/assets/modularUnitAssets.ts` — Still partially active
- `src/phaser/render/BlockoutVehicleRenderer.ts` — No changes
- `src/phaser/render/ModularTankRenderer.ts` — No changes
- `src/phaser/render/ModularVehicleLiveAdapter.ts` — No changes

**Risk level:** **Low** — all removed modules are devtools-only and fully superseded. No live rendering path depends on them. The `9` hotkey for proof harness will no longer work, but `GeneratedModularVehicleRenderer` is accessed through the devtools panel.

**Validation plan:**
- `tsc --noEmit` — must pass
- `npm test` — must pass (after removing test file)
- Manual QA: open Arena devtools, verify `GeneratedModularVehicleRenderer` preview still works, `ModularVehicleDevtoolsPanel` still functional

---

### PR 03C2: Simplify BlockoutVehicleRenderer Legacy Paths (Medium Risk)

**Scope:** Remove `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` dead code path, remove `resolveModularTurretSpriteKey()` from `modularUnitAssets.ts`, deprecate `loadModularUnitAssets()`.

**Precondition:** 03B manual QA accepted. This PR does NOT remove the fallback — it only removes dead code within the legacy path.

**Files to modify:**
- `src/phaser/render/BlockoutVehicleRenderer.ts` — Remove `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` constant and simplify the turret composition block. When `useModularBody` is true, the stub comp is already used. When false, `resolvePilotTurretComposition()` is always called but the `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` gate prevents sprite creation — simplify by always storing the comp result but never creating the turret sprite (matching current behavior since the flag is hardcoded false).
- `src/assets/modularUnitAssets.ts` — Remove `resolveModularTurretSpriteKey()`, `MODULAR_TURRET_SPRITE_WEAPONS`, `loadModularUnitAssets()`. Keep `getWaspHullKey()`, `getSmokyTurretKey()`, `getWaspHullPath()`, `getSmokyTurretPath()` (still used by ModularTankRenderer for legacy key building).
- `src/__tests__/modularTurretSpriteResolver.test.ts` — Delete (tests removed function)
- `src/__tests__/legacyWaspIsolation.test.ts` — Update if needed

**Files NOT to touch:**
- `src/assets/generatedHullAssets.ts` — Keep all (still active)
- `src/assets/pilotTurretComposition.ts` — Keep (still called by BlockoutVehicleRenderer)
- `src/assets/pilotVehicleLazyLoad.ts` — Keep (still used in Arena preload)
- `src/phaser/render/ModularTankRenderer.ts` — No changes (still uses getWaspHullKey/getSmokyTurretKey)

**Risk level:** **Medium** — touches BlockoutVehicleRenderer which is the Arena rendering path. The `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` removal simplifies dead code but must be verified that no code path relies on it being toggled. The `resolveModularTurretSpriteKey` removal is safe since it's not wired into any renderer.

**Validation plan:**
- `tsc --noEmit` — must pass
- `npm test` — must pass
- Manual QA: Arena devtools — toggle Live Render ON/OFF, verify modular/legacy transitions still work. Verify turret sprites appear/disappear correctly.

---

### PR 03C3 (Optional): Docs Cleanup

**Scope:** Update project docs to reflect 03A+03B+03C1+03C2 completion.

**Files to modify:**
- `docs/project/CURRENT_NEXT_STEP.md` — Update status to reflect 03C1/03C2 merged
- `docs/project/PROJECT_STATE.md` — Update modular vehicle section
- Remove or archive 03A/03B report docs if superseded

**Risk level:** **None** — docs only.

---

## 7. What NOT to Remove (Before 03B Manual QA)

The following are **actively used as fallback** when `ENABLE_MODULAR_VEHICLE_RENDER` is OFF (current default). Removing any of these would break the legacy rendering path:

| Module | Why It Must Stay |
|--------|-----------------|
| `generatedHullAssets.ts` (all exports) | BlockoutVehicleRenderer uses `resolveGeneratedHullKey()`, `GENERATED_HULL_SCALE`, `GENERATED_HULL_ORIGIN_X/Y`, `getGeneratedHullPlacementOffset()`, `applyHullVisualDir16Remap()`, `preloadGeneratedHullSet()`, `isGeneratedHullSetLoaded()` for legacy hull rendering |
| `pilotTurretComposition.ts` | BlockoutVehicleRenderer calls `resolvePilotTurretComposition()` to compute turret composition even when flag is false (stores for diagnostics) |
| `pilotVehicleLazyLoad.ts` | Arena preload calls `loadPilotTurretSet()` to load `generated_turret_smoky_*` textures; PreloadScene uses `getPilotVehicleLoadDiagnostics()` |
| `modularVehicleLoader.ts` | Underlying loader used by `pilotVehicleLazyLoad.ts`; provides `preloadVehicleAssetSet()` |
| `modularUnitAssets.ts` (getWaspHullKey, getSmokyTurretKey) | ModularTankRenderer imports these for legacy hull/turret texture key building |
| `generatedTurretAssets.ts` | Provides `preloadGeneratedTurretSet()`, `getGeneratedTurretTextureKey()`, etc. — used by both pilot loader and modular loader |

**After 03B manual QA is accepted and `ENABLE_MODULAR_VEHICLE_RENDER` defaults to ON**, a follow-up PR (03C4 or later) can:
1. Remove `resolvePilotTurretComposition()` call from BlockoutVehicleRenderer
2. Replace `resolveGeneratedHullKey()` with `composeModularVehicle()` in BlockoutVehicleRenderer legacy path
3. Remove `pilotVehicleLazyLoad.ts` in favor of `requestModularVehicleSet()` in Arena preload
4. Remove `modularUnitAssets.ts` entirely (replace `getWaspHullKey`/`getSmokyTurretKey` in ModularTankRenderer with modular key builders)
5. Remove Wasp-specific constants (`WASP_HULL_OFFSET_X/Y`, `WASP_HULL_VISUAL_DIR16_REMAP`, etc.)
6. Remove `generatedHullAssets.ts` entirely if no remaining consumer

**This PR (03C4) is NOT part of this audit's recommendation. It requires explicit product-owner acceptance that 03B manual QA has passed.**

---

## 8. Risk Assessment Per Cleanup Step

| Step | Risk | Reversible? | Blast Radius |
|------|------|-------------|--------------|
| 03C1 | **Low** | Yes — git revert | Devtools-only. No gameplay/rendering impact. Removes 4 files + 1 test file + simplifies GameScene/GameInputController. |
| 03C2 | **Medium** | Yes — git revert | Touches BlockoutVehicleRenderer (Arena path). Removes dead code path but must verify no hidden dependency on `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`. Removes `resolveModularTurretSpriteKey` (unused by renderers). |
| 03C3 | **None** | Yes — git revert | Docs only. |
| 03C4+ (post-QA) | **High** | Yes — git revert | Removes active fallback rendering. Would break rendering if modular flag is ever toggled OFF. Must only proceed after 03B QA acceptance. |

---

## 9. Validation Plan

### 03C1 Validation

```bash
npm run typecheck          # Must pass
npm run test               # Must pass (deleted test file removed from suite)
```

Manual QA:
1. Open Arena devtools
2. Verify `GeneratedModularVehicleRenderer` preview overlay works (open via ModularVehicleDevtoolsPanel)
3. Verify `ModularVehicleDevtoolsPanel` Live Render toggle works
4. Verify `9` hotkey no longer opens proof harness (expected — removed)
5. Verify all modular hull/turret/faction/mod combos render in preview

### 03C2 Validation

```bash
npm run typecheck          # Must pass
npm run test               # Must pass (deleted test file removed)
```

Manual QA:
1. Open Arena devtools
2. Toggle Live Render ON → verify modular vehicles render correctly
3. Toggle Live Render OFF → verify legacy blockout vehicles render correctly
4. Verify no turret sprites appear from the `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` path (they should not — same as current behavior since flag was always false)
5. Verify `resolveModularTurretSpriteKey` is no longer importable (should cause no runtime issues since it was never wired)

---

## 10. Manual QA Plan (Prerequisite for 03C4+)

Before any removal of `generatedHullAssets.ts` or `pilotTurretComposition.ts` dependencies:

1. **03B normal runtime modular render** — With `ENABLE_MODULAR_VEHICLE_RENDER` ON, verify:
   - Wasp/Smoky modular-combat entity renders with `modular_hull_*` + `generated_turret_*` sprites
   - All 4 factions render correctly
   - Dictator hull scale multiplier (1.09) is applied
   - Direction changes (body/turret) update sprites correctly
   - Toggle OFF restores legacy hull/turret sprites

2. **03A Arena modular render** — With `ENABLE_MODULAR_VEHICLE_RENDER` ON, verify:
   - All blockout vehicles render with modular sprites
   - All hull/turret/faction/mod combos work
   - Direction changes per-frame are smooth
   - Overlays (HP bars, selection, labels) still appear correctly on top

3. **Fallback** — With `ENABLE_MODULAR_VEHICLE_RENDER` OFF, verify:
   - Arena uses blockout procedural + generated hull rendering (current default)
   - Normal runtime uses legacy generated hull + blockout turret

**Only after Denis explicitly accepts 03B manual QA results should 03C4+ be scheduled.**

---

## 11. Summary of Exact Files/Functions

### Files/Functions to Touch Later (03C1)

| File | Action |
|------|--------|
| `src/phaser/dev/GeneratedVehicleProofHarness.ts` | DELETE |
| `src/phaser/dev/GeneratedVehicleProofPanel.ts` | DELETE |
| `src/phaser/render/generatedVehiclePreviewComposition.ts` | DELETE |
| `src/__tests__/generatedVehiclePreviewComposition.test.ts` | DELETE |
| `src/phaser/GameScene.ts` | MODIFY: remove proof harness imports, fields, instantiation |
| `src/phaser/input/GameInputController.ts` | MODIFY: remove proof harness type + field |
| `src/assets/generatedAssetManifest.ts` | MODIFY: remove `modularUnits` family + 64 legacy path entries |
| `src/__tests__/legacyWaspIsolation.test.ts` | MODIFY: update forbidden identifiers list |

### Files/Functions to Touch Later (03C2)

| File | Action |
|------|--------|
| `src/phaser/render/BlockoutVehicleRenderer.ts` | MODIFY: remove `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` constant and simplify turret block |
| `src/assets/modularUnitAssets.ts` | MODIFY: remove `resolveModularTurretSpriteKey`, `MODULAR_TURRET_SPRITE_WEAPONS`, `loadModularUnitAssets` |
| `src/__tests__/modularTurretSpriteResolver.test.ts` | DELETE |

### Files/Functions NOT to Touch (Any 03C PR)

| File | Reason |
|------|--------|
| `src/assets/generatedHullAssets.ts` | Active — BlockoutVehicleRenderer depends on it |
| `src/assets/pilotTurretComposition.ts` | Active — BlockoutVehicleRenderer calls `resolvePilotTurretComposition()` |
| `src/assets/pilotVehicleLazyLoad.ts` | Active — Arena preload + PreloadScene diagnostics |
| `src/assets/modularVehicleLoader.ts` | Active — underlying loader for pilotVehicleLazyLoad |
| `src/assets/generatedTurretAssets.ts` | Active — shared by pilot + modular loaders |
| `src/assets/generatedModularVehicleAssets.generated.ts` | Active — source of truth for modular namespaces |
| `src/assets/generatedModularVehicleMetadata.generated.ts` | Active — modular metadata |
| `src/modular/modularVehicleComposition.ts` | Active — `composeModularVehicle()` |
| `src/modular/modularVehicleRuntimeLoader.ts` | Active — `requestModularVehicleSet()` |
| `src/modular/modularVehicleVisual.ts` | Active — `ModularVehicleVisual` type |
| `src/modular/modularVehicleMetadata.ts` | Active — modular metadata |
| `src/modular/normalCombatToModularVisual.ts` | Active — 03B mapper |
| `src/modular/blockoutToModularVisual.ts` | Active — 03A mapper |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | Active — 03A+03B adapter |
| `src/phaser/render/ModularTankRenderer.ts` | Active — normal runtime tank renderer |
| `src/phaser/render/EntityRenderer.ts` | Active — entity renderer |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | Active — only remove dead constant in 03C2 |
| `src/phaser/render/GeneratedModularVehicleRenderer.ts` | Active — devtools preview |
| `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` | Active — devtools panel |
| `src/phaser/GameScene.ts` | Active — only remove proof harness refs in 03C1 |
| `src/config/hullTurretVisualProfiles.ts` | Active — visual profiles shared by pilot + modular |
| `src/config/directionalTurretProfiles.ts` | Active — directional pivot data |
| `src/config/visualDirectionRemap.ts` | Active — direction remap profiles |
| All `public/assets/units/hulls/` PNG files | DO NOT REMOVE in this audit |
| All `public/assets/units/turrets/` PNG files | DO NOT REMOVE in this audit |
| Any gameplay/combat/movement/economy/mapgen/save-load code | DO NOT TOUCH |

---

Жду Делай
