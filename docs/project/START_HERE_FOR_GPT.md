# START_HERE_FOR_GPT.md

Status: onboarding file for a new GPT chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Purpose

This file is the entry point for a new GPT chat.

It does not contain the full workflow, roadmap, or current task details.  
Its job is to tell GPT what to read first and how to avoid starting work without project context.

---

## Read order for a new GPT chat

Before helping with the project, read these files in this order:

1. `docs/project/GPT_WORKFLOW.md`  
   Main working rules for GPT: how to manage tasks, avoid bad patterns, prepare GLM prompts, review PRs, and keep the project systematic.

2. `docs/project/PROJECT_STATE.md`  
   Short current status: what is merged, what is on hold, what must not be touched, and what the next planned discussion/task is.

3. `docs/project/ROADMAP.md`  
   Read only when planning the next phase, changing direction, generating roadmap tasks, or preparing a large audit.

4. `docs/project/GLM_EXECUTOR_RULES.md`  
   Read when preparing a task for GLM. This file is for executor instructions only.

5. Topic-specific docs when relevant, for example:
   - `docs/BUILDING_PLACEMENT_STRATEGY.md` for building PNG placement / anchoring.
   - Other architecture docs only when the current task directly touches that system.

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
- not plan roadmap unless explicitly asked.

### Denis role

Denis is the project owner.

Denis decides:
- product direction;
- economy and gameplay design;
- whether a PR is merged;
- whether roadmap changes are accepted.

Important: new product ideas from Denis still go through roadmap discipline.  
They are not automatically inserted into the current implementation phase.

---

## Important process rule

Do not start code work if project rules, current state, or roadmap are unclear.

When context is unclear:
1. stop;
2. ask for or inspect the relevant project docs;
3. update docs first if the documented direction is stale;
4. only then continue with implementation.

---

## Current-state file policy

`PROJECT_STATE.md` is intentionally short and operational.

It may be updated frequently after important PRs or direction changes.  
Small updates to `PROJECT_STATE.md` do not always require a dedicated docs-only PR if the team agrees to update it directly as part of a related PR.

It must not become a long history log.  
Detailed history belongs in PR bodies, architecture docs, or roadmap/audit documents.

---

## System-first principle

Avoid manual tuning as a production strategy.

Manual values, visual tuners, and one-off offsets are allowed only as diagnostics or rare exceptions.  
The preferred approach is:

```text
system model -> metadata/config -> generic implementation -> objects fit into the system
```

Do not lead the project into repeated per-object calibration unless Denis explicitly accepts that tradeoff.

If a task starts turning into repeated hand-tuned coordinates, offsets, anchors, or per-object exceptions, GPT must stop and challenge the approach.

Correct response pattern:

```text
This looks like a manual calibration path.
Before implementation, we need a system/model/metadata approach or an explicit decision to accept manual tuning.
```

---

## Roadmap discipline

Work must follow the accepted roadmap.

Denis owns product direction, but even Denis's new idea does not automatically enter the current workstream.

If a new idea appears during an active phase, GPT must classify it:

1. **Fits current roadmap and current phase**  
   It can be considered for the current plan, but only if it does not break scope.

2. **Fits roadmap, but not current phase**  
   Add it to backlog / future phase. Do not implement now.

3. **Changes roadmap direction**  
   Stop implementation. First update the roadmap, then update or create the relevant roadmap audit/design document. Only after that can implementation tasks be created.

4. **Contradicts current architecture or system approach**  
   Stop and challenge the idea. Do not force it into the current PR sequence.

Example:

If the current phase is building PNG placement and Denis says “let's quickly add another tank asset”, GPT must not push that into the current phase.

Correct behavior:

```text
This is outside the current roadmap phase.
We can add it to backlog or reopen roadmap planning,
but we should not inject it into the active BUILD/ANCHOR sequence.
```

Roadmap can change, but not silently.

Any roadmap change must be explicit:

```text
new idea -> roadmap update -> audit/design update if needed -> then implementation
```

Do not let spontaneous ideas bypass the accepted roadmap.

---

## When preparing a GLM task

Do not write huge prompt walls by default.

Use a compact task brief:

```text
Task:
Mode:
Read first:
Goal:
Scope:
Hard rules:
Output:
Validation:
Open PR:
Do not merge.
```

GLM should not receive roadmap/state context unless the task is specifically about roadmap, audit, or architecture planning.

---

## After reading this file

Read `GPT_WORKFLOW.md` and `PROJECT_STATE.md`.

Only after that, continue the project conversation.
