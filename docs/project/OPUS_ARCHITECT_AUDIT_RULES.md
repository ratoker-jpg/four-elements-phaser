# OPUS_ARCHITECT_AUDIT_RULES.md

Status: active Opus rules  
Audience: Opus / strong architecture auditor  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

Opus is used when system understanding matters more than mechanical patching.

Opus should produce durable audits and architecture plans that can guide many implementation steps.

---

## Primary role

Use Opus for:

```text
- broad architecture audits;
- cleanup plans across stale docs/source/assets;
- modular vehicle runtime integration design;
- identifying legacy systems that must be archived/deprecated;
- High+ cohesive implementation tasks when splitting would make the work worse;
- review of risky PRs from GLM or other agents.
```

Opus is not the default PR plumber.

---

## Required reading

For broad project work, read:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
```

For visual/world-space/rendering/asset work, also read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

For modular vehicle work, also read the active modular vehicle roadmap after it exists.

---

## Graph-first requirement

If a fresh Graphify artifact is available, use it before broad source reading.

Read:

```text
graphify-out/GRAPH_REPORT.md
```

Then query or inspect graph output to narrow the source files to open.

Do not start by reading dozens of repo files one-by-one when graph context is available.

---

## Audit output quality bar

A useful Opus audit should be long enough and concrete enough to guide implementation without re-auditing each step.

Expected output:

```text
- system map;
- active vs legacy inventory;
- exact stale docs/code/assets to archive/deprecate;
- dependency graph / affected files;
- recommended implementation steps;
- which steps are GLM-safe High/High+;
- which steps should remain Opus because they are too cohesive/complex;
- validation plan;
- manual QA plan;
- rollback plan;
- non-goals;
- open questions.
```

Target: one broad reusable audit, often 1000+ lines when the direction is large.

---

## Implementation permission

Default Opus mode is audit/design.

Opus may implement only when GPT/Denis explicitly say the task should be implemented by Opus.

Opus implementation is appropriate when:

```text
- the task is above High+;
- it is a coherent refactor that should not be split artificially;
- many dependencies must be updated consistently;
- GLM would likely make local patches without understanding the whole system;
- validation boundaries are still explicit.
```

---

## Strict non-goals

Unless explicitly scoped, Opus must not:

```text
- change combat/movement/economy/mapgen/save-load while doing asset runtime cleanup;
- add new URL query modes for tests;
- commit heavy assets before the loader/render path is accepted;
- use combined hull x turret production matrix;
- preload all modular assets at startup;
- change camera projection rules;
- merge PRs;
- treat closed roadmaps as active implementation queues.
```

---

## Modular vehicle context

Accepted direction:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot metadata
```

Rejected direction:

```text
combined hull x turret production matrix
```

Reason:

```text
combined matrix explodes with independent hull/turret mods and factions.
```

Opus should design cleanup/integration around the modular runtime path.
