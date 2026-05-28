# CURRENT_NEXT_STEP.md

Status: active next-step checkpoint  
Project: Four Elements Phaser  
Date: 2026-05-29

---

## Why this file exists

This short checkpoint prevents confusion about the current operational workstream.

Use `PROJECT_STATE.md` as the primary operational source of truth.

---

## Current source of truth

Phase 2 is active after:

```text
PR #97 — DOCS-P2-ROADMAP
PR #98 — PHASE-2-ROADMAP-AUDIT
```

`PHASE_2_ROADMAP_AUDIT.md` is the accepted audit gate for Phase 2 implementation.

Do not use PR #96 / `FULL_PROJECT_AUDIT_20260529.md` as active baseline. PR #96 was not merged and was superseded by the Phase 2 direction.

---

## Current next step

```text
DOCS-P2-00 — update project docs for Phase 2
```

This file is part of DOCS-P2-00.

After DOCS-P2-00 is merged, the next implementation task is:

```text
MENU-01 — Main menu mode selection via controlled URL launch
```

Accepted model from PR #98:

```text
Standard → start normally
Debug → reload with ?devtools=1
Arena → reload with ?devtools=1&arena=1
```

MENU-01 must not implement late-loading. Late-loading is MENU-02.

---

## Immediate implementation queue

From PR #98:

```text
1. MENU-01 — Main menu mode selection via controlled URL launch
2. LOADING-01 — Proper loading screen
3. HUD-01 — Legacy HUD removal + HUD consolidation
4. TERRAIN-01 — Sand terrain visual system
5. BASE-ANCHOR-01 — HQ/building grounding and footprint alignment
```

Important:

- `TERRAIN-01` must not generate final production PNG assets inside the implementation PR.
- `ASSET-WORKFLOW-01` must be accepted before unit regeneration tasks.
- `FOG-01`, `WEAPON-WORKFLOW-01`, and `VISUAL-SPIKE-01` are not immediate implementation tasks.

---

## Read before any Phase 2 task

```text
docs/project/PROJECT_STATE.md
docs/project/PHASE_2_ROADMAP.md
docs/project/PHASE_2_ROADMAP_AUDIT.md
docs/project/NEW_CHAT_HANDOFF.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/GPT_WORKFLOW.md
```

---

## Obsolete guidance

Previous references to ARCH-02 or ARCH-11A as active next work are obsolete.

ARCH-11A completed in PR #95.
