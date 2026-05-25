# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Current mode

Process / workflow rework.

No new code PRs until workflow docs and roadmap direction are accepted.

---

## Current priority

Finish and commit project workflow documentation:

- `docs/project/START_HERE_FOR_GPT.md`
- `docs/project/GPT_WORKFLOW.md`
- `docs/project/GLM_EXECUTOR_RULES.md`
- `docs/project/PROJECT_STATE.md`

After that, rework the roadmap before continuing implementation.

---

## Recent accepted direction

The project must move from ad-hoc implementation to a system-first workflow.

Core rule:

```text
roadmap -> audit/design -> scoped PR sequence -> implementation
```

Manual per-object tuning is not accepted as the default production approach.

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

- `BUILD-ANCHOR-02`
- alpha-bounds generator
- building renderer changes
- economy changes
- new asset rendering
- new combat work
- new production/factory work

until the roadmap is reworked and accepted.

---

## Next planned discussion

Rework the project roadmap by large ARCH blocks.

The roadmap must describe not only what we want, but also:

- how each system should be implemented;
- what Phaser 4 APIs or project systems are relevant;
- what data model is needed;
- what should be audited first;
- what PR sequence is safe.

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
