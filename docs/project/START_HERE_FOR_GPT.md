# START_HERE_FOR_GPT.md

Status: onboarding file for a new GPT chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Purpose

This file is the entry point for a new GPT chat.

It tells GPT what to read first and how to avoid starting work without project context.

---

## Current direction

VISUAL roadmap is the active planning direction.

The previous Phase 2 (sand-terrain-focused) roadmap is archived.

For the next chat, the active entry points are:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
```

Do not follow `PHASE_2_ROADMAP.md` or `PHASE_2_ROADMAP_AUDIT.md` as active direction. They are archived.

---

## Read order for a new GPT chat

Before helping with the project, read these files in this order:

1. `docs/project/VISUAL_ROADMAP.md`  
   Current visual planning direction. Start here.

2. `docs/project/PROJECT_STATE.md`  
   Short current operational state.

3. `docs/project/CURRENT_NEXT_STEP.md`  
   What to do next.

4. `docs/project/GPT_WORKFLOW.md`  
   GPT planner/reviewer workflow rules.

5. `docs/project/GLM_EXECUTOR_RULES.md`  
   GLM executor rules and Telegram notification requirement.

6. Topic-specific docs only when relevant, for example:
   - `docs/BUILDING_PLACEMENT_STRATEGY.md` for building PNG placement / anchoring.

Archived docs (read as historical reference only):
- `docs/project/PHASE_2_ROADMAP.md` — superseded by VISUAL_ROADMAP.md
- `docs/project/PHASE_2_ROADMAP_AUDIT.md` — superseded by VISUAL_ROADMAP.md
- `docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md` — sand pipeline, paused
- `docs/project/MAPLIFE_01_ASSET_READINESS.md` — rejected
- `docs/project/NEW_CHAT_HANDOFF.md` — superseded
- `docs/project/PHASE_1_FREEZE.md` — historical
- `docs/ROADMAP.md` — inactive/archived

Archived copies: `docs/project/archive/`

---

## Role split

### GPT role

GPT is the project coordinator and reviewer.

GPT should:

- keep project context consistent;
- challenge weak, manual, or non-systemic approaches;
- prepare compact GLM tasks;
- review GLM/Codex PRs;
- protect roadmap and architecture boundaries;
- update documentation first when the rules or direction are stale.

### GLM role

GLM is an executor.

GLM should:

- follow a concrete task scope;
- read `GLM_EXECUTOR_RULES.md`;
- read only the files listed in the task's `Read first` section;
- open PRs but not merge them;
- run validation;
- send Telegram notification at completion if configured;
- not plan roadmap unless explicitly asked.

### Denis role

Denis is the project owner.

Denis decides:

- product direction;
- economy and gameplay design;
- whether a PR is merged;
- whether roadmap changes are accepted.

Important: new product ideas from Denis still go through roadmap discipline.

---

## Immediate process rule

Current next step is audit, not implementation:

```text
VISUAL-AUDIT-01 — Visual audit/design
```

Do not start VISUAL implementation before the audit is accepted.

Do not start code work if project rules, current state, or roadmap are unclear.

When context is unclear:

1. stop;
2. inspect the relevant project docs;
3. update docs first if the documented direction is stale;
4. only then continue with implementation.

---

## Telegram notification rule for GLM prompts

When GPT prepares GLM tasks or fixup prompts, include:

```text
Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

This is repeated here because small fixup prompts may not always include the full executor rules context.

---

## System-first principle

Avoid manual tuning as a production strategy.

Manual values, visual tuners, and one-off offsets are allowed only as diagnostics or rare exceptions.

Preferred approach:

```text
system model -> metadata/config -> generic implementation -> objects fit into the system
```

If a task starts turning into repeated hand-tuned coordinates, offsets, anchors, or per-object exceptions, GPT must stop and challenge the approach.

---

## Roadmap discipline

Roadmap can change, but not silently.

Any roadmap change must be explicit:

```text
new idea -> roadmap update -> audit/design update if needed -> then implementation
```

After Phase 1 freeze:

```text
FIX_BACKLOG -> Sandbox MVP audit -> new Sandbox MVP roadmap -> scoped implementation packages
```

---

## After reading this file

Read `VISUAL_ROADMAP.md`, `PROJECT_STATE.md`, and `CURRENT_NEXT_STEP.md`.

Only after that, continue the project conversation.
