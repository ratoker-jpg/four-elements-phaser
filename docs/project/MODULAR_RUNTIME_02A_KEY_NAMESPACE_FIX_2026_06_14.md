# MODULAR-RUNTIME-02A — Isolate Modular Hull Texture Keys From Legacy Preload

**Date:** 2026-06-14
**Task:** MODULAR-RUNTIME-02A-KEY-NAMESPACE-FIX
**Mode:** Small surgical implementation (texture-key namespace only).
**Repository:** ratoker-jpg/four-elements-phaser
**Base branch:** main (HEAD `4b5195c`, post PR #284)
**Branch:** `claude/hopeful-mendel-7t5s9u`
**Preceding audit:** `docs/project/WASP_M0_POST_02C_AUDIT_2026_06_14.md`

---

## 1. Root Cause

After PR #284 the Wasp cyan m0 PNG bytes in the repo are correct (bbox ~274×160, opaque ~30,413, norm Cy 0.588 — matching the m1/m2/m3 family). The remaining visual bug was a **runtime texture-key collision in the shared Phaser `TextureManager`**, not an asset problem.

Two separate modules built the **same** texture key string but resolved it to **different files**:

| Module | Key for wasp/cyan/m0/dir00 | File loaded |
|---|---|---|
| Legacy `src/assets/generatedHullAssets.ts` | `generated_hull_wasp_cyan_m0_dir00` | `wasp_cyan_m0_hull_dir00_E.png` (oversized legacy crop, ~397×232) |
| Modular `src/assets/generatedModularVehicleAssets.generated.ts` | `generated_hull_wasp_cyan_m0_dir00` | `wasp_cyan_m0_dir00_E.png` (correct fixed_512_frame, ~274×160) |

Flow (devtools/arena mode):
1. `PreloadScene.ts:50-51` runs under `isDevtoolsEnabled()` → `loadArenaVisualAssets()`.
2. `runtimeGeneratedAssets.ts:238-253` loops all factions and calls the legacy `preloadGeneratedHullSet(wasp, faction, 'm0')`, populating `generated_hull_wasp_cyan_m0_dirNN` in the **global** TextureManager from the **wrong** `_hull_dir` file.
3. The Modular Vehicle preview opens later in `GameScene`; the modular loader (`modularVehicleRuntimeLoader.ts:169`) builds the **identical** key, sees `scene.textures.exists(key) === true`, and **skips** loading the correct modular PNG.
4. The preview renders the legacy oversized texture.

## 2. Why Only Wasp m0 Was Affected

The legacy arena preload is hard-coded to `DEFAULT_GENERATED_HULL = 'wasp'` + `DEFAULT_GENERATED_HULL_MOD = 'm0'` (`generatedHullAssets.ts:210,213`). It preloads **only m0**. So:
- `generated_hull_wasp_cyan_m0_dirNN` keys are pre-occupied by the legacy `_hull_dir` crop → m0 looks wrong.
- m1/m2/m3 keys are never touched by the legacy path → the modular loader fetches the correct files → m1/m2/m3 look healthy.

This exactly matches Denis's screenshots (Wasp m0 oversized/up-shifted; Wasp m1 correct).

## 3. Key Namespace Change

Modular hull texture keys are moved to a distinct namespace. **Only the returned key string changed** — file paths, file names, and the legacy module are untouched.

| | Old | New |
|---|---|---|
| Legacy hull key (unchanged) | `generated_hull_<hull>_<faction>_<mod>_dirNN` | `generated_hull_<hull>_<faction>_<mod>_dirNN` |
| Modular hull key | `generated_hull_<hull>_<faction>_<mod>_dirNN` | **`modular_hull_<hull>_<faction>_<mod>_dirNN`** |
| Modular turret key (unchanged) | `generated_turret_<turret>_<faction>_<mod>_dirNN` | `generated_turret_<turret>_<faction>_<mod>_dirNN` |

Concrete example: `generated_hull_wasp_cyan_m0_dir00` → `modular_hull_wasp_cyan_m0_dir00`.

### Expected behavior after fix
- Legacy loader may still register `generated_hull_wasp_cyan_m0_dir00` (untouched).
- Modular loader now requests `modular_hull_wasp_cyan_m0_dir00`.
- `textures.exists('modular_hull_wasp_cyan_m0_dir00')` is `false` on first modular request → modular loader loads the correct file `wasp_cyan_m0_dir00_E.png`.
- Wasp m0 preview now matches the fixed repo asset (m1-family placement).

## 4. Files Changed

| File | Change |
|---|---|
| `src/assets/generatedModularVehicleAssets.generated.ts` | `getGeneratedHullTextureKey` now returns the `modular_hull_` prefix (+ explanatory comment). Turret key and all asset-path builders unchanged. |
| `src/__tests__/modularRuntime01.test.ts` | Updated hull key-format assertions to `modular_hull_*`; updated two `startsWith('generated_hull_')`/`textureExists` helpers to `modular_hull_`; added a loader regression test proving modular hull keys are still queued when legacy `generated_hull_*` keys already exist. |
| `src/__tests__/legacyWaspIsolation.test.ts` | Updated modular hull key assertion to `modular_hull_*`; added a cross-module regression test importing both the legacy and modular `getGeneratedHullTextureKey` and asserting their namespaces are disjoint. |
| `docs/project/MODULAR_RUNTIME_02A_KEY_NAMESPACE_FIX_2026_06_14.md` | This report. |
| `docs/project/CURRENT_NEXT_STEP.md` | Recorded 02C audit + 02A fix in the status block. |
| `docs/project/WASP_M0_POST_02C_AUDIT_2026_06_14.md` | Preceding audit report (committed alongside). |

## 5. Confirmation: No Behavior Beyond Key Namespace Changed

- ✅ No PNG files changed or regenerated. No Wasp asset changes.
- ✅ No metadata JSON changes (`hull_socket_manifest_modular_cyan_v1.json` untouched).
- ✅ No asset path / file name changes — `getGeneratedHullAssetPath` still returns `assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png`.
- ✅ Legacy `generatedHullAssets.ts` unchanged (its key format and `_hull_dir` path are intact for `BlockoutVehicleRenderer` / `ModularTankRenderer` / pilot loaders).
- ✅ `PreloadScene` / `loadArenaVisualAssets` behavior unchanged; legacy loader and Proof Harness not removed.
- ✅ No renderer/loader rewrite — only the key string returned by the modular key builder, which the loader and renderer consume via the function.
- ✅ No gameplay, combat, movement, economy, mapgen, pathfinding, save-load changes. No Dictator scale changes. No y-offset/zHeight/manual calibration. No new query-string flags.

## 6. Tests Added / Updated

1. **Updated key-format tests** (`modularRuntime01.test.ts`): modular hull key now asserted as `modular_hull_wasp_cyan_m0_dir00` / `modular_hull_titan_cyan_m3_dir15`.
2. **Cross-module namespace regression** (`legacyWaspIsolation.test.ts`): for `(wasp, cyan, m0, dir00)`, asserts `legacyKey === 'generated_hull_wasp_cyan_m0_dir00'`, `modularKey === 'modular_hull_wasp_cyan_m0_dir00'`, `legacyKey !== modularKey`, and the modular key does not start with the legacy prefix.
3. **Loader collision regression** (`modularRuntime01.test.ts`): with 16 legacy `generated_hull_wasp_cyan_m0_dirNN` keys pre-existing in the fake scene, `requestModularVehicleSet` for Wasp+Smoky cyan m0 still queues 16 `modular_hull_*` keys, does not list the legacy key as already-available, and queues no `_hull_dir` / `generated_hull_` path.
4. **Existing suites remain green** (see §7).

## 7. Validation Results

| Command | Result |
|---|---|
| `npm run typecheck` | PASS (clean) |
| `npx vitest run src/__tests__/modularRuntime01.test.ts src/__tests__/legacyWaspIsolation.test.ts src/__tests__/generatedHullAssets.test.ts` | PASS — 114/114 |
| `npm run test` (full) | PASS — 4508/4508, 86 files (was 4506; +2 new tests) |
| `npm run build` | PASS — 155 modules, built in ~19s |
| `npm run qa:smoke` | PASS — 2/2 (standard + devtools/arena) |

The devtools/arena smoke run is the exact mode in which the collision occurred; it now loads cleanly with the legacy preload marker `[PreloadScene] generated hull sets loaded: wasp/<all factions>/m0` still present (legacy preload unchanged) and the modular renderer using the new namespace.

## 8. Manual QA (after deploy + hard refresh)

Open the modular preview:
```
?skipMenu&devtools=1&arena=1
```
Check:
1. **Wasp m0 + Smoky m0** — hull now matches Wasp m1 family scale/placement (no oversize / up-shift).
2. **Wasp m0 + Railgun m3** — cross-tier composition aligns.
3. **Wasp m1 + Smoky m1** — unchanged (control).
4. **Titan / Mammoth + any turret** — unchanged (control).

Expected: Wasp m0 uses `modular_hull_*` key and the correct modular PNG; no fallback box; no runtime error.

Optional DevTools check (see audit §6 snippet): the in-memory texture for `modular_hull_wasp_cyan_m0_dir00` should be the ~308×168-content modular sprite, loaded from `wasp_cyan_m0_dir00_E.png` (~79 KB, SHA-256 `fe7c298659…`).

## 9. Risks

- **Low.** The change is a single returned string in the modular key builder, consumed everywhere via the function (no hard-coded literals in `src/modular/*` or the renderer). The legacy path is untouched, so legacy renderers keep working.
- One latent issue remains out of scope (audit §17): `public/assets` files are served with stable, un-hashed names and no cache-bust, so a future same-name asset change can still be served stale by the browser/CDN. Not triggered here (the bug was the in-engine key collision), but worth a separate follow-up.

## 10. Turret Collision Note (out of scope)

The task asked to report (not fix) any modular turret key collision. The legacy arena preload also loads a pilot turret set (Smoky cyan m0) via `loadPilotTurretSet`. Modular turret keys use the `generated_turret_` prefix. No current preload collision was **proven** for turrets in this audit (turret keys were not observed being pre-populated under the modular `generated_turret_*` format by a legacy loader). Per task scope, this PR does **not** rename turret keys. If a turret preload collision is later proven, apply the same `modular_turret_` namespace treatment in a follow-up.

## 11. GPT Review Required

**Yes.** Review points:
- Confirm the `modular_hull_` prefix is the minimal correct fix and that no consumer hard-codes the old `generated_hull_` literal for modular hulls.
- Confirm legacy `generatedHullAssets.ts` and `PreloadScene` behavior are unchanged.
- Confirm no asset/metadata changes.
