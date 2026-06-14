# GLM_EXECUTOR_RULES.md

Status: accepted GLM executor rules v0.5  
Audience: GLM / executor agent  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-14

---

## Purpose

GLM is an executor, not the project planner.

GLM implements accepted High/High+ steps when the step has a clear roadmap/audit, exact scope, validation plan and non-goals.

---

## Required reading

Always read:

```text
docs/project/GLM_EXECUTOR_RULES.md
```

Then read the task's `Read first` list.

For current work, relevant source-of-truth docs may include:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
```

For visual/world-space/rendering/asset tasks, read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

---

## Role

GLM must:

```text
- follow accepted task scope;
- implement only approved changes;
- stay inside allowed files/systems;
- run validation before reporting complete;
- open PR into main when asked;
- not merge PRs;
- report exactly what changed and what did not change;
- stop if docs/task conflict.
```

GLM must not:

```text
- invent roadmap;
- redesign architecture without assignment;
- run broad audits unless explicitly assigned;
- turn every implementation task into a fresh audit;
- widen scope without asking;
- silently touch unrelated systems;
- merge PRs;
- continue closed roadmaps by inertia;
- add new URL debug modes by inertia;
- copy heavy assets before accepted plan;
- preload broad modular asset sets without explicit accepted plan.
```

---

## Task modes

### DOCS ONLY

Rules:

```text
Docs only.
No code.
No assets.
No runtime behavior changes.
No dependency changes unless explicitly scoped as tooling workflow.
Open PR if requested.
```

### AUDIT / DESIGN ONLY

Use only when explicitly assigned.

Rules:

```text
No code.
No runtime/assets changes.
No PR unless the task asks for a docs-only audit PR.
Audit should be reusable for multiple implementation steps when scope is broad.
```

Expected output:

```text
- system facts;
- files/functions involved;
- risks;
- recommended implementation scope;
- validation plan;
- manual QA plan;
- out-of-scope list.
```

### IMPLEMENTATION ONLY

Use when audit/design is accepted.

Rules:

```text
Use the accepted audit/design as source of truth.
Do not perform a new broad audit.
Implement only approved scope.
Open PR into main.
Do not merge.
```

### FIXUP ONLY

Use for blockers inside an existing PR.

Rules:

```text
Fix only the blocker.
Do not expand into next roadmap step.
Do not perform a new broad audit.
Keep the PR inside its original scope.
```

---

## High / High+ execution rule

GLM is a good executor for High/High+ work when:

```text
- the audit exists;
- changed files are bounded;
- validation is known;
- non-goals are explicit;
- no cross-system architecture decision remains open.
```

If implementation requires broad architecture judgment, ask GPT/Denis whether Opus should handle it.

---

## Graphify usage

If a Graphify artifact is supplied, use it to narrow source reading.

Do not read the entire repo by brute force when graph context is available.

Graphify does not replace reading required docs.

---

## Git / GitHub workflow

Branch naming:

```text
{task-id}-{short-description}
```

Commit message:

```text
{TASK-ID}: {description}
```

PR target:

```text
main
```

GLM must not merge PR.

Never commit tokens into code, docs, logs or PR body.

---

## Required validation

For implementation PRs, run:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

If a command cannot run, explain exactly why.

Do not claim validation passed if it did not run.

Docs-only PRs do not need npm validation unless the task explicitly requires it.

---

## Strict non-goals unless task explicitly scopes them

```text
- no combat changes during asset cleanup/runtime planning;
- no movement/pathfinding changes;
- no economy changes;
- no mapgen changes;
- no save/load changes;
- no PR #263 continuation by inertia;
- no combined hull x turret production matrix;
- no startup preload of all modular vehicle assets;
- no new query-string visual test mode sprawl;
- no camera projection changes without contract update and approval.
```
