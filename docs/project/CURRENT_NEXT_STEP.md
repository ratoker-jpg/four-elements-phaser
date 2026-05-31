# CURRENT_NEXT_STEP.md

Status: active next-step checkpoint  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## Why this file exists

This short checkpoint prevents confusion about the current operational workstream.

Use `PROJECT_STATE.md` as the primary operational source of truth.

---

## Current source of truth

VISUAL roadmap is the active planning direction after:

```text
VISUAL-ROADMAP-01 — Archive old roadmap and add new Visual Roadmap
VISUAL-AUDIT-01 — Full visual system audit and implementation plan
VISUAL-01 — Industrial map visual direction candidates
VISUAL-01B — Layered Platform Frame Direction checkpoint
VISUAL-01C — Tile visual balancing proof
VISUAL-02A — Dev-only layered platform preview
VISUAL-02B — Exact 2:1 frame geometry proof
VISUAL-02C — Closed/rejected static PNG proof
VISUAL-03A through VISUAL-04F — Runtime modular frame prototypes and PNG assets
```

`docs/project/VISUAL_ROADMAP.md` is the accepted planning direction.
`docs/project/VISUAL_SYSTEM_AUDIT.md` is the accepted audit with staged PR sequence.
`docs/project/VISUAL_CANDIDATE_SUMMARY.md` contains the selected Candidate A direction.
`docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md` contains the accepted layered platform model.
`docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md` contains the production integration plan.

The previous Phase 2 roadmap, sand terrain as primary direction, and MAPLIFE desert decor are archived/rejected.

---

## Current roadmap model

```text
roadmap first → huge roadmap audit second → implementation after audit
```

Implementation tasks covered by `VISUAL_SYSTEM_AUDIT.md` can proceed without a new mini-audit if they stay in scope.

Stop and request approval if a task:

```text
- expands scope beyond VISUAL_SYSTEM_AUDIT
- touches gameplay/pathfinding/economy unexpectedly
- combines multiple VISUAL phases into one PR
- changes visual direction away from industrial platform / mining battlefield
```

---

## Current next step

```text
VISUAL-05A PR 2 — Production terrain/platform assets behind mapStyle flag
```

Goal:

```text
Add industrial terrain rendering to production behind a mapStyle flag.
When mapStyle === 'industrial', the terrain uses WeightedTilePicker for
deterministic industrial tile distribution. When mapStyle === 'sand',
existing sand terrain behavior is unchanged. Default is 'sand'.
```

The full integration plan is documented in:

```text
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md
```

PR sequence (from the plan):

```text
PR 1 — Parameterize dev preview to 96/128/192 and camera pan/zoom — DONE (PR #144 merged)
PR 2 — Production terrain/platform assets behind mapStyle flag — CURRENT
PR 3 — Production frame/background layer
PR 4 — Lower-left HQ/camera/resource composition
PR 5 — Make industrial map default for new games after QA
```

Production map sizes:

```text
Small:  96×96 playable,  98×98 outer
Medium: 128×128 playable, 130×130 outer
Large:  192×192 playable, 194×194 outer
```

---

## What VISUAL-05A is allowed to do

```text
- create production integration code behind feature flag or mapStyle config
- extend the ?visual04a dev preview to support larger map sizes
- modify TerrainRenderer or create IndustrialTerrainRenderer
- add frame border rendering to the production renderer
- add background/world layer to the production renderer
- move HQ to lower-left start zone
- adjust camera start and bounds
- update starter resource placement relative to new HQ position
- update NewGameSetupScene with new size options and map style
- update tests that assert HQ at (4, 4)
- each PR in the sequence must be independently reviewable and mergeable
```

---

## What VISUAL-05A must NOT do

```text
- do not change economy values or resource amounts
- do not change pathfinding or occupancy logic
- do not change the isometric coordinate system
- do not break save/load compatibility without version field
- do not remove sand terrain code/assets (keep as fallback)
- do not continue sand terrain as primary direction
- do not continue MAPLIFE #120 / desert decor
- do not change gameplay mechanics
- do not add new dependencies
- do not change Phaser version
- do not mix multiple PRs into one
```

---

## Immediate implementation queue

```text
1. VISUAL-05A PR 1 — Parameterize dev preview to 96/128/192 — DONE (PR #144)
2. VISUAL-05A PR 2 — Production terrain behind mapStyle flag — current
3. VISUAL-05A PR 3 — Production frame/background layer
4. VISUAL-05A PR 4 — Lower-left HQ/camera/resource composition
5. VISUAL-05A PR 5 — Make industrial map default after QA
6. VISUAL-06 — Resource field visual model design
7. VISUAL-07 — HUD layout design doc
8. VISUAL-08 — HUD shell implementation
9. VISUAL-09 — Command panel/hotkey visual pass
10. VISUAL-10 — Main menu visual refresh
11. VISUAL-11 — Harvester/builder visual workflow design
12. VISUAL-12 — Approved unit visual integration
```

Previously listed Phase 2 tasks are already completed/merged — see `PROJECT_STATE.md` "Completed foundation" section.

Still needed, not yet started:

```text
FOG-01 — Two-layer fog of war (design + implementation)
ARENA-01 — Arena mode from menu
```

These can proceed in parallel only where they do not conflict with VISUAL work.

---

## Read before any VISUAL task

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/VISUAL_CANDIDATE_SUMMARY.md
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
docs/project/PROJECT_STATE.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

---

## Obsolete guidance

Previous references to DOCS-P2-00, MENU-01 as the first Phase 2 implementation task, the Phase 2 implementation sequence from PR #98, sand terrain as the primary direction, or MAPLIFE desert decor are superseded by the VISUAL roadmap direction.
