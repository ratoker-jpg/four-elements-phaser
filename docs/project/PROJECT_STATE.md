# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Current mode

Implementation — scoped technical PRs under accepted roadmap.

Workflow docs and roadmap direction are accepted (PR #31 — ARCH-00-docs).

ARCH-01 Economy baseline is now complete enough to stop and move to the next roadmap workstream.

---

## Current priority

ARCH-02 asset pipeline migration for current runtime-approved assets is **complete**.

PreloadScene now loads all current runtime-approved assets from
`src/assets/generatedAssetManifest.ts` via `src/assets/runtimeGeneratedAssets.ts`.

Generated manifest families and counts:

```text
hq:            4  (image)
buildings:    24  (image)
civilUnits:    8  (spritesheet)
modularUnits: 64  (image)
terrain:       3  (image)
resources:     3  (image)
total:       106 assets
```

Legacy files remain for compatibility and are no longer called by PreloadScene:

- `src/assets/assetManifest.ts` — original base manifest (terrain, harvester, minerals)
- `src/assets/buildingAssets.ts` — building loader (deprecated fallback)
- `src/assets/civilUnitAssets.ts` — civil unit loader (deprecated fallback)
- `src/assets/modularUnitAssets.ts` — modular unit loader (deprecated fallback)

ARCH-02 completed PRs:

- ARCH-02A — asset pipeline strategy (PR #38)
- ARCH-02B+C — manifest schema, validation script, folder scaffold (PR #45)
- ARCH-02D — buildings/HQ processor MVP (PR #46)
- ARCH-02E — generated asset sample viewer (PR #47)
- ARCH-02F — runtime generated manifest integration for hq/buildings (PR #48)
- ARCH-02G — civilUnits spritesheets from generated manifest (PR #50)
- ARCH-02H — modularUnits images from generated manifest (PR #51)
- ARCH-02I — terrain/resources from generated manifest (PR #53)
- CI helper PR #52 — workflow_dispatch for manual PR preview builds

Possible follow-up items:

- ARCH-02J — optional legacy cleanup (remove deprecated loader files)
- Future decor/fx/ui families only when approved assets are introduced

Before preparing the next GLM task, GPT must read:

- `docs/project/START_HERE_FOR_GPT.md`
- `docs/project/GPT_WORKFLOW.md`
- `docs/project/PROJECT_STATE.md`
- `docs/project/ARCH_SCOPING_POLICY.md`
- `docs/ROADMAP.md`
- `docs/ROADMAP_SYSTEM_AUDIT.md`

---

## Accepted workflow

The project follows a system-first workflow defined in:

- `docs/project/START_HERE_FOR_GPT.md` — entry point for GPT agent.
- `docs/project/GPT_WORKFLOW.md` — GPT planner workflow rules.
- `docs/project/GLM_EXECUTOR_RULES.md` — GLM executor rules.
- `docs/project/ARCH_SCOPING_POLICY.md` — ARCH phase grouping and risk ceiling.
- `docs/ROADMAP.md` — 21-ARCH roadmap with scoped PR sequences.
- `docs/ROADMAP_SYSTEM_AUDIT.md` — roadmap system audit.

Core rule:

```text
roadmap -> audit/design -> risk-based scoped PR sequence -> implementation
```

---

## Recently completed ARCH-01 economy baseline

Recent important PRs:

- PR #36 — `ARCH-01B: EconomyState + matter-based construction baseline` — merged.
- PR #37 — `ARCH-01C: Separator processing cycle` — merged.
- PR #39 — `ARCH-01D: Storage caps + cap-safe economy processing` — merged.
- PR #40 — `ARCH-01E: Power baseline + separator power gating` — merged.
- PR #41 — `ARCH-01F: Units-factory production baseline` — merged.

Implemented economy direction:

```text
raw gathering
matter/elements economy
separator conversion cycle
storage caps
power generation and active consumption
power-plant config
units-factory production queue
builder/harvester matter + element costs
builder/harvester production and spawn
```

ARCH-01 is not perfect final gameplay/UI. Remaining production UI, save/load integration, balancing, and combat-unit production should happen under later accepted roadmap workstreams, not as random ARCH-01 spillover.

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

- combat system code;
- enemy AI code;
- random / unscoped implementation work;
- more economy spillover unless it is a regression fix or accepted roadmap task;
- more building-placement polish unless it is required by an accepted roadmap task or a regression fix.

Allowed next workstream:

- ARCH-02 — Art / sprite pipeline.

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
