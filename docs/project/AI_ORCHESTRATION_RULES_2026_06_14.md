# AI_ORCHESTRATION_RULES_2026_06_14.md

Status: active orchestration contract  
Audience: GPT Project Lead / GLM / Opus / Codex  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

This document defines how AI tools are assigned work in this repository.

The goal is to stop tool drift, repeated audits, stale instructions, local-first context building, and accidental architecture changes.

---

## Core operating model

```text
roadmap -> one broad Opus audit when needed -> High/High+ implementation steps -> PR review -> docs update
```

Do not run one fresh audit for every small task.

Good pattern:

```text
1 roadmap with many steps
1 broad system audit / architecture audit, usually Opus, committed to repo
many implementation steps executed from that accepted audit
```

Bad pattern:

```text
1 small task -> 1 new audit -> 1 small task -> 1 new audit -> stale docs everywhere
```

---

## Tool roles

## GPT Project Lead

GPT is the project lead / coordinator.

GPT decides:

```text
- which tool gets a task;
- whether a task deserves Opus limits;
- whether a GLM High/High+ step is safe;
- whether Codex is needed for read-only local inspection;
- whether GPT can execute a local prompt/script task itself from available files;
- whether docs are stale and must be updated before code;
- whether a PR is ready for Denis to merge.
```

GPT must read current GPT instructions before giving project direction:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
```

For visual/world-space/asset/rendering work, GPT must also read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

GPT must not let agents continue old docs by inertia.

---

## GLM

GLM is a strong executor for High / High+ steps when the step has a clear accepted audit or roadmap.

Use GLM for:

```text
- implementation PRs after accepted audit;
- docs-only PRs with exact files/scope;
- validation and PR delivery;
- mechanical refactors where boundaries are clear;
- High/High+ scoped steps with strict non-goals.
```

Do not use GLM as the default planner for new architecture direction.

GLM must not:

```text
- invent roadmap;
- run broad audits unless explicitly assigned;
- start code without accepted audit/roadmap;
- touch unrelated systems;
- merge PRs;
- add new URL-mode test surfaces by inertia;
- preload broad asset sets without explicit accepted plan.
```

GLM should read its own rules:

```text
docs/project/GLM_EXECUTOR_RULES.md
```

---

## Opus

Opus is the preferred system architect / deep auditor.

Use Opus for:

```text
- broad architecture cleanup audits;
- full-system reasoning over stale docs, legacy assets, old formulas, and runtime dependencies;
- High+ or above cohesive work that should not be split artificially;
- complex refactors where correctness depends on understanding many interacting systems;
- review of risky GLM implementation PRs;
- turning Graphify output into a durable integration plan.
```

Opus should usually receive:

```text
- current roadmap;
- Graphify artifact;
- current source-of-truth docs;
- exact non-goals;
- expected committed audit document path.
```

Opus may implement only when GPT/Denis explicitly decide that the task is too cohesive/complex to split safely for GLM.

Opus should not be burned on:

```text
- routine docs edits;
- small mechanical changes;
- PR plumbing;
- tasks GLM can execute from an accepted audit.
```

---

## Browser GPT executor

A browser GPT can help write docs, scripts, prompts, and local tooling instructions, but it cannot see Denis's local filesystem unless files are uploaded.

Use browser GPT for:

```text
- prompt writing;
- docs drafting;
- GitHub docs-only changes when connected tooling is available;
- local script generation from provided reports/files;
- summarizing Codex read-only local audit outputs.
```

Do not pretend browser GPT can inspect local folders it cannot access.

---

## Codex

Codex is local read-only auditor for Denis's computer-side files.

Use Codex for:

```text
- local asset inventory;
- Blender/export folder inspection;
- local file tree/report generation;
- read-only diagnostics of files that are not in GitHub;
- showing GPT enough facts for GPT to write local scripts/prompts.
```

Default rule:

```text
Codex is read-only.
```

Codex must not by default:

```text
- implement tasks;
- edit files;
- run destructive commands;
- run broad tests;
- commit or open PRs;
- replace GLM/Opus as project executor.
```

Exceptions require explicit Denis/GPT approval.

---

## GitHub-first rule

Repository work should happen in GitHub.

Denis should not need to repeatedly download repo/PRs locally for standard context building or validation.

Use GitHub Actions/artifacts for:

```text
- Graphify graph generation;
- standard validation when possible;
- PR review preparation;
- artifact sharing with Opus/GLM/GPT.
```

Local machine work is for Blender, heavy asset exports, and local-only asset inspection.

---

## Graph-first rule

For broad repo reasoning:

```text
Use Graphify before broad file scanning.
```

Graphify does not replace reading current source-of-truth docs. It narrows what source files should be opened.

---

## Audit discipline

Do not create audits for audit theater.

Use audits when:

```text
- direction is new;
- architecture is stale or contradictory;
- cleanup affects multiple systems;
- runtime/code/assets integration has real risk;
- a High/High+ step needs safe boundaries.
```

Prefer one large durable audit over many disposable micro-audits.

---

## No URL flag sprawl

Do not add new query-string modes for every visual test.

Bad:

```text
?modularVehicles=1
?cyanTurrets=1
?assetDebug=1
?newTestMode=1
```

Preferred:

```text
- existing Arena mode;
- ArenaMenu;
- Arena debug panel;
- existing Debug / Отладка UX;
- explicit UI controls inside existing surfaces.
```

Query flags can exist for automation/smoke shortcuts only. They are not final manual acceptance UX.

---

## Documentation cleanup rule

Active docs must be few and explicit.

Stale docs must be:

```text
- marked closed/historical;
- moved to archive when no longer used;
- removed from required reading lists;
- not used as implementation queues.
```

Docs containing obsolete approval phrases such as `Жду Делай` must not be active instructions.

---

## Non-negotiables

```text
- no code without accepted roadmap/audit for the direction;
- no broad local-first workflow;
- no combined hull x turret production matrix for modular vehicle assets;
- no all-asset startup preload;
- no camera projection changes without CAMERA_PROJECTION_CONTRACT.md update and approval;
- no combat/movement/economy/mapgen/save-load edits during asset-runtime cleanup unless explicitly scoped.
```
