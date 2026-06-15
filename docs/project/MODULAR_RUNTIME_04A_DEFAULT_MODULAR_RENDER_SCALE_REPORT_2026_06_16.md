# MODULAR-RUNTIME-04A: Default Modular Render + Scale Normalization Report

**Date:** 2026-06-16
**Scope:** Make modular PNG hull/turret rendering the default runtime visual in all live modes; normalize modular vehicle scale to one shared source of truth; remove the dead generated-vehicle proof harness; keep emergency fallback, lazy loading, and Dictator +9% hull-only.
**Status:** Implementation complete; pending QA + GPT review.

---

## 1. Problem statement (blockout cube screenshot context)

Live game modes still rendered vehicles as turquoise blockout cubes
(labels like `hunter+twins`, `hunter+smoky`, `hornet+ricochet`) even though
the modular PNG hull/turret assets and the clean composition pipeline
(`composeModularVehicle()`, `modular_hull_*` / `generated_turret_*`,
metadata socket/pivot) already exist and are tested.

Root cause: the live modular adapter (PR #292 / 03A Arena, PR #293 / 03B
normal runtime) was gated behind `ENABLE_MODULAR_VEHICLE_RENDER`, which
**defaulted to `false`**. With the flag off, both surfaces drew the legacy
blockout/generated path. Seeing modular PNG vehicles required a manual
devtools "Live Render" toggle — i.e. the new assets were never the default.

A second problem: even when the flag was turned on, the live composition
base scale (`0.5` on 512×512 frames → 256 px hulls) did not match the
accepted preview visual, which was only reachable by manually dialing the
devtools `modelScale` down to ~`0.32` (effective `0.5 × 0.32 = 0.16`). So
preview and live disagreed, and the accepted size lived only in transient
devtools calibration state.

---

## 2. Scale: before / after and source of truth

### Source of truth

`MODULAR_VEHICLE_BASE_SCALE` in `src/modular/modularVehicleComposition.ts`
is now the single shared base scale read by **both** live runtime
composition (`composeModularVehicle`) and the devtools preview
(`GeneratedModularVehicleRenderer` via `effectiveHullScale` /
`effectiveTurretScale`).

### Before → After

| Constant | Before | After | Notes |
|---|---|---|---|
| `MODULAR_VEHICLE_BASE_SCALE` | — (did not exist) | **0.16** | New canonical source of truth |
| `MODULAR_VEHICLE_DISPLAY_SCALE` | `0.5` | `= MODULAR_VEHICLE_BASE_SCALE` (`0.16`) | Kept as `@deprecated` alias so existing imports compile |
| Preview default `modelScale` | `1` (gave effective `0.5`; accepted look needed manual `0.32`) | `1` (gives effective `0.16` directly) | No change to the default constant; it is now neutral because the base is correct |
| Effective hull scale (non-Dictator, default) | `0.5` live / `0.16` only via manual cal | **`0.16`** live **and** preview | Preview == live with zero calibration |
| Effective turret scale (default) | `0.5` / `0.16` via manual cal | **`0.16`** | |
| Dictator hull scale | `0.5 × 1.09 = 0.545` | **`0.16 × 1.09 = 0.1744`** | Hull-only |
| Dictator turret scale | `0.5` | **`0.16`** | Unchanged by Dictator multiplier |

### Why effective scale was `0.16` in the old preview

`effectiveHullScale = baseDisplayScale × modelScale × hullMult × hullScale`.
With `baseDisplayScale = 0.5` and the user-dialed `modelScale = 0.32`:
`0.5 × 0.32 × 1 × 1 = 0.16`. 04A bakes that accepted `0.16` into the base
constant and resets `modelScale` to its neutral default of `1`, so default
preview and live both compute `0.16` with no calibration. Devtools
calibration multipliers remain QA-only and are never written back to the
constant, metadata, or assets.

---

## 3. Default modular rendering behavior

`ENABLE_MODULAR_VEHICLE_RENDER` default flipped `false → true` in
`src/phaser/render/ModularVehicleLiveAdapter.ts`.

