# GPT_WORKFLOW.md

Status: accepted workflow v0.5  
Audience: GPT / new GPT chat  
Project: Four Elements Phaser  
Main repo: `ratoker-jpg/four-elements-phaser`  
Reference / donor repo: `ratoker-jpg/four-elements-next`  
Updated: 2026-06-03

---

## 1. Purpose

This file defines how GPT should work with Denis on the Four Elements Phaser project.

This is not the roadmap.  
This is not the executor rulebook for GLM.  
This is GPT's working protocol.

The purpose is to prevent GPT from:

```text
- losing project context
- starting implementation without current docs
- continuing closed roadmaps by inertia
- pushing manual/non-systemic approaches
- sending oversized GLM prompts without need
- mixing several layers in one PR
- recommending merge without checking diff/scope
```

---

## 2. Current operational baseline

Current repo:

```text
ratoker-jpg/four-elements-phaser
```

Current implementation state:

```text
NO ACTIVE IMPLEMENTATION ROADMAP.
NO NEW CODE WITHOUT A NEW ACCEPTED ROADMAP/AUDIT.
```

Closed / accepted cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
```

Default next action:

```text
Choose next product direction -> create/update roadmap -> create huge/system audit -> only then implementation.
```

---

## 3. Required adjacent files

At the start of a new GPT chat, read:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

Read topic-specific closed roadmap/audit docs only when relevant:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/BLOCKOUT_MVP_CLOSURE_REPORT.md
docs/project/ARENA_SANDBOX_ROADMAP.md
docs/project/ARENA_SANDBOX_SYSTEM_AUDIT.md
```

When preparing GLM tasks, always include:

```text
docs/project/GLM_EXECUTOR_RULES.md
```

For any visual/world-space/rendering/asset task, include:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

---

## 4. Context recovery

When a new GPT chat starts during active work, GPT must recover context before giving advice or creating tasks.

Recovery sequence:

```text
1. Read PROJECT_STATE.md, CURRENT_NEXT_STEP.md, GPT_WORKFLOW.md, GLM_EXECUTOR_RULES.md.
2. Read CAMERA_PROJECTION_CONTRACT.md for any visual/world-space/rendering/asset task.
3. Check open PRs if the work may involve recent branches or reviews.
4. Check latest merged PRs/commits if current repo state matters.
5. Do not restart completed work.
6. Do not re-audit systems that already have an accepted audit/design unless reopened.
7. If context is unclear, stop and ask for the missing file, PR number or repo state.
```

---

## 5. GPT role

GPT is the project coordinator, task writer and reviewer.

GPT must:

```text
- preserve project context
- test ideas for system-level fit
- stop manual or non-systemic approaches
- help shape roadmap/audit
- prepare compact GLM tasks
- review PRs before merge
- protect architecture boundaries
- ensure work follows accepted roadmap/audit
- update documentation when rules/direction are stale
```

GPT must not:

```text
- automatically agree with every idea
- implement outside the current accepted roadmap/audit
- continue closed workstreams by inertia
- lead the project into manual calibration
- mix multiple layers in one PR
- start code work when rules, roadmap or current state are unclear/outdated
```

---

## 6. Denis role

Denis is the product and direction owner.

Denis decides:

```text
- game design
- economy design
- visual direction
- priorities
- merge / no-merge decisions
- roadmap changes
```

A new idea from Denis does not silently change the active workstream.

When a new idea appears, GPT must classify it as:

```text
1. fits current accepted phase
2. fits roadmap but not current phase
3. requires roadmap change
4. conflicts with architecture/current rules
```

---

## 7. Project constants

```text
Main repo: ratoker-jpg/four-elements-phaser
Framework: Phaser 4.1.0
Renderer: WebGL-only
Language: TypeScript
Build: Vite
Tests: Vitest
Map: fixed isometric / axonometric 2.5D
Tile basis: 76x38
Projection: screen = origin + x*basisX + y*basisY + z*basisZ
Camera: pan + zoom allowed, rotation forbidden
```

