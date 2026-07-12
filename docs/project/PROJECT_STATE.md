# PROJECT_STATE.md

Status: generated active operational state
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Updated: 2026-07-12

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current mode

<!-- PROJECT_STATUS:START -->
Updated: 2026-07-12

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 7: Builder-local automatic construction
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #360 — Four-team civil save/load and migration
Next: Replace Headquarters/building-anchor placement with an expanding-ring search around the selected Builder, validate footprint spacing and Builder reachability, assign that exact Builder, and preserve resources on every failed request.
Gate: Moving the selected Builder must change where the next building is constructed; the chosen site must be the nearest deterministic legal and reachable footprint within a bounded radius, with one empty tile between buildings, no resource charge on failure and clear Russian feedback.
```
<!-- PROJECT_STATUS:END -->

## Current baseline

- RTS Foundation roadmap/audit accepted via PR #322.
- Validation baseline closed via PR #324.
- Canonical multi-unit combat production and save/load fixup closed via PR #325.
- Playable Four-Faction Skirmish roadmap accepted via PR #338.
- Skirmish Phase 1 bounded destruction lifecycle closed via PR #339.
- Skirmish Phase 2A canonical movement, selection, occupancy and fog runtime closed via PR #341.
- Skirmish Phase 2B targeting, turret aiming, firing, damage and bounded wreck cleanup closed via PR #342.
- Skirmish Phase 3A config-driven T1 catalog and structured production closed via PR #344.
- Skirmish Phase 3B selectable factory composer in the active HUD closed via PR #345.
- Skirmish Phase 3C two-layer generated modular preview closed via PR #346.
- Skirmish Phase 4A canonical four-team state, ownership and save v5 migration closed via PR #348.
- Skirmish Phase 4B owner-aware selection, commands, construction and HUD selectors closed via PR #349.
- Skirmish Phase 4C owner-aware rendering, presentation and dev tools closed via PR #350.
- Skirmish Phase 5 activation and reviewable map slices established via PR #351.
- Skirmish Phase 5A canonical four-corner Headquarters closed via PR #352.
- Skirmish Phase 5B symmetric finite resources closed via PR #353.
- Skirmish Phase 5C canonical center Infinity contract closed via PR #354.
- Skirmish Phase 5D exits, reachability and structural fairness validation closed via PR #355.
- Skirmish Phase 6 activation established via PR #356.
- Skirmish Phase 6A deterministic four-team civil bootstrap closed via PR #357.
- Skirmish Phase 6B owner-isolated harvesting, processing, storage and power closed via PR #358.
- Skirmish Phase 6C deterministic civil destruction and AI replacement closed via PR #359.
- Skirmish Phase 6D save v6, civil migration and deterministic continuation closed via PR #360.
- Produced combat units use `GameState.combatUnits` as canonical state; render data is derived.
- Full Validation, QA Smoke, Graphify and asset-budget checks are available in GitHub Actions.
- Number keys 1–9 recall control groups; Ctrl+1–9 assigns them.

## Validation baseline

| Check | Result |
|---|---|
| TypeScript | PASS |
| Tests | PASS (full Vitest suite) |
| Build | PASS (GitHub Validation) |
| QA smoke | PASS (GitHub QA Smoke) |
| Dependency audit | PASS (0 high-severity vulnerabilities) |
| Asset budget | PASS |

## Manual QA still required

- Move one Builder away from Headquarters, select it and confirm the next building is placed near that Builder rather than the base.
- Select different Builders in different corners and confirm each build request uses the selected Builder and owner economy.
- Block every site inside the bounded radius and confirm no matter is deducted and Russian failure feedback is shown.
- Confirm completed buildings preserve one empty tile between footprints and Builders can physically reach the assigned site.
- Produce combat units, save and reload; confirm team ownership, factory preview, movement and HP remain coherent.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

Automated checks do not replace visual acceptance for produced-unit rendering, destruction effects and save/load behavior.

## Active follow-ups

- Issue #305: calibrate Smoky muzzle origin on Wasp hull only.
- Issue #330: complete manual visual QA for produced combat units in Normal mode.
- Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.
- Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.
- Implement SKIRMISH-P7: selected-Builder local search, reachability and exact assignment.

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
- Reuse or extract pure Arena movement, aiming, range, hit and damage systems.
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
