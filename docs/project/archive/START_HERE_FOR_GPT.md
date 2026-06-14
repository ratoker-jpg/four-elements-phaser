# START_HERE_FOR_GPT.md

Status: **ARCHIVED** — superseded by CURRENT_NEXT_STEP.md + role docs (2026-06-14)  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-03

---

## Purpose

This file is the entry point for a new GPT chat.

It tells GPT what to read first and how to avoid starting work without project context.

---

## Current direction

There is currently **no active implementation roadmap**.

Latest closed cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
```

Default next action:

```text
Choose the next product direction and create a new roadmap audit before implementation.
```

Do not continue old VISUAL, BLOCKOUT, CAMERA, PROJECTION or ARENA tasks by inertia.

---

## Read order for a new GPT chat

Before helping with the project, read these files in this order:

```text
1. docs/project/PROJECT_STATE.md
2. docs/project/CURRENT_NEXT_STEP.md
3. docs/project/GPT_WORKFLOW.md
4. docs/project/GLM_EXECUTOR_RULES.md
5. docs/project/CAMERA_PROJECTION_CONTRACT.md
6. docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

Read these only when the task directly touches their area:

```text
docs/project/BLOCKOUT_MVP_CLOSURE_REPORT.md
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/ARENA_SANDBOX_ROADMAP.md
docs/project/ARENA_SANDBOX_SYSTEM_AUDIT.md
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
```

Archived/historical docs are not active implementation queues unless Denis explicitly reopens them.

---

## Current roadmap model

```text
roadmap first -> huge/system audit second -> High+/High implementation PRs after accepted audit
```

Current implementation state:

```text
No active implementation roadmap.
No code PR should start until the next roadmap/audit is accepted.
```

Allowed immediate work:

```text
- docs cleanup
- manual QA planning
- review of already-open PRs
- next roadmap/audit creation
```

---

## Latest Arena result

Arena is now a standalone combat sandbox.

It includes:

```text
- clean Arena mode with no HQ/base, harvesters, resources, economy HUD or obstacles
- ArenaMenu as primary UX
- manual body + weapon + team unit creation
- projected click placement using CAMERA_PROJECTION_CONTRACT.md
- ally/enemy model
- ally controllable, enemy target-only
- turret target-lock instead of mouse-follow in Arena
- roster/control panel/help/status messages
- simple enemy behavior modes: passive, stationary_shooter, chaser, hold_position
```

Closure source:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

---

## Camera/projection non-negotiables

For any visual/world-space/rendering/asset work, read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Rules:

```text
- The game is fixed isometric / axonometric 2.5D.
- It is not top-down.
- It is not side-view.
- Camera pan + zoom are allowed.
- Camera rotation is forbidden.
- Projection formula: screen = origin + x*basisX + y*basisY + z*basisZ.
- Ground markers/rings/shadows/ranges/footprints must be projected onto the ground plane.
- Do not draw ground-space concepts as top-down screen circles.
```

---

## Explicitly obsolete as active queues

```text
- Phase 2 roadmap as active direction
- Sand terrain as primary visual direction
- MAPLIFE #120 continuation
- MAPLIFE desert decor direction
- VISUAL implementation queue as active queue
- BLOCKOUT-MVP implementation queue as active queue
- Arena Sandbox implementation queue as active queue
- Mass asset generation directly into repo without visual approval
- Fixing bad art by code-only patches
- Four-biome system now
- Copying StarCraft assets/UI exactly
```

---

## Role split

### GPT role

GPT is the project coordinator and reviewer.

GPT should:

```text
- keep project context consistent
- challenge weak, manual or non-systemic approaches
- prepare compact GLM tasks
- review GLM/Codex PRs before merge
- protect roadmap and architecture boundaries
- update documentation first when rules or direction are stale
```

### GLM role

GLM is an executor.

GLM should:

```text
- follow a concrete task scope
- read GLM_EXECUTOR_RULES.md
- read only files listed in the task's Read first section
- open PRs but not merge them
- run validation
- send Telegram notification at completion if configured
- not plan roadmap unless explicitly asked
```

### Denis role

Denis is the project owner.

Denis decides:

```text
- product direction
- economy and gameplay design
- whether a PR is merged
- whether roadmap changes are accepted
```

New product ideas still go through roadmap discipline.

---

## Telegram notification rule for GLM prompts

When GPT prepares GLM tasks or fixup prompts, include:

```text
Telegram:
After completing the task, send Denis a Telegram notification.
You already know where to send it.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

---

## System-first principle

Avoid manual tuning as a production strategy.

Preferred approach:

```text
system model -> metadata/config -> generic implementation -> objects fit into the system
```

If a task starts turning into repeated hand-tuned coordinates, offsets, anchors, or per-object exceptions, GPT must stop and challenge the approach.

---

## Roadmap discipline

Roadmap can change, but not silently.

```text
new idea -> roadmap update -> audit/design update if needed -> then implementation
```

If context is unclear:

```text
1. stop
2. inspect the relevant project docs
3. update docs first if the documented direction is stale
4. only then continue with implementation
```

---

## After reading this file

Read `PROJECT_STATE.md`, `CURRENT_NEXT_STEP.md`, `GPT_WORKFLOW.md`, `GLM_EXECUTOR_RULES.md`, `CAMERA_PROJECTION_CONTRACT.md`, and `ARENA_SANDBOX_CLOSURE_REPORT.md`.

Only after that, continue the project conversation.
