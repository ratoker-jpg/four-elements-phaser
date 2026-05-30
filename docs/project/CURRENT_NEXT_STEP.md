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
```

`docs/project/VISUAL_ROADMAP.md` is the accepted planning direction.
`docs/project/VISUAL_SYSTEM_AUDIT.md` is the accepted audit with staged PR sequence.
`docs/project/VISUAL_CANDIDATE_SUMMARY.md` contains the selected Candidate A direction.
`docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md` contains the accepted layered platform model.

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
VISUAL-03A — Runtime Layered Platform Prototype
```

Goal:

```text
Create a runtime/dev prototype of the accepted layered platform model:
background world
+ platform tile layer
+ mask/clip to arena center / playable diamond
+ arena frame overlay
+ optional debug grid
```

This is the next step because static PNG proof was not reliable:

```text
VISUAL-02C / PR #131 was closed and rejected.
It showed that trying to validate the tile-filled platform as one static proof image creates bad composition and misleading geometry.
The correct path is runtime layering with a mask/clip, not more static PNG tilefill proof attempts.
```

---

## What VISUAL-03A is allowed to do

```text
- create a dev/prototype runtime route or mode
- load approved/proof background/frame/tile assets into an isolated dev location if needed
- render separate Phaser layers:
  background
  tile layer
  frame overlay
  debug grid
- use a geometry mask or equivalent clip so tile layer does not visually spill outside the intended arena center
- keep gameplay logical grid unchanged
- document how to open and review the prototype
```

---

## What VISUAL-03A must NOT do

```text
- do not replace production terrain globally in the first PR
- do not change gameplay
- do not change pathfinding
- do not change economy
- do not change building placement
- do not change unit logic
- do not change save/load
- do not continue sand terrain as primary direction
- do not continue MAPLIFE #120 / desert decor
- do not use PR #131 as approved production art
- do not copy StarCraft assets/UI directly
- do not add new dependencies
- do not change Phaser version
```

---

## Immediate implementation queue

```text
1. VISUAL-03A — Runtime Layered Platform Prototype — current
2. VISUAL-03B — Production terrain/platform integration, only after 03A visual approval
3. VISUAL-04 — Map frame / grounded presentation production pass
4. VISUAL-05 — Lower-left start composition
5. VISUAL-06 — Resource field visual model design
6. VISUAL-07 — HUD layout design doc
7. VISUAL-08 — HUD shell implementation
8. VISUAL-09 — Command panel/hotkey visual pass
9. VISUAL-10 — Main menu visual refresh
10. VISUAL-11 — Harvester/builder visual workflow design
11. VISUAL-12 — Approved unit visual integration
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
