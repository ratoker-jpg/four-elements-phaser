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
```

`docs/project/VISUAL_ROADMAP.md` is the accepted planning direction.
`docs/project/VISUAL_SYSTEM_AUDIT.md` is the accepted audit with staged PR sequence (VISUAL-01 through VISUAL-12).
`docs/project/VISUAL_CANDIDATE_SUMMARY.md` contains the selected Candidate A direction.

The previous Phase 2 roadmap (sand-terrain-focused) is archived. See:

```text
docs/project/archive/PHASE_2_ROADMAP.md
docs/project/archive/PHASE_2_ROADMAP_AUDIT.md
```

Do not follow `PHASE_2_ROADMAP.md` or `PHASE_2_ROADMAP_AUDIT.md` as active direction. They are historical reference only.

### Current roadmap model

```text
roadmap first → huge roadmap audit second → implementation after audit
```

Implementation tasks covered by VISUAL_SYSTEM_AUDIT.md can proceed without a new mini-audit. If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.

---

## Current next step

```text
VISUAL-01B — Layered Platform Frame Direction checkpoint
```

VISUAL-01 selected the industrial map direction:

```text
Primary direction: Candidate A — Heavy Mining Platform
Allowed enrichment: selected Candidate C elements only as secondary detail
Rejected as primary: Candidate B — visible grid risk
```

Follow-up visual exploration changed the practical map rendering approach:

```text
Accepted visual model:
background world + tile-filled platform center + arena frame overlay + invisible grid
```

This must be documented before VISUAL-02 implementation begins. See:

```text
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
```

Do not start VISUAL-02 until VISUAL-01B is reviewed and accepted.

---

## Immediate implementation queue

From VISUAL roadmap with current checkpoint inserted:

```text
1. VISUAL-01 — Industrial map visual candidate workflow — done / PR #125 merged
2. VISUAL-01B — Layered Platform Frame Direction checkpoint — current
3. VISUAL-02A — Layered Platform Frame Prototype (dev-only preview)
4. VISUAL-03 — Industrial terrain/platform integration (requires approved V1/V1B + V2 proof)
5. VISUAL-04 — Map frame / grounded presentation (production stage after V3)
6. VISUAL-05 — Lower-left start composition (requires V3)
7. VISUAL-06 — Resource field visual model design
8. VISUAL-07 — HUD layout design doc
9. VISUAL-08 — HUD shell implementation
10. VISUAL-09 — Command panel/hotkey visual pass
11. VISUAL-10 — Main menu visual refresh
12. VISUAL-11 — Harvester/builder visual workflow design
13. VISUAL-12 — Approved unit visual integration
```

Previously listed Phase 2 tasks (MENU-01, LOADING-01, HOTKEYS-01, BASE-ANCHOR-01) are already completed/merged — see `PROJECT_STATE.md` "Completed foundation" section.

Still needed (not yet started):

```text
FOG-01 — Two-layer fog of war (design + implementation)
ARENA-01 — Arena mode from menu
```

These can proceed in parallel with VISUAL phases where they do not conflict.

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

Previous references to DOCS-P2-00, MENU-01 as the first Phase 2 implementation task, or the Phase 2 implementation sequence from PR #98 are superseded by the VISUAL roadmap direction.

The sand terrain pipeline (TERRAIN-01, TERRAIN-02, TERRAIN-FIX-01) is paused. The MAPLIFE-01 desert decor direction is rejected.
