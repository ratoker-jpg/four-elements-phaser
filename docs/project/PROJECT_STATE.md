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
RTS FOUNDATION — Phase 3: Hull + turret selection UI/model
Status: READY_FOR_DESIGN
Last merged: PR #329 — Production, save/load and unit-cap lifecycle
Next: Define and accept the minimal Units Factory hull/turret selection panel and its production request flow before implementation.
Gate: Do not start Phase 3 implementation until the factory panel interaction model is accepted. Do not begin Enemy AI.
```
<!-- PROJECT_STATUS:END -->

## Current baseline

- Phase 0 roadmap/audit: closed via PR #322.
- Phase 1 validation baseline: closed via PR #324.
- Phase 2 canonical multi-unit combat production: closed via PR #329.
- Produced combat units use `GameState.combatUnits` as canonical state.
- Full Validation, QA Smoke, Graphify and asset-budget checks are available in GitHub Actions.
- Number keys 1–9 recall control groups; Ctrl+1–9 assigns them.

## Validation baseline

| Check | Result |
|---|---|
| TypeScript | PASS |
| Tests | PASS (5261 tests / 110 files) |
| Build | PASS (GitHub Validation) |
| QA smoke | PASS (GitHub QA Smoke) |
| Dependency audit | PASS (0 high-severity vulnerabilities) |
| Asset budget | PASS |

## Manual QA still required

- Produce two combat units in Normal mode and confirm both appear independently.
- Save and reload with produced combat units; confirm visibility and unit cap remain correct.
- Confirm builder and harvester production still work after Phase 2 changes.

Automated checks do not replace visual acceptance for produced-unit rendering and save/load behavior.

## Active follow-ups

- Issue #305: calibrate Smoky muzzle origin on Wasp hull only.
- Issue #330: complete manual visual QA for produced combat units in Normal mode.
- Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.

## Current source-of-truth documents

1. `AGENTS.md`
2. `docs/project/project-status.json`
3. `docs/project/PROJECT_STATE.md`
4. `docs/project/CURRENT_NEXT_STEP.md`
5. `docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md`
6. `docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md`
7. `docs/project/CAMERA_PROJECTION_CONTRACT.md`

Historical closure details belong in roadmap, audit and closure documents, not in this active state file.

## Non-negotiable architecture

- Phaser 4.1.0, strict TypeScript, Vite, WebGL-only.
- Fixed isometric/axonometric 2.5D camera; camera rotation is forbidden.
- Hull and turret remain separate assets with socket/pivot metadata.
- Do not create a combined hull × turret sprite matrix.
- Modular assets load on demand; do not preload the full matrix.
- Produced combat units are canonical in `combatUnits`; render data is derived.
- Do not restore legacy Wasp preload, offset tuner, dual renderer or legacy GameWorld.

## Stop rules

Stop and correct the task if:

- active docs disagree with `project-status.json`;
- the selected phase lacks an accepted design where one is required;
- visual/world-space work ignores `CAMERA_PROJECTION_CONTRACT.md`;
- unrelated work changes combat, economy, map generation, save/load or renderer lifecycle;
- a PR claims manual visual QA that was not performed;
- required GitHub checks are red or absent.
