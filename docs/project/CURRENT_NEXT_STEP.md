# CURRENT_NEXT_STEP.md

Status: Fix backlog audit accepted — A2 map cleanup next  
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
- Start with A2: Debug mode map cleanup / keep Sand Classic.
- Do not start B1/B2/C1/C2 until prior dependencies are merged/accepted.
```

Active source docs for this process:

```text
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md
```

Do not start implementation without explicit Denis/GPT task assignment and the active accepted backlog/audit.

---

## Owner-selected immediate sequence

Denis selected this docs/planning sequence before returning to visual/runtime bugfix implementation:

```text
1. AI execution workflow docs PR.                                      DONE
2. CODEMAP docs PR.                                                    DONE
3. Collect current bug/polish findings into a scoped fix roadmap.       DONE
4. Run GLM audit on that fix roadmap/backlog.                           DONE
5. Record accepted audit decisions in docs.                             DONE
6. Start A2: Debug mode map cleanup / keep Sand Classic.                NEXT
7. Then B1: Arena placement center alignment.                           AFTER A2
8. Then B2: Arena body + weapon visual calibration.                     AFTER B1 + Denis QA
9. Then C1: Turret rest / target-lock behavior.                         AFTER B2
10. Then C2: Arena body/weapon inspection controls.                     AFTER C1
```

Important:

```text
This does not reopen closed roadmaps by inertia.
This creates a scoped fix roadmap/backlog process for current bugs/polish.
Claude/Opus and Codex should be reserved for high-value code implementation, not routine audits.
GLM can be used for low-cost audits, patch application, validation, PR delivery, and Telegram notification.
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

The accepted sequence is:

```text
A2 — Debug mode map cleanup / keep Sand Classic
B1 — Arena placement center alignment
B2 — Arena body + weapon visual calibration
C1 — Turret rest / target-lock behavior
C2 — Arena body/weapon inspection controls
D  — Dev grid overlay deferred unless Sand Classic is insufficient
```

Dependency rule:

```text
Do not start B2 before B1 is merged and Denis visually confirms placement on Sand Classic.
```

---

## Immediate next task

```text
FIX-A2-MAP-CLEANUP-01 — Debug mode map cleanup / keep Sand Classic
```

Executor:

```text
GLM
```

Reason:

```text
Low-risk config/UI cleanup. It does not need Claude/Opus or Codex limits.
```

Accepted decisions for A2:

```text
- Remove Map 1 / customMap1 from visible UI / MAP_LIST.
- Keep src/data/maps/customMap1.ts in the repo as fallback/reference.
- Keep Sand Classic / Песок visible as calibration map.
- Do not implement dev grid overlay.
- Do not touch renderers, Arena placement, turret/body/weapon logic, movement, combat, economy, assets, or dependencies.
```

---

## Active mode

```text
FIX BACKLOG AUDIT ACCEPTED.
A2 MAP CLEANUP IS NEXT.
NO B1/B2/C1/C2 IMPLEMENTATION UNTIL EXPLICITLY ASSIGNED.
```

Allowed immediate work:

```text
- implement/review A2 map cleanup
- review existing open PRs, if any
- manual QA of real menu routes and Sand Classic availability
- prepare task prompts for B1 only after A2 is merged/accepted
```

Do not start by default:

```text
- B1 placement fix before A2 is complete or explicitly skipped
- B2 body+weapon calibration before B1 is merged and Denis visually accepts placement
- C1 turret behavior before B2 is visually accepted
- C2 inspection controls before C1 is accepted
- Arena save/load/waves/strategic AI without a new roadmap/audit
- production visual/world-space work outside the accepted fix backlog
- TankViewer/final asset pipeline without a separate pipeline audit
- economy/progression/victory systems without a new roadmap/audit
- burning Claude/Opus or Codex limits on routine audit/PR delivery work
```

---

## Completed implementation checkpoints

```text
STEP 01H+ — COMPLETE
  PR #193 — CORE-STEP-01A: Localization infrastructure and setup flow
  PR #194 — CORE-STEP-01B: Russian UI labels and theme pass
  PR #195 — CORE-STEP-01C: Tooltips and DevTools separation

STEP 02H+ — COMPLETE
  PR #196 — CORE-STEP-02A: Weapon and body config data models
  PR #197 — CORE-STEP-02B: Faction resource and building config data models
  PR #198 — CORE-STEP-02C: Scaling helpers armor formula and config integration tests

STEP 03H+ — COMPLETE
  PR #199 — CORE-STEP-03A: Resource class runtime type and asset mapping
  PR #200 — CORE-STEP-03B: Anchor-based generated resource placement
  PR #202 — CORE-STEP-03C: Resource classes wired into harvesting and validation

STEP 04H+ — COMPLETE
  PR #203 — CORE-STEP-04H: Buildings and Core Economy Loop

STEP 05H+ — COMPLETE
  PR #204 — CORE-STEP-05H+: Unified RTS Controls and Command Routing

STEP 06H+ — COMPLETE
  PR #205 — CORE-STEP-06H+: Movement / Occupancy / Depth Sorting

STEP 07H+ — COMPLETE
  PR #206 — CORE-STEP-07H+: Combat Core / Targeting / Hit Model

STEP 08H+ — COMPLETE
  PR #207 — CORE-STEP-08H+: Weapons / Bodies / M0-M3 / Animation Feel
```

Closure report:

```text
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

---

## Closed roadmap steps

```text
STEP 01H+ — UI / Localization / Start Flow / Faction Display — COMPLETE
STEP 02H+ — Config and Data Model Foundation — COMPLETE
STEP 03H+ — Industrial Map and Resource Layout — COMPLETE
STEP 04H+ — Buildings and Core Economy Loop — COMPLETE
STEP 05H+ — Unified RTS Controls and Command Routing — COMPLETE
STEP 06H+ — Movement / Occupancy / Depth Sorting — COMPLETE
STEP 07H+ — Combat Core / Targeting / Hit Model — COMPLETE
STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel — COMPLETE
```

---

## Future planning options

Other future options remain available only after this bugfix/polish direction is paused or closed:

```text
1. Normal Game player loop roadmap: onboarding, goals, victory/loss, progression.
2. Production visual/world-space roadmap using CAMERA_PROJECTION_CONTRACT.md.
3. Final asset integration roadmap for units/buildings/tanks.
4. Arena combat balance/readability roadmap.
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
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```
