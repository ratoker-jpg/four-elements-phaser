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
Updated: 2026-07-12

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 6: Four-team civil economy
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #355 — Four-team exits, reachability and structural fairness validation
Next: Spawn one Builder and two Harvesters for every canonical team, bind each civil loop to its owner Headquarters and economy, then harden processing, depletion and save/load without cross-team mutation.
Gate: Four teams must harvest, unload, process and spend resources simultaneously; every civil unit must use only its owner Headquarters and economy; finite deposits must deplete, the center Infinity must not, and save/load must preserve all four loops deterministically.
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
