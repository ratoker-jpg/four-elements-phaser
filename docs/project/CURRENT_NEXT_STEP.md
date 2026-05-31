# CURRENT_NEXT_STEP.md

Status: active next-step checkpoint  
Project: Four Elements Phaser  
Date: 2026-06-01

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
VISUAL-06F — QA polish for resource readability, placement/origin, scale
```

Alternative:

```text
Post-VISUAL-05A QA polish backlog
```

Reason:

```text
VISUAL-06A/06B/06B1 are COMPLETE (PR #150, #151, #152).
VISUAL-06C approved resource assets are added (PR #153, merged).
VISUAL-06D wires assets into preload/manifest behind resourceStyle flag (PR #154, merged).
VISUAL-06E renders industrial resources behind resourceStyle flag (PR #155, merged).
VISUAL-06E fixup resolves resourceStyle from mapStyle so industrial maps use industrial resources by default (current PR).
VISUAL-06F will address QA polish for readability, scale, and origin adjustments.
```

VISUAL-05A PR sequence (all DONE):

```text
PR 1 — Parameterize dev preview to 96/128/192 and camera pan/zoom — DONE (PR #144)
PR 2 — Production terrain/platform assets behind mapStyle flag — DONE (PR #145)
PR 3 — Production frame/background layer — DONE (PR #146)
PR 4 — Lower-left HQ/camera/resource composition — DONE (PR #147)
PR 5 — Make industrial map default for new games — DONE (PR #148)
```

---

## What VISUAL-05A is allowed to do

VISUAL-05A is COMPLETE. This section is retained for reference only.

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

VISUAL-05A is COMPLETE. This section is retained for reference only.

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

## VISUAL-05A completion status

```text
- VISUAL-05A production industrial map integration is COMPLETE.
- PR #144, #145, #146, #147, #148 are all merged/done.
- Industrial generated map is now the default for new games.
- mapStyle 'industrial' and 'sand' both remain available.
- Sand/fixed/custom map paths remain as fallback/reference.
- HQ/start/resources are now lower-left for industrial generated maps.
- Frame/background/walls are connected in production for industrial.
- Save/load compatibility is preserved: old saves load as saved.
- Current production small map is still 32×32 (not yet migrated to 96×96).
```

---

## VISUAL-06 guardrails

Before VISUAL-06 implementation, resource work must have an approved asset/model contract.

VISUAL-06 initial PR should be docs/design only unless a task explicitly scopes candidate review assets.

Do NOT implement resource visual changes until:
- Resource visual model/contract is approved by project owner
- Candidate resource visuals are reviewed and accepted
- Implementation scope is explicitly defined in an approved task

VISUAL-06 must NOT:

```text
- replace production resource assets without approved visual direction
- change resource gameplay mechanics
- change resource amounts or economy values
- change depletion logic
- change pathfinding or occupancy
- migrate production map sizes to 96/128/192
- silently change any gameplay behavior
```

VISUAL-06 may (with explicit task scope):

```text
- produce resource visual candidate images for review
- write resource visual model design document
- define resource visual contract (sizes, variants, naming)
- plan implementation PR sequence for resource visual integration
```

---

## Immediate implementation queue

```text
1. VISUAL-05A PR 1 — Parameterize dev preview to 96/128/192 — DONE (PR #144)
2. VISUAL-05A PR 2 — Production terrain behind mapStyle flag — DONE (PR #145)
3. VISUAL-05A PR 3 — Production frame/background layer — DONE (PR #146)
4. VISUAL-05A PR 4 — Lower-left HQ/camera/resource composition — DONE (PR #147)
5. VISUAL-05A PR 5 — Make industrial map default after QA — DONE (PR #148)
6. VISUAL-06A — Resource field visual model (docs/design) — DONE (PR #150)
7. VISUAL-06B — Resource candidate asset review — DONE (PR #151)
8. VISUAL-06B1 — Resource model pivot: 1x1 richness tiers + 2x2 infinite — DONE (PR #152)
9. VISUAL-06C — Approved resource assets added to repo — DONE (PR #153)
10. VISUAL-06D — Preload/manifest wiring behind resourceStyle flag — DONE (PR #154)
11. VISUAL-06E — Render industrial resources behind resourceStyle — DONE (PR #155, merged)
11b. VISUAL-06E fixup — Resolve resourceStyle from mapStyle — current PR
12. VISUAL-06F — QA polish if readability issues — after 06E fixup
13. VISUAL-07 — HUD layout design doc
14. VISUAL-08 — HUD shell implementation
15. VISUAL-09 — Command panel/hotkey visual pass
16. VISUAL-10 — Main menu visual refresh
17. VISUAL-11 — Harvester/builder visual workflow design
18. VISUAL-12 — Approved unit visual integration
```

VISUAL-05A sequence is COMPLETE (PR #144–#148 all merged).
Proposed next work: VISUAL-06 (resource field visual model) or post-VISUAL-05A QA polish backlog.

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
docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md
docs/project/PROJECT_STATE.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

---

## Obsolete guidance

Previous references to DOCS-P2-00, MENU-01 as the first Phase 2 implementation task, the Phase 2 implementation sequence from PR #98, sand terrain as the primary direction, or MAPLIFE desert decor are superseded by the VISUAL roadmap direction.
