# CURRENT_NEXT_STEP.md

Status: Fix backlog collection active — no implementation yet  
Project: Four Elements Phaser  
Date: 2026-06-12

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Codex do next by default?
```

---

## Current answer

```text
Core Mechanics Roadmap: CLOSED / IMPLEMENTED.
Core Mechanics System Audit: CLOSED / IMPLEMENTED.

Default next action:
- Do not start new implementation by inertia.
- Use the current fix backlog process for visual/Arena/debug bugs.
- Review/accept docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md.
- After that, run GLM audit on the fix backlog before code.
```

Do not start implementation without explicit Denis/GPT task assignment and an accepted roadmap/backlog + audit for the active direction.

---

## Owner-selected immediate sequence

Denis selected the following immediate docs/planning sequence before returning to visual/runtime bugfix implementation:

```text
1. AI execution workflow docs PR.                                      DONE
2. CODEMAP docs PR.                                                    DONE
3. Collect current bug/polish findings into a scoped fix roadmap/backlog. THIS STEP
4. Run GLM audit on that fix roadmap/backlog.                           NEXT AFTER ACCEPTANCE
5. Split the accepted audit into High / High+ implementation steps.
6. Implement steps through Claude/Opus or Codex depending on task type and available limits.
7. Use GLM mainly for patch application / validation / PR delivery when Claude cannot push.
8. GPT reviews PRs before merge recommendation.
9. Denis performs final visual/manual QA and decides merge/no-merge.
```

Important:

```text
This does not reopen closed roadmaps by inertia.
This creates a new scoped fix roadmap/backlog process for current bugs/polish.
Claude/Opus and Codex should be reserved for high-value code implementation, not routine audits.
GLM can be used for low-cost audits and PR delivery.
```

---

## Current fix backlog doc

Current draft/accepted fix backlog target:

```text
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
```

This backlog currently covers owner-reported visual/Arena/debug bugs and workflow corrections, including:

```text
- manual QA through real menus instead of query-flag-only acceptance;
- Debug / Отладка menu cleanup;
- Sand Classic kept as calibration map;
- Arena placement preview and center-of-cell clarity;
- body + weapon visual calibration;
- turret rest / target-lock behavior;
- Arena body/weapon inspection controls;
- dev grid overlay deferred while Sand Classic is sufficient.
```

Next after this backlog doc is accepted:

```text
Run GLM audit on docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md.
Do not implement yet.
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

## Active mode

```text
NO ACTIVE IMPLEMENTATION ROADMAP.
CORE MECHANICS CYCLE CLOSED.
FIX BACKLOG / GLM AUDIT SEQUENCE ACTIVE BEFORE NEXT BUGFIX IMPLEMENTATION.
```

Allowed immediate work:

```text
- review/merge fix backlog docs PR
- run GLM audit on the accepted fix backlog
- split accepted audit into High / High+ steps
- review existing open PRs, if any
- manual QA of closed cycles and current previews
```

Do not start by default:

```text
- more Core Mechanics implementation by inertia
- Arena save/load/waves/strategic AI without a new roadmap/audit
- production visual/world-space work without a new roadmap/audit or fix backlog audit
- TankViewer/final asset pipeline without a separate pipeline audit
- economy/progression/victory systems without a new roadmap/audit
- burning Claude/Opus or Codex limits on routine audit/PR delivery work
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

## Recommended next planning options

Current owner-selected path is:

```text
workflow docs -> CODEMAP -> fix roadmap/backlog -> GLM audit -> scoped High/High+ implementation steps
```

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

---

## Required source docs for future planning

Before new roadmap/task work, read:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md
docs/project/CODEMAP.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

For this current bugfix/polish direction, also read:

```text
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
```

Closed references:

```text
docs/project/MECHANICS_DECISIONS_2026_06_03.md
docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
```

Closed references are context, not active implementation queues.
