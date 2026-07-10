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
PLAYABLE FOUR-FACTION SKIRMISH — Phase 3: T1 factory composer
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #342 — Normal Game targeting, firing and damage runtime
Next: Implement a config-driven T1 factory composer that independently selects Wasp or Hunter and Smoky or Railgun, calculates additive cost and production time, previews the modular tank and queues a structured production request.
Gate: All four legal T1 hull/turret combinations must be produced through structured requests, preserve separate hull and turret fields, render correctly and remain backward-compatible with Builder, Harvester and legacy Wasp + Smoky queue items.
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

- Produce two combat units in Normal Game, issue movement and attack commands and confirm they can fight, take damage and be removed after destruction.
- Confirm Smoky fires on cooldown and Railgun waits for its wind-up before damage is applied.
- Save and reload produced combat units during movement and combat; confirm ownership, HP, target and cooldown state remain coherent.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

Automated checks do not replace visual acceptance for produced-unit rendering, destruction effects and save/load behavior.

## Active follow-ups

- Issue #305: calibrate Smoky muzzle origin on Wasp hull only.
- Issue #330: complete manual visual QA for produced combat units in Normal mode.
- Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.
- Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.
- Implement SKIRMISH-P3: config-driven T1 hull/turret composer, modular preview, structured queue display and all four legal combinations.

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
