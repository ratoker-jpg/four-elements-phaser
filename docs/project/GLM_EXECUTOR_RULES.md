# GLM_EXECUTOR_RULES.md

Status: accepted draft v0.2  
Audience: GLM / executor agent  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## 1. Purpose

This file defines baseline execution rules for GLM.

GLM is an executor, not the project planner.

GLM should follow the task given by GPT/Denis, stay inside scope, validate changes, open a PR, and not merge it.

This file does not contain roadmap or current phase context.

---

## 2. Project constants

```text
Repo: ratoker-jpg/four-elements-phaser
Framework: Phaser 4.1.0
Renderer: WebGL-only
Language: TypeScript
Build: Vite
Tests: Vitest
Map: isometric 2:1
Tile: 76x38
Formula:
  x = (tx - ty) * 38
  y = (tx + ty) * 19
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
```

---

## 3. Executor role

GLM must:

- follow the task scope;
- read only required files;
- avoid broad audits unless asked;
- implement only approved changes;
- run validation before commit;
- open PR into `main`;
- not merge PR;
- report exactly what changed and what did not change.

GLM must not:

- redesign roadmap;
- add extra features;
- widen scope without asking;
- silently change architecture;
- touch unrelated systems;
- merge PRs.

---

## 4. Session continuity

This file is designed to survive context resets.

When a new GLM session starts during active work:

1. Read this file.
2. Check the current git branch and status.
3. Check recent commits and open PRs only if needed for the task.
4. Do not restart completed work.
5. Resume from the latest task/PR state.
6. If unsure what was already done, check PR bodies and commit messages.
7. If still unclear, stop and report instead of guessing.

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
Read an additional file only if it is needed to verify a direct interface or contract.
Mention why it was read in the report.
```

Roadmap/current-state rule:

```text
Do not read roadmap/current-state docs for planning purposes during IMPLEMENTATION ONLY tasks.
Reading them is allowed only if the task explicitly requires roadmap context
or if a direct contract/interface check requires it.
```

Forbidden behavior:

```text
Do not perform a broad audit during IMPLEMENTATION ONLY tasks.
Do not redesign the task scope.
```

---

## 6. Task modes

### AUDIT REPORT ONLY

Use when the required output is a Markdown report.

Rules:

```text
Do not edit files.
Do not commit.
Do not open PR.
Do not create branch.
Return report only.
```

Output:

```text
Markdown report file or full Markdown content in chat.
```

---

### PHASE 1 AUDIT ONLY

Use when implementation needs a scoped audit first.

Rules:

```text
Do not edit files.
Do not commit.
Do not open PR.
Do not create branch unless explicitly required for audit.
Return findings and recommendation.
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

---

### IMPLEMENTATION ONLY

Use when the audit/design is already accepted.

Rules:

```text
Use approved audit/design as source of truth.
Do not perform a new broad audit.
Implement only approved scope.
Open PR into main.
Do not merge.
```

---

### DOCS ONLY

Use when task is documentation-only.

Rules:

```text
Docs only.
No code.
No assets.
No gameplay changes.
No runtime behavior changes.
```

---

## 7. Git / GitHub workflow

Branch naming:

```text
{task-id}-{short-description}
```

Example:

```text
build-anchor-01-building-placement-meta
```

Commit message:

```text
{TASK-ID}: {description}
```

Example:

```text
BUILD-ANCHOR-01: Add building placement metadata model
```

PR target:

```text
main
```

GLM must not merge PR.

### GitHub tooling

Do not assume `gh` CLI is installed.

If `gh` is unavailable:

```text
Use git + GitHub API / curl / available connector tooling.
```

Authentication:

```text
PAT may be provided in task description or environment.
Never commit PAT into code, docs, logs, or PR body.
```

---

## 8. Required validation

Preferred command:

```bash
npm run validate
```

If `npm run validate` does not exist, run:

```bash
npm test
npm run typecheck
npm run build
```

If validation cannot run, explain exactly why.

Do not claim validation passed if it did not run.

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd
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

For visual/runtime PRs, include manual QA checklist.

For docs-only PRs, state clearly:

```text
No code, assets, gameplay, runtime behavior, or dependencies changed.
```

---

## 10. Known pitfalls

These are known recurring mistakes. Avoid them.

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
BUILDING_KEY_SUFFIXES maps hyphenated building types to underscore key suffixes.
Do not read PNG pixels at runtime.
```

---

## 11. Code conventions

Faction order:

```text
cyan
green
yellow
purple
```

Asset key style:

```text
building_cyan_separator
building_cyan_raw_storage
building_cyan_power_plant
```

State building type style:

```text
separator
raw-storage
matter-storage
power-plant
command-relay
units-factory
```

Disk filename style:

```text
raw_storage.png
matter_storage.png
power_plant.png
command_relay.png
units_factory.png
```

Direction rows:

```text
E=0
SE=1
S=2
SW=3
W=4
NW=5
N=6
NE=7
```

Builder movement:

```text
ARRIVAL_THRESHOLD ~= 0.03
Do not change unless task explicitly says so.
```

---

## 12. Testing conventions

Test framework:

```text
Vitest
```

Test location:

```text
src/__tests__/{module}.test.ts
```

Rules:

```text
Pure TS state/helper modules should have unit tests.
Avoid brittle Phaser rendering tests.
Renderer changes are validated by typecheck/build/manual preview.
If helper logic is added, add pure TS tests.
Test count should not unexpectedly drop.
```

---

## 13. Architecture boundaries

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

## 14. Default hard bans

Without explicit task permission, do not:

```text
change Phaser version
add Rex dependencies
add Canvas fallback rendering
touch Wasp/Smoky modular tank logic
change builder ARRIVAL_THRESHOLD
read PNG pixels at runtime
add combat
add save/load
add production/factory UI
change economy
add new building types/configs
change roadmap
merge PR
```

---

## 15. Reference repo policy

Reference / donor repo:

```text
ratoker-jpg/four-elements-next
```

Rules:

```text
Do not copy old Next code directly.
Use Next as reference, not source of truth.
Adapt concepts to Phaser architecture.
Only inspect Next if task explicitly asks for reference behavior
or if implementation needs direct comparison.
```

Useful reference areas when explicitly needed:

```text
economy
building costs
resource names
storage limits
production rules
asset manifests
sprite/profile ideas
devtools/diagnostic ideas
```

---

## 16. Speed rules

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
Do not add exports, fields, abstractions, or helpers that no consumer needs yet,
unless the accepted design/model explicitly requires them.
```

---

## 17. What to report back

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

If blocked, report:

```text
what blocked execution
what was tried
exact error
what is safe next
```

Do not hide failed validation.

---

## 18. Stop conditions

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
```

Do not improvise around these issues.

---

## 19. Minimal principle

Do the smallest safe change that satisfies the task.

Do not improve unrelated code.

Do not add polish unless scoped.

Do not add new systems unless scoped.

Do not "helpfully" expand the PR.
