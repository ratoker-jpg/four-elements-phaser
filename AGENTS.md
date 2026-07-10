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
PLAYABLE FOUR-FACTION SKIRMISH — Phase 2: Production combat runtime in Normal Game
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #339 — Bounded combat destruction lifecycle
Next: Extend canonical GameState.combatUnits so factory-produced tanks can move, stop, acquire targets, attack, take damage and die in Normal Game using shared pure Arena combat systems.
Gate: Do not create a third combat-unit runtime or copy BlockoutVehicleState wholesale. Normal Game combatUnits remain canonical; Arena movement, aiming, range, hit and damage logic must be extracted or adapted as shared pure systems.
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
