# CURRENT_NEXT_STEP.md

Status: Visual Roadmap selected after Arena visual/combat fix  
Project: Four Elements Phaser  
Updated: 2026-06-20 (post-#304 merge / Visual Roadmap activation)

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Current baseline

```text
Renderer unification Stage 1-4 is CLOSED.

#297 VEHICLE-RENDER-UNIFY-AUDIT
  Status: MERGED.
  Result: accepted 4-stage vehicle render unification roadmap.

#298 VEHICLE-RENDER-UNIFY-01-VH
  Status: MERGED.
  Result: Stage 1 + Stage 2 completed and manually QA-accepted by Denis.

#300 VEHICLE-RENDER-UNIFY-03-VH
  Status: MERGED.
  Result: Stage 3 completed and manually QA-accepted by Denis.

#302 VEHICLE-RENDER-UNIFY-04-VH
  Status: MERGED.
  Result: Stage 4 completed and manually QA-accepted by Denis.
  Scope completed:
    - RenderManager owns renderer construction, phased sync, visual bridges, and destroy;
    - GameScene keeps scene lifecycle, gameplay state, UI/menu callbacks, input, camera, placement, save/load;
    - renderer unification roadmap is not active work anymore.

#304 ARENA-VISUAL-COMBAT-FIX-01-HIGH
  Status: MERGED on 2026-06-20.
  Merge commit: f788dc16b8396319bfb6033838d98b025ac1dadb.
  Result: Arena visual/combat fix accepted by Denis manual QA with one explicit known follow-up.
  Accepted scope:
    - obstacle debug labels / geometry hidden from default view;
    - target-lock / enemy indicators gated behind debug flags;
    - friendly fire disabled for same-team allies;
    - modular hull-in-cell / selection-ring placement improved;
    - turret rest/aim direction split clarified;
    - most muzzle/VFX origins improved.

#305 Follow-up: calibrate Smoky muzzle origin on Wasp hull
  Status: OPEN follow-up issue.
  Scope: only Smoky muzzle origin on Wasp hull.
  Not a blocker for Visual Roadmap unless a task touches Wasp+Smoky muzzle/VFX.
```

---

## Active next step (single)

```text
VISUAL-AUDIT-01 / VISUAL-HUD-AUDIT
  Risk: Low for audit/design; Very High only when implementation starts.
  Type: docs/design first.
  Goal: design the next Visual Roadmap slice before runtime implementation.
  Primary target: HUD/minimap/command layout audit.

  Required output before implementation:
    - current HUD inventory;
    - target RTS HUD layout;
    - minimap design constraints;
    - selected-unit/building panel design;
    - command/actions/hotkey panel design;
    - implementation split;
    - manual visual approval gate.

  No runtime implementation in this step.
  No HUD code before GPT review + Denis visual approval.
```

---

## Visual Roadmap activation

Denis selected Visual Roadmap as the next direction after #304. The next work should start with audit/design, not code.

Recommended first slice:

```text
VISUAL-HUD-AUDIT
  Why first:
    - V7 HUD/minimap is one of the largest remaining visible gaps;
    - current PlaytestHud/debug-style UI does not match the target RTS layout;
    - HUD can be designed independently before touching terrain/assets.

  Target layout from Visual Roadmap:
    - bottom-left minimap;
    - bottom-center selected unit/building information;
    - bottom-right command/actions/hotkeys.
```

---

## What is not next by default

```text
- Do not continue renderer unification by inertia.
- Do not reopen #304 inside Visual Roadmap.
- Do not treat #305 as a Visual Roadmap blocker unless the task touches Wasp+Smoky muzzle/VFX.
- Do not start HUD runtime implementation before VISUAL-HUD-AUDIT is accepted.
- Do not start terrain runtime integration before a visual direction/design is accepted.
- Do not start new asset generation before an asset spec is accepted.
- Do not start menu background/civil unit refresh before the active Visual Roadmap slice is selected.
```

---

## Required validation for future implementation work

Minimum:

```text
npm run typecheck
npm test
npm run build
npm run qa:smoke
git diff --check
secret/token scan
GitHub Actions final status
```

If build/Playwright is blocked in GLM/Codex/Opus environment, report it honestly and check GitHub Actions directly.

---

## Manual QA gates for Visual Roadmap implementation

```text
- default game mode boots;
- devtools/Arena mode still boots;
- no default debug artifacts;
- no broken modular vehicles;
- no regression to #304 accepted Arena visuals;
- no silent cyan recolor;
- no full modular matrix preload;
- no old Wasp M0 preload;
- z-depth unchanged around units/buildings/resources unless explicitly in scope;
- HUD/minimap/command layout approved by Denis before merge.
```

---

## Still in force (rules)

```text
- Do not restore pilotVehicleLazyLoad or old Wasp M0 preload.
- Do not restore pilotTurretComposition.
- Do not restore ModularTankDebugOverlay / offset tuner.
- Do not preload the full modular matrix.
- Do not use a combined hull x turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
- Do not blindly reuse PR #296 mount-slot / forward-back drift model.
- Do not touch composeModularVehicle() placement/math without explicit Denis approval.
- Do not touch combat, movement, economy, pathfinding, save-load, bot/AI, or mapgen as part of Visual Roadmap/HUD work.
- Do not rewrite RenderManager/GameScene lifecycle without a concrete bug or accepted audit.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```
