# CURRENT_NEXT_STEP.md

Status: post-PR #300 renderer-unification baseline; docs sync is the current operational step  
Project: Four Elements Phaser  
Updated: 2026-06-18 (post-#300 merge docs sync)

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
    - Arena + normal runtime parity through shared adapter contract;
    - 91 files / 4698 tests passed in PR validation.

#299 DOCS-SYNC-POST-298
  Status: MERGED on 2026-06-17.
  Result: docs updated after #298.

#300 VEHICLE-RENDER-UNIFY-03-VH
  Status: MERGED on 2026-06-17.
  Result: Stage 3 completed and manually QA-accepted by Denis.
  Merge commit: e8295d37acb9a5905bf2f140f1780e5764e0e5af.
  Validation:
    - GitHub Actions: Pages / Graphify / QA Smoke success before merge;
    - npm test in PR report: 91 files / 4643 tests;
    - Denis manual visual QA: passed; modular assets load correctly on-demand.
  Scope completed:
    - legacy pilot Wasp/Smoky preload removed;
    - pilotVehicleLazyLoad deleted;
    - pilotTurretComposition deleted;
    - ModularTankDebugOverlay / offset tuner removed;
    - legacy offset tables and tunerState removed from worldConfig;
    - getWaspHullKey/getSmokyTurretKey removed from production render path;
    - canonical requestModularVehicleSet() now starts Phaser loader on demand;
    - loadArenaVisualAssets() no longer preloads modular vehicle sets;
    - neutral loading placeholder remains explicit first-load fallback;
    - Stage 4 / GameScene orchestration was intentionally NOT touched.
```

Stage 1, Stage 2, and Stage 3 are now merged baseline. Treat them as accepted, not active work.

---

## Active next step (single)

```text
DOCS-SYNC-POST-300
  Risk: Low.
  Type: docs-only.
  Goal: update source-of-truth docs after PR #300 merge.
  Files:
    - docs/project/CURRENT_NEXT_STEP.md
    - docs/project/PROJECT_STATE.md
  No runtime code.
  No tests.
  No assets.
```

After this docs sync merges, the next default work is:

```text
VEHICLE-RENDER-UNIFY-04-VH-AUDIT
  Risk: Low for audit, High for implementation.
  Type: audit/design only first.
  Goal: plan Stage 4 — GameScene render orchestration cleanup.

  Important:
    - Audit only first.
    - No implementation before GPT + Denis accept the audit.
    - Stage 3 is already merged; do not reopen legacy renderer retirement unless a regression is proven.
    - Stage 4 must preserve current visual behavior from #300.
```

---

## Roadmap state

The accepted roadmap is still the source of truth:

```text
docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md
```

Current roadmap status:

```text
Stage 1: DONE / MERGED via #298.
Stage 2: DONE / MERGED via #298; Denis manual QA accepted.
Stage 3: DONE / MERGED via #300; Denis manual QA accepted.
Stage 4: NOT STARTED.
```

---

## Stage 4 target

```text
VEHICLE-RENDER-UNIFY-04-VH — GameScene render orchestration cleanup
Risk: High for implementation.
```

Expected direction from roadmap:

```text
- extract render orchestration from GameScene into RenderManager or equivalent;
- keep GameScene focused on scene lifecycle and top-level update dispatch;
- preserve current #300 visual behavior;
- keep canonical ModularVehicleLiveAdapter path;
- do not restore legacy Wasp/Smoky preload or offset-tuner paths;
- keep emergency/loading fallback policy explicit;
- keep Stage 2/3 manual QA checks passing;
- target GameScene line count reduction after cleanup.
```

Audit must answer:

```text
- exact current GameScene render responsibilities;
- proposed RenderManager boundary;
- lifecycle order: create / update / sync / shutdown;
- how Arena/devtools and standard runtime stay aligned;
- what stays in GameScene;
- exact touched files;
- tests needed;
- rollback plan;
- manual QA plan.
```

---

## Required validation for future Stage 4 work

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

Manual QA after implementation:

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
- placement unchanged.
```

---

## Still in force (rules)

```text
- Do not continue PR #263 / Wasp+Smoky offset recovery by inertia.
- Do not continue PR #274/#275 failed generated turret composition path.
- Do not re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
- Do not restore pilotVehicleLazyLoad or old Wasp M0 preload.
- Do not preload the full modular matrix.
- Do not use a combined hull×turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
- Do not blindly reuse PR #296 mount-slot / forward-back drift model.
- Do not touch composeModularVehicle() placement/math without explicit Denis approval.
- Do not touch combat, movement, economy, pathfinding, save-load, bot/AI,
  or mapgen as part of the render unification roadmap.
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
