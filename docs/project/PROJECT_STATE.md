# PROJECT_STATE.md

Status: generated active operational state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-07-10

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current mode

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

## Current baseline

- RTS Foundation roadmap/audit accepted via PR #322.
- Validation baseline closed via PR #324.
- Canonical multi-unit combat production and save/load fixup closed via PR #325.
- Playable Four-Faction Skirmish roadmap accepted via PR #338.
- Skirmish Phase 1 bounded destruction lifecycle closed via PR #339.
- Produced combat units use `GameState.combatUnits` as canonical state; render data is derived.
- Full Validation, QA Smoke, Graphify and asset-budget checks are available in GitHub Actions.
- Number keys 1–9 recall control groups; Ctrl+1–9 assigns them.

## Validation baseline

| Check | Result |
|---|---|
| TypeScript | PASS |
| Tests | PASS (5286 tests / 113 files) |
| Build | PASS (GitHub Validation) |
| QA smoke | PASS (GitHub QA Smoke) |
| Dependency audit | PASS (0 high-severity vulnerabilities) |
| Asset budget | PASS |

## Manual QA still required

- Destroy an Arena tank and confirm the live modular model disappears immediately, followed by a short explosion, fading wreck and full removal after 1.8 seconds.
- Confirm destroyed Arena tanks cannot be selected or assigned as targets and no longer retain tile reservations.
- Produce two combat units in Normal mode and confirm both appear independently.
- Save and reload with produced combat units; confirm visibility and unit cap remain correct.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

Automated checks do not replace visual acceptance for produced-unit rendering, destruction effects and save/load behavior.

## Active follow-ups

- Issue #305: calibrate Smoky muzzle origin on Wasp hull only.
- Issue #330: complete manual visual QA for produced combat units in Normal mode.
- Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.
- Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.
- Implement SKIRMISH-P2: production combat movement, orders, targeting, damage and persistence in Normal Game.

## Current source-of-truth documents

1. `AGENTS.md`
2. `docs/project/project-status.json`
3. `docs/project/PROJECT_STATE.md`
4. `docs/project/CURRENT_NEXT_STEP.md`
5. `docs/project/PLAYABLE_FOUR_FACTION_SKIRMISH_ROADMAP_2026_07_10.md`
6. `docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md`
7. `docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md`
8. `docs/project/CAMERA_PROJECTION_CONTRACT.md`

The Playable Four-Faction Skirmish roadmap is the active implementation queue. Historical closure details remain in the older roadmap, audit and closure documents.

## Non-negotiable architecture

- Phaser 4.1.0, strict TypeScript, Vite, WebGL-only.
- Fixed isometric/axonometric 2.5D camera; camera rotation is forbidden.
- Hull and turret remain separate assets with socket/pivot metadata.
- Do not create a combined hull × turret sprite matrix.
- Modular assets load on demand; do not preload the full matrix.
- Produced combat units are canonical in `combatUnits`; render data is derived.
- Do not create a third combat runtime or copy `BlockoutVehicleState` wholesale into Normal Game.
- Reuse/extract pure Arena movement, aiming, range, hit and damage systems.
- Do not restore legacy Wasp preload, offset tuner, dual renderer or legacy GameWorld.

## Stop rules

Stop and correct the task if:

- active docs disagree with `project-status.json`;
- work follows the old RTS Foundation phase queue instead of the active Skirmish roadmap;
- Normal Game combat creates a parallel state source instead of extending canonical `combatUnits`;
- visual/world-space work ignores `CAMERA_PROJECTION_CONTRACT.md`;
- unrelated work changes economy, map generation, save/load or renderer lifecycle;
- a PR claims manual visual QA that was not performed;
- required GitHub checks are red or absent.
