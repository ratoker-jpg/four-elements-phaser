# START_HERE_FOR_GPT.md

Status: onboarding file for a new GPT chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Purpose

This file is the entry point for a new GPT chat.

It tells GPT what to read first and how to avoid starting work without project context.

---

## Phase 1 freeze note

After PR #80, Phase 1 Foundation feature work is frozen.

Do not continue from the old `docs/ROADMAP.md` as an active roadmap.

For the next chat, the active entry point is:

```text
docs/project/NEW_CHAT_HANDOFF.md
```

---

## Read order for a new GPT chat

Before helping with the project, read these files in this order:

1. `docs/project/NEW_CHAT_HANDOFF.md`  
   Current handoff after Phase 1 freeze. Start here.

2. `docs/project/PHASE_1_FREEZE.md`  
   Freeze decision, what is parked, and what the next planning step is.

3. `docs/project/FIX_BACKLOG.md`  
   Known fix/polish groups to audit for Sandbox MVP.

4. `docs/project/PROJECT_STATE.md`  
   Short current operational state.

5. `docs/project/GPT_WORKFLOW.md`  
   GPT planner/reviewer workflow rules.

6. `docs/project/GLM_EXECUTOR_RULES.md`  
   GLM executor rules and Telegram notification requirement.

7. Topic-specific docs only when relevant, for example:
   - `docs/BUILDING_PLACEMENT_STRATEGY.md` for building PNG placement / anchoring.

`docs/ROADMAP.md` is now inactive/archived. Read it only as historical reference.

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

Current next step is planning, not implementation:

```text
Create Sandbox MVP audit/roadmap.
```

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

Read `NEW_CHAT_HANDOFF.md`, `PHASE_1_FREEZE.md`, `FIX_BACKLOG.md`, and `PROJECT_STATE.md`.

Only after that, continue the project conversation.
