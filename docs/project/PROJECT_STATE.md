# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`

---

## Current mode

Implementation — larger coherent PRs under accepted roadmap and GPT/Denis control.

Workflow docs and roadmap direction are accepted.

After ARCH-11A and ARCH-05X, the project uses a high-controlled implementation model:

```text
GLM executes larger coherent PRs.
GPT reviews scope, diff, validation, and hardening.
Denis performs manual QA for gameplay/visual/UX behavior.
PRs are not merged by GLM.
```

This replaces the earlier conservative elevated-ceiling default.

---

## Current priority

### Completed recently

ARCH-02 asset pipeline migration for current runtime-approved assets is **complete**.

ARCH-11A QA smoke automation is **complete**:

```text
npm run qa:smoke
CI QA Smoke Test
_reports report/screenshot artifacts
```

ARCH-05X high-risk civil movement/control/passability probe was merged and accepted as proof that GLM can handle larger coherent PRs when GPT/Denis actively control review and QA.

Implemented ARCH-05X direction:

```text
civil unit selection
LMB manual move command
harvester manual move override
resource-adjacent harvesting approach
resource/building passability for movement
civil unit dynamic blockers for manual move
builder manual move baseline
state tests + qa smoke gates
```

### Immediate next mini-stage

Next mini-stage:

```text
ARCH-05Y — Selection ring ground anchor + harvester movement smoothing
```

Scope:

- fix selection ring so it is anchored to the real unit ground footprint, not the PNG anchor point;
- fix harvester micro-teleport / movement smoothing issue;
- do not change pathfinding, passability, economy, asset pipeline, or selection model unless directly required.

---

## Accepted workflow

The project follows a system-first workflow defined in:

- `docs/project/START_HERE_FOR_GPT.md` — entry point for GPT agent.
- `docs/project/GPT_WORKFLOW.md` — GPT planner workflow rules.
- `docs/project/GLM_EXECUTOR_RULES.md` — GLM executor rules.
- `docs/project/ARCH_SCOPING_POLICY.md` — ARCH phase grouping and high-controlled risk policy.
- `docs/ROADMAP.md` — 21-ARCH roadmap with scoped PR sequences.
- `docs/ROADMAP_SYSTEM_AUDIT.md` — roadmap system audit.

Core rule:

```text
roadmap -> audit/design -> risk-based scoped PR package -> implementation -> review/hardening -> merge
```

---

## Current risk policy summary

Current default implementation target:

```text
high-controlled
```

Meaning:

- large coherent PRs are allowed;
- high+ is allowed with explicit Denis approval if it stays inside one connected domain;
- unrelated-system bundles are still rejected;
- tests/typecheck/build/qa-smoke are required for runtime PRs;
- manual QA remains mandatory for visual/gameplay/UX-sensitive changes;
- hardening passes are expected when review finds prototype debt.

---

## ARCH-02 asset pipeline status

PreloadScene loads all current runtime-approved assets from
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

Possible follow-up items:

- ARCH-02J — optional legacy cleanup only when useful;
- future decor/fx/ui families only when approved assets are introduced.

---

## Recently completed ARCH-01 economy baseline

Important PRs:

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

---

## Recently completed ARCH-03 building placement work

The ARCH-03 building PNG placement sequence was completed before returning to ARCH-01 because the renderer needed a systemic metadata-driven placement path and PR #28 had been closed as manual-tuning based.

Important PRs:

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

Do not start without explicit accepted scope:

- full combat system;
- enemy AI;
- save/load;
- random / unscoped implementation work;
- unrelated-system high+ bundles.

Allowed next workstream:

- ARCH-05Y — Selection ring ground anchor + harvester movement smoothing.

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
