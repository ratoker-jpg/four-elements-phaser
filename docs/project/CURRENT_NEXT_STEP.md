# CURRENT_NEXT_STEP.md

Status: Core Mechanics Roadmap and System Audit accepted / implementation pending  
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
  Recommended first PR: 01a — Localization infrastructure + MainMenuScene + NewGameSetupScene.

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
MECHANICS_INTAKE_2026_06_03.md — owner input captured
MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md — exploratory reference only, not accepted scope
MECHANICS_DECISIONS_2026_06_03.md — accepted mechanics decisions
CORE_MECHANICS_ROADMAP_2026_06_03.md — accepted 8-step roadmap
CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md — accepted implementation/system audit
ASSET_USAGE_PERMISSION_STATUS_2026_06_03.md — TankViewer permission status / pipeline boundary
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
- assign STEP 01H+ first implementation PR
- review open PRs
- docs cleanup directly supporting Core Mechanics implementation
```

Forbidden by default:

```text
- starting implementation without Denis/GPT task assignment
- continuing Arena features by inertia
- adding unaccepted mechanics from exploratory audit
- starting bot/strategic AI/waves/enemy economy without separate roadmap/audit
- visual/world-space work without CAMERA_PROJECTION_CONTRACT.md
- drawing ground markers/range/selection/shadows as top-down screen circles
- starting TankViewer asset pipeline without separate pipeline audit
- committing raw TankViewer source assets without explicit separate task
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

---

## Recommended first implementation PR

```text
STEP 01H+ / PR 01a — Localization infrastructure + MainMenuScene + NewGameSetupScene
```

Expected scope:

```text
- create localization infrastructure
- Russian labels for MainMenuScene
- Russian labels for NewGameSetupScene
- restructure NewGameSetupScene flow: mode -> map size -> faction -> start
- hide Sand Classic / Map 1 / mapStyle from Standard mode UX
- keep Debug/Arena access where explicitly allowed
```

Implementation must follow:

```text
- docs/project/MECHANICS_DECISIONS_2026_06_03.md
- docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
- docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
- docs/project/CAMERA_PROJECTION_CONTRACT.md when visual/world-space rules are relevant
```

Validation for implementation PRs:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```
