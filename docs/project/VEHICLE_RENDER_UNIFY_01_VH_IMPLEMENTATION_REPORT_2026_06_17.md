# VEHICLE-RENDER-UNIFY-01-VH — Implementation Report

**Date:** 2026-06-17
**Project:** Four Elements Phaser
**Repo:** `ratoker-jpg/four-elements-phaser`
**Base branch:** `main` @ `2665192` (after PR #297 merge)
**Implementation branch:** `vehicle-render-unify-01-vh`
**Mode:** VERY HIGH implementation — DRAFT PR (not ready for review until GPT/Denis manual review)
**Scope:** Combines VEHICLE-RENDER-UNIFY roadmap Stage 1 (canonical renderer foundation) + Stage 2 (visual parity + placement stabilization). Stage 3 (legacy renderer retirement) and Stage 4 (GameScene render orchestration cleanup) are NOT in this PR.
**Status:** Implementation complete; validation partial (typecheck + tests pass; build + qa:smoke blocked by environment disk-space constraints, not by code changes — see §11).

---

## 1. Summary

This PR implements the canonical vehicle renderer foundation and visual
parity stabilization for the Four Elements Phaser project. It addresses
the manual QA observations from PR #297's audit:

- some tanks PNG, some still old blockout cubes;
- some vehicles switched abruptly back to old placeholders;
- only cyan seemed fully connected in some paths;
- green/red debug lines and arrow markers appeared in default view;
- turret-to-cursor behavior was still active in some modes;
- modes still seemed to use different render paths.

The PR does **not** redesign placement math, does **not** delete legacy
renderers, and does **not** reuse the failed PR #296 mount-slot / forward-
back drift model.

After this PR:
- All four factions (cyan, green, yellow, purple) flow correctly through
  the live modular render path — no silent cyan recolor.
- Once a vehicle has been successfully rendered as modular PNG, transient
  texture-missing states (e.g. a new direction frame still loading) do
  NOT fall back to blockout — the last good modular sprites stay visible
  (sticky no-flicker).
- Default gameplay and Arena view show no red mount-point dots, no debug
  labels, no red dashed aim lines, no direction arrows on selection rings.
- Non-Arena devtools turret-to-cursor follow is OFF by default; existing
  devtools behavior is preserved as an explicit opt-in via
  `setTurretCursorFollowEnabled(true)`.
- Emergency fallback (blockout cubes / legacy wasp+smoky) is retained as
  last-resort for asset-loading/missing-asset states — never the default
  workflow when modular PNG is available.

---

## 2. What was implemented

### 2.1 Package C — Canonical visual decision (faction flow)

**New file:** `src/modular/factionResolver.ts`

A pure-TypeScript module that provides:

- `CANONICAL_FACTIONS = ['cyan', 'green', 'yellow', 'purple']`
- `isCanonicalFaction(value)` — type guard
- `resolveFactionOrDiagnosticFallback(value, context)` — the canonical
  resolver. Behavior:
  - Valid faction → passes through unchanged, `isValid: true`,
    `usedFallback: false`.
  - Missing/invalid faction → warns ONCE per `context` string (e.g.
    `'ModularVehicleLiveAdapter.placeModularCombat'`), returns
    `{ faction: 'cyan', isValid: false, usedFallback: true, originalValue }`.
    The cyan fallback is explicit and marked via `usedFallback === true`
    so callers/tests can always distinguish "real cyan" from "diagnostic
    cyan". This is the **no-silent-recolor** guarantee.
- `resetFactionWarningLedger()` / `getFactionWarningCounts()` —
  test/diagnostic helpers.

**Removed:** the three `entity.faction ?? 'cyan'` silent defaults at:
- `src/phaser/render/ModularVehicleLiveAdapter.ts:267` (placeModularCombat)
- `src/phaser/render/ModularVehicleLiveAdapter.ts:318` (pendingCombat storage)
- `src/phaser/render/ModularTankRenderer.ts:182` (place)

Replaced with explicit `resolveFactionOrDiagnosticFallback()` calls that
warn on missing faction and mark the fallback via `usedFallback`.

### 2.2 Package D — Stable modular PNG / no flicker (sticky state)

**Modified:** `src/phaser/render/ModularVehicleLiveAdapter.ts`

Added a `stickyModularSuccess` flag to the per-vehicle
`ModularSpriteState`. The flag is set `true` whenever
`applyPlan()` succeeds for a given `ModularVehicleVisual` identity, and
released when:

- the visual identity changes (different hull/turret/faction/mod);
- the vehicle is removed (`removeVehicle`);
- the adapter is destroyed;
- `ENABLE_MODULAR_VEHICLE_RENDER` is toggled off.

Direction (hullDir16/turretDir16) is NOT part of identity — direction
changes within the same visual are exactly the case where sticky keeps
the last good frame visible until the new direction's texture loads.

Behavior in `syncVehicle()` (Arena) and `placeModularCombat()` (normal
runtime):

```text
plan.available === true
  → applyPlan, setSticky, return usedModular:true

plan.available === false AND sticky === true (same visual identity)
  → keep last good modular sprites visible
  → return usedModular:true (suppress blockout fallback)
  → debugLabel includes "[sticky: keeping last good modular]"

plan.available === false AND sticky === false (first render of this visual)
  → hideVehicle (clear stale sprites from previous visual)
  → return usedModular:false (fall back to blockout)
```

This eliminates the "turquoise cube flicker" during direction changes
and asset-loading transitions.

### 2.3 Package E — Debug artifacts OFF by default (fixup: explicit flags)

**New file:** `src/config/debugRenderFlags.ts`

Module-level singleton with 4 explicit debug-render flags, all
defaulting to `false`:

- `debugRenderFlags.directionArrow`
- `debugRenderFlags.aimLine`
- `debugRenderFlags.mountPoints`
- `debugRenderFlags.debugLabels`

Helpers: `setDebugRenderFlag(key, value)`, `getDebugRenderFlag(key)`,
`resetDebugRenderFlags()`, `areAllDebugRenderFlagsOff()`.

This module is the **single source of truth** for debug artifact
visibility. Flags are never implicitly set by `isDevtoolsActive()`,
game mode, or URL params — only explicit setter calls flip them.

**Modified:** `src/phaser/render/BlockoutVehicleRenderer.ts`

Four changes (after the fixup commit `b551c476`):

1. `showMountPoints` / `showDebugLabels`: replaced renderer-local
   boolean fields with getter/setter proxies that read/write
   `debugRenderFlags.mountPoints` / `debugRenderFlags.debugLabels`.
   Default `false`. Existing `toggleMountPoints()` /
   `toggleDebugLabels()` / `isMountPointsVisible()` /
   `isDebugLabelsVisible()` continue to work through the proxy.

2. `showDebugLabels` proxy: same pattern, reads/writes
   `debugRenderFlags.debugLabels`. Default `false`.

3. Aim line (red dashed): gated by
   `if (isSelected && debugRenderFlags.aimLine)`.
   The red dashed aim line from barrel tip along turret aim direction
   is OFF by default, even when Arena/devtools is active. Devtools
   panels must explicitly call `setDebugRenderFlag('aimLine', true)`.

4. Direction arrow on selection ring: gated by
   `if (debugRenderFlags.directionArrow)`.
   The direction arrow outside the selection ring is OFF by default,
   even when Arena/devtools is active. Devtools panels must explicitly
   call `setDebugRenderFlag('directionArrow', true)`. The selection
   ring itself stays (it is core UI, not a debug artifact).

**Important (fixup rationale):** the original PR #298 commit gated the
aim line and direction arrow behind `this.isDevtoolsActive()`. That
was wrong because Arena mode is also devtools-active in `GameScene`,
so `isDevtoolsActive() === true` in default Arena view — the artifacts
still appeared by default. The fixup commit `b551c476` replaced
`isDevtoolsActive()` gating with explicit `debugRenderFlags.*` checks.

**Modified:** `src/phaser/input/BlockoutVehicleInputController.ts`

Added a `_turretCursorFollowEnabled` flag (default `false`) with public
accessor `turretCursorFollowEnabled` and setter
`setTurretCursorFollowEnabled(enabled)`.

In `update()` (line ~344) and the fire-handler (line ~957), the
non-Arena devtools turret-to-cursor / mouse-aim behavior is now gated
behind this flag:

- Arena mode: target-lock only (unchanged).
- Non-Arena devtools + `turretCursorFollowEnabled === false` (default):
  turret holds its last angle, fire requires explicit target.
- Non-Arena devtools + `turretCursorFollowEnabled === true` (explicit
  opt-in): legacy mouse-follow behavior restored.

This makes turret-to-cursor an explicit devtools opt-in rather than the
default non-Arena devtools behavior.

### 2.4 Package F — Normal runtime and Arena parity

Both live surfaces (`BlockoutVehicleRenderer` + `ModularVehicleLiveAdapter`
for Arena devtools; `EntityRenderer` → `ModularTankRenderer` +
`ModularVehicleLiveAdapter` for normal runtime) now:

- Use the same `resolveFactionOrDiagnosticFallback()` for faction
  resolution — no silent cyan recolor on either surface.
- Use the same sticky no-flicker state in `ModularVehicleLiveAdapter` —
  once a vehicle is modular, it stays modular across direction changes
  on both surfaces.
- Gate debug artifacts behind explicit `debugRenderFlags.*` flags
  (default OFF, even when Arena/devtools is active) — default view is
  clean on both surfaces.

Mode-specific code (Arena roster UI, normal-runtime PlaytestHud, etc.)
is unchanged. The visual decision contract is now shared.

### 2.5 Package G — Tests

**New file:** `src/__tests__/vehicleRenderFactionFlow.test.ts` (15 tests)

Covers `factionResolver`:
- `isCanonicalFaction` for all 4 factions + invalid values.
- `resolveFactionOrDiagnosticFallback` passes valid factions through.
- Missing/invalid faction warns once per context (no silent recolor).
- Diagnostic cyan fallback is marked via `usedFallback === true`.
- `resetFactionWarningLedger` clears counts.
- Different contexts warn independently.

**New file:** `src/__tests__/vehicleRenderUnify01vh.test.ts` (30 tests)

Covers:
- Sticky no-flicker behavior (8 tests):
  - first render with assets missing → fallback;
  - first render with assets available → modular;
  - STICKY: after success, transient missing textures do NOT fall back;
  - STICKY released on visual identity change (hull/faction/mod);
  - STICKY cleared on removeVehicle (id reuse does not inherit);
  - STICKY cleared when ENABLE_MODULAR_VEHICLE_RENDER toggled off;
  - direction change within same visual identity does NOT release sticky.
- Faction flow through adapter (4 tests):
  - all 4 factions render as modular when assets available;
  - Arena syncVehicle does NOT silently recolor;
  - placeModularCombat warns once on missing faction;
  - placeModularCombat passes valid non-cyan faction through.
- Package E gating (2 tests):
  - turretCursorFollowEnabled defaults to false;
  - BlockoutVehicleRenderer source gates aim line via
    `debugRenderFlags.aimLine` (not `isDevtoolsActive()`), direction
    arrow via `debugRenderFlags.directionArrow`, mount points and
    debug labels via `debugRenderFlags.*` proxy fields. All flags
    default to `false`. `devtoolsActive=true` alone does NOT enable
    any debug artifact (the blocker regression test).
- Package G invariants (5 tests):
  - no PR #296 drift/mount-slot model introduced;
  - MAX_MODULAR_VEHICLE_SET_PNG is still 32;
  - MODULAR_FRAMES_PER_FAMILY is still 16;
  - HULL_VISUAL_SCALE_MULTIPLIERS.dictator is still 1.09;
  - MODULAR_VEHICLE_BASE_SCALE is still 0.16.

### 2.6 Package H — Documentation

**New file:** `docs/project/VEHICLE_RENDER_UNIFY_01_VH_IMPLEMENTATION_REPORT_2026_06_17.md`
(this file).

**Updated:** `docs/project/CURRENT_NEXT_STEP.md` — points at this PR as
the active implementation, marks it as draft until GPT/Denis review.

---

## 3. Render paths before / after

### 3.1 Before this PR (main @ 2665192)

| # | Path | Surface | Default visual | Faction flow | Debug artifacts |
|---|------|---------|----------------|--------------|-----------------|
| P1 | `GeneratedModularVehicleRenderer` | devtools overlay | Modular PNG | explicit | devtools-only |
| P2 | `BlockoutVehicleRenderer` + `ModularVehicleLiveAdapter.syncVehicle` | Arena devtools | Modular PNG when available; else blockout cube | `BlockoutVehicleState.faction` (required) | **mount-point dot ON, debug labels ON, aim line ON, direction arrow ON** |
| P3 | `EntityRenderer` → `ModularTankRenderer.place` + `ModularVehicleLiveAdapter.placeModularCombat` | Normal runtime | Modular PNG when available; else legacy wasp+smoky | **`entity.faction ?? 'cyan'` silent default at 3 sites** | devtools-only (mostly) |
| P4 | Blockout procedural fallback (P2 fallback) | Arena | turquoise cube | `BlockoutVehicleState.faction` | (inherits P2 debug) |
| P5 | Legacy `generated_hull_*` / `wasp_m0_*` (P3 fallback) | Normal runtime | cyan-tinted wasp + smoky | **silent cyan default** | devtools-only |
| P6 | `ENABLE_MODULAR_VEHICLE_RENDER = false` | Either | P4 or P5 | (inherits) | (inherits) |

**Flicker source:** `syncVehicle()` / `placeModularCombat()` call
`hideVehicle()` when `plan.available === false`, even if the vehicle
was successfully rendered as modular on the previous frame. Direction
changes (which change the texture key) trigger this on every frame the
new direction's texture isn't loaded yet.

### 3.2 After this PR

| # | Path | Surface | Default visual | Faction flow | Debug artifacts |
|---|------|---------|----------------|--------------|-----------------|
| P1 | `GeneratedModularVehicleRenderer` | devtools overlay | Modular PNG | explicit | devtools-only |
| P2 | `BlockoutVehicleRenderer` + `ModularVehicleLiveAdapter.syncVehicle` | Arena devtools | Modular PNG when available; else blockout cube (first render only) | `BlockoutVehicleState.faction` (required) | **all OFF by default; toggleable via devtools** |
| P3 | `EntityRenderer` → `ModularTankRenderer.place` + `ModularVehicleLiveAdapter.placeModularCombat` | Normal runtime | Modular PNG when available; else legacy wasp+smoky (first render only) | **`resolveFactionOrDiagnosticFallback()` — warns on missing, marks fallback** | devtools-only |
| P4 | Blockout procedural fallback (P2 fallback) | Arena | turquoise cube (only when sticky not yet set) | `BlockoutVehicleState.faction` | (inherits P2 debug) |
| P5 | Legacy `generated_hull_*` / `wasp_m0_*` (P3 fallback) | Normal runtime | cyan-tinted wasp + smoky (only when sticky not yet set) | **explicit diagnostic cyan (marked)** | devtools-only |
| P6 | `ENABLE_MODULAR_VEHICLE_RENDER = false` | Either | P4 or P5 | (inherits) | (inherits) |

**No-flicker guarantee:** once a vehicle has been successfully rendered
as modular PNG for its current visual identity (sticky === true),
transient `plan.available === false` states keep the last good modular
sprites visible — no fallback to blockout. Sticky is released on visual
identity change (hull/turret/faction/mod) or vehicle removal.

---

## 4. What remains legacy

The following legacy paths are **retained as emergency fallback** and are
NOT removed in this PR (Stage 3 retirement is a separate future PR,
gated on manual QA acceptance of this PR):

- `BlockoutVehicleRenderer` procedural blockout geometry — drawn only
  when `plan.available !== true` AND sticky is not set (first render
  of a visual identity while assets load).
- `ModularTankRenderer` legacy hull/turret sprite path — drawn only
  when `plan.available !== true` AND sticky is not set.
- `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` /
  `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` per-dir offset tables in
  `src/config/worldConfig.ts` — used only by the legacy
  `ModularTankRenderer` path. Will be removed in Stage 3.
- `pilotVehicleLazyLoad.ts` / `pilotTurretComposition.ts` — legacy
  pilot set loaders, still referenced by fallback paths.
- `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` quarantine flag — still
  `false`, not re-enabled.

---

## 5. Fallback behavior

```text
Frame N: vehicle spawned with visual identity V
  → requestModularVehicleSet(V) queues up to 32 PNG
  → composeModularVehicle(V) checks textures.exists() for all 32 keys
  → if all exist (plan.available === true):
      applyPlan(V) → modular sprites visible
      setSticky(V) → sticky flag set
      return usedModular:true
  → if some missing (plan.available === false) AND sticky not set:
      hideVehicle (clear stale sprites)
      return usedModular:false → caller draws blockout/legacy fallback
      (vehicle visible as turquoise cube or cyan wasp — emergency only)

Frame N+1..M: textures still loading
  → same as Frame N (blockout/legacy fallback remains visible)

Frame M+1: textures arrive (plan.available === true)
  → applyPlan(V) → modular sprites visible
  → setSticky(V) → sticky flag set
  → return usedModular:true → caller suppresses blockout

Frame M+2: direction change (new dir's texture not yet loaded)
  → plan.available === false
  → BUT sticky === true (same visual identity V)
  → DO NOT hideVehicle, DO NOT applyPlan
  → return usedModular:true → caller suppresses blockout
  → last good modular sprites stay visible (briefly wrong direction)
  → debugLabel includes "[sticky: keeping last good modular]"

Frame M+3: new dir's texture arrives
  → plan.available === true
  → applyPlan(V) → modular sprites updated to new direction
  → sticky stays set
```

Fallback is **emergency-only**: it appears only during the initial load
of a visual identity, never during direction changes or transient
texture-missing states for an already-modular vehicle.

---

## 6. Faction behavior

```text
BlockoutVehicleState (Arena):
  faction: Faction (required, type-checked)
  → flows directly to blockoutToModularVisual()
  → factionResolver is defensive only (warns if state corruption
    produces a non-canonical string, but BlockoutVehicleState's type
    prevents this at compile time)

RenderableEntity (normal runtime):
  faction?: Faction (optional)
  → resolveFactionOrDiagnosticFallback(entity.faction, context)
  → if valid: passes through, no warning, no fallback
  → if missing/invalid: warns ONCE per context, returns diagnostic cyan
    (marked via usedFallback === true)
  → the modular visual uses the resolved faction for texture key lookup
```

**No silent cyan recolor.** A non-cyan faction always renders as
non-cyan (when assets are available). A missing faction produces a
visible warning in the console, not a silent recolor.

---

## 7. Debug artifact gating

| Artifact | Before | After |
|----------|--------|-------|
| Red mount-point dot | ON by default (`showMountPoints = true`) | OFF by default; toggle via `toggleMountPoints()` |
| Debug labels above vehicles | ON by default (`showDebugLabels = true`) | OFF by default; toggle via `toggleDebugLabels()` |
| Red dashed aim line (selected vehicle) | ON when `isSelected` | OFF by default; ON only when `isSelected && debugRenderFlags.aimLine` (explicit opt-in; OFF even when Arena/devtools active) |
| Direction arrow on selection ring | ON when `isSelected` | OFF by default; ON only when `debugRenderFlags.directionArrow` (explicit opt-in; OFF even when Arena/devtools active; selection ring itself stays) |
| Turret-to-cursor follow (non-Arena devtools) | ON by default | OFF by default; opt-in via `setTurretCursorFollowEnabled(true)` |
| Mouse-aim fire (non-Arena devtools) | ON by default | OFF by default; gated behind `turretCursorFollowEnabled` |
| Direction-debug overlay | OFF (`directionDebugEnabled = false`) | unchanged (already gated) |
| Calibration overlay | devtools-gated | unchanged |
| Placement overlay | devtools-gated | unchanged |

Default gameplay and default Arena view now show only core UI: selection
ring, hover ring, HP bar, target-lock indicator, enemy team indicator,
move-target marker. All debug artifacts require explicit devtools opt-in.

---

## 8. Placement / composition policy

**No placement math was redesigned in this PR.**

- `composeModularVehicle()` math is unchanged.
- `MODULAR_VEHICLE_BASE_SCALE = 0.16` is unchanged (04A source of truth).
- `HULL_VISUAL_SCALE_MULTIPLIERS = { dictator: 1.09 }` is unchanged
  (Dictator +9% hull-only preserved).
- `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` /
  `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` per-dir offset tables are
  unchanged — still used by the legacy `ModularTankRenderer` fallback
  path. They will be removed in Stage 3 after manual QA accepts this PR.
- No new mount-slot constants, no front/center/rear production offset
  profiles, no direction-dependent forward/back placement, no manual
  Wasp-only or Dictator-only pixel patches.
- No generated metadata edits.

The sticky no-flicker mechanism (Package D) does not change placement
math — it only controls whether the last good modular sprites stay
visible during transient texture-missing states.

---

## 9. What was explicitly NOT changed

- `composeModularVehicle()` math.
- `MODULAR_VEHICLE_BASE_SCALE` value.
- `HULL_VISUAL_SCALE_MULTIPLIERS` value (Dictator +9% hull-only).
- `cameraProjectionContract.ts` (camera basis vectors, projection
  formulas).
- Combat / movement / economy / mapgen / pathfinding / save-load code.
- Collision / hitboxes / footprints / gameplay stats.
- PNG assets (no regeneration, no modification).
- Generated metadata JSON.
- `package.json` / `package-lock.json` (no new dependencies).
- Legacy renderer files (`BlockoutVehicleRenderer.ts`,
  `ModularTankRenderer.ts`) are NOT deleted — only their debug-artifact
  defaults and faction-flow are updated. Stage 3 will retire them.
- `GameScene.ts` orchestration is NOT refactored — Stage 4 will address it.
- No new query-string flags.
- No atlas / WebP work.
- No preload of the full 4352-PNG modular matrix.
- No combined hull×turret sprite matrices.
- No reuse of PR #296 mount-slot / forward-back drift model (verified
  by `vehicleRenderUnify01vh.test.ts` test:
  "source files do not introduce mount-slot or forward/back drift
  constants").

---

## 10. Tests and validation

### 10.1 Test results

```text
npm run typecheck: PASS
npm test:           PASS — 91 files, 4698 tests (was 89 files, 4653 tests on main)
  New tests: +45 (15 in vehicleRenderFactionFlow.test.ts, 30 in vehicleRenderUnify01vh.test.ts)
    - 20 from initial commit (sticky, faction flow, gating, invariants)
    - 10 from fixup commit b551c476 (debugRenderFlags module + blocker regression)
    - (vehicleRenderFactionFlow.test.ts: 15 from initial commit)
npm run build:      BLOCKED — ENOSPC (see §11)
npm run qa:smoke:   BLOCKED — ENOSPC + Playwright browser missing (see §11)
```

### 10.2 Test coverage added

| Test file | Tests | Coverage |
|-----------|-------|----------|
| `vehicleRenderFactionFlow.test.ts` | 15 | factionResolver: canonical factions, warn-once, no silent recolor, diagnostic fallback marked |
| `vehicleRenderUnify01vh.test.ts` | 30 | sticky no-flicker (8), faction flow through adapter (4), turret-to-cursor default OFF even when devtools active (1), Package E fixup: debugRenderFlags module (6) + renderer gates via flags not isDevtoolsActive (4) + devtoolsActive=true alone does NOT enable artifacts (1), Package G invariants (6: no #296 drift, 32-PNG cap, Dictator +9%, scale 0.16) |

### 10.3 Existing tests

All 4653 pre-existing tests continue to pass unchanged. The
`modularRuntime04a.test.ts` parity tests (preview == live scale) still
pass — scale constants are unchanged.

---

## 11. Environment constraints (build / qa:smoke)

### 11.1 `npm run build` — ENOSPC

The build fails with `ENOSPC: no space left on device` during Vite's
`copyDir` step, which copies the 5.3 GB `public/assets/` folder into
`dist/`. This is an environment constraint (10 GB root filesystem, 5.3
GB already consumed by the repo clone + node_modules), NOT a code
defect.

**Verified:** the same `npm run build` fails with the same ENOSPC error
on clean `main` (without this PR's changes). The failure is independent
of this PR.

The TypeScript compilation step (`tsc`) completes successfully before
the Vite build step — so all type errors are caught. The PR introduces
no new type errors.

### 11.2 `npm run qa:smoke` — ENOSPC + Playwright browser missing

`qa_smoke.mjs` first runs `npm run build` (which fails with ENOSPC as
above), then attempts to launch Playwright's Chromium, which is not
installed in this environment (per the 04A report: *"Playwright's
browser binary is not installed in this container"*).

**Verified:** the same `npm run qa:smoke` fails the same way on clean
`main`. The failure is independent of this PR.

### 11.3 What WAS validated

- `npm run typecheck` — PASS (TypeScript strict mode, no errors).
- `npm test` — PASS (4698 tests, including 45 new tests for this PR:
  35 from the initial commit + 10 from the fixup commit `b551c476`
  for the `debugRenderFlags` module and the `devtoolsActive=true does
  NOT enable any debug artifact` regression test).
- `git diff --check` — PASS (no whitespace errors).
- Secret/token scan — PASS (no `ghp_*`, no bot tokens, no chat IDs in
  any changed file).
- No PNG/assets/generated-metadata/package files changed (verified via
  `git status`).
- No new dependencies (verified via `git diff package.json package-lock.json` — empty).

---

## 12. Manual QA checklist for Denis

This checklist is also in the PR body. Denis must complete it before
the PR is marked ready for review.

1. Open standard game mode (`?skipMenu`).
2. Open devtools Arena mode (`?skipMenu&devtools=1&arena=1`).
3. Confirm default view has no:
   - green movement line;
   - red dashed aim line;
   - direction arrow on ring;
   - red mount-point dot on turret;
   - debug text label above vehicles;
   - turret-to-cursor behavior (unless explicit debug/manual mode is on).
4. Spawn/check all factions:
   - cyan;
   - green;
   - yellow;
   - purple.
5. Confirm all factions render via modular PNG when assets exist (no
   silent cyan recolor for green/yellow/purple).
6. Confirm no silent cyan recolor (check console for
   `[factionResolver] Missing or invalid faction` warnings — should be
   none in normal play).
7. Check representative hulls:
   - wasp;
   - hunter;
   - titan;
   - dictator (verify hull is ~9% larger, turret is normal size).
8. Check representative turrets:
   - smoky;
   - ricochet;
   - railgun;
   - thunder.
9. Confirm no flicker back to turquoise/green blockout cube after PNG
   appears (especially during direction changes).
10. Confirm no unit disappears while assets load (sticky keeps last
    good modular visible during direction changes).
11. Confirm visual placement was not redesigned and did not regress
    (hull+turret alignment on the tile looks the same as before for
    each hull/turret/faction/mod combo).
12. Confirm Dictator hull scale looks correct and turret is not scaled
    by +9% (Dictator multiplier is hull-only).
13. Toggle devtools debug overlay (T key or devtools panel) — verify
    mount-point dot, debug labels, aim line, direction arrow reappear
    when explicitly enabled.
14. In non-Arena devtools, call
    `blockoutVehicleInputController.setTurretCursorFollowEnabled(true)`
    from devtools console — verify turret-to-cursor follow is restored
    as explicit opt-in.

---

## 13. Risks and rollback plan

### 13.1 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sticky state keeps wrong-direction frame visible briefly during direction changes | Low | Brief wrong-direction is less jarring than turquoise cube flicker. Sticky is released on visual identity change. |
| `resolveFactionOrDiagnosticFallback` warning is noisy if upstream state corruption produces many missing factions | Low | Warn-once per context limits noise. Warning is the desired behavior (surfaces upstream bugs). |
| Debug-artifact defaults flipped to false may surprise existing devtools users | Low | Existing toggles (`toggleMountPoints`, `toggleDebugLabels`) re-enable them. Devtools workflow is preserved. |
| Turret-to-cursor default off may surprise non-Arena devtools users | Low | `setTurretCursorFollowEnabled(true)` restores legacy behavior. Opt-in is explicit. |
| Build / qa:smoke cannot run in this environment | Medium | Typecheck + tests pass. Build failure is environment-only (verified on clean main). Manual QA on Denis's machine is the final gate. |

### 13.2 Rollback plan

Revert the PR. The changes are:

- 1 new module (`factionResolver.ts`, ~140 lines).
- 4 modified files (`ModularVehicleLiveAdapter.ts`,
  `ModularTankRenderer.ts`, `BlockoutVehicleRenderer.ts`,
  `BlockoutVehicleInputController.ts`).
- 2 new test files (~580 lines total).
- 2 doc files (this report + CURRENT_NEXT_STEP update).

Single-PR revert restores prior behavior, including the silent
`?? 'cyan'` defaults and the debug-artifact defaults of `true`. The
revert is safe because:

- No legacy renderer is deleted (Stage 3 not done).
- No `GameScene` orchestration is refactored (Stage 4 not done).
- No placement math is changed.
- No assets/metadata/generated files are changed.
- No dependencies are added.

---

## 14. GPT / Denis review required

This PR is a DRAFT. It is not ready for review until:

1. GPT reviews the implementation against the
   `VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md` and
   `VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md` (merged in PR #297).
2. Denis completes the manual QA checklist (§12) on his local machine
   (where the build can complete and Playwright is available).
3. Denis confirms visual placement did not regress.
4. Denis confirms no flicker, no silent cyan recolor, no debug
   artifacts in default view.

After GPT/Denis acceptance, Stage 3 (legacy renderer retirement) can
begin as a separate PR.

---

**Status:** DRAFT — awaits GPT/Denis manual review.
**GPT review required before merge.**
