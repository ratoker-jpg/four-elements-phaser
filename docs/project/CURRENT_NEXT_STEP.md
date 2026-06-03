# CURRENT_NEXT_STEP.md

Status: Core Mechanics Roadmap accepted / system audit complete / implementation pending  
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
  docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md

Core Mechanics System Audit: ACCEPTED.
  docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md

Next action: STEP 01H+ implementation after Denis/GPT approval.
  Recommended first PR: 01a — Localization + MainMenu + NewGameSetup.

Do not start implementation without explicit Denis/GPT task assignment.
```

---

## Accepted direction

```text
Polish and deepen the current playable core mechanics baseline:
- Russian player-facing UX
- Industrial Platform only normal game flow
- Factions with identity
- Resources and map anchors
- Buildings / core economy loop
- Unified RTS controls
- Grid movement with physical feel
- Occupancy / collision / depth sorting
- Target-lock combat core
- Weapon mechanics (10 weapons, no Shaft)
- Body mechanics (7 bodies, armor, M0-M3)
- Animation / physical feel layer
```

---

## Completed planning cycle

```text
MECHANICS_INTAKE_2026_06_03.md    — owner input captured
MECHANICS_DECISIONS_2026_06_03.md  — accepted mechanics decisions
MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md — reference only, not accepted scope
CORE_MECHANICS_ROADMAP_2026_06_03.md — accepted 8-step roadmap
CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md — implementation audit
```

---

## Previously closed cycles

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
```

---

## Active mode

```text
CORE MECHANICS IMPLEMENTATION CYCLE.
Start STEP 01H+ only after Denis/GPT explicitly approves first implementation task.
```

Allowed immediate work:

```text
- review and merge CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
- assign STEP 01H+ first implementation PR
- review open PRs
```

Forbidden by default:

```text
- starting implementation without Denis/GPT task assignment
- continuing Arena features by inertia
- adding unaccepted mechanics from exploratory audit
- visual/world-space work without CAMERA_PROJECTION_CONTRACT.md
- drawing ground markers/range/selection/shadows as top-down screen circles
- starting TankViewer asset pipeline without separate pipeline audit
```

---

## Roadmap steps

```text
STEP 01H+ — UI / Localization / Start Flow / Faction Display
STEP 02H+ — Config and Data Model Foundation
STEP 03H+ — Industrial Map and Resource Layout
STEP 04H+ — Buildings and Core Economy Loop
STEP 05H+ — Unified RTS Controls and Command Routing
STEP 06H+ — Movement / Occupancy / Depth Sorting
STEP 07H+ — Combat Core / Targeting / Hit Model
STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel
```
