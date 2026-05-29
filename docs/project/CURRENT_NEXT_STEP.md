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
```

`docs/project/VISUAL_ROADMAP.md` is the accepted planning direction.

The previous Phase 2 roadmap (sand-terrain-focused) is archived. See:

```text
docs/project/archive/PHASE_2_ROADMAP.md
docs/project/archive/PHASE_2_ROADMAP_AUDIT.md
```

Do not follow `PHASE_2_ROADMAP.md` or `PHASE_2_ROADMAP_AUDIT.md` as active direction. They are historical reference only.

---

## Current next step

```text
VISUAL-AUDIT-01 — Visual audit/design
```

This is Phase V1 from the VISUAL roadmap. The audit must produce `docs/project/VISUAL_AUDIT_01.md` that determines:

1. Current visual state of each layer
2. What Phaser 4 can support for the industrial biome target
3. Asset pipeline for new industrial terrain/platform
4. Renderer changes needed (if any)
5. Map frame / grounded presentation approach
6. HUD redesign plan
7. Implementation sequence for remaining VISUAL phases
8. Risks and stop conditions

Do not start implementation of any VISUAL phase before the audit is accepted.

---

## Immediate implementation queue

From VISUAL roadmap:

```text
1. VISUAL-AUDIT-01 — Visual audit/design (docs only, no runtime)
2. VISUAL-PROTO-01 — Map direction prototype (visual candidates, no runtime integration)
3. VISUAL-TERRAIN-01 — Terrain/platform integration (requires V1 + V2)
4. VISUAL-FRAME-01 — Map frame / grounded presentation (requires V3)
5. VISUAL-START-01 — Start position and map composition (requires V3)
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
docs/project/PROJECT_STATE.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

---

## Obsolete guidance

Previous references to DOCS-P2-00, MENU-01 as the first Phase 2 implementation task, or the Phase 2 implementation sequence from PR #98 are superseded by the VISUAL roadmap direction.

The sand terrain pipeline (TERRAIN-01, TERRAIN-02, TERRAIN-FIX-01) is paused. The MAPLIFE-01 desert decor direction is rejected.
