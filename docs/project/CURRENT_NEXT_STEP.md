# CURRENT_NEXT_STEP.md

Status: post-PR #298 renderer-unification baseline; docs sync is the current operational step  
Project: Four Elements Phaser  
Updated: 2026-06-17 (post-merge docs sync)

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

Manual QA:
  Denis confirmed visual QA passed before merge.
```

Stage 1 and Stage 2 are no longer active work. Treat them as merged baseline.

---

## Active next step (single)

```text
DOCS-SYNC-POST-298
  Risk: Low.
  Type: docs-only.
  Goal: update source-of-truth docs after PR #298 merge.
  Files:
    - docs/project/CURRENT_NEXT_STEP.md
    - docs/project/PROJECT_STATE.md
  No runtime code.
  No tests.
  No assets.
```

After this docs sync merges, the next default work is:

```text
VEHICLE-RENDER-UNIFY-03-04-VH-AUDIT
  Risk: Low for audit, Very High+ for possible implementation.
  Type: audit/design only first.
  Goal: evaluate whether Stage 3 + Stage 4 can be safely combined into one
        larger GLM 5.2 implementation PR.

  Candidate combined scope:
    - Stage 3: legacy renderer retirement;
    - Stage 4: GameScene render orchestration cleanup.

  Important:
    - Audit only first.
    - No implementation before GPT + Denis accept the audit.
    - The audit must explicitly decide whether combined implementation is
      safe enough, or whether Stage 3 and Stage 4 must stay separate.
```

---

## Why the next implementation may be combined

Denis proposed testing GLM 5.2 on a larger step:

```text
Stage 3 is High.
Stage 4 is High.
A combined Stage 3 + Stage 4 implementation would be Very High+.
```

This is acceptable as an experiment only under strict gates:

```text
1. Audit-first, no code.
2. Exact touched files and imports before implementation.
3. Explicit rollback plan.
4. No placement/composition/math changes.
5. No new render path.
6. No combat/movement/economy/mapgen/pathfinding/save-load changes.
7. Manual QA after implementation.
8. GPT review before merge.
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
Stage 3: NOT STARTED.
Stage 4: NOT STARTED.
```

---

## Stage 3 target, if accepted

```text
VEHICLE-RENDER-UNIFY-03 — Legacy renderer retirement
Risk: High.
```

Expected direction from roadmap:

```text
- retire ModularTankRenderer as production path;
- move or quarantine legacy renderer code;
- remove per-dir legacy offset tables from production config;
- remove legacy Wasp/Smoky helpers if no longer referenced;
- remove/quarantine pilotTurretComposition path;
- keep emergency/loading fallback policy explicit;
- add grep/contract tests so production cannot silently import legacy paths.
```

---

## Stage 4 target, if accepted

```text
VEHICLE-RENDER-UNIFY-04 — GameScene render orchestration cleanup
Risk: High.
```

Expected direction from roadmap:

```text
- extract render orchestration from GameScene into RenderManager;
- keep GameScene focused on scene lifecycle and top-level update dispatch;
- keep visual behavior unchanged;
- keep Stage 2 manual QA checks passing;
- target GameScene line count reduction after cleanup.
```

---

## Required validation for future Stage 3/4 work

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
- no flicker back to blockout/cubes;
- representative hulls: wasp, hunter, titan, dictator;
- representative turrets: smoky, ricochet, railgun, thunder;
- Dictator +9% hull remains correct; turret is not scaled by +9%.
```

---

## Still in force (rules)

```text
- Do not continue PR #263 / Wasp+Smoky offset recovery by inertia.
- Do not continue PR #274/#275 failed generated turret composition path.
- Do not re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
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
