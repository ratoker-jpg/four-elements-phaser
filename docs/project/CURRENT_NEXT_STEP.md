# CURRENT_NEXT_STEP.md

Status: SKIRMISH-P3 — T1 factory composer
Project: Four Elements Phaser
Updated: 2026-07-10

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current status

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

## Default next work

1. Audit the complete structured production path from factory UI to queue item and spawned `ModularCombatUnit`:
   - `UnitProductionRequest` and legacy `ProducibleUnitType` compatibility;
   - component cost and time configuration;
   - queue serialization and cancellation;
   - spawn placement and deterministic IDs;
   - modular renderer inputs.
2. Define one config-driven T1 component catalog for Wasp, Hunter, Smoky and Railgun. Do not scatter matter, element or time constants across UI and production code.
3. Implement pure additive composition helpers:
   - unit matter cost = hull matter + turret matter;
   - unit element cost = hull element units + turret element units;
   - production time = max(hull time, turret time) + assembly offset;
   - legal combinations are Wasp/Hunter × Smoky/Railgun only.
4. Replace the fixed Wasp + Smoky production action with independent hull and turret selection while keeping Builder and Harvester available.
5. Add a modular preview derived from the selected body, weapon and modification fields. Do not create combined hull × turret sprites.
6. Show the selected combination, additive cost, production time and queue progress in Russian. Rejections must clearly explain missing factory, resources, capacity or invalid selection.
7. Preserve structured requests through queueing, save/load and spawn. Migrate old `wasp-smoky` queue items to the canonical request.
8. Add focused tests for all four combinations, calculation, queue persistence, cancellation/refund behavior and renderer inputs.

## Acceptance gate

All four legal T1 hull/turret combinations must be produced through structured requests, preserve separate hull and turret fields, render correctly and remain backward-compatible with Builder, Harvester and legacy Wasp + Smoky queue items.

Split the phase into reviewable slices if needed: first establish component configuration and pure production calculation, then wire the factory composer, preview and queue presentation.

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

- Produce two combat units in Normal Game, issue movement and attack commands and confirm they can fight, take damage and be removed after destruction.
- Confirm Smoky fires on cooldown and Railgun waits for its wind-up before damage is applied.
- Save and reload produced combat units during movement and combat; confirm ownership, HP, target and cooldown state remain coherent.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

## Not next by default

- Multi-team economy, mirrored map generation or strategic AI before their roadmap phases.
- Headquarters damage, victory/defeat flow or elimination cleanup.
- Full M0–M3 XP progression and upgrade purchase flow.
- T2/T3 content or additional hulls and turrets beyond the accepted T1 roster.
- Broad renderer, HUD or GameScene rewrite unrelated to the composer.
- Full modular asset preload or a combined hull × turret sprite matrix.
- Unrelated fix for issue #305 inside SKIRMISH-P3.
