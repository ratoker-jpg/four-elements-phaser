# VEHICLE-RENDER-UNIFY-ROADMAP — Vehicle Render Unification High+ Roadmap

**Date:** 2026-06-16
**Project:** Four Elements Phaser
**Repo:** `ratoker-jpg/four-elements-phaser`
**Base branch:** `main` @ `4bced103` (after PR #295 / MODULAR-RUNTIME-04A)
**Mode:** AUDIT / DESIGN / DOCS PR ONLY
**Risk level:** High+ (overall)
**Companion document:** `docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md`
**Status:** Awaits GPT / Denis review before any implementation

---

## 1. Roadmap shape (4 stages)

```text
Stage 1 (High+)  Canonical renderer foundation
        │
        ▼
Stage 2 (High+)  Visual parity + placement stabilization
        │
        ▼  (manual QA gate — Denis accepts)
Stage 3 (High)   Legacy renderer retirement
        │
        ▼
Stage 4 (High)   GameScene render orchestration cleanup
```

**Why 4 stages, not 12 microsteps:** the project's AGENTS.md explicitly
forbids "1 tiny task → 1 audit → 1 tiny task" patterns. Each stage here is
a single PR-sized scope with a clear gate. Stages 1 and 2 are
independently revertible. Stage 3 is gated on manual QA acceptance of
Stage 2. Stage 4 is non-blocking polish.

**Why not 1 giant PR:** AGENTS.md also forbids refactoring everything in
one PR. The render path is central; a single PR would be impossible to
review and would risk rollback parity.

---

## 2. Stage 1 — Canonical renderer foundation

### 2.1 Goal

Establish the canonical renderer contract and isolate debug artifacts
**without changing runtime visuals**. After Stage 1, the canonical path
is enforced by tests, and default-view debug leaks are gone — but no
render code is deleted yet.

### 2.2 Risk level

**High+.** Touches the central visual path's contracts and the most
visible debug artifacts. No visual change in default view by intent, but
the contract tests become load-bearing for all future PRs.

### 2.3 Why High+ not High

- Adds **contract tests** that future PRs must not violate. These tests
  encode the canonical path as an invariant; any regression is caught at
  CI time.
- Removes **debug leaks** that are currently visible to manual QA. If a
  leak is actually intentional UI (e.g. direction arrow), the change is
  a product decision, not just a code change.
- Touches `BlockoutVehicleRenderer.ts` (1548 lines, god class) — even
  small edits in a god class carry non-trivial regression risk.

### 2.4 Files likely touched

| File | Change |
|------|--------|
| `src/phaser/render/BlockoutVehicleRenderer.ts` | Gate `showMountPoints`, `showDebugLabels`, and aim-line rendering behind `isDevtoolsActive()`. Flip defaults to `false`. Add `isDevtoolsActive()` check inside the `isSelected` aim-line branch. |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | Add a JSDoc contract block declaring `syncVehicle()` / `placeModularCombat()` / `retryCleanModular()` as the canonical live entry points. No behavior change. |
| `src/__tests__/vehicleRenderContract.test.ts` | **New** — contract tests asserting: (a) `BlockoutVehicleRenderer` does not draw mount-point dot / debug label / aim line when `isDevtoolsActive() === false`; (b) `ModularVehicleLiveAdapter.syncVehicle()` returns `usedModular: true` when `plan.available === true`; (c) `ModularTankRenderer` legacy path is not invoked when adapter succeeds. |
| `src/__tests__/blockoutDebugArtifactGating.test.ts` | **New** — asserts `showMountPoints` and `showDebugLabels` default to `false`; asserts aim line is gated by `isDevtoolsActive()`. |
| `docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md` | Already created in this PR. |
| `docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md` | Already created in this PR. |
| `docs/project/CURRENT_NEXT_STEP.md` | Optional: update to point at this audit + roadmap as the active next decision. |

### 2.5 What changes

1. `BlockoutVehicleRenderer.showMountPoints` default: `true` → `false`.
2. `BlockoutVehicleRenderer.showDebugLabels` default: `true` → `false`.
3. `BlockoutVehicleRenderer.renderVehicle()` aim-line branch (`if (isSelected)`):
   wrap in `if (this.isDevtoolsActive())`.
4. New contract test file enforcing the canonical path.
5. New debug-gating test file enforcing the leak fix.

### 2.6 What is NOT touched

- `composeModularVehicle()` math.
- `MODULAR_VEHICLE_BASE_SCALE` value.
- `HULL_VISUAL_SCALE_MULTIPLIERS` value.
- `ModularVehicleLiveAdapter` behavior (only JSDoc).
- `ModularTankRenderer` legacy path.
- `BlockoutVehicleInputController` turret-to-cursor behavior (Stage 2).
- `entity.faction ?? 'cyan'` defaults (Stage 2).
- Any asset / metadata / generated file.
- Any combat / movement / economy / mapgen / pathfinding / save-load code.

### 2.7 Tests

- `vehicleRenderContract.test.ts` — 4–6 tests.
- `blockoutDebugArtifactGating.test.ts` — 3–5 tests.
- Existing 89 test files continue to pass (verified by `npm test`).

### 2.8 Validation

- `npm run typecheck` — PASS.
- `npm test` — PASS (existing + new tests).
- `npm run build` — PASS.
- `npm run qa:smoke` — PASS (standard + devtools/arena). Visual
  inspection of screenshots: no red mount-point dot, no debug labels, no
  red dashed aim line in default view.

### 2.9 Manual QA acceptance

1. Start standard normal game (`?skipMenu`). Spawn a modular-combat
   entity. **Verify:** no red dot on turret, no debug text above vehicle,
   no red dashed line when selected.
2. Start Arena (`?skipMenu&devtools=1&arena=1`). Spawn a vehicle. Select
   it. **Verify:** no red mount-point dot, no debug label, no red dashed
   aim line.
3. Toggle devtools debug overlay (T key or devtools panel). **Verify:**
   mount-point dot, debug labels, and aim line reappear when devtools
   debug is explicitly enabled.
4. Spawn vehicles of all 4 factions. **Verify:** faction colors are
   correct on hulls (Stage 1 does not fix the cyan-default bug; that is
   Stage 2. But spawn via Arena menu sets faction explicitly, so this
   should already work in Arena).

### 2.10 Rollback plan

Revert the PR. The changes are:
- Two default-value flips (`true` → `false`).
- One `if` wrapper around aim-line rendering.
- Two new test files (no production code).

Single-PR revert restores prior behavior.

---

## 3. Stage 2 — Visual parity + placement stabilization

### 3.1 Goal

Eliminate the visible symptoms: PNG vs blockout mixed, faction loss,
flicker on spawn, turret-to-cursor in non-Arena devtools. After Stage 2,
**all spawned vehicles in all live modes render as modular PNG by
default**, with emergency fallback invisible during normal load.

### 3.2 Risk level

**High+.** Touches faction flow (silent recolor bug), spawn-to-render
flow (flicker), and non-Arena devtools turret behavior. Visible
behavior changes in all modes.

### 3.3 Why High+ not High

- Removes `entity.faction ?? 'cyan'` defaults that have been in place
  since 03B. Any code path that relied on the default (even implicitly)
  will now fail loudly instead of silently recoloring.
- Changes the spawn-to-render flow to hide vehicles during texture load.
  If the load never completes (missing asset), the vehicle stays
  invisible — a regression from "always shows something".
- Turret-to-cursor behavior in non-Arena devtools is a manual QA
  workflow change.

### 3.4 Files likely touched

| File | Change |
|------|--------|
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | Remove `entity.faction ?? 'cyan'` at lines 267 and 318. Require `faction: Faction` (non-optional) in `placeModularCombat()` signature. If faction is missing, return `usedModular: false` with `fallbackReason: 'missing-faction'` (loud failure, not silent recolor). |
| `src/phaser/render/ModularTankRenderer.ts` | Remove `entity.faction ?? 'cyan'` at line 182. Pass `entity.faction` directly; if undefined, log a warning and skip placement (do not silently recolor). |
| `src/modular/normalCombatToModularVisual.ts` | Tighten `faction: Faction \| string` to `faction: Faction`. Remove the `as Faction` cast at line 145. |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | Add a "spawn grace" mechanism: when a vehicle is first spawned, request its modular set immediately and suppress the procedural fallback rendering for N frames (e.g. 30 frames / 500 ms) while textures load. If textures arrive within the grace window, the vehicle appears directly as modular PNG. If they do not arrive, fall back to procedural blockout (current behavior). |
| `src/phaser/render/EntityRenderer.ts` | Apply the same spawn-grace mechanism for normal-runtime modular-combat entities: hide the entity's sprite until `retryCleanModular()` succeeds or grace expires. |
| `src/assets/runtimeGeneratedAssets.ts` | Optionally extend `loadArenaVisualAssets()` to preload the pilot turret (smoky) for all 4 factions, not just cyan. (Open question 1 in audit §13.) |
| `src/phaser/input/BlockoutVehicleInputController.ts` | Document the non-Arena devtools turret-to-cursor behavior with a JSDoc block. Optionally add a devtools panel toggle to enable/disable it. (Open question 2 in audit §13.) |
| `src/__tests__/vehicleRenderFactionFlow.test.ts` | **New** — tests that a non-cyan faction flows correctly through `placeModularCombat()` → `normalCombatToModularVisual()` → `composeModularVehicle()`. Tests that missing faction produces `fallbackReason: 'missing-faction'`, not silent cyan. |
| `src/__tests__/vehicleRenderSpawnGrace.test.ts` | **New** — tests that a vehicle is invisible during the spawn grace window, then appears as modular PNG once textures arrive. Tests that grace expiry falls back to procedural blockout. |

### 3.5 What changes

1. `entity.faction ?? 'cyan'` removed at 3 sites. Faction is now
   required; missing faction is a loud failure.
2. `normalCombatToModularVisual` signature tightened to `faction: Faction`.
3. Spawn-grace mechanism in `BlockoutVehicleRenderer` and
   `EntityRenderer` — vehicles are invisible for up to N frames while
   modular textures load, then appear directly as PNG. No turquoise cube
   flicker.
4. Optional: pilot turret preloaded for all 4 factions (resolves "only
   cyan works" immediately for the pilot combo).
5. Non-Arena devtools turret-to-cursor documented (no behavior change
   unless Denis decides to align it with Arena target-lock).

### 3.6 What is NOT touched

- `composeModularVehicle()` math.
- `MODULAR_VEHICLE_BASE_SCALE` value.
- `BlockoutVehicleRenderer` procedural blockout rendering (still
  available as fallback after grace expiry).
- `ModularTankRenderer` legacy path (still available as fallback).
- Camera projection contract.
- Combat / movement / economy / mapgen / pathfinding / save-load.

### 3.7 Tests

- `vehicleRenderFactionFlow.test.ts` — 4–6 tests.
- `vehicleRenderSpawnGrace.test.ts` — 3–5 tests.
- Existing tests continue to pass. The `entity.faction ?? 'cyan'` removal
  may surface latent bugs in callers — these must be fixed in the same
  PR (not deferred).

### 3.8 Validation

- `npm run typecheck` — PASS. Type errors from the tightened `Faction`
  signature must be fixed at the call sites.
- `npm test` — PASS.
- `npm run build` — PASS.
- `npm run qa:smoke` — PASS.
- Manual QA (see §3.9).

### 3.9 Manual QA acceptance (this is the gate for Stage 3)

1. **Standard normal game:** spawn a non-cyan modular-combat entity
   (e.g. green wasp+smoky). **Verify:** vehicle appears as green modular
   PNG (not cyan, not blockout cube). No flicker during spawn.
2. **Arena devtools:** spawn one vehicle of each faction (cyan, green,
   yellow, purple). **Verify:** all four appear as correct-faction
   modular PNG. No turquoise cubes. No flicker.
3. **Arena devtools:** spawn a Dictator-hull vehicle. **Verify:** hull
   is visually ~9% larger than other hulls; turret is normal size.
4. **Arena devtools:** select a vehicle. **Verify:** no red dashed aim
   line (Stage 1 already fixed this; re-verify). No red mount-point dot.
   No debug label.
5. **Arena devtools:** toggle devtools debug overlay. **Verify:**
   mount-point dot, debug labels, and aim line reappear.
6. **Non-Arena devtools:** select a vehicle. Move mouse. **Verify:**
   turret follows cursor (documented behavior) OR target-lock only
   (if Denis chose to align with Arena).
7. **Force a missing-asset state** (e.g. temporarily rename a PNG).
   Spawn the affected vehicle. **Verify:** after spawn-grace expires,
   procedural blockout fallback appears. No entity disappears
   permanently. Console warning is logged.
8. **Spawn 10 vehicles rapidly** in Arena. **Verify:** all 10 appear as
   modular PNG within ~1 second. No persistent blockout cubes.
9. **Verify hulls:** Wasp, Hornet, Hunter, Viking, Dictator, Titan,
   Mammoth — all render correctly.
10. **Verify turrets:** Smoky, Twins, Ricochet, Railgun, Firebird
    (=flamethrower), Freeze, Isida, Vulcan (vulcan_b), Thunder, Hammer
    — all render correctly. (Shaft is mapped to railgun per
    `WEAPON_TO_TURRET_MAP`.)
11. **Verify mods:** M0, M1, M2, M3 for at least one hull+turret combo.
12. **No 404 spam** in console.

### 3.10 Rollback plan

Revert the PR. The changes are:
- 3 `?? 'cyan'` removals (restored by revert).
- 1 signature tightening (restored by revert).
- Spawn-grace mechanism (removed by revert; fallback to current
  per-frame check).
- Optional pilot preload extension (removed by revert).
- 2 new test files (no production code).

Single-PR revert restores prior behavior, including the cyan-default
silent recolor. The revert is safe because Stage 1 is independent.

---

## 4. Stage 3 — Legacy renderer retirement

### 4.1 Goal

After Stage 2 manual QA acceptance, retire `ModularTankRenderer` legacy
path and `BlockoutVehicleRenderer` procedural fallback as production
paths. They move to `src/phaser/render/legacy/` (or are deleted, per
open question 6 in audit §13). The per-dir offset tables
`MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` and
`MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` are removed.

### 4.2 Risk level

**High.** Removes rollback path. If a Stage 2 regression was missed in
manual QA, Stage 3 makes it harder to recover.

### 4.3 Why High not High+

- Gated on Stage 2 manual QA acceptance (Denis signs off).
- Legacy code is moved, not deleted (if "legacy/" option is chosen),
  preserving the ability to revive it.
- No new behavior; only code removal.

### 4.4 Files likely touched

| File | Change |
|------|--------|
| `src/phaser/render/ModularTankRenderer.ts` | Move to `src/phaser/render/legacy/ModularTankRenderer.ts`. Remove imports from `EntityRenderer`. Keep the file compilable (for emergency revival) but unreferenced from production. |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | Either (a) move the procedural-blockout methods to `src/phaser/render/legacy/BlockoutProceduralFallback.ts` and keep only the overlay + adapter-coordination code in `BlockoutVehicleRenderer`, or (b) keep as-is but mark the procedural path as deprecated and gate it behind `if (import.meta.env.DEV)` for emergency-only use. (Open question 6 in audit §13.) |
| `src/config/worldConfig.ts` | Remove `DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `DEFAULT_MODULAR_TURRET_MOUNT_BY_BODY_DIR`, `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`, `tunerState`, and the `cloneOffsetRecord` helper. `worldConfig.ts` becomes immutable-only (TILE_W, TILE_H, MAP_W, MAP_H). |
| `src/assets/modularUnitAssets.ts` | Remove `getWaspHullKey()` and `getSmokyTurretKey()` (legacy keys). |
| `src/assets/pilotTurretComposition.ts` | Remove (quarantined since 03B, no longer referenced). |
| `src/assets/pilotVehicleLazyLoad.ts` | Either remove (if pilot set is no longer used) or simplify (if pilot set is still the Arena devtools preload). Decision depends on Stage 2 pilot-set extension. |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | Remove `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` reference (quarantine flag). Remove `ENABLE_MODULAR_VEHICLE_RENDER` flag (or keep as devtools emergency toggle only). |
| `src/__tests__/legacyWaspIsolation.test.ts` | Update forbidden-identifier guard list to include the newly-removed identifiers. |
| `src/__tests__/vehicleRenderNoLegacyPath.test.ts` | **New** — asserts that `ModularTankRenderer` and the procedural blockout path are not imported by any production file (only by devtools or legacy quarantine). |

### 4.5 What changes

1. `ModularTankRenderer` moved to `legacy/`.
2. `BlockoutVehicleRenderer` procedural methods either moved to `legacy/`
   or gated behind `import.meta.env.DEV`.
3. Per-dir offset tables removed from `worldConfig.ts`.
4. Legacy `getWaspHullKey` / `getSmokyTurretKey` removed.
5. `pilotTurretComposition.ts` removed.
6. `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` removed.
7. `worldConfig.ts` becomes immutable-only.

### 4.6 What is NOT touched

- `composeModularVehicle()`.
- `ModularVehicleLiveAdapter` (canonical path).
- `GeneratedModularVehicleRenderer` (preview).
- Camera projection contract.
- Combat / movement / economy / mapgen / pathfinding / save-load.

### 4.7 Tests

- `vehicleRenderNoLegacyPath.test.ts` — 2–3 tests.
- `legacyWaspIsolation.test.ts` — updated guard list.
- Existing tests continue to pass. Tests that explicitly exercised
  legacy paths (e.g. `runtime03PilotTurretComposition.test.ts`) are
  removed alongside the legacy code.

### 4.8 Validation

- `npm run typecheck` — PASS.
- `npm test` — PASS.
- `npm run build` — PASS. Bundle size should decrease (legacy code
  removed from production).
- `npm run qa:smoke` — PASS.
- Manual QA (see §4.9).

### 4.9 Manual QA acceptance

1. Re-run all Stage 2 manual QA checks. **Verify:** no regression.
2. **Verify:** production bundle does not contain `ModularTankRenderer`
   or `getWaspHullKey` strings (grep the built `dist/`).
3. **Verify:** devtools emergency toggle (if retained) still works to
   force legacy path for debugging.

### 4.10 Rollback plan

Revert the PR. The legacy code is still in git history (or in `legacy/`
folder if moved). Reverting restores production references.

If legacy code was deleted (not moved), revert restores from git
history. Either way, rollback is straightforward.

---

## 5. Stage 4 — GameScene render orchestration cleanup

### 5.1 Goal

Reduce `GameScene` (1362 lines, ~30 subsystems) render orchestration
branching. Move render-specific state and sync calls into a
`RenderManager` / subscene-manager. This is polish; it does not change
runtime visuals.

### 5.2 Risk level

**High.** Refactor of a god class. Risk of regression in scene lifecycle
(create / shutdown / pause / resume).

### 5.3 Why High not High+

- No visible behavior change (pure refactor).
- Gated on Stage 3 (legacy code already removed, simpler surface).
- Tests already cover the contracts; regressions are caught at CI.

### 5.4 Files likely touched

| File | Change |
|------|--------|
| `src/phaser/GameScene.ts` | Extract render orchestration into `src/phaser/render/RenderManager.ts`. `GameScene` retains only scene lifecycle + top-level update dispatch. |
| `src/phaser/render/RenderManager.ts` | **New** — owns `terrainRenderer`, `entityRenderer`, `blockoutVehicleRenderer`, `feedbackRenderer`, `motionFxRenderer`, `debugOverlayRenderer`, `generatedModularVehicleRenderer`, `cameraProjectionDebugRenderer`. Exposes `syncFromState(state, time.now)` and `shutdown()`. |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | After Stage 3 cleanup, split remaining overlay code into `BlockoutVehicleOverlays.ts` (HP bar, selection ring, hover ring, target-lock, direction arrow, move-target marker). The adapter-coordination code stays in `BlockoutVehicleRenderer` (renamed to `BlockoutVehicleAdapterHost` or similar). |
| `src/__tests__/renderManager.test.ts` | **New** — tests that `RenderManager.syncFromState()` calls each sub-renderer in the correct order. |

### 5.5 What changes

1. `GameScene` shrinks from ~1362 lines to ~500–700 lines.
2. Render subsystems owned by `RenderManager`, not `GameScene`.
3. `BlockoutVehicleRenderer` split into adapter-host + overlays.

### 5.6 What is NOT touched

- `composeModularVehicle()`.
- `ModularVehicleLiveAdapter`.
- Camera projection contract.
- Combat / movement / economy / mapgen / pathfinding / save-load.
- Input controllers (separate cleanup, if needed, is a future audit).

### 5.7 Tests

- `renderManager.test.ts` — 3–5 tests.
- Existing tests continue to pass.

### 5.8 Validation

- `npm run typecheck` — PASS.
- `npm test` — PASS.
- `npm run build` — PASS.
- `npm run qa:smoke` — PASS.
- Manual QA: re-run Stage 2 checks. No regression.

### 5.9 Manual QA acceptance

1. All Stage 2 checks pass.
2. `GameScene.ts` line count < 800.
3. No render subsystem is referenced directly by `GameScene` (only
   through `RenderManager`).

### 5.10 Rollback plan

Revert the PR. The refactor is pure code movement; revert restores the
god-class structure.

---

## 6. Step risk table

| Stage | Risk | Why | Mitigation |
|-------|------|-----|------------|
| Stage 1 | High+ | Touches central visual path contracts and visible debug artifacts | No runtime visual change; contract tests catch regressions; revertible |
| Stage 2 | High+ | Removes silent cyan-default, adds spawn-grace, changes faction flow | Manual QA gate before Stage 3; loud failures surface latent bugs; revertible |
| Stage 3 | High | Removes legacy rollback path | Gated on Stage 2 acceptance; legacy code moved not deleted; revertible |
| Stage 4 | High | Refactors god class | Pure code movement; no visual change; contract tests catch regressions; revertible |

---

## 7. Dependencies / gates

```text
Stage 1 ──► Stage 2 ──► (manual QA gate, Denis signs off) ──► Stage 3 ──► Stage 4
```

- Stage 1 must merge before Stage 2 starts (Stage 2 contract tests build
  on Stage 1).
- Stage 2 must merge and **manual QA must accept** before Stage 3 starts.
  This is the only hard manual gate.
- Stage 3 must merge before Stage 4 starts (Stage 4 refactor is simpler
  after legacy removal).
- Stage 4 is optional / can be deferred. Stages 1–3 are the critical
  path.

Each stage is a single PR. No stage is split into multiple PRs unless
manual QA reveals an unexpected risk boundary.

---

## 8. Manual QA gates

| Gate | When | Who | Criteria |
|------|------|-----|----------|
| Stage 1 QA | After Stage 1 PR | Denis / GPT | Default view has no red dot, no debug labels, no red dashed aim line. Devtools debug overlay re-enables them. |
| Stage 2 QA (critical gate) | After Stage 2 PR | Denis | All §3.9 checks pass. All 4 factions render correctly. No flicker. No silent cyan recolor. |
| Stage 3 QA | After Stage 3 PR | Denis / GPT | All Stage 2 checks re-pass. Production bundle has no legacy strings. |
| Stage 4 QA | After Stage 4 PR | Denis / GPT | All Stage 2 checks re-pass. `GameScene.ts` < 800 lines. |

---

## 9. Rollback plan (overall)

- Each stage is a single PR. Revert is per-stage.
- Stage 1 revert: restores debug leaks (acceptable; was the prior state).
- Stage 2 revert: restores silent cyan-default and flicker (acceptable;
  was the prior state).
- Stage 3 revert: restores legacy renderers (acceptable; they still work
  as fallback).
- Stage 4 revert: restores god-class `GameScene` (acceptable; was the
  prior state).

No stage's revert requires reverting earlier stages. The stages are
linearly dependent but each is independently revertible.

If Stage 2 manual QA fails and cannot be fixed in-revision, Stage 1
remains merged (it is a strict improvement: debug leaks fixed). The
canonical-path contract tests from Stage 1 remain in place and continue
to guard against regression.

---

## 10. Implementation prompts (deferred)

Concrete implementation prompts for each stage will be created by GPT
after this audit + roadmap is accepted. They are not included in this
doc to keep it decision-focused. Each implementation prompt should:

- Reference this roadmap's stage definition verbatim.
- List the exact files from §2.4 / §3.4 / §4.4 / §5.4.
- Include the manual QA checklist from §2.9 / §3.9 / §4.9 / §5.9.
- Forbid the items listed in audit §12.
- Require validation per §2.8 / §3.8 / §4.8 / §5.8.
- Require the rollback plan per §2.10 / §3.10 / §4.10 / §5.10.

---

## 11. What this roadmap does NOT do

- Does not add new render paths.
- Does not change `composeModularVehicle()` math.
- Does not change `MODULAR_VEHICLE_BASE_SCALE` or Dictator multiplier.
- Does not change camera projection.
- Does not add query-string flags.
- Does not preload the full 4352-PNG matrix.
- Does not create combined hull×turret matrices.
- Does not touch combat / movement / economy / mapgen / pathfinding /
  save-load.
- Does not add new assets or regenerate existing assets.
- Does not modify generated metadata JSON.
- Does not commit logs / tool-results / screenshots / secrets / tokens.
- Does not close or merge any PR without explicit GPT/Denis approval.
- Does not blindly reuse PR #296's mount-slot / forward-back drift
  model.

---

## 12. Final notes

This roadmap is derived from current `main` evidence (audit
§1–§14). Each stage's risk, files, tests, validation, and rollback are
project-specific, not generic.

The 4-stage shape (foundation → parity → retirement → orchestration
cleanup) is the minimum sequence that satisfies:

- AGENTS.md "no tiny task → tiny audit → tiny task" rule.
- AGENTS.md "no refactor everything in one PR" rule.
- The prompt's "3–5 serious steps with clear gates" requirement.
- The prompt's "what should not be done right now" requirement
  (no #296 reuse, no per-dir tables, no early deletion).

**GPT review required before implementation.**
