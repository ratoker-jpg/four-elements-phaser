# CURRENT_NEXT_STEP.md

Status: Core Mechanics implementation cycle closed — no active implementation roadmap  
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
- Pick the next product direction or fix/polish direction.
- Create/update roadmap/audit before code.
```

Do not start implementation without explicit Denis/GPT task assignment and an accepted roadmap/audit for the active direction.

---

## Owner-selected immediate sequence

Denis selected the following immediate docs/planning sequence before returning to visual/runtime bugfix implementation:

```text
1. AI execution workflow docs PR.
2. CODEMAP docs PR.
3. Collect current bug/polish findings into a scoped fix roadmap/backlog.
4. Run GLM audit on that fix roadmap/backlog.
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
DOCS/PLANNING SEQUENCE ACTIVE BEFORE NEXT BUGFIX IMPLEMENTATION.
```

Allowed immediate work:

```text
- review docs workflow PRs
- create CODEMAP.md
- collect bug/polish findings into a scoped fix roadmap/backlog
- prepare GLM audit for that fix roadmap/backlog
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

Pick one direction, then create a roadmap/audit before implementation:

```text
1. Core Mechanics manual QA + polish/fix backlog audit.
2. Normal Game player loop roadmap: onboarding, goals, victory/loss, progression.
3. Production visual/world-space roadmap using CAMERA_PROJECTION_CONTRACT.md.
4. Final asset integration roadmap for units/buildings/tanks.
5. Arena combat balance/readability roadmap.
```

Current owner-selected path is a variant of option 1:

```text
workflow docs -> CODEMAP -> fix roadmap/backlog -> GLM audit -> scoped High/High+ implementation steps
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
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

Closed references:

```text
docs/project/MECHANICS_DECISIONS_2026_06_03.md
docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
```

Closed references are context, not active implementation queues.
