# CURRENT_NEXT_STEP.md

Status: Player Integration roadmap accepted / full implementation audit next  
Project: Four Elements Phaser  
Date: 2026-06-07

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
Arena Sandbox Roadmap: CLOSED / IMPLEMENTED.
Hull sprite asset integration: MERGED.
Turret sprite runtime integration: MERGED.
Hull visual profile fixup: MERGED.
Player Integration roadmap: ACCEPTED.

Current next direction:
PLAYER-INTEGRATION-MVP.

Source roadmap:
docs/project/PLAYER_INTEGRATION_ROADMAP_2026_06_07.md
```

Default next action:

```text
Run the required full roadmap implementation audit:
PIM-IMPLEMENTATION-AUDIT-01 — Full implementation audit for all Player Integration High/High+ steps.

Goal:
Audit how to implement every accepted roadmap step before any implementation starts.
The audit must cover Tracks A-J, exact implementation order, files/functions, dependencies, risks, validation, manual QA, and where GLM / Codex / Blender or local asset analysis may be needed.
```

Do not start implementation yet.

---

## Active roadmap execution model

Use this flow:

```text
1. Roadmap accepted.
2. One detailed implementation audit across ALL roadmap steps.
3. GPT/Denis review and accept the audit as the implementation sequence.
4. Implement Step 1.
5. Review PR.
6. Merge.
7. Implement Step 2.
8. Continue sequentially.
```

Do not use this as the default roadmap flow:

```text
step audit -> implementation -> next step audit -> implementation
```

Per-step audit is allowed only if a later implementation step exposes a new unknown blocker not covered by the full roadmap implementation audit.

---

## Active roadmap rule

```text
All active implementation steps in PLAYER-INTEGRATION-MVP are High or High+.
Lower-priority ideas are backlog only.
```

Hard block:

```text
No enemy bot / strategic AI / base-building AI in this roadmap.
```

---

## Required source docs for future planning/tasks

Before new roadmap/task work, read:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
docs/project/UNIT_ASSET_PIPELINE_ROADMAP_2026_06_04.md
docs/project/NEW_CHAT_HANDOFF_HULL_ASSETS_2026_06_06.md
docs/project/PLAYER_INTEGRATION_ROADMAP_2026_06_07.md
```

For Arena/core mechanics context, also read:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
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

HULL-ASSET — COMPLETE
  PR #220 — ASSET: add generated hull sprite matrix
  PR #221 — HULL-ASSET-01: integrate generated hull sprite runtime loader
  PR #222 — HULL-ASSET-01-FIXUP: show generated hull sprites in Arena
  PR #230 — HULL-VISUAL-FIXUP-02: per-hull visual profiles for generated hull sprites

TURRET-ASSET — COMPLETE FOR ARENA RUNTIME BASELINE
  PR #224 — ASSET-TURRET-01: add generated turret sprite matrix
  PR #225 — ASSET-TURRET-02: fix turret direction labels
  PR #226 — RUNTIME-TURRET-01: generated turret asset registry
  PR #228 — RUNTIME-TURRET-02: show generated turret sprites in Arena
```

---

## Do not start by default

```text
- implementation before PIM-IMPLEMENTATION-AUDIT-01 is accepted;
- more Core Mechanics implementation by inertia;
- broad Arena feature work outside PLAYER-INTEGRATION-MVP;
- enemy bot / strategic AI;
- preloading all generated hull/turret frames at startup;
- combat VFX before asset visibility, factory, movement feel and HUD MVP are usable;
- fog/territory/minimap before the core player-facing tank loop is visible.
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

Asset-related PRs should also run when applicable:

```text
node tools/validate_hull_assets.mjs
node tools/validate_turret_assets.mjs
```

If any command cannot run, the PR body must state why.
