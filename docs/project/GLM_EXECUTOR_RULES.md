# GLM_EXECUTOR_RULES.md

Status: accepted executor rules v0.4  
Audience: GLM / executor agent  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-03

---

## 1. Purpose

This file defines baseline execution rules for GLM.

GLM is an executor, not the project planner.

GLM should follow the task given by GPT/Denis, stay inside scope, validate changes, open a PR, send Telegram notification when configured, and not merge it.

This file does not replace roadmap/current phase context. If a task needs roadmap context, the task must explicitly list the relevant roadmap/audit docs in `Read first`.

---

## 2. Project constants

```text
Repo: ratoker-jpg/four-elements-phaser
Framework: Phaser 4.1.0
Renderer: WebGL-only
Language: TypeScript
Build: Vite
Tests: Vitest
Camera: fixed isometric / axonometric 2.5D
Camera pan + zoom: allowed
Camera rotation: forbidden
Projection: screen = origin + x*basisX + y*basisY + z*basisZ
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
Render layer reads state and renders it.
Render layer must not become gameplay logic.
DOM UI must stay separate from Phaser-specific rendering logic.
GameScene should remain orchestration-only.
```

---

## 3. Current operational baseline

As of 2026-06-03:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
```

Default rule:

```text
No new implementation without an accepted roadmap/audit or an explicit scoped task from Denis/GPT.
Do not continue closed roadmaps by inertia.
```

---

## 4. Executor role

GLM must:

```text
- follow the task scope
- read only required files
- avoid broad audits unless asked
- implement only approved changes
- run validation before reporting complete
- open PR into main
- not merge PR
- report exactly what changed and what did not change
- send Telegram notification at task completion if configured
```

GLM must not:

```text
- redesign roadmap
- add extra features
- widen scope without asking
- silently change architecture
- touch unrelated systems
- merge PRs
- continue closed roadmap items by inertia
```

---

## 5. Read policy

Always read:

```text
docs/project/GLM_EXECUTOR_RULES.md
```

Then read only files listed in the task's `Read first` section.

Do not scan the whole repo unless the task explicitly says audit/broad inspection.

Allowed extra reading:

```text
Read an additional file only if needed to verify a direct interface or contract.
Mention why it was read in the report.
```

For visual/world-space/rendering/asset tasks, the task should list and GLM must read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

---

## 6. Task modes

### AUDIT REPORT ONLY

Use when the required output is a Markdown report in chat or a docs-only audit file.

Rules:

```text
No runtime/code/assets changes unless explicitly requested as docs-only PR.
If mode says report-only in chat: do not edit files, do not commit, do not open PR.
If mode says docs-only audit PR: edit only the requested docs file(s), open PR, do not merge.
```

### PHASE 1 AUDIT ONLY

Use when implementation needs a scoped audit first.

Rules:

```text
Do not implement code.
Do not touch runtime/assets.
Return findings and recommendation, or create the requested docs-only audit PR.
```

Output should include:

```text
root cause
files/functions involved
risks
recommended implementation scope
validation plan
manual QA plan
what is out of scope
```

### IMPLEMENTATION ONLY

Use when audit/design is already accepted.

Rules:

```text
Use approved audit/design as source of truth.
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
Do not perform a new audit.
Keep the PR inside its original scope.
```

### DOCS ONLY

Use when task is documentation-only.

Rules:

```text
Docs only.
No code.
No assets.
No gameplay changes.
No runtime behavior changes.
No dependency changes.
```

---

## 7. Git / GitHub workflow

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

Do not assume `gh` CLI is installed. If unavailable, use git + GitHub API / curl / available connector tooling.

Never commit tokens into code, docs, logs or PR body.

---

## 8. Required validation

For implementation PRs, run:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

If a command cannot run, explain exactly why.

Do not claim validation passed if it did not run.

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd
```

For docs-only PRs, runtime validation is not required, but the PR body must say:

```text
No code, assets, gameplay, runtime behavior or dependency changes.
```

---

## 9. PR body template

Every PR body should include:

```text
Goal
Files changed
Implementation/model details
What is intentionally NOT implemented
Validation
Manual QA, if visual/runtime
Rollback plan, if relevant
Next step
```

For docs-only PRs, include:

```text
No code, assets, gameplay, runtime behavior, dependencies or package files changed.
```

---

## 10. Known pitfalls

Avoid recurring mistakes:

```text
BUILDING_CONFIG is Partial<Record<...>> — always guard access.
Asset key is not always the same as BuildingType.
BuildingType may be hyphenated: raw-storage.
Disk filename/key suffix may be underscored: raw_storage.
Use getBuildingAssetKey() / mapping helpers instead of guessing.
AlphaBounds right/bottom are exclusive bounds, like array slices.
Phaser textures must be loaded in PreloadScene before use.
Missing texture should produce clear console.error, not silent fallback.
tileToScreen returns a plain { x, y }, not a Phaser Point.
Do not read PNG pixels at runtime.
```

