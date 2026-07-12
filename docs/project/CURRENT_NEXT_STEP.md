# CURRENT_NEXT_STEP.md

Status: SKIRMISH-P8 — Headquarters combat, elimination and match result
Project: Four Elements Phaser
Updated: 2026-07-12

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current status

<!-- PROJECT_STATUS:START -->
Updated: 2026-07-12

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 8: Headquarters combat, elimination and match result
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #362 — Selected-Builder local automatic construction
Next: Introduce canonical Headquarters durability and target IDs, route production combat attacks against enemy Headquarters, eliminate teams on HQ destruction, then expose deterministic victory/defeat state and a restart-with-same-seed result flow.
Gate: Every canonical Headquarters must be targetable, damageable and persistable; destroying one must eliminate only its owner team and disable that team's production/replacement logic; losing the human HQ must produce Defeat and destroying all three enemy HQs must produce Victory.
```
<!-- PROJECT_STATUS:END -->

## Default next work

1. Establish canonical Headquarters combat state as P8A:
   - give every canonical Headquarters a stable target ID, HP, max HP, armor and destruction timestamps;
   - migrate legacy maps/saves without inventing duplicate Headquarters;
   - keep `mapData.hq` as the selected-human compatibility alias only;
   - persist damaged and destroyed Headquarters deterministically.
2. Extend production combat targeting as P8B:
   - resolve combat-unit and Headquarters targets through one target abstraction;
   - path and range calculations use Headquarters 3x3 footprints;
   - reject friendly, missing, destroyed and eliminated targets;
   - apply damage, cooldown, muzzle feedback and target cleanup consistently.
3. Apply team elimination transactionally:
   - mark the owner team eliminated once when its Headquarters reaches zero HP;
   - stop that team's factories, queues and civil replacement policy;
   - disable or clean remaining owned units through bounded transitions;
   - keep other teams and economies unaffected.
4. Complete match result and UX as P8C:
   - human Headquarters destroyed means Defeat;
   - all three enemy Headquarters destroyed means Victory;
   - freeze new human commands after result;
   - expose one deterministic result overlay and restart with the same seed/setup;
   - preserve result state through save/load.
5. Add pure-state, integration and browser coverage:
   - partial HQ damage and save/load;
   - single-team elimination isolation;
   - victory and defeat exactly once;
   - post-elimination production/AI rejection;
   - restart retains the same generated-map seed.
6. Keep this phase match-result focused. Faction bonuses, XP/M0-M3 and strategic AI remain later phases.

## Acceptance gate

Every canonical Headquarters must be targetable, damageable and persistable; destroying one must eliminate only its owner team and disable that team's production/replacement logic; losing the human HQ must produce Defeat and destroying all three enemy HQs must produce Victory.

Prefer reviewable slices: P8A establishes Headquarters state and damage; P8B connects combat targeting and elimination; P8C closes result UX, persistence and the phase.

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

- Attack each enemy Headquarters with produced tanks and confirm HP, damage feedback and owner faction remain correct.
- Destroy one enemy Headquarters and confirm only that team stops production and civil replacement while other teams continue.
- Destroy all three enemy Headquarters and confirm Victory appears once with restart using the same seed.
- Destroy the human Headquarters and confirm Defeat appears once and gameplay commands stop.
- Save and load before and after an HQ is damaged/eliminated and confirm HP, eliminated teams and match result persist.
- Move a selected Builder and confirm construction still starts locally after the Phase 8 changes.
- Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.

## Not next by default

- Faction bonuses; that is Phase 9.
- XP and independent M0-M3 upgrades; that is Phase 10.
- Strategic combat AI; that is Phase 11.
- Broad terrain, obstacle or asset changes unrelated to Headquarters combat/result flow.
- Unrelated issue #305 work inside SKIRMISH-P8.