- **Arena devtools / demo** (`BlockoutVehicleRenderer` + adapter): vehicles
  render as modular PNG hull+turret by default. Procedural blockout geometry
  draws only as emergency fallback while assets are loading/missing.
- **Normal runtime modular-combat** (`EntityRenderer` → `ModularTankRenderer`
  + adapter): renders modular PNG by default; legacy `generated_hull_*` /
  `wasp_m0_*` path is emergency fallback only; `retryCleanModular()` swaps to
  modular once assets finish loading; no entity disappears during loading.
- The devtools toggle remains as an **emergency/debug fallback switch only**,
  relabeled `Modular Render (default ON — emergency fallback only)` /
  `Modular: ON (default)` / `OFF (emergency legacy)`. It is no longer
  presented as a "Live Render" workflow.

Overlays (labels, HP bars, selection rings, shadows, weapon/resource bars,
target locks) and depth ordering are unchanged — they live outside the
modular guard in `BlockoutVehicleRenderer` and are reused on both paths.

---

## 4. Old paths removed (cleanup)

Removed the dead, fully-superseded generated-vehicle proof harness
(superseded by `GeneratedModularVehicleRenderer` + `ModularVehicleDevtoolsPanel`
+ `composeModularVehicle()`):

- `src/phaser/dev/GeneratedVehicleProofHarness.ts`
- `src/phaser/dev/GeneratedVehicleProofPanel.ts`
- `src/phaser/render/generatedVehiclePreviewComposition.ts`
- `src/__tests__/generatedVehiclePreviewComposition.test.ts`

Reference removals:

- `src/phaser/GameScene.ts` — proof harness imports, fields, instantiation, deps wiring, cleanup.
- `src/phaser/input/GameInputController.ts` — proof harness import, dep, field, ctor assignment, and the `9` hotkey binding.

The `legacyWaspIsolation.test.ts` forbidden-identifier guard list is kept
intact (it is string-literal guarding of modular sources, and keeping the
removed names forbidden is strictly stronger than dropping them).

---

## 5. Fallback that remains, and why

These are **kept as emergency fallback** for asset loading / missing-asset
failure and are not removed:

- `BlockoutVehicleRenderer` procedural blockout geometry — drawn only when
  `plan.available !== true` (loading/missing), so units never disappear.
- `generatedHullAssets` legacy hull path — still the fallback hull source.
- `ModularTankRenderer` legacy hull/turret sprites — hidden when modular
  succeeds, shown during loading.
- `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` (still `false`) — left as a
  quarantine circuit-breaker; not re-enabled.
- `modularUnitAssets` / `pilotTurretComposition` / `pilotVehicleLazyLoad` —
  left untouched; still referenced by the fallback/diagnostic paths and not
  proven fully unreferenced, so out of scope for removal here.

---

## 6. Lazy loading proof

Unchanged and preserved: `requestModularVehicleSet()` loads **exactly the
32 PNG** (16 hull + 16 turret) of the one selected visual set, deduped by a
module-level ledger; `MAX_MODULAR_VEHICLE_SET_PNG = 32`. The full 4352-PNG
matrix is never preloaded. Tests in `modularRuntime01.test.ts` continue to
assert the 32-PNG cap and "no all-factions preload". Flipping the render
flag to default-on does not change which sets load — only vehicles actually
present request their own set on demand.

---

## 7. Dictator +9% behavior

`getHullVisualScaleMultiplier('dictator') === 1.09`, applied to **hull scale
only**; turret scale stays at the base scale. With the new base, Dictator
hull = `0.16 × 1.09 = 0.1744`, turret = `0.16`. Collision / hitbox /
footprint / movement / range are untouched. Locked by tests in
`modularRuntime01.test.ts`, `modularLiveAdapter03a.test.ts`,
`modularRuntime03b.test.ts`, and the new `modularRuntime04a.test.ts`.

---

## 8. Files changed

