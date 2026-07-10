# CURRENT_NEXT_STEP.md

Status: SKIRMISH-P4 — Multi-team match state
Project: Four Elements Phaser
Updated: 2026-07-10

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current status

<!-- PROJECT_STATUS:START -->
Updated: 2026-07-10

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 4: Multi-team match state
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #346 — Two-layer modular preview for the factory composer
Next: Introduce canonical TeamState and MatchState data with four factions, independent economy, unit cap, tech tier, vision, controller and ownership fields, then migrate the existing single-team state and saves without cross-team resource mutation.
Gate: Four teams must coexist in one canonical match state with independent resources, ownership and vision; mutating or producing for one team must not change another team, and existing single-team saves must migrate deterministically.
```
<!-- PROJECT_STATUS:END -->

## Default next work

1. Audit every global single-team assumption before changing behavior:
   - top-level `playerFaction`, `economy`, `vision`, `hqPosition` and `production`;
   - ownership of HQ, buildings, construction sites, Builders, Harvesters and combat units;
   - save/load, summaries, unit-cap selectors, fog and production mutation paths.
2. Define canonical pure data contracts:
   - `TeamController = human | ai`;
   - independent AI difficulty per enemy team;
   - `TeamState` with faction, economy, unit cap, tech tier, vision, HQ reference, controller and elimination state;
   - `MatchState` with four stable team IDs, player team ID and match clock/state.
3. Add explicit ownership fields to structures and civil/combat units. Ownership must use stable team IDs or a single accepted faction-derived key, not implicit `playerFaction` checks.
4. Create a deterministic migration from the current single-team `GameState`:
   - preserve the current player economy, entities, queues and vision in the human team;
   - create the other three team records without inventing map entities yet;
   - keep temporary compatibility selectors for existing single-team systems while Phase 4 is split across PRs.
5. Move resource, cap, tech and vision selectors behind owner-aware helpers. New code must never mutate another team through a top-level global reference.
6. Bump and migrate the save schema only when the canonical data contract is stable. Old saves must load into the same deterministic human team.
7. Add invariants and tests:
   - exactly four unique factions and team IDs;
   - exactly one human team;
   - independent economy and vision objects;
   - owner references resolve;
   - mutation/production for one team leaves all other teams byte-equivalent.
8. Keep this first slice data-focused. Rendering four bases, mirrored map generation, civil AI and strategic AI belong to later phases.

## Acceptance gate

Four teams must coexist in one canonical match state with independent resources, ownership and vision; mutating or producing for one team must not change another team, and existing single-team saves must migrate deterministically.

Prefer reviewable slices: P4A establishes contracts and migration; P4B routes economy/production/ownership selectors; P4C removes obsolete global assumptions after all call sites are owner-aware.

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

- Select a completed units-factory and verify Wasp/Hunter and Smoky/Railgun can be selected independently in the active HUD.
- Confirm all four T1 combinations show the correct Russian quote, production time and two-layer modular preview.
- Queue and cancel combat, Builder and Harvester orders at the selected factory; verify progress and resources remain coherent.
- Produce two combat units, fight, save and reload; confirm movement, HP, target and cooldown state remain coherent.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

## Not next by default

- Symmetric four-corner map generation; that is Phase 5.
- Running four civil economies and replacement AI; that is Phase 6.
- Builder-local site search; that is Phase 7.
- Strategic AI, squads, victory/defeat or XP progression.
- Removing all compatibility fields in the first data-model PR.
- Broad renderer or HUD rewrites unrelated to team ownership.
- Unrelated issue #305 work inside SKIRMISH-P4.
