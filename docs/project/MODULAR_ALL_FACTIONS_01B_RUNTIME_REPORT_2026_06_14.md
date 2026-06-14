# MODULAR-ALL-FACTIONS-01B Runtime Integration Report

Date: 2026-06-15
Task: MODULAR-ALL-FACTIONS-01B
Status: implemented, GPT review required before merge
Branch: `modular-all-factions-01b`

---

## Summary

This change connects the all-factions modular runtime and adds Dictator visual scale compensation. The asset-only import PR (#286) placed 4,352 PNGs (112 hull sets + 160 turret sets across 4 factions) into the repo without touching runtime code. This PR updates the generated asset registry, runtime model, composition, renderer, devtools panel, and tests to make all 4 factions available at runtime while preserving lazy loading (max 32 PNG per selected visual).

---

## Source state after asset import PR

The ASSET-IMPORT-02A (PR #286) merged commit added:
- 1,792 hull PNGs across `public/assets/units/hulls/<hull>/<faction>/<mod>/`
- 2,560 turret PNGs across `public/assets/units/turrets/<turret>/<faction>/<mod>/`
- All-factions manifest: `modular_vehicle_asset_manifest_all_factions_v1.json`
- All-factions metadata: `hull_socket_manifest_modular_all_factions_v1.json` + `turret_pivot_manifest_modular_all_factions_v1.json`
- No `src/` changes, no generated TS changes, no runtime changes

The generated registry (`generatedModularVehicleAssets.generated.ts`) was still cyan-only: `GENERATED_MODULAR_FACTIONS = ["cyan"]`.

---

## Registry all-factions support

Updated `src/assets/generatedModularVehicleAssets.generated.ts`:
- `GENERATED_MODULAR_FACTIONS` expanded from `["cyan"]` to `["cyan", "green", "yellow", "purple"]`
- Header comment updated with all-factions asset counts
- All key/path builders already accepted `GeneratedModularFactionId` as parameter — no function signature changes needed
- `modular_hull_*` key namespace preserved
- `generated_turret_*` key namespace preserved

Registry counts verified by tests:
- hull sets: 7 × 4 × 4 = 112
- turret sets: 10 × 4 × 4 = 160
- hull paths: 112 × 16 = 1,792
- turret paths: 160 × 16 = 2,560
- supported factions: exactly cyan / green / yellow / purple

---

## Changed runtime model

`ModularVehicleVisual` already had a `faction` field typed as `ModularFactionId` (derived from `GeneratedModularFactionId`). The type automatically widens to `"cyan" | "green" | "yellow" | "purple"` when the generated factions constant is expanded. No structural change to the `ModularVehicleVisual` interface was required.

Default visual remains: `wasp + smoky + cyan + m0/m0`.

Required behavior (preserved):
- changing faction changes both hull and turret asset faction
- changing hullMod changes only hull mod
- changing turretMod changes only turret mod
- changing hullId does not change turretId
- changing turretId does not change hullId

---

## Faction selector behavior

Updated `ModularVehicleDevtoolsPanel` to add a faction cycling control:
- `◀ faction` / `faction ▶` buttons added above the hull selector
- Cycles through cyan → green → yellow → purple → cyan
- Readout shows current faction
- Faction selector defaults to cyan (matching DEFAULT_MODULAR_VEHICLE_VISUAL)
- Changing faction does not alter hullId/turretId/hullMod/turretMod except the faction field

---

## Lazy-loading guarantee

Preserved unchanged:
- `requestModularVehicleSet` queues exactly 16 hull + 16 turret = 32 PNG max per selected visual
- No all-factions preload
- No all-hulls preload
- No all-turrets preload
- The loader ledger prevents re-queue churn
- Selecting a green faction visual queues only the green hull and turret PNG paths

Added diagnostics:
- Devtools readout shows selected faction
- Devtools readout shows hull scale multiplier when Dictator is selected
- Renderer label shows faction and Dictator scale compensation note

---

## Key namespace protection

Preserved:
- Modular hull keys use `modular_hull_` prefix (MODULAR-RUNTIME-02A)
- Modular turret keys use `generated_turret_` prefix
- No `_hull_dir` path segment in modular runtime paths
- Wasp m0 modular key: `modular_hull_wasp_cyan_m0_dir00`
- Key namespace is disjoint from legacy `generated_hull_*` arena preload namespace

Tests verify:
- `modular_hull_` prefix on all hull keys
- No `_hull_dir` in modular hull paths
- Modular key differs from legacy key for same hull/faction/mod/dir

---

## Dictator visual scale compensation

Context: Dictator was rendered/exported at asset-side scale 0.91 to avoid clipping in the 512×512 frame. Runtime needs visual-only compensation of 1.09 (≈ 1 / 0.91) so the hull appears at its intended size.

Implementation:
- `HULL_VISUAL_SCALE_MULTIPLIERS` constant: `{ dictator: 1.09 }`
- `getHullVisualScaleMultiplier(hullId)` function: returns 1.09 for "dictator", 1 for all others
- Composition applies multiplier to hull visual scale only: `hullVisualScale = displayScale * hullScaleMultiplier`
- Hull displaySize is scaled accordingly: `hullDisplaySize = MODULAR_FRAME_SIZE * hullVisualScale`
- Turret scale and displaySize remain unchanged (normal `displayScale`)
- Socket/pivot alignment remains stable: hull is centered on anchor, socket is computed from scaled hull, turret pivot lands on socket
- No manual x/y offset added
- No zHeight added
- No per-direction tuning
- Collision/hitbox/footprint/movement/range are untouched

Tests verify:
- `getHullVisualScaleMultiplier("dictator") === 1.09`
- All other hulls return 1
- Dictator hull visual scale is larger than base displayScale
- Turret scale remains normal for Dictator
- Turret pivot still lands on hull socket for Dictator (stable alignment)

---

## Files changed

| File | Change |
|------|--------|
| `src/assets/generatedModularVehicleAssets.generated.ts` | Expanded factions to 4, updated header |
| `src/modular/modularVehicleComposition.ts` | Added `HULL_VISUAL_SCALE_MULTIPLIERS`, `getHullVisualScaleMultiplier()`, Dictator scale in composition |
| `src/phaser/render/GeneratedModularVehicleRenderer.ts` | Import scale helper, Dictator scale note in diagnostics, updated header |
| `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` | Added faction selector buttons and `cycleFaction()` |
| `src/__tests__/modularRuntime01.test.ts` | Expanded: all-factions tests, Dictator scale tests, key namespace tests |
| `docs/project/MODULAR_ALL_FACTIONS_01B_RUNTIME_REPORT_2026_06_14.md` | This report |
| `docs/project/CURRENT_NEXT_STEP.md` | Updated current state |

---

## Tests added/updated

`src/__tests__/modularRuntime01.test.ts` expanded from 35 to 60 tests:

New test sections:
- **All-factions support** (8 tests): faction list, per-faction paths, green/purple key validation, faction changes both hull+turret, registry counts, supported factions exactly
- **Dictator visual scale compensation** (6 tests): multiplier value, other hulls return 1, hull scale larger, displaySize larger, pivot alignment stable, turret scale unaffected
- **Key namespace protection** (4 tests): `modular_hull_` prefix, differs from legacy, Wasp m0 key preserved, no `_hull_dir` path

Updated existing tests:
- Registry faction test updated from `["cyan"]` to `["cyan", "green", "yellow", "purple"]`
- Hull key builder tests updated from `generated_hull_` to `modular_hull_` prefix
- Lazy loading test updated for non-cyan faction queue
- Fallback test updated for `modular_hull_` prefix
- Devtools default test updated to verify 4 factions available

---

## Validation results

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run test -- src/__tests__/modularRuntime01.test.ts` | **PASS** — 60 tests |
| `npm run test -- src/__tests__/legacyWaspIsolation.test.ts` | **PASS** — 7 tests |
| `npm run test -- src/__tests__/generatedHullAssets.test.ts` | **PASS** — 69 tests |
| `npm run test` | **PASS** — 86 files, 4530 tests |
| `npm run build` | **FAIL** — ENOSPC (environment only: 9.9GB disk, 4.7GB public assets) |
| `npm run qa:smoke` | Not run (build fails due to disk space) |

The build failure is purely an environment constraint: the server has 9.9GB total disk with 4.7GB of PNG assets in `public/`. The Vite production build copies these assets to `dist/` and the filesystem runs out of space. This is not a code or configuration issue — `tsc` passes cleanly and all tests pass. The build would succeed in an environment with adequate disk space.

---

## Manual QA plan

Open Modular Vehicle preview in Arena/devtools mode (`?devtools=1&arena=1&skipMenu=1`).

| # | Configuration | Expected |
|---|---------------|----------|
| 1 | cyan Wasp m0 + Smoky m0 | No fallback, correct cyan sprites |
| 2 | green Wasp m0 + Smoky m0 | No fallback, green hull + green turret |
| 3 | yellow Wasp m0 + Smoky m0 | No fallback, yellow hull + yellow turret |
| 4 | purple Wasp m0 + Smoky m0 | No fallback, purple hull + purple turret |
| 5 | cyan Dictator m0 + Railgun m0 | Dictator hull scaled at 1.09x, turret normal |
| 6 | green Dictator m0 + Railgun m0 | Green Dictator at 1.09x scale |
| 7 | purple Dictator m3 + Railgun m3 | Purple Dictator m3 at 1.09x scale |
| 8 | Titan or Mammoth + any turret | Normal scale (no multiplier) |
| 9 | Hornet + Ricochet | Normal scale, correct faction |
| 10 | Hunter + Twins | Normal scale, correct faction |
| 11 | Viking + Isida | Normal scale, correct faction |

Expected for all cases:
- No fallback sprites
- Diagnostics available: YES
- Selected visual queues max 32 PNG
- Faction changes both hull and turret asset color
- Wasp m0 remains correct (modular_hull key, no _hull_dir path)
- Dictator appears restored by 1.09 visual scale (not clipped)
- Turret pivot remains aligned on Dictator

---

## Known limitations

- Live Arena combat vehicles still render via `BlockoutVehicleRenderer`. The clean modular renderer is a devtools QA overlay only.
- Muzzle metadata (`muzzleNorm`) exists in the turret manifest but is not yet consumed.
- `MODULAR_VEHICLE_DISPLAY_SCALE` is a preview display constant; final in-world scale is decided when the renderer becomes the live owner.
- Build fails due to disk space constraint in this CI environment — not a code issue.
- Metadata TS is faction-independent (socket/pivot anchors are the same for all factions under the `world_origin_projects_to_frame_center` policy). No metadata TS update was needed.

---

## Next recommended step

After merge:
- **MODULAR-RUNTIME-02B**: Controlled Arena demo unit using `GeneratedModularVehicleRenderer`
- or **MODULAR-RUNTIME-03** if QA confirms readiness: make the clean renderer the live modular owner in Arena
