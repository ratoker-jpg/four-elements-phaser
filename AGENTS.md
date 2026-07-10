# AGENTS.md — Four Elements Phaser

Status: active root agent instructions  
Updated: 2026-07-10

---

## Project identity

```text
repo: ratoker-jpg/four-elements-phaser
engine: Phaser 4.1.0
language: TypeScript
build: Vite
renderer: Phaser-first / WebGL-only
camera: fixed isometric / axonometric 2.5D
```

The old repository `ratoker-jpg/four-elements-next` is donor/reference/specification only. Do not copy old runtime implementation by inertia.

---

## Current operating mode

<!-- PROJECT_STATUS:START -->
Updated: 2026-07-10

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 3: T1 factory composer
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #342 — Normal Game targeting, firing and damage runtime
Next: Implement a config-driven T1 factory composer that independently selects Wasp or Hunter and Smoky or Railgun, calculates additive cost and production time, previews the modular tank and queues a structured production request.
Gate: All four legal T1 hull/turret combinations must be produced through structured requests, preserve separate hull and turret fields, render correctly and remain backward-compatible with Builder, Harvester and legacy Wasp + Smoky queue items.
```
<!-- PROJECT_STATUS:END -->

The status block above is generated from `docs/project/project-status.json`. Do not edit it manually.

---

## Active source-of-truth documents

Read these first:

```text
AGENTS.md
docs/project/project-status.json
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/PLAYABLE_FOUR_FACTION_SKIRMISH_ROADMAP_2026_07_10.md
docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md
docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

`PLAYABLE_FOUR_FACTION_SKIRMISH_ROADMAP_2026_07_10.md` is the active implementation queue. The older RTS Foundation roadmap remains an architectural prerequisite/reference, not the current phase queue.

Workflow and agent rules:

```text
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

Closed/old roadmap documents are references only, not active queues.

---
