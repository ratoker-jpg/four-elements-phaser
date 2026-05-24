# AI_WORKFLOW — Four Elements Phaser

## Purpose

This document defines how AI agents work on the new Phaser-first repository.

The goal is to avoid the old failure pattern:

patches → refactors → renderer migration → bridge → restart.

## Default workflow

Use this flow:

1. Define narrow task.
2. Audit/plan if task is non-trivial.
3. Wait for explicit approval: `Делай`.
4. Implement only approved scope.
5. Run validation.
6. Report changed files, validation, manual QA, rollback.
7. Review before merge.

## When to use deep audit

Use deep audit only for major forks:

- engine choice;
- repo strategy;
- architecture direction;
- dependency adoption;
- large subsystem redesign.

Deep audit must be read-only/docs-only unless explicitly approved.

## When to use stage audit

Use stage audit for:

- PR that touches multiple subsystems;
- new core system;
- pathfinding/economy/construction changes;
- dependency adoption;
- performance architecture.

Stage audit output must include:

- root cause / goal;
- files likely touched;
- files explicitly not touched;
- risks;
- acceptance;
- validation;
- manual QA;
- rollback;
- end with `Жду Делай`.

## When implementation can start

Implementation starts only after explicit user approval:

```text
Делай
```

No approval, no code.

## Codex usage

Use Codex for:

- deep read-only audits;
- difficult architecture reviews;
- PR review for hidden scope creep;
- large docs/report generation;
- narrow implementation only when scope is fully specified.

Do not use Codex for:

- simple docs edits;
- small local patches;
- unbounded implementation;
- “fix everything” tasks;
- speculative coding.

## GLM usage

Use GLM for:

- strict two-phase tasks;
- audit-first implementation planning;
- narrow implementation PRs after approval;
- code tasks where GitHub PR review is expected.

GLM must not start implementation during audit phase.

## Local/manual work

Use local/manual work for:

- reviewing screenshots;
- deciding visual quality;
- choosing whether civil loop feels good;
- merging/rejecting PRs;
- small docs adjustments;
- creating clear prompts.

## PR size policy

Target:

- 200–400 net code lines per PR where practical;
- one vertical slice;
- one main subsystem;
- small rollback.

Split if:

- more than one gameplay system is added;
- rendering and game rules change together without necessity;
- a design decision appears mid-PR;
- review would take too long;
- files exceed size guidance.

## PR body checklist

Every PR must include:

- Goal;
- Phaser skills read;
- Allowed files;
- Forbidden files;
- Acceptance checklist;
- Validation commands/results;
- Manual QA;
- Architecture decisions;
- Rollback plan;
- Out-of-scope list.

## Validation policy

Early project:

- PR1: typecheck + build + manual QA.
- PR2: add unit tests where useful.
- PR3: add minimal E2E when user flow exists.
- PR4+: expand tests only around real behavior.

Do not overtest visuals early.

## Manual QA policy

Every visual PR requires browser manual QA:

- boot app;
- check console;
- check terrain/assets;
- check camera;
- check object grounding/alignment;
- check the specific user flow;
- report what was observed.

## Anti-patterns

Reject immediately:

- copied old source code;
- Canvas renderer;
- renderer bridge;
- old `GameWorld` recreation;
- hidden feature flags for architecture alternatives;
- “temporary” placeholders that become permanent;
- broad PRs;
- architecture decisions buried in implementation;
- tests that protect bad architecture;
- agent hallucinated Phaser APIs.

## Failure handling

If a task fails twice:

1. stop;
2. write root cause;
3. choose a new approach;
4. do not repeat the same patch.
