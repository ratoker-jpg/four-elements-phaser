# CURRENT_NEXT_STEP.md

Status: post-PR #302 renderer-unification baseline; docs sync is the current operational step  
Project: Four Elements Phaser  
Updated: 2026-06-18 (post-#302 merge docs sync)

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Current baseline

```text
#297 VEHICLE-RENDER-UNIFY-AUDIT
  Status: MERGED on 2026-06-16.
  Result: accepted 4-stage vehicle render unification roadmap.

#298 VEHICLE-RENDER-UNIFY-01-VH
  Status: MERGED on 2026-06-17.
  Result: Stage 1 + Stage 2 completed and manually QA-accepted by Denis.
  Scope completed:
    - canonical faction resolver;
    - no silent cyan fallback in live render path;
    - sticky no-flicker behavior after modular success;
    - debug render artifacts OFF by default;
    - turret-to-cursor default OFF unless explicitly enabled;
    - Arena + normal runtime parity through shared adapter contract.

#299 DOCS-SYNC-POST-298
  Status: MERGED on 2026-06-17.
  Result: docs updated after #298.

#300 VEHICLE-RENDER-UNIFY-03-VH
  Status: MERGED on 2026-06-17.
  Result: Stage 3 completed and manually QA-accepted by Denis.
  Merge commit: e8295d37acb9a5905bf2f140f1780e5764e0e5af.
  Scope completed:
    - legacy pilot Wasp/Smoky preload removed;
    - pilotVehicleLazyLoad deleted;
    - pilotTurretComposition deleted;
    - ModularTankDebugOverlay / offset tuner removed;
    - legacy offset tables and tunerState removed from worldConfig;
    - getWaspHullKey/getSmokyTurretKey removed from production render path;
    - canonical requestModularVehicleSet() now starts Phaser loader on demand;
    - loadArenaVisualAssets() no longer preloads modular vehicle sets;
    - neutral loading placeholder remains explicit first-load fallback.

#301 DOCS-SYNC-POST-300
  Status: MERGED on 2026-06-18.
  Result: docs updated after #300.

#302 VEHICLE-RENDER-UNIFY-04-VH
  Status: MERGED on 2026-06-18.
  Result: Stage 4 completed and manually QA-accepted by Denis.
  Merge commit: e55d731485e18cea7e5cdcd48f695fba8afdfe81.
  Validation before merge:
    - GitHub Actions: Pages / Graphify / QA Smoke success;
    - npm test in PR report: 92 files / 4683 tests;
    - Denis manual visual QA: passed.
  Scope completed:
    - RenderManager added;
    - GameScene no longer directly owns most renderer fields;
    - renderer construction moved to RenderManager;
    - phased renderer sync moved to RenderManager;
    - visual bridge callbacks route through RenderManager;
    - renderer destroy order preserves original GameScene shutdown order;
    - gameplay, placement, economy, pathfinding, save-load, mapgen were not part of Stage 4.
```

Stage 1, Stage 2, Stage 3, and Stage 4 are now merged baseline. Treat the vehicle render unification roadmap as accepted/closed, not active work.

---

## Active next step (single)

```text
DOCS-SYNC-POST-302
  Risk: Low.
  Type: docs-only.
  Goal: update source-of-truth docs after PR #302 merge.
  Files:
    - docs/project/CURRENT_NEXT_STEP.md
    - docs/project/PROJECT_STATE.md
  No runtime code.
  No tests.
  No assets.
```

After this docs sync merges, there is no automatic Stage 5.

Next work must be selected explicitly by Denis. Good candidates:

```text
1. Post-render baseline hardening / visual regression checklist.
2. Next gameplay/product roadmap audit.
3. Next asset pipeline/runtime task.
4. New feature direction chosen by Denis.
```

Do not continue renderer unification by inertia.

---

## Roadmap state

Accepted roadmap references:

```text
docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md
```

Current roadmap status:

```text
Stage 1: DONE / MERGED via #298.
Stage 2: DONE / MERGED via #298; Denis manual QA accepted.
Stage 3: DONE / MERGED via #300; Denis manual QA accepted.
Stage 4: DONE / MERGED via #302; Denis manual QA accepted.
Renderer unification roadmap: CLOSED after post-#302 docs sync.
```

---

## Current renderer baseline

```text
- Modular PNG is the default live vehicle render path when assets are available.
- Valid factions cyan/green/yellow/purple pass through the canonical faction resolver.
- Missing/invalid faction fallback is diagnostic, not silent cyan recolor.
- Debug artifacts are OFF by default.
- No old Wasp M0 forced default/preloaded visual.
- pilotVehicleLazyLoad is deleted.
- pilotTurretComposition is deleted.
- ModularTankDebugOverlay / offset tuner is deleted.
- loadArenaVisualAssets() does not preload modular vehicle sets.
- requestModularVehicleSet() owns on-demand Phaser loader start.
- Neutral loading placeholder remains the explicit first-load fallback.
- RenderManager owns renderer construction, phased sync, visual bridges, and destroy.
- GameScene keeps scene lifecycle, gameplay state, UI/menu callbacks, input, camera, placement, save/load.
```

---

## Required validation for future render-adjacent work

Minimum:

```text
npm run typecheck
npm test
npm run build
npm run qa:smoke
git diff --check
secret/token scan
```

If build/Playwright is blocked in GLM environment, report it honestly and check GitHub Actions directly.

Manual QA for render-adjacent implementation:

```text
- standard game mode;
- devtools Arena mode;
- no default debug artifacts;
- all 4 factions render correctly;
- no silent cyan recolor;
- no old Wasp M0 forced as default visual;
- no persistent blockout cubes after loading settles;
- no missing turret when generated turret asset exists;
- no flicker back to blockout/cubes;
- representative hulls: wasp, hunter, titan, dictator;
- representative turrets: smoky, ricochet, railgun, thunder;
- Dictator +9% hull remains correct; turret is not scaled by +9%;
- z-depth unchanged around buildings/resources;
- placement unchanged;
- devtools panels still open/work;
- asset preview still works;
- pause/menu flow still works;
- scene restart/shutdown does not leak or crash.
```

---

## Still in force (rules)

```text
- Do not continue PR #263 / Wasp+Smoky offset recovery by inertia.
- Do not continue PR #274/#275 failed generated turret composition path.
- Do not re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
- Do not restore pilotVehicleLazyLoad or old Wasp M0 preload.
- Do not restore pilotTurretComposition.
- Do not restore ModularTankDebugOverlay / offset tuner.
- Do not preload the full modular matrix.
- Do not use a combined hull×turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
- Do not blindly reuse PR #296 mount-slot / forward-back drift model.
- Do not touch composeModularVehicle() placement/math without explicit Denis approval.
- Do not touch combat, movement, economy, pathfinding, save-load, bot/AI,
  or mapgen as part of render cleanup work.
- Do not rewrite RenderManager/GameScene lifecycle again without a concrete bug or accepted audit.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFY_03_VH_IMPLEMENTATION_REPORT_2026_06_17.md
docs/project/VEHICLE_RENDER_UNIFY_04_VH_IMPLEMENTATION_REPORT_2026_06_18.md
```

Agent-specific:

```text
GPT:   docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
GLM:   docs/project/GLM_EXECUTOR_RULES.md
Opus:  docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
Codex: docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

For visual/world-space/rendering/asset tasks:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```
