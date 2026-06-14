# OPUS_ARCHITECT_AUDIT_RULES.md

Status: active Opus rules  
Audience: Opus / strong architecture auditor  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

Opus is used when system understanding matters more than mechanical patching.

Opus should produce durable audits and architecture plans that can guide many implementation steps.

Opus must not waste premium model budget on mechanical inventory that cheaper models, Graphify, grep, scripts, or narrow range reads can do.

---

## Primary role

Use Opus for:

```text
- broad architecture audits;
- final architecture synthesis from prepared facts inventory;
- cleanup plans across stale docs/source/assets;
- modular vehicle runtime integration design;
- identifying legacy systems that must be archived/deprecated;
- High+ cohesive implementation tasks when splitting would make the work worse;
- review of risky PRs from GLM or other agents.
```

Opus is not the default PR plumber.

Opus is also not the default file reader / grep worker.

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
docs/project/AI_AUDIT_BUDGET_RULES.md
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
```

For visual/world-space/rendering/asset work, also read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

For modular vehicle work, also read the active modular vehicle roadmap and accepted modular vehicle system audit after they exist.

---

## Graph-first requirement

If a fresh Graphify artifact is available, use it before broad source reading.

Read or parse the available graph output, for example:

```text
graphify-out/GRAPH_REPORT.md
graphify-out/graph.json
graphify-out/analysis.json
graphify-out/*callflow*.html
```

Not every artifact contains every file. Use what exists.

Do not paste `graph.json` into the model context. Parse it with scripts or CLI and return only compact summaries.

Then query or inspect graph output to narrow the source files to open.

Do not start by reading dozens of repo files one-by-one when graph context is available.

---

## Budget discipline for audits

For broad audits, Opus must operate as architect / synthesizer, not as the only worker doing every grep and file read.

Preferred flow:

```text
Phase A — facts inventory
- use Graphify summaries, grep/ripgrep, scripts, and cheap subagents if available;
- collect file:line facts only;
- no architecture recommendations;
- no full reading of large files;
- compact output.

Phase B — Opus synthesis
- use the facts inventory, context digest, and selected file ranges;
- produce architecture recommendation, cleanup order, implementation plan, validation, non-goals.
```

If the environment supports subagent model selection:

```text
- use Haiku/Sonnet or equivalent cheaper models for search, grep, inventory, file:line extraction;
- reserve Opus for final synthesis, hard tradeoffs, and cohesive High+ refactors.
```

If the environment does not support cheaper subagents:

```text
- avoid Opus subagents for mechanical inventory;
- do the inventory with grep/ranges/scripts;
- ask GPT/Denis for a smaller facts inventory first if needed.
```

Hard budget rules:

```text
- do not read files over 400 lines fully unless explicitly justified;
- for files over 400 lines, use grep/ripgrep first, then read only relevant ranges;
- do not read large JSON/graphs into context; parse them and summarize;
- do not ask subagents to return long prose;
- subagent inventory output target: <=120 lines each;
- subagent tool-call target: <=25 calls each;
- if expected work exceeds roughly 200k tokens, stop and propose a two-phase plan first;
- avoid arbitrary "1000+ lines" audit targets unless Denis/GPT explicitly asks for that cost.
```

Large-file rule:

```text
Use:
rg -> line ranges -> narrow reads -> file:line facts.

Avoid:
read full BlockoutVehicleRenderer.ts / GameScene.ts / large UI files / many governance docs into Opus context.
```

---

## Audit output quality bar

A useful Opus audit should be concrete enough to guide implementation without re-auditing each step.

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

Target: one broad reusable audit when the direction is large, but no artificial line-count target.

Prefer:

```text
clear file:line evidence + compact recommendations
```

over:

```text
long prose without evidence
```

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

Even for implementation, Opus should not spend budget on broad file reading after an accepted audit exists. Use the accepted audit and targeted ranges.

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
- treat closed roadmaps as active implementation queues;
- run premium-model subagents for routine search/inventory when cheaper routing is available.
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