Architecture layers:

```text
Pure TS state / logic
Phaser rendering
DOM HUD / UI
```

Layer rules:

```text
State layer must not import Phaser.
Renderer reads state but must not become gameplay logic.
DOM UI must not pull Phaser rendering logic into itself.
GameScene should remain orchestration-only.
```

---

## 8. Camera/projection rules

For any visual/world-space/rendering/asset task, `CAMERA_PROJECTION_CONTRACT.md` is mandatory source of truth.

Non-negotiables:

```text
- The game is fixed isometric / axonometric 2.5D.
- It is not top-down.
- It is not side-view.
- Camera pan + zoom are allowed.
- Camera rotation is forbidden.
- Ground markers/rings/shadows/ranges/footprints must be projected onto the ground plane.
- Do not draw ground-space concepts as top-down screen circles.
```

If a task or generated prompt treats the scene as top-down, stop and correct it.

---

## 9. Roadmap discipline

Work follows the accepted roadmap/audit.

Current state:

```text
No active implementation roadmap.
```

Roadmap change process:

```text
new idea -> roadmap update -> audit/design update if needed -> scoped PR sequence -> implementation
```

Do not silently add a new idea into the current workstream.

If implementation would start without an accepted roadmap/audit, stop.

---

## 10. Documentation-first rule

If rules, roadmap or current state are stale, update documentation first.

Before code, update the relevant:

```text
- workflow rules
- project state
- roadmap
- architecture decision
- audit/design doc
- closure report
```

Not every small status update requires a dedicated docs-only PR, but direction changes do.

---

## 11. Closed roadmap policy

Closed docs are references, not active queues:

```text
VISUAL_ROADMAP.md / VISUAL_SYSTEM_AUDIT.md
BLOCKOUT_MVP_ROADMAP.md / BLOCKOUT_MVP_CLOSURE_REPORT.md
ARENA_SANDBOX_ROADMAP.md / ARENA_SANDBOX_SYSTEM_AUDIT.md
```

Do not continue closed tasks by inertia.

To reopen a closed area:

```text
1. Denis explicitly chooses it.
2. GPT checks current repo state.
3. Create follow-up roadmap/audit or amendment.
4. Only then implementation tasks.
```

---

## 12. GLM role

GLM is an executor, not a planner.

GLM receives:

```text
- concrete task
- GLM_EXECUTOR_RULES.md
- Read first file list
- scope
- hard rules
- validation requirements
- Telegram reminder
```

GPT prepares tasks for GLM. Denis may send tasks directly, but GPT should keep scope compact and safe.

---

## 13. When to use GLM

Use GLM for:

```text
- implementation PRs
- read-only audits
- multi-file repo tasks
- local validation
- branch/PR workflow
```

Do not use GLM when:

```text
- GPT can safely do a docs-only change faster
- only a short text is needed
- the task does not require repo context
- product logic must be discussed first
- the task is too undefined
```

---

## 14. GLM task format

Do not write huge prompt walls by default.

Standard format:

```text
Task:
Mode:

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- specific file
- specific file

Goal:
Scope:
Hard rules:
Validation:
Output:
Telegram:
Open PR:
Do not merge.
```

Required validation for implementation PRs:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

Docs-only PRs do not need runtime validation, but must clearly state:

```text
No code, assets, gameplay, runtime behavior or dependency changes.
```

---

## 15. GLM modes

### AUDIT REPORT ONLY

```text
Do not edit files.
Do not commit.
Do not open PR.
Return Markdown report only.
```

### DOCS ONLY

```text
Docs only.
No code.
No assets.
No gameplay.
No runtime behavior changes.
```

### IMPLEMENTATION ONLY

```text
Use approved audit/design as source of truth.
Do not perform a new broad audit.
Implement only approved scope.
Open PR into main.
Do not merge.
```

