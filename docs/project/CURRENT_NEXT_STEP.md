# CURRENT_NEXT_STEP.md

Status: Modular Runtime 03 roadmap / audit gate is the next default work  
Project: Four Elements Phaser  
Updated: 2026-06-15

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Current answer

```text
ASSET-IMPORT-01 (PR #278) is merged: modular cyan assets entered the repo.
MODULAR-RUNTIME-01 (PR #279) is merged: clean modular cyan vehicle runtime works.
ASSET-FIX-02A (PR #280) is merged: first Wasp m0 asset fix attempt.
LEGACY-WASP-CLEANUP-01B (PR #281) is merged: legacy Wasp hooks are marked and modular isolation tests exist.
WASP-M0-ASSET-FIX-02C (PR #284) is merged: Wasp cyan m0 target PNGs regenerated.
MODULAR-RUNTIME-02A (PR #285) is merged: modular hull texture keys use `modular_hull_*` namespace.
ASSET-IMPORT-02A (PR #286) is merged: all-factions modular PNG assets are in the repo.
MODULAR-ALL-FACTIONS-01B (PR #287) is merged: all-factions runtime/devtools + Dictator 1.09 visual scale.
MODULAR-ALL-FACTIONS-01C (PR #288) is merged: preview calibration controls and tile overlay.

OPUS-AUDIT-RUNTIME-03 (PR #290) is merged: modular full game integration audit/design.
MODULAR-RUNTIME-03A (PR #292) is merged: calibration-free live modular vehicle adapter for Arena demo.
MODULAR-RUNTIME-03B (PR #293): route normal runtime vehicles through modular adapter.

Next default work:
1. QA acceptance of 03B normal runtime modular rendering (manual QA).
2. MODULAR-RUNTIME-03C: optional cleanup of legacy Wasp/Smoky/proof harness after QA acceptance.
```

Still in force:

```text
- Do not continue PR #263 / Wasp+Smoky offset recovery by inertia.
- Do not continue PR #274/#275 failed generated turret composition path.
- Do not re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
- Do not preload the full modular matrix.
- Do not use a combined hull×turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
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
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
docs/project/MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_ROADMAP_2026_06_15.md
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

---

## Current priority

```text
Simplify the next phase:
roadmap doc-only PR -> one broad Opus audit/design -> High/High+ GLM implementation.
```

Reason:

```text
The previous tactical work fixed assets, key collisions, all-factions preview, Dictator scale and preview calibration.
The next request is larger: add modular hulls/turrets to all relevant game modes.
That needs one cohesive audit/design, not another chain of tiny speculative tasks.
```

---

## Required next sequence

### 1. ROADMAP-03-DOCS

Docs only.

```text
- Add MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_ROADMAP_2026_06_15.md.
- Keep runtime/assets untouched.
- Make this file point to the new roadmap.
```

### 2. OPUS-MODULAR-RUNTIME-03-AUDIT

Use the roadmap and graph/repo context.

Expected output:

```text
docs/project/MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_AUDIT_2026_06_15.md
```

The audit must cover:

```text
- the exact three target modes/surfaces;
- front/center/rear mount slot model;
- body/weapon/faction/mod mapping;
- controlled Arena demo unit strategy;
- normal Arena/runtime integration strategy;
- fallback and lazy loading;
- tests and QA gates.
```

### 3. High/High+ implementation

GPT routes after accepted audit:

```text
GLM -> bounded High/High+ implementation from accepted audit
Opus -> only if audit classifies implementation above High+
Codex -> local asset/file facts only when GitHub cannot see them
```

---

## Do not start by default

```text
- do not ask GLM to implement full live runtime before Opus audit;
- do not split the next phase into many tiny process-only tasks unless audit identifies real risk boundaries;
- do not use combined hull x turret production matrix;
- do not preload all modular assets;
- do not add new query-string visual modes;
- do not hardcode per-hull/per-dir pixel offsets without audit;
- do not turn preview calibration values into production metadata/config without design;
- do not touch combat, movement, economy, pathfinding, save-load, bot/AI, or mapgen as part of roadmap/audit.
```

---

## Validation baseline for future implementation PRs

Use when implementation starts:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

If a command cannot run, report why. Do not claim validation passed if it did not run.
