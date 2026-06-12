# CURRENT_NEXT_STEP.md

Status: A2 merged — strong model experiment next  
Project: Four Elements Phaser  
Date: 2026-06-12

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Codex/Claude do next by default?
```

---

## Current answer

```text
Core Mechanics Roadmap: CLOSED / IMPLEMENTED.
Core Mechanics System Audit: CLOSED / IMPLEMENTED.

Current active process:
- Use the accepted fix backlog and accepted fix backlog audit.
- Do not reopen old roadmap queues by inertia.
- A2 map cleanup is merged/accepted.
- Next planned step is the controlled strong-model experiment: EXPERIMENT-OPUS-B1B2-01.
```

Active source docs for this process:

```text
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md
docs/project/STRONG_MODEL_EXPERIMENTS_2026_06_12.md
```

Do not start implementation without explicit Denis/GPT task assignment and the active accepted backlog/audit/experiment docs.

---

## Owner-selected sequence

Denis selected this planning and implementation sequence before returning to visual/runtime bugfix implementation:

```text
1. AI execution workflow docs PR.                                      DONE
2. CODEMAP docs PR.                                                    DONE
3. Collect current bug/polish findings into a scoped fix roadmap.       DONE
4. Run GLM audit on that fix roadmap/backlog.                           DONE
5. Record accepted audit decisions in docs.                             DONE
6. A2: Debug mode map cleanup / keep Sand Classic.                      DONE
7. Record strong-model experiment policy.                               CURRENT DOCS STEP
8. EXPERIMENT-OPUS-B1B2-01: B1+B2 bundled implementation test.          NEXT AFTER DOCS
9. C1: Turret rest / target-lock behavior.                              AFTER B1+B2 ACCEPTED
10. C2: Arena body/weapon inspection controls.                          AFTER C1 OR NEXT BUNDLE DECISION
```

Important:

```text
This does not reopen closed roadmaps by inertia.
This is a scoped fix roadmap/backlog process for current bugs/polish.
Claude/Opus and Codex are reserved for high-value code implementation, not routine audits.
GLM remains useful for low-cost audits, patch application, validation, PR delivery, and Telegram notification.
```

---

## Accepted fix backlog docs

Current accepted fix backlog:

```text
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
```

Accepted audit / implementation sequence:

```text
docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md
```

Strong-model experiment plan:

```text
docs/project/STRONG_MODEL_EXPERIMENTS_2026_06_12.md
```

Base accepted sequence from the audit:

```text
A2 — Debug mode map cleanup / keep Sand Classic                 DONE
B1 — Arena placement center alignment
B2 — Arena body + weapon visual calibration
C1 — Turret rest / target-lock behavior
C2 — Arena body/weapon inspection controls
D  — Dev grid overlay deferred unless Sand Classic is insufficient
```

Experiment override after A2:

```text
Run EXPERIMENT-OPUS-B1B2-01:
- bundle B1 + B2 into one controlled High+ strong-model implementation test;
- primary executor: Claude/Opus 4.8;
- alternative executor: Codex GPT-5.5;
- GLM: patch apply / validation / PR delivery only if needed.
```

Dependency rule:

```text
Do not start B2-style visual calibration without first resolving the B1 placement baseline.
In the experiment, B1 must be completed first as an internal checkpoint before B2 work continues.
Do not start C1/C2 inside the B1+B2 experiment.
```

---

## Immediate next task

```text
DOCS-STRONG-MODEL-EXPERIMENTS-01 — Record strong-model experiment policy
```

Executor:

```text
GPT / docs-only PR
```

After this docs PR is merged, the next implementation task is:

```text
EXPERIMENT-OPUS-B1B2-01 — Arena placement center alignment + body/weapon visual calibration
```

Recommended primary executor:

```text
Claude/Opus 4.8
```

Alternative executor:

```text
Codex GPT-5.5
```

---

## Active mode

```text
FIX BACKLOG AUDIT ACCEPTED.
A2 MAP CLEANUP COMPLETE.
STRONG MODEL EXPERIMENT POLICY IS BEING RECORDED.
NO C1/C2 IMPLEMENTATION UNTIL B1+B2 RESULT IS REVIEWED.
```

Allowed immediate work:

```text
- finish/merge the docs-only strong model experiment PR
- prepare EXPERIMENT-OPUS-B1B2-01 prompt after docs merge
- review open PRs, if any
- manual QA of real menu routes and Sand Classic availability
```

Do not start by default:

```text
- C1 turret behavior before B1+B2 is accepted
- C2 inspection controls before C1 or an explicit new bundle decision
- Arena save/load/waves/strategic AI without a new roadmap/audit
- production visual/world-space work outside the accepted fix backlog
- TankViewer/final asset pipeline without a separate pipeline audit
- economy/progression/victory systems without a new roadmap/audit
- burning Claude/Opus or Codex limits on routine audit/PR delivery work
```

---

## Strong-model experiment gates

For `EXPERIMENT-OPUS-B1B2-01`, the executor must follow internal checkpoints:

```text
1. Diagnose B1 first.
2. Fix B1 placement center alignment first.
3. Stop if B1 causes Wasp placement regression.
4. Continue to B2 only after the coordinate baseline is coherent.
5. Stop and recommend split if the diff becomes too broad.
6. Do not implement C1/C2.
```

Acceptance requires:

```text
- reviewable diff
- no forbidden systems touched
- npm run typecheck
- npm run test
- npm run build
- npm run qa:smoke
- manual QA through real menu flows
- Sand Classic placement/calibration check
- GPT PR review
- Denis visual acceptance before merge
```

If the experiment fails:

```text
Revert to separate B1 -> B2 -> C1 -> C2 implementation steps.
```

If it succeeds:

```text
Allow larger High+ bundles for Claude/Opus and Codex experiments, still with strict checkpoints and merge gates.
```

---

## Validation baseline for future implementation PRs

Future implementation PRs should keep using:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

If any command cannot run, the PR body must state why.

Visual/runtime PRs also need:

```text
- preview URL
- GPT PR review
- Denis visual QA before merge
```

---

## Required source docs for future planning

Before new roadmap/task work, read:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md
docs/project/CODEMAP.md
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md
docs/project/STRONG_MODEL_EXPERIMENTS_2026_06_12.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```