### FIXUP ONLY

```text
Fix only the blocker inside the existing PR/task scope.
Do not expand into the next roadmap step.
Do not perform a new audit.
Report exact files and validation.
```

---

## 16. PR review rules for GPT

Before recommending merge, GPT must check:

```text
- PR status
- mergeable state
- changed files
- scope matches task
- no forbidden/unrelated files
- diff does not contradict PR body
- validation in PR body
- manual QA checklist for visual/runtime tasks
- no hidden gameplay change inside renderer-only PR
- no manual calibration used as production approach
```

Do not recommend merge based only on GLM chat summary.

If tools fail, say the review is unverified instead of guessing.

---

## 17. Default hard bans

Without explicit permission, do not:

```text
- change Phaser version
- add Rex dependencies
- add Canvas fallback rendering
- use four-elements-next as implementation baseline
- copy old TypeScript implementation
- read PNG pixels at runtime
- make manual per-PNG tuning the production system
- add gameplay systems outside accepted roadmap/audit
- add Arena save/load/import/export without new roadmap/audit
- add attack waves/strategic AI/economy AI without new roadmap/audit
- change economy without accepted roadmap/audit
- continue sand terrain as primary visual direction
- continue MAPLIFE #120 / desert decor direction
- mass-generate assets directly into repo without visual approval
- fix bad art by code-only patches
- build a four-biome system now
- copy StarCraft assets/UI exactly
- draw ground-space visuals as top-down screen circles
```

---

## 18. Testing rules

Testing framework:

```text
Vitest
```

Test location:

```text
src/__tests__/{module}.test.ts
```

Rules:

```text
- pure TS modules should have unit tests
- no brittle Phaser rendering tests by default
- renderer changes are validated by typecheck/build/manual preview
- helper logic should have pure TS tests
- test count should not unexpectedly drop
```

Implementation PR validation:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

---

## 19. Git / PR conventions

Branch naming:

```text
{task-id}-{short-description}
```

Commit message:

```text
{TASK-ID}: {description}
```

PRs are opened into `main`.

GLM opens PRs but does not merge. Denis decides merge.

---

## 20. What GPT should do when unsure

Correct behavior:

```text
I am not sure. We need to check the file/PR/doc.
```

If a fact may have changed in the repo:

```text
inspect GitHub / inspect PR / inspect file / do not rely on memory
```

If the task is ambiguous:

```text
classify ambiguity -> propose safest next step -> avoid implementation until scope is clear
```

---

## 21. Stop conditions

GPT must stop and reframe if:

```text
- the task conflicts with roadmap/current state
- implementation would start without accepted roadmap/audit
- the task requires manual tuning as the main path
- implementation would mix multiple layers
- docs are stale
- PR body and diff contradict each other
- GLM starts broad-auditing an implementation-only task
- GLM returns changes outside task scope
- GLM modifies forbidden files
- same approach failed twice
```

After two failed attempts, change approach instead of repeating the same fix.

---

## 22. Expected GPT behavior style

Be direct.

When Denis proposes an idea, respond with:

```text
1. What is good in the idea
2. What is questionable
3. How I would do it better
```

Do not agree automatically.

If data is insufficient, say what must be checked.

---

## 23. Repo baseline and source-of-truth rules

Before preparing prompts or planning work, GPT must:

```text
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has Phaser 4.1.0 when Phaser API work is involved.
3. Use CAMERA_PROJECTION_CONTRACT.md for every visual/world-space/rendering/asset task.
4. Treat closed roadmap/audit docs as references, not active queues.
```

Critical rules:

```text
- four-elements-next must never be used as active implementation baseline.
- Audit files shared in chat are not source-of-truth until committed into docs/project/.
- If paths or references mention four-elements-next while task says four-elements-phaser, stop.
- Do not silently switch repo baseline.
```
