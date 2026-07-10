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

1. Audit the exact boundary between canonical `GameState.combatUnits` and Arena-only `blockoutVehicles`:
   - movement and tile reservation;
   - turret aiming;
   - weapon range and cooldown;
   - hit and armor calculation;
   - damage attribution and destruction;
   - input, selection and command routing;
   - save/load migration.
2. Define the smallest backward-compatible Normal Game combat runtime fields on `ModularCombatUnit` or composed child state:
   - fractional tile position;
   - HP and max HP;
   - move/stop order;
   - current target;
   - weapon cooldown;
   - destroyed state.
3. Extract or adapt pure shared helpers from Arena. Do not import Phaser or copy the complete `BlockoutVehicleState` into production state.
4. Implement movement and stop commands for factory-produced combat units before attack behavior.
5. Add target acquisition, turret aiming, firing, damage and bounded destruction using the shared combat formulas.
6. Keep `CombatUnitRenderer` as a derived view of canonical state and update it from fractional position and facing.
7. Migrate old saves with safe defaults and preserve deterministic IDs.
8. Add focused lifecycle tests and one end-to-end state test: `produce → move → target → damage → destroy → save/load`.

## Acceptance gate

Do not create a third combat-unit runtime or copy BlockoutVehicleState wholesale. Normal Game combatUnits remain canonical; Arena movement, aiming, range, hit and damage logic must be extracted or adapted as shared pure systems.

The phase should be split into reviewable PRs. The first implementation PR establishes canonical runtime state and move/stop lifecycle without strategic AI, multi-team economy or the factory composer.

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

## Manual QA carried forward

- Destroy an Arena tank and confirm the live modular model disappears immediately, followed by a short explosion, fading wreck and full removal after 1.8 seconds.
- Confirm destroyed Arena tanks cannot be selected or assigned as targets and no longer retain tile reservations.
- Produce two combat units in Normal mode and confirm both appear independently.
- Save and reload with produced combat units; confirm visibility and unit cap remain correct.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

## Not next by default

- Strategic Enemy AI, scouting, economy planning or win/lose flow.
- Four-team state or mirrored four-corner map before their roadmap phases.
- Factory hull/turret composer before the Normal Game combat runtime is functional.
- Full M0–M3 XP progression.
- Broad renderer or GameScene lifecycle rewrite.
- Full modular asset preload.
- Reopening closed AoE4 UX work by inertia.
- Unrelated fix for issue #305 inside SKIRMISH-P2.
