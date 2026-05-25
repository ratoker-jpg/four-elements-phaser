# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Current mode

Implementation — scoped technical PRs under accepted roadmap.

Workflow docs and roadmap direction are accepted (PR #31 — ARCH-00-docs).

The temporary BUILD-ANCHOR workstream under ARCH-03 is now complete enough to stop and return to the main roadmap order.

---

## Current priority

ARCH-01 — Economy baseline.

Goal:

- Port/fix the accepted civil economy baseline from `four-elements-next` into Phaser.
- Keep the work scoped and implementation-focused.
- Do not redesign the economy unless a roadmap/design change is explicitly accepted.

Expected first step:

```text
ARCH-01A — scoped economy baseline audit/design or first implementation PR,
depending on how much current state/code inspection is needed.
```

Before preparing the next GLM task, GPT must read:

- `docs/project/START_HERE_FOR_GPT.md`
- `docs/project/GPT_WORKFLOW.md`
- `docs/project/PROJECT_STATE.md`
- `docs/ROADMAP.md`
- `docs/ROADMAP_SYSTEM_AUDIT.md`

For economy tasking, also inspect the relevant current state files before writing a prompt.

---

## Accepted workflow

The project follows a system-first workflow defined in:

- `docs/project/START_HERE_FOR_GPT.md` — entry point for GPT agent.
- `docs/project/GPT_WORKFLOW.md` — GPT planner workflow rules.
- `docs/project/GLM_EXECUTOR_RULES.md` — GLM executor rules.
- `docs/ROADMAP.md` — 21-ARCH roadmap with scoped PR sequences.
- `docs/ROADMAP_SYSTEM_AUDIT.md` — roadmap system audit.

Core rule:

```text
roadmap -> audit/design -> scoped PR sequence -> implementation
```

---

## Recently completed ARCH-03 building placement work

The ARCH-03 building PNG placement sequence was completed before returning to ARCH-01 because the renderer needed a systemic metadata-driven placement path and PR #28 had been closed as manual-tuning based.

Recent important PRs:

- PR #29 — `DOC-01: Building placement strategy` — merged.
- PR #30 — `BUILD-ANCHOR-01: BuildingPlacementMeta data model` — merged.
- PR #31 — `ARCH-00-docs: Workflow, roadmap, and roadmap system audit docs` — merged.
- PR #32 — `BUILD-ANCHOR-02: Offline alpha-bounds generator` — merged.
- PR #33 — `BUILD-ANCHOR-03: Render completed buildings with placement metadata` — merged.

Completed building placement direction:

```text
offline metadata / alpha bounds
alpha-bottom ground line
south-vertex footprint anchoring
generic renderer formula
footprint-based target display width
fallback diamond only for missing metadata/texture
dev tuner only as diagnostic
```

Manual `displayWidth / origin / offset` tuning per PNG is not the production path.

---

## Closed / superseded work

PR #28 — `BUILD-01: Render Completed Separator from PNG` — closed, not merged.

Reason:

```text
It helped diagnose the problem,
but its production approach relied too much on manual per-PNG tuning.
```

---

## Hard stop

Do not start:

- combat system code
- enemy AI code
- random / unscoped implementation work
- more building-placement polish unless it is required by an accepted roadmap task or a regression fix

Allowed next workstream:

- ARCH-01 — Economy baseline.

---

## Maintenance policy

This file should stay short.

It may be updated after important PRs or direction changes.

Small updates to this file do not always require a dedicated docs-only PR if they are part of a related documentation update.

Detailed history belongs in:

- PR bodies;
- roadmap docs;
- audit docs;
- architecture docs.