| File | Change |
|---|---|
| `src/modular/modularVehicleComposition.ts` | Add `MODULAR_VEHICLE_BASE_SCALE = 0.16`; make `MODULAR_VEHICLE_DISPLAY_SCALE` a deprecated alias |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | `ENABLE_MODULAR_VEHICLE_RENDER` default `false → true`; updated docs |
| `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` | Relabel toggle as emergency/debug fallback (default ON) |
| `src/phaser/GameScene.ts` | Remove proof harness imports/fields/instantiation/deps/cleanup |
| `src/phaser/input/GameInputController.ts` | Remove proof harness import/dep/field/ctor + `9` hotkey |
| `src/__tests__/modularRuntime01.test.ts` | Scale assertions use `MODULAR_VEHICLE_BASE_SCALE` |
| `src/__tests__/modularLiveAdapter03a.test.ts` | Stale `0.5` comments corrected |
| `src/__tests__/modularRuntime04a.test.ts` | **New** — scale parity, default-flag, Dictator hull-only |
| `src/phaser/dev/GeneratedVehicleProofHarness.ts` | **Removed** |
| `src/phaser/dev/GeneratedVehicleProofPanel.ts` | **Removed** |
| `src/phaser/render/generatedVehiclePreviewComposition.ts` | **Removed** |
| `src/__tests__/generatedVehiclePreviewComposition.test.ts` | **Removed** |
| `docs/project/MODULAR_RUNTIME_04A_*` | **New** — this report |
| `docs/project/CURRENT_NEXT_STEP.md` | Updated with 04A status |

---

## 9. Tests

- New `modularRuntime04a.test.ts` (8 tests): base scale = 0.16, alias parity,
  live base scale, preview==live for all 7 hulls at default calibration,
  Dictator hull-only, default flag = true.
- Updated `modularRuntime01.test.ts` scale assertions to reference the shared
  constant instead of hardcoded `0.5`.
- Existing 03A/03B/01C flag and Dictator tests pass unchanged (they save and
  restore the flag and assert scale symbolically against the constant).

Validation results:

- `npm run typecheck`: **PASS**
- `npm test`: **PASS** — 89 files, 4653 tests.
- `npm run build`: **PASS** (`tsc && vite build`, built in ~50s).
- `npm run qa:smoke`: **FAIL — environment only**. Playwright's browser
  binary is not installed in this container (`Executable doesn't exist …
  chrome-headless-shell`; "No canvas element found"). Not a code failure;
  requires `npx playwright install`.

---

## 10. Manual QA plan

1. Normal runtime: vehicles are PNG modular hull+turret, not turquoise cubes.
2. Arena/devtools: vehicles are PNG modular hull+turret by default (no toggle).
3. Labels / HP bars / selection rings / shadows / target locks still render.
4. Verify hulls: Wasp, Hornet, Hunter, Viking, Dictator, Titan, Mammoth.
5. Verify turrets: Smoky, Twins, Ricochet, Railgun, Firebird, etc.
6. Verify factions cyan/green/yellow/purple where spawnable.
7. Dictator visually ~+9% hull only; turret unchanged.
8. No full-matrix preload (only selected sets request PNGs).
9. No 404 spam.
10. Force a loading/missing-asset state: legacy fallback shows and units do
    not disappear; once assets load, modular takes over.

---

## 11. Risks / rollback

- **Risk:** default-on modular render exercises the live adapter on first
  load for any spawned vehicle. Mitigated by retained emergency fallback and
  `retryCleanModular()` resync; no entity disappears while loading.
- **Risk:** scale change (`0.5 → 0.16`) alters on-screen vehicle size in any
  surface that was relying on the old `0.5`. This is intended — it matches
  the accepted preview visual — and is purely visual (no collision/footprint
  change).
- **Rollback:** revert this PR. Setting `ENABLE_MODULAR_VEHICLE_RENDER = false`
  restores the legacy default; reverting `MODULAR_VEHICLE_BASE_SCALE` to `0.5`
  restores the old size. Both are single-line reversions.

**⚠️ GPT review required before merge.**
