# CURRENT_NEXT_STEP.md

Status: Graphify + AI governance + modular vehicle roadmap is the next default work  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Current answer

```text
ASSET-IMPORT-01 (PR #278) is merged: modular cyan assets are now in the repo.
MODULAR-RUNTIME-01 is the active implementation step.

Still in force:
- Do not continue PR #263 / Wasp+Smoky offset recovery by inertia.
- Do not continue PR #274/#275 failed generated turret composition path.
- Do not re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
- Do not preload the full modular matrix.
- Do not use a combined hull×turret production matrix.
- Do not add new query-string visual test modes.

Active step (MODULAR-RUNTIME-01):
- clean modular generated vehicle renderer path (GeneratedModularVehicleRenderer);
- typed ModularVehicleVisual with independent hull/turret + hullMod/turretMod;
- metadata-driven composition from the export socket/pivot manifests;
- lazy loading capped at 32 PNG per selected visual;
- Arena/devtools selector for hull/turret/hullMod/turretMod (cyan);
- safe fallback to blockout when assets/metadata are unavailable.
```

The "do not copy modular_cyan_v1 assets yet" / "do not start runtime implementation
yet" lines below predate PR #278 and are superseded for the asset import and the
MODULAR-RUNTIME-01 runtime step. The rest of the guardrails still apply.

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
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

## Current known asset staging fact

Local staging exists outside this repo:

```text
D:\Desktop\Модели\game_asset_staging\modular_cyan_v1\
```

Known summary:

```text
448 hull PNG
640 turret PNG
1088 runtime PNG total
warnings 0
hulls and turrets are separate
metadata/manifest/generated TS draft exist
```

This does not mean the assets should be imported immediately.

---

## Current priority

```text
Cleanup and integration plan before asset import.
```

Reasons:

```text
- repo has stale docs and old active-looking instructions;
- legacy asset paths/formulas can conflict with modular runtime;
- current generated hull pathing may not match staging pathing;
- manual Wasp/socket offset fixes are not the desired production source;
- importing 1088 PNG before loader/render proof would make cleanup harder;
- new debug URL flags would repeat past process drift.
```

---

## Required next sequence

### 1. GRAPHIFY-00

Docs/tooling only.

```text
- GitHub Actions Graphify workflow;
- Graphify workflow doc;
- AI orchestration rules;
- GPT/GLM/Opus/Codex role docs;
- modular vehicle runtime roadmap.
```

### 2. OPUS-AUDIT-00

Use Graphify artifact + roadmap.

Expected output:

```text
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md
```

The audit should cover cleanup and implementation strategy, not just a single step.

### 3. High/High+ implementation

GPT routes each step:

```text
GLM -> bounded High/High+ implementation after accepted audit
Opus -> above High+ or cohesive/refactor-heavy implementation
Codex -> read-only local audit only
```

---

## Do not start by default

```text
- do not merge PR #263;
- do not build new work on PR #263;
- do not keep adding offset/origin/math fixups;
- do not copy modular_cyan_v1 assets yet;
- do not import all 1088 PNG as first step;
- do not preload all modular assets;
- do not use combined hull x turret production matrix;
- do not add new query-string visual test modes;
- do not ask Denis to locally download/test repo for standard repo context;
- do not turn Codex into implementation executor;
- do not touch combat, movement, economy, pathfinding, save-load, bot/AI, or mapgen as part of docs/tooling/asset-runtime planning.
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
