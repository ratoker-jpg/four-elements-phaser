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
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
```

Do not follow `PHASE_2_ROADMAP.md` or `PHASE_2_ROADMAP_AUDIT.md` as active direction. They are archived.

---

## Read order for a new GPT chat

Before helping with the project, read these files in this order:

1. `docs/project/VISUAL_ROADMAP.md`  
   Current visual planning direction. Start here.

2. `docs/project/VISUAL_SYSTEM_AUDIT.md`  
   Accepted visual audit with staged PR sequence (VISUAL-01 through VISUAL-12).

3. `docs/project/PROJECT_STATE.md`  
   Short current operational state.

4. `docs/project/CURRENT_NEXT_STEP.md`  
   What to do next.

5. `docs/project/GPT_WORKFLOW.md`  
   GPT planner/reviewer workflow rules.

6. `docs/project/GLM_EXECUTOR_RULES.md`  
   GLM executor rules and Telegram notification requirement.

7. Topic-specific docs only when relevant, for example:
   - `docs/BUILDING_PLACEMENT_STRATEGY.md` for building PNG placement / anchoring.

Archived docs (read as historical reference only):
- `docs/project/PHASE_2_ROADMAP.md` — superseded by VISUAL_ROADMAP.md
- `docs/project/PHASE_2_ROADMAP_AUDIT.md` — superseded by VISUAL_ROADMAP.md
- `docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md` — sand pipeline, paused
- `docs/project/MAPLIFE_01_ASSET_READINESS.md` — rejected
- `docs/project/NEW_CHAT_HANDOFF.md` — superseded by NEW_CHAT_HANDOFF_VISUAL.md
- `docs/project/PHASE_1_FREEZE.md` — historical

Archived copies: `docs/project/archive/`

---

## Current roadmap model

```text
roadmap first → huge roadmap audit second → implementation after audit
```

Implementation can use high+/medium/low scoped steps directly if covered by the accepted audit (`VISUAL_SYSTEM_AUDIT.md`). Do not require a new mini-audit for every step that is already covered by the accepted audit.

If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.

---

## Active VISUAL implementation sequence

```text
VISUAL-01 — Industrial map visual candidate workflow
VISUAL-02 — Map rendering prototype spike
VISUAL-03 — Industrial terrain/platform integration
VISUAL-04 — Map frame / grounded presentation
VISUAL-05 — Lower-left start composition
VISUAL-06 — Resource field visual model design
VISUAL-07 — HUD layout design doc
VISUAL-08 — HUD shell implementation
VISUAL-09 — Command panel/hotkey visual pass
VISUAL-10 — Main menu visual refresh
VISUAL-11 — Harvester/builder visual workflow design
VISUAL-12 — Approved unit visual integration
```

---

## Current next step

```text
VISUAL-01 — Industrial map visual candidate workflow
```

VISUAL-AUDIT-01 is complete. The audit is in `docs/project/VISUAL_SYSTEM_AUDIT.md`. Implementation tasks covered by the audit can proceed without a new mini-audit.

Do not start code work if project rules, current state, or roadmap are unclear.

When context is unclear:

1. stop;
2. inspect the relevant project docs;
3. update docs first if the documented direction is stale;
4. only then continue with implementation.

---

## Explicitly obsolete

```text
- Phase 2 roadmap as active direction
- Sand terrain as primary visual direction
- MAPLIFE #120 continuation
- MAPLIFE desert decor direction
- Mass asset generation directly into repo without visual approval
- Fixing bad art by code-only patches
- Four-biome system now
- Copying StarCraft assets/UI exactly
```

---

## Important project decisions

```text
- One strong primary biome first: industrial platform / mining battlefield
- Map must feel grounded on a surface, not floating
- Playable edges should eventually feel irregular/organic, not a perfect board
- HQ/start zone should move to lower-left later (VISUAL-05)
- HUD target: bottom-left minimap, bottom-center selected info, bottom-right commands/production/hotkeys
- Old successful main menu composition should be preserved, but background/theme updated
- Harvester and Builder visuals will be refreshed later (VISUAL-11/12)
- Tank/Wasp combat 3D asset direction should not be restyled by default
```

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

Current active model:

```text
VISUAL_ROADMAP.md -> VISUAL_SYSTEM_AUDIT.md -> staged implementation (VISUAL-01..12)
```

---

## After reading this file

Read `VISUAL_ROADMAP.md`, `VISUAL_SYSTEM_AUDIT.md`, `PROJECT_STATE.md`, and `CURRENT_NEXT_STEP.md`.

Only after that, continue the project conversation.
