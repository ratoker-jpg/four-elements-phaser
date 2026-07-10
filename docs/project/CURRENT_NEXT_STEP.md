# CURRENT_NEXT_STEP.md

Status: RTS-FND-P3 — Hull + turret selection UI/model  
Project: Four Elements Phaser  
Updated: 2026-07-10

> Generated from `docs/project/project-status.json`. Run `npm run sync:project-status` after changing status.

---

## Current status

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

Do not start Phase 3 implementation until the factory panel interaction model is accepted. Do not begin Enemy AI.

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

- Produce two combat units in Normal mode and confirm both appear independently.
- Save and reload with produced combat units; confirm visibility and unit cap remain correct.
- Confirm builder and harvester production still work after Phase 2 changes.

## Not next by default

- Enemy AI, waves or win/lose flow.
- Full M0–M3 balance pass.
- Mirrored map implementation before its roadmap phase.
- Broad renderer or GameScene lifecycle rewrite.
- Full modular asset preload.
- Reopening closed AoE4 UX work by inertia.
- Unrelated fix for issue #305 inside Phase 3.
