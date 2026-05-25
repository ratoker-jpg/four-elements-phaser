# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Current mode

Implementation — scoped technical PRs under accepted roadmap.

Workflow docs and roadmap direction are accepted (PR #31 — ARCH-00-docs).

---

## Current priority

BUILD-ANCHOR-02 — offline alpha-bounds generator.

This is the first technical PR under the new workflow.

Scope:

- Generate per-building alpha-bounds metadata from PNG assets at build/dev time.
- Output structured data consumable by the BuildingPlacementMeta model (PR #30).
- No runtime renderer changes in this PR.
- No manual per-PNG tuning.

---

## Accepted workflow

The project now follows a system-first workflow defined in:

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

## Current building placement decision

Building PNG placement must use a systemic metadata-based approach.

Accepted direction:

```text
offline metadata / alpha bounds
south-vertex footprint anchoring
generic renderer formula
dev tuner only as diagnostic
```

Manual `displayWidth / origin / offset` tuning per PNG is not the production path.

---

## Recent important PRs

- PR #29 — `DOC-01: Building placement strategy` — merged.
- PR #30 — `BUILD-ANCHOR-01: BuildingPlacementMeta data model` — merged.
- PR #31 — `ARCH-00-docs: Workflow, roadmap, and roadmap system audit docs` — merged.

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
- economy system code
- random / unscoped implementation work

Building-placement technical PRs (BUILD-ANCHOR-02 and following) are allowed under the accepted roadmap.

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
