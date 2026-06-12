# STRONG_MODEL_EXPERIMENTS_2026_06_12.md

Status: ACTIVE EXPERIMENT PLAN  
Project: Four Elements Phaser  
Date: 2026-06-12

---

## Purpose

This document records how the project will experimentally use stronger coding agents after the accepted fix backlog audit.

The goal is to test whether Claude/Opus 4.8 and Codex GPT-5.5 can safely handle larger implementation bundles than GLM.

This does **not** replace the accepted fix backlog audit. Use this together with:

- `docs/project/CURRENT_NEXT_STEP.md`
- `docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md`
- `docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md`
- `docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md`
- `docs/project/CODEMAP.md`

---

## Baseline roles

```text
GPT = coordinator / task writer / PR reviewer
GLM = audit, simple config/docs, patch apply, validation, PR delivery, Telegram
Claude/Opus 4.8 = strong code executor; patch handoff if push is blocked
Codex GPT-5.5 = strong code executor; can push PRs; useful for screenshot-driven visual QA
Denis = final manual / visual QA and merge decision
```

GLM remains useful, but should not be used for high-risk renderer/behavior implementation when Claude/Opus or Codex is available.

---

## Experiment rule

After `A2 — FIX-A2-MAP-CLEANUP-01` is merged and accepted, run one strong-model bundle experiment:

```text
EXPERIMENT-OPUS-B1B2-01
```

Goal:

```text
Test whether Claude/Opus 4.8 can safely handle a bundled High+ implementation package.
```

Bundle:

```text
B1 — Arena placement center alignment
B2 — Arena body + weapon visual calibration
```

Executor routing:

```text
Primary: Claude/Opus 4.8
Alternative: Codex GPT-5.5
GLM: patch apply / validation / PR delivery only if needed
```

---

## Why B1 + B2 is the first bundle

B1 and B2 are coordinate/visual calibration tasks:

- B1 fixes the spawn/preview coordinate baseline.
- B2 calibrates body + weapon visuals on top of that baseline.

They are related enough to test a stronger model's ability to reason across connected renderer/placement systems.

Do **not** bundle B2 with C1 as the first experiment.

Reason:

```text
B2 = renderer / visual calibration
C1 = behavior / target-lock / combat-adjacent state
```

If B2 and C1 are bundled and the result fails, it will be too hard to tell whether the issue is render, state, command routing, or behavior.

---

## Internal checkpoint rules for the bundle

The strong model must treat B1+B2 as one task with internal checkpoints, not as an uncontrolled broad rewrite.

Required checkpoints:

1. Read the active docs and CODEMAP.
2. Diagnose B1 before editing B2.
3. Fix B1 first.
4. Verify that placement preview and final spawn share the same coordinate baseline.
5. Only then continue to B2.
6. If B1 causes a Wasp placement regression, stop and report; do not continue to B2.
7. If the diff becomes too broad to review cleanly, stop and recommend splitting into B1 and B2 PRs.
8. Do not start C1/C2.

---

## Hard boundaries for EXPERIMENT-OPUS-B1B2-01

Allowed focus:

```text
- Arena placement preview / spawn center alignment
- body + weapon visual calibration
- turret visibility / attachment / visual depth
- targeted renderer or asset-key/preload changes only if justified
```

Forbidden unless explicitly approved:

```text
- C1 turret rest / target-lock behavior
- combat damage / hit model / weapon fire behavior
- movement / pathfinding / occupancy rewrites
- economy / save-load / bot / strategic AI
- generated hull PNG edits
- full hull/turret matrix preload
- broad map generation changes
- new gameplay features outside the accepted fix backlog
```

Do not change Wasp generated hull offsets casually. If the B1 spawn-center fix requires any visual offset follow-up, isolate it, explain it, and require Denis visual QA.

---

## Acceptance criteria

The experiment is accepted only if:

- the diff remains reviewable;
- forbidden systems are not touched;
- validation passes:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `npm run qa:smoke`
- manual QA uses real menu flows, not query-only links:
  - Standard
  - Debug / Отладка
  - Arena / Арена
- Sand Classic is used for placement/calibration checks;
- GPT review accepts the PR scope;
- Denis visually accepts the preview before merge.

---

## If the experiment fails

If Opus 4.8 fails the B1+B2 bundle, or the result is too broad/fragile:

```text
Revert to separate implementation steps:
B1 → B2 → C1 → C2
```

Do not keep retrying the same broad bundle more than twice.

After two failed attempts, change approach:

- split B1 and B2;
- use Codex as visual/screenshot-driven executor;
- or request a fresh audit focused only on the failing area.

---

## If the experiment succeeds

If Opus 4.8 handles B1+B2 cleanly:

- allow larger High+ bundles for Claude/Opus and Codex experiments;
- still require internal checkpoints;
- still keep merge gates strict;
- still do not let GLM implement high-risk renderer/behavior bundles.

Possible next bundle candidate after success:

```text
C1 + C2
```

But do not bundle C1+C2 until B1+B2 is accepted and merged.

---

## Recommended next action

After A2 is merged and accepted:

```text
Prepare EXPERIMENT-OPUS-B1B2-01 prompt.
```

Do not start the experiment until Denis explicitly says to proceed.
