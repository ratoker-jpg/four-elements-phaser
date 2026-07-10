# CURRENT_NEXT_STEP.md

Status: SKIRMISH-P2 — Production combat runtime in Normal Game  
Project: Four Elements Phaser  
Updated: 2026-07-10

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current status

<!-- PROJECT_STATUS:START -->
Updated: 2026-07-10

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 2: Production combat runtime in Normal Game
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #339 — Bounded combat destruction lifecycle
Next: Extend canonical GameState.combatUnits so factory-produced tanks can move, stop, acquire targets, attack, take damage and die in Normal Game using shared pure Arena combat systems.
Gate: Do not create a third combat-unit runtime or copy BlockoutVehicleState wholesale. Normal Game combatUnits remain canonical; Arena movement, aiming, range, hit and damage logic must be extracted or adapted as shared pure systems.
```
<!-- PROJECT_STATUS:END -->

## Default next work

1. Audit the existing `ArenaUnitComposer`, command-card integration and production request model as references.
2. Define the smallest usable Units Factory panel:
   - hull selection;
   - turret selection;
   - selected M-levels;
   - calculated cost/time preview;
   - queue and Produce action.
3. Keep the structured `UnitProductionRequest`; do not return to growing preset string unions.
4. Use the accepted modular model: hull separately, turret separately, socket/pivot metadata.
5. Obtain visual/interaction acceptance before merging a High+ UI implementation.

## Acceptance gate

Do not create a third combat-unit runtime or copy BlockoutVehicleState wholesale. Normal Game combatUnits remain canonical; Arena movement, aiming, range, hit and damage logic must be extracted or adapted as shared pure systems.

A design/audit PR may proceed. Runtime UI implementation should follow only after the interaction model is explicit enough to test.

## Required validation for implementation PRs

- `npm run check:project-status`
- `npm run typecheck`
- `npm test`
- `npm audit --audit-level=high`
- `npm run build`
- `npm run check:asset-budget`
- `npm run qa:smoke`
- `git diff --check`
- final GitHub Actions status

## Manual QA carried from Phase 2

- Destroy an Arena tank and confirm the live modular model disappears immediately, followed by a short explosion, fading wreck and full removal after 1.8 seconds.
- Confirm destroyed Arena tanks cannot be selected or assigned as targets and no longer retain tile reservations.
- Produce two combat units in Normal mode and confirm both appear independently.
- Save and reload with produced combat units; confirm visibility and unit cap remain correct.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

## Not next by default

- Enemy AI, waves or win/lose flow.
- Full M0–M3 balance pass.
- Mirrored map implementation before its roadmap phase.
- Broad renderer or GameScene lifecycle rewrite.
- Full modular asset preload.
- Reopening closed AoE4 UX work by inertia.
- Unrelated fix for issue #305 inside Phase 3.
