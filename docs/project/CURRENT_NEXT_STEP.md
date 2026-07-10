# CURRENT_NEXT_STEP.md

Status: RTS-FND-P2 — Unit Factory Combat Production Foundation
Project: Four Elements Phaser
Updated: 2026-06-22

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
Arena visual/combat fix PR #304 is MERGED and accepted by Denis manual QA.
AoE4-inspired UX redesign slice is CLOSED after PR #319.
FINAL_RTS_FOUNDATION roadmap + audit is MERGED via PR #322.
Phase 0 (Roadmap/Audit) is CLOSED.
Phase 1 (Validation Baseline / Red Gates) is CLOSED via PR #324.
Phase 2 (Unit Factory Combat Production Foundation) is ACTIVE.
Phase 3+ remains blocked until Phase 2 is merged/accepted.
```

Completed sequence leading to current state:

```text
#307 VISUAL-HUD-AUDIT → MERGED
#308 VISUAL-HUD-CORE-01-HIGHPLUS → MERGED
#309 VISUAL-COMMAND-PANEL-02-HIGHPLUS → MERGED
#310 VISUAL-MINIMAP-03-VERYHIGH → MERGED
#311 VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 → MERGED
#312 HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS → MERGED
#313 COMMAND-CARD-REBUILD-03-VERYHIGHPLUS → MERGED
#314 MINIMAP-INTERACTION-04-VERYHIGHPLUS → MERGED
#315 SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS → MERGED
#316 FEEDBACK-ALERTS-06-HIGHPLUS → MERGED
#317 FOG-VISION-AUDIT-07-HIGHPLUS-DOCS → MERGED
#318 FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS → MERGED
#319 AOE4-UX-POLISH-PASS-09-HIGHPLUS → MERGED
#322 FINAL-RTS-FOUNDATION-ROADMAP-AUDIT-01 → MERGED
#323 RTS-FND-P1A source-of-truth docs + baseline status → MERGED
#324 RTS-FND-P1 Validation Baseline Closure Pack → MERGED
```

---

## Active next step

```text
RTS-FND-P2 — Unit Factory Combat Production Foundation
  Size: High+
  Type: implementation
  Goal: Extend Units Factory to produce Wasp+Smoky M0 combat units.
  Status: IN REVIEW via PR; after merge, Phase 2 is DONE and next default step is Phase 3.
```

Phase 2 implementation scope:

```text
1. Production data model:
   - Extended ProducibleUnitType to include 'wasp-smoky'
   - Generalized ModularCombatUnit: bodyId/weaponId/mod/id fields
   - Added ModLevel type ('m0'|'m1'|'m2'|'m3')
   - Added combatUnits[] to GameState

2. Combat unit production config:
   - Used reserved constants: 45 matter, 10 element, 25000ms
   - No dynamic hull+turret cost calculation (Phase 3/6)

3. Units Factory queue:
   - startUnitProduction() accepts 'wasp-smoky'
   - Queue limit preserved (2)
   - Cancel and blocked reasons work for wasp-smoky

4. Production tick / completion:
   - processFactorySpawns() creates ModularCombatUnit on completion
   - Unit spawns near factory using existing spawn/occupancy
   - Combat units count toward DEFAULT_UNIT_CAP

5. UI / command entry point:
   - Added 'produce-wasp-smoky' command (key C)
   - Added buildingGrid() for factory context (Z=Builder, X=Harvester, C=Wasp+Smoky)
   - PlaytestHud button with Russian label
   - No full FactoryProductionPanel (Phase 3)

6. Rendering / assets:
   - Uses existing modular combat render path
   - No asset import or preload changes

7. Tests:
   - 11 new production tests for wasp-smoky
   - 18 test files updated with combatUnits in mock state
   - All 5264 tests pass
```

Default behavior:

```text
Do not start Phase 3+ until Phase 2 is merged/accepted.
```

---

## Validation baseline (updated 2026-06-22 — Phase 2)

| Command | Result | Details |
|---------|--------|---------|
| `npm run typecheck` | PASS | tsc --noEmit completed with no errors. |
| `npm test` | PASS (5264/5264) | All 107 test files pass. 11 new combat production tests added. |
| `npm run build` | FAIL (ENOSPC) | TypeScript compiles. Vite build fails: ENOSPC (4.7G assets, 9.9G disk). CI must confirm. |
| `npm run qa:smoke` | FAIL (ENOSPC) | Local disk constraint. CI must confirm. |
| `npm audit` | PASS | 0 vulnerabilities. |
| `git diff --check` | PASS | No whitespace errors. |

Key observations:

```text
- TypeScript type-checking is clean — no type errors.
- All 5264 tests pass including 11 new combat production tests.
- Build failure is local ENOSPC only — CI must confirm green.
- npm audit is clean — 0 vulnerabilities.
```

---

## What is not next by default

```text
- Do not start Phase 3 (hull/turret selection UI) until Phase 2 is merged/accepted.
- Do not continue AoE4 UX polish by inertia after #319.
- Do not start enemy AI without audit/design.
- Do not start economy/progression changes beyond Phase 1 scope.
- Do not start save/load hardening without audit/design.
- Do not reopen #308-#310 as final HUD direction.
- Do not copy AoE4 assets or exact layout.
- Do not assign number keys 1-9 to build commands. They are control groups.
- Do not merge High+ visual PRs without Denis manual visual approval.
- Do not touch #305 inside unrelated roadmap work.
- Do not touch modular vehicle runtime in Phase 1.
- Do not touch assets in Phase 1.
```

---

## Required validation for implementation PRs

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

If build/Playwright is blocked by disk space in GLM/Codex/Opus environment, report it honestly and check GitHub Actions directly.

---

## Manual QA gates for future visual implementation

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
- HUD/minimap/command layout approved by Denis before merge when touched.
```

---

## Still in force

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
- Do not rewrite RenderManager/GameScene lifecycle without a concrete bug or accepted audit.
- Do not continue closed roadmaps by inertia.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md
docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/GLM_EXECUTOR_RULES.md
```
