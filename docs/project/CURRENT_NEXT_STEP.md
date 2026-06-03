# CURRENT_NEXT_STEP.md

Status: Core Mechanics implementation active — STEP 03C next  
Project: Four Elements Phaser  
Date: 2026-06-03

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Codex do next by default?
```

---

## Current answer

```text
Core Mechanics Roadmap: ACCEPTED.
Core Mechanics System Audit: ACCEPTED.

Completed:
- STEP 01H+ — UI / Localization / Start Flow / Faction Display
- STEP 02H+ — Config and Data Model Foundation
- CORE-STEP-03A — Resource class runtime type and asset mapping
- CORE-STEP-03B — Anchor-based generated resource placement

Next action after Denis/GPT approval:
- CORE-STEP-03C — Harvester 6-class gathering + UI display + map validation update

Do not start implementation without explicit Denis/GPT task assignment.
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

STEP 03H+ — IN PROGRESS
  PR #199 — CORE-STEP-03A: Resource class runtime type and asset mapping
  PR #200 — CORE-STEP-03B: Anchor-based generated resource placement
  Next: CORE-STEP-03C
```

---

## Active mode

```text
CORE MECHANICS IMPLEMENTATION CYCLE.
Current focus: finish STEP 03H+.
Next implementation slice: CORE-STEP-03C only after Denis/GPT approval.
```

Allowed immediate work:

```text
- review docs PR updating handoff/current-next-step
- prepare or assign CORE-STEP-03C
- review open implementation PRs
- docs cleanup directly supporting Core Mechanics implementation
```

Do not start by default:

```text
- STEP 04 before STEP 03C is complete
- Arena features by inertia
- bot/strategic AI/waves/enemy economy without separate roadmap/audit
- TankViewer asset pipeline without separate pipeline audit
```

---

## Roadmap steps

```text
STEP 01H+ — UI / Localization / Start Flow / Faction Display — COMPLETE
STEP 02H+ — Config and Data Model Foundation — COMPLETE
STEP 03H+ — Industrial Map and Resource Layout — IN PROGRESS
STEP 04H+ — Buildings and Core Economy Loop
STEP 05H+ — Unified RTS Controls and Command Routing
STEP 06H+ — Movement / Occupancy / Depth Sorting
STEP 07H+ — Combat Core / Targeting / Hit Model
STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel
```

---

## Recommended next implementation PR

```text
CORE-STEP-03C — Harvester 6-class gathering + UI display + map validation update
```

Expected scope:

```text
- move generated resource runtime amounts from legacy type to resourceClass where resourceClass exists
- keep legacy fallback for old/saved resources without resourceClass
- update map validation for missing/invalid generated resourceClass
- update player-facing resource display where in scope to use Russian resource class names
- keep anchor placement from PR #200 intact
- keep legacy type populated for compatibility
```

Implementation must follow:

```text
- docs/project/MECHANICS_DECISIONS_2026_06_03.md
- docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
- docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
- docs/project/CAMERA_PROJECTION_CONTRACT.md when visual/world-space rules are relevant
- docs/project/NEW_CHAT_HANDOFF_CORE_STEP_03C_2026_06_03.md
```

Validation for implementation PRs:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```