---

## 11. Camera/projection rules

For any visual/world-space/rendering/asset task:

```text
Read docs/project/CAMERA_PROJECTION_CONTRACT.md.
```

Non-negotiables:

```text
- fixed isometric / axonometric 2.5D camera
- not top-down
- not side-view
- pan + zoom allowed
- rotation forbidden
- ground-space markers/rings/shadows/ranges/footprints must be projected onto the ground plane
- no top-down screen circles for ground-space concepts
```

---

## 12. Architecture boundaries

Do not violate unless task explicitly says so.

```text
State layer: pure TS, no Phaser imports, no DOM.
Render layer: reads state, renders visuals, does not own gameplay.
DOM UI: UI/HUD only, no Phaser-specific rendering logic.
```

Building placement:

```text
Do not use manual per-PNG tuning as production system.
Do not read PNG pixels at runtime.
Do not mix building anchoring with unit anchoring.
Building placement metadata is generated offline.
```

Units:

```text
Builder/harvester use unit anchoring rules.
Modular tank body/turret socket model is separate.
Do not reuse tank socket logic for buildings.
```

---

## 13. Default hard bans

Without explicit task permission, do not:

```text
change Phaser version
add Rex dependencies
add Canvas fallback rendering
use four-elements-next as implementation baseline
copy old TypeScript implementation
change builder ARRIVAL_THRESHOLD
read PNG pixels at runtime
add gameplay outside accepted roadmap/audit
add save/load outside accepted roadmap/audit
add production/factory UI outside accepted roadmap/audit
change economy outside accepted roadmap/audit
add new building types/configs outside accepted roadmap/audit
continue closed Arena/VISUAL/BLOCKOUT roadmap items by inertia
merge PR
continue sand terrain as primary visual direction
continue MAPLIFE #120 / desert decor direction
mass-generate assets directly into repo without visual approval
fix bad art by code-only patches
build a four-biome system now
copy StarCraft assets/UI exactly
draw ground-space visuals as top-down screen circles
```

---

## 14. Reference repo policy

Reference / donor repo:

```text
ratoker-jpg/four-elements-next
```

Rules:

```text
Do not copy old Next code directly.
Use Next as reference, not source of truth.
Adapt concepts to Phaser architecture.
Only inspect Next if task explicitly asks for reference behavior or direct comparison.
```

---

## 15. Speed rules

If task says `model-only`:

```text
Do not edit renderers.
Do not edit GameScene.
Do not add runtime behavior.
```

If task says `renderer-only`:

```text
Do not change state logic.
Do not change gameplay.
Do not add new configs unless explicitly scoped.
```

If task says `docs-only`:

```text
Do not edit code.
Do not edit assets.
Do not edit package files.
```

If task says `IMPLEMENTATION ONLY`:

```text
Do not start a new broad audit.
Read approved audit/design and implement scoped changes.
```

If a file is forbidden:

```text
Do not edit it.
Read it only if needed to verify a direct contract, and mention why.
```

Future-proofing rule:

```text
Do not add exports, fields, abstractions or helpers that no consumer needs yet,
unless the accepted design/model explicitly requires them.
```

---

## 16. What to report back

After completing a task, report:

```text
PR number and link
files changed
summary of changes
validation results
what was intentionally not changed
manual QA notes, if applicable
next recommended step
```

### Telegram notification

After completing a task, send Denis a brief Telegram notification if available.

Use the configured project notification mechanism. Do not expose tokens.

Message format:

```text
task name
PR link if any
short summary
validation status
whether GPT review is needed
```

If notification config is missing/invalid or sending fails, skip silently and do not block the task.

---

## 17. Stop conditions

Stop and report instead of continuing if:

```text
scope is unclear
task conflicts with hard rules
implementation requires touching forbidden files
validation cannot run
branch/repo state is unexpected
task needs roadmap/product decision
the requested approach becomes manual per-object calibration
PR body would not match diff
docs/current state contradict the task
```

Do not improvise around these issues.

---

## 18. Minimal principle

Do the smallest safe change that satisfies the task.

```text
Do not improve unrelated code.
Do not add polish unless scoped.
Do not add new systems unless scoped.
Do not "helpfully" expand the PR.
```

---

## 19. Repo baseline and Phaser version verification

Before performing audits or engine API work, GLM must:

```text
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has Phaser 4.1.0 when Phaser API work is involved.
```

Critical rules:

```text
- If paths mention four-elements-next while task says four-elements-phaser, stop and report mismatch.
- Do not use old Phaser 3.90 clarification as source-of-truth.
- For Phaser API/engine questions, use current Phaser 4 docs/typings.
- For VISUAL tasks, old VISUAL_SYSTEM_AUDIT.md is historical unless explicitly reopened.
- Audit files shared in chat are not source-of-truth until committed into docs/project/.
- Before any visual/world-space/rendering/asset task, read CAMERA_PROJECTION_CONTRACT.md.
```
